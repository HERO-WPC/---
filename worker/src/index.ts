import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { FRONTEND_HTML } from './frontend'

interface Env {
  MESSAGES: KVNamespace
  FILES: R2Bucket
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

// 上传文件
app.post('/api/upload', async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return c.json({ success: false, error: '没有文件' }, 400)
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp',
                          'video/mp4', 'video/webm', 'video/quicktime']
    if (!allowedTypes.includes(file.type)) {
      return c.json({ success: false, error: '不支持的文件类型' }, 400)
    }

    if (file.size > 10 * 1024 * 1024) {
      return c.json({ success: false, error: '文件大小不能超过 10MB' }, 400)
    }

    const id = crypto.randomUUID()
    const ext = file.name.split('.').pop() || ''
    const key = `uploads/${id}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    await c.env.FILES.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      }
    })

    const workerUrl = `https://${c.req.header('host')}`
    const url = `${workerUrl}/files/${key}`

    return c.json({ success: true, data: { url, key } })
  } catch (error) {
    return c.json({ success: false, error: '上传失败' }, 500)
  }
})

// 获取文件
app.get('/files/:key{*}', async (c) => {
  const key = c.req.param('key')
  const object = await c.env.FILES.get(key)

  if (!object) {
    return c.text('文件不存在', 404)
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('cache-control', 'public, max-age=31536000')

  return new Response(object.body, { headers })
})

// 前端页面
app.get('/', async (c) => {
  return c.html(FRONTEND_HTML)
})

export default app