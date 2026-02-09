(function () {
  'use strict';

  var DATA_URL = '/data/test-tasks.v1.json';

  var data = null;
  var searchQuery = '';
  var gradeFilter = '';
  var tagFilter = '';
  var onlyDataset = false;
  var onlyNew = false;
  var sortMode = 'relevance';

  var appEl, filtersEl, presetsEl, gridEl, counterEl;
  var debounceTimer = null;

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                     .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var PRESETS = ['SQL', 'Python', 'A/B', '\u041a\u0435\u0439\u0441', 'Dashboard', 'Excel'];
  var GRADE_ORDER = {Intern: 0, Junior: 1, Middle: 2, Senior: 3, Unknown: 99};

  var ROLE_HEADS = ['аналитик','analyst','scientist','ds','engineer','developer','manager','lead','head','researcher'];
  var ROLE_MODS = [
    'продуктовый','продуктовая','продуктовому','данных','дата','маркетинговый','бизнес',
    'коммерческий','игровой','старший','ведущий',
    'product','data','business','marketing','bi','power','web-mobile','web','mobile',
    'fraud','risk','reporting','growth','ml','sql','ab','a/b'
  ];

  function parseCompanyPosition(str) {
    if (!str) return { company: '', position: '' };
    var s = str.trim().replace(/\s+/g, ' ');
    if (!s) return { company: '', position: '' };
    // Explicit delimiters (first occurrence)
    var sep = [' \u2014 ', ' - ', ' | '];
    for (var i = 0; i < sep.length; i++) {
      var idx = s.indexOf(sep[i]);
      if (idx > 0) {
        var co = s.substring(0, idx).trim();
        var po = s.substring(idx + sep[i].length).trim();
        if (co.length < 2) return { company: s, position: '' };
        if (po.length < 2) po = '';
        return { company: co, position: po };
      }
    }
    // Token heuristic; normalize to NFC for safe comparison (possible normalization difference in data)
    var tokens = s.split(' ');
    var lower = tokens.map(function (t) { return t.toLowerCase().normalize('NFC'); });
    var headIdx = -1;
    for (var i = 0; i < lower.length - 1; i++) {
      if (lower[i] === 'data' && lower[i + 1] === 'scientist') { headIdx = i; break; }
    }
    if (headIdx === -1) {
      for (var i = 0; i < lower.length; i++) {
        if (ROLE_HEADS.indexOf(lower[i]) !== -1) { headIdx = i; break; }
      }
    }
    if (headIdx === -1) return { company: s, position: '' };
    var sp = headIdx;
    while (sp > 0 && ROLE_MODS.indexOf(lower[sp - 1]) !== -1) sp--;
    if (sp === 0) return { company: s, position: '' };
    var co = tokens.slice(0, sp).join(' ');
    var po = tokens.slice(sp).join(' ');
    if (co.length < 2) return { company: s, position: '' };
    if (po.length < 2) po = '';
    return { company: co, position: po };
  }

  function renderPresets() {
    var h = '<div class="tt-presets">';
    PRESETS.forEach(function (tag) {
      var active = tagFilter === tag ? ' tt-preset--active' : '';
      h += '<button type="button" class="tt-preset' + active + '" data-tag="' + esc(tag) + '">' + esc(tag) + '</button>';
    });
    h += '</div>';
    presetsEl.innerHTML = h;
  }

  function renderFilters() {
    var h = '<div class="tt-filters">';

    h += '<div class="tt-filter-item tt-filter-search"><label for="tt-search">Поиск</label>';
    h += '<input type="text" id="tt-search" placeholder="Компания или позиция\u2026" value="' + esc(searchQuery) + '"></div>';

    h += '<div class="tt-filter-item"><label for="tt-grade">Грейд</label>';
    h += '<select id="tt-grade"><option value="">Все</option>';
    data.dictionaries.grades.forEach(function (g) {
      h += '<option value="' + esc(g) + '"' + (gradeFilter === g ? ' selected' : '') + '>' + esc(g) + '</option>';
    });
    h += '</select></div>';

    h += '<div class="tt-filter-item"><label for="tt-tag">Тег</label>';
    h += '<select id="tt-tag"><option value="">Все</option>';
    data.dictionaries.tags.forEach(function (t) {
      h += '<option value="' + esc(t) + '"' + (tagFilter === t ? ' selected' : '') + '>' + esc(t) + '</option>';
    });
    h += '</select></div>';

    h += '<div class="tt-filter-item"><label for="tt-sort">Сортировка</label>';
    h += '<select id="tt-sort">';
    h += '<option value="relevance"' + (sortMode === 'relevance' ? ' selected' : '') + '>\u041f\u043e \u0440\u0435\u043b\u0435\u0432\u0430\u043d\u0442\u043d\u043e\u0441\u0442\u0438</option>';
    h += '<option value="alpha"' + (sortMode === 'alpha' ? ' selected' : '') + '>\u041f\u043e \u043a\u043e\u043c\u043f\u0430\u043d\u0438\u0438 (A\u2192Z)</option>';
    h += '<option value="new"' + (sortMode === 'new' ? ' selected' : '') + '>\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u043d\u043e\u0432\u044b\u0435</option>';
    h += '</select></div>';

    h += '<div class="tt-filter-item tt-filter-check-wrap">';
    h += '<label class="tt-filter-check"><input type="checkbox" id="tt-dataset"' + (onlyDataset ? ' checked' : '') + '> С датасетом</label></div>';

    h += '<div class="tt-filter-item tt-filter-check-wrap">';
    h += '<label class="tt-filter-check"><input type="checkbox" id="tt-new"' + (onlyNew ? ' checked' : '') + '> New</label></div>';

    h += '</div>';
    filtersEl.innerHTML = h;
  }

  function getFiltered() {
    var q = searchQuery.toLowerCase().normalize('NFC').trim();
    var list = data.items.filter(function (item) {
      if (q && item.title.toLowerCase().normalize('NFC').indexOf(q) === -1) return false;
      if (gradeFilter && item.grade !== gradeFilter) return false;
      if (tagFilter && item.tags.indexOf(tagFilter) === -1) return false;
      if (onlyDataset && !item.dataset) return false;
      if (onlyNew && !item.is_new) return false;
      return true;
    });

    if (sortMode === 'relevance') {
      list.sort(function (a, b) {
        if (a.is_new !== b.is_new) return a.is_new ? -1 : 1;
        if (a.dataset !== b.dataset) return a.dataset ? -1 : 1;
        var ga = GRADE_ORDER[a.grade] != null ? GRADE_ORDER[a.grade] : 99;
        var gb = GRADE_ORDER[b.grade] != null ? GRADE_ORDER[b.grade] : 99;
        if (ga !== gb) return ga - gb;
        return a.title.localeCompare(b.title);
      });
    } else if (sortMode === 'new') {
      list.sort(function (a, b) {
        if (a.is_new !== b.is_new) return a.is_new ? -1 : 1;
        return a.title.localeCompare(b.title);
      });
    } else {
      list.sort(function (a, b) { return a.title.localeCompare(b.title); });
    }
    return list;
  }

  function gradeClass(g) {
    return 'tt-badge-grade--' + g.toLowerCase();
  }

  function renderCards() {
    var items = getFiltered();
    counterEl.innerHTML = '\u041f\u043e\u043a\u0430\u0437\u0430\u043d\u043e <strong>' + items.length + '</strong> \u0438\u0437 <strong>' + data.items.length + '</strong>';

    if (!items.length) {
      gridEl.innerHTML = '<div class="tt-empty">\u041d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0438\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u0444\u0438\u043b\u044c\u0442\u0440\u044b.</div>';
      return;
    }

    var h = '';
    items.forEach(function (item) {
      h += '<div class="tt-card">';
      var parsed = parseCompanyPosition(item.title);
      var shortCo = parsed.position && parsed.company.length <= 3;
      h += '<div class="tt-card-header">';
      h += '<div class="tt-card-title">' + esc(shortCo ? parsed.company + ' \u2014 ' + parsed.position : parsed.company) + '</div>';
      if (item.is_new) h += '<span class="tt-badge tt-badge-new">new</span>';
      h += '</div>';
      if (parsed.position && !shortCo) {
        h += '<div class="tt-card-position">' + esc(parsed.position) + '</div>';
      } else if (!parsed.position && /^unknown\s*\d*$/i.test(parsed.company)) {
        h += '<div class="tt-card-position tt-card-position--unknown">(\u043f\u043e\u0437\u0438\u0446\u0438\u044f \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0430)</div>';
      }

      h += '<div class="tt-card-meta">';
      h += '<span class="tt-badge tt-badge-grade ' + gradeClass(item.grade) + '">' + esc(item.grade) + '</span>';
      if (item.dataset) h += '<span class="tt-badge tt-badge-dataset">\u0414\u0430\u0442\u0430\u0441\u0435\u0442</span>';
      h += '</div>';

      if (item.tags.length) {
        h += '<div class="tt-tags">';
        item.tags.forEach(function (t) { h += '<span class="tt-tag">' + esc(t) + '</span>'; });
        h += '</div>';
      }

      h += '<div class="tt-card-cta"><a href="' + esc(item.url) + '" target="_blank" rel="noopener" class="tt-card-btn">\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043f\u0430\u043f\u043a\u0443 \u2197</a>';
      h += '<div class="tt-card-link-hint">Google Drive (\u043f\u0430\u043f\u043a\u0430)</div></div>';
      h += '</div>';
    });
    gridEl.innerHTML = h;
  }

  function render() { renderPresets(); renderCards(); }

  function bindEvents() {
    presetsEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.tt-preset');
      if (!btn) return;
      var tag = btn.getAttribute('data-tag');
      tagFilter = (tagFilter === tag) ? '' : tag;
      renderFilters();
      render();
    });

    filtersEl.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'tt-grade') gradeFilter = t.value;
      else if (t.id === 'tt-tag') tagFilter = t.value;
      else if (t.id === 'tt-dataset') onlyDataset = t.checked;
      else if (t.id === 'tt-new') onlyNew = t.checked;
      else if (t.id === 'tt-sort') sortMode = t.value;
      render();
    });

    filtersEl.addEventListener('input', function (e) {
      if (e.target.id === 'tt-search') {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          searchQuery = e.target.value;
          render();
        }, 200);
      }
    });
  }

  function init() {
    appEl = document.getElementById('tt-app');
    if (!appEl) return;

    appEl.innerHTML = '<p style="color:#999;">\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430\u2026</p>';

    fetch(DATA_URL)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (json) {
        data = json;

        appEl.innerHTML =
          '<div id="tt-presets"></div>' +
          '<div id="tt-filters"></div>' +
          '<div id="tt-counter" class="tt-counter"></div>' +
          '<div id="tt-grid" class="tt-grid"></div>';

        presetsEl = document.getElementById('tt-presets');
        filtersEl = document.getElementById('tt-filters');
        counterEl = document.getElementById('tt-counter');
        gridEl = document.getElementById('tt-grid');

        renderPresets();
        renderFilters();
        render();
        bindEvents();

        if (location.search && location.search.indexOf('debugParse=1') !== -1) {
          var samples = [
            'Aigrind \u041f\u0440\u043e\u0434\u0443\u043a\u0442\u043e\u0432\u044b\u0439 \u0410\u043d\u0430\u043b\u0438\u0442\u0438\u043a',
            'JetLend \u0410\u043d\u0430\u043b\u0438\u0442\u0438\u043a \u0414\u0430\u043d\u043d\u044b\u0445',
            'Datasfera \u0410\u043d\u0430\u043b\u0438\u0442\u0438\u043a Power BI',
            'Doctolib Business Data Analyst',
            'Aviasales Booking \u041f\u0440\u043e\u0434\u0443\u043a\u0442\u043e\u0432\u044b\u0439 \u0430\u043d\u0430\u043b\u0438\u0442\u0438\u043a',
            'BST Digital Data Scientist',
            'Bolt Fraud Analyst',
            'Sunlight \u0421\u0442\u0430\u0440\u0448\u0438\u0439 \u0410\u043d\u0430\u043b\u0438\u0442\u0438\u043a',
            'Unknown 3',
            'Amazon'
          ];
          console.group('parseCompanyPosition — hardcoded samples');
          samples.forEach(function (s) { console.log(s, '->', parseCompanyPosition(s)); });
          console.groupEnd();
          console.group('parseCompanyPosition — real data (first 10)');
          data.items.slice(0, 10).forEach(function (it) { console.log(it.title, '->', parseCompanyPosition(it.title)); });
          console.groupEnd();
          var nfcDiff = 0, nfdDiff = 0;
          data.items.forEach(function (it) {
            if (it.title !== it.title.normalize('NFC')) nfcDiff++;
            if (it.title !== it.title.normalize('NFD')) nfdDiff++;
          });
          console.group('Unicode normalization stats (' + data.items.length + ' titles)');
          console.log('Titles where raw !== NFC:', nfcDiff);
          console.log('Titles where raw !== NFD:', nfdDiff);
          if (nfcDiff > 0) console.warn(nfcDiff + ' titles have non-NFC codepoints; normalize("NFC") guard is active.');
          else console.log('All titles are already NFC — normalize() is a safe no-op.');
          console.groupEnd();
        }
      })
      .catch(function (err) {
        console.error('test-tasks.js:', err);
        appEl.innerHTML = '<div class="tt-empty">\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0435.</div>';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
