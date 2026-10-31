#!/usr/bin/env node
/**
 * 智汇金 · 本地备份 → 后端迁移脚本
 * ---------------------------------------------------------------
 * 前端导出的 JSON（schemaVersion 1/2）可以直接喂给这个脚本，
 * 它会把「预算 / 当前余额 / 支出记录」写进 API，并把「今日计划」
 * 单独导出一份 JSON（因为 /today-plan 目前后端还在修）。
 *
 * 用法：
 *   node tools/import-backup.mjs --file zhihuijin-backup-2026-10-31.json \
 *        --base https://nlxroaosaoyi.sealoshzh.site/api/v1 \
 *        --email me@example.com --password 'Passw0rd!'
 *
 * 常用参数：
 *   --file <path>        备份文件（必填；支持文字版 .txt 与旧版 .json）
 *   --base <url>         API 根地址，默认 https://nlxroaosaoyi.sealoshzh.site/api/v1
 *   --email/--password   没有 token 时用它注册/登录
 *   --token <jwt>        已有 accessToken 时直接用它，跳过登录
 *   --origin <url>       请求 Origin（后端 CORS 白名单只认 5173，从本机跑可不带）
 *   --dry-run            只打印将要发生的请求，不发写请求
 *   --tasks-out <path>   把今日计划导出成 JSON（默认 ./tasks-<日期>.json）
 *   --json               以 JSON 输出结果，便于 CI
 *
 * 退出码：0 全部成功；1 有失败项；2 参数/文件错误
 * ---------------------------------------------------------------
 * 注意：脚本对字段名做了容错（amountCents / amount / money 都认），
 * 如果后端字段与预期不同，400 的响应体会原样打印出来，按提示改
 * postExpense() 里的 body 即可。
 */

import { readFile, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

const DEFAULTS = {
  base: "https://nlxroaosaoyi.sealoshzh.site/api/v1",
  origin: ""
};

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      out._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  console.log(`用法:
  node tools/import-backup.mjs --file <备份.txt 或 .json> [选项]

必填:
  --file <path>        页面「导出备份」得到的文件（文字版 .txt 或旧版 .json）

选填:
  --base <url>         API 根地址，默认 https://nlxroaosaoyi.sealoshzh.site/api/v1
  --email <mail>       登录用邮箱（登录失败会自动注册）
  --password <pwd>     密码
  --token <jwt>        已有 accessToken 时直接用它
  --origin <url>       请求 Origin（后端 CORS 只认 5173，本机跑可不带）
  --dry-run            只打印请求，不联网
  --tasks-out <path>   计划导出位置，默认 ./tasks-<日期>.json
  --json               以 JSON 输出结果

示例:
  node tools/import-backup.mjs --file zhihuijin-backup-2026-10-31.txt \\
       --email me@example.com --password 'Passw0rd!' --dry-run`);
  process.exit(0);
}

const BASE = String(args.base || DEFAULTS.base).replace(/\/+$/, "");
const DRY = Boolean(args["dry-run"]);
const AS_JSON = Boolean(args.json);
const ORIGIN = args.origin ? String(args.origin) : "";

const report = {
  base: BASE,
  file: null,
  dryRun: DRY,
  auth: null,
  onboarding: null,
  expenses: { planned: 0, created: 0, skipped: 0, failed: [] },
  tasks: { planned: 0, out: null },
  warnings: []
};

function log(line = "") {
  if (!AS_JSON) console.log(line);
}

function fail(message, code = 1) {
  report.error = message;
  if (AS_JSON) console.log(JSON.stringify(report, null, 2));
  else console.error(`\n✖ ${message}`);
  process.exit(code);
}

/* ── 读取并归一化备份 ─────────────────────────────────────────── */

function centsOf(record) {
  // 分字段直接用；元字段乘 100
  for (const key of ["amountCents", "amount_cents"]) {
    const value = record[key];
    if (value === undefined || value === null || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return Math.round(number);
  }
  for (const key of ["amount", "money", "value"]) {
    const value = record[key];
    if (value === undefined || value === null || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return Math.round(number * 100);
  }
  return 0;
}

function dateOf(record) {
  const raw = record.date || record.occurredAt || record.createdAt || record.time;
  if (!raw) return new Date().toISOString().slice(0, 10);
  const text = String(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function normalize(json) {
  if (!json || typeof json !== "object") throw new Error("备份内容不是 JSON 对象");
  const data = json.data && typeof json.data === "object" ? json.data : json;
  if (!data.profile && !Array.isArray(data.expenses)) throw new Error("这不是智汇金的备份文件");
  const profile = data.profile || {};
  const fixed = profile.fixedExpensesCents || profile.fixed || [];
  return {
    schemaVersion: json.schemaVersion || 1,
    exportedAt: json.exportedAt || null,
    monthlyBudgetCents: Number(profile.monthlyBudgetCents || data.monthlyBudgetCents || 0),
    currentBalanceCents: Number(data.period && data.period.currentBalanceCents || profile.currentBalanceCents || 0),
    nextIncomeDate: profile.nextIncomeDate || (data.period && data.period.nextIncomeDate) || null,
    spendingProfile: profile.spendingProfile || "balanced",
    fixedExpensesCents: Array.isArray(fixed) ? fixed.map((item) => ({
      name: String(item.name || "固定支出"),
      amountCents: Number(item.amountCents || 0)
    })) : [],
    expenses: (data.expenses || []).map((item) => ({
      amountCents: centsOf(item),
      category: String(item.category || item.type || "其他"),
      note: String(item.note || item.title || item.name || ""),
      date: dateOf(item),
      signature: [dateOf(item), centsOf(item), item.category || "", item.note || ""].join("|")
    })).filter((item) => item.amountCents > 0),
    tasks: data.tasks || {},
    pauses: data.pauses || [],
    learning: data.learning || []
  };
}

/* ── HTTP ─────────────────────────────────────────────────────── */

let csrfToken = null;
let accessToken = args.token ? String(args.token) : null;

function headers(extra = {}) {
  const out = {
    "Content-Type": "application/json",
    "X-Request-Id": randomUUID(),
    ...extra
  };
  if (ORIGIN) out.Origin = ORIGIN;
  if (accessToken) out.Authorization = `Bearer ${accessToken}`;
  if (csrfToken) out["X-CSRF-Token"] = csrfToken;
  return out;
}

async function call(method, route, body, options = {}) {
  const url = `${BASE}${route}`;
  const init = { method, headers: headers(options.headers || {}), credentials: "include" };
  if (body !== undefined) init.body = JSON.stringify(body);
  if (DRY && method !== "GET") {
    log(`  · [dry-run] ${method} ${route} ${body ? JSON.stringify(body).slice(0, 120) : ""}`);
    return { ok: true, status: 0, body: { dryRun: true } };
  }
  const response = await fetch(url, init);
  let payload = null;
  const text = await response.text();
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = { raw: text.slice(0, 400) }; }
  }
  if (payload && payload.data && payload.data.csrfToken) csrfToken = payload.data.csrfToken;
  return { ok: response.ok, status: response.status, body: payload };
}

async function ensureCsrf() {
  if (csrfToken) return csrfToken;
  if (DRY) { csrfToken = "dry-run-csrf"; return csrfToken; }
  const res = await call("GET", "/csrf");
  if (!res.ok) throw new Error(`取 CSRF 失败：HTTP ${res.status} ${JSON.stringify(res.body)}`);
  return csrfToken;
}

async function authenticate() {
  if (DRY) {
    report.auth = { mode: "dry-run", email: args.email ? String(args.email) : null };
    return;
  }
  if (accessToken) {
    report.auth = { mode: "token" };
    return;
  }
  if (!args.email || !args.password) {
    throw new Error("需要 --token，或者 --email 与 --password 用来注册/登录");
  }
  await ensureCsrf();
  const email = String(args.email);
  const password = String(args.password);

  const login = await call("POST", "/auth/login", { email, password });
  if (login.ok && login.body && login.body.data && login.body.data.accessToken) {
    accessToken = login.body.data.accessToken;
    report.auth = { mode: "login", email };
    return;
  }
  if (login.status && login.status !== 401 && login.status !== 403) {
    report.warnings.push(`登录返回 HTTP ${login.status}，尝试注册`);
  }

  const register = await call("POST", "/auth/register", {
    email,
    password,
    consentVersion: args["consent-version"] ? String(args["consent-version"]) : "2026-10"
  });
  if (!register.ok || !(register.body && register.body.data && register.body.data.accessToken)) {
    throw new Error(`注册失败：HTTP ${register.status} ${JSON.stringify(register.body)}`);
  }
  accessToken = register.body.data.accessToken;
  report.auth = { mode: "register", email };
  csrfToken = null;
  await ensureCsrf();
}

/* ── 写入 ─────────────────────────────────────────────────────── */

async function pushOnboarding(backup) {
  const body = {
    monthlyBudgetCents: backup.monthlyBudgetCents,
    currentBalanceCents: backup.currentBalanceCents,
    nextIncomeDate: backup.nextIncomeDate || undefined,
    spendingProfile: backup.spendingProfile || "balanced"
  };
  if (backup.fixedExpensesCents.length) body.fixedExpensesCents = backup.fixedExpensesCents;
  const res = await call("POST", "/onboarding", body);
  report.onboarding = { ok: res.ok, status: res.status, body: res.ok ? null : res.body };
  if (!res.ok) report.warnings.push(`onboarding 失败：HTTP ${res.status} ${JSON.stringify(res.body)}`);
  return res;
}

async function pushExpenses(backup) {
  report.expenses.planned = backup.expenses.length;
  for (const item of backup.expenses) {
    const key = "import-" + createHash("sha1").update(item.signature).digest("hex").slice(0, 24);
    // 字段名按 README 的主写法；后端若改了字段，400 会打印出校验信息
    const body = {
      amountCents: item.amountCents,
      category: item.category,
      note: item.note,
      date: item.date,
      occurredAt: `${item.date}T12:00:00.000Z`
    };
    const res = await call("POST", "/expenses", body, { headers: { "Idempotency-Key": key } });
    if (res.ok) {
      report.expenses.created += 1;
      continue;
    }
    if (res.status === 409) {
      report.expenses.skipped += 1;
      continue;
    }
    report.expenses.failed.push({ signature: item.signature, status: res.status, body: res.body });
  }
}

async function exportTasks(backup) {
  const entries = Object.entries(backup.tasks || {}).flatMap(([date, list]) =>
    (Array.isArray(list) ? list : []).map((task) => ({ date, ...task }))
  );
  report.tasks.planned = entries.length;
  if (!entries.length) return;
  const outPath = path.resolve(String(args["tasks-out"] || `./tasks-${new Date().toISOString().slice(0, 10)}.json`));
  await writeFile(outPath, JSON.stringify({ exportedAt: new Date().toISOString(), tasks: entries }, null, 2), "utf8");
  report.tasks.out = outPath;
  report.warnings.push(`后端 /today-plan 仍在修复，${entries.length} 条计划已写入 ${outPath}，等接口修好再回灌`);
}

/* ── 主流程 ───────────────────────────────────────────────────── */

(async function main() {
  if (!args.file) fail("缺少 --file <备份文件>", 2);

  let raw;
  const filePath = path.resolve(String(args.file));
  report.file = filePath;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    fail(`读不到文件：${error.message}`, 2);
  }

  // 支持两种导出：可读文字版 .txt（内嵌 <<<ZHJ-BACKUP 段）与旧的 .json
  let jsonText = raw;
  const block = raw.match(/<<<ZHJ-BACKUP\s*([\s\S]*?)\s*ZHJ-BACKUP>>>/);
  if (block) {
    jsonText = block[1];
  } else if (!raw.trim().startsWith("{") && !raw.trim().startsWith("[")) {
    fail("这个文件里没有可导入的数据。请用页面「导出备份」生成的文件（.txt 或 .json）", 2);
  }

  let backup;
  try {
    backup = normalize(JSON.parse(jsonText));
  } catch (error) {
    fail(`备份文件有问题：${error.message}`, 2);
  }

  log(`智汇金备份迁移 → ${BASE}`);
  log(`  备份：${path.basename(filePath)}（schemaVersion ${backup.schemaVersion}${backup.exportedAt ? `，导出于 ${backup.exportedAt}` : ""}）`);
  log(`  预算：¥${(backup.monthlyBudgetCents / 100).toFixed(2)} · 当前余额：¥${(backup.currentBalanceCents / 100).toFixed(2)} · 支出 ${backup.expenses.length} 笔 · 计划 ${Object.values(backup.tasks || {}).reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0)} 条`);
  if (DRY) log("  模式：dry-run（不会写任何数据）");
  log("");

  try {
    await ensureCsrf();
    await authenticate();
    log(`  ✓ 身份：${report.auth.mode}${report.auth.email ? ` (${report.auth.email})` : ""}`);
  } catch (error) {
    fail(error.message);
  }

  const onboard = await pushOnboarding(backup);
  log(`  ${onboard.ok ? "✓" : "✖"} 预算与余额：HTTP ${onboard.status || "dry"}`);

  await pushExpenses(backup);
  log(`  ${report.expenses.failed.length ? "✖" : "✓"} 支出：计划 ${report.expenses.planned} · 写入 ${report.expenses.created} · 跳过(重复) ${report.expenses.skipped} · 失败 ${report.expenses.failed.length}`);

  await exportTasks(backup);
  if (report.tasks.planned) log(`  · 今日计划 ${report.tasks.planned} 条 → ${report.tasks.out}`);

  if (report.expenses.failed.length) {
    log("");
    log("  失败明细（前 3 条）：");
    report.expenses.failed.slice(0, 3).forEach((item) => {
      log(`    · ${item.signature} → HTTP ${item.status} ${JSON.stringify(item.body).slice(0, 220)}`);
    });
  }
  report.warnings.forEach((line) => log(`  ! ${line}`));
  log("");

  if (AS_JSON) console.log(JSON.stringify(report, null, 2));
  else console.log(report.expenses.failed.length ? "完成，但有失败项，看上面的明细。" : "完成。");

  process.exit(report.expenses.failed.length ? 1 : 0);
})();
