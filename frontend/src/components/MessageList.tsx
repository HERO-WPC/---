import './MessageList.css'

interface Props {
  messages: {
    id: string
    content: string
    name: string
    files: string[]
    createdAt: string
  }[]
}

function MessageList({ messages }: Props) {
  const formatTime = (time: string) => {
    const date = new Date(time)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const isVideo = (url: string) => {
    return url.match(/\.(mp4|webm|mov|avi|mkv)$/i)
  }

  const isImage = (url: string) => {
    return url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
  }

  // 处理图片点击，可以打开模态框
  const handleImageClick = (src: string) => {
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>查看图片</title>
            <style>
              body { 
                margin: 0; 
                padding: 20px; 
                background: #1a1a2e; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                min-height: 100vh;
              }
              img { 
                max-width: 90vw; 
                max-height: 90vh; 
                object-fit: contain; 
                border: 2px solid #444;
                border-radius: 8px;
              }
            </style>
          </head>
          <body>
            <img src="${src}" alt="查看大图" />
          </body>
        </html>
      `);
    }
  }

  return (
    <div className="message-list">
      {messages.map(message => (
        <div key={message.id} className="message">
          <div className="message-header">
            <span className="message-name">👤 {message.name}</span>
            <span className="message-time">{formatTime(message.createdAt)}</span>
          </div>
          <div className="message-content">{message.content}</div>
          {message.files.length > 0 && (
            <div className="message-files">
              {message.files.map((file, index) => {
                if (isVideo(file)) {
                  return (
                    <div key={index} className="message-file">
                      <video src={file} controls onClick={(e) => {
                        const video = e.currentTarget;
                        if (video.paused) {
                          video.play();
                        } else {
                          video.pause();
                        }
                      }} />
                    </div>
                  );
                } else if (isImage(file)) {
                  return (
                    <div key={index} className="message-file">
                      <img 
                        src={file} 
                        alt={`附件 ${index + 1}`} 
                        loading="lazy" 
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleImageClick(file)}
                      />
                    </div>
                  );
                } else {
                  return (
                    <div key={index} className="message-file">
                      <a href={file} target="_blank" rel="noopener noreferrer">📎 下载文件</a>
                    </div>
                  );
                }
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default MessageList
