(function () {
  'use strict';

  var DATA_URL = '/data/competency-matrix.v1.json';

  /* ── state ──────────────────────────────────────────────── */

  var data = null;
  var roleFilter = '';
  var groupFilter = '';
  var searchQuery = '';
  var onlyWeighted = false;
  var sortMode = 'groups';
  var compareRole = '';
  var expandedSkillId = null;

  /* ── DOM refs (set in init) ────────────────────────────── */

  var appEl, filtersEl, wrapEl, tooltipEl;
  var hoveredColIdx = null;
  var currentTipCell = null;

  /* ── helpers ────────────────────────────────────────────── */

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                     .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function findSkill(id) {
    for (var i = 0; i < data.skills.length; i++) {
      if (data.skills[i].id === id) return data.skills[i];
    }
    return null;
  }

  /** "lvl2" → "2", null/empty → "—" */
  function lvlLabel(tgt) {
    if (!tgt) return '\u2014';
    var m = tgt.match(/^lvl(\d)$/);
    return m ? m[1] : '\u2014';
  }

  /** numeric level for sorting: lvl3→3 … lvl0→0, missing→-1 */
  function lvlOrder(skill, role) {
    var tgt = skill.targets && skill.targets[role];
    if (!tgt) return -1;
    var m = tgt.match(/^lvl(\d)$/);
    return m ? parseInt(m[1], 10) : -1;
  }

  /** delta between two roles; null if either level unknown */
  function calcDelta(skill, roleA, roleB) {
    var a = lvlOrder(skill, roleA);
    var b = lvlOrder(skill, roleB);
    if (a === -1 || b === -1) return null;
    return a - b;
  }

  /* ── URL ↔ state ────────────────────────────────────────── */

  function syncURL() {
    var p = new URLSearchParams();
    if (roleFilter) p.set('role', roleFilter);
    if (groupFilter) p.set('group', groupFilter);
    if (searchQuery) p.set('q', searchQuery);
    if (onlyWeighted) p.set('weighted', '1');
    if (sortMode !== 'groups') p.set('sort', sortMode);
    if (compareRole) p.set('cmp', compareRole);
    if (expandedSkillId) p.set('expand', expandedSkillId);
    var qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
  }

  function readURL() {
    var p = new URLSearchParams(location.search);
    roleFilter = p.get('role') || '';
    groupFilter = p.get('group') || '';
    searchQuery = p.get('q') || '';
    onlyWeighted = p.get('weighted') === '1';
    sortMode = p.get('sort') || 'groups';
    expandedSkillId = p.get('expand') || null;
    compareRole = p.get('cmp') || '';
    /* validate against loaded data */
    if (roleFilter && data.roles.indexOf(roleFilter) === -1) roleFilter = '';
    if (compareRole && (data.roles.indexOf(compareRole) === -1 || compareRole === roleFilter)) compareRole = '';
    if (sortMode === 'role' && !roleFilter) sortMode = 'groups';
    if (sortMode === 'delta' && !(roleFilter && compareRole)) sortMode = 'groups';
    if (groupFilter) {
      var ok = false;
      for (var i = 0; i < data.groups.length; i++) {
        if (data.groups[i].id === groupFilter) { ok = true; break; }
      }
      if (!ok) groupFilter = '';
    }
    if (expandedSkillId && !findSkill(expandedSkillId)) expandedSkillId = null;
  }

  /* ── filters ────────────────────────────────────────────── */

  function renderFilters() {
    var h = '<div class="hm-filters">';

    /* Role */
    h += '<div class="hm-filter-item"><label for="hm-role">Роль</label>';
    h += '<select id="hm-role"><option value="">Все</option>';
    data.roles.forEach(function (r) {
      h += '<option value="' + esc(r) + '"' + (roleFilter === r ? ' selected' : '') + '>' + esc(r) + '</option>';
    });
    h += '</select></div>';

    /* Compare with — always visible; disabled when no role selected */
    h += '<div class="hm-filter-item"><label for="hm-cmp">\u0421\u0440\u0430\u0432\u043d\u0438\u0442\u044c \u0441\u2026</label>';
    if (roleFilter) {
      h += '<select id="hm-cmp"><option value="">\u2014</option>';
      data.roles.forEach(function (r) {
        if (r === roleFilter) return;
        h += '<option value="' + esc(r) + '"' + (compareRole === r ? ' selected' : '') + '>' + esc(r) + '</option>';
      });
      h += '</select>';
    } else {
      h += '<select id="hm-cmp" disabled title="\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0440\u043e\u043b\u044c"><option value="">\u2014</option></select>';
    }
    h += '</div>';

    /* Group */
    h += '<div class="hm-filter-item"><label for="hm-group">Группа</label>';
    h += '<select id="hm-group"><option value="">Все</option>';
    data.groups.forEach(function (g) {
      h += '<option value="' + esc(g.id) + '"' + (groupFilter === g.id ? ' selected' : '') + '>' + esc(g.title) + '</option>';
    });
    h += '</select></div>';

    /* Search */
    h += '<div class="hm-filter-item hm-filter-search"><label for="hm-search">Поиск</label>';
    h += '<input type="text" id="hm-search" placeholder="Название навыка\u2026" value="' + esc(searchQuery) + '"></div>';

    /* Only weighted */
    h += '<div class="hm-filter-item hm-filter-check-wrap">';
    h += '<label class="hm-filter-check"><input type="checkbox" id="hm-weighted"' + (onlyWeighted ? ' checked' : '') + '>';
    h += ' Только важное</label></div>';

    /* Sort mode */
    h += '<div class="hm-filter-item"><label for="hm-sort">Сортировка</label>';
    h += '<select id="hm-sort">';
    h += '<option value="groups"' + (sortMode === 'groups' ? ' selected' : '') + '>По группам</option>';
    h += '<option value="role"' + (sortMode === 'role' ? ' selected' : '') + (!roleFilter ? ' disabled' : '') + '>\u041f\u043e \u0440\u043e\u043b\u0438 \u2193</option>';
    h += '<option value="delta"' + (sortMode === 'delta' ? ' selected' : '') + (!(roleFilter && compareRole) ? ' disabled' : '') + '>\u041f\u043e \u0440\u0430\u0437\u043d\u0438\u0446\u0435 \u0394</option>';
    h += '</select></div>';

    /* Copy link */
    h += '<button class="hm-copy-link" id="hm-copy-link" type="button">\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0441\u0441\u044b\u043b\u043a\u0443</button>';

    h += '</div>';
    filtersEl.innerHTML = h;
  }

  function getFilteredSkills() {
    var q = searchQuery.toLowerCase().trim();
    return data.skills.filter(function (s) {
      if (groupFilter && s.group_id !== groupFilter) return false;
      if (q && s.title.toLowerCase().indexOf(q) === -1) return false;
      if (onlyWeighted) {
        if (roleFilter) {
          if (!s.weights[roleFilter]) return false;
        } else {
          var any = false;
          for (var i = 0; i < data.roles.length; i++) {
            if (s.weights[data.roles[i]]) { any = true; break; }
          }
          if (!any) return false;
        }
      }
      return true;
    });
  }

  /* ── summary ─────────────────────────────────────────────── */

  function renderSummary(filtered) {
    var el = document.getElementById('hm-summary');
    if (!el) return;
    var total = filtered.length;

    /* weighted count */
    var wCnt = 0;
    filtered.forEach(function (s) {
      if (roleFilter) {
        if (s.weights && s.weights[roleFilter]) wCnt++;
      } else {
        for (var i = 0; i < data.roles.length; i++) {
          if (s.weights && s.weights[data.roles[i]]) { wCnt++; break; }
        }
      }
    });

    var h = '<span class="hm-sum-item">' + esc(roleFilter || '\u0412\u0441\u0435 \u0440\u043e\u043b\u0438') + '</span>';
    h += '<span class="hm-sum-dot">\u00b7</span>';
    h += '<span class="hm-sum-item">\u041d\u0430\u0432\u044b\u043a\u043e\u0432: <strong>' + total + '</strong></span>';
    h += '<span class="hm-sum-dot">\u00b7</span>';
    h += '<span class="hm-sum-item">\u0412\u0430\u0436\u043d\u044b\u0445: <strong>' + wCnt + '</strong></span>';

    if (roleFilter) {
      var d = [0, 0, 0, 0], growth = 0;
      filtered.forEach(function (s) {
        var tgt = (s.targets && s.targets[roleFilter]) || 'lvl0';
        var m = tgt.match(/^lvl(\d)$/);
        var n = m ? parseInt(m[1], 10) : 0;
        d[n]++;
        if (n <= 1) growth++;
      });
      h += '<span class="hm-sum-dot">\u00b7</span>';
      h += '<span class="hm-sum-item">lvl3: ' + d[3] + '</span>';
      h += '<span class="hm-sum-dot">\u00b7</span>';
      h += '<span class="hm-sum-item">lvl2: ' + d[2] + '</span>';
      h += '<span class="hm-sum-dot">\u00b7</span>';
      h += '<span class="hm-sum-item">lvl1: ' + d[1] + '</span>';
      h += '<span class="hm-sum-dot">\u00b7</span>';
      h += '<span class="hm-sum-item">lvl0: ' + d[0] + '</span>';
      h += '<span class="hm-sum-dot">\u00b7</span>';
      h += '<span class="hm-sum-item hm-sum-growth">\u0417\u043e\u043d\u044b \u0440\u043e\u0441\u0442\u0430: <strong>' + growth + '</strong></span>';
      if (compareRole) {
        var gapN = 0, winN = 0, minDelta = 0;
        filtered.forEach(function (s) {
          var dd = calcDelta(s, roleFilter, compareRole);
          if (dd === null) return;
          if (dd < 0) gapN++;
          if (dd > 0) winN++;
          if (dd < minDelta) minDelta = dd;
        });
        h += '<span class="hm-sum-dot">\u00b7</span>';
        h += '<span class="hm-sum-item">' + esc(roleFilter) + ' vs ' + esc(compareRole) + '</span>';
        h += '<span class="hm-sum-dot">\u00b7</span>';
        h += '<span class="hm-sum-item">Gap (\u0394&lt;0): <strong>' + gapN + '</strong></span>';
        h += '<span class="hm-sum-dot">\u00b7</span>';
        h += '<span class="hm-sum-item">Strong (\u0394&gt;0): <strong>' + winN + '</strong></span>';
        h += '<span class="hm-sum-dot">\u00b7</span>';
        h += '<span class="hm-sum-item">Max gap: <strong>' + minDelta + '</strong></span>';
      }
    } else {
      h += '<span class="hm-sum-dot">\u00b7</span>';
      h += '<span class="hm-sum-item hm-sum-hint">\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0440\u043e\u043b\u044c \u0434\u043b\u044f \u0434\u0438\u0430\u0433\u043d\u043e\u0441\u0442\u0438\u043a\u0438</span>';
    }

    el.innerHTML = h;
  }

  /* ── table ──────────────────────────────────────────────── */

  function renderTable() {
    var filtered = getFilteredSkills();
    renderSummary(filtered);

    if (!filtered.length) {
      wrapEl.innerHTML = '<div class="hm-empty">Ничего не найдено. Попробуйте изменить фильтры.</div>';
      syncURL();
      return;
    }

    var roles = data.roles;
    var colCount = roles.length + 1;

    var h = '<table class="hm-table"><thead><tr>';
    h += '<th>Навык</th>';
    roles.forEach(function (r, i) {
      var cls = 'hm-th-role';
      if (roleFilter === r) cls += ' hm-col-selected';
      h += '<th class="' + cls + '" data-col-idx="' + (i + 1) + '" data-role="' + esc(r) + '">' + esc(r) + '</th>';
    });
    h += '</tr></thead><tbody>';

    data.groups.forEach(function (grp) {
      var skills = filtered.filter(function (s) { return s.group_id === grp.id; });
      if (!skills.length) return;

      /* sort within group */
      if (sortMode === 'delta' && roleFilter && compareRole) {
        skills.sort(function (a, b) {
          var da = calcDelta(a, roleFilter, compareRole);
          var db = calcDelta(b, roleFilter, compareRole);
          var aa = da !== null ? Math.abs(da) : -1;
          var ab = db !== null ? Math.abs(db) : -1;
          if (ab !== aa) return ab - aa;
          if (da !== db) return (da !== null ? da : 0) - (db !== null ? db : 0);
          var wa = (a.weights && a.weights[roleFilter]) || 0;
          var wb = (b.weights && b.weights[roleFilter]) || 0;
          if (wb !== wa) return wb - wa;
          return a.title.localeCompare(b.title);
        });
      } else if (sortMode === 'role' && roleFilter) {
        skills.sort(function (a, b) {
          var la = lvlOrder(a, roleFilter);
          var lb = lvlOrder(b, roleFilter);
          if (lb !== la) return lb - la;
          var wa = (a.weights && a.weights[roleFilter]) || 0;
          var wb = (b.weights && b.weights[roleFilter]) || 0;
          if (wb !== wa) return wb - wa;
          return a.title.localeCompare(b.title);
        });
      }

      h += '<tr class="hm-group-row"><td colspan="' + colCount + '">' + esc(grp.title) + '</td></tr>';

      skills.forEach(function (skill) {
        h += '<tr class="hm-skill-row" data-skill-id="' + esc(skill.id) + '" tabindex="0">';
        h += '<td class="hm-skill-name">' + esc(skill.title) + '</td>';

        roles.forEach(function (r, i) {
          var tgt = (skill.targets && skill.targets[r]) || 'lvl0';
          var cls = 'hm-cell hm-cell--' + tgt;
          if (roleFilter === r) cls += ' hm-col-selected';
          var cellHtml = lvlLabel(tgt);
          if (compareRole && roleFilter === r) {
            var delta = calcDelta(skill, roleFilter, compareRole);
            if (delta !== null) {
              var dcls = delta > 0 ? 'hm-delta--pos' : (delta < 0 ? 'hm-delta--neg' : 'hm-delta--zero');
              var dtxt = delta > 0 ? ('+' + delta) : (delta < 0 ? ('\u2212' + Math.abs(delta)) : '0');
              cellHtml += '<span class="hm-delta ' + dcls + '">' + dtxt + '</span>';
            }
          }
          h += '<td class="' + cls + '" data-col-idx="' + (i + 1) + '" data-skill-id="' + esc(skill.id) + '" data-role="' + esc(r) + '">' + cellHtml + '</td>';
        });

        h += '</tr>';

        if (expandedSkillId === skill.id) {
          h += renderExpanded(skill);
        }
      });
    });

    h += '</tbody></table>';
    wrapEl.innerHTML = h;

    /* A) data-selected-role on wrapper — drives CSS column muting */
    if (roleFilter) {
      wrapEl.setAttribute('data-selected-role', roleFilter);
    } else {
      wrapEl.removeAttribute('data-selected-role');
    }

    syncURL();
  }

  function renderExpanded(skill) {
    var colCount = data.roles.length + 1;
    var levels = ['lvl1', 'lvl2', 'lvl3'];

    var h = '<tr class="hm-expanded-row"><td colspan="' + colCount + '"><div class="hm-expanded-content">';

    /* Level descriptions */
    h += '<div class="hm-expanded-levels">';
    levels.forEach(function (lvl) {
      var desc = skill.desc_levels && skill.desc_levels[lvl];
      if (!desc) return;
      var def = data.level_defs[lvl] || '';
      h += '<div class="hm-expanded-level">';
      h += '<div class="hm-expanded-level-tag">' + esc(lvl) + ' \u2014 ' + esc(def) + '</div>';
      h += '<p>' + esc(desc) + '</p></div>';
    });
    h += '</div>';

    /* Targets per role */
    h += '<div class="hm-expanded-targets">';
    h += data.roles.map(function (r) {
      return '<span>' + esc(r) + ':\u00a0<strong>' + esc((skill.targets && skill.targets[r]) || '\u2014') + '</strong></span>';
    }).join(' \u00b7 ');
    h += '</div>';

    h += '<button class="hm-collapse-btn" type="button">\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c</button>';
    h += '</div></td></tr>';
    return h;
  }

  /* ── tooltip ────────────────────────────────────────────── */

  function showTooltip(cell) {
    var sid = cell.getAttribute('data-skill-id');
    var role = cell.getAttribute('data-role');
    if (!sid || !role) return;

    var skill = findSkill(sid);
    if (!skill) return;

    var tgt = (skill.targets && skill.targets[role]) || 'lvl0';
    var def = data.level_defs[tgt] || '';
    var desc = (skill.desc_levels && skill.desc_levels[tgt]) || '';
    var w = skill.weights[role] != null ? skill.weights[role] : 0;

    var meaning = (tgt === 'lvl0' || !tgt)
      ? '\u043f\u043e\u043a\u0430 \u043d\u0435 \u043e\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044f \u043d\u0430 \u044d\u0442\u043e\u043c \u0443\u0440\u043e\u0432\u043d\u0435.'
      : (desc || '');

    var h = '<div class="hm-tooltip-title">' + esc(skill.title) + '</div>';
    h += '<div class="hm-tooltip-role">\u0420\u043e\u043b\u044c: ' + esc(role) + '</div>';
    h += '<div class="hm-tooltip-sep"></div>';
    h += '<div class="hm-tooltip-level">' + esc(tgt) + ' \u2014 ' + esc(def) + '</div>';
    if (meaning) h += '<div class="hm-tooltip-meaning">\u0427\u0442\u043e \u044d\u0442\u043e \u043e\u0437\u043d\u0430\u0447\u0430\u0435\u0442: ' + esc(meaning) + '</div>';
    h += '<div class="hm-tooltip-weight">Weight: ' + w + '</div>';

    if (compareRole && roleFilter) {
      var cmpD = calcDelta(skill, roleFilter, compareRole);
      var cmpTxt = cmpD !== null ? String(cmpD) : '\u2014';
      h += '<div class="hm-tooltip-cmp">\u0421\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u0435: ' + esc(roleFilter) + ' vs ' + esc(compareRole) + ' \u2192 \u0394\u00a0=\u00a0' + cmpTxt + '</div>';
    }

    tooltipEl.innerHTML = h;
    positionTooltip(cell.getBoundingClientRect());
  }

  function hideTooltip() {
    tooltipEl.setAttribute('aria-hidden', 'true');
    currentTipCell = null;
  }

  function positionTooltip(rect) {
    var gap = 8;
    var tt = tooltipEl;

    /* show off-screen to measure */
    tt.style.left = '0';
    tt.style.top = '0';
    tt.style.visibility = 'hidden';
    tt.setAttribute('aria-hidden', 'false');

    var ttW = tt.offsetWidth;
    var ttH = tt.offsetHeight;
    var vpW = window.innerWidth;
    var vpH = window.innerHeight;

    /* prefer right of cell */
    var left = rect.right + gap;
    if (left + ttW > vpW - 12) left = rect.left - ttW - gap;
    if (left < 12) left = 12;

    /* align top of cell */
    var top = rect.top;
    if (top + ttH > vpH - 12) top = vpH - ttH - 12;
    if (top < 12) top = 12;

    tt.style.left = left + 'px';
    tt.style.top = top + 'px';
    tt.style.visibility = '';
  }

  /* ── column highlight ───────────────────────────────────── */

  function highlightCol(idx) {
    var els = wrapEl.querySelectorAll('[data-col-idx="' + idx + '"]');
    for (var i = 0; i < els.length; i++) els[i].classList.add('hm-col-hover');
  }

  function clearColHighlight() {
    var els = wrapEl.querySelectorAll('.hm-col-hover');
    for (var i = 0; i < els.length; i++) els[i].classList.remove('hm-col-hover');
  }

  /* ── events (delegation) ────────────────────────────────── */

  function bindEvents() {

    /* -- Filter controls -- */

    filtersEl.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'hm-role') {
        roleFilter = t.value;
        if (!roleFilter || compareRole === roleFilter) compareRole = '';
        if (!roleFilter && sortMode === 'role') sortMode = 'groups';
        if (!compareRole && sortMode === 'delta') sortMode = 'groups';
      }
      else if (t.id === 'hm-cmp') {
        compareRole = t.value;
        if (!compareRole && sortMode === 'delta') sortMode = 'groups';
      }
      else if (t.id === 'hm-group') groupFilter = t.value;
      else if (t.id === 'hm-weighted') onlyWeighted = t.checked;
      else if (t.id === 'hm-sort') sortMode = t.value;
      expandedSkillId = null;
      renderFilters();
      renderTable();
    });

    filtersEl.addEventListener('click', function (e) {
      if (e.target.id === 'hm-copy-link') {
        navigator.clipboard.writeText(location.href).then(function () {
          var btn = document.getElementById('hm-copy-link');
          if (!btn) return;
          btn.textContent = '\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u043e!';
          btn.classList.add('hm-copy-done');
          setTimeout(function () {
            btn.textContent = '\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0441\u0441\u044b\u043b\u043a\u0443';
            btn.classList.remove('hm-copy-done');
          }, 1500);
        });
      }
    });

    filtersEl.addEventListener('input', function (e) {
      if (e.target.id === 'hm-search') {
        searchQuery = e.target.value;
        expandedSkillId = null;
        renderTable();
      }
    });

    /* -- Table click — expand / collapse -- */

    wrapEl.addEventListener('click', function (e) {
      if (e.target.closest('.hm-collapse-btn')) {
        expandedSkillId = null;
        hideTooltip();
        renderTable();
        return;
      }
      var row = e.target.closest('.hm-skill-row');
      if (row) {
        var sid = row.getAttribute('data-skill-id');
        expandedSkillId = (expandedSkillId === sid) ? null : sid;
        hideTooltip();
        renderTable();
      }
    });

    /* -- Tooltip & column highlight (mouseover delegation) -- */

    wrapEl.addEventListener('mouseover', function (e) {
      /* column */
      var colEl = e.target.closest('[data-col-idx]');
      if (colEl) {
        var idx = colEl.getAttribute('data-col-idx');
        if (idx !== hoveredColIdx) {
          clearColHighlight();
          highlightCol(idx);
          hoveredColIdx = idx;
        }
      } else if (hoveredColIdx !== null) {
        clearColHighlight();
        hoveredColIdx = null;
      }

      /* tooltip */
      var cell = e.target.closest('.hm-cell');
      if (cell && cell !== currentTipCell) {
        currentTipCell = cell;
        showTooltip(cell);
      } else if (!cell && currentTipCell) {
        hideTooltip();
      }
    });

    wrapEl.addEventListener('mouseleave', function () {
      hideTooltip();
      clearColHighlight();
      hoveredColIdx = null;
    });

    /* -- Keyboard -- */

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hideTooltip();
    });

    wrapEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var row = e.target.closest('.hm-skill-row');
        if (row) {
          var sid = row.getAttribute('data-skill-id');
          expandedSkillId = (expandedSkillId === sid) ? null : sid;
          renderTable();
          e.preventDefault();
        }
      }
    });
  }

  /* ── init ───────────────────────────────────────────────── */

  function init() {
    appEl = document.getElementById('app');
    if (!appEl) return;

    /* tooltip lives on body — outside any overflow container */
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'hm-tooltip';
    tooltipEl.setAttribute('role', 'tooltip');
    tooltipEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tooltipEl);

    appEl.innerHTML = '<p style="color:#999;">Загрузка матрицы\u2026</p>';

    fetch(DATA_URL)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (json) {
        data = json;
        readURL();

        appEl.innerHTML =
          '<h1>Диагностика компетенций аналитика</h1>' +
          '<p class="subtitle">Интерактивная диагностика: где вы сейчас, чего не хватает до следующего уровня и на чём фокусироваться.</p>' +
          '<div id="hm-filters"></div>' +
          '<div class="hm-legend">' +
            '<span class="hm-legend-item"><span class="hm-legend-chip hm-cell--lvl0">0</span> нет</span>' +
            '<span class="hm-legend-item"><span class="hm-legend-chip hm-cell--lvl1">1</span> базовый</span>' +
            '<span class="hm-legend-item"><span class="hm-legend-chip hm-cell--lvl2">2</span> уверенный</span>' +
            '<span class="hm-legend-item"><span class="hm-legend-chip hm-cell--lvl3">3</span> эксперт</span>' +
          '</div>' +
          '<div id="hm-summary" class="hm-summary"></div>' +
          '<div id="hm-wrap" class="hm-table-wrap"></div>';

        filtersEl = document.getElementById('hm-filters');
        wrapEl = document.getElementById('hm-wrap');

        renderFilters();
        renderTable();
        bindEvents();
      })
      .catch(function (err) {
        console.error('heatmap.js:', err);
        appEl.innerHTML =
          '<div class="hm-error">' +
          'Не удалось загрузить данные матрицы. Попробуйте обновить страницу.' +
          '</div>';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
