/**
 * _worker.js
 *
 * 这是Cloudflare Worker的主入口文件，负责处理留言提交和获取。
 * 使用 itty-router 来管理 API 路由。
 */

import { Router } from 'itty-router';

// 初始化 itty-router
const router = Router();

// 声明环境变量
// env 对象会在 Cloudflare Pages Functions 中自动提供，
// 包含了在 Pages 项目设置中配置的 Secret 和 KV 绑定。
// 例如：
// interface Env {
//     GITHUB_TOKEN: string;
//     DB: KVNamespace;
//     DISCORD_WEBHOOK_URL: string; // <-- 新增的 Discord Webhook URL
//     ASSETS: { fetch: (request: Request) => Promise<Response> }; // Pages 默认绑定
// }

// --- 路由 POST /api/submit ---
// 处理用户提交留言和（可选）图片上传
router.post('/api/submit', async (request, env) => {
    try {
        // 解析请求体中的表单数据
        const formData = await request.formData();
        const nickname = formData.get('nickname'); // 获取昵称
        const message = formData.get('message');
        const imageData = formData.get('imageData'); // 前端传来的 Base64 Data URL
        const isPublic = formData.get('isPublic') === 'true'; // 将字符串 'true' 转换为布尔值 true

        // 验证基本输入：昵称和消息是必需的
        if (!nickname || typeof nickname !== 'string' || nickname.trim() === '' || !message) {
            return new Response(JSON.stringify({ success: false, error: '昵称和内容不能为空。' }), { // 更改为中文提示
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        let imageUrl = ''; // 用于存储上传图片后的 URL
        if (imageData) {
            console.log('接收到图片数据。尝试上传到 GitHub。'); // 更改为中文提示

            // 检查 GITHUB_TOKEN 是否存在
            if (!env.GITHUB_TOKEN) {
                console.error('GITHUB_TOKEN 环境变量未设置，无法上传图片到 GitHub。');
                return new Response(JSON.stringify({ success: false, error: '服务器图片服务配置错误，无法上传图片。' }), { // 更改为中文提示
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            // 解析 Base64 Data URL
            const parts = imageData.split(',');
            if (parts.length < 2) {
                console.error('无效的图片数据格式:', imageData); // 更改为中文提示
                throw new Error('无效的图片数据格式。'); // 更改为中文提示
            }
            const mimeTypePart = parts[0].split(';')[0];
            const mimeType = mimeTypePart.split(':')[1]; // 例如 'image/jpeg'
            const base64Content = parts[1]; // 纯 Base64 内容，用于 GitHub API

            // --- 核心修改部分：生成包含昵称的文件名 ---
            // 清理昵称：去除首尾空格，替换特殊字符为下划线，并限制长度。
            const cleanedNickname = nickname.trim().replace(/[^a-zA-Z0-9_-一-龥]/g, '_').substring(0, 50); // 增加支持中文
            const timestamp = Date.now(); // 获取当前时间戳
            const fileExtension = mimeType.split('/')[1] || 'png'; // 提取文件扩展名，默认 png

            // 新的文件名格式：uploads/昵称-时间戳.扩展名
            const fileName = `uploads/${cleanedNickname}-${timestamp}.${fileExtension}`;
            // --- 核心修改部分结束 ---

            // GitHub 仓库配置
            const owner = 'HERO-WPC'; // 替换为你的 GitHub 用户名
            const repo = 'herochat'; // 替换为你的 GitHub 仓库名
            const githubApiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${fileName}`;

            // 调用 GitHub API 上传文件
            const githubResponse = await fetch(githubApiUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${env.GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'cloudflare-herochat-app'
                },
                body: JSON.stringify({
                    message: `Add image: ${fileName} by ${nickname}`, // Git commit 消息，包含昵称
                    content: base64Content, // Base64 编码的图片内容
                    branch: 'main' // 假设你的主分支是 main
                })
            });

            const githubResult = await githubResponse.json(); // 解析 GitHub API 响应

            if (githubResponse.ok) {
                // 如果上传成功，构建图片的公开访问 URL
                // Cloudflare Pages 会将 GitHub 仓库的内容作为静态资产提供
                // 动态获取当前 Pages 部署的域名，更健壮
                const pagesDomain = request.url.split('/')[2];
                imageUrl = `https://${pagesDomain}/${fileName}`; // 假设 fileName 已经包含了 uploads/ 路径
                console.log(`图片已上传到 GitHub。公共 URL: ${imageUrl}`); // 更改为中文提示
            } else {
                console.error('GitHub API 图片上传失败:', githubResult); // 更改为中文提示
                // 抛出错误以触发外部 catch 块
                throw new Error(`图片上传到 GitHub 失败: ${githubResult.message || '未知错误'}`); // 更改为中文提示
            }
        }

        // --- 保存留言到 KV 存储 ---
        // 确保 'DB' KV 命名空间已经在 Cloudflare Pages 项目中绑定
        const id = crypto.randomUUID(); // 生成唯一 ID
        const timestamp = new Date().toISOString(); // 获取 ISO 格式 UTC 时间戳

        const messageData = { nickname, message, imageUrl, timestamp, isPublic, id };
        await env.DB.put(id, JSON.stringify(messageData)); // 将数据 JSON 序列化并存储到 KV

        console.log(`留言 ${id} 已保存到 KV。`); // 更改为中文提示

        // --- 新增功能：发送消息到 Discord Webhook ---
        // 无论公开还是私有都会发送，并在 Discord 消息中注明类型
        if (env.DISCORD_WEBHOOK_URL) { // 使用 env.DISCORD_WEBHOOK_URL
            await sendToDiscordWebhook(nickname, message, imageUrl, isPublic, env.DISCORD_WEBHOOK_URL);
        } else {
            console.warn('DISCORD_WEBHOOK_URL 环境变量未设置，跳过发送到 Discord。'); // 更改为中文提示
        }

        // 返回成功响应
        return new Response(JSON.stringify({ success: true, messageId: id }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('处理 /api/submit 时发生错误:', error); // 更改为中文提示
        // 返回一个通用的错误响应给客户端，不暴露内部错误细节
        return new Response(JSON.stringify({ success: false, error: '服务器内部错误或图片上传失败。' }), { // 更改为中文提示
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});

// --- 路由 GET /api/messages (获取留言列表) ---
// 从 KV 存储中检索所有留言
router.get('/api/messages', async (request, env) => {
    try {
        const list = await env.DB.list(); // 获取所有 KV 键的列表
        const messages = [];

        // 遍历所有键，获取对应的值
        for (const key of list.keys) {
            const value = await env.DB.get(key.name);
            if (value) {
                messages.push(JSON.parse(value)); // 解析 JSON 字符串并添加到数组
            }
        }

        // 根据时间戳降序排序，最新的留言在前
        messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        console.log(`从 KV 检索到 ${messages.length} 条留言。`); // 更改为中文提示

        // 返回留言列表
        return new Response(JSON.stringify({ messages: messages }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('处理 /api/messages 时发生错误:', error); // 更改为中文提示
        // 返回通用的错误响应
        return new Response(JSON.stringify({ success: false, error: '无法检索留言。' }), { // 更改为中文提示
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});

// --- Worker 入口点 ---
export default {
    async fetch(request, env, ctx) {
        console.log('--- Worker 已接收请求 ---'); // 更改为中文提示
        console.log('请求 URL:', request.url); // 更改为中文提示
        console.log('请求方法:', request.method); // 更改为中文提示

        let response;

        try {
            // 尝试使用 itty-router 处理请求。
            // 如果没有匹配的路由，itty-router 默认返回 undefined。
            response = await router.handle(request, env, ctx);
            console.log('路由自定义处理完成。原始响应:', response); // 更改为中文提示

        } catch (routerError) {
            console.error('严重错误：在 router.handle() 期间捕获到异常:', routerError); // 更改为中文提示
            console.error('路由处理错误堆栈:', routerError.stack); // 更改为中文提示
            return new Response(`路由处理请求时出错: ${routerError.message}`, { // 更改为中文提示
                status: 500,
                headers: { 'Content-Type': 'text/plain' },
            });
        }

        // 如果 itty-router 成功处理了请求 (返回了一个 Response 对象)，则直接返回它。
        if (response && response instanceof Response) {
            console.log('路由成功匹配并返回响应。状态:', response.status); // 更改为中文提示
            return response;
        }

        // 如果 itty-router 没有匹配到任何路由 (即 response 是 undefined)，
        // 则尝试从 Cloudflare Pages 的静态资产中查找文件。
        console.log('路由未匹配。尝试提供静态资产...'); // 更改为中文提示
        try {
            // 使用 env.ASSETS.fetch() 来获取部署在 Pages 上的静态文件。
            // env.ASSETS 是 Cloudflare Pages Functions 自动提供的绑定。
            const assetResponse = await env.ASSETS.fetch(request);
            console.log('env.ASSETS.fetch 原始结果:', assetResponse); // 更改为中文提示

            // 严格的安全检查：确保 assetResponse 是一个有效的 Response 对象
            if (assetResponse && assetResponse instanceof Response) {
                console.log('env.ASSETS.fetch 完成。资产响应状态:', assetResponse.status); // 更改为中文提示
                // 直接返回资产响应，无论其状态码是 200 还是 404 (如果静态文件不存在的话)
                return assetResponse;
            } else {
                // 如果 assetResponse 不是一个有效的 Response 对象
                console.error('严重错误：env.ASSETS.fetch 未返回有效的 Response 对象。类型:', typeof assetResponse, '值:', assetResponse); // 更改为中文提示
                return new Response(`检索静态资产时出错: 意外的 fetch 结果。值: ${assetResponse}`, { // 更改为中文提示
                    status: 500,
                    headers: { 'Content-Type': 'text/plain' },
                });
            }
        } catch (assetError) {
            // 捕获在 env.ASSETS.fetch 过程中可能发生的任何错误
            console.error('严重错误：在 env.ASSETS.fetch 期间捕获到异常:', assetError); // 更改为中文提示
            console.error('资产获取错误堆栈:', assetError.stack); // 更改为中文提示
            return new Response(`提供静态资产时出错。请检查 Worker 日志。详情: ${assetError.message}`, { // 更改为中文提示
                status: 500,
                headers: { 'Content-Type': 'text/plain' },
            });
        }
    },
};

/**
 * 辅助函数：将留言发送到 Discord Webhook
 * @param {string} nickname - 留言者昵称
 * @param {string} message - 留言内容
 * @param {string|null} imageUrl - 图片 URL，如果有的话
 * @param {boolean} isPublic - 留言是否公开
 * @param {string} webhookUrl - Discord Webhook URL
 */
async function sendToDiscordWebhook(nickname, message, imageUrl = null, isPublic, webhookUrl) {
    const payload = {
        username: '留言板通知',
        // 可以自定义头像，例如：
        // avatar_url: 'https://example.com/your-bot-avatar.png',
        content: `一条新留言来了！${isPublic ? '(公开)' : '(私有)'}`, // 在内容中指示是否为私有
        embeds: [
            {
                title: '新留言',
                description: message,
                color: isPublic ? 5814783 : 15844367, // 公开留言蓝色 (5814783)，私有留言橙色 (15844367)
                fields: [
                    {
                        name: '昵称',
                        value: nickname,
                        inline: true
                    },
                    {
                        name: '类型', // 指示留言类型
                        value: isPublic ? '公开' : '私有',
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString(),
            }
        ]
    };

    if (imageUrl) {
        payload.embeds[0].image = { url: imageUrl };
    }

    try {
        const response = await fetch(webhookUrl, { // 使用传入的 webhookUrl
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log('消息成功发送到 Discord Webhook'); // 更改为中文提示
        } else {
            const errorText = await response.text();
            console.error('发送到 Discord Webhook 失败:', response.status, errorText); // 更改为中文提示
            // 这里不抛出错误，以免影响留言的保存
        }
    } catch (error) {
        console.error('发送 Discord Webhook 时发生网络错误:', error); // 更改为中文提示
    }
}
