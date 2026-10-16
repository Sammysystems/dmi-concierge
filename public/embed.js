/*
 * DMI Studio Desk - embed loader.
 *
 * Drop one line on any page to put the studio desk in the corner:
 *
 *   <script src="https://desk.dmi.com.ng/embed.js" defer></script>
 *
 * Or, if the site already has its own "Talk to Support" button, load the script
 * with data-desk-bubble="false" and call the desk from that button:
 *
 *   <script src="https://desk.dmi.com.ng/embed.js" data-desk-bubble="false" defer></script>
 *   <button onclick="DmiDesk.open()">Talk to Support</button>
 *
 * The desk itself lives in an iframe on our domain, so the studio's own site
 * needs no build step, no dependencies, and never sees the AI or email keys.
 *
 * Config (all optional, all as data- attributes on the script tag):
 *   data-desk-slug      which studio to open          (default "dmi")
 *   data-desk-base      origin hosting the desk       (default: this script's origin)
 *   data-desk-label     aria-label / bubble title      (default "Talk to Support")
 *   data-desk-bubble    "false" to hide our bubble     (default shown)
 *   data-desk-position  "left" or "right"              (default "right")
 *   data-desk-color     accent colour for the bubble   (default: the studio's brand)
 */
(function () {
  if (window.DmiDesk && window.DmiDesk.__loaded) return;

  var script = document.currentScript || (function () {
    var all = document.getElementsByTagName("script");
    for (var i = all.length - 1; i >= 0; i--) {
      if (all[i].src && all[i].src.indexOf("embed.js") !== -1) return all[i];
    }
    return null;
  })();

  var cfg = {
    slug: (script && script.getAttribute("data-desk-slug")) || "dmi",
    base: (script && script.getAttribute("data-desk-base")) || (script && script.src ? new URL(script.src).origin : ""),
    label: (script && script.getAttribute("data-desk-label")) || "Talk to Support",
    bubble: !(script && script.getAttribute("data-desk-bubble") === "false"),
    position: (script && script.getAttribute("data-desk-position")) === "left" ? "left" : "right",
    color: (script && script.getAttribute("data-desk-color")) || "#e40014",
  };

  var PANEL_W = 392;
  var PANEL_H = 620;
  var GAP = 20;
  var isNarrow = function () { return window.innerWidth <= 480; };

  // ---- styles -----------------------------------------------------------------
  var css = [
    ".dmi-desk-root{position:fixed;z-index:2147483000;}",
    ".dmi-desk-panel{position:fixed;z-index:2147483000;width:" + PANEL_W + "px;height:min(" + PANEL_H + "px,calc(100vh - 120px));",
    "border-radius:18px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.38);background:transparent;",
    "transform:translateY(12px) scale(.98);opacity:0;transition:transform .18s ease,opacity .18s ease;pointer-events:none;}",
    ".dmi-desk-panel.dmi-open{transform:none;opacity:1;pointer-events:auto;}",
    ".dmi-desk-panel iframe{display:block;width:100%;height:100%;border:0;background:transparent;}",
    ".dmi-desk-launch{position:fixed;z-index:2147483000;display:flex;align-items:center;justify-content:center;",
    "width:58px;height:58px;border-radius:50%;border:0;cursor:pointer;color:#fff;",
    "box-shadow:0 10px 26px rgba(0,0,0,.3);transition:transform .15s ease;}",
    ".dmi-desk-launch:hover{transform:scale(1.06);}",
    ".dmi-desk-launch svg{width:26px;height:26px;display:block;}",
    "@media (max-width:480px){.dmi-desk-panel{left:0 !important;right:0 !important;top:0 !important;bottom:0 !important;width:100% !important;height:100% !important;border-radius:0;}}",
  ].join("");
  var style = document.createElement("style");
  style.id = "dmi-desk-style";
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);

  var edge = cfg.position === "left" ? "left:" + GAP + "px;" : "right:" + GAP + "px;";

  // ---- panel (the iframe) -----------------------------------------------------
  var panel = document.createElement("div");
  panel.className = "dmi-desk-panel";
  panel.setAttribute("style", edge + "bottom:" + (GAP + 58 + 12) + "px;");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", cfg.label);

  var iframe = document.createElement("iframe");
  iframe.setAttribute("title", cfg.label);
  iframe.setAttribute("allow", "clipboard-write");
  iframe.src = cfg.base + "/embed/" + encodeURIComponent(cfg.slug);
  panel.appendChild(iframe);

  // ---- launcher bubble --------------------------------------------------------
  var bubble = null;
  if (cfg.bubble) {
    bubble = document.createElement("button");
    bubble.className = "dmi-desk-launch";
    bubble.setAttribute("aria-label", cfg.label);
    bubble.setAttribute("title", cfg.label);
    bubble.setAttribute("style", edge + "bottom:" + GAP + "px;background:" + cfg.color + ";");
    bubble.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' +
      "</svg>";
  }

  function mount() {
    document.body.appendChild(panel);
    if (bubble) document.body.appendChild(bubble);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);

  // ---- open / close -----------------------------------------------------------
  var open = false;
  function setOpen(next) {
    open = next;
    panel.classList.toggle("dmi-open", open);
    if (open) iframe.contentWindow && iframe.contentWindow.postMessage({ type: "dmi:open" }, "*");
    if (bubble) {
      bubble.setAttribute("aria-label", open ? "Close " + cfg.label : cfg.label);
      bubble.innerHTML = open ? closeIcon() : chatIcon();
    }
  }
  function closeIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  }
  function chatIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  }

  if (bubble) bubble.addEventListener("click", function () { setOpen(!open); });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && open) setOpen(false);
  });

  window.addEventListener("message", function (e) {
    var d = e.data || {};
    if (d.type === "dmi:close") setOpen(false);
    else if (d.type === "dmi:ready" && open) iframe.contentWindow && iframe.contentWindow.postMessage({ type: "dmi:open" }, "*");
  });

  // ---- public API -------------------------------------------------------------
  window.DmiDesk = {
    __loaded: true,
    slug: cfg.slug,
    open: function () { setOpen(true); },
    close: function () { setOpen(false); },
    toggle: function () { setOpen(!open); },
    isOpen: function () { return open; },
  };

  // Match the bubble to the studio's brand colour once the profile is known.
  if (cfg.bubble && !(script && script.getAttribute("data-desk-color"))) {
    try {
      fetch(cfg.base + "/api/public/" + encodeURIComponent(cfg.slug))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (p) {
          var c = p && p.brand && p.brand.primary;
          if (c && bubble) bubble.style.background = c;
        })
        .catch(function () {});
    } catch (e) {}
  }
})();
