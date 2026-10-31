/* ============================================================================
   智汇金 · 接口请求层
   ----------------------------------------------------------------------------
   线上后端实际约定（2026-10 实测）：
     BASE = https://nlxroaosaoyi.sealoshzh.site/api/v1
     GET  {BASE}/csrf            取 CSRF token（后端若未开放会 401/404，本层容忍）
     POST {BASE}/auth/login      { email, password }        + X-CSRF-Token
     POST {BASE}/auth/register   { email, password, consentVersion }
     POST {BASE}/auth/refresh
     POST {BASE}/auth/logout
     GET  {BASE}/auth/me
   三条硬规则：
     1) 带 Cookie 的请求一律 credentials: "include"（axios 等价 withCredentials: true）
     2) 写请求带 X-CSRF-Token（值来自 /csrf 或同名 Cookie）
     3) 请求体一律 JSON，Content-Type: application/json
   另外：
     - accessToken 只放内存，不落 localStorage / Cookie
     - 每个请求带 X-Request-Id；写请求可带 Idempotency-Key
     - 只有 401 且已持有 accessToken 时刷新一次并重试一次
     - 跨域白名单只信任 http://127.0.0.1:5173 与 http://localhost:5173，
       所以页面必须从 5173 端口打开，否则浏览器会挡在 CORS 之前
   ========================================================================== */
(function () {
  "use strict";

  var accessToken = null;
  var refreshPromise = null;
  var csrfToken = null;         /* 内存副本 */
  var csrfPromise = null;       /* 并发去重 */
  var csrfChecked = false;

  function base() {
    return String(window.ZHJ_API_BASE || "").replace(/\/+$/, "");
  }

  function uuid() {
    try { return crypto.randomUUID(); } catch (e) { return "req_" + Date.now() + "_" + Math.random().toString(16).slice(2); }
  }

  /* /csrf 可能在 BASE 下，也可能在 /api 根下（BASE 去掉 /v1），两处都试 */
  function csrfCandidates() {
    var b = base();
    var list = [b + "/csrf"];
    var apibase = b.replace(/\/v\d+$/, "");
    if (apibase !== b) list.push(apibase + "/csrf");
    return list;
  }

  function readCookie() {
    var names = ["zhj_csrf", "csrfToken", "csrf_token", "XSRF-TOKEN", "csrf"];
    var jar = document.cookie ? document.cookie.split(";") : [];
    for (var i = 0; i < names.length; i++) {
      var prefix = names[i] + "=";
      for (var j = 0; j < jar.length; j++) {
        var item = jar[j].trim();
        if (item.indexOf(prefix) === 0) {
          try { return decodeURIComponent(item.slice(prefix.length)); } catch (e) { return item.slice(prefix.length); }
        }
      }
    }
    return "";
  }

  function pickToken(body) {
    if (!body) return "";
    var d = body.data !== undefined ? body.data : body;
    if (typeof d === "string") return d;
    if (!d || typeof d !== "object") return "";
    return d.csrfToken || d.csrf_token || d.token || d.csrf || "";
  }

  /* 取 CSRF：先内存 → 再 Cookie → 最后打 /csrf。失败不抛错，只是没有 token。 */
  function ensureCsrf(force) {
    if (!force && csrfToken) return Promise.resolve(csrfToken);
    if (!force && csrfChecked) {
      var fromCookie = readCookie();
      if (fromCookie) { csrfToken = fromCookie; return Promise.resolve(csrfToken); }
      return Promise.resolve("");
    }
    if (csrfPromise) return csrfPromise;

    var list = csrfCandidates();
    var i = 0;
    function next() {
      if (i >= list.length) {
        csrfChecked = true;
        csrfToken = readCookie() || "";
        return csrfToken;
      }
      var url = list[i++];
      return fetch(url, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json", "X-Request-Id": uuid() }
      }).then(function (res) {
        return res.text().then(function (text) {
          var body = {};
          try { body = JSON.parse(text) || {}; } catch (e) { body = {}; }
          var token = pickToken(body) || readCookie();
          if (token) { csrfChecked = true; csrfToken = token; return token; }
          return next();
        });
      }).catch(function () { return next(); });
    }

    csrfPromise = next().finally(function () {
      csrfPromise = null;
      csrfChecked = true;
    });
    return csrfPromise;
  }

  /* 后端在 register/login/logout/refresh 之后会轮换 zhj_csrf Cookie，
     跨端口读不到该 Cookie，只能重新打一次 /csrf 拿新值 */
  function invalidateCsrf() { csrfToken = ""; csrfChecked = false; }

  function headers(init, extra) {
    var h = { "X-Request-Id": uuid(), Accept: "application/json" };
    if (init && init.body && !(init.body instanceof FormData)) h["Content-Type"] = "application/json";
    if (accessToken) h.Authorization = "Bearer " + accessToken;
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) h[k] = extra[k];
    return h;
  }

  function refreshSession() {
    if (!refreshPromise) {
      refreshPromise = ensureCsrf().then(function (csrf) {
        var h = { "X-Request-Id": uuid(), Accept: "application/json" };
        if (csrf) h["X-CSRF-Token"] = csrf;
        return fetch(base() + "/auth/refresh", { method: "POST", credentials: "include", headers: h });
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          if (!r.ok) { accessToken = null; throw new Error((body && body.code) || "REFRESH_FAILED"); }
          var d = (body && body.data) || {};
          accessToken = d.accessToken || d.access_token || null;
          window.__zhjUser = d.user || null;
          return d;
        });
      }).finally(function () { refreshPromise = null; invalidateCsrf(); });
    }
    return refreshPromise;
  }

  function request(path, options) {
    var opts = options || {};
    var method = (opts.method || "GET").toUpperCase();
    var retry = opts.retryOnExpired !== false;
    var isWrite = method !== "GET" && method !== "HEAD";

    var prep = opts.csrf === false ? Promise.resolve("") : ensureCsrf();

    return prep.then(function (csrf) {
      var extra = Object.assign({}, opts.headers || {});
      if (opts.idempotencyKey) extra["Idempotency-Key"] = opts.idempotencyKey;
      if (isWrite && csrf) extra["X-CSRF-Token"] = csrf;

      var init = { method: method, credentials: "include", headers: headers(opts, extra) };
      if (opts.body !== undefined && opts.body !== null) {
        init.body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
      }

      return fetch(base() + path, init).then(function (res) {
        if (res.status === 401 && retry && accessToken) {
          accessToken = null;
          return refreshSession()
            .then(function () { return request(path, Object.assign({}, opts, { retryOnExpired: false })); })
            .catch(function () { return res; });   /* 刷新也失败就把这个 401 原样交回上层 */
        }
        return res;
      });
    });
  }

  function json(path, options) {
    return request(path, options).then(function (res) {
      return res.text().then(function (text) {
        var body = {};
        try { body = text ? JSON.parse(text) : {}; } catch (e) { body = { raw: text }; }
        /* 后端在 /csrf、register、refresh、logout 之后都会轮换 CSRF，跨端口读不到 Cookie，
           所以一律以响应 JSON 里的 data.csrfToken 为准 */
        if (body && body.data && body.data.csrfToken) { csrfToken = body.data.csrfToken; csrfChecked = true; }
        /* 后端有的接口用 message、有的用 msg（例如 CSRF_FAILED），统一出一个 message 供上层显示 */
        if (body && !body.message && body.msg) { body.message = body.msg; }
        return { ok: res.ok, status: res.status, body: body };
      }).catch(function () { return { ok: res.ok, status: res.status, body: {} }; });
    });
  }

  /* 探活：先试 /auth/me（真实路由，未登录给 401 也算通），再退回根路径 */
  function ping(target) {
    var root = String(target || base()).replace(/\/+$/, "");
    var clock = function () { return (window.performance && performance.now) ? performance.now() : Date.now(); };
    var started = clock();

    function once(url) {
      return fetch(url, { method: "GET", credentials: "include", headers: { "X-Request-Id": uuid(), Accept: "application/json" } })
        .then(function (res) {
          return res.text().catch(function () { return ""; }).then(function (text) {
            var code = "";
            try { code = (JSON.parse(text) || {}).code || ""; } catch (e) { code = ""; }
            return { reachable: true, status: res.status, ms: Math.round(clock() - started), code: code };
          });
        });
    }

    return once(root + "/me").catch(function () {
      return once(root + "/").catch(function (err) {
        var cause = err && err.cause ? (err.cause.code || err.cause.message) : "";
        var hint = "";
        try { if (location.port && location.port !== "5173") hint = "（跨域白名单只信任 5173 端口，请用 http://127.0.0.1:5173 打开）"; } catch (e) {}
        return { reachable: false, status: 0, ms: 0, error: String((err && err.message) || err) + (cause ? " / " + cause : "") + hint };
      });
    });
  }

  /* 登录：{ email, password } */
  function login(email, password) {
    return json("/auth/login", { method: "POST", retryOnExpired: false, body: { email: String(email || "").trim(), password: String(password || "") } })
      .then(function (r) {
        var d = (r.body && r.body.data) || {};
        if (r.ok && (d.accessToken || d.access_token)) {
          accessToken = d.accessToken || d.access_token;
          window.__zhjUser = d.user || null;
        }
        invalidateCsrf();
        return r;
      });
  }

  /* 注册：必须带 consentVersion（后端会校验隐私规则版本） */
  var CONSENT = "2026-10";
  function register(email, password, consentVersion) {
    return json("/auth/register", {
      method: "POST",
      retryOnExpired: false,
      body: {
        email: String(email || "").trim(),
        password: String(password || ""),
        consentVersion: consentVersion || CONSENT
      }
    }).then(function (r) {
      var d = (r.body && r.body.data) || {};
      if (r.ok && (d.accessToken || d.access_token)) {
        accessToken = d.accessToken || d.access_token;
        window.__zhjUser = d.user || null;
      }
      invalidateCsrf();
      return r;
    });
  }
  function logout() { return json("/auth/logout", { method: "POST" }).then(function (r) { accessToken = null; window.__zhjUser = null; return r; }); }
  function onboarding(payload) { return json("/onboarding", { method: "POST", body: payload }); }
  function updateProfile(payload) { return json("/me/profile", { method: "PUT", body: payload }); }
  function forecast(date, days) {
    var q = [];
    if (date) q.push("date=" + encodeURIComponent(date));
    if (days) q.push("days=" + encodeURIComponent(days));
    return json("/forecast" + (q.length ? "?" + q.join("&") : ""), { method: "GET" });
  }

  function me() { return json("/me", { method: "GET" }); }

  window.zhjApi = {
    base: base,
    request: request,
    json: json,
    ping: ping,
    login: login,
    register: register,
    me: me,
    csrf: function () { return ensureCsrf(true); },
    csrfToken: function () { return csrfToken; },
    consentVersion: CONSENT,
    logout: logout,
    onboarding: onboarding,
    updateProfile: updateProfile,
    forecast: forecast,
    refreshSession: refreshSession,
    get: function (p, o) { return json(p, Object.assign({}, o, { method: "GET" })); },
    post: function (p, body, o) { return json(p, Object.assign({}, o, { method: "POST", body: body })); },
    put: function (p, body, o) { return json(p, Object.assign({}, o, { method: "PUT", body: body })); },
    patch: function (p, body, o) { return json(p, Object.assign({}, o, { method: "PATCH", body: body })); },
    del: function (p, o) { return json(p, Object.assign({}, o, { method: "DELETE" })); },
    get token() { return accessToken; },
    setToken: function (t) { accessToken = t || null; }
  };
})();
