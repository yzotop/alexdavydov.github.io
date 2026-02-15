/* charts_story.js — V2 NIKIFILINI Telegram Story Pack
   Vanilla JS SVG rendering with subtle color accents.
   No external dependencies.
*/

(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var MONO = "'SF Mono', 'Cascadia Code', ui-monospace, monospace";
  var SANS = "'Inter', 'Helvetica Neue', system-ui, sans-serif";

  /* V2 Color system */
  var COLOR = {
    graphite: "#2B2B2B",
    blue: "#3A6EA5",
    amber: "#C68A2E",
    red: "#C44536",
    barDefault: "#D0D0CC",      /* neutral bars */
    barHover: "#B8B8B2",
    text: "#1A1A1A",
    muted: "#888888",
    bg: "#F6F6F4",
  };

  /* ── helpers ─────────────────────────────────────────── */

  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  function textEl(x, y, txt, attrs) {
    var t = svgEl("text", Object.assign({ x: x, y: y }, attrs || {}));
    t.textContent = txt;
    return t;
  }

  function fmtRub(v) {
    if (v === null || v === undefined) return "—";
    return Number(v).toLocaleString("ru-RU") + " ₽";
  }

  function fmtPct(v) {
    if (v === null || v === undefined) return "—";
    return v + "%";
  }

  function trunc(s, n) {
    n = n || 32;
    return s.length <= n ? s : s.slice(0, n - 1).trim() + "…";
  }

  /* ── horizontal bar chart ───────────────────────────── */

  function renderHBar(container, items, valueKey, labelKey, opts) {
    opts = opts || {};
    var W = opts.width || 840;
    var barH = opts.barHeight || 56;
    var gap = opts.gap || 18;
    var labelW = opts.labelWidth || 340;
    var rightPad = opts.rightPad || 200;
    var accentColor = opts.accentColor || COLOR.graphite;
    var H = items.length * (barH + gap) + 20;
    var maxVal = 0;
    items.forEach(function (d) { if (d[valueKey] > maxVal) maxVal = d[valueKey]; });
    if (maxVal === 0) maxVal = 1;
    var barAreaW = W - labelW - rightPad;

    var svg = svgEl("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H });

    items.forEach(function (d, i) {
      var y = i * (barH + gap);
      var w = Math.max(4, (d[valueKey] / maxVal) * barAreaW);

      /* label */
      svg.appendChild(textEl(0, y + barH * 0.62, trunc(d[labelKey], 28), {
        "font-size": "26", fill: COLOR.text, "font-family": SANS, "font-weight": "500"
      }));

      /* bar */
      svg.appendChild(svgEl("rect", {
        x: labelW, y: y + 6, width: w, height: barH - 12, rx: 6,
        fill: i === 0 ? accentColor : COLOR.barDefault
      }));

      /* value */
      var valText = opts.fmtValue ? opts.fmtValue(d) : String(d[valueKey]);
      svg.appendChild(textEl(labelW + w + 14, y + barH * 0.62, valText, {
        "font-size": "26", fill: COLOR.muted, "font-family": MONO
      }));
    });

    container.appendChild(svg);
  }

  /* ── histogram ──────────────────────────────────────── */

  function renderHistogram(container, bins, opts) {
    opts = opts || {};
    var W = opts.width || 840;
    var H = opts.height || 480;
    var padL = 10;
    var padR = 10;
    var padT = 20;
    var padB = 80;
    var accentColor = opts.accentColor || COLOR.blue;

    var drawW = W - padL - padR;
    var drawH = H - padT - padB;
    var maxC = 0;
    bins.forEach(function (b) { if (b.count > maxC) maxC = b.count; });
    if (maxC === 0) maxC = 1;
    var barW = Math.floor(drawW / bins.length) - 2;

    var svg = svgEl("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H });

    bins.forEach(function (b, i) {
      var x = padL + i * (barW + 2);
      var h = Math.max(2, (b.count / maxC) * drawH);
      var y = padT + drawH - h;
      svg.appendChild(svgEl("rect", {
        x: x, y: y, width: barW, height: h, rx: 3,
        fill: i % 4 === 0 ? accentColor : COLOR.barDefault
      }));
    });

    /* x-axis labels (every 5th) */
    bins.forEach(function (b, i) {
      if (i % 5 === 0 || i === bins.length - 1) {
        var x = padL + i * (barW + 2) + barW / 2;
        svg.appendChild(textEl(x, H - padB + 32, fmtRub(b.bin_lo), {
          "font-size": "22", fill: COLOR.muted, "font-family": MONO, "text-anchor": "middle"
        }));
      }
    });

    container.appendChild(svg);
  }

  /* ── mini table ─────────────────────────────────────── */

  function renderMiniTable(container, rows, columns) {
    var table = document.createElement("table");
    table.style.cssText = "width:100%;border-collapse:collapse;font-family:" + SANS + ";font-size:26px;color:" + COLOR.text;

    rows.forEach(function (r, i) {
      var tr = document.createElement("tr");
      tr.style.cssText = "border-bottom:1px solid #E8E8E4;";
      columns.forEach(function (col) {
        var td = document.createElement("td");
        td.style.cssText = "padding:14px 8px;" + (col.align === "right" ? "text-align:right;font-family:" + MONO + ";" : "");
        td.textContent = col.fmt ? col.fmt(r) : (r[col.key] != null ? String(r[col.key]) : "—");
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });

    container.appendChild(table);
  }

  /* ── KPI injection ──────────────────────────────────── */

  function injectKPI(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  /* ── bootstrap ──────────────────────────────────────── */

  fetch("story_summary.json").then(function (r) { return r.json(); }).then(function (data) {
    var k = data.kpis;

    /* Slide 1 — KPIs */
    injectKPI("kpi-sku", k.sku_total);
    injectKPI("kpi-cats", k.categories_count);
    injectKPI("kpi-median", fmtRub(k.median_price));
    injectKPI("kpi-oos", fmtPct(k.share_oos));

    /* Slide 2 — Category mix */
    var catEl = document.getElementById("chart-cat-mix");
    if (catEl && data.category_mix) {
      renderHBar(catEl, data.category_mix, "count", "category", {
        accentColor: COLOR.graphite,
        fmtValue: function (d) { return d.count + " SKU · " + d.share + "%"; },
        rightPad: 240,
      });
    }

    /* Slide 3 — Price histogram */
    var histEl = document.getElementById("chart-price-hist");
    if (histEl && data.price_hist) {
      renderHistogram(histEl, data.price_hist.bins, { accentColor: COLOR.blue });
    }

    /* Slide 4 — Discount top-3 */
    var discEl = document.getElementById("table-discount");
    if (discEl && data.top_discount && data.top_discount.length) {
      renderMiniTable(discEl, data.top_discount, [
        { key: "title", fmt: function (r) { return trunc(r.title, 30); } },
        { key: "price", align: "right", fmt: function (r) { return fmtRub(r.price); } },
        { key: "discount_pct", align: "right", fmt: function (r) { return "−" + r.discount_pct + "%"; } },
      ]);
    }
    injectKPI("kpi-disc-share", fmtPct(data.promo_anchor ? data.promo_anchor.share_with_discount : null));
    injectKPI("kpi-disc-median", data.promo_anchor && data.promo_anchor.median_discount != null ? "−" + data.promo_anchor.median_discount + "%" : "—");

    /* Slide 5 — Stock-out */
    var sooEl = document.getElementById("chart-stockout");
    if (sooEl && data.stockout_by_category && data.stockout_by_category.length) {
      renderHBar(sooEl, data.stockout_by_category, "oos_pct", "category", {
        accentColor: COLOR.red,
        fmtValue: function (d) { return d.oos_pct + "%"; },
        rightPad: 140,
      });
    }
    injectKPI("kpi-oos-total", fmtPct(k.share_oos));
  }).catch(function (e) {
    console.error("story_summary.json load error:", e);
  });
})();
