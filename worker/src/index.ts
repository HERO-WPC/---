import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { FRONTEND_HTML } from './frontend'

interface Env {
  MESSAGES: KVNamespace
  B2_AUTH: string
}

interface Message {
  id: string
  content: string
  name: string
  files: string[]
  createdAt: string
}

const app = new Hono<Env>()

// CORS 配置
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}))

// Backblaze B2 授权
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
    const bucketRes = await fetch(`https://api.backblazeb2.com/b2api/v3/b2_get_upload_url?bucketId=ALL`, {
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

    const id = crypto.randomUUID()
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
