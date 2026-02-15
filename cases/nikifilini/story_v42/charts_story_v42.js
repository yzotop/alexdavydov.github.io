/* charts_story_v42.js — NIKIFILINI v4.2 with bottom charts
   Vanilla JS SVG. No external dependencies.
*/
(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var MONO = "'SF Mono','Cascadia Code',ui-monospace,monospace";
  var SANS = "'Inter','Helvetica Neue',system-ui,sans-serif";

  var C = {
    dark: "#1A1A1A",
    blue: "#3F6EA6",
    blueLight: "#B3CCE6",
    red: "#C3423F",
    redLight: "#E8A5A3",
    bar: "#D8D8D4",
    muted: "#999",
    gridLine: "#E8E8E4",
    bg: "#F5F5F5",
  };

  function svg(tag, a) {
    var el = document.createElementNS(SVG_NS, tag);
    if (a) Object.keys(a).forEach(function (k) { el.setAttribute(k, a[k]); });
    return el;
  }
  function txt(x, y, t, a) {
    var el = svg("text", Object.assign({ x: x, y: y }, a || {}));
    el.textContent = t;
    return el;
  }
  function fmtRub(v) {
    return v == null ? "—" : Number(v).toLocaleString("ru-RU") + " ₽";
  }
  function trunc(s, n) {
    n = n || 28;
    return s.length <= n ? s : s.slice(0, n - 1).trim() + "…";
  }
  function inject(id, v) {
    var el = document.getElementById(id);
    if (el) el.textContent = v;
  }

  /* ── 1. Horizontal bar — Top-10 cheapest ────────── */
  function renderCheapestBars(container, items) {
    var W = 840, barH = 40, gap = 8, labelW = 360, rightPad = 120;
    var H = items.length * (barH + gap) + 4;
    var maxVal = 0;
    items.forEach(function (d) { if (d.price > maxVal) maxVal = d.price; });
    if (!maxVal) maxVal = 1;
    var barArea = W - labelW - rightPad;

    var s = svg("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H });

    items.forEach(function (d, i) {
      var y = i * (barH + gap);
      var w = Math.max(4, (d.price / maxVal) * barArea);

      s.appendChild(txt(0, y + barH * 0.66, trunc(d.title, 30), {
        "font-size": "20", fill: C.dark, "font-family": SANS, "font-weight": "500"
      }));
      s.appendChild(svg("rect", {
        x: labelW, y: y + 8, width: w, height: barH - 16, rx: 4,
        fill: C.bar
      }));
      s.appendChild(txt(labelW + w + 10, y + barH * 0.66, fmtRub(d.price), {
        "font-size": "18", fill: C.muted, "font-family": MONO
      }));
    });
    container.appendChild(s);
  }

  /* ── 2. Price histogram with highlight band ─────── */
  function renderHistogram(container, bins, capP99) {
    var W = 840, H = 320;
    var padL = 6, padR = 6, padT = 12, padB = 56;
    var drawW = W - padL - padR, drawH = H - padT - padB;
    var maxC = 0;
    bins.forEach(function (b) { if (b.count > maxC) maxC = b.count; });
    if (!maxC) maxC = 1;
    var barW = Math.floor(drawW / bins.length) - 2;

    var s = svg("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H });

    /* highlight band 2000-6000 */
    bins.forEach(function (b, i) {
      if (b.bin_lo >= 2000 && b.bin_hi <= 6500) {
        var x = padL + i * (barW + 2);
        s.appendChild(svg("rect", {
          x: x - 1, y: padT, width: barW + 2, height: drawH,
          fill: C.blueLight, opacity: "0.25", rx: 0
        }));
      }
    });

    bins.forEach(function (b, i) {
      var x = padL + i * (barW + 2);
      var h = Math.max(2, (b.count / maxC) * drawH);
      var inBand = b.bin_lo >= 2000 && b.bin_hi <= 6500;
      s.appendChild(svg("rect", {
        x: x, y: padT + drawH - h, width: barW, height: h, rx: 3,
        fill: inBand ? C.blue : C.bar
      }));
    });

    /* x-axis labels */
    bins.forEach(function (b, i) {
      if (i % 5 === 0 || i === bins.length - 1) {
        var x = padL + i * (barW + 2) + barW / 2;
        var label = (b.bin_lo / 1000).toFixed(0) + "k";
        s.appendChild(txt(x, H - padB + 24, label, {
          "font-size": "18", fill: C.muted, "font-family": MONO, "text-anchor": "middle"
        }));
      }
    });

    /* band annotation */
    s.appendChild(txt(padL + 2 * (barW + 2), padT - 1, "массовый сегмент 2–6 тыс ₽", {
      "font-size": "16", fill: C.blue, "font-family": SANS, "font-weight": "600"
    }));

    container.appendChild(s);
  }

  /* ── 3. Boxplot / price range by category ───────── */
  function renderBoxplot(container, data) {
    var W = 840, rowH = 52, gap = 12, labelW = 160, padR = 80;
    var H = data.length * (rowH + gap) + 20;
    var globalMax = 0;
    data.forEach(function (d) { if (d.max > globalMax) globalMax = d.max; });
    if (!globalMax) globalMax = 1;
    var chartW = W - labelW - padR;

    var s = svg("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H });

    /* grid lines */
    [0, 5000, 10000, 15000, 20000, 25000].forEach(function (v) {
      var x = labelW + (v / globalMax) * chartW;
      s.appendChild(svg("line", {
        x1: x, y1: 0, x2: x, y2: H - 10,
        stroke: C.gridLine, "stroke-width": 1
      }));
      s.appendChild(txt(x, H - 2, (v / 1000) + "k", {
        "font-size": "16", fill: C.muted, "font-family": MONO, "text-anchor": "middle"
      }));
    });

    data.forEach(function (d, i) {
      var y = i * (rowH + gap) + 6;
      var midY = y + rowH / 2;
      var isRed = d.accent === "red";
      var color = isRed ? C.red : C.dark;
      var fillColor = isRed ? C.redLight : C.bar;

      /* label */
      s.appendChild(txt(0, midY + 6, d.category, {
        "font-size": "22", fill: color, "font-family": SANS,
        "font-weight": isRed ? "700" : "500"
      }));

      /* whisker line (min to max) */
      var xMin = labelW + (d.min / globalMax) * chartW;
      var xMax = labelW + (d.max / globalMax) * chartW;
      s.appendChild(svg("line", {
        x1: xMin, y1: midY, x2: xMax, y2: midY,
        stroke: color, "stroke-width": 2
      }));

      /* box (p25 to p75) */
      var xP25 = labelW + (d.p25 / globalMax) * chartW;
      var xP75 = labelW + (d.p75 / globalMax) * chartW;
      var boxW = Math.max(4, xP75 - xP25);
      s.appendChild(svg("rect", {
        x: xP25, y: midY - 14, width: boxW, height: 28, rx: 4,
        fill: fillColor, stroke: color, "stroke-width": 1.5
      }));

      /* median dot */
      var xMed = labelW + (d.median / globalMax) * chartW;
      s.appendChild(svg("circle", {
        cx: xMed, cy: midY, r: 5, fill: color
      }));

      /* median label */
      s.appendChild(txt(xMax + 8, midY + 6, fmtRub(d.median), {
        "font-size": "18", fill: C.muted, "font-family": MONO
      }));
    });

    container.appendChild(s);
  }

  /* ── 4. Comparison vertical bars ────────────────── */
  function renderCompareBars(container, items) {
    var W = 840, H = 360;
    var padL = 60, padR = 40, padT = 20, padB = 60;
    var maxVal = 0;
    items.forEach(function (d) { if (d.value > maxVal) maxVal = d.value; });
    if (!maxVal) maxVal = 1;
    var drawW = W - padL - padR;
    var drawH = H - padT - padB;
    var barW = Math.min(120, drawW / items.length - 40);
    var barGap = (drawW - barW * items.length) / (items.length + 1);

    var s = svg("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H });

    /* baseline */
    s.appendChild(svg("line", {
      x1: padL, y1: padT + drawH, x2: W - padR, y2: padT + drawH,
      stroke: C.gridLine, "stroke-width": 1
    }));

    var colors = [C.bar, C.blue, C.red];

    items.forEach(function (d, i) {
      var x = padL + barGap + i * (barW + barGap);
      var h = Math.max(4, (d.value / maxVal) * drawH);
      var y = padT + drawH - h;

      s.appendChild(svg("rect", {
        x: x, y: y, width: barW, height: h, rx: 8,
        fill: colors[i] || C.bar
      }));

      /* value on top */
      s.appendChild(txt(x + barW / 2, y - 12, fmtRub(d.value), {
        "font-size": "22", fill: C.dark, "font-family": MONO,
        "font-weight": "700", "text-anchor": "middle"
      }));

      /* label below */
      s.appendChild(txt(x + barW / 2, padT + drawH + 36, d.label, {
        "font-size": "22", fill: C.muted, "font-family": SANS,
        "font-weight": "500", "text-anchor": "middle"
      }));
    });

    container.appendChild(s);
  }

  /* ── Bootstrap ──────────────────────────────────── */
  fetch("story_summary_v42.json")
    .then(function (r) { return r.json(); })
    .then(function (d) {
      /* Slide 1 */
      inject("cheapest-val", fmtRub(d.cheapest_sku));
      var el1 = document.getElementById("chart-cheapest");
      if (el1) renderCheapestBars(el1, d.top10_cheapest);

      /* Slide 2 */
      inject("base-total", "≈ " + fmtRub(d.base_total));
      inject("price-tshirt", fmtRub(d.medians["Футболки"]));
      inject("price-hoodie", fmtRub(d.medians["Худи"]));
      inject("price-jeans", fmtRub(d.medians["Джинсы"]));
      inject("median-catalog", fmtRub(d.median_catalog));
      var el2 = document.getElementById("chart-hist");
      if (el2) renderHistogram(el2, d.price_hist.bins, d.price_hist.cap_p99);

      /* Slide 3 */
      inject("puhovik-price", fmtRub(d.puhovik_median));
      var el3 = document.getElementById("chart-boxplot");
      if (el3) renderBoxplot(el3, d.box_data);

      /* Slide 4 */
      inject("full-total", "≈ " + fmtRub(d.full_total));
      inject("base-val", fmtRub(d.base_total));
      inject("puh-val", fmtRub(d.puhovik_median));
      inject("ratio-val", "×" + (d.full_total / d.base_total).toFixed(1));
      var el4 = document.getElementById("chart-compare");
      if (el4) renderCompareBars(el4, d.compare_bars);
    })
    .catch(function (e) { console.error("v42 load error:", e); });
})();
