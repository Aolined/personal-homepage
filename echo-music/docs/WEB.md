# Echo Music Web

## 当前定位

Echo Music Web 与 Windows 客户端共用 `public/index.html`、音乐 API 和 Three.js 视觉核心。Web 运行模式会关闭桌面歌词、壁纸、全局快捷键、原生文件对话框和窗口控制。

默认服务是单用户实例：网易云音乐与 QQ 音乐 Cookie 保存在服务进程对应的本地文件中，同一实例内的所有访问者会共享该登录状态。公网部署必须显式启用公开访客模式。

## 本地运行

```bash
npm install
npm run web
```

默认地址：`http://127.0.0.1:4175`

- `/`：Echo Music 官网首页
- `/app`：完整网页版播放器

Windows Electron 客户端仍直接加载播放器界面，不经过官网首页。

可通过环境变量修改监听地址和端口：

```powershell
$env:HOST = '127.0.0.1'
$env:PORT = '8080'
npm run web
```

## 公开访客模式

```powershell
$env:ECHO_RUNTIME = 'web'
$env:PUBLIC_GUEST_MODE = 'true'
$env:TRUST_PROXY = 'true'
$env:HOST = '0.0.0.0'
npm run web
```

公开访客模式不会读取或写入网易云、QQ 音乐 Cookie，并禁用登录、个人歌单、红心、收藏、更新补丁、缓存写入和汽水导入接口。搜索、公开详情、歌词、受限媒体代理、官网、网页版和 Windows 安装包下载保持可用。API 按客户端限流，音频代理设置并发上限。

健康检查：`GET /healthz`。

## 部署边界

不要把默认单用户进程直接监听到公网。需要保留登录能力的远程访问至少满足以下条件：

1. 使用 HTTPS 反向代理。
2. 在反向代理层增加访问认证。
3. 每个互不信任的用户使用独立进程、独立 `COOKIE_FILE` 和独立 `QQ_COOKIE_FILE`。
4. 限制请求速率、请求体大小和并发音频代理数量。
5. 不提交 `.cookie`、`.qq-cookie`、`.env` 或其他登录数据。

示例仅适用于受信任的单用户内网实例：

```powershell
$env:HOST = '0.0.0.0'
$env:PORT = '4175'
$env:COOKIE_FILE = 'D:\EchoMusicData\netease.cookie'
$env:QQ_COOKIE_FILE = 'D:\EchoMusicData\qq.cookie'
npm run web
```

需要多人登录的公网版本仍需独立账号/session 隔离、CSRF 防护、认证授权、限流和审计日志，不能通过关闭 `PUBLIC_GUEST_MODE` 直接获得。

## 已知依赖风险

`NeteaseCloudMusicApi 4.32.0` 的 `music-metadata` 依赖存在 ASF 元数据解析拒绝服务告警。该解析仅用于上游的本地音频上传能力，Echo Music 没有暴露对应上传路由，公开访客模式也禁止所有写入接口，因此当前公网路径不可达。强制自动修复会将核心 API 降级到不兼容版本；升级计划需要在上游提供兼容修复后单独验证。
