import { useState, useEffect } from 'react'
import MessageForm from './components/MessageForm'
import MessageList from './components/MessageList'
import './App.css'

// 配置你的 Worker URL (生产环境使用相对路径)
const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL || 'https://cloudflare-guestbook2.wpc20111128.workers.dev')

interface Message {
  id: string
  content: string
  name: string
  files: string[]
  createdAt: string
}

interface FileUpload {
  url: string
  key: string
}

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchMessages = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/messages`)
      const data = await res.json()
      if (data.success) {
        setMessages(data.data)
      } else {
        setError(data.error || '获取留言失败')
      }
    } catch {
      setError('网络错误，请检查后端服务')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMessages()
  }, [])

  const handleMessagePosted = () => {
    fetchMessages()
  }

  return (
    <div className="container">
      <h1>📝 留言板</h1>
      
      {error && <div className="error">{error}</div>}
      
      <div className="card">
        <MessageForm onMessagePosted={handleMessagePosted} apiBase={API_BASE} />
      </div>

      <div className="card">
        {loading ? (
          <div className="loading">加载中...</div>
        ) : messages.length === 0 ? (
          <div className="empty">暂无留言，快来抢沙发！</div>
        ) : (
          <MessageList messages={messages} />
        )}
      </div>
    </div>
  )
}

export default App
