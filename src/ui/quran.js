'use strict';

window.QuranView = (function () {
  let activeKeydown = null;

  function render(container, initial, { showTranslation = true } = {}) {
    let surah = initial.surah;
    const surahs = initial.surahs || [];
    let ayahIdx = 0;

    const actions = {
      nextAyah() {
        if (ayahIdx < surah.ayahs.length - 1) {
          ayahIdx++;
          paint();
        }
      },
      prevAyah() {
        if (ayahIdx > 0) {
          ayahIdx--;
          paint();
        }
      },
      async nextSurah() {
        const i = surahs.findIndex((s) => s.number === surah.number);
        if (i >= 0 && i < surahs.length - 1) await loadAndShow(surahs[i + 1].number);
      },
      async prevSurah() {
        const i = surahs.findIndex((s) => s.number === surah.number);
        if (i > 0) await loadAndShow(surahs[i - 1].number);
      },
      focusSurah() {
        const sel = container.querySelector('#surah-select');
        if (sel) sel.focus();
      },
    };

    async function loadAndShow(num) {
      try {
        const r = await fetch('/api/surah/' + num);
        if (!r.ok) return;
        surah = await r.json();
        ayahIdx = 0;
        paint();
      } catch {}
    }

    function paint() {
      const ayah = surah.ayahs[ayahIdx];
      const options = surahs
        .map(
          (s) =>
            `<option value="${s.number}" ${s.number === surah.number ? 'selected' : ''}>` +
            `${s.number}. ${escapeHtml(s.englishName)} (${escapeHtml(s.name)})</option>`
        )
        .join('');

      container.innerHTML = `
        <div class="quran-card">
          <div class="quran-header">
            <div>
              <div class="quran-surah-name">${escapeHtml(surah.englishName)}
                <span class="quran-surah-meta">· ${escapeHtml(surah.name)}</span>
              </div>
              <div class="quran-surah-meta">${surah.ayahs.length} ayahs · ${escapeHtml(surah.revelationType || '')}</div>
            </div>
            <select class="quran-surah-select" id="surah-select" title="Surah (S to focus)">${options}</select>
          </div>

          <p class="quran-ayah-arabic">
            ${escapeHtml(ayah.arabic)}
            <span class="quran-ayah-num">${ayah.number}</span>
          </p>
          ${
            showTranslation && ayah.translation
              ? `<p class="quran-translation">${escapeHtml(ayah.translation)}</p>`
              : ''
          }

          <div class="quran-actions">
            <button class="btn-icon" data-act="prev" aria-label="Previous ayah (←)" title="Previous ayah (←)">‹</button>
            <span class="quran-progress">Ayah ${ayahIdx + 1} of ${surah.ayahs.length}</span>
            <button class="btn-icon" data-act="next" aria-label="Next ayah (→)" title="Next ayah (→)">›</button>
          </div>
          <p class="shortcut-hint">← → ayah · ↑ ↓ surah · S surah list</p>
        </div>
      `;

      container.querySelector('[data-act="prev"]').addEventListener('click', actions.prevAyah);
      container.querySelector('[data-act="next"]').addEventListener('click', actions.nextAyah);
      container.querySelector('#surah-select').addEventListener('change', async (e) => {
        await loadAndShow(parseInt(e.target.value, 10));
      });
    }

    if (activeKeydown) document.removeEventListener('keydown', activeKeydown);
    activeKeydown = (e) => {
      if (isTypingTarget(e.target)) return;
      switch (e.key) {
        case 'ArrowRight':
        case 'l':
          actions.nextAyah();
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'h':
          actions.prevAyah();
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 'j':
          actions.nextSurah();
          e.preventDefault();
          break;
        case 'ArrowUp':
        case 'k':
          actions.prevSurah();
          e.preventDefault();
          break;
        case 's':
        case 'S':
          actions.focusSurah();
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
    return String(s == null ? '' : s).replace(
      /[&<>"']/g,
      (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }

  return { render };
})();
