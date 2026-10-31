/* ============================================================================
   vibe.js — 智汇金 渲染层（图标系统 + 液滴导航 + 覆盖层退场 + 抽屉拖拽）
   只读 DOM、只发真实点击，不碰任何业务函数，不改数据。
   ========================================================================== */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------ 图标系统 */

  var GLYPH = {
    "⌂": '<path d="M3.6 10.6 12 3.6l8.4 7"/><path d="M5.6 9.4V20h12.8V9.4"/>',
    "✓": '<path d="M4.6 12.6 9.6 17.6 19.4 6.8"/>',
    "✔": '<path d="M4.6 12.6 9.6 17.6 19.4 6.8"/>',
    "◇": '<path d="M12 3.4 20.6 12 12 20.6 3.4 12z"/>',
    "◉": '<circle cx="12" cy="12" r="8.3"/><circle cx="12" cy="12" r="3.1"/>',
    "↻": '<path d="M19.4 12a7.4 7.4 0 1 1-2.3-5.3"/><path d="M19.7 4.4v4.4h-4.4"/>',
    "☀": '<circle cx="12" cy="12" r="4.1"/><path d="M12 2.7v2.3M12 19v2.3M2.7 12h2.3M19 12h2.3M5.5 5.5l1.6 1.6M16.9 16.9l1.6 1.6M18.5 5.5l-1.6 1.6M7.1 16.9l-1.6 1.6"/>',
    "☼": '<circle cx="12" cy="12" r="4.1"/><path d="M12 2.7v2.3M12 19v2.3M2.7 12h2.3M19 12h2.3M5.5 5.5l1.6 1.6M16.9 16.9l1.6 1.6M18.5 5.5l-1.6 1.6M7.1 16.9l-1.6 1.6"/>',
    "☁": '<path d="M7.4 18.4h9.3a3.7 3.7 0 0 0 .3-7.3 5 5 0 0 0-9.6-1.3 4.2 4.2 0 0 0 0 8.6Z"/>',
    "⛅": '<circle cx="8.4" cy="7.6" r="2.6"/><path d="M9.2 18.4h8.7a3.5 3.5 0 0 0 .3-7 4.7 4.7 0 0 0-9-1.2 4 4 0 0 0 0 8.2Z"/>',
    "🌧": '<path d="M7.4 15.4h9.3a3.7 3.7 0 0 0 .3-7.3 5 5 0 0 0-9.6-1.3 4.2 4.2 0 0 0 0 8.6Z"/><path d="M8.6 18.2l-.7 1.9M12.2 18.2l-.7 1.9M15.8 18.2l-.7 1.9"/>',
    "⛈": '<path d="M7.4 14.6h9.3a3.7 3.7 0 0 0 .3-7.3 5 5 0 0 0-9.6-1.3 4.2 4.2 0 0 0 0 8.6Z"/><path d="M12.6 14.4 10.2 18h2.8l-1.4 3.4"/>',
    "🌫": '<path d="M3.8 9.6h16.4M5.4 13.2h13.2M3.8 16.8h11"/>',
    "＋": '<path d="M12 5.4v13.2M5.4 12h13.2"/>',
    "+": '<path d="M12 5.4v13.2M5.4 12h13.2"/>',
    "◷": '<circle cx="12" cy="12" r="8.3"/><path d="M12 7.4V12l3.3 2"/>',
    "⌃": '<path d="M6 15.2 12 8.8l6 6.4"/>',
    "⌄": '<path d="M6 9.4 12 15.6l6-6.2"/>',
    "×": '<path d="M6.6 6.6l10.8 10.8M17.4 6.6 6.6 17.4"/>',
    "✕": '<path d="M6.6 6.6l10.8 10.8M17.4 6.6 6.6 17.4"/>',
    "←": '<path d="M15 4.8 8.2 12l6.8 7.2"/>',
    "→": '<path d="M9 4.8 15.8 12 9 19.2"/>',
    "›": '<path d="M9.4 5 16.4 12l-7 7"/>',
    "‹": '<path d="M14.6 5 7.6 12l7 7"/>',
    "！": '<path d="M12 3.2v11"/><circle cx="12" cy="19.4" r="1.3"/>',
    "!": '<path d="M12 3.2v11"/><circle cx="12" cy="19.4" r="1.3"/>',
    "·": '<circle cx="12" cy="12" r="1.6"/>',
    "•••": '<circle cx="5.4" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18.6" cy="12" r="1.5"/>',
    "⋯": '<circle cx="5.4" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18.6" cy="12" r="1.5"/>',
    "☰": '<path d="M4.4 7.2h15.2M4.4 12h15.2M4.4 16.8h15.2"/>',
    "?": '<circle cx="12" cy="12" r="8.4"/><path d="M9.5 9.3a2.55 2.55 0 1 1 3.7 2.3c-.85.5-1.2 1-1.2 2"/><path d="M12 17.1h.01" stroke-width="2.6" stroke-linecap="round"/>'
  };

  // 圆点类用实心笔画更利落
  var FILLED = { "·": 1, "•••": 1, "⋯": 1, "！": 0, "!": 0 };

  function svgFor(key) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", "vibe-i");
    svg.innerHTML = GLYPH[key];
    if (FILLED[key]) {
      Array.prototype.forEach.call(svg.querySelectorAll("circle"), function (c) {
        c.setAttribute("fill", "currentColor");
        c.setAttribute("stroke", "none");
      });
    }
    return svg;
  }

  function glyphKey(text) {
    var t = String(text).replace(/[\uFE0E\uFE0F\u200D]/g, "").trim();
    if (t && Object.prototype.hasOwnProperty.call(GLYPH, t)) return t;
    return null;
  }

  function iconify(root) {
    if (!root || !root.querySelectorAll) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var tag = node.parentNode && node.parentNode.nodeName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA" || tag === "OPTION") {
          return NodeFilter.FILTER_REJECT;
        }
        return glyphKey(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var hits = [];
    while (walker.nextNode()) hits.push(walker.currentNode);
    hits.forEach(function (node) {
      var key = glyphKey(node.nodeValue);
      if (!key) return;
      var parent = node.parentNode;
      if (!parent || parent.querySelector(":scope > svg.vibe-i")) return;
      // 元素里若还有别的文字（比如「更多」），只替换纯图标节点
      var siblings = Array.prototype.filter.call(parent.childNodes, function (n) {
        return n.nodeType === 3 && n.nodeValue.trim();
      });
      if (siblings.length > 1) return;
      parent.insertBefore(svgFor(key), node);
      parent.removeChild(node);
    });
  }

  /* -------------------------------------------------- 底部导航双弹簧液滴 */

  var tabbar = document.getElementById("tabbar");
  var bead = null;
  var beadState = null;

  var W = 46;
  var H = 34;

  function tabCenter(tab) {
    var host = tab.querySelector("span") || tab;
    var r = host.getBoundingClientRect();
    var b = tabbar.getBoundingClientRect();
    return r.left + r.width / 2 - b.left;
  }

  function initBead() {
    if (!tabbar || bead) return;
    bead = document.createElement("span");
    bead.className = "vibe-bead";
    bead.setAttribute("aria-hidden", "true");
    bead.style.width = W + "px";
    bead.style.height = H + "px";
    tabbar.appendChild(bead);

    var active = tabbar.querySelector(".tab.active") || tabbar.querySelector(".tab");
    var cx = active ? tabCenter(active) : 0;
    beadState = {
      l: { x: cx - W / 2, t: cx - W / 2, v: 0 },
      r: { x: cx + W / 2, t: cx + W / 2, v: 0 },
      dir: 1,
      running: false
    };
    paint(0);
  }

  function paint(speed) {
    if (!beadState) return;
    var l = Math.min(beadState.l.x, beadState.r.x);
    var r = Math.max(beadState.l.x, beadState.r.x);
    var w = Math.max(6, r - l);
    var stretch = Math.max(0, w - W);
    var squash = Math.max(0.84, 1 - Math.min(0.16, speed * 0.00035));
    bead.style.transform = "translateX(" + l.toFixed(2) + "px) scaleY(" + squash.toFixed(3) + ")";
    bead.style.width = w.toFixed(2) + "px";
    bead.style.borderRadius = (13 + Math.min(9, stretch * 0.22)).toFixed(1) + "px";
  }

  function step(now) {
    if (!beadState) return;
    var st = beadState;
    var moving = false;
    var dt = 1 / 240;
    var front = st.dir > 0 ? st.r : st.l;
    var back = st.dir > 0 ? st.l : st.r;
    var kFront = 520, kBack = 250, zFront = 0.62, zBack = 0.74;

    var i;
    for (i = 0; i < 12; i++) {
      front.v += ((front.t - front.x) * kFront - front.v * 2 * zFront * Math.sqrt(kFront)) * dt;
      front.x += front.v * dt;
      back.v += ((back.t - back.x) * kBack - back.v * 2 * zBack * Math.sqrt(kBack)) * dt;
      back.x += back.v * dt;
      if (Math.abs(front.v) > 0.6 || Math.abs(back.v) > 0.6) moving = true;
    }

    var speed = (Math.abs(st.l.v) + Math.abs(st.r.v)) / 2;
    paint(speed);

    if (moving || Math.abs(st.l.x - st.l.t) > 0.35 || Math.abs(st.r.x - st.r.t) > 0.35) {
      requestAnimationFrame(step);
    } else {
      st.l.x = st.l.t;
      st.r.x = st.r.t;
      st.l.v = 0;
      st.r.v = 0;
      paint(0);
      st.running = false;
    }
  }

  function moveBead(tab) {
    if (!beadState || !tab) return;
    var st = beadState;
    var cx = tabCenter(tab);
    var targetL = cx - W / 2;
    var targetR = cx + W / 2;
    st.dir = targetL >= (st.l.x + st.r.x) / 2 ? 1 : -1;
    st.l.t = targetL;
    st.r.t = targetR;
    if (reduce) {
      st.l.x = targetL;
      st.r.x = targetR;
      paint(0);
      return;
    }
    if (!st.running) {
      st.running = true;
      requestAnimationFrame(step);
    }
  }

  /* --------------------------------------------- 覆盖层：进场由 CSS，退场在此 */

  var CLOSE_SEL = ".back, [data-close], .overlay-close";

  document.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest(CLOSE_SEL) : null;
    if (!btn) return;
    var overlay = btn.closest(".overlay");
    if (!overlay || overlay.hidden) return;

    if (btn.dataset.vibePass === "1") {
      delete btn.dataset.vibePass;
      return;
    }
    if (overlay.dataset.vibeLeaving === "1") return;

    e.stopPropagation();
    e.preventDefault();

    if (reduce) {
      btn.dataset.vibePass = "1";
      btn.click();
      return;
    }

    overlay.dataset.vibeLeaving = "1";
    overlay.classList.add("is-leaving");
    window.setTimeout(function () {
      overlay.classList.remove("is-leaving");
      delete overlay.dataset.vibeLeaving;
      btn.dataset.vibePass = "1";
      btn.click();
    }, 205);
  }, true);

  /* ------------------------------------------------------ 抽屉：拖拽关闭 */

  (function drawerDrag() {
    var drawer = document.getElementById("decisionDrawer");
    if (!drawer) return;
    var startX = 0, dx = 0, live = false, id = null, lastT = 0, vx = 0, lastX = 0;

    drawer.addEventListener("pointerdown", function (e) {
      if (!drawer.classList.contains("open")) return;
      if (e.target.closest("button, a, input, select, textarea")) return;
      startX = e.clientX;
      lastX = e.clientX;
      lastT = e.timeStamp;
      vx = 0;
      dx = 0;
      live = true;
      id = e.pointerId;
      try { drawer.setPointerCapture(id); } catch (err) {}
    });

    drawer.addEventListener("pointermove", function (e) {
      if (!live || e.pointerId !== id) return;
      dx = Math.min(0, e.clientX - startX);
      var dt = e.timeStamp - lastT;
      if (dt > 0) vx = (e.clientX - lastX) / dt;
      lastX = e.clientX;
      lastT = e.timeStamp;
      if (Math.abs(dx) > 4) {
        drawer.classList.add("is-dragging");
        drawer.style.transform = "translateX(" + dx + "px)";
      }
    });

    function end(e) {
      if (!live || (e && e.pointerId !== undefined && e.pointerId !== id)) return;
      live = false;
      drawer.classList.remove("is-dragging");
      var shouldClose = dx < -72 || vx < -0.55;
      if (shouldClose) {
        drawer.style.transform = "translateX(-112%)";
        window.setTimeout(function () {
          drawer.style.transform = "";
          var close = drawer.querySelector(".drawer-close");
          if (close) close.click();
        }, 260);
      } else {
        drawer.style.transform = "";
      }
      dx = 0;
      vx = 0;
    }

    drawer.addEventListener("pointerup", end);
    drawer.addEventListener("pointercancel", end);
  })();

  /* -------------------------------------------- 首屏激活：指标依次浮起 */

  function flashHome() {
    var home = document.getElementById("homeScreen");
    if (!home || !home.classList.contains("active")) return;
    home.classList.remove("is-vibe-in");
    void home.offsetWidth;
    home.classList.add("is-vibe-in");
    window.setTimeout(function () { home.classList.remove("is-vibe-in"); }, 900);
  }

  /* -------------------------------------------------------------- 启动 */

  function boot() {
    iconify(document.querySelector(".device") || document.body);

    var closeBtn = document.querySelector(".drawer-close");
    if (closeBtn && !closeBtn.getAttribute("aria-label")) closeBtn.setAttribute("aria-label", "关闭决策抽屉");

    // 图标取代字符后，给只有图形+文字的 tab 补一个明确的名字
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (tab) {
      if (tab.getAttribute("aria-label")) return;
      var label = tab.textContent.trim();
      if (label) tab.setAttribute("aria-label", label);
    });

    initBead();

    // tab 切换后接管液滴（原 WAAPI 仍跑，但被 CSS 隐藏）
    document.addEventListener("click", function (e) {
      var tab = e.target.closest ? e.target.closest(".tab") : null;
      if (!tab) return;
      window.setTimeout(function () { moveBead(tab); }, 0);
    }, true);

    var home = document.getElementById("homeScreen");
    if (home) {
      var wasActive = home.classList.contains("active");
      new MutationObserver(function () {
        var now = home.classList.contains("active");
        if (now && !wasActive) flashHome();
        wasActive = now;
      }).observe(home, { attributes: true, attributeFilter: ["class"] });
      if (wasActive) flashHome();
    }

    // 动态内容（任务、列表、天气图标）持续挂图标
    var pending = null;
    var device = document.getElementById("appShell") || document.querySelector(".device") || document.body;
    new MutationObserver(function (records) {
      var needsIcon = false;
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.type === "characterData") {
          if (r.target && glyphKey(r.target.nodeValue)) needsIcon = true;
        } else {
          Array.prototype.forEach.call(r.addedNodes, function (n) {
            if (n.nodeType === 1 && !n.classList.contains("vibe-i")) needsIcon = true;
            if (n.nodeType === 3 && glyphKey(n.nodeValue)) needsIcon = true;
          });
        }
        if (needsIcon) break;
      }
      if (!needsIcon || pending) return;
      pending = requestAnimationFrame(function () {
        pending = null;
        iconify(device);
      });
    }).observe(device, {
      childList: true,
      subtree: true,
      characterData: true
    });

    // ——— 分段面板高度跟随：切换时高度形变，而不是留一个空盒子 ———
    var segView = document.getElementById("segmentViewport");
    var segTabs = document.getElementById("segmentTabs");
    var segTrack = document.getElementById("segmentTrack");
    function sizeSegment() {
      if (!segView || !segTrack || !segTabs) return;
      var tabs = segTabs.querySelectorAll("[role='tab']");
      var idx = 0;
      for (var i = 0; i < tabs.length; i++) {
        if (tabs[i].classList.contains("active")) { idx = i; break; }
      }
      var panel = segTrack.children[idx];
      if (!panel) return;
      var h = Math.round(panel.getBoundingClientRect().height);
      if (h > 0 && segView.style.height !== h + "px") segView.style.height = h + "px";
    }
    sizeSegment();
    if (segTabs) {
      var segPrev = segTabs.querySelector("[role='tab'].active");
      new MutationObserver(function () {
        var cur = segTabs.querySelector("[role='tab'].active");
        if (cur === segPrev) return;
        segPrev = cur;
        sizeSegment();
      }).observe(segTabs, { subtree: true, attributes: true, attributeFilter: ["class"] });
    }

    // ——— 桌面档：机身是滚动容器，把它的滚动状态映射回 window ———
    // 原页面的吸顶标题、顶栏毛玻璃、海报视差都读 window.scrollY / window 的 scroll 事件。
    // 这里只做「转发」，不复制它们的任何算法。
    var nativeScrollY = (function () {
      try {
        var desc = Object.getOwnPropertyDescriptor(Window.prototype, "scrollY");
        return desc && desc.get ? desc.get.bind(window) : null;
      } catch (e) {
        return null;
      }
    })();
    try {
      Object.defineProperty(window, "scrollY", {
        configurable: true,
        get: function () {
          var inner = device ? device.scrollTop : 0;
          return inner > 0 ? inner : nativeScrollY ? nativeScrollY() : 0;
        }
      });
    } catch (e) {}

    var scrollTick = 0;
    var topbarEl = document.querySelector(".topbar");
    if (device) {
      device.addEventListener("scroll", function () {
        if (topbarEl) topbarEl.classList.toggle("is-scrolled", device.scrollTop > 10);
        if (scrollTick) return;
        scrollTick = requestAnimationFrame(function () {
          scrollTick = 0;
          window.dispatchEvent(new Event("scroll"));
        });
      }, { passive: true });
    }

    // 窗口变化时重新对位
    window.addEventListener("resize", function () {
      sizeSegment();
      var active = tabbar && tabbar.querySelector(".tab.active");
      if (active && beadState) {
        var cx = tabCenter(active);
        beadState.l.x = beadState.l.t = cx - W / 2;
        beadState.r.x = beadState.r.t = cx + W / 2;
        paint(0);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

/* ============================================================================
   视觉层 2.0 —— 开场墨线／极光＋颗粒／按下涟漪与墨点粒子／天气意象／滚动揭示
   全部是新增的装饰层：只读 DOM、只加/删自己创建的节点与类名，不改业务逻辑，
   不拦截任何点击（开场与粒子层均为 pointer-events:none）。
   ========================================================================== */
(function () {
  "use strict";

  var doc = document;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var app = doc.getElementById("appShell") || doc.querySelector(".device");

  /* ---------------------------------------------------------------- 舞台 */

  function stage() {
    if (reduce || doc.querySelector(".vibe-aurora")) return;
    var aurora = doc.createElement("div");
    aurora.className = "vibe-aurora";
    aurora.setAttribute("aria-hidden", "true");
    aurora.innerHTML = "<i></i><i></i><i></i>";
    doc.body.appendChild(aurora);
    var grain = doc.createElement("div");
    grain.className = "vibe-grain";
    grain.setAttribute("aria-hidden", "true");
    doc.body.appendChild(grain);
  }

  /* ------------------------------------------------------------ 粒子画布 */

  var canvas = null, ctx = null, parts = [], raf = 0, dpr = 1;
  var COLORS = ["#7fe3c0", "#f4c13c", "#f7f9f3", "#0d6e5b"];

  function ensureCanvas() {
    if (canvas) return;
    canvas = doc.createElement("canvas");
    canvas.className = "vibe-canvas";
    canvas.setAttribute("aria-hidden", "true");
    doc.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize, { passive: true });
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
  }

  function burst(x, y, count, spread, speed) {
    if (reduce) return;
    ensureCanvas();
    count = count || 9;
    spread = spread || Math.PI * 2;
    speed = speed || 2.6;
    for (var i = 0; i < count; i++) {
      var a = -Math.PI / 2 + (Math.random() - 0.5) * spread;
      var v = speed * (0.55 + Math.random() * 0.9);
      parts.push({
        x: x, y: y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 0.6,
        r: 1.1 + Math.random() * 2.3,
        life: 1,
        decay: 0.014 + Math.random() * 0.012,
        color: COLORS[(Math.random() * COLORS.length) | 0]
      });
    }
    if (parts.length > 320) parts.splice(0, parts.length - 320);
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function tick() {
    raf = 0;
    if (!ctx || !canvas) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.085;
      p.vx *= 0.985;
      p.life -= p.decay;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life) * 0.9;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.5 + p.life * 0.7), 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (parts.length) raf = requestAnimationFrame(tick);
    else { parts.length = 0; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  function ripple(el, x, y) {
    if (reduce || !el) return;
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    var size = Math.max(64, Math.min(180, Math.round(Math.max(el.offsetWidth, el.offsetHeight) * 1.5)));
    var span = doc.createElement("span");
    span.className = "vibe-ripple" + (el.matches(".primary, .tab.active, .record-tab.active") ? "" : " vibe-ripple--ink");
    span.style.width = span.style.height = size + "px";
    span.style.left = (x - el.getBoundingClientRect().left) + "px";
    span.style.top = (y - el.getBoundingClientRect().top) + "px";
    if (el.firstChild) el.insertBefore(span, el.firstChild);
    else el.appendChild(span);
    setTimeout(function () { if (span.parentNode) span.parentNode.removeChild(span); }, 560);
  }

  function pressFeedback(event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var el = target.closest('button, .tab, .quick, .chip, [role="tab"], .record-tab, .weather-card[role="button"]');
    if (!el || el.disabled) return;
    ripple(el, event.clientX, event.clientY);
    burst(event.clientX, event.clientY, el.matches(".primary, .tab, .quick") ? 11 : 7, Math.PI * 1.25, 2.9);
  }

  /* -------------------------------------------------------------- 天气意象 */

  function paintSky() {
    var cards = doc.querySelectorAll(".weather-card");
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (card.querySelector(".vibe-sky")) continue;
      var sky = doc.createElement("div");
      sky.className = "vibe-sky";
      sky.setAttribute("aria-hidden", "true");
      sky.innerHTML =
        '<div class="vibe-sky__sun"></div>' +
        '<div class="vibe-sky__cloud"></div>' +
        '<div class="vibe-sky__cloud"></div>' +
        '<div class="vibe-sky__rain"></div>' +
        '<svg class="vibe-sky__arcs" viewBox="0 0 400 140" preserveAspectRatio="none">' +
        '<path d="M-10 116C70 86 150 92 210 74S340 40 410 58"/>' +
        '<path d="M-10 132C80 106 150 112 216 96S348 66 410 82"/>' +
        "</svg>";
      card.insertBefore(sky, card.firstChild);
    }
  }

  /* -------------------------------------------------------------- 滚动揭示 */

  var revealed = new WeakSet();
  var io = null;

  function revealTargets(root) {
    var nodes = (root || doc).querySelectorAll(
      ".card, .task, .quick, .settlement, .insight-switcher, .section-head, .safety-mini, .rel, .record-form > label, .quick-grid"
    );
    return nodes;
  }

  function watchReveal(root) {
    if (reduce) return;
    if (!("IntersectionObserver" in window)) return;
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          if (!e.isIntersecting) continue;
          var el = e.target;
          io.unobserve(el);
          var delay = Number(el.getAttribute("data-vibe-delay") || 0);
          setTimeout(function (node) {
            return function () { node.classList.add("is-in"); };
          }(el), delay);
        }
      }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    }
    var nodes = revealTargets(root);
    var idx = 0;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (revealed.has(el) || el.closest(".overlay, .sheet, #recordModal")) continue;
      revealed.add(el);
      el.classList.add("vibe-reveal");
      el.setAttribute("data-vibe-delay", String((idx++ % 6) * 45));
      io.observe(el);
    }
  }

  /* ---------------------------------------------------- 开场：墨线 + 压印 */

  function splash(done) {
    var root = doc.documentElement;
    if (reduce) { if (done) done(); return; }
    root.classList.add("vibe-splashing");

    var layer = doc.createElement("div");
    layer.className = "vibe-splash";
    layer.setAttribute("aria-hidden", "true");
    var chars = "智汇金".split("").map(function (ch, i) {
      return '<span style="animation-delay:' + (0.22 + i * 0.075) + 's">' + ch + "</span>";
    }).join("");
    layer.innerHTML =
      '<div class="vibe-splash__inner">' +
      '<svg class="vibe-splash__cross" viewBox="0 0 200 120" aria-hidden="true">' +
      '<path d="M100 8V112" pathLength="120"/>' +
      '<path d="M22 60H178" pathLength="120"/>' +
      '<path d="M84 44h32v32H84z" pathLength="120"/>' +
      "</svg>" +
      '<div class="vibe-splash__halo" aria-hidden="true"></div>' +
      '<div class="vibe-splash__word">' + chars + "</div>" +
      '<div class="vibe-splash__kicker"></div>' +
      '<div class="vibe-splash__rule"></div>' +
      "</div>";
    doc.body.appendChild(layer);

    // 打字机副标
    var kicker = layer.querySelector(".vibe-splash__kicker");
    var text = "钱 包 天 气 预 报";
    var n = 0;
    var typer = setInterval(function () {
      n++;
      kicker.textContent = text.slice(0, n);
      if (n >= text.length) clearInterval(typer);
    }, 42);

    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      clearInterval(typer);
      layer.classList.add("is-out");
      root.classList.remove("vibe-splashing");
      setTimeout(function () {
        if (layer.parentNode) layer.parentNode.removeChild(layer);
        if (done) done();
      }, 470);
    }
    setTimeout(finish, 1180);
    // 兜底：任何异常都不该把页面藏起来
    setTimeout(function () {
      root.classList.remove("vibe-splashing");
      if (layer.parentNode && finished) layer.parentNode.removeChild(layer);
    }, 3000);
  }

  /* --------------------------------------------------- 完成后冒一粒墨点 */

  var taskState = new Map();

  function scanTasks() {
    var list = doc.querySelectorAll(".task");
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      var id = (el.querySelector("[data-task]") || el).getAttribute("data-task") || el.className + i;
      var done = el.classList.contains("done");
      var prev = taskState.get(id);
      taskState.set(id, done);
      if (prev === false && done && !reduce) {
        var box = el.querySelector(".task-check") || el;
        var r = box.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, 14, Math.PI * 1.6, 3.2);
      }
    }
  }

  /* ---------------------------------------------------------------- boot */

  function boot2() {
    stage();
    paintSky();

    splash(function () {
      watchReveal(doc);
      // 首屏可见的卡片直接一口气揭示
      var first = doc.querySelector(".screen.active");
      if (first) {
        var kids = first.querySelectorAll(".vibe-reveal");
        for (var i = 0; i < kids.length; i++) {
          (function (el, i) {
            setTimeout(function () { el.classList.add("is-in"); }, 60 + i * 45);
          })(kids[i], i);
        }
      }
    });

    doc.addEventListener("pointerdown", pressFeedback, { passive: true });

    // 屏幕切换后补揭示 + 天气卡重渲染后补意象
    var lastActive = null;
    var mo = new MutationObserver(function () {
      var active = doc.querySelector(".screen.active");
      if (active && active !== lastActive) {
        lastActive = active;
        watchReveal(active);
        paintSky();
        var kids = active.querySelectorAll(".vibe-reveal");
        for (var i = 0; i < kids.length; i++) {
          (function (el, i) {
            setTimeout(function () { el.classList.add("is-in"); }, 40 + i * 40);
          })(kids[i], i);
        }
      }
      scanTasks();
    });
    mo.observe(doc.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"]
    });

    scanTasks();

    if (app) {
      app.addEventListener("scroll", function () {
        if (app.scrollTop > 4 && !doc.body.classList.contains("vibe-scrolled")) {
          doc.body.classList.add("vibe-scrolled");
        }
      }, { passive: true });
    }
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", boot2);
  } else {
    boot2();
  }
})();

/* ============================================================================
   17b 底部导航：接管液滴定位（原双层弹簧在桌面档实测落点偏移约 68px）
   —— 隐藏旧 bead，自建一枚用 offsetLeft 计算、CSS 缓动过渡的胶囊，
      位置只由「当前激活 tab 的中心」决定，不依赖任何矩形换算。
   ========================================================================== */
(function () {
  "use strict";
  var doc = document;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W = 46, H = 34;

  function boot() {
    var bar = doc.getElementById("tabbar");
    if (!bar) return;

    // 旧 bead 全部隐藏（它们仍在跑弹簧，但不再可见）
    [].forEach.call(doc.querySelectorAll(".vibe-bead, #tabInk"), function (el) {
      el.classList.add("vibe-bead--off");
    });

    var bead = doc.createElement("span");
    bead.className = "vibe-bead-sync";
    bead.setAttribute("aria-hidden", "true");
    bar.appendChild(bead);

    function tabs() {
      return [].slice.call(bar.querySelectorAll(".tab"));
    }

    function place(animate) {
      var list = tabs();
      if (!list.length) return;
      var act = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i].classList.contains("active")) act = list[i];
      }
      if (!act) act = list[0];
      // 相对 tabbar 内容坐标：offsetLeft 已含 padding
      var center = act.offsetLeft + act.offsetWidth / 2;
      var x = center - W / 2;
      if (!animate) bead.style.transition = "none";
      bead.style.transform = "translateX(" + x + "px)";
      if (!animate) {
        // 强制回流后再恢复过渡
        void bead.offsetWidth;
        bead.style.transition = "";
      }
    }

    place(false);

    var lastActive = null;
    function sync() {
      var list = tabs();
      var cur = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i].classList.contains("active")) cur = list[i];
      }
      if (cur && cur !== lastActive) {
        lastActive = cur;
        place(true);
      }
    }

    // 点击后立刻同步一次，并在过渡期内再对几次（防止原逻辑改 class 的时机晚于 click）
    bar.addEventListener("click", function () {
      requestAnimationFrame(sync);
      setTimeout(sync, 40);
      setTimeout(sync, 120);
      setTimeout(sync, 320);
    }, true);

    var mo = new MutationObserver(function () { sync(); });
    mo.observe(bar, { subtree: true, attributes: true, attributeFilter: ["class"] });

    window.addEventListener("resize", function () { place(false); }, { passive: true });
    var ticks = 0;
    var iv = setInterval(function () {
      place(false);
      if (++ticks > 6) clearInterval(iv);
    }, 700);

    if (reduce) {
      bead.style.transition = "none";
    }
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

/* ============================================================================
   20 曲线动起来：线条描画 + 沿路径跑的发光点 + 数据点依次弹起
   —— 只读 #balanceChart 的 DOM，自己加一层装饰，不改原 SVG 结构
   ========================================================================== */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var doc = document;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function strokePaths(svg) {
    var out = [];
    var list = svg.querySelectorAll("path");
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var cs = getComputedStyle(p);
      var w = parseFloat(cs.strokeWidth) || 0;
      if (w > 0 && cs.stroke !== "none" && cs.stroke !== "rgba(0, 0, 0, 0)") out.push(p);
    }
    return out;
  }

  function traveller(svg, path) {
    var old = svg.querySelector(".vibe-chart-dot");
    if (old) old.remove();
    if (reduce) return;
    if (!path.id) path.id = "vibeBalancePath";
    var dot = doc.createElementNS(NS, "circle");
    dot.setAttribute("r", "3.6");
    dot.setAttribute("class", "vibe-chart-dot");
    var anim = doc.createElementNS(NS, "animateMotion");
    anim.setAttribute("dur", "6.2s");
    anim.setAttribute("repeatCount", "indefinite");
    anim.setAttribute("rotate", "auto");
    var mpath = doc.createElementNS(NS, "mpath");
    mpath.setAttributeNS("http://www.w3.org/1999/xlink", "href", "#" + path.id);
    anim.appendChild(mpath);
    dot.appendChild(anim);
    svg.appendChild(dot);
    // 起点先藏起来，等描画结束再露出
    dot.style.opacity = "0";
    setTimeout(function () { dot.style.transition = "opacity .5s ease"; dot.style.opacity = "1"; }, 900);
  }

  function drawOnce() {
    var svg = doc.getElementById("balanceChart");
    if (!svg || svg.dataset.vibeDrawn === "1") return;
    var paths = strokePaths(svg);
    if (!paths.length) return;
    svg.dataset.vibeDrawn = "1";
    svg.dataset.vibeSig = (paths[0] && paths[0].getAttribute("d") || "").slice(0, 200);
    if (reduce) {
      traveller(svg, paths[paths.length - 1]);
      return;
    }
    paths.forEach(function (p, i) {
      var len = 0;
      try { len = p.getTotalLength(); } catch (e) { len = 0; }
      if (!len) return;
      p.style.strokeDasharray = len + " " + len;
      p.style.strokeDashoffset = String(len);
      p.style.transition = "stroke-dashoffset 1.15s cubic-bezier(.22,.8,.24,1) " + (i * 60) + "ms";
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { p.style.strokeDashoffset = "0"; });
      });
    });
    // 面积层（填充无描边）淡入
    var fills = svg.querySelectorAll("path");
    for (var k = 0; k < fills.length; k++) {
      var q = fills[k];
      if (paths.indexOf(q) !== -1) continue;
      q.style.opacity = "0";
      (function (node) {
        setTimeout(function () {
          node.style.transition = "opacity .7s ease";
          node.style.opacity = "";
        }, 260);
      })(q);
    }
    // 数据点依次弹起
    var dots = svg.querySelectorAll("circle:not(.vibe-chart-dot)");
    for (var d = 0; d < dots.length; d++) {
      var c = dots[d];
      c.style.transformBox = "fill-box";
      c.style.transformOrigin = "center";
      c.style.transform = "scale(0)";
      c.style.transition = "transform .42s cubic-bezier(.22,1.4,.4,1) " + (420 + d * 70) + "ms";
      (function (node) {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { node.style.transform = "scale(1)"; });
        });
      })(c);
    }
    traveller(svg, paths[paths.length - 1]);
  }

  function reset() {
    var svg = doc.getElementById("balanceChart");
    if (!svg) return;
    delete svg.dataset.vibeDrawn;
    var old = svg.querySelector(".vibe-chart-dot");
    if (old) old.remove();
    var all = svg.querySelectorAll("path, circle");
    for (var i = 0; i < all.length; i++) {
      all[i].style.transition = "";
      all[i].style.strokeDasharray = "";
      all[i].style.strokeDashoffset = "";
      all[i].style.transform = "";
      all[i].style.opacity = "";
    }
  }

  function boot() {
    setTimeout(drawOnce, 260);

    // 屏幕切到首页时若曲线重绘过，重新描一次
    var lastActive = null;
    var timer = 0;
    var mo = new MutationObserver(function () {
      var act = doc.querySelector(".screen.active");
      if (act === lastActive) return;
      lastActive = act;
      if (!act || act.id !== "homeScreen") return;
      clearTimeout(timer);
      timer = setTimeout(function () { reset(); drawOnce(); }, 240);
    });
    mo.observe(doc.body, { subtree: true, attributes: true, attributeFilter: ["class"] });

    // 图表数据更新（原页重绘 SVG）时重新描画：按主曲线 d 值做签名，避免自己写的装饰反过来触发自己
    var svgHost = doc.getElementById("chartCard");
    if (svgHost) {
      var re = 0;
      new MutationObserver(function () {
        var svg = doc.getElementById("balanceChart");
        if (!svg) return;
        var main = svg.querySelector("path:not(.vibe-chart-pulse)");
        var sig = main ? (main.getAttribute("d") || "").slice(0, 200) : "";
        if (svg.dataset.vibeSig === sig) return;
        clearTimeout(re);
        re = setTimeout(function () {
          var node = doc.getElementById("balanceChart");
          if (!node) return;
          node.dataset.vibeSig = sig;
          reset();
          drawOnce();
        }, 180);
      }).observe(svgHost, { subtree: true, childList: true });
    }
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

/* ============================================================================
   21 曲线流光：克隆描边路径做一段沿曲线跑的薄荷高光（纯 CSS 动画，稳定可预期）
   ========================================================================== */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var doc = document;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function build() {
    var svg = doc.getElementById("balanceChart");
    if (!svg) return;
    if (reduce) return;
    var main = svg.querySelector("path:not(.vibe-chart-pulse)");
    var sig = main ? (main.getAttribute("d") || "").slice(0, 200) : "";
    var existing = svg.querySelector(".vibe-chart-pulse");
    if (existing) {
      if (svg.dataset.vibePulseSig === sig) return;
      existing.remove();
    }
    svg.dataset.vibePulseSig = sig;

    var list = svg.querySelectorAll("path");
    var target = null;
    for (var i = 0; i < list.length; i++) {
      var cs = getComputedStyle(list[i]);
      if ((parseFloat(cs.strokeWidth) || 0) > 0 && cs.stroke !== "none") target = list[i];
    }
    if (!target) return;
    var len = 0;
    try { len = target.getTotalLength(); } catch (e) { len = 0; }
    if (!len) return;

    var pulse = target.cloneNode(false);
    pulse.removeAttribute("id");
    pulse.setAttribute("class", "vibe-chart-pulse");
    pulse.setAttribute("fill", "none");
    pulse.setAttribute("stroke", "#7fe3c0");
    pulse.setAttribute("stroke-width", "3.2");
    pulse.setAttribute("stroke-linecap", "round");
    pulse.style.opacity = "1";
    pulse.style.strokeDasharray = "26 9999";
    pulse.style.setProperty("--vibe-len", len + "px");
    pulse.style.strokeDashoffset = "0";
    svg.appendChild(pulse);
  }

  function boot() {
    setTimeout(build, 1500);
    var host = doc.getElementById("chartCard");
    if (!host) return;
    var t = 0;
    new MutationObserver(function () {
      clearTimeout(t);
      t = setTimeout(build, 320);
    }).observe(host, { subtree: true, childList: true });
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

/* ============================================================================
   22 按余额比例自动换天气皮肤 + 任务完成时圆环庆典
   —— 比例来自「我的」页统计卡；换肤通过模拟点击原有「演示状态」按钮完成
   ========================================================================== */
(function () {
  "use strict";
  var doc = document;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- 金额解析 ---------------- */

  function money(text) {
    if (!text) return null;
    var m = String(text).replace(/[^0-9.\-]/g, "");
    if (!m || m === "-" || m === ".") return null;
    var v = parseFloat(m);
    return isFinite(v) ? v : null;
  }

  // 预算取「我的」页统计卡（渲染后才存在）→ 回落开局表单里的「每月生活费」输入框
  // 余额取天气卡上的「预计余额」，两条路都不依赖当前停在哪一屏
  function tiles() {
    var budget = null;
    var host = doc.getElementById("profileSummary");
    if (host) {
      var list = host.querySelectorAll(".summary-tile");
      if (list.length) {
        budget = money(list[0].querySelector("strong") && list[0].querySelector("strong").textContent);
      }
    }
    if (!budget) {
      var input = doc.getElementById("monthlyBudget");
      budget = input ? money(input.value) : null;
    }
    var balanceEl = doc.getElementById("projectedBalance");
    var balance = balanceEl ? money(balanceEl.textContent) : null;
    if (balance === null && host) {
      var l2 = host.querySelectorAll(".summary-tile");
      if (l2.length > 1) balance = money(l2[1].querySelector("strong") && l2[1].querySelector("strong").textContent);
    }
    return { budget: budget, balance: balance };
  }

  // 100%~50% 晴 / 50%~25% 多云 / 25%~0 阵雨 / 0 及以下 暴雨
  function bucketOf(ratio) {
    if (!isFinite(ratio)) return null;
    if (ratio >= 0.5) return "sunny";
    if (ratio >= 0.25) return "cloudy";
    if (ratio > 0) return "rain";
    return "storm";
  }

  var applied = null;

  // 只换皮肤类，不点「演示状态」按钮：那四个按钮会重置余额与注入示例事件，属于数据层
  function switchWeather(kind) {
    if (!kind || kind === applied) return;
    var card = doc.getElementById("weatherCard");
    if (!card) return;
    applied = kind;
    paint(card, kind);
    doc.documentElement.setAttribute("data-vibe-weather", kind);
  }

  function paint(card, kind) {
    var want = "weather-" + kind;
    if (card.classList.contains(want)) return;
    card.classList.remove("weather-sunny", "weather-cloudy", "weather-rain", "weather-storm");
    card.classList.add(want);
  }

  // 原页面重算时会重写 class，这里在它之后补回当前档位
  function guardSkin() {
    var card = doc.getElementById("weatherCard");
    if (!card) return;
    new MutationObserver(function () {
      if (applied) paint(card, applied);
    }).observe(card, { attributes: true, attributeFilter: ["class"] });
  }

  function check() {
    var t = tiles();
    if (!t || !t.budget || t.budget <= 0 || t.balance === null) return;
    switchWeather(bucketOf(t.balance / t.budget));
  }

  /* ---------------- 任务完成 → 圆环庆典 ---------------- */

  function ringCelebrate() {
    var ring = doc.getElementById("todayProgress");
    if (!ring || reduce) return;
    ring.classList.remove("vibe-ring-pop");
    void ring.offsetWidth;
    ring.classList.add("vibe-ring-pop");
    setTimeout(function () { ring.classList.remove("vibe-ring-pop"); }, 900);
  }

  var lastProgress = null;

  function watchRing() {
    var ring = doc.getElementById("todayProgress");
    if (!ring) return;
    var span = ring.querySelector("span");
    var mo = new MutationObserver(function () {
      var txt = span ? span.textContent.trim() : "";
      var m = /(\d+)\s*\/\s*(\d+)/.exec(txt);
      if (!m) return;
      var done = parseInt(m[1], 10);
      if (lastProgress !== null && done > lastProgress) ringCelebrate();
      lastProgress = done;
    });
    if (span) mo.observe(span, { childList: true, characterData: true, subtree: true });
    mo.observe(ring, { attributes: true, attributeFilter: ["style"] });
  }

  /* ---------------- boot ---------------- */

  function boot() {
    guardSkin();
    check();
    setInterval(check, 1200);
    watchRing();
    // 页面数据变动后也检查一次（记账、暂停、切换演示）
    var t = 0;
    new MutationObserver(function () {
      clearTimeout(t);
      t = setTimeout(check, 600);
    }).observe(doc.body, { subtree: true, childList: true, characterData: true });
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

/* ============================================================================
   23 任务列表拖拽排序（只动 DOM 顺序，不改数据；重渲染后按记忆恢复顺序）
   ========================================================================== */
(function () {
  "use strict";
  var doc = document;
  var order = new WeakMap();

  function listOf(el) { return el.parentElement; }

  function applyOrder(list) {
    var ids = order.get(list);
    if (!ids || !ids.length) return;
    var items = Array.prototype.slice.call(list.children).filter(function (n) {
      return n.classList && n.classList.contains("task");
    });
    ids.forEach(function (id) {
      var node = items.filter(function (n) { return n.getAttribute("data-task") === id; })[0];
      if (node) list.appendChild(node);
    });
  }

  function remember(list) {
    var ids = Array.prototype.slice.call(list.children)
      .filter(function (n) { return n.classList && n.classList.contains("task"); })
      .map(function (n) { return n.getAttribute("data-task"); });
    order.set(list, ids);
  }

  function centerY(el) {
    var r = el.getBoundingClientRect();
    return r.top + r.height / 2;
  }

  function bind(el) {
    if (el.dataset.vibeDrag === "1") return;
    el.dataset.vibeDrag = "1";
    var startY = 0, dragging = false, moved = false, list = null;

    el.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (e.target.closest(".task-action, .task-check")) return;
      startY = e.clientY;
      dragging = false;
      moved = false;
      list = listOf(el);
    });

    el.addEventListener("pointermove", function (e) {
      if (!list) return;
      var dy = e.clientY - startY;
      if (!dragging) {
        if (Math.abs(dy) < 8) return;
        dragging = true;
        moved = true;
        el.classList.add("is-dragging");
        list.classList.add("is-sorting");
        try { el.setPointerCapture(e.pointerId); } catch (err) {}
      }
      e.preventDefault();
      el.style.transform = "translateY(" + dy + "px)";
      var cy = centerY(el);
      Array.prototype.slice.call(list.children).forEach(function (n) {
        if (n === el || !n.classList || !n.classList.contains("task")) return;
        var r = n.getBoundingClientRect();
        var mid = r.top + r.height / 2;
        var mark = (cy < mid) ? (cy > mid - r.height * .5) : false;
        n.classList.toggle("is-drop", mark);
      });
    });

    function end(e) {
      if (!list) return;
      var dy = e.clientY - startY;
      if (dragging) {
        el.style.transform = "";
        el.classList.remove("is-dragging");
        list.classList.remove("is-sorting");
        Array.prototype.slice.call(list.children).forEach(function (n) {
          if (n.classList) n.classList.remove("is-drop");
        });
        var items = Array.prototype.slice.call(list.children).filter(function (n) {
          return n.classList && n.classList.contains("task") && n !== el;
        });
        var target = null;
        for (var i = 0; i < items.length; i++) {
          if (dy < 0 && centerY(items[i]) > startY) { target = items[i]; break; }
        }
        if (dy > 0) {
          for (var j = items.length - 1; j >= 0; j--) {
            if (centerY(items[j]) < startY) { target = items[j].nextSibling; break; }
          }
        }
        if (target === null) target = items.length ? (dy < 0 ? items[0] : null) : null;
        if (target && target !== el) list.insertBefore(el, target);
        else if (dy > 0 && items.length) list.appendChild(el);
        remember(list);
        if (moved) {
          var swallow = function (ev) { ev.stopPropagation(); ev.preventDefault(); };
          el.addEventListener("click", swallow, true);
          setTimeout(function () { el.removeEventListener("click", swallow, true); }, 60);
        }
      }
      list = null;
      dragging = false;
      startY = 0;
    }

    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  function scan() {
    ["homeTasks", "todayTasks"].forEach(function (id) {
      var list = doc.getElementById(id);
      if (!list) return;
      applyOrder(list);
      Array.prototype.slice.call(list.children).forEach(function (n) {
        if (n.classList && n.classList.contains("task")) bind(n);
      });
    });
  }

  function boot() {
    scan();
    var t = 0;
    new MutationObserver(function () {
      clearTimeout(t);
      t = setTimeout(scan, 260);
    }).observe(doc.body, { subtree: true, childList: true });
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

/* ============================================================================
   24 金融安全答题（题库来自页面内 cards）+ AI 悬浮球
   ========================================================================== */
(function () {
  "use strict";
  var doc = document;

  function bank() {
    var all = [];
    try { all = (typeof cards !== "undefined" && cards) || window.cards || []; } catch (e) { all = window.cards || []; }
    return all.filter(function (c) { return c && c.id && String(c.id).indexOf("q") === 0 && c.title; });
  }

  function shuffle(a) {
    var r = a.slice();
    for (var i = r.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = r[i]; r[i] = r[j]; r[j] = t;
    }
    return r;
  }

  var ROUND = 10;
  var state = null;

  function buildOverlay() {
    var el = doc.createElement("div");
    el.className = "vibe-quiz";
    el.innerHTML =
      '<div class="vibe-quiz__card" role="dialog" aria-modal="true" aria-label="金融安全答题">' +
        '<div class="vibe-quiz__top"><span class="vibe-quiz__step"></span>' +
        '<button class="vibe-quiz__close" type="button" aria-label="关闭答题">×</button></div>' +
        '<div class="vibe-quiz__bar"><i></i></div>' +
        '<div class="vibe-quiz__body"></div>' +
      '</div>';
    doc.body.appendChild(el);
    el.addEventListener("click", function (e) { if (e.target === el) close(); });
    el.querySelector(".vibe-quiz__close").addEventListener("click", close);
    return el;
  }

  var box = null;

  function start() {
    var pool = shuffle(bank());
    if (pool.length < 4) { return; }
    state = { items: pool.slice(0, Math.min(ROUND, pool.length)), i: 0, right: 0, locked: false };
    if (!box) box = buildOverlay();
    box.classList.add("is-on");
    render();
  }

  function close() { if (box) box.classList.remove("is-on"); state = null; }

  function render() {
    var card = box.querySelector(".vibe-quiz__card");
    if (state.i >= state.items.length) { renderEnd(); return; }
    var q = state.items[state.i];
    var right = (q.actions && q.actions[0]) || "";
    var opts = shuffle([right].concat(q.avoid || []).filter(Boolean)).slice(0, 4);
    if (opts.indexOf(right) < 0) opts[0] = right;

    box.querySelector(".vibe-quiz__step").textContent = "第 " + (state.i + 1) + " / " + state.items.length + " 题 · 得分 " + state.right;
    box.querySelector(".vibe-quiz__bar i").style.width = ((state.i) / state.items.length * 100) + "%";
    var body = box.querySelector(".vibe-quiz__body");
    body.innerHTML = '<p class="vibe-quiz__q"></p><div class="vibe-quiz__opts"></div>' +
      '<div class="vibe-quiz__why"></div><button class="vibe-quiz__next" type="button">下一题</button>';
    body.querySelector(".vibe-quiz__q").textContent = q.title;
    var optsEl = body.querySelector(".vibe-quiz__opts");
    opts.forEach(function (text) {
      var b = doc.createElement("button");
      b.type = "button";
      b.className = "vibe-quiz__opt";
      b.textContent = text;
      b.addEventListener("click", function () { answer(b, text === right, q); });
      optsEl.appendChild(b);
    });
    card.style.transform = "translateY(6px)"; card.style.opacity = "0";
    requestAnimationFrame(function () { card.style.transform = ""; card.style.opacity = "1"; });
  }

  function answer(btn, ok, q) {
    if (state.locked) return;
    state.locked = true;
    var body = box.querySelector(".vibe-quiz__body");
    Array.prototype.forEach.call(body.querySelectorAll(".vibe-quiz__opt"), function (b) {
      b.disabled = true;
      if (b.textContent === ((q.actions && q.actions[0]) || "")) b.classList.add("is-right");
    });
    if (!ok) btn.classList.add("is-wrong");
    else state.right++;
    var why = body.querySelector(".vibe-quiz__why");
    why.textContent = (ok ? "答对了。" : "正确答案已标绿。") + ((q.signals && q.signals[0]) ? " 记住：" + q.signals.join("；") : "");
    why.classList.add("is-on");
    var next = body.querySelector(".vibe-quiz__next");
    next.classList.add("is-on");
    next.textContent = (state.i === state.items.length - 1) ? "看结果" : "下一题";
    next.addEventListener("click", function () {
      state.locked = false;
      state.i++;
      render();
    });
  }

  function renderEnd() {
    var body = box.querySelector(".vibe-quiz__body");
    box.querySelector(".vibe-quiz__step").textContent = "已完成";
    box.querySelector(".vibe-quiz__bar i").style.width = "100%";
    var pct = Math.round(state.right / state.items.length * 100);
    body.innerHTML = '<div class="vibe-quiz__end"><b>' + state.right + "/" + state.items.length + '</b>' +
      '<p>' + (pct >= 80 ? "这段你已经很稳了。" : pct >= 50 ? "基本判断是对的，细节还要再过一遍。" : "先别急着用钱，把这几条信号记住。") + '</p>' +
      '<button class="vibe-quiz__next is-on" type="button">再来一轮</button></div>';
    body.querySelector(".vibe-quiz__next").addEventListener("click", function () { start(); });
  }

  function mountLauncher() {
    var safety = doc.getElementById("safetyScreen");
    if (!safety || safety.querySelector(".vibe-quiz-launch")) return;
    var host = safety.querySelector(".safety-head") || safety.firstElementChild;
    if (!host) return;
    var wrap = doc.createElement("div");
    wrap.className = "vibe-quiz-launch";
    wrap.innerHTML = '<button class="vibe-quiz-btn" type="button">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11l2 2 4-4"/><rect x="3.6" y="4.4" width="16.8" height="15.2" rx="3.2"/></svg>' +
      "开始答题 · 随机 10 题</button>";
    host.appendChild(wrap);
    wrap.querySelector("button").addEventListener("click", start);
  }

  function mountOrb() {
    if (doc.querySelector(".vibe-orb")) return;
    var orb = doc.createElement("button");
    orb.type = "button";
    orb.className = "vibe-orb";
    orb.setAttribute("aria-label", "AI 金融安全助手");
    orb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2v2.4M12 18.4v2.4M4.6 12H3M21 12h-1.6"/>' +
      '<circle cx="12" cy="12" r="4.6"/><path d="M7.8 16.2 6 18M18 6l-1.8 1.8"/></svg>';
    orb.addEventListener("click", function () {
      var trigger = doc.querySelector('[data-menu-action="assistant"],[data-action="assistant"],[data-open="assistant"],#openAssistant');
      if (trigger) { trigger.click(); return; }
      if (typeof window.openOverlay === "function") { window.openOverlay("assistantView"); return; }
      var view = doc.getElementById("assistantView");
      if (view) { view.hidden = false; }
    });
    doc.body.appendChild(orb);
    // 只在首页出现
    function sync() {
      var home = doc.getElementById("homeScreen");
      var on = home && home.classList.contains("active");
      orb.style.display = on ? "grid" : "none";
    }
    sync();
    new MutationObserver(sync).observe(doc.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  function boot() {
    mountLauncher();
    mountOrb();
    var t = 0;
    new MutationObserver(function () {
      clearTimeout(t);
      t = setTimeout(function () { mountLauncher(); mountOrb(); }, 300);
    }).observe(doc.body, { subtree: true, childList: true });
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

/* ============================================================================
   25 情景训练入口 → 直接进 100 题答题
   ========================================================================== */
(function () {
  "use strict";
  var doc = document;

  function quizButton() {
    return doc.querySelector(".vibe-quiz-btn");
  }

  function findEntry() {
    var nodes = doc.querySelectorAll("#safetyScreen button, #safetyScreen a, #safetyScreen [role='button']");
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.closest(".vibe-quiz-launch")) continue;
      var t = (n.textContent || "").replace(/\s+/g, "");
      if (t.indexOf("情景训练") === 0) return n;
    }
    return null;
  }

  function label(entry) {
    if (entry.dataset.vibeScenario === "1") return;
    entry.dataset.vibeScenario = "1";
    var small = entry.querySelector("small, span + span, .quick-sub, .tile-sub");
    var nodes = entry.querySelectorAll("span, small, p");
    for (var i = 0; i < nodes.length; i++) {
      var tx = (nodes[i].textContent || "").trim();
      if (tx && tx !== "情景训练" && tx.length < 24) { nodes[i].textContent = "从 100 题里抽 10 道"; break; }
    }
    if (!small) { /* 没有副标题就保持原样 */ }
  }

  function bind(entry) {
    if (entry.dataset.vibeScenarioBound === "1") return;
    entry.dataset.vibeScenarioBound = "1";
    label(entry);
    entry.addEventListener("click", function (e) {
      var btn = quizButton();
      if (!btn) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      btn.click();
    }, true);
  }

  function scan() {
    var entry = findEntry();
    if (entry) bind(entry);
  }

  function boot() {
    scan();
    var t = 0;
    new MutationObserver(function () {
      clearTimeout(t);
      t = setTimeout(scan, 320);
    }).observe(doc.body, { subtree: true, childList: true });
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

/* ============================================================================
   26 「我的」页 · 接口设置卡片
   ========================================================================== */
(function () {
  "use strict";
  var doc = document;

  function current() {
    return String(window.ZHJ_API_BASE || (window.zhjApi && window.zhjApi.base()) || "");
  }

  function say(box, text, tone) {
    var el = box.querySelector(".vibe-api__state");
    if (!el) return;
    el.textContent = text;
    if (tone) el.dataset.tone = tone; else delete el.dataset.tone;
  }

  function mount() {
    var screen = doc.getElementById("profileScreen");
    if (!screen || screen.querySelector(".vibe-api")) return false;

    var box = doc.createElement("section");
    box.className = "vibe-api";
    box.innerHTML =
      '<h3>接口设置</h3>' +
      '<p class="vibe-api__hint">后端 API 根地址，填写后保存会刷新页面。后端跨域白名单只信任 5173 端口，请用 http://127.0.0.1:5173 打开本页；未连后端时各页面照常可用。</p>' +
      '<input class="vibe-api__input" type="url" inputmode="url" spellcheck="false" autocomplete="off" aria-label="后端 API 根地址">' +
      '<div class="vibe-api__row">' +
        '<button class="vibe-api__btn vibe-api__btn--primary" type="button" data-act="save">保存并刷新</button>' +
        '<button class="vibe-api__btn" type="button" data-act="test">测试连接</button>' +
        '<button class="vibe-api__btn" type="button" data-act="reset">恢复默认</button>' +
      '</div>' +
      '<p class="vibe-api__state">尚未测试</p>';

    var input = box.querySelector(".vibe-api__input");
    input.value = current();

    box.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-act]");
      if (!btn) return;
      var act = btn.dataset.act;

      if (act === "save") {
        var next = window.zhjSetApiBase ? window.zhjSetApiBase(input.value) : input.value;
        input.value = next;
        say(box, "已保存 " + next + "，正在刷新…");
        setTimeout(function () { location.reload(); }, 420);
        return;
      }

      if (act === "reset") {
        var base = window.zhjResetApiBase ? window.zhjResetApiBase() : "";
        input.value = base;
        say(box, "已恢复默认：" + base, "ok");
        return;
      }

      if (act === "test") {
        var target = (input.value || "").trim();
        if (!target) { say(box, "先填一个地址再测试", "bad"); return; }
        say(box, "正在连接 " + target + " …");
        if (!window.zhjApi) { say(box, "请求层没加载（api.js 缺失）", "bad"); return; }
        window.zhjApi.ping(target).then(function (r) {
          if (r.reachable) {
            var ok2xx = r.status >= 200 && r.status < 300;
            say(box, (ok2xx ? "连接成功" : "服务已响应") + "：HTTP " + r.status + " · " + r.ms + "ms" + (r.code ? " · " + r.code : ""), ok2xx ? "ok" : "bad");
          } else {
            say(box, "连不上：确认后端已启动、端口正确，且已为本页开放 CORS（" + (r.error || "network error") + "）", "bad");
          }
        });
      }
    });

    screen.appendChild(box);
    return true;
  }

  function boot() {
    /* 默认隐藏「接口设置」：只在带 ?dev=1 时挂出来，普通用户看不到 */
    if (!/[?&]dev=1\b/.test(location.search)) return;
    if (mount()) return;
    var t = 0;
    new MutationObserver(function () {
      clearTimeout(t);
      t = setTimeout(mount, 320);
    }).observe(doc.body, { subtree: true, childList: true });
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

/* ============================================================================
   28 收尾修补：日历滚动到可视区 / 金额上限纠正 / 暂停面板复位
   ========================================================================== */
(function () {
  "use strict";
  var doc = document;

  function revealCalendar() {
    var field = doc.getElementById("dateField");
    if (!field || !field.classList.contains("open")) return;
    var pop = doc.getElementById("calendarPopover");
    if (!pop) return;
    try { pop.scrollIntoView({ block: "center", behavior: "smooth" }); }
    catch (err) { pop.scrollIntoView(false); }
  }

  doc.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest || !target.closest("#dateTrigger")) return;
    setTimeout(revealCalendar, 90);
    setTimeout(revealCalendar, 430);
  }, true);

  function clampAmount(el) {
    if (!el || el.tagName !== "INPUT" || el.type !== "number") return;
    var max = Number(el.getAttribute("max"));
    if (!max) return;
    var value = Number(el.value);
    if (Number.isFinite(value) && value > max) el.value = String(max);
  }
  doc.addEventListener("change", function (event) { clampAmount(event.target); }, true);
  doc.addEventListener("blur", function (event) { clampAmount(event.target); }, true);

  doc.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    if (target.closest('[data-drawer-go="pause"]') || target.closest('[data-action="pause"]')) {
      var box = doc.getElementById("pauseResult");
      if (box) box.innerHTML = "";
    }
  }, true);
})();

/* ============================================================================
   30 记账日历：入口挂在「今日」页头，月视图 + 单日明细
   ========================================================================== */
(function () {
  "use strict";
  var doc = document;
  var overlay = null;
  var view = { y: 0, m: 0 };
  var sel = "";
  var mounted = false;

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function key(y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); }
  function todayKey() {
    var t = new Date();
    return key(t.getFullYear(), t.getMonth(), t.getDate());
  }
  /* App 里有一个固定的「今天」（demo 日期常量 TODAY），日历的高亮与默认选中都跟着它走 */
  function appToday() {
    try {
      if (typeof TODAY === "string" && /^\d{4}-\d{2}-\d{2}$/.test(TODAY)) return TODAY;
    } catch (e) {}
    return todayKey();
  }
  function money(cents) {
    var n = Math.abs(Number(cents) || 0) / 100;
    var s = n.toFixed(2);
    if (s.slice(-3) === ".00") s = s.slice(0, -3);
    return "¥" + s;
  }
  function readState() {
    try {
      if (typeof state === "object" && state) return state;
    } catch (e) {}
    try {
      var raw = localStorage.getItem("zhihuijin-html-preview-v1");
      var parsed = raw ? JSON.parse(raw) : null;
      return parsed && parsed.data ? parsed.data : parsed || {};
    } catch (e2) { return {}; }
  }

  function itemsFor(dateKey, s) {
    var out = [];
    (s.expenses || []).forEach(function (e) {
      if (e && e.date === dateKey) out.push({ kind: "expense", label: e.category || "支出", note: e.note || "", cents: e.amountCents });
    });
    (s.events || []).forEach(function (e) {
      if (e && e.date === dateKey) out.push({ kind: "event", label: e.name || "计划事件", note: "", cents: e.amountCents });
    });
    var tasks = s.tasks && s.tasks[dateKey];
    if (Array.isArray(tasks)) {
      tasks.forEach(function (t) {
        var done = t && (t.status === "done" || t.done === true || t.completed === true);
        out.push({ kind: "task", label: t && t.title ? t.title : "计划", note: done ? "已完成" : "未完成", cents: null, done: done });
      });
    }
    (s.pauses || []).forEach(function (p) {
      if (!p || !p.endsAt) return;
      var d = new Date(p.endsAt);
      if (isNaN(d.getTime())) return;
      if (key(d.getFullYear(), d.getMonth(), d.getDate()) === dateKey) {
        out.push({ kind: "pause", label: p.name || "冷静期", note: "到期", cents: p.amountCents });
      }
    });
    return out;
  }

  function build() {
    if (!overlay) return;
    var s = readState();
    var y = view.y, m = view.m;
    var first = new Date(y, m, 1);
    var lead = (first.getDay() + 6) % 7;              /* 周一开头 */
    var total = new Date(y, m + 1, 0).getDate();
    var rows = Math.ceil((lead + total) / 7);
    var tk = appToday();
    if (!sel) sel = tk;

    var head = '<div class="vibe-cal__head">' +
      '<button class="vibe-cal__nav" type="button" data-cal="prev" aria-label="上个月">‹</button>' +
      '<div class="vibe-cal__title">' + y + " 年 " + (m + 1) + " 月</div>" +
      '<button class="vibe-cal__nav" type="button" data-cal="next" aria-label="下个月">›</button>' +
      (key(y, m, 1).slice(0, 7) === tk.slice(0, 7) ? "" : '<button class="vibe-cal__back" type="button" data-cal="today">回到本月</button>') +
      '<button class="vibe-cal__close" type="button" data-cal="close" aria-label="关闭">×</button>' +
      "</div>";

    var wk = '<div class="vibe-cal__wk">' + ["一", "二", "三", "四", "五", "六", "日"].map(function (x) {
      return "<span>" + x + "</span>";
    }).join("") + "</div>";

    var cells = "";
    for (var i = 0; i < rows * 7; i++) {
      var dayNum = i - lead + 1;
      var cur = dayNum >= 1 && dayNum <= total;
      var dObj = new Date(y, m, dayNum);
      var k = key(dObj.getFullYear(), dObj.getMonth(), dObj.getDate());
      var list = cur ? itemsFor(k, s) : [];
      var dots = "";
      if (list.some(function (x) { return x.kind === "expense"; })) dots += '<i class="vibe-cal__dot vibe-cal__dot--expense"></i>';
      if (list.some(function (x) { return x.kind === "event"; })) dots += '<i class="vibe-cal__dot vibe-cal__dot--event"></i>';
      if (list.some(function (x) { return x.kind === "task"; })) dots += '<i class="vibe-cal__dot vibe-cal__dot--task"></i>';
      if (list.some(function (x) { return x.kind === "pause"; })) dots += '<i class="vibe-cal__dot vibe-cal__dot--pause"></i>';
      var cls = "vibe-cal__cell" + (cur ? "" : " is-out") + (k === tk ? " is-today" : "") + (cur && k === sel ? " is-sel" : "");
      cells += '<button class="' + cls + '" type="button" data-cal-day="' + (cur ? k : "") + '"' + (cur ? "" : ' tabindex="-1"') + ">" +
        '<span>' + dObj.getDate() + "</span>" +
        '<span class="vibe-cal__dots">' + dots + "</span>" +
        "</button>";
    }

    var day = "";
    if (sel) {
      var selList = itemsFor(sel, s);
      var parts = sel.split("-");
      var totalOut = 0;
      var body = selList.map(function (x) {
        if (x.kind === "expense" || x.kind === "event" || x.kind === "pause") totalOut += Math.abs(Number(x.cents) || 0);
        var color = x.kind === "expense" ? "#0d6e5b" : x.kind === "event" ? "#c99321" : x.kind === "task" ? "#2f6fd0" : "#8b6fd0";
        return '<div class="vibe-cal__row"><i style="background:' + color + '"></i><b>' + x.label + "</b>" +
          (x.note ? "<span>" + x.note + "</span>" : "<span></span>") +
          (x.cents !== null && x.cents !== undefined ? "<em>" + money(x.cents) + "</em>" : "") + "</div>";
      }).join("");
      if (!body) body = '<div class="vibe-cal__empty">这一天还没有记录。</div>';
      day = '<div class="vibe-cal__day">' +
        '<div class="vibe-cal__dayhead"><b>' + Number(parts[1]) + " 月 " + Number(parts[2]) + " 日</b><small>" + selList.length + " 条</small></div>" +
        body +
        (totalOut > 0 ? '<div class="vibe-cal__sum"><span>当天支出合计</span><b>' + money(totalOut) + "</b></div>" : "") +
        "</div>";
    }

    var card = overlay.firstElementChild;
    card.innerHTML = head + wk + '<div class="vibe-cal__grid">' + cells + "</div>" + day;
  }

  function open() {
    if (!overlay) return;
    var base = appToday().split("-");
    view.y = Number(base[0]);
    view.m = Number(base[1]) - 1;
    sel = appToday();
    build();
    overlay.classList.add("is-on");
    overlay.setAttribute("aria-hidden", "false");
    doc.documentElement.classList.add("vibe-cal-open");
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove("is-on");
    overlay.setAttribute("aria-hidden", "true");
    doc.documentElement.classList.remove("vibe-cal-open");
  }

  function shift(delta) {
    var m = view.m + delta, y = view.y;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    view.y = y;
    view.m = m;
    build();
  }

  function ensure() {
    if (overlay) return;
    overlay = doc.createElement("div");
    overlay.className = "vibe-cal";
    overlay.id = "vibeCal";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = '<div class="vibe-cal__card" role="dialog" aria-modal="true" aria-label="记账日历"></div>';
    (doc.getElementById("appShell") || doc.body).appendChild(overlay);

    overlay.addEventListener("click", function (event) {
      var t = event.target;
      if (t === overlay) { close(); return; }
      var act = t.closest("[data-cal]");
      if (act) {
        var k = act.dataset.cal;
        if (k === "close") close();
        else if (k === "prev") shift(-1);
        else if (k === "next") shift(1);
        else if (k === "today") { var b = appToday().split("-"); view.y = Number(b[0]); view.m = Number(b[1]) - 1; sel = appToday(); build(); }
        return;
      }
      var day = t.closest("[data-cal-day]");
      if (day && day.dataset.calDay) { sel = day.dataset.calDay; build(); }
    });

    doc.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && overlay.classList.contains("is-on")) close();
    }, true);
  }

  function mountEntry() {
    var screen = doc.getElementById("todayScreen");
    if (!screen || screen.querySelector(".vibe-calbtn")) return;
    var head = screen.querySelector(".today-head");
    if (!head) return;
    var btn = doc.createElement("button");
    btn.type = "button";
    btn.className = "vibe-calbtn";
    btn.setAttribute("aria-label", "打开记账日历");
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="14.5" rx="3.4"/><path d="M8 3.2v4M16 3.2v4M3.5 10.5h17"/><path d="M8.4 14.6h2M13.6 14.6h2"/></svg><span>日历</span>';
    btn.addEventListener("click", function (event) { event.preventDefault(); event.stopPropagation(); open(); });
    var ring = head.querySelector(".progress-ring");
    if (ring && ring.parentNode === head) head.insertBefore(btn, ring);
    else head.appendChild(btn);
  }

  function boot() {
    ensure();
    mountEntry();
    var t = 0;
    new MutationObserver(function () {
      clearTimeout(t);
      t = setTimeout(function () { ensure(); mountEntry(); if (overlay && overlay.classList.contains("is-on")) build(); }, 260);
    }).observe(doc.body, { subtree: true, childList: true });
    mounted = true;
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
