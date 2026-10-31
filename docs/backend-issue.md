# 智汇金 · 后端联调问题清单

> 提交人：前端（智汇金 钱包天气预报 · https://yyyfh666.github.io/zhihuijin/）
> 报告时间：2026-10-31
> 后端地址：`https://nlxroaosaoyi.sealoshzh.site/api/v1`
> 前端请求层：仓库 `api.js` + `api-config.js`；诊断脚本 `tools/probe-backend.mjs`（六层自检，零依赖）

## 一句话摘要

主链路（注册 → 资料 → 预测 → 记账 → 知识卡）**已经跑通**，可以正常联调。
但有 **1 个 P0（登录全线不可用）**、**4 个 P1 接口 500**、**1 个 P2（CORS 白名单过窄）** 需要后端处理，具体如下。

| # | 级别 | 问题 | 状态 |
| --- | --- | --- | --- |
| 1 | P0 | `POST /auth/login` 恒 401 / 不存在邮箱时 500 | ❌ 阻塞 |
| 2 | P1 | `GET /today-plan` 与 `POST /today-plan/generate` 500 | ❌ 阻塞「今日计划」同步 |
| 3 | P1 | `GET /budget-periods?status=active` 500 | ❌ 阻塞周期视图 |
| 4 | P1 | `GET /emergency/checklist` 500 | ❌ 阻塞应急清单 |
| 5 | P2 | CORS 白名单只含 5173 两个来源 | ⚠️ 线上页面连不上 |
| 6 | P3 | `/expenses`、`/onboarding` 字段名需确认 | ⚠️ 待对齐 |

---

## 1. P0 · `POST /auth/login` 不可用

### 现象

两种都坏，而且坏法不同：

- **用刚注册成功的账号、同一组邮箱密码去登录 → `401 INVALID_CREDENTIALS`**
- **用不存在的邮箱去登录 → `500`（不是 401）**

第二种说明「查不到用户」没有被当成正常分支处理，是空指针级别的异常。

### 复现

```bash
BASE=https://nlxroaosaoyi.sealoshzh.site/api/v1
EMAIL="bug-$(date +%s)@example.com"
PASS='Passw0rd!123'

# ① 注册（这一步是好的，201）
curl -s -i -X POST "$BASE/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"consentVersion\":\"2026-10\"}" | head -20

# ② 立刻用同一组凭据登录（坏）
curl -s -i -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}"

# ③ 不存在的邮箱（坏，期望 401，实际 500）
curl -s -i -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"nobody-here@example.com","password":"whatever"}'
```

### 期望

- ① 之后 ② → `200` + `{data:{accessToken}}`，与注册返回同构
- ③ → `401 INVALID_CREDENTIALS`，**不能** 500（且不能暴露「邮箱是否存在」的差异：两种失败给同一个 401）

### 怀疑方向

`/auth/register` 与 `/auth/login` 的密码哈希路径不一致（注册侧可能是明文/另一种算法入库，或盐不一致）；以及 `login` 里 `user` 未判空就直接 `user.passwordHash`。

### 影响

前端目前只能靠「登录失败就自动注册」绕过，同一个账号第二次跑迁移脚本会**建出重复用户**，数据被拆散。这一条不修，多设备同步等于不可用。

---

## 2. P1 · `/today-plan` 全线 500

```bash
# 读取（带日期）
curl -s -i "$BASE/today-plan?date=2026-10-31" -H "Authorization: Bearer $TOKEN"
# requestId: 9ead21cd

# 生成
curl -s -i -X POST "$BASE/today-plan/generate" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"date":"2026-10-31"}'
# requestId: e1b565fb
```

期望：读取返回当日计划数组（空数组也要 `200`）；生成返回生成结果。
现状：两个都进 handler 后抛异常 → `500`。

---

## 3. P1 · `GET /budget-periods?status=active` 500

```bash
curl -s -i "$BASE/budget-periods?status=active" -H "Authorization: Bearer $TOKEN"
# requestId: 6dde2aad
```

期望：返回当前生效周期对象（未初始化时返回 `204` 或 `200 + data:null`，不要 500）。

---

## 4. P1 · `GET /emergency/checklist` 500

```bash
curl -s -i "$BASE/emergency/checklist" -H "Authorization: Bearer $TOKEN"
# requestId: 73e19729
```

期望：返回清单项（空数组也要 `200`）。

---

## 5. P2 · CORS 白名单需要加线上域名

现状：预检只对 `http://localhost:5173` 与 `http://127.0.0.1:5173` 回 `Access-Control-Allow-Origin`，其它来源一律

```
403 FORBIDDEN · 请求来源不受信任
```

这导致**部署在 GitHub Pages 的页面完全连不上后端**（浏览器预检就挂了）。

### 请放行

```
https://yyyfh666.github.io      ← 线上站点
http://localhost:5173           ← 已有
http://127.0.0.1:5173           ← 已有
```

并保持现有的预检能力（这些是对的，不用改）：

- `Access-Control-Allow-Headers: Authorization, Content-Type, X-Request-Id, X-CSRF-Token, Idempotency-Key`
- `Access-Control-Allow-Methods: GET, HEAD, PUT, PATCH, POST, DELETE`
- `Access-Control-Allow-Credentials: true` + `Vary: Origin`

如果暂时不想放开公网来源，请至少确认：**允许 `https://yyyfh666.github.io` 与否，请给一句明确答复**，前端据此决定线上是「纯本地模式」还是「可登录模式」。

---

## 6. P3 · 字段契约确认

前端与迁移脚本目前按下面这套字段发送，请确认是否与后端实体一致（不一致的话请给出真实字段名，前端改一行即可）：

```jsonc
// POST /onboarding
{
  "monthlyBudgetCents": 150000,          // 每月生活费（分）
  "currentBalanceCents": 128000,         // 当前余额（分）
  "nextIncomeDate": "2026-11-20",        // 下次到账日 YYYY-MM-DD
  "spendingProfile": "balanced",         // conservative | balanced | flexible
  "fixedExpensesCents": [                // 固定支出（可选）
    { "name": "房租", "amountCents": 30000 }
  ]
}

// POST /expenses（必须带 Idempotency-Key 头）
{
  "amountCents": 1800,
  "category": "食堂",
  "note": "午饭",
  "date": "2026-10-30",
  "occurredAt": "2026-10-30T12:00:00.000Z"
}
```

另：`GET /expenses` 返回的 `amountCents`（或 `amount_cents`）前端两种都认，但请固定一种并在文档里写明。

---

## 已验证可用（不用动）

| 接口 | 结果 |
| --- | --- |
| `GET /csrf` | `200`，`data.csrfToken` + `Set-Cookie: zhj_csrf` |
| `POST /auth/register` | `201`，返回 `data.accessToken`（需 `consentVersion:"2026-10"`） |
| `GET /me` | `200` |
| `POST /onboarding` | `201` |
| `GET /forecast?days=30` | `200`（数据不足时 `422 DATA_INSUFFICIENT`，符合预期） |
| `POST /expenses` | `201`（带 `Idempotency-Key`） |
| `GET /expenses` | `200` |
| `GET /knowledge/cards` | `200`，98 张 |
| `GET /training/scenarios` | `200` |
| `GET /content/manifest` | `200` |
| `GET /reports/weekly` | 缺 `weekStart` 时正确 `400 VALIDATION_ERROR` |

两个已知但不算 bug 的：`GET /api/v1/health` 返回 401（健康检查在根路径 `/health`）；域名偶发 TLS 握手无响应（NLB 后可能有节点不健康，`ping` 4.6–7.3 秒），重启网关后建议验一下。

---

## 验收清单（改完请按这个自测）

- [ ] 新邮箱注册 → 立刻登录 → `200` + `accessToken`
- [ ] 错误密码 → `401`（不是 500）
- [ ] 不存在的邮箱 → `401`（不是 500）
- [ ] 同一账号连登两次都成功（幂等，不建新用户）
- [ ] `GET /today-plan?date=今天` → `200`（无计划时 `[]`）
- [ ] `POST /today-plan/generate` → `200`
- [ ] `GET /budget-periods?status=active` → `200`/`204`
- [ ] `GET /emergency/checklist` → `200`
- [ ] 来自 `https://yyyfh666.github.io` 的预检返回 `Access-Control-Allow-Origin` 且含该来源

---

## 附：前端自带的自检工具

```bash
# 六层自检：网络 / CORS / 路由 / CSRF / 登录 / 注册
node tools/probe-backend.mjs --base https://nlxroaosaoyi.sealoshzh.site/api/v1 --origin https://yyyfh666.github.io

# 迁移脚本（把前端导出的 .txt 备份灌进后端，可先空跑）
node tools/import-backup.mjs --file zhihuijin-backup-2026-10-31.txt --dry-run
node tools/import-backup.mjs --file zhihuijin-backup-2026-10-31.txt --email me@example.com --password '***'
```

两个脚本都零依赖、Node 18+ 直接跑，输出里带 `requestId`，方便对上服务端日志。
