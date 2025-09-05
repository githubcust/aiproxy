# AI API 代理服务 - Cloudflare Pages

支持多个 AI 服务商的代理服务，包含实时健康监控功能。

## 主要功能

- 支持 26个主流 AI 服务（OpenAI、Claude、Gemini、Groq、xAI、Cohere、Light2API 等）
- 增加deno转发，替换[[route]].ts及health.ts中的deno网址为自己部署的
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

基本格式：`https://you-endpoint/api/{service}/{path}`

示例：
```bash
# OpenAI
POST https://you-endpoint/api/openai/v1/chat/completions

# Claude
POST https://you-endpoint/api/claude/v1/messages

# Gemini
POST https://you-endpoint/api/gemini/v1beta/models/gemini-pro:generateContent

# Light2API
POST https://you-endpoint/api/light2api/v1/chat/completions

# 健康检查
GET https://you-endpoint/health

# 状态监控
GET https://you-endpoint/status.html
```

## 支持的服务列表

| 服务商 | 别名 | 代理地址格式 |
|--------|------|-------------|
| OpenAI | `openai` | `https://you-endpoint/api/openai/v1/...` |
| Claude (Anthropic) | `claude` | `https://you-endpoint/api/claude/v1/...` |
| Gemini (Google) | `gemini` | `https://you-endpoint/api/gemini/v1beta/...` |
| Gemini NoThink | `gemininothink` | `https://you-endpoint/api/gemininothink/v1beta/...` |
| Groq | `groq` | `https://you-endpoint/api/groq/openai/v1/...` |
| xAI | `xai` | `https://you-endpoint/api/xai/v1/...` |
| Cohere | `cohere` | `https://you-endpoint/api/cohere/v1/...` |
| HuggingFace | `huggingface` | `https://you-endpoint/api/huggingface/...` |
| Together AI | `together` | `https://you-endpoint/api/together/v1/...` |
| Novita AI | `novita` | `https://you-endpoint/api/novita/...` |
| Portkey | `portkey` | `https://you-endpoint/api/portkey/...` |
| Fireworks AI | `fireworks` | `https://you-endpoint/api/fireworks/...` |
| Targon | `targon` | `https://you-endpoint/api/targon/...` |
| OpenRouter | `openrouter` | `https://you-endpoint/api/openrouter/api/v1/...` |
| SiliconFlow | `siliconflow` | `https://you-endpoint/api/siliconflow/v1/...` |
| ModelScope | `modelscope` | `https://you-endpoint/api/modelscope/...` |
| GMI Serving | `gmi` | `https://you-endpoint/api/gmi/...` |
| Azure AI Inference | `azureinference` | `https://you-endpoint/api/azureinference/...` |
| GitHub AI | `githubai` | `https://you-endpoint/api/githubai/inference/...` |
| Meta AI | `meta` | `https://you-endpoint/api/meta/...` |
| DMX API (COM) | `dmxcom` | `https://you-endpoint/api/dmxcom/...` |
| DMX API (CN) | `dmxcn` | `https://you-endpoint/api/dmxcn/...` |
| Discord API | `discord` | `https://you-endpoint/api/discord/...` |
| Telegram Bot API | `telegram` | `https://you-endpoint/api/telegram/...` |
| HTTPBin (测试) | `httpbin` | `https://you-endpoint/api/httpbin/...` |
| Light2API | `light2api` | `https://you-endpoint/api/light2api/...` |

**总计：26个 AI 服务 + 3个工具/测试服务 = 29个服务**

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
```

## 在线访问

- 主页：https://you-endpoint/
- 状态监控：https://you-endpoint/status.html
- 健康检查 API：https://you-endpoint/health

## 使用示例

### OpenAI GPT API
```bash
curl -X POST https://you-endpoint/api/openai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-openai-api-key" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### Claude API
```bash
curl -X POST https://you-endpoint/api/claude/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-claude-api-key" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-3-sonnet-20240229",
    "max_tokens": 1000,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### Gemini API
```bash
curl -X POST "https://you-endpoint/api/gemini/v1beta/models/gemini-pro:generateContent?key=your-gemini-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{"text": "Hello!"}]
    }]
  }'
```

## 部署状态

已成功部署到：https://you-endpoint/

该服务现在可以直接使用，支持所有配置的 AI 服务商 API 代理功能。
