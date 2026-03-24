# Token Usage Hub

一个统一看板网站：把你在多个 AI 平台的 API token / 免费额度使用情况集中到一个页面查看。

## 本地运行

1. 在项目目录启动：

```bash
node server.js
```

2. 打开 `http://localhost:3000`。
3. 页面右上角支持：
- 主题切换：`清新白天 / 黑夜骑士`
- 语言切换：`中文 / English`

## 平台配置

编辑 `providers.config.json`。

### 1) external-link（点击跳转）

适合没有公开用量 API 的平台。

```json
{
  "id": "openrouter",
  "name": "OpenRouter",
  "mode": "external-link",
  "enabled": true,
  "portalUrl": "https://openrouter.ai/settings/credits",
  "linkLabel": "Open usage page",
  "message": "Click to open the provider usage dashboard."
}
```

### 2) http-json（真实接口拉取）

```json
{
  "id": "my-provider",
  "name": "My Provider",
  "mode": "http-json",
  "enabled": true,
  "timeoutMs": 15000,
  "request": {
    "url": "https://api.example.com/v1/usage",
    "method": "GET",
    "headers": {
      "Authorization": "Bearer ${MY_PROVIDER_API_KEY}"
    }
  },
  "mapping": {
    "usedTokensPath": "data.used_tokens",
    "limitTokensPath": "data.limit_tokens"
  }
}
```

### 3) mock（测试）

```json
{
  "id": "demo",
  "name": "Demo Provider",
  "mode": "mock",
  "enabled": true,
  "mock": {
    "usedTokens": 120000,
    "limitTokens": 1000000
  }
}
```

## 环境变量

1. 复制 `.env.example` 为 `.env`
2. 在 `.env` 填写 key
3. 在配置里通过 `${VAR_NAME}` 引用

## 免费部署（Netlify）

项目已支持 Netlify，包含：
- `netlify.toml`
- `netlify/functions/usage.js`
- `netlify/functions/providers.js`

### 部署步骤

1. 把项目推送到 GitHub。
2. 登录 Netlify，点击 `Add new site` -> `Import an existing project`。
3. 选择这个仓库，Build 配置会自动读取 `netlify.toml`：
- Publish directory: `public`
- Functions directory: `netlify/functions`
4. 点击 Deploy。
5. 部署完成后访问 Netlify 分配的域名。

### 持续更新

后续你改网页只需要：

```bash
git add .
git commit -m "update ui"
git push
```

Netlify 会自动重新部署。

### 如果你用了 http-json 模式

去 Netlify 后台 `Site configuration -> Environment variables` 添加 API Key（比如 `OPENROUTER_API_KEY`）。

## 备用：Render

你也可以继续用 Render，项目已包含 `render.yaml`。

## 安全建议

- 不要把 `.env` 提交到公开仓库。
- `providers.config.json` 里不要直接写明文密钥。
- 建议只保留必要平台和必要字段。
