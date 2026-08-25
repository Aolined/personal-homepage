# 个人网站项目任务总结

> 生成时间：2026-08-25
> 来源：`个人网站` 项目下 Codex 归档的任务列表、仓库 `tasks/plan.md` / `tasks/todo.md`、`docs/spec.md`。

---

## 1. 项目概况

一个基于原生 HTML / CSS / JavaScript 的场景式个人主页，包含 **9 个连续场景**（首页、关于、作品、趋势、兴趣、联系），内置 AI 实时讨论榜（`/api/hot-search`）、影像画廊、键盘 / 触控操作与可选环境声。

- 仓库：`D:\CodexProjects\homepage`
- 运行：`npm start` → `http://127.0.0.1:4173`
- 框架：原生 HTML / CSS / JS，Node.js ≥ 20，无运行时依赖
- 部署：Render Blueprint（`render.yaml`），健康检查 `GET /healthz`
- 当前分支：`main`（已领先 `origin/main` 1 个提交，未推送）

---

## 2. 任务列表（Codex 归档）

`个人网站` 项目下历史归档的任务共 8 条：

| # | 任务 | 对应方向 | 说明 |
| - | - | - | - |
| 1 | 优化个人主页深海主视觉 | 首页视觉 | 深海 canvas 主视觉（`deep-field-canvas`） |
| 2 | 个人主页网站开发 | 主项目 | homepage 本体 |
| 3 | 继续当前任务 | 当前会话 | 归档占位条目 |
| 4 | 继续添加作品星图 | 作品星图 | indie-explorer，主页作品入口 |
| 5 | 继续添加作品星图 | 作品星图 | **重复条目** |
| 6 | 创建格式转换网站 | 格式工坊 | format-workshop，主页作品入口 |
| 7 | 音乐 | 音乐 | Echo Music，主页作品入口 |
| 8 | 继续优化网站 | 持续优化 | 优化、发布、回滚 |

> 说明：该列表由 Codex 将各会话开始时的任务名自动归档，存在重复与占位项；真正对应磁盘的工程清单见 `tasks/plan.md` 与 `tasks/todo.md`。

---

## 3. 作品入口（主页「项目轨道」）

主页作品场景「项目轨道」当前挂载 5 个已完成项目：

| 序号 | 项目 | 标题 | 类型 |
| - | - | - | - |
| 01 | Personal Scenes | `Aolined Personal Scenes` | 本主页 |
| 03 | 格式工坊 | `格式工坊` | 在线工具 |
| 04 | 作品星图 | `作品星图` | 独立开发者目录 |
| 04 | 音乐 | `Echo Music` | 音乐站 |
| 05 | Snake Arcade | `Snake Arcade` | 浏览器小游戏 |

---

## 4. 已完成（tasks/todo.md，全勾）

- [x] 加真实作品场景并更新九个场景标签
- [x] 浅色场景固定标题控件改为深色文字
- [x] 手机导航：上一 / 当前 / 下一 + 完整目录
- [x] 远程场景背景懒加载，画廊 / 背景失败态
- [x] 缩小兴趣场景标题字号与留白
- [x] 可见 AI 热榜限 6 条（不擅动服务端 10 条契约）
- [x] 新增 UI 契约测试并保留 AI / 静态路径安全测试
- [x] 320 / 768 / 1024 / 1440 四档真实 Chrome 验证
- [x] 启动持续预览服务器 `http://127.0.0.1:4173`

### 最近提交

- `9499bf5` feat: add Snake Arcade as fifth works project
- `e3958e4` feat: add organic live scene signals
- `c995cd8` chore: restart homepage deployment

---

## 5. 待办 / 后续工作线

| 工作线 | 现状 | 下一步 |
| - | - | - |
| 作品星图（indie-explorer） | 主页已挂作品入口 | 继续添加作品星图内容 / 数据 |
| 格式工坊（format-workshop） | 已部署，主页入口 | 功能迭代与维护 |
| 音乐（Echo Music） | 已部署，带 availability 检测 | 曲库 / 播放器迭代 |
| 主页（homepage） | `main` 已提交 1 个新提交 | push 到 `origin/main` |
| 深海主视觉 | 已有 `deep-field-canvas` | 视觉细节优化 |

---

## 6. 质量与风险控制

- 作品真实性：作品场景只记录本仓库可验证的内容，不编造无法确认的项目经历。
- 媒体身份：Unsplash 素材仅作场景影像，不作为 Aolined 个人照片。
- AI 回归：只改浏览器展示上限，保留服务端归一化、10 条上限、缓存、刷新与链接白名单。
- 移动端密度：用专用底部导航，而非压缩九个目录链接。
- 远程失败：失败后移除 busy 状态并回退到本地视觉兜底。

---

## 7. 常用命令

| 命令 | 用途 |
| - | - |
| `npm start` | 启动静态站点 + AI 热榜 API |
| `npm run check` | 检查服务器与浏览器脚本语法 |
| `npm test` | 运行静态 / 单元 / 集成 / 发布契约测试（当前 38/38 通过） |
| `npm audit --omit=dev` | 检查依赖安全公告 |
