export const FRONTEND_HTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>留言板</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      padding: 20px;
      color: #e0e0e0;
    }
    .container { max-width: 800px; margin: 0 auto; }
    h1 {
      color: #e0e0e0; text-align: center; margin-bottom: 30px;
      font-size: 2.5rem; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
    }
    .card {
      background: #252525; border-radius: 12px; padding: 24px;
      margin-bottom: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      border: 1px solid #444;
    }
    .form-group { margin-bottom: 16px; }
    label { display: block; margin-bottom: 6px; color: #e0e0e0; font-weight: 500; }
    input, textarea {
      width: 100%; padding: 12px; border: 2px solid #444;
      border-radius: 8px; font-size: 16px; transition: border-color 0.3s;
      background: #333;
      color: #e0e0e0;
    }
    input:focus, textarea:focus { outline: none; border-color: #667eea; }
    textarea { resize: vertical; min-height: 100px; }
    .file-label {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 12px 20px; background: #333; border-radius: 8px;
      cursor: pointer; transition: background 0.3s;
      color: #e0e0e0;
      border: 1px solid #444;
    }
    .file-label:hover { background: #444; }
    .btn {
      padding: 12px 24px; border: none; border-radius: 8px;
      font-size: 16px; font-weight: 500; cursor: pointer;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white; transition: transform 0.2s, box-shadow 0.2s;
    }
    .btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .message {
      border-bottom: 1px solid #444; padding-bottom: 20px; margin-bottom: 20px;
    }
    .message:last-child { border-bottom: none; margin-bottom: 0; }
    .message-header {
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;
    }
    .message-name { font-weight: 600; color: #e0e0e0; }
    .message-time { color: #aaa; font-size: 14px; }
    .message-content { color: #ccc; line-height: 1.6; white-space: pre-wrap; }
    .message-files { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    .message-file {
      max-width: 250px; border-radius: 8px; overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3); background: #333;
      border: 1px solid #444;
    }
    .message-file img, .message-file video {
      width: 100%; height: auto; display: block; max-height: 250px; object-fit: cover;
    }
    .message-file a {
      display: block; padding: 8px; color: #667eea; text-decoration: none;
      font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .preview-files { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
    .preview-item { position: relative; width: 100px; height: 100px; }
    .preview-item img, .preview-item video {
      width: 100%; height: 100%; object-fit: cover; border-radius: 8px;
    }
    .preview-remove {
      position: absolute; top: -8px; right: -8px; width: 24px; height: 24px;
      border-radius: 50%; background: #ff4757; color: white; border: none;
      cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px;
    }
    .loading { text-align: center; padding: 20px; color: #aaa; }
    .error { background: #ff4757; color: white; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
    .empty { text-align: center; padding: 40px; color: #aaa; }
    .info { background: #1e88e5; color: white; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📝 留言板</h1>
    <div class="info">💡 支持图片、视频等文件上传，最大 25MB</div>
    <div id="error" class="error" style="display:none"></div>
    <div class="card">
      <form id="messageForm">
        <div class="form-group">
          <label>昵称</label>
          <input type="text" id="name" placeholder="请输入你的昵称" maxLength="50" required>
        </div>
        <div class="form-group">
          <label>留言内容</label>
          <textarea id="content" placeholder="写下你想说的话..." maxLength="2000" required></textarea>
        </div>
        <div class="form-group">
          <label>附件（最多5个，最大 25MB）</label>
          <input type="file" id="fileInput" multiple style="display:none">
          <label for="fileInput" class="file-label">📎 选择文件</label>
        </div>
        <div id="previewFiles" class="preview-files"></div>
        <button type="submit" class="btn" id="submitBtn">发送留言</button>
      </form>
    </div>
    <div class="card">
      <div id="messageList">
        <div class="loading">加载中...</div>
      </div>
    </div>
    
    <!-- 图片模态框 -->
    <div id="imageModal" class="modal" style="display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.9); text-align: center;">
      <span class="close" onclick="closeImageModal()" style="position: absolute; top: 20px; right: 35px; color: white; font-size: 40px; font-weight: bold; cursor: pointer;">&times;</span>
      <img id="modalImage" class="modal-content" style="margin: auto; display: block; max-width: 90%; max-height: 90%; margin-top: 5%;">
    </div>
  </div>
  <script>
    const API_BASE = window.location.origin;
    let files = [];
    let previews = [];
    
    document.getElementById('fileInput').addEventListener('change', (e) => {
      const selected = Array.from(e.target.files);
      if (selected.length + files.length > 5) {
        alert('最多只能上传5个文件');
        return;
      }
      selected.forEach(file => {
        if (file.size > 25 * 1024 * 1024) {
          alert(file.name + ' 超过 25MB，已跳过');
          return;
        }
        files.push(file);
        previews.push({
          name: file.name,
          type: file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : 'file',
          url: URL.createObjectURL(file)
        });
      });
      renderPreviews();
    });

    function renderPreviews() {
      const container = document.getElementById('previewFiles');
      container.innerHTML = previews.map((p, i) => '<div class="preview-item">' + 
        (p.type === 'video' ? '<video src="' + p.url + '" muted></video>' : 
         p.type === 'image' ? '<img src="' + p.url + '">' : 
         '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f5f5f5;border-radius:8px;font-size:12px;color:#666;">📄</div>') +
        '<button type="button" class="preview-remove" onclick="removeFile(' + i + ')">×</button></div>'
      ).join('');
    }

    window.removeFile = function(index) {
      files = files.filter((_, i) => i !== index);
      previews = previews.filter((_, i) => i !== index);
      renderPreviews();
    };

    // 上传文件（优先使用 GitHub，如果未配置则使用 Workers KV）
    async function uploadFile(file) {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(API_BASE + '/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        return data.data.url;
      } else {
        throw new Error(data.error || '上传失败');
      }
    }

    // 获取文件下载链接
    function getDownloadUrl(fileNameOrUrl) {
      return fileNameOrUrl;
    }

    async function fetchMessages() {
      try {
        const res = await fetch(API_BASE + '/api/messages');
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        const container = document.getElementById('messageList');
        if (!data.success) {
          document.getElementById('error').style.display = 'block';
          document.getElementById('error').textContent = data.error || '获取留言失败';
          return;
        }
        if (data.data.length === 0) {
          container.innerHTML = '<div class="empty">暂无留言，快来抢沙发！</div>';
          return;
        }
        container.innerHTML = data.data.map(m => {
          let filesHtml = '';
          if (m.files && m.files.length > 0) {
            filesHtml = '<div class="message-files">' + m.files.map(f => {
              const isVideo = f.match(/\.(mp4|webm|mov|avi|mkv)$/i);
              const isImage = f.match(/\.(jpg|jpeg|png|gif|webp)$/i);
              const isPdf = f.match(/\.(pdf)$/i);
              const isDoc = f.match(/\.(doc|docx)$/i);
              const isTxt = f.match(/\.(txt)$/i);
              const isAudio = f.match(/\.(mp3|wav|ogg)$/i);
              const url = getDownloadUrl(f);
              
              if (isVideo) {
                return '<div class="message-file">' + 
                  '<video src="' + url + '" controls onclick="playVideo(this)"></video>' + 
                  '</div>';
              } else if (isImage) {
                return '<div class="message-file">' + 
                  '<img src="' + url + '" loading="lazy" onclick="showImageModal(this)" style="cursor: pointer;">' + 
                  '</div>';
              } else if (isPdf) {
                return '<div class="message-file">' + 
                  '<iframe src="' + url + '" width="100%" height="200px" style="border: none; border-radius: 8px;"></iframe>' + 
                  '</div>';
              } else if (isTxt) {
                return '<div class="message-file">' + 
                  '<iframe src="' + url + '" width="100%" height="200px" style="border: none; border-radius: 8px;"></iframe>' + 
                  '</div>';
              } else if (isAudio) {
                return '<div class="message-file">' + 
                  '<audio src="' + url + '" controls style="width: 100%;"></audio>' + 
                  '</div>';
              } else if (isDoc) {
                // 对于文档文件，使用 Google Docs Viewer
                const encodedUrl = encodeURIComponent(url);
                return '<div class="message-file">' + 
                  '<iframe src="https://docs.google.com/gview?url=' + url + '&embedded=true" width="100%" height="200px" style="border: none; border-radius: 8px;"></iframe>' + 
                  '</div>';
              } else {
                return '<div class="message-file">' + 
                  '<a href="' + url + '" target="_blank">📎 下载文件</a>' + '</div>';
              }
            }).join('') + '</div>';
          }
          return '<div class="message">' +
            '<div class="message-header"><span class="message-name">👤 ' + m.name + '</span>' +
            '<span class="message-time">' + new Date(m.createdAt).toLocaleString('zh-CN') + '</span></div>' +
            '<div class="message-content">' + m.content + '</div>' + filesHtml + '</div>';
        }).join('');
      } catch (error) {
        console.error('获取留言时发生错误:', error);
        const container = document.getElementById('messageList');
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = '获取留言失败: ' + error.message;
      }
    }

    document.getElementById('messageForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('name').value.trim();
      const content = document.getElementById('content').value.trim();
      const btn = document.getElementById('submitBtn');
      if (!name || !content) { alert('请填写昵称和内容'); return; }
      btn.disabled = true;
      btn.textContent = '上传中...';
      
      try {
        const uploadedFiles = [];
        for (const file of files) {
          btn.textContent = '上传 ' + file.name + '...';
          const fileUrl = await uploadFile(file);
          uploadedFiles.push(fileUrl);
        }
        
        btn.textContent = '发送中...';
        const res = await fetch(API_BASE + '/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, content, files: uploadedFiles })
        });
        const data = await res.json();
        
        if (data.success) {
          document.getElementById('name').value = '';
          document.getElementById('content').value = '';
          files = [];
          previews = [];
          renderPreviews();
          fetchMessages();
        } else {
          alert(data.error || '发送失败');
        }
      } catch (err) {
        alert('上传失败: ' + err.message);
      }
      
      btn.disabled = false;
      btn.textContent = '发送留言';
    });

    fetchMessages();
    
    // 图片模态框功能
    function showImageModal(img) {
      const modal = document.getElementById('imageModal');
      const modalImg = document.getElementById('modalImage');
      
      modal.style.display = 'block';
      modalImg.src = img.src;
    }
    
    function closeImageModal() {
      const modal = document.getElementById('imageModal');
      modal.style.display = 'none';
    }
    
    // 点击模态框外部关闭
    window.onclick = function(event) {
      const modal = document.getElementById('imageModal');
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    }
    
    // 视频播放功能
    function playVideo(video) {
      if (video.paused) {
        // 暂停其他视频
        document.querySelectorAll('video').forEach(v => {
          if (v !== video) v.pause();
        });
        video.play();
      } else {
        video.pause();
      }
    }
  </script>
</body>
</html>
`