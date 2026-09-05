# Cloudflare Pages 部署（aolined.icu）

把 `personal-homepage` 同时部署到 Cloudflare Pages，并绑定自定义域名
`aolined.icu`。这是「全球/品牌入口」：海外直达、大陆可用（大陆主入口见
`docs/edgeone-pages.md`）。全部免费，无需备案。

## 目录里新增了什么

| 路径 | 作用 |
| --- | --- |
| `functions/api/hot-search.js` | `GET /api/hot-search` 边缘函数（微博/AI/GitHub 热榜 + 120s 边缘缓存 + 手动刷新限流） |
| `functions/api/music-status.js` | `GET /api/music-status`，返回 Echo Music 公网版本信息（不再依赖海外实例在线状态） |
| `functions/lib/hot-search-lib.mjs` | 热榜逻辑的 Edge 版（fetch 实现），与 `scripts/*.mjs` 行为一致 |
| `functions/lib/rate-limit.mjs` | 固定窗口限流器（`server-policy.mjs` 的 Edge 移植） |
| `scripts/build-static.mjs` | 构建 `dist/`（复制页面引用到的静态文件 + 生成 `_headers` 安全头） |
| `docs/cloudflare-pages.md` | 本文档 |
| `docs/edgeone-pages.md` | 大陆加速路线图 |

前端不需要改动：`fetch('/api/hot-search')`、`fetch('/api/music-status')`
均为同源相对路径，在 Pages 上自动命中上面的函数。

## 上线步骤（一次性）

1. 登录 [dash.cloudflare.com](https://dash.cloudflare.com)，进入 **Workers & Pages → Create → Pages → Connect to Git**
2. 授权 GitHub，选择仓库 `Aolined/personal-homepage`
3. 项目设置：
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - 其余保持默认，点 **Save and Deploy**
4. 等第一次部署完成，访问 `<project>.pages.dev` 验证：
   - 首页正常打开（背景图、场景动画）
   - `https://<project>.pages.dev/api/music-status` 返回 `{ "available": true, "deployment": "public", ... }`
   - `https://<project>.pages.dev/api/hot-search?source=weibo` 返回 `{ "data": [...], "status": "live" }`

## 绑定 aolined.icu

域名已经托管在 Cloudflare（NS 是 `anton/brit.ns.cloudflare.com`），邮箱路由
（MX + SPF）已生效，所以只差站点解析：

1. Pages 项目 → **Custom domains → Set up a custom domain** → 输入 `aolined.icu`，
   按提示同时添加 `www.aolined.icu`
2. Cloudflare 会自动加 CNAME 记录，签发免费证书（几分钟内）
3. 验证 `https://aolined.icu` 打开

之后每次 push 到 GitHub 主分支，Pages 自动重新构建部署。

## 已生效的免费邮箱（无需再配置）

MX：`route1/2/3.mx.cloudflare.net`，SPF：`v=spf1 include:_spf.mx.cloudflare.net ~all`
→ 收发规则在 Cloudflare 控制台 **Email → Email Routing** 里管理，
`hello@aolined.icu` 之类可直接转发到你的常用邮箱。

## 手动刷新限流与边缘缓存说明

- 前端每 2 分钟自动拉一次热榜：命中 `caches.default` 的 120 秒边缘缓存，
  大陆和其它地区用户都几乎是秒回（不触达海外上游）
- 手动「刷新」携带 `refresh=1`：绕过边缘缓存直连上游，同一 IP 每分钟最多 5 次
- 限流器是 per-isolate 的内存状态，个人站足够；如果以后要精确的全局限流，
  用 Workers KV/D1 计数器替换 `functions/lib/rate-limit.mjs` 即可（接口不变）

## 可选：大陆访问自动跳到 EdgeOne 主入口

单独建一个 Worker（免费额度），把大陆用户从 `aolined.icu` 302 到 EdgeOne
域名，海外用户留在本站：

```js
export default {
  async fetch(request) {
    const country = request.headers.get('cf-ipcountry');
    const url = new URL(request.url);
    if (country === 'CN' && url.hostname !== 'www.aolined.icu') {
      return Response.redirect('https://<edgeone-domain>', 302);
    }
    return fetch(request); // 或直接返回本站静态资源
  }
}
```

部署后在 Workers 路由里把它挂到 `aolined.icu/*` 即可。
（不配这一步也不影响：aolined.icu 本身在 Cloudflare 上可以正常访问。）

## 回滚

- Render 保持原部署（`render.yaml`），作为海外回退实例继续运行
- 出问题时在 Pages 控制台 **Deployments → Rollback to previous deployment**
  ；或临时把 `aolined.icu` 的 CNAME 改回 Render 域名
- `keep-awake.yml` / `ping-render*.ps1` 在确认 Pages 稳定前先保留

## 大陆加速（下一步）

把同一个仓库接到腾讯云 EdgeOne Pages，配置见 `docs/edgeone-pages.md`。
