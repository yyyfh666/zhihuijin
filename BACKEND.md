# 后端接入记录（2026-11-02）

## 结论

后端的**知识库这一层已经接进线上页面**，其余接口保持本地。

- commit：`68df9ce`（前一个 `f6d93db` 是第一档修复）
- 线上：https://yyyfh666.github.io/zhihuijin/
- 改动：`index.html` +70 行，不动 `vibe.js`、不动任何写操作

## 实测到的三件文档没写的事

### 1. 匿名会话可以直接用，不用注册

```http
POST /api/v1/auth/anonymous        (先拿 /csrf，带 X-CSRF-Token)
→ 201 {"data":{"accessToken":"eyJ...","expiresIn":900,
        "user":{"displayName":"匿名用户","isAnonymous":true}}}
   Set-Cookie: zhj_refresh=...; HttpOnly
```

文档只写了小程序 `wx.login()` 换 code 那条路，实测那条走不通（`/auth/wechat/login` 带 CSRF 后仍 401）。真正能用的是这条匿名会话，**适合网页"打开即用"的场景**。

### 2. 知识库里有真数据，而且带来源

```
GET /api/v1/knowledge/categories
→ 校园金融安全 32 / 消费与借贷 24 / 基础金融素养 25 / 求助与处置 17  = 98 张
```

单张卡结构（card064 实测原文）：

```json
{
  "id": "card064",
  "title": "游戏外挂/代充骗局：售卖外挂、低价代充，脱离官方平台私下收款，收钱后消失或封号。",
  "scene": "游戏里有人低价“代充”点券，要求微信先付款，你应该",
  "riskSignals": ["..."],
  "correctActions": ["拒绝，只在官方渠道充值"],
  "avoidActions": ["划算，先付款", "付一半试试", "介绍朋友一起买"],
  "sources": [{
    "publisher": "公安部刑事侦查局（公安部网站）",
    "basis": "公安部反诈资料提示游戏充值和点券代充应通过官方渠道，私下付款风险高。",
    "url": "https://www.mps.gov.cn/...",
    "teamReview": "已核验主题；未标注为原题",
    "verifiedAt": "2026-10-24T00:00:00.000Z"
  }],
  "reviewer": "admin",
  "difficulty": "intermediate"
}
```

这就把前端原来那句「来源：学校保卫处公开提醒 · 内容示例」换成了可点开的官方出处 + 审核人。

### 3. CORS 放行的是线上域名，不是本地

| Origin | `Access-Control-Allow-Origin` |
|---|---|
| `https://yyyfh666.github.io` | ✅ 返回该值 |
| `http://127.0.0.1:5173` | ❌ 空 |
| `https://evil.example.com` | ❌ 空 |

`api.js:20-21` 的注释写的是「只信任 127.0.0.1:5173 与 localhost:5173」，**正好反了**，需要更新，否则本地调试会一直踩坑。

## 前端怎么接的

```js
// 首屏渲染完之后才跑，不挡首屏
window.addEventListener("load", () => setTimeout(() => syncKnowledgeFromServer(), 800));

async function syncKnowledgeFromServer() {
  // 1. POST /auth/anonymous（5 秒超时）→ accessToken
  // 2. GET /knowledge/cards?page=1&pageSize=100（6 秒超时）
  // 3. mapRemoteCard() 映射成内部结构，push 进 cards
  // 4. knowledgeCards 重新计算 → renderKnowledgeList()
  // 任何一步失败 → return false，内置 10 张卡照旧
}
```

字段映射：

| 后端 | 前端 |
|---|---|
| `categoryName` | `category`（`基础金融素养→基础素养`、`求助与处置→求助处置`） |
| `riskSignals` | `signals` |
| `correctActions` | `actions` |
| `avoidActions` | `avoid` |
| `sources[0].publisher + basis` | `source` |
| `difficulty` | `level`（basic→基础 / intermediate→进阶 / advanced→挑战） |
| `id` | `kb-<原id>`（避免和内置卡、题库 id 撞） |

顺带把详情页的「现在可以做的 **3** 件事」改成「现在可以做的事」—— 后端有的卡只有 1 条动作，写死 3 数字就不对了。

## 验证

| 项 | 结果 |
|---|---|
| 映射正确性（真实 card064/card011/card025/card076 数据） | 4/4 字段全对，详情页渲染正常 |
| 分类筛选（全部/消费与借贷/校园金融安全） | 14 / 5 / 5，正确 |
| 后端不可用时 | `synced:false`、内置 10 张卡保留、**0 报错 0 异常** |
| 线上加载 | 首屏正常，无白屏 |
| 语法 | `node --check` 通过 |

## 后端需要修的六件事

1. **文档 3.1 与实现不符**：写的微信 code，实际是 `POST /auth/login {email,password}`（假账号返回 `INVALID_CREDENTIALS 邮箱或密码错误`）。
2. **CSRF 文档没写但强制**：不带 `X-CSRF-Token` 直接 `403 CSRF_FAILED`，`2.2` 请求格式里应补上。
3. **文档 17.3 说知识卡公共可读，实测全部 401**：连 `/knowledge/categories` 都要 token。要么改成公共读，要么文档标明必须先匿名登录。
4. **`/health` 也要登录**：监控探活会一直 401。
5. **`api.js` 注释的 CORS 白名单反了**（见上）。
6. **稳定性**：2026-11-02 23:03 之后持续 `SSL connection could not be established`，三个 IP 全部不可达。

## 故意没接的

预算、支出、计划、冷静期这些写操作仍然是本地存储。

原因：现在这套的价值是「打开就能用、断网也能用、演示不会崩」。接了写操作要同时处理登录态过期、离线合并、重复提交、多端冲突，收益远小于风险。等后端稳定运行一段时间、确认数据不会丢，再谈第二期。

---

## 2026-11-04 补齐写操作（commit ed62358，已上线）

### 根因
上一轮接知识库时，`api-config.js` 的 DEFAULT 指向 `nlxroaosaoyi.sealoshzh.site`，
该实例已下线（三个阿里云 IP 全部 SSL handshake 失败）。
真实在线实例是 `ifgxxfqiahec.sealoshzh.site`（csrf 200、anonymous 201、knowledge 98 张）。
所以「后端连不上」不是后端没部署，是前端配了一个死地址，且只接了只读知识库，
预算和支出从来没发出过请求。

### 实测到的正确契约（2026-11-04）
| 步骤 | 请求 | 关键点 |
|---|---|---|
| 1 | `GET /api/v1/csrf` | 200，`data.csrfToken` + `Set-Cookie: zhj_csrf` |
| 2 | `POST /api/v1/auth/anonymous {}` | 201，`data.accessToken`、`data.user.id`；**之后 CSRF 轮换** |
| 3 | `GET /api/v1/csrf`（再取一次） | 必须重取，否则后续写操作 403 `CSRF_FAILED` |
| 4 | `POST /api/v1/onboarding` | 字段 `monthlyBudgetCents` / `fixedExpenseCents` / `nextIncomeDate` / `spendingProfile`；需 `Idempotency-Key` |
| 5 | `POST /api/v1/expenses` | 字段 `amountCents` / `category` / `date` / `note`；需 `Idempotency-Key` |
| 6 | `GET /api/v1/expenses` | 能读回刚写的行，`total` 递增 |
| 7 | `GET /api/v1/forecast` | 200，`weatherLabel` / `currentBalanceCents` / `projectedBalanceCents` |

分类枚举只认英文：`food` `transport` `study` `online` `entertainment` `daily` `other`。
中文分类名、`canteen`、`shopping`、`meal` 都会被 400 拒掉。

写操作缺 `Idempotency-Key` 会报 `VERTIFICATION_ERROR: 写操作需要有效的 Idempotency-Key`。

### 前端改动
- `api-config.js`：`DEFAULT` → `https://ifgxxfqiahec.sealoshzh.site/api/v1`；`SCHEMA` `5` → `6`（localStorage 里的旧地址自动作废）。
- `index.html`：
  - `ensureRemoteSession()`：匿名会话只建一次，建完立刻 `api.csrf()` 重取 CSRF；超时 15s（后端首包 3–4s）。
  - `pushOnboarding()` / `pushExpense()`：本地写完再异步推，失败只改状态不打断。
  - `saveRecord()` 的支出分支 → `pushExpense(state.expenses[0])`。
  - `completeOnboarding()` 成功 → `pushOnboarding(state.profile)`。
  - `REMOTE_CATEGORY` 中文 → 后端枚举。
  - 「我的」页新增 `#remoteState`，显示「已同步到后端 · HH:MM」或「仅本地 · 原因」。
  - 文案「本地预览版不会上传你的生活费数据」→「预算和支出先存在这台设备，再同步到后端；连不上时照常能用」。
- `vibe.css`：`.remote-state` 三态配色。

### 线上验收（https://yyyfh666.github.io/zhihuijin/）
- `POST /onboarding` → 201
- `POST /expenses` → 201，body `{amountCents:1800,category:"food",date:"2026-11-04",note:"食堂"}`
- `GET /expenses` → 200 `total:1`，读回同一行
- `GET /forecast` → 200 多云 / 余额 148200 / 预计 23200
- 零 console 错误、零 exception
- 「我的」页显示「已同步到后端 · 12:54」

复验脚本：`node tools/probe19.mjs https://yyyfh666.github.io/zhihuijin/index.html?v=<时间戳>`
