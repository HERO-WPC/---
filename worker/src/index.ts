import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { FRONTEND_HTML } from './frontend'

interface Env {
  MESSAGES: KVNamespace
  GITHUB_TOKEN: string
  GITHUB_REPO: string
  GITHUB_BRANCH?: string
  GITHUB_PATH?: string
}

interface Message {
  id: string
  content: string
  name: string
  files: string[]
  createdAt: string
}

// 生成 UUID
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const app = new Hono<Env>()

// CORS 配置
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}))

// 上传文件（优先使用 GitHub，如果未配置则使用 Workers KV 存储小文件）
app.post('/api/upload', async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return c.json({ success: false, error: '没有文件' }, 400)
    }

    // 检查文件大小
    const githubToken = c.env.GITHUB_TOKEN
    const githubRepo = c.env.GITHUB_REPO
    
    console.log('GitHub 配置检查:', {
      hasToken: !!githubToken,
      hasRepo: !!githubRepo
    });
    
    if (githubToken && githubRepo) {
      // 使用 GitHub 上传（大文件支持）
      if (file.size > 25 * 1024 * 1024) { // 25MB 限制
        return c.json({ success: false, error: '文件太大，使用 GitHub 上传时最大支持 25MB' }, 400)
      }

      const fileData = await file.arrayBuffer()
      // 正确的 base64 编码方式
      const fileBase64 = btoa(
        new Uint8Array(fileData)
          .reduce((data, byte) => data + String.fromCharCode(byte), '')
      )
      
      const githubBranch = c.env.GITHUB_BRANCH || 'main'
      const githubPath = c.env.GITHUB_PATH || 'uploads/'

      // 生成唯一文件名
      const fileId = generateUUID()
      const fileName = fileId + '.' + file.name.split('.').pop()
      const filePath = githubPath + fileName

      // 添加调试日志
      console.log('GitHub 上传信息:', {
        repo: githubRepo,
        filePath: filePath,
        fileSize: file.size,
        fileName: file.name,
        branch: githubBranch
      });

      // 上传到 GitHub
      const uploadRes = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${filePath}`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Upload ${file.name} via guestbook`,
          content: fileBase64,  // 已经是 base64，不需要再次 btoa
          branch: githubBranch
        })
      })

      if (!uploadRes.ok) {
        const uploadData = await uploadRes.text(); // 获取原始响应文本
        console.error('GitHub 上传失败:', uploadRes.status, uploadData)
        // 返回更具体的错误信息
        let errorMsg = `GitHub上传失败: HTTP ${uploadRes.status}`;
        if (uploadRes.status === 403) {
          errorMsg += " (权限被拒绝，请检查您的 GitHub Token 权限和仓库访问权限)";
        } else if (uploadRes.status === 404) {
          errorMsg += " (仓库或分支未找到，请检查仓库名称)";
        }
        return c.json({ success: false, error: errorMsg }, 500)
      }
      const uploadData = await uploadRes.json();

      // 返回 GitHub raw 链接
      const fileUrl = `https://raw.githubusercontent.com/${githubRepo}/${githubBranch}/${filePath}`
      
      return c.json({ success: true, data: { url: fileUrl, key: fileName } })
    } else {
      // 使用 Workers KV 作为备选方案（小文件支持）
      if (file.size > 1024 * 1024) { // 1MB 限制，适用于 KV 存储
        return c.json({ success: false, error: '文件太大，未配置 GitHub 上传时仅支持小于 1MB 的文件' }, 400)
      }

      const fileData = await file.arrayBuffer()
      
      // 生成唯一文件名
      const fileId = generateUUID()
      const fileName = fileId + '.' + file.name.split('.').pop()
      
      // 存储文件到 KV
      await c.env.MESSAGES.put(`file:${fileName}`, fileData, {
        metadata: {
          originalName: file.name,
          contentType: file.type,
          size: file.size
        }
      })

      return c.json({ success: true, data: { url: `/api/files/${fileName}`, key: fileName } })
    }
  } catch (error) {
    console.error('上传错误:', error)
    return c.json({ success: false, error: '上传失败' }, 500)
  }
})

// 获取文件
app.get('/api/files/:id', async (c) => {
  const fileId = c.req.param('id')
  const fileData = await c.env.MESSAGES.get(`file:${fileId}`, 'arrayBuffer')
  
  if (!fileData) {
    return c.text('File not found', 404)
  }
  
  // 获取文件元数据
  const metadata = await c.env.MESSAGES.getWithMetadata(`file:${fileId}`)
  
  return new Response(fileData, {
    headers: {
      'Content-Type': metadata.metadata?.contentType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${metadata.metadata?.originalName || fileId}"`
    }
  })
})


// 获取所有留言
app.get('/api/messages', async (c) => {
  try {
    const list = await c.env.MESSAGES.list({ limit: 100 })
    const messages: Message[] = []

    for (const key of list.keys) {
      const data = await c.env.MESSAGES.get(key.name)
      if (data) {
        messages.push(JSON.parse(data as string))
      }
    }

    // 按时间倒序排列
    messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return c.json({ success: true, data: messages })
  } catch (error) {
    return c.json({ success: false, error: '获取留言失败' }, 500)
  }
})

// 创建留言
app.post('/api/messages', async (c) => {
  try {
    const body = await c.req.json()
    const { content, name, files = [] } = body

    if (!content || !name) {
      return c.json({ success: false, error: '内容和昵称不能为空' }, 400)
    }

    const id = generateUUID()
    const message: Message = {
      id,
      content,
      name: name.slice(0, 50),
      files,
      createdAt: new Date().toISOString()
    }

    await c.env.MESSAGES.put(`message:${id}`, JSON.stringify(message))

    return c.json({ success: true, data: message })
  } catch (error) {
    return c.json({ success: false, error: '创建留言失败' }, 500)
  }
})

// 前端页面
app.get('/', async (c) => {
  return c.html(FRONTEND_HTML)
})

export default app
