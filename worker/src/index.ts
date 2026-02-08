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

      // 将文件转换为 ArrayBuffer
      const fileBuffer = await file.arrayBuffer();
      // 将 ArrayBuffer 转换为 Base64 字符串
      const bytes = new Uint8Array(fileBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const fileBase64 = btoa(binary);

      // 从 GITHUB_REPO 环境变量中提取 owner 和 repo
      const [owner, repo] = githubRepo.split('/');

      if (!owner || !repo) {
        return c.json({ success: false, error: 'GITHUB_REPO 格式错误，应为 username/repository' }, 500)
      }

      const githubBranch = c.env.GITHUB_BRANCH || 'main';
      
      // 生成唯一文件名（参考示例代码格式）
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop() || 'file';
      const cleanedNickname = 'guest'; // 可以从请求中获取上传者信息，这里使用默认名称
      const fileName = `uploads/${cleanedNickname}-${timestamp}.${fileExtension}`;
      
      const githubApiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${fileName}`;

      // 上传到 GitHub（使用示例中的方法）
      const githubResponse = await fetch(githubApiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'cloudflare-guestbook-app'
        },
        body: JSON.stringify({
          message: `Add file: ${fileName} via guestbook`,
          content: fileBase64,
          branch: githubBranch
        })
      });

      const githubResult = await githubResponse.json();

      if (!githubResponse.ok) {
        console.error('GitHub API 上传失败:', githubResult);
        return c.json({ success: false, error: `GitHub上传失败: ${githubResult.message || '未知错误'}` }, 500);
      }

      // 返回 GitHub raw 链接
      const fileUrl = `https://raw.githubusercontent.com/${githubRepo}/${githubBranch}/${fileName}`;
      
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
