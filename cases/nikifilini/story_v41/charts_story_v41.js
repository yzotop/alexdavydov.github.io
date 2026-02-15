/* charts_story_v41.js — "Сколько стоит одеться в NIKIFILINI?"
   KPI injection only, no charts needed. Vanilla JS.
*/
(function () {
  "use strict";

  function fmtRub(v) {
    if (v == null) return "—";
    return Number(v).toLocaleString("ru-RU") + " ₽";
  }

  function inject(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  fetch("story_summary_v41.json")
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var m = d.medians;

      /* Slide 2 — cheapest */
      inject("cheapest-price", fmtRub(d.cheapest_sku));

      /* Slide 3 — base outfit */
      inject("price-tshirt", fmtRub(m["Футболки"].rounded));
      inject("price-hoodie", fmtRub(m["Худи"].rounded));
      inject("price-jeans", fmtRub(m["Джинсы"].rounded));
      inject("base-total", "≈ " + fmtRub(d.base_total));

      /* Slide 4 — full outfit */
      inject("puhovik-price", fmtRub(d.puhovik.rounded));
      inject("price-tshirt-2", fmtRub(m["Футболки"].rounded));
      inject("price-hoodie-2", fmtRub(m["Худи"].rounded));
      inject("price-jeans-2", fmtRub(m["Джинсы"].rounded));
      inject("price-puhovik-2", fmtRub(d.puhovik.rounded));
      inject("full-total", "≈ " + fmtRub(d.full_total));
    })
    .catch(function (e) {
      console.error("story_summary_v41.json load error:", e);
    });
})();
