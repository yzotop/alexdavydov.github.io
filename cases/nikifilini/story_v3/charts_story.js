/* charts_story.js — V3 Editorial NIKIFILINI Story Pack
   Vanilla JS SVG. No external dependencies.
*/
(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var MONO = "'SF Mono', 'Cascadia Code', ui-monospace, monospace";
  var SANS = "'Inter', 'Helvetica Neue', system-ui, sans-serif";

  var COLOR = {
    graphite: "#2A2A2A",
    blue: "#3F6EA6",
    amber: "#B37A1D",
    red: "#C3423F",
    barDefault: "#DDDDD8",
    text: "#1A1A1A",
    muted: "#999",
  };

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
    if (v == null) return "—";
    return Number(v).toLocaleString("ru-RU") + " ₽";
  }
  function fmtPct(v) {
    if (v == null) return "—";
    return v + "%";
  }
  function trunc(s, n) {
    n = n || 30;
    return s.length <= n ? s : s.slice(0, n - 1).trim() + "…";
  }

  /* ── horizontal bar ─────────────────────────────── */
  function renderHBar(container, items, valueKey, labelKey, opts) {
    opts = opts || {};
    var W = opts.width || 840;
    var barH = opts.barHeight || 52;
    var gap = opts.gap || 22;
    var labelW = opts.labelWidth || 320;
    var rightPad = opts.rightPad || 220;
    var accent = opts.accentColor || COLOR.graphite;
    var H = items.length * (barH + gap) + 10;
    var maxVal = 0;
    items.forEach(function (d) { if (d[valueKey] > maxVal) maxVal = d[valueKey]; });
    if (!maxVal) maxVal = 1;
    var barArea = W - labelW - rightPad;

    var svg = svgEl("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H });
    items.forEach(function (d, i) {
      var y = i * (barH + gap);
      var w = Math.max(4, (d[valueKey] / maxVal) * barArea);

      svg.appendChild(textEl(0, y + barH * 0.64, trunc(d[labelKey], 26), {
        "font-size": "25", fill: COLOR.text, "font-family": SANS, "font-weight": "500"
      }));
      svg.appendChild(svgEl("rect", {
        x: labelW, y: y + 8, width: w, height: barH - 16, rx: 4,
        fill: i === 0 ? accent : COLOR.barDefault
      }));
      var val = opts.fmtValue ? opts.fmtValue(d) : String(d[valueKey]);
      svg.appendChild(textEl(labelW + w + 14, y + barH * 0.64, val, {
        "font-size": "24", fill: COLOR.muted, "font-family": MONO
      }));
    });
    container.appendChild(svg);
  }

  /* ── histogram ──────────────────────────────────── */
  function renderHistogram(container, bins, opts) {
    opts = opts || {};
    var W = opts.width || 840, H = opts.height || 440;
    var padL = 8, padR = 8, padT = 16, padB = 72;
    var accent = opts.accentColor || COLOR.blue;
    var drawW = W - padL - padR, drawH = H - padT - padB;
    var maxC = 0;
    bins.forEach(function (b) { if (b.count > maxC) maxC = b.count; });
    if (!maxC) maxC = 1;
    var barW = Math.floor(drawW / bins.length) - 2;

    var svg = svgEl("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H });

    bins.forEach(function (b, i) {
      var x = padL + i * (barW + 2);
      var h = Math.max(2, (b.count / maxC) * drawH);
      svg.appendChild(svgEl("rect", {
        x: x, y: padT + drawH - h, width: barW, height: h, rx: 3,
        fill: i % 4 === 0 ? accent : COLOR.barDefault
      }));
    });

    bins.forEach(function (b, i) {
      if (i % 5 === 0 || i === bins.length - 1) {
        var x = padL + i * (barW + 2) + barW / 2;
        svg.appendChild(textEl(x, H - padB + 28, fmtRub(b.bin_lo), {
          "font-size": "20", fill: COLOR.muted, "font-family": MONO, "text-anchor": "middle"
        }));
      }
    });
    container.appendChild(svg);
  }

  /* ── mini table ─────────────────────────────────── */
  function renderMiniTable(container, rows, columns) {
    var table = document.createElement("table");
    table.style.cssText = "width:100%;border-collapse:collapse;font-family:" + SANS + ";font-size:25px;color:" + COLOR.text;
    rows.forEach(function (r) {
      var tr = document.createElement("tr");
      tr.style.cssText = "border-bottom:1px solid #ECECEC;";
      columns.forEach(function (col) {
        var td = document.createElement("td");
        td.style.cssText = "padding:16px 8px;" + (col.align === "right" ? "text-align:right;font-family:" + MONO + ";" : "");
        td.textContent = col.fmt ? col.fmt(r) : (r[col.key] != null ? String(r[col.key]) : "—");
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    container.appendChild(table);
  }

  function injectKPI(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  /* ── bootstrap ──────────────────────────────────── */
  fetch("story_summary.json").then(function (r) { return r.json(); }).then(function (data) {
    var k = data.kpis;

    injectKPI("kpi-sku", k.sku_total);
    injectKPI("kpi-cats", k.categories_count);
    injectKPI("kpi-median", fmtRub(k.median_price));
    injectKPI("kpi-oos", fmtPct(k.share_oos));

    var catEl = document.getElementById("chart-cat-mix");
    if (catEl && data.category_mix) {
      renderHBar(catEl, data.category_mix, "count", "category", {
        accentColor: COLOR.graphite,
        fmtValue: function (d) { return d.count + " SKU · " + d.share + "%"; },
        rightPad: 260,
      });
    }

    var histEl = document.getElementById("chart-price-hist");
    if (histEl && data.price_hist) {
      renderHistogram(histEl, data.price_hist.bins, { accentColor: COLOR.blue });
    }

    var discEl = document.getElementById("table-discount");
    if (discEl && data.top_discount && data.top_discount.length) {
      renderMiniTable(discEl, data.top_discount, [
        { key: "title", fmt: function (r) { return trunc(r.title, 28); } },
        { key: "price", align: "right", fmt: function (r) { return fmtRub(r.price); } },
        { key: "discount_pct", align: "right", fmt: function (r) { return "−" + r.discount_pct + "%"; } },
      ]);
    }
    injectKPI("kpi-disc-share", fmtPct(data.promo_anchor ? data.promo_anchor.share_with_discount : null));
    injectKPI("kpi-disc-median", data.promo_anchor && data.promo_anchor.median_discount != null ? "−" + data.promo_anchor.median_discount + "%" : "—");

    var sooEl = document.getElementById("chart-stockout");
    if (sooEl && data.stockout_by_category && data.stockout_by_category.length) {
      renderHBar(sooEl, data.stockout_by_category, "oos_pct", "category", {
        accentColor: COLOR.red,
        fmtValue: function (d) { return d.oos_pct + "%"; },
        rightPad: 140,
      });
    }
    injectKPI("kpi-oos-total", fmtPct(k.share_oos));

  }).catch(function (e) { console.error("story_summary.json:", e); });
})();
