// 临时验收脚本：后端修复后逐条复测（跑完即删）
const BASE = "https://nlxroaosaoyi.sealoshzh.site/api/v1";
const ORIGIN = "https://yyyfh666.github.io";
const stamp = Date.now().toString(36);
const EMAIL = `qa.${stamp}@example.com`;
const PASS = "Passw0rd!123";

const rows = [];
let token = "";
let csrf = "";
let cookie = "";

function note(name, ok, detail) {
  rows.push({ name, ok, detail });
  const mark = ok === null ? "·" : ok ? "✓" : "✗";
  console.log(`${mark} ${name} — ${detail}`);
}

async function call(method, path, body, opts = {}) {
  const headers = {
    "X-Request-Id": crypto.randomUUID(),
  };
  if (opts.origin !== false) headers.Origin = ORIGIN;
  if (body) headers["Content-Type"] = "application/json";
  if (opts.auth !== false && token) headers.Authorization = `Bearer ${token}`;
  if (opts.idem) headers["Idempotency-Key"] = opts.idem;
  const csrfValue = opts.csrf !== undefined ? opts.csrf : csrf;
  if (csrfValue) headers["X-CSRF-Token"] = csrfValue;
  if (cookie) headers.Cookie = cookie;

  let res, text = "";
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    text = await res.text();
  } catch (error) {
    return { status: 0, code: "NETWORK", message: error.message, raw: "", data: null };
  }

  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of setCookie) {
    const pair = c.split(";")[0];
    const [name, value] = pair.split("=");
    if (name.trim() === "zhj_csrf") cookie = `zhj_csrf=${value}`;
  }

  let data = null;
  try { data = JSON.parse(text); } catch { data = null; }
  if (data?.data?.csrfToken) csrf = data.data.csrfToken;
  return {
    status: res.status,
    code: data?.code || "",
    message: data?.message || "",
    rid: data?.requestId || data?.rid || "",
    data: data?.data ?? null,
    raw: text.slice(0, 220),
    acao: res.headers.get("access-control-allow-origin") || "",
  };
}

const ok200 = (r) => r.status >= 200 && r.status < 300;
const brief = (r) => `HTTP ${r.status}${r.code ? " " + r.code : ""}${r.rid ? " rid=" + r.rid : ""}${r.message ? " · " + r.message : ""}`;

(async () => {
  console.log(`目标 ${BASE}`);
  console.log(`Origin ${ORIGIN}\n`);

  // 0. CORS 预检
  let r = await fetch(`${BASE}/auth/login`, {
    method: "OPTIONS",
    headers: {
      Origin: ORIGIN,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,authorization,x-csrf-token",
    },
  }).catch((e) => ({ status: 0, headers: new Map() }));
  const acao = r.headers?.get?.("access-control-allow-origin") || "";
  note("CORS 预检 github.io", acao ? acao.includes("yyyfh666.github.io") : false, `HTTP ${r.status} · ACAO=${acao || "(空)"}`);

  // 1. CSRF
  r = await call("GET", "/csrf", null, { auth: false });
  note("GET /csrf", ok200(r) && !!csrf, brief(r));

  // 2. 注册
  r = await call("POST", "/auth/register", { email: EMAIL, password: PASS, consentVersion: "2026-10" }, { auth: false });
  note("POST /auth/register", ok200(r), brief(r));
  token = r.data?.accessToken || "";

  // 3. 关键：用同一组凭据登录
  r = await call("POST", "/auth/login", { email: EMAIL, password: PASS }, { auth: false });
  note("POST /auth/login（正确密码，P0）", ok200(r) && !!r.data?.accessToken, brief(r));
  if (r.data?.accessToken) token = r.data.accessToken;

  // 4. 错误密码 → 应 401 而非 500
  r = await call("POST", "/auth/login", { email: EMAIL, password: "wrong-password" }, { auth: false });
  note("POST /auth/login（错误密码）", r.status === 401, brief(r));

  // 5. 不存在邮箱 → 应 401 而非 500
  r = await call("POST", "/auth/login", { email: `nobody.${stamp}@example.com`, password: "x" }, { auth: false });
  note("POST /auth/login（不存在邮箱）", r.status === 401, brief(r));

  // 6. 再次登录（幂等，不应建新用户）
  r = await call("POST", "/auth/login", { email: EMAIL, password: PASS }, { auth: false });
  note("POST /auth/login（重复登录）", ok200(r), brief(r));

  // 7. me
  r = await call("GET", "/me");
  note("GET /me", ok200(r), `${brief(r)} · user=${r.data?.email || r.data?.user?.email || "?"}`);

  // 8. onboarding
  r = await call("POST", "/onboarding", {
    monthlyBudgetCents: 150000,
    currentBalanceCents: 128000,
    nextIncomeDate: "2026-11-20",
    spendingProfile: "balanced",
    fixedExpensesCents: [{ name: "房租", amountCents: 30000 }],
  });
  note("POST /onboarding", ok200(r), brief(r));

  // 9. forecast
  r = await call("GET", "/forecast?days=30");
  note("GET /forecast", ok200(r) || r.code === "DATA_INSUFFICIENT", brief(r));

  // 10. expenses 写入
  r = await call("POST", "/expenses", {
    amountCents: 1800, category: "食堂", note: "验收", date: "2026-10-30",
    occurredAt: "2026-10-30T12:00:00.000Z",
  }, { idem: `qa-${stamp}-1` });
  note("POST /expenses", ok200(r), brief(r));

  // 11. today-plan 读取（原 500）
  r = await call("GET", "/today-plan?date=2026-10-31");
  note("GET /today-plan（P1）", ok200(r), `${brief(r)} · items=${Array.isArray(r.data) ? r.data.length : Array.isArray(r.data?.items) ? r.data.items.length : "?"}`);

  // 12. today-plan 生成（原 500）
  r = await call("POST", "/today-plan/generate", { date: "2026-10-31" });
  note("POST /today-plan/generate（P1）", ok200(r), brief(r));

  // 13. budget-periods（原 500）
  r = await call("GET", "/budget-periods?status=active");
  note("GET /budget-periods（P1）", ok200(r), brief(r));

  // 14. emergency/checklist（原 500）
  r = await call("GET", "/emergency/checklist");
  note("GET /emergency/checklist（P1）", ok200(r), brief(r));

  // 15. 其它读接口
  r = await call("GET", "/knowledge/cards");
  note("GET /knowledge/cards", ok200(r), `${brief(r)} · n=${Array.isArray(r.data) ? r.data.length : "?"}`);
  r = await call("GET", "/expenses");
  note("GET /expenses", ok200(r), brief(r));

  const bad = rows.filter((x) => x.ok === false);
  console.log(`\n结果：${rows.length - bad.length}/${rows.length} 通过`);
  if (bad.length) {
    console.log("未通过：");
    for (const b of bad) console.log(`  ✗ ${b.name} — ${b.detail}`);
  }
  process.exitCode = bad.length ? 1 : 0;
})();
