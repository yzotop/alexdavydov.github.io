/* chart.js — story v4.4 (white / apparel only)
   4 charts: histogram, boxplot, top-10 hbar, t-shirt histogram.
   Data from metrics_v2.json + data_v44.json. Vanilla JS SVG. */
(function () {
  "use strict";
  var SVG = "http://www.w3.org/2000/svg";
  var MONO = "'SF Mono','Cascadia Code',ui-monospace,monospace";
  var SANS = "'Inter','Helvetica Neue',system-ui,sans-serif";

  var C = {
    blue:    "#4A7FB5",
    blueLt:  "rgba(74,127,181,0.12)",
    gold:    "#C49A3C",
    goldLt:  "rgba(196,154,60,0.10)",
    red:     "#C45050",
    bar:     "#E4E4E4",
    barFaint:"#F0F0F0",
    muted:   "#BBB",
    label:   "#999",
    dark:    "#333",
    grid:    "#F5F5F5",
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
  function fmtK(v) { return v >= 1000 ? Math.round(v / 1000) + "k" : String(Math.round(v)); }
  function fmtRub(v) { return Number(v).toLocaleString("ru-RU") + " ₽"; }
  function inject(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }

  /* Load both JSON files */
  Promise.all([
    fetch("../metrics_v2.json").then(function (r) { return r.json(); }),
    fetch("data_v44.json").then(function (r) { return r.json(); }),
  ]).then(function (arr) {
    var m = arr[0];
    var v44 = arr[1];
    var B = m.dataset_b_apparel;
    var top10 = m.top10_apparel;

    /* ════════════ SLIDE 1 — apparel histogram ════════════ */
    var histEl = document.getElementById("chart-hist");
    if (histEl && B.histogram) {
      var bins = B.histogram;
      var W = 880, H = 360;
      var padL = 6, padR = 6, padT = 10, padB = 52;
      var drawW = W - padL - padR, drawH = H - padT - padB;
      var maxC = 0;
      bins.forEach(function (b) { if (b.count > maxC) maxC = b.count; });
      if (!maxC) maxC = 1;
      var barW = Math.floor(drawW / bins.length) - 2;

      var s = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H });

      /* highlight bands */
      bins.forEach(function (b, i) {
        var x = padL + i * (barW + 2);
        if (b.bin_lo >= 2500 && b.bin_hi <= 6200) {
          s.appendChild(el("rect", {
            x: x - 1, y: padT, width: barW + 3, height: drawH,
            fill: C.blueLt, rx: 0
          }));
        }
        if (b.bin_lo >= 14500) {
          s.appendChild(el("rect", {
            x: x - 1, y: padT, width: barW + 3, height: drawH,
            fill: C.goldLt, rx: 0
          }));
        }
      });

      bins.forEach(function (b, i) {
        var x = padL + i * (barW + 2);
        var h = Math.max(2, (b.count / maxC) * drawH);
        var y = padT + drawH - h;
        var fill = C.bar;
        if (b.bin_lo >= 2500 && b.bin_hi <= 6200) fill = C.blue;
        else if (b.bin_lo >= 14500) fill = C.gold;

        s.appendChild(el("rect", { x: x, y: y, width: barW, height: h, rx: 3, fill: fill }));
      });

      bins.forEach(function (b, i) {
        if (i % 4 === 0 || i === bins.length - 1) {
          var x = padL + i * (barW + 2) + barW / 2;
          s.appendChild(tx(x, H - padB + 24, fmtK(b.bin_lo), {
            "font-size": "17", fill: C.muted, "font-family": MONO, "text-anchor": "middle"
          }));
        }
      });

      s.appendChild(tx(W - padR, H - padB + 44, "ось до p99 = " + fmtK(B.p99), {
        "font-size": "14", fill: C.muted, "font-family": MONO, "text-anchor": "end"
      }));

      histEl.appendChild(s);
    }

    /* ════════════ SLIDE 2 — category list + boxplot ════════════ */
    var catListEl = document.getElementById("cat-list");
    if (catListEl && v44.medians_rounded) {
      var mr = v44.medians_rounded;
      var cats = ["Футболки","Худи","Лонгсливы","Джинсы","Штаны","Свитшоты","Бомберы","Пуховики"];
      cats.forEach(function (cat) {
        var val = mr[cat];
        if (val === undefined) return;
        var isPremium = (cat === "Бомберы" || cat === "Пуховики");
        var row = document.createElement("div");
        row.className = "cat-row" + (isPremium ? " cat-row-premium" : "");
        row.innerHTML =
          '<span class="cat-name">' + cat + '</span>' +
          '<span class="cat-dots"></span>' +
          '<span class="cat-price">~' + Number(val).toLocaleString("ru-RU") + ' ₽</span>';
        catListEl.appendChild(row);
      });
    }

    var boxEl = document.getElementById("chart-boxplot");
    if (boxEl && v44.box_data) {
      var bx = v44.box_data;
      var bW = 880, rowH = 48, gap = 10, labelW = 160, padRight = 100;
      var bH = bx.length * (rowH + gap) + 36;
      var gMax = 0;
      bx.forEach(function (dd) { if (dd.max > gMax) gMax = dd.max; });
      if (!gMax) gMax = 1;
      var chartArea = bW - labelW - padRight;

      var bs = el("svg", { width: bW, height: bH, viewBox: "0 0 " + bW + " " + bH });

      [0, 5000, 10000, 15000, 20000, 25000].forEach(function (v) {
        var gx = labelW + (v / gMax) * chartArea;
        bs.appendChild(el("line", {
          x1: gx, y1: 0, x2: gx, y2: bH - 28,
          stroke: C.grid, "stroke-width": 1
        }));
        bs.appendChild(tx(gx, bH - 8, (v / 1000) + "k", {
          "font-size": "15", fill: C.muted, "font-family": MONO, "text-anchor": "middle"
        }));
      });

      bx.forEach(function (dd, idx) {
        var y = idx * (rowH + gap) + 4;
        var midY = y + rowH / 2;
        var isGold = dd.accent === "gold";
        var color = isGold ? C.gold : C.blue;
        var fillBox = isGold ? C.goldLt : C.blueLt;

        bs.appendChild(tx(0, midY + 6, dd.category, {
          "font-size": "21", fill: isGold ? C.gold : C.dark,
          "font-family": SANS, "font-weight": isGold ? "700" : "600"
        }));

        var xMin = labelW + (dd.min / gMax) * chartArea;
        var xMax = labelW + (dd.max / gMax) * chartArea;
        bs.appendChild(el("line", {
          x1: xMin, y1: midY, x2: xMax, y2: midY,
          stroke: color, "stroke-width": 1.5
        }));
        bs.appendChild(el("line", { x1: xMin, y1: midY - 8, x2: xMin, y2: midY + 8, stroke: color, "stroke-width": 1.5 }));
        bs.appendChild(el("line", { x1: xMax, y1: midY - 8, x2: xMax, y2: midY + 8, stroke: color, "stroke-width": 1.5 }));

        var xP25 = labelW + (dd.p25 / gMax) * chartArea;
        var xP75 = labelW + (dd.p75 / gMax) * chartArea;
        var boxW2 = Math.max(4, xP75 - xP25);
        bs.appendChild(el("rect", {
          x: xP25, y: midY - 12, width: boxW2, height: 24, rx: 4,
          fill: fillBox, stroke: color, "stroke-width": 1.2
        }));

        var xMed = labelW + (dd.median / gMax) * chartArea;
        bs.appendChild(el("circle", { cx: xMed, cy: midY, r: 5, fill: color }));

        bs.appendChild(tx(xMax + 8, midY + 5, fmtRub(dd.median), {
          "font-size": "15", fill: C.muted, "font-family": MONO
        }));
      });

      boxEl.appendChild(bs);
    }

    /* ════════════ SLIDE 3 — top-10 horizontal bars ════════════ */
    var t10El = document.getElementById("chart-top10");
    if (t10El && top10) {
      var tW = 880, tBarH = 42, tGap = 7, tLabelW = 390, tRightPad = 130;
      var tH = top10.length * (tBarH + tGap) + 6;
      var tMaxVal = top10[0].price;
      var tBarArea = tW - tLabelW - tRightPad;

      var ts = el("svg", { width: tW, height: tH, viewBox: "0 0 " + tW + " " + tH });

      var catColors = {
        "Бомберы":  C.gold,
        "Пуховики": C.red,
      };

      top10.forEach(function (dd, i) {
        var y = i * (tBarH + tGap);
        var w = Math.max(4, (dd.price / tMaxVal) * tBarArea);
        var color = catColors[dd.category_v2] || C.bar;
        var lblColor = catColors[dd.category_v2] || C.label;

        var lbl = dd.title;
        if (lbl.length > 34) lbl = lbl.substring(0, 33).trim() + "…";

        ts.appendChild(tx(0, y + tBarH * 0.62, lbl, {
          "font-size": "18", fill: lblColor,
          "font-family": SANS,
          "font-weight": (dd.category_v2 === "Бомберы" || dd.category_v2 === "Пуховики") ? "700" : "500"
        }));

        ts.appendChild(el("rect", {
          x: tLabelW, y: y + 8, width: w, height: tBarH - 16, rx: 4, fill: color
        }));

        ts.appendChild(tx(tLabelW + w + 10, y + tBarH * 0.62, fmtRub(dd.price), {
          "font-size": "17", fill: C.dark, "font-family": MONO, "font-weight": "600"
        }));
      });

      t10El.appendChild(ts);
    }

    /* ════════════ SLIDE 4 — t-shirt histogram ════════════ */
    var tsData = v44.tshirts;
    if (tsData) {
      inject("kpi-ts-med", "~" + Number(tsData.median_rounded).toLocaleString("ru-RU") + " ₽");
      inject("kpi-ts-range", Number(tsData.p25).toLocaleString("ru-RU") + "–" +
             Number(tsData.p75).toLocaleString("ru-RU") + " ₽");
      inject("kpi-ts-p75", Number(tsData.p75).toLocaleString("ru-RU") + " ₽");
      inject("kpi-ts-max", Number(tsData.max).toLocaleString("ru-RU") + " ₽");
    }

    var tsHistEl = document.getElementById("chart-tshirt");
    if (tsHistEl && tsData && tsData.histogram) {
      var tsBins = tsData.histogram;
      var tsW = 880, tsH = 360;
      var tsPadL = 6, tsPadR = 6, tsPadT = 10, tsPadB = 52;
      var tsDrawW = tsW - tsPadL - tsPadR, tsDrawH = tsH - tsPadT - tsPadB;
      var tsMaxC = 0;
      tsBins.forEach(function (b) { if (b.count > tsMaxC) tsMaxC = b.count; });
      if (!tsMaxC) tsMaxC = 1;
      var tsBarW = Math.floor(tsDrawW / tsBins.length) - 2;

      var tss = el("svg", { width: tsW, height: tsH, viewBox: "0 0 " + tsW + " " + tsH });

      /* highlight core range p25–p75 */
      tsBins.forEach(function (b, i) {
        var x = tsPadL + i * (tsBarW + 2);
        if (b.bin_lo >= tsData.p25 - 200 && b.bin_hi <= tsData.p75 + 200) {
          tss.appendChild(el("rect", {
            x: x - 1, y: tsPadT, width: tsBarW + 3, height: tsDrawH,
            fill: C.blueLt, rx: 0
          }));
        }
        /* rare expensive items */
        if (b.bin_lo >= 4200) {
          tss.appendChild(el("rect", {
            x: x - 1, y: tsPadT, width: tsBarW + 3, height: tsDrawH,
            fill: C.goldLt, rx: 0
          }));
        }
      });

      tsBins.forEach(function (b, i) {
        var x = tsPadL + i * (tsBarW + 2);
        var h = Math.max(2, (b.count / tsMaxC) * tsDrawH);
        var y = tsPadT + tsDrawH - h;
        var fill = C.bar;
        if (b.bin_lo >= tsData.p25 - 200 && b.bin_hi <= tsData.p75 + 200) fill = C.blue;
        else if (b.bin_lo >= 4200) fill = C.gold;

        tss.appendChild(el("rect", { x: x, y: y, width: tsBarW, height: h, rx: 3, fill: fill }));
      });

      tsBins.forEach(function (b, i) {
        if (i % 3 === 0 || i === tsBins.length - 1) {
          var x = tsPadL + i * (tsBarW + 2) + tsBarW / 2;
          tss.appendChild(tx(x, tsH - tsPadB + 24, fmtK(b.bin_lo), {
            "font-size": "17", fill: C.muted, "font-family": MONO, "text-anchor": "middle"
          }));
        }
      });

      /* label zones */
      var coreStart = 0;
      tsBins.forEach(function (b, i) {
        if (b.bin_lo >= tsData.p25 - 200 && !coreStart) coreStart = tsPadL + i * (tsBarW + 2);
      });
      tss.appendChild(tx(coreStart, tsPadT - 2, "основной диапазон", {
        "font-size": "15", fill: C.blue, "font-family": SANS, "font-weight": "700"
      }));

      tss.appendChild(tx(tsW - tsPadR, tsH - tsPadB + 44, "ось до p99 = " + fmtK(tsData.p99), {
        "font-size": "14", fill: C.muted, "font-family": MONO, "text-anchor": "end"
      }));

      tsHistEl.appendChild(tss);
    }

  }).catch(function (e) { console.error("Data load error:", e); });
})();
