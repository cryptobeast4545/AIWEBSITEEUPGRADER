/* AccessLayer v2 — drop-in accessibility layer. Shadow-DOM isolated. */
(function () {
  if (window.__accessLayer) return;
  window.__accessLayer = true;
  var script = document.currentScript || document.querySelector('script[data-site-id]');
  var ds = (script && script.dataset) || {};
  var SITE = ds.siteId || 'demo';
  var API = ds.api || (script && script.src ? new URL(script.src).origin + '/api' : '/api');
  var AUTOFIX = ds.autofix !== 'false';
  var VOICE_ON = ds.sarvamVoice !== 'disabled';
  var POS = ds.position === 'left' ? 'left' : 'right';
  var KEY = 'accesslayer_prefs_' + SITE;
  var DEF = { contrast: 'none', zoom: 100, font: 'default', spacing: false, cursor: false, focus: false, links: false, motion: false, guide: false, lang: 'en-IN' };
  var prefs = Object.assign({}, DEF, safeJSON(localStorage.getItem(KEY)));
  var cfg = { ai_alt: false, sarvam: false, ai: false, autofix: true, voice: true };
  var fixes = { images: 0, labels: 0, buttons: 0, keyboard: 0, lang: 0, skip: 0, frames: 0, dialogs: 0 };
  var LANGS = [['en-IN', 'English'], ['hi-IN', 'हिन्दी'], ['ta-IN', 'தமிழ்'], ['te-IN', 'తెలుగు'], ['kn-IN', 'ಕನ್ನಡ'], ['ml-IN', 'മലയാളം'], ['mr-IN', 'मराठी'], ['bn-IN', 'বাংলা'], ['gu-IN', 'ગુજરાતી'], ['pa-IN', 'ਪੰਜਾਬੀ'], ['od-IN', 'ଓଡ଼ିଆ']];

  function safeJSON(s) { try { return JSON.parse(s) || {}; } catch (e) { return {}; } }
  function save() { localStorage.setItem(KEY, JSON.stringify(prefs)); }
  function api(path, opts) {
    return fetch(API + '/widget/' + encodeURIComponent(SITE) + path, opts).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function postJSON(path, body) { return api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }

  /* ---------- page-level styles (outside shadow) ---------- */
  var CURSOR = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24'><path d='M4 2l16 10-7 1 4 8-3 1-4-8-6 5z' fill='black' stroke='white' stroke-width='1.2'/></svg>\") 4 2, auto";
  var pageCSS = [
    "@import url('https://fonts.cdnfonts.com/css/opendyslexic');",
    "@import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap');",
    ".al-skip{position:fixed;left:12px;top:-60px;z-index:2147483646;background:#0B0F19;color:#fff;padding:10px 16px;border-radius:8px;font:600 15px sans-serif;text-decoration:none;transition:top .2s}",
    ".al-skip:focus{top:12px;outline:3px solid #10B981}",
    ":focus-visible{outline:3px solid #10B981 !important;outline-offset:2px !important}",
    "html.al-c-high body, html.al-c-high body *:not(img):not(video):not(svg):not(path){background-color:#000 !important;color:#fff !important;border-color:#fff !important}",
    "html.al-c-high body a, html.al-c-high body a *{color:#FFE600 !important;text-decoration:underline !important}",
    "html.al-c-high body button, html.al-c-high body [role=button]{outline:2px solid #fff !important}",
    "html.al-c-dark body{filter:invert(1) hue-rotate(180deg) !important;background:#fff}",
    "html.al-c-dark body img, html.al-c-dark body video, html.al-c-dark body picture{filter:invert(1) hue-rotate(180deg) !important}",
    "html.al-c-invert body{filter:invert(1) !important}",
    "html.al-c-mono body{filter:grayscale(1) !important}",
    "html.al-c-light body, html.al-c-light body *:not(img):not(video){background-color:#fff !important;color:#000 !important}",
    "html.al-zoom body{zoom:var(--al-zoom)}",
    "html.al-f-dyslexic body, html.al-f-dyslexic body *:not(i):not([class*=icon]){font-family:'OpenDyslexic','Comic Sans MS',sans-serif !important}",
    "html.al-f-readable body, html.al-f-readable body *:not(i):not([class*=icon]){font-family:'Atkinson Hyperlegible',Verdana,sans-serif !important}",
    "html.al-spacing body, html.al-spacing body *{letter-spacing:.12em !important;word-spacing:.16em !important;line-height:1.8 !important}",
    "html.al-spacing body p{margin-bottom:2em !important}",
    "html.al-cursor, html.al-cursor *{cursor:" + CURSOR + " !important}",
    "html.al-focus body *:focus{outline:4px solid #F59E0B !important;outline-offset:3px !important;box-shadow:0 0 0 8px rgba(245,158,11,.35) !important}",
    "html.al-links body a{text-decoration:underline !important;outline:2px dashed #3B82F6 !important;outline-offset:2px}",
    "html.al-motion *, html.al-motion *::before, html.al-motion *::after{animation:none !important;transition:none !important;scroll-behavior:auto !important}",
    ".al-reading-hl{background:#FDE68A !important;color:#000 !important;outline:2px solid #F59E0B !important}",
    "#al-guide{position:fixed;left:0;right:0;height:44px;pointer-events:none;z-index:2147483645;border-top:3px solid #F59E0B;border-bottom:3px solid #F59E0B;background:rgba(245,158,11,.08);display:none}",
    "html.al-guide #al-guide{display:block}"
  ].join('\n');
  var styleEl = document.createElement('style');
  styleEl.id = 'accesslayer-page-styles';
  styleEl.textContent = pageCSS;
  (document.head || document.documentElement).appendChild(styleEl);
  var guide = document.createElement('div');
  guide.id = 'al-guide';
  guide.setAttribute('aria-hidden', 'true');
  document.documentElement.appendChild(guide);
  document.addEventListener('mousemove', function (e) { if (prefs.guide) guide.style.top = (e.clientY - 22) + 'px'; }, { passive: true });

  function applyPrefs() {
    var h = document.documentElement, cl = h.classList;
    ['al-c-high', 'al-c-dark', 'al-c-invert', 'al-c-mono', 'al-c-light'].forEach(function (c) { cl.remove(c); });
    if (prefs.contrast !== 'none') cl.add('al-c-' + prefs.contrast);
    cl.toggle('al-zoom', prefs.zoom !== 100);
    h.style.setProperty('--al-zoom', prefs.zoom / 100);
    cl.toggle('al-f-dyslexic', prefs.font === 'dyslexic');
    cl.toggle('al-f-readable', prefs.font === 'readable');
    ['spacing', 'cursor', 'focus', 'links', 'motion', 'guide'].forEach(function (k) { cl.toggle('al-' + k, !!prefs[k]); });
    save();
    if (root) renderState();
  }

  /* ---------- auto remediation ---------- */
  function humanize(s) {
    return (s || '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b(img|dsc|image|photo|pic)\s*\d+\b/ig, '').replace(/\s+/g, ' ').trim();
  }
  function isMine(el) { return el.closest && el.closest('#accesslayer-root'); }
  var altQueue = [];
  function fixImages() {
    document.querySelectorAll('img').forEach(function (img) {
      if (img.dataset.alFixed || isMine(img)) return;
      var alt = img.getAttribute('alt');
      var bad = alt !== null && /\.(jpe?g|png|gif|webp|svg)$|^(img|image|photo|dsc)[-_ ]?\d*$/i.test(alt.trim());
      if (alt !== null && !bad) return;
      img.dataset.alFixed = '1';
      if ((img.naturalWidth && img.naturalWidth <= 2) || img.getAttribute('aria-hidden') === 'true') { img.setAttribute('alt', ''); return; }
      var file = (img.currentSrc || img.src || '').split('/').pop().split('?')[0];
      var guess = img.getAttribute('title') || humanize(file) || 'Image';
      img.setAttribute('alt', guess);
      img.dataset.alAlt = 'pending';
      fixes.images++;
      if (cfg.ai_alt && /^https?:/.test(img.currentSrc || img.src)) altQueue.push(img);
    });
    drainAlt();
  }
  var altBusy = 0;
  function drainAlt() {
    while (altBusy < 3 && altQueue.length) {
      var img = altQueue.shift();
      altBusy++;
      (function (img) {
        var ctx = (img.closest('figure,article,section') || {}).textContent || document.title;
        postJSON('/alt', { src: img.currentSrc || img.src, context: (ctx || '').trim().slice(0, 200) })
          .then(function (r) { img.setAttribute('alt', r.alt); img.dataset.alAlt = 'ai'; })
          .catch(function () { img.dataset.alAlt = 'fallback'; })
          .finally(function () { altBusy--; drainAlt(); renderState(); });
      })(img);
    }
  }
  function nameFor(el) {
    return el.getAttribute('placeholder') || el.getAttribute('title') || humanize(el.getAttribute('name') || el.id || '') || el.type || 'Field';
  }
  function fixForms() {
    document.querySelectorAll('input,select,textarea').forEach(function (el) {
      if (isMine(el) || el.dataset.alFixed) return;
      var t = (el.type || '').toLowerCase();
      if (['hidden', 'submit', 'button', 'reset', 'image'].indexOf(t) > -1) return;
      var labelled = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.closest('label') || (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]'));
      if (labelled) return;
      el.setAttribute('aria-label', nameFor(el));
      el.dataset.alFixed = '1';
      fixes.labels++;
    });
    document.querySelectorAll('label:not([for])').forEach(function (lb) {
      if (isMine(lb) || lb.querySelector('input,select,textarea')) return;
      var next = lb.nextElementSibling;
      if (next && /^(INPUT|SELECT|TEXTAREA)$/.test(next.tagName)) {
        if (!next.id) next.id = 'al-f-' + Math.random().toString(36).slice(2, 8);
        lb.setAttribute('for', next.id);
        fixes.labels++;
      }
    });
  }
  function fixButtons() {
    document.querySelectorAll('button,a[href],[role=button]').forEach(function (el) {
      if (isMine(el) || el.dataset.alFixed) return;
      var has = (el.textContent || '').trim() || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || (el.querySelector('img[alt]:not([alt=""])'));
      if (has) return;
      var svgT = el.querySelector('svg title');
      var icon = el.querySelector('[class*=icon],[class*=fa-]');
      var lbl = (svgT && svgT.textContent) || (icon && humanize((icon.className.baseVal || icon.className || '').toString().split(' ').pop().replace(/^(fa|icon)-?/, ''))) || (el.tagName === 'A' ? humanize((el.getAttribute('href') || '').split('/').filter(Boolean).pop() || 'Link') : 'Button');
      el.setAttribute('aria-label', lbl || 'Button');
      el.dataset.alFixed = '1';
      fixes.buttons++;
    });
  }
  function parseRGB(s) { var m = (s || '').match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; }
  function lum(c) { var a = c.slice(0, 3).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; }
  function ratio(a, b) { var l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
  function bgOf(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      var c = parseRGB(cs.backgroundColor);
      if (c && c[3] > 0.9) return c;
    }
    return [255, 255, 255, 1];
  }
  function fixContrast() {
    var n = 0;
    document.querySelectorAll('p,span,a,li,h1,h2,h3,h4,h5,h6,label,button,td,th,small,div,[role=button]').forEach(function (el) {
      if (n > 1500 || isMine(el) || el.dataset.alCt) return;
      var hasText = Array.prototype.some.call(el.childNodes, function (c) { return c.nodeType === 3 && c.textContent.trim(); });
      if (!hasText) return;
      n++;
      var cs = getComputedStyle(el), fg = parseRGB(cs.color), bg = bgOf(el);
      if (!fg || !bg) return;
      var big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700);
      var need = big ? 3 : 4.5;
      if (ratio(fg, bg) >= need) return;
      var dark = lum(bg) > 0.4, c = fg.slice(0, 3);
      for (var i = 0; i < 20 && ratio(c, bg) < need; i++) c = c.map(function (v) { return dark ? Math.max(0, v * 0.85 - 4) : Math.min(255, v * 1.15 + 8); });
      if (ratio(c, bg) < need) c = dark ? [0, 0, 0] : [255, 255, 255];
      el.style.setProperty('color', 'rgb(' + c.map(Math.round).join(',') + ')', 'important');
      el.dataset.alCt = '1';
      fixes.contrast = (fixes.contrast || 0) + 1;
    });
  }
  function fixKeyboard() {
    document.querySelectorAll('div,span,li,img').forEach(function (el) {
      if (isMine(el) || el.dataset.alKb || el.getAttribute('role') || el.hasAttribute('tabindex') || el.closest('a,button,label,[role=button]')) return;
      if (getComputedStyle(el).cursor !== 'pointer' || el.querySelector('a,button,input,select,textarea') || (el.textContent || '').trim().length > 60) return;
      if (el.parentElement && getComputedStyle(el.parentElement).cursor === 'pointer' && !el.parentElement.dataset.alKb && el.parentElement.tagName !== 'BODY') return;
      el.setAttribute('onclick-al', '1');
    });
    document.querySelectorAll('[onclick]:not(a):not(button):not(input):not(select):not(textarea), [onclick-al], [role=button]:not(button)').forEach(function (el) {
      if (isMine(el) || el.dataset.alKb) return;
      el.dataset.alKb = '1';
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      if (!el.getAttribute('role')) el.setAttribute('role', 'button');
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
      fixes.keyboard++;
    });
    document.querySelectorAll('[tabindex]').forEach(function (el) { if (!isMine(el) && parseInt(el.getAttribute('tabindex'), 10) > 0) { el.setAttribute('tabindex', '0'); fixes.keyboard++; } });
  }
  function fixMisc() {
    var h = document.documentElement;
    if (!h.getAttribute('lang')) { h.setAttribute('lang', (navigator.language || 'en').split('-')[0]); fixes.lang = 1; }
    document.querySelectorAll('iframe:not([title])').forEach(function (f) { f.setAttribute('title', 'Embedded content'); fixes.frames++; });
    document.querySelectorAll('[class*=modal],[class*=dialog],[id*=modal],[id*=dialog]').forEach(function (m) {
      if (isMine(m) || m.getAttribute('role') || m.tagName === 'DIALOG' || m.dataset.alDlg) return;
      if (m.querySelector('button,a,input') && getComputedStyle(m).position === 'fixed') {
        m.dataset.alDlg = '1'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); fixes.dialogs++;
      }
    });
    var vp = document.querySelector('meta[name=viewport]');
    if (vp && /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(vp.content)) vp.content = 'width=device-width, initial-scale=1';
  }
  function addSkipLink() {
    if (document.querySelector('.al-skip') || !document.body) return;
    var target = document.querySelector('main,[role=main],#main,#content,h1');
    if (!target) return;
    if (!target.id) target.id = 'al-main-content';
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    var a = document.createElement('a');
    a.className = 'al-skip'; a.href = '#' + target.id; a.textContent = 'Skip to main content';
    document.body.insertBefore(a, document.body.firstChild);
    fixes.skip = 1;
  }
  function focusables(scope) {
    return Array.prototype.filter.call(scope.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'), function (e) { return e.offsetParent !== null; });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var dlg = Array.prototype.find.call(document.querySelectorAll('[role=dialog][aria-modal=true],dialog[open]'), function (d) { return !isMine(d) && d.offsetParent !== null; });
    if (!dlg) return;
    var f = focusables(dlg);
    if (!f.length) return;
    if (!dlg.contains(document.activeElement)) { e.preventDefault(); f[0].focus(); return; }
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });
  function remediate() {
    if (!AUTOFIX || !cfg.autofix) return;
    try { fixMisc(); addSkipLink(); fixImages(); fixForms(); fixButtons(); fixKeyboard(); fixContrast(); } catch (e) { /* never break host page */ }
    renderState();
  }
  var moTimer;
  var mo = new MutationObserver(function () { clearTimeout(moTimer); moTimer = setTimeout(remediate, 600); });

  /* ---------- speech ---------- */
  var audio = null;
  function stopSpeech() {
    if (audio) { audio.pause(); audio = null; }
    if (window.speechSynthesis) speechSynthesis.cancel();
    document.querySelectorAll('.al-reading-hl').forEach(function (e) { e.classList.remove('al-reading-hl'); });
  }
  function browserSpeak(text, lang) {
    if (!window.speechSynthesis) return Promise.resolve();
    return new Promise(function (res) {
      var u = new SpeechSynthesisUtterance(text);
      u.lang = lang; u.rate = 1;
      u.onend = res; u.onerror = res;
      speechSynthesis.speak(u);
    });
  }
  function speak(text, el) {
    stopSpeech();
    text = (text || '').replace(/\s+/g, ' ').trim().slice(0, 1400);
    if (!text) return Promise.resolve();
    if (el) el.classList.add('al-reading-hl');
    var done = function () { if (el) el.classList.remove('al-reading-hl'); };
    if (cfg.sarvam && VOICE_ON) {
      return postJSON('/tts', { text: text, lang: prefs.lang }).then(function (r) {
        audio = new Audio('data:' + r.mime_type + ';base64,' + r.audio_base64);
        return new Promise(function (res) { audio.onended = res; audio.onerror = res; audio.play().catch(res); });
      }).catch(function () { return browserSpeak(text, prefs.lang); }).finally(done);
    }
    return browserSpeak(text, prefs.lang).finally(done);
  }
  function mainText() {
    var m = document.querySelector('main,[role=main],article') || document.body;
    var parts = [];
    m.querySelectorAll('h1,h2,h3,p,li').forEach(function (e) { if (!isMine(e) && e.offsetParent !== null && parts.join(' ').length < 1400) parts.push(e.textContent.trim()); });
    return parts.join('. ');
  }
  var clickRead = false;
  document.addEventListener('click', function (e) {
    if (!clickRead || isMine(e.target) || e.target === host) return;
    var el = e.target.closest('p,h1,h2,h3,h4,h5,h6,li,td,th,label,button,a,span,div');
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    speak(el.getAttribute('aria-label') || el.getAttribute('alt') || el.textContent, el);
  }, true);

  /* ---------- voice commands ---------- */
  var elRefs = [];
  function collectElements() {
    elRefs = [];
    var out = [];
    document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button],h1,h2,h3,nav,footer').forEach(function (el) {
      if (isMine(el) || el.offsetParent === null || out.length >= 120) return;
      var label = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('title') || (el.textContent || '').trim().slice(0, 80) || el.getAttribute('name') || '';
      if (!label && !/INPUT|SELECT|TEXTAREA/.test(el.tagName)) return;
      elRefs.push(el);
      out.push({ i: out.length, tag: el.tagName.toLowerCase() + (el.type ? ':' + el.type : ''), label: label });
    });
    return out;
  }
  function execCommand(cmd) {
    var el = cmd.index != null ? elRefs[cmd.index] : null;
    switch (cmd.action) {
      case 'CLICK': if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); el.click(); } break;
      case 'FOCUS': if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); } break;
      case 'FILL_FORM':
        if (el && 'value' in el) {
          el.scrollIntoView({ block: 'center' }); el.focus();
          var setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
          if (setter && setter.set) setter.set.call(el, cmd.value || ''); else el.value = cmd.value || '';
          el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        break;
      case 'SCROLL':
        var v = (cmd.value || 'down').toLowerCase();
        if (v === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
        else if (v === 'bottom') window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        else if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else window.scrollBy({ top: (v === 'up' ? -1 : 1) * window.innerHeight * 0.8, behavior: 'smooth' });
        break;
      case 'READ_TEXT': speak(el ? el.textContent : mainText(), el); return;
      case 'GO_BACK': history.back(); break;
      case 'SET_MODE':
        var m = (cmd.value || '').toLowerCase();
        if (m === 'contrast') prefs.contrast = 'high';
        else if (m === 'dyslexia') prefs.font = 'dyslexic';
        else if (m === 'bigger') prefs.zoom = Math.min(200, prefs.zoom + 20);
        else if (m === 'smaller') prefs.zoom = Math.max(80, prefs.zoom - 20);
        else if (m === 'reset') prefs = Object.assign({}, DEF, { lang: prefs.lang });
        applyPrefs(); break;
    }
    if (cmd.reply) speak(cmd.reply);
  }
  function encodeWav(buf) {
    var rate = 16000, data = buf.getChannelData(0), len = data.length;
    var out = new DataView(new ArrayBuffer(44 + len * 2));
    function str(o, s) { for (var i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); }
    str(0, 'RIFF'); out.setUint32(4, 36 + len * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
    out.setUint32(24, rate, true); out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true);
    str(36, 'data'); out.setUint32(40, len * 2, true);
    for (var i = 0; i < len; i++) { var s = Math.max(-1, Math.min(1, data[i])); out.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
    return new Blob([out], { type: 'audio/wav' });
  }
  function toWav(blob) {
    return blob.arrayBuffer().then(function (ab) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      return new Ctx().decodeAudioData(ab);
    }).then(function (decoded) {
      var off = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
      var src = off.createBufferSource(); src.buffer = decoded; src.connect(off.destination); src.start();
      return off.startRendering();
    }).then(encodeWav);
  }
  var rec = null, recTimer = null, listening = false;
  function setVoiceStatus(t, transcript) {
    if (!root) return;
    root.getElementById('al-voice-status').textContent = t;
    if (transcript !== undefined) root.getElementById('al-voice-heard').textContent = transcript ? '“' + transcript + '”' : '';
    var b = root.getElementById('al-mic');
    b.setAttribute('aria-pressed', listening ? 'true' : 'false');
    b.querySelector('span').textContent = listening ? 'Stop listening' : 'Speak a command';
  }
  function handleTranscriptResult(r) {
    setVoiceStatus(r.command && r.command.reply ? r.command.reply : 'Done', r.transcript);
    if (r.command) execCommand(r.command);
  }
  function startVoice() {
    if (listening) { stopVoice(); return; }
    var els = collectElements();
    if (cfg.sarvam && navigator.mediaDevices && window.MediaRecorder) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        var chunks = [];
        rec = new MediaRecorder(stream);
        rec.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
        rec.onstop = function () {
          stream.getTracks().forEach(function (t) { t.stop(); });
          listening = false; setVoiceStatus('Understanding…');
          toWav(new Blob(chunks, { type: rec.mimeType })).then(function (wav) {
            var fd = new FormData();
            fd.append('file', wav, 'voice.wav'); fd.append('lang', prefs.lang); fd.append('elements', JSON.stringify(els));
            return api('/voice', { method: 'POST', body: fd });
          }).then(handleTranscriptResult).catch(function () { setVoiceStatus('Voice service unavailable. Try again.'); });
        };
        rec.start(); listening = true; setVoiceStatus('Listening… speak now (auto-stops in 7s)', '');
        recTimer = setTimeout(stopVoice, 7000);
      }).catch(function () { setVoiceStatus('Microphone permission denied'); });
      return;
    }
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setVoiceStatus('Voice input is not supported in this browser'); return; }
    var r = new SR(); r.lang = prefs.lang; r.interimResults = false;
    r.onresult = function (e) {
      var t = e.results[0][0].transcript;
      setVoiceStatus('Understanding…', t);
      postJSON('/command', { transcript: t, lang: prefs.lang, elements: els }).then(handleTranscriptResult).catch(function () { setVoiceStatus('Could not process command'); });
    };
    r.onend = function () { listening = false; setVoiceStatus(root.getElementById('al-voice-status').textContent); };
    r.onerror = function () { listening = false; setVoiceStatus('Did not catch that — try again'); };
    rec = r; r.start(); listening = true; setVoiceStatus('Listening…', '');
  }
  function stopVoice() {
    clearTimeout(recTimer);
    if (rec) { try { rec.stop(); } catch (e) { /* noop */ } }
    listening = false;
  }

  /* ---------- axe scan ---------- */
  function loadAxe() {
    if (window.axe) return Promise.resolve(window.axe);
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
      s.onload = function () { res(window.axe); }; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  var lastScan = null;
  function runScan() {
    var btn = root.getElementById('al-scan');
    if (btn.getAttribute('aria-busy') === 'true') return Promise.resolve();
    btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Scanning page…';
    return loadAxe().then(function (axe) {
      return axe.run({ exclude: [['#accesslayer-root']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, resultTypes: ['violations'] });
    }).then(function (res) {
      var v = res.violations.map(function (x) { return { id: x.id, impact: x.impact, help: x.help, description: x.description, helpUrl: x.helpUrl, tags: x.tags, nodes: x.nodes.slice(0, 5).map(function (n) { return { html: n.html, target: n.target }; }) }; });
      lastScan = { violations: v, passes: (res.passes || []).length };
      return postJSON('/report', { url: location.href, violations: v, passes: lastScan.passes }).catch(function () {
        var P = { critical: 25, serious: 12, moderate: 5, minor: 2 }, c = { critical: 0, serious: 0, moderate: 0, minor: 0 }, sc = 100;
        v.forEach(function (x) { c[x.impact || 'minor']++; sc -= P[x.impact || 'minor']; });
        return { a11y_score: Math.max(0, sc), counts: c };
      });
    }).then(function (r) { lastScan.score = r.a11y_score; lastScan.counts = r.counts; renderScan(); announce('Scan complete. Score ' + r.a11y_score + ' out of 100'); })
      .catch(function () { root.getElementById('al-scan-out').textContent = 'Scan failed to load. Check your connection.'; })
      .finally(function () { btn.removeAttribute('aria-busy'); btn.textContent = 'Re-scan this page'; });
  }

  /* ---------- UI (Shadow DOM) ---------- */
  var host = document.createElement('div');
  host.id = 'accesslayer-root';
  host.setAttribute('data-testid', 'accesslayer-widget-host');
  var root = null;
  var UI_CSS = [
    ":host{all:initial}",
    "*{box-sizing:border-box;font-family:'Atkinson Hyperlegible',system-ui,-apple-system,Segoe UI,sans-serif}",
    ".fab{position:fixed;bottom:22px;" + POS + ":22px;z-index:2147483647;width:62px;height:62px;border-radius:50%;border:3px solid #fff;background:#047857;color:#fff;cursor:pointer;box-shadow:0 10px 30px rgba(4,120,87,.45);display:grid;place-items:center;transition:transform .2s}",
    ".fab:hover{transform:scale(1.07)}.fab:focus-visible{outline:4px solid #F59E0B;outline-offset:3px}",
    ".panel{position:fixed;bottom:96px;" + POS + ":22px;z-index:2147483647;width:380px;max-width:calc(100vw - 24px);max-height:min(720px,calc(100vh - 120px));overflow:auto;background:#0B0F19;color:#F9FAFB;border:1px solid #374151;border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.5);display:none;font-size:15px}",
    ".panel.open{display:block;animation:pop .22s ease-out}@keyframes pop{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}",
    "header{position:sticky;top:0;background:#0B0F19;padding:16px 18px 12px;border-bottom:1px solid #1F2937;display:flex;align-items:center;justify-content:space-between;z-index:1}",
    "h2{margin:0;font-size:17px;font-weight:700}.sub{font-size:12px;color:#9CA3AF;margin-top:2px}",
    "section{padding:14px 18px;border-bottom:1px solid #1F2937}",
    "h3{margin:0 0 10px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#34D399;font-weight:700}",
    ".grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}",
    "button.opt{background:#111827;color:#F9FAFB;border:1px solid #374151;border-radius:12px;padding:10px 8px;font-size:13px;font-weight:600;cursor:pointer;text-align:left;min-height:44px;transition:background-color .15s,border-color .15s}",
    "button.opt:hover{border-color:#10B981}button.opt[aria-pressed=true]{background:#065F46;border-color:#34D399}",
    "button:focus-visible,select:focus-visible{outline:3px solid #F59E0B;outline-offset:2px}",
    ".row{display:flex;align-items:center;gap:8px}.zoomv{min-width:56px;text-align:center;font-weight:700}",
    ".icon{background:#111827;color:#fff;border:1px solid #374151;border-radius:10px;width:44px;height:44px;cursor:pointer;font-size:18px;font-weight:700}",
    ".close{background:transparent;border:1px solid #374151;color:#fff;border-radius:10px;width:40px;height:40px;cursor:pointer;font-size:18px}",
    ".primary{width:100%;background:#10B981;color:#04130D;border:none;border-radius:999px;padding:12px;font-weight:700;font-size:14px;cursor:pointer;min-height:44px}",
    ".primary:disabled{opacity:.6;cursor:wait}.ghost{width:100%;background:transparent;color:#F9FAFB;border:1px solid #374151;border-radius:999px;padding:10px;font-weight:600;cursor:pointer;margin-top:8px;min-height:44px}",
    "select{width:100%;background:#111827;color:#F9FAFB;border:1px solid #374151;border-radius:10px;padding:10px;font-size:14px;margin-bottom:8px}",
    ".mic{display:flex;align-items:center;justify-content:center;gap:8px}.mic[aria-pressed=true]{background:#F59E0B}",
    ".status{font-size:13px;color:#D1D5DB;margin-top:8px;min-height:18px}.heard{font-size:13px;color:#34D399;font-style:italic}",
    ".score{display:flex;align-items:center;gap:14px;margin-top:12px}.ring{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:20px}",
    ".chips{display:flex;gap:6px;flex-wrap:wrap}.chip{font-size:11px;padding:3px 8px;border-radius:999px;font-weight:700}",
    ".c-critical{background:#7F1D1D;color:#FECACA}.c-serious{background:#7C2D12;color:#FED7AA}.c-moderate{background:#78350F;color:#FDE68A}.c-minor{background:#1E3A8A;color:#BFDBFE}",
    "ul{margin:10px 0 0;padding-left:18px;font-size:13px;color:#D1D5DB}li{margin-bottom:4px}",
    ".fixes{font-size:13px;color:#D1D5DB;line-height:1.6}.fixes b{color:#fff}",
    ".foot{padding:12px 18px;font-size:11px;color:#9CA3AF;text-align:center}",
    ".sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}",
    "@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}"
  ].join('\n');
  var A11Y_ICON = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="4" r="2" fill="#fff"/><path d="M4 8.5c2.6.7 5.3 1 8 1s5.4-.3 8-1M12 9.5v5m0 0l-3.5 7m3.5-7l3.5 7" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>';
  function opt(id, label, pressed) { return '<button class="opt" data-testid="al-' + id + '" id="al-' + id + '" aria-pressed="' + (pressed ? 'true' : 'false') + '">' + label + '</button>'; }
  function build() {
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>' + UI_CSS + '</style>' +
      '<button class="fab" id="al-fab" data-testid="al-fab" aria-label="Open accessibility menu (Alt+A)" aria-expanded="false" aria-controls="al-panel">' + A11Y_ICON + '</button>' +
      '<div class="panel" id="al-panel" role="dialog" aria-modal="false" aria-labelledby="al-title" data-testid="al-panel">' +
      '<header><div><h2 id="al-title">Accessibility</h2><div class="sub">AccessLayer · Alt+A to toggle</div></div><button class="close" id="al-close" data-testid="al-close" aria-label="Close accessibility menu">✕</button></header>' +
      '<section aria-labelledby="h-vis"><h3 id="h-vis">Vision</h3><div class="grid">' +
      opt('c-high', 'High contrast') + opt('c-dark', 'Dark mode') + opt('c-invert', 'Invert colours') + opt('c-mono', 'Monochrome') + opt('c-light', 'Light contrast') + opt('links', 'Highlight links') +
      '</div><div class="row" style="margin-top:12px"><button class="icon" id="al-zoom-out" data-testid="al-zoom-out" aria-label="Decrease text size">A−</button><div class="zoomv" id="al-zoom-v" data-testid="al-zoom-value" aria-live="polite">100%</div><button class="icon" id="al-zoom-in" data-testid="al-zoom-in" aria-label="Increase text size">A+</button></div></section>' +
      '<section aria-labelledby="h-read"><h3 id="h-read">Reading & dyslexia</h3><div class="grid">' +
      opt('f-dyslexic', 'Dyslexia font') + opt('f-readable', 'Readable font') + opt('spacing', 'Text spacing +') + opt('guide', 'Reading guide') + opt('read-page', 'Read page aloud') + opt('click-read', 'Click to read') +
      '</div></section>' +
      '<section aria-labelledby="h-motor"><h3 id="h-motor">Motor & keyboard</h3><div class="grid">' +
      opt('focus', 'Focus highlight') + opt('cursor', 'Big cursor') + opt('motion', 'Stop animations') + opt('skip-main', 'Jump to content') +
      '</div></section>' +
      '<section aria-labelledby="h-voice"><h3 id="h-voice">Voice control <span id="al-engine" style="color:#9CA3AF;text-transform:none;letter-spacing:0;font-weight:600"></span></h3>' +
      '<label class="sr" for="al-lang">Voice language</label><select id="al-lang" data-testid="al-lang">' + LANGS.map(function (l) { return '<option value="' + l[0] + '">' + l[1] + '</option>'; }).join('') + '</select>' +
      '<button class="primary mic" id="al-mic" data-testid="al-mic" aria-pressed="false"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" stroke-width="2"/><path d="M5 11a7 7 0 0014 0M12 18v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Speak a command</span></button>' +
      '<div class="status" id="al-voice-status" data-testid="al-voice-status" aria-live="polite">Try: “scroll down”, “click contact”, “नीचे जाओ”</div><div class="heard" id="al-voice-heard" data-testid="al-voice-heard"></div></section>' +
      '<section aria-labelledby="h-scan"><h3 id="h-scan">Page health (axe-core)</h3><button class="primary" id="al-scan" data-testid="al-scan">Scan this page</button><div id="al-scan-out" data-testid="al-scan-out" aria-live="polite"></div></section>' +
      '<section aria-labelledby="h-fix"><h3 id="h-fix">Auto-fixes applied</h3><div class="fixes" id="al-fixes" data-testid="al-fixes"></div></section>' +
      '<div style="padding:0 18px 4px"><button class="ghost" id="al-reset" data-testid="al-reset">Reset all settings</button></div>' +
      '<div class="foot">Powered by AccessLayer · WCAG 2.1 AA</div><div class="sr" id="al-live" aria-live="assertive"></div></div>';
    document.documentElement.appendChild(host);
    var $ = function (id) { return root.getElementById(id); };
    var panel = $('al-panel'), fab = $('al-fab');
    function toggle(open) {
      var o = open === undefined ? !panel.classList.contains('open') : open;
      panel.classList.toggle('open', o); fab.setAttribute('aria-expanded', o ? 'true' : 'false');
      if (o) setTimeout(function () { $('al-close').focus(); }, 30); else fab.focus();
    }
    fab.onclick = function () { toggle(); };
    $('al-close').onclick = function () { toggle(false); };
    panel.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') toggle(false);
      if (e.key === 'Tab') {
        var f = Array.prototype.slice.call(panel.querySelectorAll('button:not([disabled]),select'));
        var a = root.activeElement;
        if (e.shiftKey && a === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && a === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.altKey && (e.key === 'a' || e.key === 'A' || e.code === 'KeyA')) { e.preventDefault(); toggle(); }
      else if (e.key === 'Escape' && panel.classList.contains('open') && !panel.contains(root.activeElement)) toggle(false);
    });
    ['high', 'dark', 'invert', 'mono', 'light'].forEach(function (c) { $('al-c-' + c).onclick = function () { prefs.contrast = prefs.contrast === c ? 'none' : c; applyPrefs(); }; });
    ['dyslexic', 'readable'].forEach(function (f) { $('al-f-' + f).onclick = function () { var was = prefs.font === 'dyslexic'; prefs.font = prefs.font === f ? 'default' : f; if (prefs.font === 'dyslexic') prefs.spacing = true; else if (was) prefs.spacing = false; applyPrefs(); }; });
    ['spacing', 'cursor', 'focus', 'links', 'motion', 'guide'].forEach(function (k) { $('al-' + k).onclick = function () { prefs[k] = !prefs[k]; applyPrefs(); }; });
    $('al-zoom-in').onclick = function () { prefs.zoom = Math.min(200, prefs.zoom + 10); applyPrefs(); };
    $('al-zoom-out').onclick = function () { prefs.zoom = Math.max(80, prefs.zoom - 10); applyPrefs(); };
    var reading = false;
    $('al-read-page').onclick = function () {
      if (reading) { stopSpeech(); reading = false; renderState(); return; }
      reading = true; renderState(); speak(mainText()).finally(function () { reading = false; renderState(); });
    };
    $('al-read-page').isReading = function () { return reading; };
    $('al-click-read').onclick = function () { clickRead = !clickRead; if (!clickRead) stopSpeech(); renderState(); announce(clickRead ? 'Click any text to hear it' : 'Click to read off'); };
    $('al-skip-main').onclick = function () {
      var t = document.querySelector('main,[role=main],#main,#content,h1');
      if (t) { if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1'); toggle(false); t.scrollIntoView(); t.focus(); }
    };
    $('al-lang').value = prefs.lang;
    $('al-lang').onchange = function (e) { prefs.lang = e.target.value; save(); };
    $('al-mic').onclick = startVoice;
    $('al-scan').onclick = runScan;
    $('al-reset').onclick = function () { stopSpeech(); clickRead = false; prefs = Object.assign({}, DEF); $('al-lang').value = prefs.lang; applyPrefs(); announce('Settings reset'); };
    renderState();
  }
  function announce(t) { if (root) { var l = root.getElementById('al-live'); l.textContent = ''; setTimeout(function () { l.textContent = t; }, 50); } }
  function renderState() {
    if (!root || !root.getElementById('al-panel')) return;
    var $ = function (id) { return root.getElementById(id); };
    ['high', 'dark', 'invert', 'mono', 'light'].forEach(function (c) { $('al-c-' + c).setAttribute('aria-pressed', prefs.contrast === c); });
    $('al-f-dyslexic').setAttribute('aria-pressed', prefs.font === 'dyslexic');
    $('al-f-readable').setAttribute('aria-pressed', prefs.font === 'readable');
    ['spacing', 'cursor', 'focus', 'links', 'motion', 'guide'].forEach(function (k) { $('al-' + k).setAttribute('aria-pressed', !!prefs[k]); });
    $('al-click-read').setAttribute('aria-pressed', clickRead);
    var rp = $('al-read-page'); var isR = rp.isReading && rp.isReading();
    rp.setAttribute('aria-pressed', !!isR); rp.textContent = isR ? 'Stop reading' : 'Read page aloud';
    $('al-zoom-v').textContent = prefs.zoom + '%';
    $('al-engine').textContent = cfg.sarvam && VOICE_ON ? '· Sarvam AI' : '· browser';
    var aiImgs = document.querySelectorAll('img[data-al-alt=ai]').length;
    $('al-fixes').innerHTML = !AUTOFIX || !cfg.autofix ? 'Auto-fix is turned off for this site.' :
      '<b>' + fixes.images + '</b> images given alt text' + (aiImgs ? ' (' + aiImgs + ' by AI vision)' : '') + '<br><b>' + fixes.labels + '</b> form fields labelled<br><b>' + fixes.buttons + '</b> buttons/links named<br><b>' + fixes.keyboard + '</b> controls made keyboard-accessible<br>' + (fixes.contrast ? '<b>' + fixes.contrast + '</b> low-contrast texts fixed to WCAG 4.5:1<br>' : '') +
      (fixes.skip ? '<b>✓</b> Skip-to-content link added<br>' : '') + (fixes.lang ? '<b>✓</b> Page language set<br>' : '') + (fixes.dialogs ? '<b>' + fixes.dialogs + '</b> dialogs given role + focus trap<br>' : '') + (fixes.frames ? '<b>' + fixes.frames + '</b> iframes titled' : '');
  }
  function ringColor(s) { return s >= 90 ? '#10B981' : s >= 60 ? '#F59E0B' : '#EF4444'; }
  function renderScan() {
    var out = root.getElementById('al-scan-out');
    var s = lastScan.score, c = lastScan.counts || {};
    var esc = function (t) { return String(t).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); };
    out.innerHTML = '<div class="score"><div class="ring" data-testid="al-score" style="border:5px solid ' + ringColor(s) + '">' + s + '</div><div><div style="font-weight:700">Score ' + s + '/100</div><div class="chips" style="margin-top:6px">' +
      ['critical', 'serious', 'moderate', 'minor'].map(function (k) { return '<span class="chip c-' + k + '">' + (c[k] || 0) + ' ' + k + '</span>'; }).join('') + '</div></div></div>' +
      (lastScan.violations.length ? '<ul>' + lastScan.violations.slice(0, 6).map(function (v) { return '<li>' + esc(v.help) + ' <span style="color:#9CA3AF">(' + v.nodes.length + ')</span></li>'; }).join('') + '</ul>' : '<p style="font-size:13px;color:#34D399">No violations detected.</p>');
  }

  function init() {
    applyPrefs();
    build();
    fetch(API + '/widget/' + encodeURIComponent(SITE) + '/config').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
      .then(function (c) { Object.assign(cfg, c); remediate(); renderState(); if (document.body) mo.observe(document.body, { childList: true, subtree: true }); });
    window.AccessLayer = { open: function () { root.getElementById('al-fab').click(); }, scan: runScan, prefs: function () { return Object.assign({}, prefs); }, speak: speak,
      destroy: function () {
        mo.disconnect(); stopSpeech(); stopVoice(); clickRead = false;
        [host, styleEl, guide, document.querySelector('.al-skip')].forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); });
        document.documentElement.className = document.documentElement.className.replace(/\bal-[\w-]+/g, '').trim();
        window.__accessLayer = false; delete window.AccessLayer;
      } };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
