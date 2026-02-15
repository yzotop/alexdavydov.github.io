/* chart.js — story v4.2 (dark theme)
   4 charts: histogram, comparison bars, top-10 hbar, segments.
   Data from metrics_v2.json.  Vanilla JS SVG. */
(function () {
  "use strict";
  var SVG = "http://www.w3.org/2000/svg";
  var MONO = "'SF Mono','Cascadia Code',ui-monospace,monospace";
  var SANS = "'Inter','Helvetica Neue',system-ui,sans-serif";

  var C = {
    blue:   "#5B8DBE",
    blueLt: "rgba(91,141,190,0.25)",
    green:  "#6BAF7A",
    greenLt:"rgba(107,175,122,0.20)",
    amber:  "#D4A34A",
    amberLt:"rgba(212,163,74,0.20)",
    red:    "#C45C5C",
    redLt:  "rgba(196,92,92,0.20)",
    bar:    "rgba(255,255,255,0.10)",
    muted:  "rgba(255,255,255,0.25)",
    label:  "rgba(255,255,255,0.40)",
    bright: "rgba(255,255,255,0.75)",
    grid:   "rgba(255,255,255,0.04)",
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
  function fmtK(v) {
    return v >= 1000 ? Math.round(v / 1000) + "k" : String(Math.round(v));
  }
  function fmtRub(v) {
    return Number(v).toLocaleString("ru-RU") + " ₽";
  }

  fetch("../metrics_v2.json").then(function (r) { return r.json(); }).then(function (d) {
    var A = d.dataset_a_all;
    var B = d.dataset_b_apparel;
    var top10 = d.top10_apparel;

    /* ════════════ SLIDE 1 — histogram (all) ════════════ */
    var histEl = document.getElementById("chart-hist");
    if (histEl && A.histogram) {
      var bins = A.histogram;
      var W = 880, H = 380;
      var padL = 6, padR = 6, padT = 10, padB = 52;
      var drawW = W - padL - padR, drawH = H - padT - padB;
      var maxC = 0;
      bins.forEach(function (b) { if (b.count > maxC) maxC = b.count; });
      if (!maxC) maxC = 1;
      var barW = Math.floor(drawW / bins.length) - 2;

      var s = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H });

      /* bars */
      bins.forEach(function (b, i) {
        var x = padL + i * (barW + 2);
        var h = Math.max(2, (b.count / maxC) * drawH);
        var y = padT + drawH - h;
        /* highlight mass segment 1668–5980 */
        var fill = C.bar;
        if (b.bin_lo >= 590 && b.bin_hi <= 6000) fill = C.blue;
        else if (b.bin_lo >= 15000) fill = C.redLt;

        s.appendChild(el("rect", { x: x, y: y, width: barW, height: h, rx: 3, fill: fill }));
      });

      /* x-axis labels */
      bins.forEach(function (b, i) {
        if (i % 4 === 0 || i === bins.length - 1) {
          var x = padL + i * (barW + 2) + barW / 2;
          s.appendChild(tx(x, H - padB + 24, fmtK(b.bin_lo), {
            "font-size": "18", fill: C.muted, "font-family": MONO, "text-anchor": "middle"
          }));
        }
      });

      /* p99 note */
      s.appendChild(tx(W - padR, H - padB + 44, "ось до p99 = " + fmtK(A.p99), {
        "font-size": "15", fill: C.muted, "font-family": MONO, "text-anchor": "end"
      }));

      histEl.appendChild(s);
    }

    /* ════════════ SLIDE 2 — comparison bars (ALL vs APPAREL) ════════════ */
    var cmpEl = document.getElementById("chart-compare");
    if (cmpEl) {
      var metrics = [
        { label: "Медиана",  a: A.median,  b: B.median },
        { label: "p75",      a: A.p75,     b: B.p75 },
        { label: "p99",      a: A.p99,     b: B.p99 },
        { label: "Максимум", a: A.max,     b: B.max },
      ];
      var cW = 880, rowH = 80, gap = 14;
      var cH = metrics.length * (rowH + gap) + 20;
      var labelW = 160, rightPad = 120;
      var maxVal = A.max;
      var barArea = cW - labelW - rightPad;

      var cs = el("svg", { width: cW, height: cH, viewBox: "0 0 " + cW + " " + cH });

      metrics.forEach(function (m, i) {
        var y = i * (rowH + gap);
        var barH = 28;

        /* label */
        cs.appendChild(tx(0, y + rowH / 2 + 2, m.label, {
          "font-size": "22", fill: C.label, "font-family": SANS, "font-weight": "600",
          "dominant-baseline": "middle"
        }));

        /* bar A (all) — top */
        var wA = Math.max(4, (m.a / maxVal) * barArea);
        cs.appendChild(el("rect", {
          x: labelW, y: y + 4, width: wA, height: barH, rx: 4, fill: C.blueLt
        }));
        cs.appendChild(tx(labelW + wA + 10, y + 4 + barH / 2 + 1, fmtRub(m.a), {
          "font-size": "18", fill: C.muted, "font-family": MONO, "dominant-baseline": "middle"
        }));

        /* small label */
        cs.appendChild(tx(labelW + wA + 10, y + 4 + barH / 2 + 1, "", {})); /* spacer */

        /* bar B (apparel) — bottom */
        var wB = Math.max(4, (m.b / maxVal) * barArea);
        cs.appendChild(el("rect", {
          x: labelW, y: y + barH + 10, width: wB, height: barH, rx: 4, fill: C.green
        }));
        cs.appendChild(tx(labelW + wB + 10, y + barH + 10 + barH / 2 + 1, fmtRub(m.b), {
          "font-size": "18", fill: C.bright, "font-family": MONO, "font-weight": "600",
          "dominant-baseline": "middle"
        }));
      });

      /* legend */
      var ly = cH - 8;
      cs.appendChild(el("rect", { x: 0, y: ly - 10, width: 14, height: 14, rx: 3, fill: C.blueLt }));
      cs.appendChild(tx(20, ly, "Весь каталог", {
        "font-size": "16", fill: C.muted, "font-family": SANS
      }));
      cs.appendChild(el("rect", { x: 160, y: ly - 10, width: 14, height: 14, rx: 3, fill: C.green }));
      cs.appendChild(tx(180, ly, "Только одежда", {
        "font-size": "16", fill: C.label, "font-family": SANS
      }));

      cmpEl.appendChild(cs);
    }

    /* ════════════ SLIDE 3 — top-10 horizontal bars ════════════ */
    var t10El = document.getElementById("chart-top10");
    if (t10El && top10) {
      var tW = 880, tBarH = 44, tGap = 8, tLabelW = 400, tRightPad = 130;
      var tH = top10.length * (tBarH + tGap) + 6;
      var tMaxVal = top10[0].price;
      var tBarArea = tW - tLabelW - tRightPad;

      var ts = el("svg", { width: tW, height: tH, viewBox: "0 0 " + tW + " " + tH });

      var catColors = {
        "Бомберы": C.amber,
        "Пуховики": C.red,
        "Рубашки": C.label,
        "Худи": C.label,
        "Свитеры": C.label,
      };

      top10.forEach(function (dd, i) {
        var y = i * (tBarH + tGap);
        var w = Math.max(4, (dd.price / tMaxVal) * tBarArea);
        var color = catColors[dd.category_v2] || C.bar;
        var labelColor = (dd.category_v2 === "Пуховики") ? C.red :
                         (dd.category_v2 === "Бомберы") ? C.amber : C.label;

        /* truncate label */
        var lbl = dd.title;
        if (lbl.length > 35) lbl = lbl.substring(0, 34).trim() + "…";

        /* label */
        ts.appendChild(tx(0, y + tBarH * 0.62, lbl, {
          "font-size": "19", fill: labelColor, "font-family": SANS,
          "font-weight": (dd.category_v2 === "Бомберы" || dd.category_v2 === "Пуховики") ? "700" : "500"
        }));

        /* bar */
        ts.appendChild(el("rect", {
          x: tLabelW, y: y + 8, width: w, height: tBarH - 16, rx: 4, fill: color
        }));

        /* price */
        ts.appendChild(tx(tLabelW + w + 10, y + tBarH * 0.62, fmtRub(dd.price), {
          "font-size": "18", fill: C.bright, "font-family": MONO, "font-weight": "600"
        }));
      });

      t10El.appendChild(ts);
    }

    /* ════════════ SLIDE 4 — segments vertical bars ════════════ */
    var segEl = document.getElementById("chart-segments");
    if (segEl && A.segments) {
      var segs = A.segments;
      var sW = 880, sH = 420;
      var sPadL = 10, sPadR = 10, sPadT = 50, sPadB = 80;
      var drawSW = sW - sPadL - sPadR;
      var drawSH = sH - sPadT - sPadB;
      var barGap = 20;
      var barWidth = Math.floor((drawSW - barGap * (segs.length - 1)) / segs.length);

      var maxPct = 0;
      segs.forEach(function (sg) { if (sg.pct > maxPct) maxPct = sg.pct; });
      maxPct = Math.ceil(maxPct / 5) * 5;

      var ss = el("svg", { width: sW, height: sH, viewBox: "0 0 " + sW + " " + sH });

      /* grid lines */
      for (var g = 0; g <= maxPct; g += 10) {
        var gy = sPadT + drawSH - (g / maxPct) * drawSH;
        ss.appendChild(el("line", {
          x1: sPadL, y1: gy, x2: sW - sPadR, y2: gy,
          stroke: C.grid, "stroke-width": 1
        }));
      }

      /* highlight bar for 3000-6000 range (index 2) */
      segs.forEach(function (sg, i) {
        var x = sPadL + i * (barWidth + barGap);
        var h = Math.max(4, (sg.pct / maxPct) * drawSH);
        var y = sPadT + drawSH - h;

        var isCore = (i === 2); /* 3000–6000 */
        var isPremium = (i >= 4); /* 10000+ */
        var color = isCore ? C.red : (isPremium ? C.amberLt : C.bar);

        /* bar */
        ss.appendChild(el("rect", {
          x: x, y: y, width: barWidth, height: h, rx: 6, fill: color
        }));

        /* pct label above */
        ss.appendChild(tx(x + barWidth / 2, y - 12, sg.pct + "%", {
          "font-size": "26", fill: isCore ? C.red : C.bright,
          "font-family": MONO, "font-weight": "700", "text-anchor": "middle"
        }));

        /* count inside bar */
        if (h > 40) {
          ss.appendChild(tx(x + barWidth / 2, y + h - 12, sg.count + "", {
            "font-size": "16", fill: "rgba(255,255,255,0.35)",
            "font-family": MONO, "font-weight": "500", "text-anchor": "middle"
          }));
        }

        /* segment label */
        ss.appendChild(tx(x + barWidth / 2, sH - sPadB + 28, sg.label, {
          "font-size": "19", fill: C.muted,
          "font-family": SANS, "font-weight": "600", "text-anchor": "middle"
        }));

        /* ₽ */
        ss.appendChild(tx(x + barWidth / 2, sH - sPadB + 52, "₽", {
          "font-size": "16", fill: "rgba(255,255,255,0.12)",
          "font-family": MONO, "text-anchor": "middle"
        }));
      });

      segEl.appendChild(ss);
    }

  }).catch(function (e) { console.error("metrics_v2.json:", e); });
})();
