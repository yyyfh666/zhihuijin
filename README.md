# 智汇金 · 钱包天气预报

> 大学生预算预测与金融安全教育原型 · 纯前端单页，零构建

一个把「这个月的钱能花到哪天」提前算出来的小应用：输入生活费、固定支出和下次到账日，它会给出**预算天气**、未来 30 天余额曲线、今日计划与风险提醒；再配上一套金融安全知识卡和随机答题，把「记账」变成「预判 + 练习」。

界面是手机优先的，桌面打开会呈现一台带机身的设备；动效、加载动画、粒子反馈全部用原生 CSS/JS 实现，没有任何框架与打包步骤。

## 在线预览

GitHub Pages：`https://<your-account>.github.io/zhihuijin/`

> 在线版默认以**本地模式**运行（数据全部存在浏览器 localStorage）。后端接口需要把来源加进 CORS 白名单才能连通，详见下文。

## 功能

| 模块 | 说明 |
|---|---|
| 预算天气 | 按「可用余额 / 每月生活费」自动切换 晴天 / 多云 / 阵雨 / 暴雨 四档皮肤 |
| 余额曲线 | 未来 30 天预测，可左右滑动，吸附到每个采样点 |
| 今日计划 | 从余额预测、计划事件、安全学习中生成任务，可勾选、可拖拽排序 |
| 记一笔 | 支出 / 计划事件，同城分类，支持幂等提交 |
| 安全雷达 | 98 张金融安全知识卡 + 分类筛选 + 搜索 |
| 随机答题 | 从 100 题题库随机抽 10 题，即时判分与解析 |
| 我的 | 预算概览、演示天气、数据导出/导入/清空、接口设置 |

## 本地运行

```bash
# 任选一个静态服务器，注意用 5173 端口（后端 CORS 白名单限制）
node serve.mjs 5173
# 打开 http://localhost:5173/index.html
```

没有 Node 也可以用任意静态服务器（`python -m http.server 5173`、VS Code Live Server 等）。

## 目录结构

```
index.html      # 界面 + 样式 + 逻辑（单文件，含题库）
motion.html     # 动效实验室（独立页面）
vibe.css        # 视觉与动效层（叠加在 index.html 之上）
vibe.js         # 动效层：开场、粒子、曲线描画、自动换肤、答题、接口设置卡
api.js          # 请求层：CSRF、Bearer、401 一次性刷新重试
api-config.js   # 唯一的 base URL 配置点
assets/         # 雷达图 SVG、得意黑字体
serve.mjs       # 零依赖静态服务器
tools/          # 后端联通自检脚本（probe-backend.mjs）
```

## 后端对接

页面本身是本地优先的，不连后端也能完整跑。要接真实后端，两条路：

1. **页内设置**：我的 → 接口设置 → 填入 `base URL` → 保存并刷新（写入 localStorage，`?api=` 参数也能覆盖）。
2. **改默认值**：编辑 `api-config.js` 的 `DEFAULT` 与 `SCHEMA`（`SCHEMA` 变化会自动作废旧地址）。

请求层已经处理好：`GET /csrf` 取 token（JSON 优先，Cookie 兜底）→ 写请求带 `X-CSRF-Token` → `Authorization: Bearer` → 401 时只刷新并重试一次 → 注册/登录后自动重新取 CSRF（服务端会轮换）。

### 诊断

```bash
node tools/probe-backend.mjs --base https://example.com/api/v1 --origin http://localhost:5173
```

会逐项检查网络、CORS、路由、CSRF 契约、注册与登录流程，最后给出「需要后端改的地方」。

## 技术说明

- 零依赖、零构建：原生 HTML/CSS/JS，classic script，直接双击也能跑（除字体与后端请求）。
- 动效：`@starting-style` + `transition-behavior: allow-discrete`、`@property` 驱动的圆环、`IntersectionObserver` 揭示、canvas 粒子、SVG `stroke-dashoffset` 描画与流光；全部尊重 `prefers-reduced-motion`。
- 桌面档（≥720px）机身自己成为滚动容器，`window.scrollY` 通过 getter 桥接，原页面的吸顶与视差逻辑无需改动。

## 免责声明

虚构演示项目，用于课程实践与设计练习。**不做真实支付、不出票、不承诺收益**，不推荐任何投资或借贷产品。题库与知识卡仅作金融素养教育用途，不构成建议。

## License

[MIT](./LICENSE)

## 备份与迁移

### 页面内导出 / 导入

「我的 → 本地数据 → 导出备份」会打开备份面板，里面是完整的 JSON，提供四种取用方式：

| 方式 | 适用 |
| --- | --- |
| 下载 .json | 桌面浏览器、安卓 Chrome |
| 系统分享 | iOS Safari（存到「文件」App）、安卓分享面板 |
| 复制内容 | 任何浏览器，粘到记事本再存成 `.json` |
| 直接长按文本框 | 兜底，用于内嵌浏览器 |

之所以不用单一 `<a download>`：iOS Safari 与部分内嵌浏览器（微信、部分厂商浏览器）会**静默忽略**未挂载到 DOM 的 `<a download>`，点了没有任何反应——这正是「导不出数据」的原因。现在下载链接会真正挂到 `document` 上，并且始终保留「复制内容」这条不依赖浏览器下载能力的退路。

导入时会先校验文件（非法 JSON / 不是备份文件都会有人话提示），再用确认框显示「支出 N 笔 · 计划 M 条 · 冷静期 K 个」，确认后才覆盖，并同时刷新首页 / 今日 / 安全 / 我的四个屏幕。备份格式：

```json
{ "schemaVersion": 2, "app": "智汇金 · 钱包天气预报",
  "exportedAt": "…", "counts": { "expenses": 3, "tasks": 2 },
  "data": { "schemaVersion": 1, "profile": {…}, "period": {…},
            "expenses": […], "tasks": {…}, "pauses": […], "learning": […] } }
```

导入同时兼容 `schemaVersion` 1 与 2，也兼容直接丢一个裸 `state` 对象。

### 把本地备份灌进后端

后端接口就绪后，用 `tools/import-backup.mjs` 一次性迁移：

```bash
node tools/import-backup.mjs \
  --file zhihuijin-backup-2026-10-31.json \
  --base https://nlxroaosaoyi.sealoshzh.site/api/v1 \
  --email me@example.com --password 'Passw0rd!'
```

- 自动处理 `GET /csrf` → 登录（失败则注册）→ `POST /onboarding`（预算 / 余额 / 到账日 / 消费习惯）→ 逐条 `POST /expenses`（带 `Idempotency-Key: import-<sha1>`，重复跑不会写两份）。
- `/today-plan` 目前后端仍返回 500，所以计划条目导出成 `tasks-<日期>.json`，接口修好后可直接回灌。
- 先看会发生什么：加 `--dry-run`（完全不联网，只打印请求体）。
- 已有 token：改用 `--token <jwt>`；要 CI 用：`--json`。
- 字段做了容错：`amountCents` / `amount`（元）/ `money` 都认，`date` 缺失时用今天；400 的响应体会原样打印，按提示改 `postExpense` 的 body 即可。

退出码：`0` 全成功，`1` 有失败项，`2` 参数或文件有问题。
