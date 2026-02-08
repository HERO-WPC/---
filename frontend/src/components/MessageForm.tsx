import { useState, useRef } from 'react'
import './MessageForm.css'

interface Props {
  onMessagePosted: () => void
  apiBase: string
}

interface FileUpload {
  url: string
  key: string
}

interface UploadResult {
  url: string
  key: string
  error?: string
}

function MessageForm({ onMessagePosted, apiBase }: Props) {
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<FileUpload[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.files || [])
          if (selected.length + files.length > 5) {
          alert('最多只能上传 5 个文件')
          return
        }
            // 检查文件大小
            for (const file of selected) {
              if (file.size > 25 * 1024 * 1024) { // 25MB
                alert(file.name + ' 超过 25MB，已跳过')
                return
              }
            }        setFiles(prev => [...prev, ...selected])
        
        // 生成预览
        const newPreviews = selected.map(file => ({
          url: URL.createObjectURL(file),
          key: ''
        }))
        setPreviews(prev => [...prev, ...newPreviews])  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const uploadFile = async (file: File): Promise<UploadResult | null> => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`${apiBase}/api/upload`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (data.success) {
        return data.data
      }
      return { url: '', key: '', error: data.error || '上传失败' }
    } catch (error) {
      return { url: '', key: '', error: '网络错误' }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !content.trim()) {
      alert('请填写昵称和内容')
      return
    }

    setSubmitting(true)
    setUploadError(null)

    try {
      // 先上传所有文件
      const uploadedFiles: string[] = []
      for (const file of files) {
        const result = await uploadFile(file)
        if (result?.url) {
          uploadedFiles.push(result.url)
        } else if (result?.error) {
          setUploadError(`文件 "${file.name}" 上传失败: ${result.error}`)
          setSubmitting(false)
          return
        }
      }

      // 提交留言
      const res = await fetch(`${apiBase}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          content: content.trim(),
          files: uploadedFiles
        })
      })

      const data = await res.json()
      if (data.success) {
        setName('')
        setContent('')
        setFiles([])
        setPreviews([])
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        onMessagePosted()
      } else {
        alert(data.error || '发送失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>昵称</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="请输入你的昵称"
          maxLength={50}
        />
      </div>

      <div className="form-group">
        <label>留言内容</label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="写下你想说的话..."
          maxLength={2000}
        />
      </div>

      <div className="form-group">
        <label>附件（最多5个，支持图片和视频）</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="*/*"
          multiple
          onChange={handleFileChange}
          className="file-input"
          id="file-input"
        />
        <label htmlFor="file-input" className="file-label">
          📎 选择文件
        </label>
      </div>

      {previews.length > 0 && (
        <div className="preview-files">
          {previews.map((preview, index) => (
            <div key={index} className="preview-item">
              {files[index].type.startsWith('video/') ? (
                <video src={preview.url} muted />
              ) : (
                <img src={preview.url} alt="" />
              )}
              <button
                type="button"
                className="preview-remove"
                onClick={() => removeFile(index)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {uploadError && (
        <div className="error-message" style={{ color: '#dc3545', marginBottom: '10px', padding: '10px', backgroundColor: '#f8d7da', borderRadius: '4px' }}>
          ⚠️ {uploadError}
        </div>
      )}

      <button 
        type="submit" 
        className="btn btn-primary"
        disabled={submitting || uploading}
      >
        {submitting ? '发送中...' : '发送留言'}
      </button>
    </form>
  )
}

export default MessageForm
