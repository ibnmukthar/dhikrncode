'use strict';

window.SettingsPanel = (function () {
  let cachedSurahs = null;

  function el(id) {
    return document.getElementById(id);
  }

  async function loadSurahList() {
    if (cachedSurahs) return cachedSurahs;
    try {
      const r = await fetch('/api/surahs');
      if (r.ok) {
        cachedSurahs = await r.json();
        return cachedSurahs;
      }
    } catch {}
    cachedSurahs = [{ number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha' }];
    return cachedSurahs;
  }

  async function fillSurahSelect(current) {
    const select = el('settings-surah');
    if (!select) return;
    const surahs = await loadSurahList();
    select.innerHTML = surahs
      .map(
        (s) =>
          `<option value="${s.number}" ${s.number === current ? 'selected' : ''}>${s.number}. ${escapeHtml(s.englishName)} (${escapeHtml(s.name)})</option>`
      )
      .join('');
  }

  function setField(name, value) {
    const fields = document.querySelectorAll(`[name="${name}"]`);
    fields.forEach((f) => {
      if (f.type === 'checkbox') f.checked = !!value;
      else if (f.type === 'radio') f.checked = String(f.value) === String(value);
      else f.value = value == null ? '' : value;
    });
  }

  function readForm() {
    const form = el('settings-form');
    const data = new FormData(form);
    const out = {};
    function set(path, value) {
      const parts = path.split('.');
      let cur = out;
      for (let i = 0; i < parts.length - 1; i++) {
        cur[parts[i]] = cur[parts[i]] || {};
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
    }

    set('mode', data.get('mode') || 'dhikr');
    set('quran.surah', parseInt(data.get('quran.surah'), 10) || 1);
    set(
      'quran.showTranslation',
      form.querySelector('[name="quran.showTranslation"]').checked
    );
    set(
      'notifications.enabled',
      form.querySelector('[name="notifications.enabled"]').checked
    );
    set('notifications.repeat', parseInt(data.get('notifications.repeat'), 10) || 1);
    set(
      'notifications.repeatIntervalSeconds',
      parseInt(data.get('notifications.repeatIntervalSeconds'), 10) || 30
    );
    set(
      'pacing.dhikrCloseSeconds',
      parseInt(data.get('pacing.dhikrCloseSeconds'), 10) || 5
    );
    set(
      'pacing.quranCloseSeconds',
      parseInt(data.get('pacing.quranCloseSeconds'), 10) || 30
    );
    set(
      'integrations.claudeCode.enabled',
      form.querySelector('[name="integrations.claudeCode.enabled"]').checked
    );
    set(
      'integrations.claudeDesktop.enabled',
      form.querySelector('[name="integrations.claudeDesktop.enabled"]').checked
    );
    set(
      'integrations.manual.enabled',
      form.querySelector('[name="integrations.manual.enabled"]').checked
    );
    return out;
  }

  function populate(cfg) {
    setField('mode', cfg.mode);
    setField('quran.showTranslation', cfg.quran && cfg.quran.showTranslation);
    setField('notifications.enabled', cfg.notifications && cfg.notifications.enabled);
    setField('notifications.repeat', cfg.notifications ? cfg.notifications.repeat : 1);
    setField(
      'notifications.repeatIntervalSeconds',
      cfg.notifications ? cfg.notifications.repeatIntervalSeconds : 30
    );
    setField('pacing.dhikrCloseSeconds', cfg.pacing ? cfg.pacing.dhikrCloseSeconds : 5);
    setField('pacing.quranCloseSeconds', cfg.pacing ? cfg.pacing.quranCloseSeconds : 30);
    setField(
      'integrations.claudeCode.enabled',
      cfg.integrations && cfg.integrations.claudeCode
        ? cfg.integrations.claudeCode.enabled
        : true
    );
    setField(
      'integrations.claudeDesktop.enabled',
      cfg.integrations && cfg.integrations.claudeDesktop
        ? cfg.integrations.claudeDesktop.enabled
        : false
    );
    setField(
      'integrations.manual.enabled',
      cfg.integrations && cfg.integrations.manual
        ? cfg.integrations.manual.enabled
        : true
    );
    fillSurahSelect(cfg.quran ? cfg.quran.surah : 1);
  }

  async function save(prevMode) {
    const patch = readForm();
    const status = el('settings-status');
    status.textContent = 'Saving…';
    try {
      const r = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error('save failed');
      const next = await r.json();
      status.textContent = 'Saved.';
      // Mode changed → reload to render the right view.
      if (next.mode !== prevMode) {
        setTimeout(() => location.reload(), 250);
      } else {
        setTimeout(() => {
          status.textContent = '';
          close();
        }, 800);
      }
    } catch (err) {
      status.textContent = 'Save failed: ' + err.message;
    }
  }

  let isOpen = false;
  let currentCfg = null;

  function open() {
    if (!currentCfg) return;
    populate(currentCfg);
    el('settings-panel').classList.remove('hidden');
    el('settings-panel').setAttribute('aria-hidden', 'false');
    isOpen = true;
  }
  function close() {
    el('settings-panel').classList.add('hidden');
    el('settings-panel').setAttribute('aria-hidden', 'true');
    isOpen = false;
  }
  function toggle() {
    isOpen ? close() : open();
  }

  function init(cfg) {
    currentCfg = cfg;
    el('settings-btn').addEventListener('click', toggle);
    el('settings-close').addEventListener('click', close);
    el('settings-form').addEventListener('submit', (e) => {
      e.preventDefault();
      save(currentCfg.mode);
    });

    document.addEventListener('keydown', (e) => {
      const tag = e.target && e.target.tagName;
      const typing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
      if (e.key === 'Escape' && isOpen) {
        close();
        e.preventDefault();
      } else if (e.key === ',' && !typing && !isOpen) {
        open();
        e.preventDefault();
      }
    });
  }

  function setConfig(cfg) {
    currentCfg = cfg;
    if (isOpen) populate(cfg);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(
      /[&<>"']/g,
      (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }

  return { init, open, close, toggle, setConfig };
})();
