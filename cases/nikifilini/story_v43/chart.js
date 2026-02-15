/* chart.js — v4.3 slides 1 & 2
   Slide 1: price histogram (mass segment + premium tail).
   Slide 2: category boxplot.
   Vanilla JS SVG. */
(function () {
  "use strict";
  var SVG = "http://www.w3.org/2000/svg";
  var MONO = "'SF Mono','Cascadia Code',ui-monospace,monospace";
  var SANS = "'Inter','Helvetica Neue',system-ui,sans-serif";

  var C = {
    mass: "#3F6EA6",       /* blue — mass segment */
    massBg: "rgba(63,110,166,0.10)",
    tail: "#C3423F",       /* red — premium tail */
    tailBg: "rgba(195,66,63,0.08)",
    bar: "#D4D4D0",
    muted: "#AAA",
    dark: "#1A1A1A",
  };

  function el(tag, a) {
    var e = document.createElementNS(SVG, tag);
    if (a) Object.keys(a).forEach(function (k) { e.setAttribute(k, a[k]); });
    return e;
  }
  function tx(x, y, t, a) {
    var e = el("text", Object.assign({ x: x, y: y }, a || {}));
    e.textContent = t;
    return e;
  }
  function inject(id, v) {
    var e = document.getElementById(id);
    if (e) e.textContent = v;
  }
  function fmtK(v) {
    return v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v);
  }

  fetch("data.json").then(function (r) { return r.json(); }).then(function (d) {
    /* KPIs */
    inject("kpi-median", Number(d.median).toLocaleString("ru-RU") + " ₽");
    inject("kpi-pct6k", d.pct_under_6k + "%");
    inject("kpi-p25", Number(d.p25).toLocaleString("ru-RU") + " ₽");
    inject("kpi-p75", Number(d.p75).toLocaleString("ru-RU") + " ₽");
    inject("kpi-mean", Number(d.mean).toLocaleString("ru-RU") + " ₽");
    inject("kpi-pct10k", d.pct_over_10k + "%");
    inject("kpi-over20k", d.over_20k_count);
    inject("kpi-n", d.n);

    /* Histogram */
    var bins = d.histogram;
    var W = 840, H = 400;
    var padL = 6, padR = 6, padT = 40, padB = 64;
    var drawW = W - padL - padR, drawH = H - padT - padB;
    var maxC = 0;
    bins.forEach(function (b) { if (b.count > maxC) maxC = b.count; });
    if (!maxC) maxC = 1;
    var barW = Math.floor(drawW / bins.length) - 2;

    var s = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H });

    /* background highlight zones */
    bins.forEach(function (b, i) {
      var x = padL + i * (barW + 2);
      if (b.bin_lo >= 3000 && b.bin_hi <= 6500) {
        s.appendChild(el("rect", {
          x: x - 1, y: padT, width: barW + 3, height: drawH,
          fill: C.massBg, rx: 0
        }));
      }
      if (b.bin_lo >= 15000) {
        s.appendChild(el("rect", {
          x: x - 1, y: padT, width: barW + 3, height: drawH,
          fill: C.tailBg, rx: 0
        }));
      }
    });

    /* bars */
    bins.forEach(function (b, i) {
      var x = padL + i * (barW + 2);
      var h = Math.max(2, (b.count / maxC) * drawH);
      var y = padT + drawH - h;
      var fill = C.bar;
      if (b.bin_lo >= 3000 && b.bin_hi <= 6500) fill = C.mass;
      if (b.bin_lo >= 15000) fill = C.tail;

      s.appendChild(el("rect", { x: x, y: y, width: barW, height: h, rx: 3, fill: fill }));
    });

    /* x-axis labels */
    bins.forEach(function (b, i) {
      if (i % 4 === 0 || i === bins.length - 1) {
        var x = padL + i * (barW + 2) + barW / 2;
        s.appendChild(tx(x, H - padB + 28, fmtK(b.bin_lo), {
          "font-size": "20", fill: C.muted, "font-family": MONO, "text-anchor": "middle"
        }));
      }
    });

    /* zone labels */
    var massStart = 0, tailStart = 0;
    bins.forEach(function (b, i) {
      if (b.bin_lo >= 3000 && b.bin_hi <= 4000 && !massStart) massStart = padL + i * (barW + 2);
      if (b.bin_lo >= 15000 && !tailStart) tailStart = padL + i * (barW + 2);
    });

    s.appendChild(tx(massStart, padT - 8, "массовый сегмент", {
      "font-size": "17", fill: C.mass, "font-family": SANS, "font-weight": "700"
    }));

    if (tailStart) {
      s.appendChild(tx(tailStart, padT - 8, "премиум-хвост", {
        "font-size": "17", fill: C.tail, "font-family": SANS, "font-weight": "700"
      }));
    }

    /* p99 annotation */
    s.appendChild(tx(W - padR, H - padB + 50, "ось ограничена p99 = " + fmtK(d.p99), {
      "font-size": "16", fill: C.muted, "font-family": MONO, "text-anchor": "end"
    }));

    document.getElementById("chart-hist").appendChild(s);

    /* ════════════ SLIDE 2 — category prices + boxplot ════════════ */
    function fmtRub(v) {
      return "~" + Number(v).toLocaleString("ru-RU") + " ₽";
    }

    var mr = d.medians_rounded;
    if (mr) {
      inject("cat-tshirt", fmtRub(mr["Футболки"]));
      inject("cat-hoodie", fmtRub(mr["Худи"]));
      inject("cat-jeans", fmtRub(mr["Джинсы"]));
      inject("cat-bombers", fmtRub(mr["Бомберы"]));
      inject("cat-puffers", fmtRub(mr["Пуховики"]));
    }

    var boxEl = document.getElementById("chart-boxplot");
    if (boxEl && d.box_data) {
      var bx = d.box_data;
      var bW = 840, rowH = 56, gap = 16, labelW = 170, padRight = 100;
      var bH = bx.length * (rowH + gap) + 40;
      var gMax = 0;
      bx.forEach(function (dd) { if (dd.max > gMax) gMax = dd.max; });
      if (!gMax) gMax = 1;
      var chartArea = bW - labelW - padRight;

      var bs = el("svg", { width: bW, height: bH, viewBox: "0 0 " + bW + " " + bH });

      /* grid lines */
      [0, 5000, 10000, 15000, 20000, 25000].forEach(function (v) {
        var gx = labelW + (v / gMax) * chartArea;
        bs.appendChild(el("line", {
          x1: gx, y1: 0, x2: gx, y2: bH - 30,
          stroke: "#EAEAE6", "stroke-width": 1
        }));
        bs.appendChild(tx(gx, bH - 8, (v / 1000) + "k", {
          "font-size": "17", fill: C.muted, "font-family": MONO, "text-anchor": "middle"
        }));
      });

      bx.forEach(function (dd, idx) {
        var y = idx * (rowH + gap) + 8;
        var midY = y + rowH / 2;
        var isRed = dd.accent === "red";
        var color = isRed ? C.tail : C.mass;
        var fillBox = isRed ? "rgba(195,66,63,0.15)" : "rgba(63,110,166,0.12)";

        /* label */
        bs.appendChild(tx(0, midY + 7, dd.category, {
          "font-size": "24", fill: isRed ? C.tail : C.dark, "font-family": SANS,
          "font-weight": isRed ? "700" : "600"
        }));

        /* whisker line */
        var xMin = labelW + (dd.min / gMax) * chartArea;
        var xMax = labelW + (dd.max / gMax) * chartArea;
        bs.appendChild(el("line", {
          x1: xMin, y1: midY, x2: xMax, y2: midY,
          stroke: color, "stroke-width": 2
        }));
        /* whisker caps */
        bs.appendChild(el("line", { x1: xMin, y1: midY - 10, x2: xMin, y2: midY + 10, stroke: color, "stroke-width": 2 }));
        bs.appendChild(el("line", { x1: xMax, y1: midY - 10, x2: xMax, y2: midY + 10, stroke: color, "stroke-width": 2 }));

        /* box p25–p75 */
        var xP25 = labelW + (dd.p25 / gMax) * chartArea;
        var xP75 = labelW + (dd.p75 / gMax) * chartArea;
        var boxW2 = Math.max(6, xP75 - xP25);
        bs.appendChild(el("rect", {
          x: xP25, y: midY - 16, width: boxW2, height: 32, rx: 5,
          fill: fillBox, stroke: color, "stroke-width": 1.5
        }));

        /* median dot */
        var xMed = labelW + (dd.median / gMax) * chartArea;
        bs.appendChild(el("circle", { cx: xMed, cy: midY, r: 6, fill: color }));

        /* median label */
        var medLabel = Number(dd.median).toLocaleString("ru-RU") + " ₽";
        bs.appendChild(tx(xMax + 10, midY + 6, medLabel, {
          "font-size": "18", fill: C.muted, "font-family": MONO
        }));
      });

      boxEl.appendChild(bs);
    }

    /* ════════════ SLIDE 3 — top-10 expensive horizontal bars ════════════ */
    inject("kpi-max", Number(d.max_apparel).toLocaleString("ru-RU") + " ₽");
    inject("kpi-p95", Number(d.p95).toLocaleString("ru-RU") + " ₽");
    inject("kpi-p99-s3", Number(d.p99).toLocaleString("ru-RU") + " ₽");
    inject("kpi-pct20k", d.pct_over_20k + "%");

    var t10El = document.getElementById("chart-top10");
    if (t10El && d.top10_expensive) {
      var items = d.top10_expensive;
      var tW = 840, tBarH = 48, tGap = 10, tLabelW = 380, tRightPad = 140;
      var tH = items.length * (tBarH + tGap) + 6;
      var tMaxVal = 0;
      items.forEach(function (dd) { if (dd.price > tMaxVal) tMaxVal = dd.price; });
      if (!tMaxVal) tMaxVal = 1;
      var tBarArea = tW - tLabelW - tRightPad;

      var ts = el("svg", { width: tW, height: tH, viewBox: "0 0 " + tW + " " + tH });

      items.forEach(function (dd, i) {
        var y = i * (tBarH + tGap);
        var w = Math.max(4, (dd.price / tMaxVal) * tBarArea);
        var barColor = C.bar;
        if (dd.accent === "red") barColor = C.tail;
        else if (dd.accent === "amber") barColor = "#B37A1D";

        /* label */
        ts.appendChild(tx(0, y + tBarH * 0.64, dd.label, {
          "font-size": "20", fill: dd.accent === "red" ? C.tail : C.dark,
          "font-family": SANS, "font-weight": dd.accent === "red" ? "700" : "500"
        }));

        /* bar */
        ts.appendChild(el("rect", {
          x: tLabelW, y: y + 8, width: w, height: tBarH - 16, rx: 4, fill: barColor
        }));

        /* price label */
        ts.appendChild(tx(tLabelW + w + 12, y + tBarH * 0.64,
          Number(dd.price).toLocaleString("ru-RU") + " ₽", {
          "font-size": "20", fill: C.muted, "font-family": MONO, "font-weight": "600"
        }));
      });

      t10El.appendChild(ts);
    }

    /* ════════════ SLIDE 4 — price segments vertical bar chart ════════════ */
    inject("kpi-s4-median", Number(d.median).toLocaleString("ru-RU") + " ₽");
    inject("kpi-s4-p75", Number(d.p75).toLocaleString("ru-RU") + " ₽");
    inject("kpi-s4-over20k", d.pct_over_20k + "% SKU");
    inject("kpi-s4-disc", d.discount_share + "% SKU");
    inject("kpi-s4-discmed", d.discount_median + "%");

    var segEl = document.getElementById("chart-segments");
    if (segEl && d.price_segments) {
      var segs = d.price_segments;
      var sW = 840, sH = 440;
      var sPadL = 10, sPadR = 10, sPadT = 50, sPadB = 90;
      var drawSW = sW - sPadL - sPadR;
      var drawSH = sH - sPadT - sPadB;
      var barGap = 24;
      var barWidth = Math.floor((drawSW - barGap * (segs.length - 1)) / segs.length);

      var maxPct = 0;
      segs.forEach(function (sg) { if (sg.pct > maxPct) maxPct = sg.pct; });
      if (!maxPct) maxPct = 1;
      maxPct = Math.ceil(maxPct / 5) * 5; /* round up to nearest 5 for neat grid */

      var ss = el("svg", { width: sW, height: sH, viewBox: "0 0 " + sW + " " + sH });

      /* horizontal grid lines */
      for (var g = 0; g <= maxPct; g += 10) {
        var gy = sPadT + drawSH - (g / maxPct) * drawSH;
        ss.appendChild(el("line", {
          x1: sPadL, y1: gy, x2: sW - sPadR, y2: gy,
          stroke: "#EAEAE6", "stroke-width": 1
        }));
      }

      segs.forEach(function (sg, i) {
        var x = sPadL + i * (barWidth + barGap);
        var h = Math.max(4, (sg.pct / maxPct) * drawSH);
        var y = sPadT + drawSH - h;
        var color = sg.accent === "red" ? C.tail : C.mass;

        /* bar */
        ss.appendChild(el("rect", {
          x: x, y: y, width: barWidth, height: h, rx: 6, fill: color
        }));

        /* percentage label above bar */
        ss.appendChild(tx(x + barWidth / 2, y - 12, sg.pct + "%", {
          "font-size": "28", fill: sg.accent === "red" ? C.tail : C.dark,
          "font-family": MONO, "font-weight": "700", "text-anchor": "middle"
        }));

        /* count label inside bar (if tall enough) */
        if (h > 50) {
          ss.appendChild(tx(x + barWidth / 2, y + h - 14, sg.count + " SKU", {
            "font-size": "17", fill: "rgba(255,255,255,0.7)",
            "font-family": MONO, "font-weight": "500", "text-anchor": "middle"
          }));
        }

        /* segment label below */
        ss.appendChild(tx(x + barWidth / 2, sH - sPadB + 30, sg.label, {
          "font-size": "22", fill: C.muted,
          "font-family": SANS, "font-weight": "600", "text-anchor": "middle"
        }));

        /* ₽ currency line */
        ss.appendChild(tx(x + barWidth / 2, sH - sPadB + 58, "₽", {
          "font-size": "18", fill: "#CCC",
          "font-family": MONO, "text-anchor": "middle"
        }));
      });

      segEl.appendChild(ss);
    }

  }).catch(function (e) { console.error("data.json:", e); });
})();
