'use strict';

window.DhikrView = (function () {
  let activeKeydown = null;

  function render(container, { adhkar }, { onChange } = {}) {
    let idx = 0;
    let count = 0;

    const actions = {
      next() {
        idx = (idx + 1) % adhkar.length;
        count = 0;
        paint();
      },
      prev() {
        idx = (idx - 1 + adhkar.length) % adhkar.length;
        count = 0;
        paint();
      },
      tap() {
        count++;
        const el = container.querySelector('#counter-num');
        if (el) el.textContent = count;
      },
      reset() {
        count = 0;
        const el = container.querySelector('#counter-num');
        if (el) el.textContent = count;
      },
    };

    function paint() {
      const item = adhkar[idx];
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
          <p class="shortcut-hint">← → navigate · Space tap · R reset</p>
        </div>
      `;
      container.querySelectorAll('[data-act]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const act = e.currentTarget.dataset.act;
          if (actions[act]) actions[act]();
          if (onChange) onChange({ idx, count });
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
