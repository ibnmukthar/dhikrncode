'use strict';

window.DhikrView = (function () {
  let activeKeydown = null;
  const STORAGE_KEY = 'dhikrncode.tasbeeh.v1';
  const LIFETIME_KEY = 'dhikrncode.tasbeeh.lifetime.v1';

  // Per-dhikr counter, keyed by arabic text so it survives reorderings
  // and additions to adhkar.json. {arabic: count}
  function loadCounters() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
    } catch {
      return {};
    }
  }
  function saveCounters(map) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {}
  }
  function loadLifetime() {
    try {
      return parseInt(localStorage.getItem(LIFETIME_KEY) || '0', 10) || 0;
    } catch {
      return 0;
    }
  }
  function saveLifetime(n) {
    try {
      localStorage.setItem(LIFETIME_KEY, String(n));
    } catch {}
  }

  function render(container, { adhkar }, { onChange } = {}) {
    let idx = 0;
    const counters = loadCounters();
    let lifetime = loadLifetime();

    const currentArabic = () => adhkar[idx].arabic;
    const getCount = () => counters[currentArabic()] || 0;
    const setCount = (n) => {
      counters[currentArabic()] = n;
      saveCounters(counters);
    };

    const actions = {
      next() {
        idx = (idx + 1) % adhkar.length;
        paint();
      },
      prev() {
        idx = (idx - 1 + adhkar.length) % adhkar.length;
        paint();
      },
      tap() {
        const next = getCount() + 1;
        setCount(next);
        lifetime += 1;
        saveLifetime(lifetime);
        const el = container.querySelector('#counter-num');
        if (el) el.textContent = next;
        const lt = container.querySelector('#lifetime-num');
        if (lt) lt.textContent = lifetime.toLocaleString();
      },
      reset() {
        setCount(0);
        const el = container.querySelector('#counter-num');
        if (el) el.textContent = 0;
      },
    };

    function paint() {
      const item = adhkar[idx];
      const count = getCount();
      container.innerHTML = `
        <div class="dhikr-card">
          <p class="dhikr-arabic">${escapeHtml(item.arabic)}</p>
          <p class="dhikr-translit">${escapeHtml(item.transliteration || '')}</p>
          <p class="dhikr-translation">${escapeHtml(item.translation)}</p>
          <div class="dhikr-actions">
            <button class="btn-icon" data-act="prev" aria-label="Previous (←)" title="Previous (←)">‹</button>
            <span class="counter">
              <span>tasbeeh</span>
              <span class="counter-num" id="counter-num">${count}</span>
              <button class="btn-icon" data-act="tap" aria-label="Tap (Space)" title="Tap (Space)">+</button>
              <button class="btn-icon" data-act="reset" aria-label="Reset (R)" title="Reset (R)">↺</button>
            </span>
            <button class="btn-icon" data-act="next" aria-label="Next (→)" title="Next (→)">›</button>
          </div>
          <p class="shortcut-hint">
            ← → navigate · Space tap · R reset
            · lifetime <span id="lifetime-num">${lifetime.toLocaleString()}</span>
          </p>
        </div>
      `;
      container.querySelectorAll('[data-act]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const act = e.currentTarget.dataset.act;
          if (actions[act]) actions[act]();
          if (onChange) onChange({ idx, count: getCount() });
        });
      });
    }

    if (activeKeydown) document.removeEventListener('keydown', activeKeydown);
    activeKeydown = (e) => {
      if (isTypingTarget(e.target)) return;
      switch (e.key) {
        case 'ArrowRight':
        case 'l':
          actions.next();
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'h':
          actions.prev();
          e.preventDefault();
          break;
        case ' ':
        case 'ArrowDown':
        case 'j':
          actions.tap();
          e.preventDefault();
          break;
        case 'r':
        case 'R':
        case '0':
          actions.reset();
          e.preventDefault();
          break;
      }
    };
    document.addEventListener('keydown', activeKeydown);

    paint();
  }

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || el.isContentEditable;
  }

  function escapeHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }

  return { render };
})();
