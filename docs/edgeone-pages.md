# EdgeOne Pages 部署（大陆主入口）

目标：让大陆用户以最快速度访问同一份 `personal-homepage`。

## 为什么

- EdgeOne Pages 免费版走腾讯 CDN 大陆节点，静态资源与边缘函数均在境内响应
- 用默认域名 `*.edgeone.app` 无需备案；绑定自有域名到国内节点需要 ICP 备案
- CDN 常驻不睡觉，`keep-awake` / ping 脚本可以退役

## 前置条件

1. 注册并实名认证腾讯云账号（免费，需身份证 + 人脸）
2. `aolined.icu` 继续留在 Cloudflare（做品牌/邮箱/海外入口），EdgeOne 用默认
   域名即可，不需要动 DNS

## 上线步骤

1. 打开 EdgeOne Pages 控制台（edgeone.cloud.tencent.com → Pages）
2. **新建项目 → 连接 Git 仓库** → 选择 GitHub 的 `Aolined/personal-homepage`
3. 构建配置：
   - 构建命令：`npm run build`
   - 输出目录：`dist`
4. 部署后把页面上显示的 `*.edgeone.app` 域名设为大陆主入口
5. 验证接口：
   - `https://<project>.edgeone.app/api/music-status`
   - `https://<project>.edgeone.app/api/hot-search?source=weibo`

## Functions 迁移说明

`functions/` 目录按 Cloudflare Pages 约定编写（worker 风格 handler）。
EdgeOne Pages Functions 使用类似语法，但入口命名/导出约定略有差异，
迁移时把 `functions/api/*.js` 按 EdgeOne 官方文档微调（只改外层 handler，
`functions/lib/` 里的 fetch 逻辑与归一化函数可原样复用）。

热榜逻辑是纯 `fetch`，无 Node 依赖，天然兼容边缘运行时。

## 域名备案后（可选升级）

- 在腾讯云完成 `aolined.icu` 的 ICP 备案（需一台国内轻量服务器做接入，约 30 元/月）
- 备案通过后，把 `aolined.icu` / `www.aolined.icu` 解析切到 EdgeOne Pages
  的自定义域名绑定，地址栏保持真域名且走国内节点
- Cloudflare Pages 可继续保留为海外回退

## 提速对照

| 入口 | 大陆速度 | 说明 |
| --- | --- | --- |
| `*.edgeone.app`（EdgeOne） | 快 | 大陆 CDN 节点，静态 + API 都在境内，秒开 |
| `aolined.icu`（Cloudflare） | 中 | 海外节点兜底，大陆可用但略慢 |
| `*.onrender.com`（Render） | 差/常连不上 | 仅保留作回退 |
