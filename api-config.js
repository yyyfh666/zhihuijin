/* ============================================================================
   智汇金 · 接口根地址配置（唯一改动点）
   ----------------------------------------------------------------------------
   后端按 README2 实现（Node/Express，前缀 /api/v1）：
     GET  {BASE}/csrf            → data.csrfToken，并 Set-Cookie: zhj_csrf
     POST {BASE}/auth/register   {email,password,displayName?,consentVersion:"2026-10"}
     POST {BASE}/auth/login      {email,password,rememberMe?}
     POST {BASE}/auth/refresh    需刷新 Cookie + CSRF 头
     GET  {BASE}/me              需 Authorization: Bearer
   跨域白名单只信任 http://localhost:5173 与 http://127.0.0.1:5173，
   三种改法：
     1) 改下面 DEFAULT；
     2) 地址栏覆盖 index.html?api=https://其他域名/api （访问一次即记住）；
     3) 页面内：「我的」→ 接口设置 → 保存并刷新。
   注意：改 DEFAULT 时把 SCHEMA 加 1，旧地址会自动作废，不会被 localStorage 顶回来。
   ========================================================================== */
(function () {
  "use strict";
  var KEY = "zhj:apiBase";
  var KEY_SCHEMA = "zhj:apiBaseSchema";
  var SCHEMA = "5";
  var DEFAULT = "https://nlxroaosaoyi.sealoshzh.site/api/v1";

  function clean(url) {
    return String(url || "").trim().replace(/\/+$/, "");
  }

  var stored = null;
  var storedSchema = null;
  try {
    stored = localStorage.getItem(KEY);
    storedSchema = localStorage.getItem(KEY_SCHEMA);
  } catch (e) {
    stored = null;
    storedSchema = null;
  }

  /* 旧版本留下的地址（例如 127.0.0.1:3000）在 SCHEMA 变化后作废 */
  if (stored && storedSchema !== SCHEMA) {
    stored = null;
    try {
      localStorage.removeItem(KEY);
      localStorage.setItem(KEY_SCHEMA, SCHEMA);
    } catch (e) {}
  }

  var fromQuery = null;
  try {
    fromQuery = new URLSearchParams(location.search).get("api");
  } catch (e) {
    fromQuery = null;
  }

  var base = clean(fromQuery || stored || DEFAULT);
  window.ZHJ_API_BASE = base;
  window.zhjDefaultApiBase = DEFAULT;

  function persist(url) {
    try {
      localStorage.setItem(KEY, url);
      localStorage.setItem(KEY_SCHEMA, SCHEMA);
    } catch (e) {}
  }

  if (fromQuery) persist(base);

  window.zhjSetApiBase = function (url) {
    var next = clean(url);
    if (!next) return window.ZHJ_API_BASE;
    persist(next);
    window.ZHJ_API_BASE = next;
    return next;
  };

  window.zhjResetApiBase = function () {
    try {
      localStorage.removeItem(KEY);
      localStorage.setItem(KEY_SCHEMA, SCHEMA);
    } catch (e) {}
    window.ZHJ_API_BASE = DEFAULT;
    return DEFAULT;
  };
})();
