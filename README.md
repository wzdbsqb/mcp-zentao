# `@wzdbsqb/mcp-zentao`

禅道 MCP 服务，支持以下 4 个核心能力：

- 获取我的任务列表
- 获取我的 Bug 列表
- 完成任务
- 解决 Bug

默认支持 `stdio`，同时支持 `sse`。

## 安装

```bash
npm install -g @wzdbsqb/mcp-zentao
```

或由 MCP 客户端直接通过 `npx` 启动：

```bash
npx -y @wzdbsqb/mcp-zentao
```

## MCP 配置

### `stdio`

适合 VS Code Copilot、Codex、本地 MCP 客户端：

```json
{
  "servers": {
    "zentao": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@wzdbsqb/mcp-zentao"],
      "env": {
        "ZENTAO_URL": "http://your-zentao-url",
        "ZENTAO_USERNAME": "your-username",
        "ZENTAO_PASSWORD": "your-password",
        "ZENTAO_API_VERSION": "v1"
      }
    }
  }
}
```

### `sse`

适合 Docker 部署后通过 URL 连接：

```json
{
  "servers": {
    "zentao": {
      "type": "sse",
      "url": "http://localhost:3000/sse"
    }
  }
}
```

## 环境变量

- `ZENTAO_URL`
- `ZENTAO_USERNAME`
- `ZENTAO_PASSWORD`
- `ZENTAO_API_VERSION`，默认 `v1`
- `MCP_TRANSPORT`，可选 `stdio` 或 `sse`
- `MCP_SERVER_PORT`，`sse` 模式监听端口，默认 `3000`
- `ZENTAO_DEBUG`，设为 `1` 时输出调试日志

## Docker

### `docker compose`

1. 创建 `.env`

```env
ZENTAO_URL=http://your-zentao-url
ZENTAO_USERNAME=your-username
ZENTAO_PASSWORD=your-password
ZENTAO_API_VERSION=v1
```

2. 启动

```bash
docker compose up --build -d
```

3. 连接地址

```text
http://localhost:3000/sse
```

## 本地开发

```bash
git clone https://github.com/lemon/mcp-zentao.git
cd mcp-zentao
npm install
npm test
npm run build
```

## 发布

```bash
npm login
npm publish --access public
```

## 说明

- `stdio` 模式默认启动，无需额外参数
- `sse` 模式需设置 `MCP_TRANSPORT=sse`
- 配置优先读取环境变量，其次读取用户目录下 `.zentao/config.json`

## License

MIT
