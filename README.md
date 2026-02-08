# 🌟 Cloudflare Guestbook

一个基于 Cloudflare Workers 的留言板应用，支持任意格式文件上传。

## ✨ 功能特性

- 📝 发布文字留言
- 📎 支持任意格式文件 (图片、视频、文档等)
- 🔒 单文件最大 100MB
- 📚 最多 5 个附件
- 📎 支持图片、视频等文件上传（配置 GitHub 时最大 25MB，否则最大 1MB）

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

### 3. GitHub 配置（用于文件上传）

#### 创建 GitHub Token
1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token" → "Fine-grained personal access tokens" 或 "Personal access tokens"
3. 对于 "Personal access tokens"，设置适当的权限：
   - 选择 "repo" 权限（完整仓库访问权限）
   - 或者更安全的选项是只选择 "Contents" 权限（仓库内容管理权限）
4. 设置 Token 过期时间，生成并保存 Token

#### 准备 GitHub 仓库
1. 创建一个新的公开或私有仓库（例如：guestbook-files）
2. 确保您有向该仓库推送内容的权限

#### 配置环境变量
在 Cloudflare Workers Dashboard 中配置以下环境变量：
- `GITHUB_TOKEN`: 你的 GitHub Token（需要有仓库写入权限）
- `GITHUB_REPO`: 仓库名称（格式：username/repository，例如：HERO-WPC/guestbook-files）
- `GITHUB_BRANCH`: 分支名称（可选，默认 main）
- `GITHUB_PATH`: 上传路径（可选，默认 uploads/）



### 5. 部署 Workers

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
│   └── wrangler.toml    # Workers 配置文件
├── frontend/            # React 前端（可选）
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── README.md
└── wrangler.json        # 项目配置
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
# GitHub 配置用于文件上传
GITHUB_TOKEN = "your_github_token"
GITHUB_REPO = "username/repository_name"
GITHUB_BRANCH = "main"  # 可选，默认为 main
GITHUB_PATH = "uploads/"  # 可选，默认为 uploads/
```

## 💰 免费额度

| 服务 | 额度 |
|------|------|
| Workers | 每天 10 万次请求 |
| KV | 1000 次读/写操作/月（仅存储文字内容） |
| GitHub | 文件存储在 GitHub 仓库 |

## 📝 许可证

MIT
