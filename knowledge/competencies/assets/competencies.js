(function () {
  'use strict';

  var DATA_URL = '/knowledge/competencies/data/competencies.v1.json';

  /* ── helpers ─────────────────────────────────────────────── */

  function esc(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function bullets(arr, cls) {
    if (!arr || !arr.length) return '';
    return '<ul class="' + cls + '">' +
      arr.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') +
      '</ul>';
  }

  /* ── detect page ────────────────────────────────────────── */

  function detectPage(tracks) {
    var path = window.location.pathname.replace(/\/+$/, '') + '/';
    for (var i = 0; i < tracks.length; i++) {
      var pages = tracks[i].pages;
      for (var j = 0; j < pages.length; j++) {
        if (path.indexOf(pages[j].path) !== -1) {
          return { track: tracks[i], page: pages[j] };
        }
      }
    }
    return null;
  }

  /* ── diagnostics renderer ─────────────────────────────────── */

  function renderDiagnostics(diag) {
    if (!diag) return '';
    var html = '<div class="diagnostic-section">';
    html += '<h2>' + esc(diag.title) + '</h2>';
    html += '<p class="diagnostic-subtitle">' + esc(diag.subtitle) + '</p>';
    html += '<ul class="diagnostic-list">';
    diag.rules.forEach(function (r) {
      html += '<li>' + esc(r['if']) +
              ' <span class="diagnostic-hint">— ' + esc(r['then']) + '</span></li>';
    });
    html += '</ul>';
    if (diag.cta) {
      html += '<div class="diagnostic-cta">';
      html += '<p class="diagnostic-cta-text">' + esc(diag.cta.text) + '</p>';
      html += '<a href="' + esc(diag.cta.button_href) + '" class="cta-button">' +
              esc(diag.cta.button_title) + '</a>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  /* ── sources renderer ───────────────────────────────────── */

  function renderSources(refIds, allSources) {
    if (!refIds || !refIds.length) return '';
    var items = refIds.map(function (id) {
      var src = allSources.find(function (s) { return s.id === id; });
      if (!src) return '';
      if (src.url) {
        return '<li><a href="' + esc(src.url) + '" target="_blank" rel="noopener noreferrer">' +
               esc(src.title) + ' ↗</a></li>';
      }
      return '<li>' + esc(src.title) + '</li>';
    }).join('');

    return '<div class="sources"><h2>Источники и вдохновение</h2><ul>' + items + '</ul></div>';
  }

  /* ── levels page ────────────────────────────────────────── */

  function renderLevelsPage(track, sources) {
    var html = '';

    // title + subtitle
    html += '<h1>' + esc(track.title) + '</h1>';
    html += '<p class="subtitle">' + esc(track.subtitle) + '</p>';

    // diagnostics
    html += renderDiagnostics(track.diagnostics);

    // level cards
    html += '<div class="levels-grid">';
    track.levels.forEach(function (level) {
      html += '<div class="level-card level-' + esc(level.id) + '">';
      html += '<span class="level-badge">' + esc(level.badge) + '</span>';
      html += '<div class="level-title">' + esc(level.summary) + '</div>';

      // sections
      level.sections.forEach(function (sec) {
        var labelCls = 'level-section-label';
        if (sec.style) labelCls += ' label-' + sec.style;
        html += '<div class="' + labelCls + '">' + esc(sec.title) + '</div>';
        html += bullets(sec.bullets, 'level-bullets');
      });

      // quick check
      if (level.quick_check) {
        html += '<div class="quick-check">';
        html += '<div class="quick-check-label">' + esc(level.quick_check.title) + '</div>';
        html += bullets(level.quick_check.bullets, 'quick-check-list');
        html += '</div>';
      }

      // transition note (lead card)
      if (level.transition_note) {
        html += '<div class="transition-note">' + level.transition_note + '</div>';
      }

      html += '</div>'; // /level-card
    });
    html += '</div>'; // /levels-grid

    // sources
    html += renderSources(track.refs, sources);

    return html;
  }

  /* ── management page ────────────────────────────────────── */

  function renderManagementPage(track, sources) {
    var html = '';

    // title + subtitle
    html += '<h1>' + esc(track.title) + '</h1>';
    html += '<p class="subtitle">' + esc(track.subtitle) + '</p>';

    // diagnostics
    html += renderDiagnostics(track.diagnostics);

    // blocks
    track.blocks.forEach(function (block) {
      switch (block.type) {

        case 'callout':
          html += '<h2>' + esc(block.title) + '</h2>';
          html += bullets(block.bullets, 'content-bullets');
          break;

        case 'table':
          html += '<h2>' + esc(block.title) + '</h2>';
          if (block.subtitle) {
            html += '<p class="section-text">' + esc(block.subtitle) + '</p>';
          }
          html += '<table class="responsibility-table"><thead><tr>';
          block.columns.forEach(function (c) {
            html += '<th>' + esc(c) + '</th>';
          });
          html += '</tr></thead><tbody>';
          block.rows.forEach(function (row) {
            html += '<tr>';
            row.forEach(function (cell) {
              html += '<td>' + esc(cell) + '</td>';
            });
            html += '</tr>';
          });
          html += '</tbody></table>';
          break;

        case 'antipatterns':
          html += '<h2>' + esc(block.title) + '</h2>';
          html += '<ul class="antipattern-list">';
          block.items.forEach(function (item) {
            html += '<li><strong>' + esc(item.title) + '</strong> — ' + esc(item.text) + '</li>';
          });
          html += '</ul>';
          break;

        case 'cta':
          html += '<div class="cta-block">';
          html += '<h3>' + esc(block.title) + '</h3>';
          html += '<p>' + esc(block.text) + '</p>';
          if (block.buttons) {
            block.buttons.forEach(function (btn) {
              html += '<a href="' + esc(btn.href) + '" class="cta-button">' + esc(btn.title) + '</a>';
            });
          }
          html += '</div>';
          break;
      }
    });

    // sources
    html += renderSources(track.refs, sources);

    return html;
  }

  /* ── init ────────────────────────────────────────────────── */

  function init() {
    var app = document.getElementById('app');
    if (!app) return;

    fetch(DATA_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var match = detectPage(data.tracks);
        if (!match) {
          app.innerHTML = '<p style="color:#999;">Раздел не найден.</p>';
          return;
        }

        var html = '';
        if (match.track.id === 'ic_levels') {
          html = renderLevelsPage(match.track, data.sources);
        } else if (match.track.id === 'management') {
          html = renderManagementPage(match.track, data.sources);
        }

        app.innerHTML = html;
      })
      .catch(function (err) {
        console.error('competencies.js:', err);
        app.innerHTML = '<p style="color:#999;">Ошибка загрузки данных.</p>';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
