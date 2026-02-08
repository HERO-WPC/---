# 🌟 Cloudflare Guestbook

一个基于 Cloudflare Workers 的留言板应用，支持任意格式文件上传。

## ✨ 功能特性

- 📝 发布文字留言
- 📎 支持任意格式文件 (图片、视频、文档等)
- 🔒 单文件最大 100MB
- 📚 最多 5 个附件
- ☁️ 文件存储在 Backblaze B2 (免费 10GB)

## ☁️ 部署步骤

### 1. 推送代码到 GitHub

```bash
git init
git add .
git commit -m "Initial commit"
# 在 GitHub 创建仓库，然后:
git remote add origin https://github.com/你的用户名/guestbook.git
git push -u origin master
```

### 2. Cloudflare 配置

#### 创建 KV 命名空间
```bash
cd worker
npm install
npx wrangler kv:namespace create "MESSAGES"
```
将输出的 ID 填入 `worker/wrangler.toml`

#### 绑定 KV 到 Workers
- 访问 https://dash.cloudflare.com
- Workers & Pages → 你的 Worker → Settings
- Variables → Add → KV namespace binding
- Variable name: `MESSAGES`
- 选择你创建的 KV 命名空间

### 3. Backblaze B2 配置

#### 创建 Bucket
- 访问 https://www.backblaze.com/b2/cloud-storage.html
- 创建 Bucket，命名为 `my-upload-files`
- 设置为 **Private** (私有权限)

#### 配置 CORS
在 Backblaze B2 Dashboard 中：
1. 进入 Bucket → **CORS Rules**
2. 点击 **Add CORS Rule**
3. 填写以下内容：

**Allowed Origins (CorsRule):**
```
https://*.workers.dev
http://localhost:*
```

**Allowed Headers:**
```
*
```

**Allowed Methods:**
```
POST
GET
```

**Expose Headers:**
```
Authorization
Content-Length
Content-Type
X-Bz-File-Id
X-Bz-File-Name
```

**Max Age Seconds:**
```
3600
```

#### 生成 API 授权
```bash
# 编码格式: keyID:applicationKey
echo -n "你的keyID:你的applicationKey" | base64

# 示例:
# echo -n "0048c6275d741630000000001:K004by9Dasuh6qtIcNYK699wPt/sq+w" | base64
# 输出: MDA0OGM2Mjc1ZDc0MTYzMDAwMDAwMDAwMDE6SzAwNGJ5OURhc3VoNnF0SWNOWEs2OTl3UHQvc3Erdw==
```

将 Base64 编码后的字符串填入 `worker/wrangler.toml` 的 `B2_AUTH` 变量：

```toml
[vars]
B2_AUTH = "MDA0OGM2Mjc1ZDc0MTYzMDAwMDAwMDAwMDE6SzAwNGJ5OURhc3VoNnF0SWNOWEs2OTl3UHQvc3Erdw=="
```

### 4. 部署 Workers

在 Cloudflare Dashboard 中：
1. 访问 https://dash.cloudflare.com
2. Workers & Pages → Create → Deploy with Git
3. 选择你的 GitHub 仓库
4. 配置：
   - Build command: `cd worker && npm install && npx wrangler deploy`
   - Build output: 不需要
5. 点击 **Deploy！**

## 📁 项目结构

```
guestbook/
├── worker/              # Cloudflare Workers
│   ├── src/index.ts     # API + 前端页面
│   ├── src/frontend.ts   # 前端 HTML
│   ├── package.json
│   ├── tsconfig.json
│   └── wrangler.toml
└── README.md
```

## 🔧 wrangler.toml 配置

```toml
name = "guestbook"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "MESSAGES"
id = "YOUR_KV_ID"

[vars]
# Backblaze B2 授权 (keyID:applicationKey 的 Base64 编码)
B2_AUTH = "base64编码后的keyID:applicationKey"
```

## 💰 免费额度

| 服务 | 额度 |
|------|------|
| Workers | 每天 10 万次请求 |
| KV | 1000 次读/写操作/月 |
| Backblaze B2 | 10GB 存储 + 1GB/天下载 |

## 📝 许可证

MIT
