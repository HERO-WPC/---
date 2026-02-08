// script.js

// ... (现有代码，例如 DOMContentLoaded 监听器) ...

const API_SUBMIT_URL = '/api/submit'; // 你的 Worker 后端接口路径

document.addEventListener('DOMContentLoaded', () => {
    const messageForm = document.getElementById('messageForm');
    const nicknameInput = document.getElementById('nickname');
    const messageInput = document.getElementById('message');
    const imageUploadInput = document.getElementById('imageUpload'); // 确保你的 input 有这个 id
    const fileNameSpan = document.getElementById('fileNameSpan'); // 显示文件名，确保你的 span 有这个 id
    const isPublicCheckbox = document.getElementById('isPublic');
    const formStatus = document.getElementById('formStatus');
    const formError = document.getElementById('formError');
    const messagesContainer = document.getElementById('messagesContainer'); // 加载留言的容器

    // 文件选择框改变事件
    imageUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            fileNameSpan.textContent = file.name;
        } else {
            fileNameSpan.textContent = '未选择任何文件';
        }
    });

    messageForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        formStatus.textContent = '正在提交，请稍候...';
        formError.textContent = '';
        messageForm.querySelector('button[type="submit"]').disabled = true;

        const nickname = nicknameInput.value.trim();
        const message = messageInput.value.trim();
        const imageFile = imageUploadInput.files[0];
        const isPublic = isPublicCheckbox.checked;

        if (!nickname || !message) {
            formError.textContent = '昵称和内容不能为空。';
            formStatus.textContent = '';
            messageForm.querySelector('button[type="submit"]').disabled = false;
            return;
        }

        const formData = new FormData();
        formData.append('nickname', nickname);
        formData.append('message', message);
        formData.append('isPublic', isPublic);

        if (imageFile) {
            if (imageFile.size > 5 * 1024 * 1024) { // 限制图片大小为 5MB
                formError.textContent = '图片大小不能超过 5MB。';
                formStatus.textContent = '';
                messageForm.querySelector('button[type="submit"]').disabled = false;
                return;
            }

            // 读取图片为 Base64
            const reader = new FileReader();
            reader.readAsDataURL(imageFile); // 读取为 Data URL (Base64)

            reader.onload = async () => {
                formData.append('imageData', reader.result); // 添加 Base64 数据到 FormData
                await sendForm(formData);
            };
            reader.onerror = () => {
                formError.textContent = '读取图片出错。';
                formStatus.textContent = '';
                messageForm.querySelector('button[type="submit"]').disabled = false;
            };
        } else {
            await sendForm(formData);
        }
    });

    async function sendForm(formData) {
        try {
            const response = await fetch(API_SUBMIT_URL, {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (response.ok && result.success) {
                formStatus.textContent = '留言提交成功！';
                nicknameInput.value = '';
                messageInput.value = '';
                imageUploadInput.value = null; // 清空文件选择
                fileNameSpan.textContent = '未选择任何文件'; // 重置文件显示
                isPublicCheckbox.checked = true;

                setTimeout(() => {
                    formStatus.textContent = '';
                }, 3000);
                loadMessages(); // 重新加载留言
            } else {
                formError.textContent = `提交失败: ${result.error || '未知错误'}`;
                formStatus.textContent = '';
            }
        } catch (error) {
            console.error('提交留言时发生错误:', error);
            formError.textContent = '提交留言时发生网络错误，请稍后重试。';
            formStatus.textContent = '';
        } finally {
            messageForm.querySelector('button[type="submit"]').disabled = false;
        }
    }

    // ... (现有的 loadMessages 和渲染留言的代码) ...
    // 在渲染留言时，如果 message.imageUrl 存在，则显示图片
    // 例如：
    // if (message.imageUrl) {
    //     messageElement.innerHTML += `<img src="${message.imageUrl}" alt="留言图片" style="max-width: 100%; height: auto; margin-top: 10px;">`;
    // }
    
    // 首次加载留言
    loadMessages();
});

// 确保你的 loadMessages 函数能够正确渲染图片
async function loadMessages() {
    try {
        const response = await fetch('/api/messages'); // 获取留言的 API
        const messages = await response.json();

        messagesContainer.innerHTML = ''; // 清空现有留言

        messages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.className = 'message-card'; // 假设你有一个 message-card 样式

            let imageHtml = '';
            if (message.imageUrl) {
                // 如果有图片，就创建一个 img 标签
                imageHtml = `<img src="${message.imageUrl}" alt="留言图片" style="max-width: 100%; height: auto; margin-top: 10px; border-radius: 8px;">`;
            }

            messageElement.innerHTML = `
                <div class="message-header">
                    <strong>${message.nickname}</strong>
                    <span>${new Date(message.timestamp).toLocaleString()}</span>
                </div>
                <p>${message.message}</p>
                ${imageHtml} <!-- 在这里插入图片 -->
            `;
            messagesContainer.prepend(messageElement); // 最新留言显示在最上面
        });
    } catch (error) {
        console.error('加载留言时发生错误:', error);
        messagesContainer.innerHTML = '<p>无法加载留言，请稍后重试。</p>';
    }
}
