# Aolined / Personal Scenes

一个使用原生 HTML、CSS 和 JavaScript 构建的场景式个人主页，包含九个连续场景、AI 实时讨论榜、影像画廊、键盘操作和可选环境声。

## 本地运行

需要 Node.js 20 或更新版本，无需安装运行时依赖。

```powershell
npm start
```

打开 `http://127.0.0.1:4173`。服务器读取托管平台提供的 `PORT`，默认监听 `0.0.0.0:4173`。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm start` | 启动静态站点和 AI 热榜 API |
| `npm run check` | 检查服务器与浏览器脚本语法 |
| `npm test` | 运行静态、单元、集成和发布契约测试 |
| `npm audit --omit=dev` | 检查依赖安全公告 |

## Render 部署

仓库包含 `render.yaml`。推送到 GitHub 后，在 Render 创建 Blueprint 并选择此仓库即可。Render 会使用 `npm start` 启动服务，并通过 `GET /healthz` 检查实例状态。

完整的环境变量、限流边界、验证和回滚说明见 [部署文档](docs/deployment.md)。

## AI 热榜

`GET /api/hot-search` 聚合 Hacker News 最近一周的公开 AI 讨论，服务端最多保留 10 条，页面展示前 6 条。结果缓存 2 分钟；上游不可用时返回最近一次成功结果。

手动刷新使用 `GET /api/hot-search?refresh=1`，默认每个客户端地址每分钟最多 5 次。限流只影响强制刷新，不影响普通缓存读取。

## 内容维护

- 场景文字和画廊资料：`src/content.js`
- 页面结构、远程图片和联系链接：`index.html`
- 页面交互：`src/app.js`
- 本地服务器和 API：`scripts/server.mjs`

Unsplash 素材只作为场景影像，不代表 Aolined 的个人照片。作品场景只记录当前站点，不包含无法从仓库确认的其他项目经历。

## 发布到 GitHub

本地仓库使用 `main` 分支。创建空的 GitHub 仓库后添加远程地址并推送：

```powershell
git remote add origin https://github.com/OWNER/REPOSITORY.git
git push -u origin main
```

`.gitignore` 已排除环境文件、密钥、本地工具目录、日志和 `.tmp-*.png` 验证截图。
