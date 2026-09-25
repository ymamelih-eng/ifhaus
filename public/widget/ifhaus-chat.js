/*!
 * ifHaus Asistan – embeddable chat widget loader.
 *
 * Usage (anywhere before </body>):
 *   <script src="https://CHAT_BACKEND/widget/ifhaus-chat.js" defer></script>
 *
 * Optional attributes on the script tag:
 *   data-endpoint="https://CHAT_BACKEND"   API base URL (default: the origin this file is served from)
 *   data-source="web"                      value sent as `source` to /api/chat
 *
 * Only the floating button lives in this file. The panel is fetched on first
 * open (or when the browser is idle), so page load is not affected.
 */
(function () {
  'use strict';
  if (window.__ifhausChat) return;

  var script = document.currentScript;
  var scriptUrl = script && script.src ? new URL(script.src, location.href) : null;
  var config = {
    endpoint: ((script && script.getAttribute('data-endpoint')) || (scriptUrl ? scriptUrl.origin : location.origin)).replace(/\/+$/, ''),
    source: (script && script.getAttribute('data-source')) || 'web',
    panelUrl: scriptUrl ? new URL('ifhaus-chat-panel.js', scriptUrl).href : '/widget/ifhaus-chat-panel.js'
  };

  function safeGet(store, key) { try { return window[store].getItem(key); } catch (e) { return null; } }
  function safeSet(store, key, val) { try { window[store].setItem(key, val); } catch (e) { /* storage unavailable */ } }

  // Design tokens. The host site can override any of them with the matching
  // --ifhaus-* custom property on :root; custom properties inherit into the shadow root.
  var TOKENS =
    ':host{' +
    '--ifc-accent:var(--ifhaus-accent,#c65f3f);' +
    '--ifc-accent-ink:var(--ifhaus-accent-ink,#ffffff);' +
    '--ifc-ink:var(--ifhaus-ink,#171717);' +
    '--ifc-dark:var(--ifhaus-dark,#1f1f1f);' +
    '--ifc-muted:var(--ifhaus-muted,#6b6b6b);' +
    '--ifc-surface:var(--ifhaus-surface,#ffffff);' +
    '--ifc-canvas:var(--ifhaus-canvas,#f7f7f4);' +
    '--ifc-soft:var(--ifhaus-soft,#f4f1ed);' +
    '--ifc-line:var(--ifhaus-line,#e7e4df);' +
    '--ifc-radius-lg:var(--ifhaus-radius-lg,22px);' +
    '--ifc-radius-md:var(--ifhaus-radius-md,16px);' +
    '--ifc-radius-sm:var(--ifhaus-radius-sm,14px);' +
    '--ifc-font:var(--ifhaus-font,inherit);' +
    '--ifc-font-display:var(--ifhaus-font-display,Georgia,"Times New Roman",serif);' +
    '--ifc-shadow:var(--ifhaus-shadow,0 20px 60px rgba(0,0,0,.12));' +
    '--ifc-offset:var(--ifhaus-chat-offset,24px);' +
    'all:initial;position:fixed;z-index:2147483000;right:var(--ifc-offset);bottom:var(--ifc-offset);' +
    'font-family:var(--ifc-font);color:var(--ifc-ink);-webkit-font-smoothing:antialiased}' +
    '@media (max-width:640px){:host{--ifc-offset:var(--ifhaus-chat-offset-mobile,16px)}}';

  var BUTTON_CSS =
    '*{box-sizing:border-box}' +
    '.fab{position:relative;width:58px;height:58px;border-radius:50%;border:0;padding:0;cursor:pointer;' +
    'background:var(--ifc-accent);color:var(--ifc-accent-ink);box-shadow:0 10px 30px rgba(0,0,0,.18);' +
    'display:grid;place-items:center;transition:transform .2s ease,box-shadow .2s ease}' +
    '.fab:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(0,0,0,.22)}' +
    '.fab:focus-visible{outline:2px solid var(--ifc-dark);outline-offset:3px}' +
    '.fab svg{display:block}' +
    '.fab::after{content:"";position:absolute;inset:0;border-radius:50%;box-shadow:0 0 0 0 var(--ifc-accent);' +
    'opacity:.45;animation:pulse 9s ease-out 3s infinite;pointer-events:none}' +
    '@keyframes pulse{0%{box-shadow:0 0 0 0 var(--ifc-accent);opacity:.4}' +
    '12%{box-shadow:0 0 0 12px var(--ifc-accent);opacity:0}100%{box-shadow:0 0 0 12px var(--ifc-accent);opacity:0}}' +
    ':host([data-open]) .fab{display:none}' +
    ':host([data-open]) .tip{display:none}' +
    '.tip{position:absolute;right:0;bottom:72px;white-space:nowrap;background:var(--ifc-surface);color:var(--ifc-ink);' +
    'border:1px solid var(--ifc-line);border-radius:var(--ifc-radius-sm);padding:10px 14px;font-size:14px;line-height:1.3;' +
    'box-shadow:var(--ifc-shadow);opacity:0;transform:translateY(6px);transition:opacity .3s ease,transform .3s ease;pointer-events:none}' +
    '.tip.show{opacity:1;transform:none;pointer-events:auto;cursor:pointer}' +
    '@media (prefers-reduced-motion:reduce){.fab::after{animation:none}.fab,.tip{transition:none}}';

  // "if" monogram inside a speech bubble.
  var ICON =
    '<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" focusable="false">' +
    '<path d="M16 4C9.1 4 4 8.6 4 14.3c0 3.3 1.7 6.2 4.4 8.1L7.6 27.5c-.1.5.4.9.8.6l5-3c.8.1 1.7.2 2.6.2 6.9 0 12-4.6 12-10.3S22.9 4 16 4Z" ' +
    'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<text x="16" y="18.6" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="11" fill="currentColor">if</text>' +
    '</svg>';

  var host = document.createElement('div');
  host.id = 'ifhaus-chat';
  var root = host.attachShadow({ mode: 'open' });
  root.innerHTML =
    '<style>' + TOKENS + BUTTON_CSS + '</style>' +
    '<div class="tip" role="status">Size nasıl yardımcı olabilirim?</div>' +
    '<button class="fab" type="button" aria-label="ifHaus Asistan sohbetini aç" aria-haspopup="dialog">' + ICON + '</button>';

  var fab = root.querySelector('.fab');
  var tip = root.querySelector('.tip');
  var panelPromise = null;

  function loadPanel() {
    if (panelPromise) return panelPromise;
    panelPromise = new Promise(function (resolve, reject) {
      if (window.__ifhausChatPanel) return resolve(window.__ifhausChatPanel);
      var s = document.createElement('script');
      s.src = config.panelUrl;
      s.async = true;
      s.onload = function () {
        window.__ifhausChatPanel ? resolve(window.__ifhausChatPanel) : reject(new Error('panel missing'));
      };
      s.onerror = function () { panelPromise = null; reject(new Error('panel load failed')); };
      document.head.appendChild(s);
    });
    return panelPromise;
  }

  var panel = null;
  function open() {
    hideTip();
    fab.setAttribute('aria-busy', 'true');
    loadPanel().then(function (factory) {
      fab.removeAttribute('aria-busy');
      if (!panel) {
        panel = factory({
          root: root,
          host: host,
          config: config,
          onClose: function () { fab.focus(); }
        });
      }
      panel.open();
    }).catch(function () { fab.removeAttribute('aria-busy'); });
  }

  // First-visit tooltip, shown once per browser.
  var TIP_KEY = 'ifhausChatTipSeen';
  var tipTimer;
  function hideTip() { tip.classList.remove('show'); clearTimeout(tipTimer); }
  function maybeShowTip() {
    if (safeGet('localStorage', TIP_KEY) || host.hasAttribute('data-open')) return;
    safeSet('localStorage', TIP_KEY, '1');
    tip.classList.add('show');
    tipTimer = setTimeout(hideTip, 7000);
  }

  fab.addEventListener('click', open);
  tip.addEventListener('click', open);
  // Warm the panel on intent so the first open feels instant.
  fab.addEventListener('pointerenter', function () { loadPanel().catch(function () {}); }, { once: true });
  fab.addEventListener('focus', function () { loadPanel().catch(function () {}); }, { once: true });

  function mount() {
    document.body.appendChild(host);
    setTimeout(maybeShowTip, 4000);
    // Reopen automatically if the visitor had the panel open on the previous page.
    if (safeGet('sessionStorage', 'ifhausChatOpen') === '1') open();
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);

  window.__ifhausChat = { open: open };
})();
