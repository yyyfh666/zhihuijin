#!/usr/bin/env node
/* ============================================================================
   智汇金 · 后端联通/契约自检脚本
   ----------------------------------------------------------------------------
   用途：把这个文件发给后端同学，他直接跑，就能看到「前端到底卡在哪一层」，
        以及后端需要改哪几处。零依赖，Node 18+ 即可（用到全局 fetch）。

   用法：
     node probe-backend.mjs
     node probe-backend.mjs --base https://nlxroaosaoyi.sealoshzh.site
     node probe-backend.mjs --base https://xxx/api/v1 --origin http://127.0.0.1:5173
     node probe-backend.mjs --email a@b.com --password secret      # 可选：真登录一次
     node probe-backend.mjs --json report.json                    # 结果落盘，便于回传

   退出码：0 = 全绿；1 = 有需要后端修的问题。
   ========================================================================== */

import dns from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";
import fs from "node:fs/promises";

/* ----------------------------- 参数 ----------------------------- */
function arg(name, fallback) {
  const i = process.argv.indexOf("--" + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const BASE_RAW = arg("base", "https://nlxroaosaoyi.sealoshzh.site/api/v1").replace(/\/+$/, "");
const HOST_URL = new URL(BASE_RAW);
const ORIGINS = (arg("origin", "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4174"))
  .split(",").map((s) => s.trim()).filter(Boolean);
const EMAIL = arg("email", "");
const PASSWORD = arg("password", "");
const OUT = arg("json", "");
const TIMEOUT = Number(arg("timeout", "12000"));

/* --------------------------- 小工具 --------------------------- */
const C = {
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  bad: (s) => `\x1b[31m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`,
};
const report = { base: BASE_RAW, startedAt: new Date().toISOString(), checks: [] };
function record(area, name, pass, detail) {
  report.checks.push({ area, name, pass, detail });
  const mark = pass === true ? C.ok("PASS") : pass === "warn" ? C.warn("WARN") : C.bad("FAIL");
  console.log(`  ${mark}  ${name}${detail ? C.dim("  · " + detail) : ""}`);
}
function section(t) { console.log("\n" + C.b(t)); }

async function fetchT(url, init = {}, retry = 1) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT);
  const t0 = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: ac.signal });
    const text = await res.text().catch(() => "");
    let body = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text.slice(0, 200) }; }
    return { res, body, text, ms: Date.now() - t0, error: null };
  } catch (e) {
    if (retry > 0) return fetchT(url, init, retry - 1);
    const cause = e?.cause ? ` / ${e.cause.code || e.cause.message}` : "";
    return { res: null, body: {}, text: "", ms: Date.now() - t0, error: String(e?.message || e) + cause };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------ 1. 网络层 ------------------------ */
section(`1. 网络层  ${HOST_URL.host}`);
const host = HOST_URL.hostname;
const port = Number(HOST_URL.port || (HOST_URL.protocol === "https:" ? 443 : 80));

const ips = await dns.lookup(host, { all: true }).then((r) => r.map((x) => x.address)).catch(() => []);
record("net", `DNS 解析 ${host}`, ips.length > 0, ips.join(", ") || "解析失败");

function tcp(addr, p) {
  return new Promise((resolve) => {
    const s = net.connect({ host: addr, port: p });
    const done = (ok, note) => { try { s.destroy(); } catch {} resolve({ ok, note }); };
    s.setTimeout(6000, () => done(false, "TCP 连接超时"));
    s.once("connect", () => done(true, `TCP ${addr}:${p} 已建立`));
    s.once("error", (e) => done(false, `${e.code || e.message}`));
  });
}
for (const ip of ips.slice(0, 3)) {
  const r = await tcp(ip, port);
  record("net", `TCP ${ip}:${port}`, r.ok, r.note);
}

if (HOST_URL.protocol === "https:") {
  const t = await new Promise((resolve) => {
    const s = tls.connect({ host, port, servername: host, timeout: 8000 }, () => resolve({ ok: true, note: `TLS ${s.getProtocol()} · 证书 ${s.getPeerCertificate()?.subject?.CN || "?"}` }));
    s.setTimeout(8000, () => { try { s.destroy(); } catch {} resolve({ ok: false, note: "TLS 握手超时（端口通但对面不应答）" }); });
    s.once("error", (e) => { try { s.destroy(); } catch {} resolve({ ok: false, note: `${e.code || e.message}` }); });
  });
  record("net", "TLS 握手", t.ok, t.note);
}

/* ------------------------ 2. CORS ------------------------ */
section("2. 跨域（CORS）——浏览器能不能读到响应");
const TRUSTED = [];
for (const origin of ORIGINS) {
  const pre = await fetchT(BASE_RAW + "/auth/login", {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,x-csrf-token",
    },
  });
  const preAcao = pre.res?.headers.get("access-control-allow-origin") || "";
  const preAcac = pre.res?.headers.get("access-control-allow-credentials") || "";
  const preVary = pre.res?.headers.get("vary") || "";
  const preAllow = pre.res?.headers.get("access-control-allow-headers") || "";

  const post = await fetchT(BASE_RAW + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin, Referer: origin + "/" },
    body: JSON.stringify({ email: "probe@example.com", password: "x" }),
  });
  const postAcao = post.res?.headers.get("access-control-allow-origin") || "";
  const code = post.body?.code || "(no json)";
  const trusted = !!postAcao;
  if (trusted) TRUSTED.push(origin);

  console.log(`  ${C.dim("Origin")} ${origin}`);
  console.log(`    preflight: status=${pre.res?.status ?? "ERR"} ACAO=${preAcao || C.bad("缺失")} ACAC=${preAcac || "-"} allow-headers=${preAllow || "-"} vary=${preVary || "-"}`);
  console.log(`    POST     : status=${post.res?.status ?? "ERR"} code=${code} ACAO=${postAcao || C.bad("缺失（浏览器会丢弃响应）")}`);
  record("cors", `放行 ${origin}`, trusted, trusted ? "已回 ACAO" : "未回 Access-Control-Allow-Origin");
}
record("cors", "ACAC = true（允许携带 Cookie）", TRUSTED.length > 0, "必须同时回 Access-Control-Allow-Credentials: true");

/* ------------------------ 3. 路由是否存在 ------------------------ */
section("3. 路由探测  （404=没有该接口 / 401=有接口但未登录 / 400=有接口且校验了入参 / 403=来源被拒 / 500=接口有异常）");
const probeOrigin = TRUSTED[0] || ORIGINS[0];
const ROUTES = [
  ["GET", "/csrf"], ["GET", "/auth/csrf"], ["GET", "/auth/csrf-token"], ["GET", "/security/csrf"],
  ["POST", "/auth/login"], ["POST", "/auth/register"], ["POST", "/auth/refresh"], ["POST", "/auth/logout"],
  ["GET", "/auth/me"], ["GET", "/health"], ["GET", "/forecast"], ["GET", "/content/manifest"],
  ["GET", "/knowledge/cards"], ["GET", "/training/scenarios"],
];
const routeState = {};
for (const [method, path] of ROUTES) {
  const body = method === "POST" ? JSON.stringify({ email: "probe@example.com", password: "x" }) : undefined;
  const r = await fetchT(BASE_RAW + path, {
    method,
    headers: { Accept: "application/json", Origin: probeOrigin, ...(body ? { "Content-Type": "application/json" } : {}) },
    body,
  });
  const st = r.res?.status ?? 0;
  const code = r.body?.code || "";
  let verdict = "未知";
  if (r.error) verdict = "网络错误";
  else if (st === 404) verdict = "接口不存在";
  else if (st === 403) verdict = "来源/权限被拒";
  else if (st === 401) verdict = "存在·需登录";
  else if (st === 400 || st === 422) verdict = "存在·入参校验";
  else if (st === 500) verdict = "存在·服务异常";
  else if (st < 400) verdict = "可用";
  const setc = (r.res?.headers.getSetCookie?.() || []).map((c) => c.split("=")[0]);
  routeState[method + " " + path] = { status: st, code, verdict, cookies: setc };
  const pass = st !== 0 && st !== 404 ? true : false;
  record("routes", `${method} ${BASE_RAW.replace(/^https?:\/\/[^/]+/, "")}${path}`, pass,
    `${st} ${code || ""} → ${verdict}${setc.length ? " · Set-Cookie: " + setc.join(",") : ""}`);
}

/* ------------------------ 4. CSRF 契约 ------------------------ */
section("4. CSRF 契约");
/* 有些实现不是「GET /csrf」，而是任何一次响应都顺手下发 csrf Cookie —— 先把 Cookie 捞一遍 */
const cookieJar = {};
for (const [k, v] of Object.entries(routeState)) {
  for (const name of (v.cookies || [])) cookieJar[name] = (cookieJar[name] || 0) + 1;
}
const jarNames = Object.keys(cookieJar);
record("csrf", "服务端下发过哪些 Cookie", jarNames.length > 0,
  jarNames.length ? jarNames.map((n) => `${n}×${cookieJar[n]}`).join(", ") : "全程没有任何 Set-Cookie（无法携带会话/令牌）");
const csrfHits = Object.entries(routeState).filter(([k, v]) => k.includes("csrf") && v.status === 200);
if (csrfHits.length === 0) {
  record("csrf", "存在一个可匿名访问的 GET /csrf", false,
    "前端拿不到令牌，所有写请求都会缺 X-CSRF-Token。建议：GET /api/v1/csrf → {data:{csrfToken}} 且 Set-Cookie: zhj_csrf=…; SameSite=Lax");
} else {
  for (const [k] of csrfHits) {
    const r = await fetchT(BASE_RAW + k.split(" ")[1], { method: "GET", headers: { Accept: "application/json", Origin: probeOrigin } });
    const token = r.body?.data?.csrfToken || r.body?.csrfToken || r.body?.token || "";
    const cookie = (r.res?.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join(" | ");
    record("csrf", `GET ${k.split(" ")[1]} 返回令牌`, !!token || !!cookie, `token=${token ? token.slice(0, 16) + "…" : "无"} cookie=[${cookie || "无"}]`);
  }
}

/* ------------------------ 5. 登录流程 ------------------------ */
section("5. 登录流程（期望：错误凭据 → 401 INVALID_CREDENTIALS，而不是 500）");
const loginBody = EMAIL && PASSWORD
  ? { email: EMAIL, password: PASSWORD }
  : { email: "probe@example.com", password: "definitely-wrong-" + Date.now() };
const login = await fetchT(BASE_RAW + "/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json", Origin: probeOrigin },
  body: JSON.stringify(loginBody),
});
const loginCode = login.body?.code || "";
const loginOk = login.res && (login.res.status === 200 || login.res.status === 401);
record("login", `POST /auth/login（${EMAIL ? "真实凭据" : "错误凭据"}）`,
  loginOk,
  `status=${login.res?.status ?? "ERR"} code=${loginCode || "-"} msg=${login.body?.message || login.error || ""}`);
if (login.res?.status === 500) {
  record("login", "登录不应 500", false,
    "合法邮箱格式却返回 INTERNAL_ERROR：通常是 (a) 缺 CSRF 令牌时中间件抛异常，(b) 查库/配置异常。请查后端日志的 requestId");
}
if (login.res?.status === 200) {
  const token = login.body?.data?.accessToken || login.body?.data?.access_token || "";
  record("login", "登录成功并下发 accessToken", !!token, token ? token.slice(0, 16) + "…" : "响应里没有 accessToken/access_token");
  const me = await fetchT(BASE_RAW + "/auth/me", {
    method: "GET",
    headers: { Accept: "application/json", Origin: probeOrigin, ...(token ? { Authorization: "Bearer " + token } : {}) },
  });
  record("login", "带 token 访问 /auth/me", me.res?.status === 200, `status=${me.res?.status ?? "ERR"} code=${me.body?.code || "-"}`);
}

/* ------------------------ 6. 注册契约 ------------------------ */
section("6. 注册契约（前端需要知道 consentVersion 的合法值）");
const reg = await fetchT(BASE_RAW + "/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json", Origin: probeOrigin },
  body: JSON.stringify({ email: "probe@example.com", password: "Probe-pass-123", consentVersion: "v1" }),
});
record("register", "POST /auth/register 给出明确的 consentVersion 要求",
  reg.body?.code === "VALIDATION_ERROR" || reg.res?.status === 201 || reg.res?.status === 200 || reg.res?.status === 409,
  `status=${reg.res?.status ?? "ERR"} code=${reg.body?.code || "-"} msg=${reg.body?.message || reg.error || ""}`);

/* ------------------------ 汇总 ------------------------ */
const fails = report.checks.filter((c) => c.pass === false);
const warns = report.checks.filter((c) => c.pass === "warn");
section("结论");
console.log(`  检查项 ${report.checks.length} · ${C.ok("通过 " + (report.checks.length - fails.length - warns.length))} · ${C.warn("警告 " + warns.length)} · ${C.bad("不通过 " + fails.length)}`);

if (fails.length) {
  console.log("\n" + C.b("需要后端改的地方（按优先级）"));
  const areas = [...new Set(fails.map((f) => f.area))];
  const FIX = {
    net: "网络层：NLB 后面是否只有部分节点健康？443 握手间歇性无响应会直接表现为前端 Failed to fetch。",
    cors: [
      "CORS：预检与实际响应都要回 Access-Control-Allow-Origin（值必须精确等于请求的 Origin，不能写 *），并回 Access-Control-Allow-Credentials: true、Vary: Origin。",
      "把前端开发源加进白名单：http://127.0.0.1:5173、http://localhost:5173（现在只信任 5173 这一对）。",
      "预检要允许的头：Content-Type, X-CSRF-Token, X-Request-Id, Authorization, Idempotency-Key；方法：GET,POST,PUT,PATCH,DELETE,OPTIONS。",
    ],
    routes: "路由：前端按 /api/v1 访问；请确认实际挂载前缀，缺失的接口要么实现要么在文档里删掉。",
    csrf: [
      "CSRF：提供匿名可访问的 GET /api/v1/csrf，返回 {data:{csrfToken}}，同时 Set-Cookie: zhj_csrf=<token>; Path=/; SameSite=Lax（跨站则 SameSite=None; Secure）。",
      "写请求校验 X-CSRF-Token；校验失败请回 403 CSRF_INVALID，不要回 500。",
    ],
    login: "登录：凭据错误回 401 INVALID_CREDENTIALS；缺/错 CSRF 回 403；不要让异常冒成 500。",
    register: "注册：consentVersion 需要一份「当前合法版本」的说明，最好再开 GET /api/v1/consent 返回 {version}。",
  };
  for (const a of areas) {
    const v = FIX[a];
    if (Array.isArray(v)) v.forEach((line) => console.log("  · " + line));
    else console.log("  · " + v);
    console.log("");
  }
}

report.finishedAt = new Date().toISOString();
report.trustedOrigins = TRUSTED;
if (OUT) {
  await fs.writeFile(OUT, JSON.stringify(report, null, 2), "utf8");
  console.log(C.dim(`报告已写入 ${OUT}`));
}
process.exit(fails.length ? 1 : 0);
