/**
 * diagnostic.js — universal diagnostic-block loader.
 *
 * Drop onto any page:
 *   <link rel="stylesheet" href="…/diagnostic.css">
 *   <div data-diagnostic="hub_diagnostics"></div>   ← key in JSON
 *   <script src="…/diagnostic.js"></script>
 *
 * The script finds every [data-diagnostic] container,
 * fetches competencies.v1.json once, picks the right
 * diagnostics block by key, and renders it.
 *
 * Supported keys:
 *   "hub_diagnostics"          → top-level hub_diagnostics
 *   "track:<trackId>"          → track.diagnostics  (e.g. "track:ic_levels")
 */
(function () {
  'use strict';

  var DATA_URL = '/knowledge/competencies/data/competencies.v1.json';

  /* ── helpers ─────────────────────────────────────── */

  function esc(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

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

  /* ── resolve key → diagnostics object ───────────── */

  function resolve(data, key) {
    if (!key) return null;

    // top-level key  (e.g. "hub_diagnostics")
    if (data[key]) return data[key];

    // track:<id>     (e.g. "track:ic_levels")
    var m = key.match(/^track:(.+)$/);
    if (m) {
      var track = data.tracks && data.tracks.find(function (t) { return t.id === m[1]; });
      return track ? track.diagnostics : null;
    }

    return null;
  }

  /* ── init ────────────────────────────────────────── */

  function init() {
    var targets = document.querySelectorAll('[data-diagnostic]');
    if (!targets.length) return;

    fetch(DATA_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        targets.forEach(function (el) {
          var key = el.getAttribute('data-diagnostic');
          var diag = resolve(data, key);
          if (diag) {
            el.innerHTML = renderDiagnostics(diag);
          }
        });
      })
      .catch(function (err) {
        console.error('diagnostic.js:', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
