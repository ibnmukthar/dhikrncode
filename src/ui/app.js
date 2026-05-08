'use strict';

(function () {
  const els = {
    mode: document.getElementById('mode-label'),
    status: document.getElementById('status-pill'),
    content: document.getElementById('content'),
    banner: document.getElementById('ready-banner'),
    bannerMsg: document.getElementById('ready-message'),
    bannerIcon: document.getElementById('ready-icon'),
    countdown: document.getElementById('countdown'),
    extendBtn: document.getElementById('extend-btn'),
    closeBtn: document.getElementById('close-btn'),
  };

  let mode = 'dhikr';
  let pacing = { dhikrCloseSeconds: 5, quranCloseSeconds: 30, dhikrExtendSeconds: 15, quranExtendSeconds: 30 };
  let countdownTimer = null;
  let secondsLeft = 0;

  async function init() {
    const cfg = await fetch('/api/config').then((r) => r.json());
    mode = cfg.mode || 'dhikr';
    if (cfg.pacing) pacing = { ...pacing, ...cfg.pacing };
    els.mode.textContent = mode === 'quran' ? "qur'an" : 'dhikr';

    const data = await fetch('/api/content').then((r) => r.json());

    if (data.mode === 'quran') {
      window.QuranView.render(els.content, data, {
        showTranslation: cfg.quran ? cfg.quran.showTranslation : true,
      });
    } else {
      window.DhikrView.render(els.content, data);
    }

    if (window.SettingsPanel) window.SettingsPanel.init(cfg);
    connectWs();
    wireBanner();
  }

  function setStatus(label, cls) {
    els.status.textContent = label;
    els.status.className = 'status ' + (cls || '');
  }

  function connectWs() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.addEventListener('open', () => setStatus('connected'));
    ws.addEventListener('close', () => {
      setStatus('disconnected');
      setTimeout(connectWs, 1500);
    });
    ws.addEventListener('error', () => setStatus('disconnected'));
    ws.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'state') applyState(msg.state);
        else if (msg.type === 'config') applyConfig(msg.config);
      } catch {}
    });
  }

  function applyConfig(cfg) {
    if (cfg.pacing) pacing = { ...pacing, ...cfg.pacing };
    if (window.SettingsPanel) window.SettingsPanel.setConfig(cfg);
    // Mode change → reload to render the right view (cheaper than re-rendering
    // and rebinding all the keyboard handlers cleanly).
    if (cfg.mode && cfg.mode !== mode) {
      setTimeout(() => location.reload(), 200);
    }
  }

  function applyState(state) {
    if (state.phase === 'busy') {
      setStatus('agent working', 'busy');
      hideBanner();
    } else if (state.phase === 'ready') {
      setStatus(state.reason === 'approval' ? 'needs approval' : 'agent ready', 'ready');
      showBanner(state.reason);
    } else {
      setStatus('idle');
      hideBanner();
    }
  }

  function showBanner(reason) {
    els.banner.classList.remove('hidden');
    els.bannerMsg.textContent =
      reason === 'approval'
        ? 'Your coding agent needs your input.'
        : 'Your coding agent is done. Alhamdulillah.';
    els.bannerIcon.textContent = reason === 'approval' ? '!' : '✓';

    secondsLeft = mode === 'quran' ? pacing.quranCloseSeconds : pacing.dhikrCloseSeconds;
    els.extendBtn.textContent = mode === 'quran' ? 'Finish ayah (+30 s)' : 'Stay (+15 s)';
    runCountdown();
  }

  function hideBanner() {
    els.banner.classList.add('hidden');
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function runCountdown() {
    if (countdownTimer) clearInterval(countdownTimer);
    paintCountdown();
    countdownTimer = setInterval(() => {
      secondsLeft--;
      paintCountdown();
      if (secondsLeft <= 0) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        attemptClose();
      }
    }, 1000);
  }

  function paintCountdown() {
    els.countdown.textContent = secondsLeft + 's';
  }

  function attemptClose() {
    fetch('/done', { method: 'POST' }).catch(() => {});
    // window.close() works for chrome --app windows; otherwise the user closes manually.
    window.close();
    // If close was blocked, leave a friendly final state:
    setTimeout(() => {
      els.banner.innerHTML =
        '<div class="ready-text"><span>✓</span> You can close this tab now.</div>';
    }, 200);
  }

  function extend() {
    const seconds =
      mode === 'quran' ? pacing.quranExtendSeconds : pacing.dhikrExtendSeconds;
    secondsLeft += seconds;
    paintCountdown();
    if (!countdownTimer) runCountdown();
  }

  function wireBanner() {
    els.extendBtn.addEventListener('click', extend);
    els.closeBtn.addEventListener('click', attemptClose);
    els.extendBtn.title = 'Extend (E)';
    els.closeBtn.title = 'Close (Esc / C)';

    document.addEventListener('keydown', (e) => {
      if (els.banner.classList.contains('hidden')) return;
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        attemptClose();
        e.preventDefault();
      } else if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '=') {
        extend();
        e.preventDefault();
      }
    });
  }

  init().catch((err) => {
    els.content.innerHTML =
      '<div class="loading">Failed to load: ' + (err && err.message) + '</div>';
  });
})();
