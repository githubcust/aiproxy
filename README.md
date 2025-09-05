# AI API 代理服务 - Cloudflare Pages

支持多个 AI 服务商的代理服务，包含实时健康监控功能。

## 主要功能

- 支持 OpenAI、Claude、Gemini、Groq、xAI 等 28+ 个 AI 服务
- 自动处理 CORS 跨域问题
- 完整的错误处理和日志记录
- 实时健康检查和状态监控
- 可视化监控面板

## 部署方法

### 使用 Wrangler CLI
```bash
npm install
wrangler auth login  
npm run deploy
```

### 使用 Cloudflare Dashboard
连接 Git 仓库到 Cloudflare Pages，设置构建输出目录为 `.`

## 使用方法

基本格式：`https://your-domain.pages.dev/api/{service}/{path}`

示例：
```bash
# OpenAI
POST https://your-domain.pages.dev/api/openai/v1/chat/completions

# Claude
POST https://your-domain.pages.dev/api/claude/v1/messages

# 健康检查
GET https://your-domain.pages.dev/health
```

## 监控功能

- 访问 `/health` 获取 JSON 格式的服务状态
- 访问 `/status.html` 查看可视化监控面板
- 支持自动刷新和强制检查
- 显示响应时间和服务可用性统计

## 项目结构

```
├── functions/
│   ├── api/[[route]].ts    # API 代理逻辑
│   └── health.ts          # 健康检查 API
├── index.html             # 主页
├── status.html            # 监控面板
├── _routes.json           # 路由配置
├── package.json           # 项目配置
├── tsconfig.json          # TypeScript 配置
└── wrangler.toml          # Wrangler 配置
