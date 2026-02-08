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
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 800px; margin: 0 auto; }
    h1 {
      color: white; text-align: center; margin-bottom: 30px;
      font-size: 2.5rem; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
    }
    .card {
      background: white; border-radius: 12px; padding: 24px;
      margin-bottom: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    .form-group { margin-bottom: 16px; }
    label { display: block; margin-bottom: 6px; color: #333; font-weight: 500; }
    input, textarea {
      width: 100%; padding: 12px; border: 2px solid #e0e0e0;
      border-radius: 8px; font-size: 16px; transition: border-color 0.3s;
    }
    input:focus, textarea:focus { outline: none; border-color: #667eea; }
    textarea { resize: vertical; min-height: 100px; }
    .file-label {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 12px 20px; background: #f0f0f0; border-radius: 8px;
      cursor: pointer; transition: background 0.3s;
    }
    .file-label:hover { background: #e0e0e0; }
    .btn {
      padding: 12px 24px; border: none; border-radius: 8px;
      font-size: 16px; font-weight: 500; cursor: pointer;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white; transition: transform 0.2s, box-shadow 0.2s;
    }
    .btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .message {
      border-bottom: 1px solid #eee; padding-bottom: 20px; margin-bottom: 20px;
    }
    .message:last-child { border-bottom: none; margin-bottom: 0; }
    .message-header {
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;
    }
    .message-name { font-weight: 600; color: #333; }
    .message-time { color: #999; font-size: 14px; }
    .message-content { color: #555; line-height: 1.6; white-space: pre-wrap; }
    .message-files { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    .message-file {
      max-width: 200px; border-radius: 8px; overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1); background: #f5f5f5;
    }
    .message-file img, .message-file video {
      width: 100%; height: auto; display: block; max-height: 200px; object-fit: cover;
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
    .loading { text-align: center; padding: 20px; color: #666; }
    .error { background: #ff4757; color: white; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
    .empty { text-align: center; padding: 40px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📝 留言板</h1>
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
          <label>附件（最多5个，支持图片和视频）</label>
          <input type="file" id="fileInput" accept="image/*,video/*" multiple style="display:none">
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
      files = [...files, ...selected];
      selected.forEach(file => {
        previews.push({
          url: URL.createObjectURL(file),
          type: file.type.startsWith('video/') ? 'video' : 'image'
        });
      });
      renderPreviews();
    });

    function renderPreviews() {
      const container = document.getElementById('previewFiles');
      container.innerHTML = previews.map((p, i) => '<div class="preview-item">' + 
        (p.type === 'video' ? '<video src="' + p.url + '" muted></video>' : '<img src="' + p.url + '">') +
        '<button type="button" class="preview-remove" onclick="removeFile(' + i + ')">×</button></div>'
      ).join('');
    }

    window.removeFile = function(index) {
      files = files.filter((_, i) => i !== index);
      previews = previews.filter((_, i) => i !== index);
      renderPreviews();
    };

    async function uploadFile(file) {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(API_BASE + '/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      return data.success ? data.data.url : null;
    }

    async function fetchMessages() {
      const res = await fetch(API_BASE + '/api/messages');
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
      container.innerHTML = data.data.map(m => '<div class="message">' +
        '<div class="message-header"><span class="message-name">👤 ' + m.name + '</span>' +
        '<span class="message-time">' + new Date(m.createdAt).toLocaleString('zh-CN') + '</span></div>' +
        '<div class="message-content">' + m.content + '</div>' +
        (m.files.length > 0 ? '<div class="message-files">' + m.files.map(f => 
          '<div class="message-file">' + (f.match(/\.(mp4|webm|mov)$/i) ? 
          '<video src="' + f + '" controls></video>' : '<img src="' + f + '" loading="lazy">') + '</div>'
        ).join('') + '</div>' : '') + '</div>'
      ).join('');
    }

    document.getElementById('messageForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('name').value.trim();
      const content = document.getElementById('content').value.trim();
      const btn = document.getElementById('submitBtn');
      if (!name || !content) { alert('请填写昵称和内容'); return; }
      btn.disabled = true;
      btn.textContent = '发送中...';
      const uploadedFiles = [];
      for (const file of files) {
        const url = await uploadFile(file);
        if (url) uploadedFiles.push(url);
      }
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
      btn.disabled = false;
      btn.textContent = '发送留言';
    });

    fetchMessages();
  </script>
</body>
</html>
`