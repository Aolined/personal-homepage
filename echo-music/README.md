# Echo Music

Echo Music 是一款 Web 与 Windows 双端沉浸式音乐播放器，以歌词舞台、封面粒子、电影镜头和 3D 歌单为核心体验。

当前版本是基于 [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio) `v1.1.1` 开始的二次开发版本，正在建立独立的品牌、视觉系统和发布链路。目前没有公开安装包，请不要把上游 Mineradio Release 当作 Echo Music 安装包。

## 当前方向

- `Echo Signal Stage` 视觉语言：近黑声场、薄荷绿信号、暖琥珀状态点
- Echo Music 启动字标、应用图标和 Windows 安装器资源
- 恢复可用首页，保留搜索、歌单、天气声场和播放器入口
- 保留原有 Three.js 粒子、歌词、3D 歌单架、桌面歌词和壁纸能力
- 共用同一播放器核心的 Echo Music Web，浏览器模式自动移除桌面专属控制
- 支持粘贴汽水音乐官方分享链接，将歌曲或歌单匹配到现有可播放音源
- 上游自动更新已关闭，避免二改版本被 Mineradio Release 覆盖

## 开发运行

```bash
npm install
npm test
npm run web
npm start
npm run build:win:dir
npm run build:win
```

## Web 版

启动本地 Echo Music Web：

```bash
npm run web
```

打开 `http://127.0.0.1:4175` 进入 Echo Music 官网，点击“打开网页版”或直接访问 `http://127.0.0.1:4175/app` 进入播放器。`npm run preview` 作为兼容命令保留，并指向同一个 Web 服务。

Web 服务默认只监听本机，并启用同源响应、安全头以及音乐媒体代理域名限制。浏览器版支持首页、搜索、播放、歌词、歌单与大部分 Three.js 视觉；桌面歌词、壁纸、全局快捷键、原生文件对话框和窗口控制仅在 Windows 客户端提供。

首页的“汽水导入”支持 `qishui.douyin.com/s/...` 和 `music.douyin.com/qishui/share/...` 官方分享链接。该功能读取公开分享页中的歌曲信息，并在网易云音乐/QQ 音乐中匹配可播放版本，不登录汽水账号，也不代理汽水原始音频。详见 [汽水导入说明](./docs/QISHUI_IMPORT.md)。

当前登录 Cookie 仍是服务进程级的单用户状态，不得把同一实例直接提供给互不信任的多人使用。局域网或服务器部署要求见 [Web 部署说明](./docs/WEB.md)。

## 项目结构

```text
public/index.html          主界面、播放器、歌词与 Three.js 视觉
public/echo-theme.css     Echo Signal Stage 主题覆盖层
public/assets/echo-mark.svg
desktop/main.js           Electron 窗口、桌面歌词、壁纸和系统集成
server.js                 本地音乐 API、天气、代理和更新逻辑
build/                    图标、安装器资源和 NSIS 配置
scripts/                  品牌资产生成与本地预览脚本
tests/                    品牌和配置回归测试
```

## 数据与第三方服务

登录 Cookie、搜索历史、自定义封面、歌词和视觉设置只应保存在本机，不应提交到仓库。网易云音乐、QQ 音乐、汽水音乐公开分享页和天气能力依赖第三方服务，使用时需要遵守对应服务条款和版权规则。

Echo Music 不是网易云音乐、QQ 音乐、汽水音乐、腾讯音乐娱乐集团或抖音的官方客户端。

## 授权与上游

本项目继续遵循仓库中的 GPL-3.0 许可证。分发修改版本时应提供对应源代码、保留许可证和版权声明，并明确标注修改内容。

Mineradio 原始项目、MR Logo、原始视觉表达及相关署名归原作者和贡献者所有。Echo Music 使用独立名称、标志与主题；详细上游声明见 [NOTICE.md](./NOTICE.md)。
