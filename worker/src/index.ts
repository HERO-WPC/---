import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { FRONTEND_HTML } from './frontend'

interface Env {
  MESSAGES: KVNamespace
  B2_AUTH: string
  B2_BUCKET_ID: string
  B2_BUCKET_NAME: string
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

// 上传文件到 B2
app.post('/api/upload', async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return c.json({ success: false, error: '没有文件' }, 400)
    }

    const auth = c.env.B2_AUTH
    if (!auth) {
      return c.json({ success: false, error: '未配置 B2 授权' }, 500)
    }

    // 解析 Base64 编码的授权信息
    const decoded = atob(auth)
    const [keyID, applicationKey] = decoded.split(':')

    // 获取 Authorization Token
    const authRes = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
      headers: {
        'Authorization': 'Basic ' + btoa(keyID + ':' + applicationKey)
      }
    })

    if (!authRes.ok) {
      return c.json({ success: false, error: 'B2 授权失败' }, 500)
    }

    const authData = await authRes.json()

    // 获取上传 URL
    const bucketRes = await fetch(`https://api.backblazeb2.com/b2api/v3/b2_get_upload_url?bucketId=${c.env.B2_BUCKET_ID}`, {
      headers: {
        'Authorization': authData.authorizationToken
      }
    })

    if (!bucketRes.ok) {
      return c.json({ success: false, error: '获取上传 URL 失败' }, 500)
    }

    const bucketData = await bucketRes.json()

    // 生成唯一文件名
    const ext = file.name.split('.').pop() || ''
    const fileName = `${Date.now()}-${generateUUID()}.${ext}`
    const fileData = await file.arrayBuffer()

    // 上传到 B2
    const uploadRes = await fetch(bucketData.uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': bucketData.authorizationToken,
        'X-Bz-File-Name': fileName,
        'Content-Type': file.type,
        'X-Bz-Content-Sha1': 'do_not_verify'
      },
      body: fileData
    })

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text()
      console.error('B2 上传失败:', uploadRes.status, errorText)
      return c.json({ success: false, error: `上传失败: ${uploadRes.status}` }, 500)
    }

    // 返回文件访问 URL (使用公开 URL)
    const fileUrl = `${authData.downloadUrl}/file/${c.env.B2_BUCKET_NAME}/${fileName}`

    return c.json({
      success: true,
      data: {
        url: fileUrl,
        key: fileName
      }
    })
  } catch (error) {
    console.error('上传错误:', error)
    return c.json({ success: false, error: '上传失败' }, 500)
  }
})
app.get('/api/b2-auth', async (c) => {
  try {
    const auth = c.env.B2_AUTH
    if (!auth) {
      return c.json({ success: false, error: '未配置 B2 授权' }, 500)
    }
    
    // 解析 Base64 编码的授权信息
    const decoded = atob(auth)
    const [keyID, applicationKey] = decoded.split(':')
    
    // 获取 Authorization Token
    const authRes = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
      headers: {
        'Authorization': 'Basic ' + btoa(keyID + ':' + applicationKey)
      }
    })
    
    if (!authRes.ok) {
      return c.json({ success: false, error: 'B2 授权失败' }, 500)
    }
    
    const authData = await authRes.json()
    
    // 获取上传 URL
    const bucketRes = await fetch(`https://api.backblazeb2.com/b2api/v3/b2_get_upload_url?bucketId=${c.env.B2_BUCKET_ID}`, {
      headers: {
        'Authorization': authData.authorizationToken
      }
    })
    
    const bucketData = await bucketRes.json()
    
    return c.json({
      success: true,
      data: {
        authorizationToken: authData.authorizationToken,
        uploadUrl: bucketData.uploadUrl,
        apiUrl: authData.apiUrl,
        bucketId: bucketData.bucketId
      }
    })
  } catch (error) {
    return c.json({ success: false, error: '获取 B2 授权失败' }, 500)
  }
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
