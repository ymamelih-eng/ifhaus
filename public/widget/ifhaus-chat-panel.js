/*!
 * ifHaus Asistan – chat panel. Loaded on demand by ifhaus-chat.js.
 * Renders inside the loader's shadow root and talks to POST {endpoint}/api/chat.
 */
(function () {
  'use strict';

  var PHONE_DISPLAY = '0850 532 2458';
  var PHONE_TEL = '+908505322458';
  var CTA_TEXT = 'Detaylı bilgi için ' + PHONE_DISPLAY + '’i arayabilir veya telefon numaranızı bırakabilirsiniz, ekibimiz sizi arasın.';
  var WELCOME = 'Merhaba. ifHaus modelleri, arsanız ve süreç hakkında yardımcı olabilirim. Ne öğrenmek istersiniz?';
  var ERROR_TEXT = 'Şu anda yanıt veremiyorum. ' + PHONE_DISPLAY + ' numarasından bize ulaşabilirsiniz.';
  var QUICK_ACTIONS = [
    { label: 'Modelleri İncele', message: 'Modellerinizi incelemek istiyorum.' },
    { label: 'Arsama Uygun Model', message: 'Arsama uygun bir model arıyorum.' },
    { label: 'Fiyat & Teklif', message: 'Fiyat ve teklif almak istiyorum.' },
    { label: 'Teslim Süreci', message: 'Teslim süreci nasıl işliyor?' }
  ];
  var STATE_KEY = 'ifhausChatState';
  var OPEN_KEY = 'ifhausChatOpen';

  var CSS =
    '.panel{position:fixed;right:var(--ifc-offset);bottom:var(--ifc-offset);width:380px;height:560px;' +
    'max-height:calc(100dvh - 2 * var(--ifc-offset));display:none;flex-direction:column;overflow:hidden;' +
    'background:var(--ifc-surface);border:1px solid var(--ifc-line);border-radius:var(--ifc-radius-lg);' +
    'box-shadow:var(--ifc-shadow);font-family:var(--ifc-font);color:var(--ifc-ink);font-size:15px;line-height:1.45;' +
    'transform-origin:bottom right}' +
    ':host([data-open]) .panel{display:flex;animation:in .22s ease-out}' +
    '@keyframes in{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}' +
    '@media (max-width:640px){.panel{right:0;left:0;bottom:0;width:100%;height:92dvh;max-height:none;' +
    'border-radius:var(--ifc-radius-lg) var(--ifc-radius-lg) 0 0;border-bottom:0;padding-bottom:env(safe-area-inset-bottom)}' +
    '@keyframes in{from{transform:translateY(100%)}to{transform:none}}}' +
    '.scrim{display:none}' +
    '@media (max-width:640px){:host([data-open]) .scrim{display:block;position:fixed;inset:0;background:rgba(23,23,23,.28)}}' +
    '.head{display:flex;align-items:center;gap:12px;padding:16px 14px 16px 20px;border-bottom:1px solid var(--ifc-line)}' +
    '.title{flex:1;min-width:0}' +
    '.title b{display:block;font-family:var(--ifc-font-display);font-weight:400;font-size:20px;line-height:1.2;color:var(--ifc-ink)}' +
    '.title b span{color:var(--ifc-accent)}' +
    '.title small{display:block;margin-top:2px;font-size:12.5px;color:var(--ifc-muted)}' +
    '.ctl{width:34px;height:34px;border:0;border-radius:50%;background:transparent;color:var(--ifc-muted);cursor:pointer;' +
    'display:grid;place-items:center;transition:background .15s ease,color .15s ease}' +
    '.ctl:hover{background:var(--ifc-soft);color:var(--ifc-ink)}' +
    '.ctl:focus-visible,.qa:focus-visible,.send:focus-visible,.cta a:focus-visible,.cta button:focus-visible{outline:2px solid var(--ifc-accent);outline-offset:2px}' +
    '.msgs{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:20px;display:flex;flex-direction:column;gap:10px;background:var(--ifc-surface)}' +
    '.m{max-width:84%;padding:11px 14px;border-radius:var(--ifc-radius-md);white-space:pre-wrap;word-wrap:break-word;font-size:15px}' +
    '.bot{align-self:flex-start;background:var(--ifc-soft);color:var(--ifc-ink);border-bottom-left-radius:6px}' +
    '.user{align-self:flex-end;background:var(--ifc-dark);color:#fff;border-bottom-right-radius:6px}' +
    '.typing{color:var(--ifc-muted);font-size:14px}' +
    '.qas{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}' +
    '.qa{border:1px solid var(--ifc-line);background:var(--ifc-surface);color:var(--ifc-ink);border-radius:999px;' +
    'padding:9px 14px;font:inherit;font-size:14px;cursor:pointer;transition:border-color .15s ease,color .15s ease}' +
    '.qa:hover{border-color:var(--ifc-accent);color:var(--ifc-accent)}' +
    '.cta{align-self:stretch;border:1px solid var(--ifc-line);border-radius:var(--ifc-radius-md);padding:14px;background:var(--ifc-canvas)}' +
    '.cta p{margin:0 0 12px;font-size:14px;color:var(--ifc-ink)}' +
    '.cta .row{display:flex;gap:8px}' +
    '.cta a,.cta button{flex:1;display:inline-flex;justify-content:center;align-items:center;min-height:40px;border-radius:var(--ifc-radius-sm);' +
    'font:inherit;font-size:14px;font-weight:700;text-decoration:none;cursor:pointer}' +
    '.cta a{background:var(--ifc-accent);color:var(--ifc-accent-ink);border:0}' +
    '.cta button{background:transparent;color:var(--ifc-ink);border:1px solid var(--ifc-line)}' +
    '.composer{display:flex;gap:10px;padding:14px;border-top:1px solid var(--ifc-line);background:var(--ifc-surface)}' +
    '.composer input{flex:1;min-width:0;border:1px solid var(--ifc-line);border-radius:var(--ifc-radius-sm);padding:12px 14px;' +
    'font:inherit;font-size:16px;color:var(--ifc-ink);background:var(--ifc-surface);outline:none}' +
    '.composer input:focus{border-color:var(--ifc-accent)}' +
    '.send{border:0;border-radius:var(--ifc-radius-sm);background:var(--ifc-accent);color:var(--ifc-accent-ink);padding:0 16px;' +
    'font:inherit;font-size:15px;font-weight:700;cursor:pointer}' +
    '.send:disabled{opacity:.5;cursor:default}' +
    '.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}' +
    '@media (prefers-reduced-motion:reduce){:host([data-open]) .panel{animation:none}}';

  var ICON_MIN = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  var ICON_CLOSE = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

  function safeGet(store, key) { try { return window[store].getItem(key); } catch (e) { return null; } }
  function safeSet(store, key, val) { try { window[store].setItem(key, val); } catch (e) { /* storage unavailable */ } }

  function loadState() {
    try {
      var s = JSON.parse(safeGet('sessionStorage', STATE_KEY) || 'null');
      if (s && Array.isArray(s.messages)) return s;
    } catch (e) { /* ignore corrupt state */ }
    return { sessionId: '', messages: [] };
  }

  window.__ifhausChatPanel = function createPanel(opts) {
    var root = opts.root, host = opts.host, config = opts.config;
    // Conversation survives close/reopen and navigation within the same tab.
    var state = loadState();
    var pending = false;

    var style = document.createElement('style');
    style.textContent = CSS;
    root.appendChild(style);

    var scrim = document.createElement('div');
    scrim.className = 'scrim';
    root.appendChild(scrim);

    var panel = document.createElement('section');
    panel.className = 'panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'ifHaus Asistan');
    panel.innerHTML =
      '<header class="head">' +
      '<div class="title"><b><span>if</span>Haus Asistan</b><small>Modeller, arsa ve süreç hakkında</small></div>' +
      '<button class="ctl min" type="button" aria-label="Küçült">' + ICON_MIN + '</button>' +
      '<button class="ctl close" type="button" aria-label="Kapat">' + ICON_CLOSE + '</button>' +
      '</header>' +
      '<div class="msgs" aria-live="polite" aria-relevant="additions"></div>' +
      '<form class="composer">' +
      '<label class="sr" for="ifc-input">Mesajınız</label>' +
      '<input id="ifc-input" autocomplete="off" maxlength="1000" placeholder="Mesajınızı yazın…">' +
      '<button class="send" type="submit">Gönder</button>' +
      '</form>';
    root.appendChild(panel);

    var msgs = panel.querySelector('.msgs');
    var form = panel.querySelector('.composer');
    var input = panel.querySelector('input');
    var sendBtn = panel.querySelector('.send');

    function save() { safeSet('sessionStorage', STATE_KEY, JSON.stringify(state)); }
    function scrollDown() { msgs.scrollTop = msgs.scrollHeight; }

    function bubble(text, cls) {
      var d = document.createElement('div');
      d.className = 'm ' + cls;
      d.textContent = text;
      msgs.appendChild(d);
      return d;
    }

    function ctaCard() {
      var d = document.createElement('div');
      d.className = 'cta';
      d.innerHTML = '<p></p><div class="row"><a>Hemen Ara</a><button type="button">Numaramı Bırak</button></div>';
      d.querySelector('p').textContent = CTA_TEXT;
      d.querySelector('a').href = 'tel:' + PHONE_TEL;
      d.querySelector('button').addEventListener('click', function () {
        input.placeholder = 'Telefon numaranız';
        input.focus();
      });
      msgs.appendChild(d);
    }

    function quickActions() {
      var wrap = document.createElement('div');
      wrap.className = 'qas';
      QUICK_ACTIONS.forEach(function (qa) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'qa';
        b.textContent = qa.label;
        b.addEventListener('click', function () { send(qa.message); });
        wrap.appendChild(b);
      });
      msgs.appendChild(wrap);
    }

    function render() {
      msgs.textContent = '';
      bubble(WELCOME, 'bot');
      var hasUser = state.messages.some(function (m) { return m.role === 'user'; });
      if (!hasUser) quickActions();
      state.messages.forEach(function (m) {
        if (m.role === 'cta') ctaCard();
        else bubble(m.text, m.role === 'user' ? 'user' : 'bot');
      });
      scrollDown();
    }

    function setPending(v) {
      pending = v;
      sendBtn.disabled = v;
    }

    function send(text) {
      text = (text || '').trim();
      if (!text || pending) return;
      state.messages.push({ role: 'user', text: text });
      save();
      render();
      var typing = bubble('Yazıyor…', 'bot typing');
      scrollDown();
      setPending(true);

      fetch(config.endpoint + '/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: state.sessionId || undefined, source: config.source })
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          var j = res.body || {};
          if (j.sessionId) state.sessionId = j.sessionId;
          if (!res.ok) {
            state.messages.push({ role: 'assistant', text: ERROR_TEXT });
          } else if (!j.silent && j.reply) {
            // Silent responses (repeated off-topic messages) add no bubble at all.
            state.messages.push({ role: 'assistant', text: j.reply });
            if (j.cta && j.reply.indexOf('532') === -1) state.messages.push({ role: 'cta' });
          }
        })
        .catch(function () {
          state.messages.push({ role: 'assistant', text: ERROR_TEXT });
        })
        .then(function () {
          typing.remove();
          setPending(false);
          save();
          render();
        });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = input.value;
      input.value = '';
      send(text);
    });

    function hide() {
      host.removeAttribute('data-open');
      safeSet('sessionStorage', OPEN_KEY, '0');
      opts.onClose && opts.onClose();
    }
    panel.querySelector('.min').addEventListener('click', hide);
    panel.querySelector('.close').addEventListener('click', hide);
    scrim.addEventListener('click', hide);
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });

    render();

    return {
      open: function () {
        host.setAttribute('data-open', '');
        safeSet('sessionStorage', OPEN_KEY, '1');
        scrollDown();
        // Avoid popping the on-screen keyboard on touch devices.
        if (!window.matchMedia || !window.matchMedia('(pointer: coarse)').matches) input.focus();
      },
      close: hide
    };
  };
})();
