/* charts.js — Vanilla SVG charts for the Solvery Mentors case study.
 *
 * Reads summary.json (relative), renders:
 *   1.  Horizontal bar chart of category counts       → #chart-categories
 *   2.  Scatter plot of price vs sessions (p99 cap)   → #chart-scatter
 *   3.  Top-sessions table                            → #table-top-sessions
 *   4.  Top-reviews table                             → #table-top-reviews
 *   5.  Lorenz curve of sessions concentration        → #chart-lorenz
 *   6.  Category price bands (median + p25..p75)      → #chart-category-price
 *   7.  Cold start by category (% zero reviews)       → #chart-cold-start
 *   8.  Marketplace metrics panel                     → #marketplace-metrics
 *   9.  Demand vs Supply by category                  → #chart-demand-supply
 *  10.  Price histogram (p99-capped)                  → #chart-price-hist
 *  11.  Sessions histogram (p99-capped)               → #chart-sessions-hist
 *  12.  Correlation heatmap (3×3)                     → #chart-heatmap
 *  13.  Affordable active mentors table               → #table-affordable-active
 *
 * A <select id="cat-filter"> controls the scatter category filter.
 *
 * No dependencies. No build step. Just vanilla JS + inline SVG.
 * --------------------------------------------------------------------- */

(function () {
    "use strict";

    /* ---- colour palette (site-aligned, muted) ---- */
    var PALETTE = [
        "#0071e3", "#047857", "#b45309", "#7c3aed", "#dc2626",
        "#0891b2", "#4f46e5", "#c2410c", "#059669", "#6d28d9",
        "#d97706", "#2563eb", "#be185d"
    ];

    var CAT_COLOURS = {};

    function catColour(cat) {
        if (!CAT_COLOURS[cat]) {
            var idx = Object.keys(CAT_COLOURS).length % PALETTE.length;
            CAT_COLOURS[cat] = PALETTE[idx];
        }
        return CAT_COLOURS[cat];
    }

    /* ---- SVG helpers ---- */
    var SVG_NS = "http://www.w3.org/2000/svg";

    function svgEl(tag, attrs) {
        var el = document.createElementNS(SVG_NS, tag);
        if (attrs) Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
        return el;
    }

    function textEl(x, y, txt, attrs) {
        var el = svgEl("text", Object.assign({ x: x, y: y }, attrs || {}));
        el.textContent = txt;
        return el;
    }

    /* ---- common text style ---- */
    var FONT_SANS = "-apple-system, BlinkMacSystemFont, sans-serif";
    var FONT_MONO = "ui-monospace, 'SF Mono', monospace";
    var TICK_ATTRS = { "font-size": "10", fill: "#999", "font-family": FONT_MONO };
    var LABEL_ATTRS = { "font-size": "11", fill: "#555", "font-family": FONT_SANS };
    var GRID_STROKE = "rgba(17,17,17,0.06)";

    /* ---- number formatting ---- */
    function fmtK(n) {
        if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
        return String(Math.round(n));
    }

    function fmtPct(n) {
        return (n * 100).toFixed(1) + "%";
    }

    /* ================================================================== *
     *  1. Horizontal bar chart — category counts
     * ================================================================== */

    function renderBarChart(container, categories) {
        container.innerHTML = "";

        var barH = 26, gap = 6, labelW = 160, chartW = 700, rightPad = 50;
        var totalH = categories.length * (barH + gap) + 12;
        var maxVal = Math.max.apply(null, categories.map(function (c) { return c.mentors; }));

        var svg = svgEl("svg", {
            width: "100%", viewBox: "0 0 " + chartW + " " + totalH,
            style: "display:block; max-width:100%; height:auto;"
        });

        var barArea = chartW - labelW - rightPad;

        categories.forEach(function (c, i) {
            var y = i * (barH + gap) + 4;
            var w = (c.mentors / maxVal) * barArea;
            var col = catColour(c.category);

            svg.appendChild(textEl(labelW - 8, y + barH * 0.68, c.category, {
                "text-anchor": "end", "font-size": "11", fill: "#555", "font-family": FONT_SANS
            }));

            svg.appendChild(svgEl("rect", {
                x: labelW, y: y, width: Math.max(w, 2), height: barH,
                rx: 4, fill: col, opacity: "0.82"
            }));

            svg.appendChild(textEl(labelW + w + 6, y + barH * 0.68, String(c.mentors), {
                "font-size": "11", fill: "#888", "font-family": FONT_MONO
            }));
        });

        container.appendChild(svg);
    }

    /* ================================================================== *
     *  2. Scatter plot — price vs sessions (p99-capped linear scale)
     * ================================================================== */

    var SCATTER_W = 700, SCATTER_H = 400;
    var PAD = { top: 20, right: 30, bottom: 48, left: 60 };

    function renderScatter(container, data, filterCat) {
        container.innerHTML = "";

        var points = data.scatter_points_small || [];
        var caps = (data.charts_data && data.charts_data.scatter_price_sessions)
            ? data.charts_data.scatter_price_sessions.caps
            : null;

        var filtered = filterCat === "All"
            ? points
            : points.filter(function (p) { return p.derived_category === filterCat; });

        if (!filtered.length) {
            container.innerHTML = '<p style="color:rgba(17,17,17,.38);font-size:0.85rem;text-align:center;">Нет данных для этой категории.</p>';
            return;
        }

        var svg = svgEl("svg", {
            width: "100%", viewBox: "0 0 " + SCATTER_W + " " + SCATTER_H,
            style: "display:block; max-width:100%; height:auto;"
        });

        var plotW = SCATTER_W - PAD.left - PAD.right;
        var plotH = SCATTER_H - PAD.top - PAD.bottom;

        /* Use p99 caps for axis max if available, else fall back */
        var maxPrice = caps ? caps.price_cap_p99 * 1.05
            : Math.max.apply(null, points.map(function (p) { return p.price; })) * 1.05;
        var maxSess = caps ? caps.sessions_cap_p99 * 1.05
            : Math.max.apply(null, points.map(function (p) { return p.sessions_count; })) * 1.05;

        function sx(v) { return PAD.left + (Math.min(v, maxPrice) / maxPrice) * plotW; }
        function sy(v) { return PAD.top + plotH - (Math.min(v, maxSess) / maxSess) * plotH; }

        /* grid */
        var xTicks = 5, yTicks = 5;
        for (var i = 0; i <= xTicks; i++) {
            var xv = (maxPrice / xTicks) * i;
            var xx = sx(xv);
            svg.appendChild(svgEl("line", { x1: xx, y1: PAD.top, x2: xx, y2: PAD.top + plotH, stroke: GRID_STROKE, "stroke-width": 1 }));
            svg.appendChild(textEl(xx, PAD.top + plotH + 14, fmtK(xv), Object.assign({ "text-anchor": "middle" }, TICK_ATTRS)));
        }
        for (var j = 0; j <= yTicks; j++) {
            var yv = (maxSess / yTicks) * j;
            var yy = sy(yv);
            svg.appendChild(svgEl("line", { x1: PAD.left, y1: yy, x2: PAD.left + plotW, y2: yy, stroke: GRID_STROKE, "stroke-width": 1 }));
            svg.appendChild(textEl(PAD.left - 8, yy + 3, fmtK(yv), Object.assign({ "text-anchor": "end" }, TICK_ATTRS)));
        }

        /* axis labels */
        svg.appendChild(textEl(PAD.left + plotW / 2, SCATTER_H - 4, caps ? "Цена, руб/час (ограничено p99)" : "Цена (руб / час)", Object.assign({ "text-anchor": "middle" }, LABEL_ATTRS)));

        var yLabel = textEl(0, 0, caps ? "Сессии (ограничено p99)" : "Сессии", Object.assign({
            "text-anchor": "middle",
            transform: "translate(16," + (PAD.top + plotH / 2) + ") rotate(-90)"
        }, LABEL_ATTRS));
        svg.appendChild(yLabel);

        /* border */
        svg.appendChild(svgEl("rect", { x: PAD.left, y: PAD.top, width: plotW, height: plotH, fill: "none", stroke: "rgba(17,17,17,0.08)" }));

        /* dots */
        filtered.forEach(function (p) {
            var r = 3 + Math.min(p.reviews_count, 30) * 0.15;
            svg.appendChild(svgEl("circle", {
                cx: sx(p.price), cy: sy(p.sessions_count), r: r,
                fill: catColour(p.derived_category), opacity: "0.55",
                "data-tip": p.derived_category + " | " + fmtK(p.price) + " руб | " + fmtK(p.sessions_count) + " сессий"
            }));
        });

        container.appendChild(svg);
        attachTooltip(svg);
    }

    /* ================================================================== *
     *  3. Top tables
     * ================================================================== */

    function renderTable(container, rows, title) {
        var html = '<table><thead><tr>' +
            '<th style="width:40%">' + title + '</th>' +
            '<th>Категория</th>' +
            '<th style="text-align:right">Цена</th>' +
            '<th style="text-align:right">Сессии</th>' +
            '<th style="text-align:right">Отзывы</th>' +
            '</tr></thead><tbody>';

        rows.forEach(function (r) {
            var link = r.profile_url
                ? '<a href="' + r.profile_url + '" target="_blank" rel="noopener">' + r.name + '</a>'
                : r.name;
            html += '<tr>' +
                '<td>' + link + '</td>' +
                '<td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + catColour(r.derived_category) + ';margin-right:5px;"></span>' + r.derived_category + '</td>' +
                '<td style="text-align:right;font-family:ui-monospace,monospace;font-size:0.85rem">' + fmtK(r.price) + '</td>' +
                '<td style="text-align:right;font-family:ui-monospace,monospace;font-size:0.85rem">' + fmtK(r.sessions_count) + '</td>' +
                '<td style="text-align:right;font-family:ui-monospace,monospace;font-size:0.85rem">' + fmtK(r.reviews_count) + '</td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    /* ================================================================== *
     *  4. Lorenz curve — sessions concentration
     * ================================================================== */

    function renderLorenz(container, lorenzPoints, gini) {
        container.innerHTML = "";

        var W = 480, H = 480;
        var pad = { top: 24, right: 24, bottom: 48, left: 52 };
        var plotW = W - pad.left - pad.right;
        var plotH = H - pad.top - pad.bottom;

        var svg = svgEl("svg", {
            width: "100%", viewBox: "0 0 " + W + " " + H,
            style: "display:block; max-width:480px; height:auto;"
        });

        function sx(v) { return pad.left + v * plotW; }
        function sy(v) { return pad.top + plotH - v * plotH; }

        /* grid */
        for (var i = 0; i <= 4; i++) {
            var frac = i / 4;
            svg.appendChild(svgEl("line", { x1: sx(frac), y1: pad.top, x2: sx(frac), y2: pad.top + plotH, stroke: GRID_STROKE, "stroke-width": 1 }));
            svg.appendChild(svgEl("line", { x1: pad.left, y1: sy(frac), x2: pad.left + plotW, y2: sy(frac), stroke: GRID_STROKE, "stroke-width": 1 }));
            svg.appendChild(textEl(sx(frac), H - 6, (frac * 100).toFixed(0) + "%", Object.assign({ "text-anchor": "middle" }, TICK_ATTRS)));
            svg.appendChild(textEl(pad.left - 6, sy(frac) + 3, (frac * 100).toFixed(0) + "%", Object.assign({ "text-anchor": "end" }, TICK_ATTRS)));
        }

        /* axis labels */
        svg.appendChild(textEl(pad.left + plotW / 2, H - 24, "Доля менторов (кумулятивная)", Object.assign({ "text-anchor": "middle" }, LABEL_ATTRS)));
        svg.appendChild(textEl(0, 0, "Доля сессий (кумулятивная)", Object.assign({
            "text-anchor": "middle",
            transform: "translate(14," + (pad.top + plotH / 2) + ") rotate(-90)"
        }, LABEL_ATTRS)));

        /* border */
        svg.appendChild(svgEl("rect", { x: pad.left, y: pad.top, width: plotW, height: plotH, fill: "none", stroke: "rgba(17,17,17,0.08)" }));

        /* equality diagonal */
        svg.appendChild(svgEl("line", {
            x1: sx(0), y1: sy(0), x2: sx(1), y2: sy(1),
            stroke: "rgba(17,17,17,0.18)", "stroke-width": 1, "stroke-dasharray": "5,4"
        }));

        /* Lorenz path */
        if (lorenzPoints && lorenzPoints.length > 1) {
            var d = "M" + sx(lorenzPoints[0].x) + "," + sy(lorenzPoints[0].y);
            for (var k = 1; k < lorenzPoints.length; k++) {
                d += " L" + sx(lorenzPoints[k].x) + "," + sy(lorenzPoints[k].y);
            }
            svg.appendChild(svgEl("path", {
                d: d, fill: "none", stroke: "#0071e3", "stroke-width": 2.2, opacity: "0.85"
            }));

            /* shaded area between diagonal and Lorenz */
            var areaD = "M" + sx(0) + "," + sy(0);
            for (var m = 0; m < lorenzPoints.length; m++) {
                areaD += " L" + sx(lorenzPoints[m].x) + "," + sy(lorenzPoints[m].y);
            }
            areaD += " L" + sx(1) + "," + sy(1) + " Z";
            svg.appendChild(svgEl("path", {
                d: areaD, fill: "#0071e3", opacity: "0.06"
            }));
        }

        /* Gini label */
        svg.appendChild(textEl(sx(0.55), sy(0.72), "Gini = " + gini.toFixed(3), {
            "font-size": "13", fill: "#111", "font-weight": "600", "font-family": FONT_MONO
        }));

        /* legend: equality line */
        svg.appendChild(svgEl("line", {
            x1: sx(0.52), y1: sy(0.62), x2: sx(0.58), y2: sy(0.62),
            stroke: "rgba(17,17,17,0.18)", "stroke-width": 1, "stroke-dasharray": "4,3"
        }));
        svg.appendChild(textEl(sx(0.60), sy(0.62) + 3, "равенство", {
            "font-size": "10", fill: "#999", "font-family": FONT_SANS
        }));

        container.appendChild(svg);
    }

    /* ================================================================== *
     *  5. Category price bands — median + p25..p75 whiskers
     * ================================================================== */

    function renderCategoryPrice(container, catPrice) {
        container.innerHTML = "";
        if (!catPrice || !catPrice.length) return;

        var barH = 24, gap = 6, labelW = 160, chartW = 700, rightPad = 60;
        var totalH = catPrice.length * (barH + gap) + 16;
        var maxVal = Math.max.apply(null, catPrice.map(function (c) { return c.p75; }));
        maxVal *= 1.1; /* headroom */

        var svg = svgEl("svg", {
            width: "100%", viewBox: "0 0 " + chartW + " " + totalH,
            style: "display:block; max-width:100%; height:auto;"
        });

        var barArea = chartW - labelW - rightPad;

        /* tick marks at top */
        var ticks = 5;
        for (var t = 0; t <= ticks; t++) {
            var tv = (maxVal / ticks) * t;
            var tx = labelW + (tv / maxVal) * barArea;
            svg.appendChild(svgEl("line", { x1: tx, y1: 0, x2: tx, y2: totalH - 2, stroke: GRID_STROKE, "stroke-width": 1 }));
            if (t > 0) {
                svg.appendChild(textEl(tx, totalH - 2, fmtK(tv), Object.assign({ "text-anchor": "middle" }, TICK_ATTRS)));
            }
        }

        catPrice.forEach(function (c, i) {
            var y = i * (barH + gap) + 4;
            var midY = y + barH / 2;
            var col = catColour(c.category);

            /* category label */
            svg.appendChild(textEl(labelW - 8, y + barH * 0.68, c.category, {
                "text-anchor": "end", "font-size": "11", fill: "#555", "font-family": FONT_SANS
            }));

            /* whisker line p25..p75 */
            var x25 = labelW + (c.p25 / maxVal) * barArea;
            var x75 = labelW + (c.p75 / maxVal) * barArea;
            svg.appendChild(svgEl("line", {
                x1: x25, y1: midY, x2: x75, y2: midY,
                stroke: col, "stroke-width": 2, opacity: "0.35"
            }));

            /* whisker caps */
            svg.appendChild(svgEl("line", { x1: x25, y1: midY - 5, x2: x25, y2: midY + 5, stroke: col, "stroke-width": 1.5, opacity: "0.45" }));
            svg.appendChild(svgEl("line", { x1: x75, y1: midY - 5, x2: x75, y2: midY + 5, stroke: col, "stroke-width": 1.5, opacity: "0.45" }));

            /* median dot */
            var xMed = labelW + (c.median / maxVal) * barArea;
            svg.appendChild(svgEl("circle", {
                cx: xMed, cy: midY, r: 5,
                fill: col, opacity: "0.82"
            }));

            /* median label */
            svg.appendChild(textEl(xMed + 8, midY + 4, fmtK(c.median), {
                "font-size": "10", fill: "#888", "font-family": FONT_MONO
            }));
        });

        container.appendChild(svg);
    }

    /* ================================================================== *
     *  6. Cold start by category — % mentors with 0 reviews
     * ================================================================== */

    function renderColdStart(container, coldData) {
        container.innerHTML = "";
        if (!coldData || !coldData.length) return;

        var barH = 24, gap = 6, labelW = 160, chartW = 700, rightPad = 60;
        var totalH = coldData.length * (barH + gap) + 12;

        var svg = svgEl("svg", {
            width: "100%", viewBox: "0 0 " + chartW + " " + totalH,
            style: "display:block; max-width:100%; height:auto;"
        });

        var barArea = chartW - labelW - rightPad;

        /* grid: 0% .. 100% */
        for (var t = 0; t <= 4; t++) {
            var pct = t / 4;
            var tx = labelW + pct * barArea;
            svg.appendChild(svgEl("line", { x1: tx, y1: 0, x2: tx, y2: totalH, stroke: GRID_STROKE, "stroke-width": 1 }));
            svg.appendChild(textEl(tx, totalH, (pct * 100).toFixed(0) + "%", Object.assign({ "text-anchor": "middle" }, TICK_ATTRS)));
        }

        coldData.forEach(function (c, i) {
            var y = i * (barH + gap) + 4;
            var w = c.zero_reviews_pct * barArea;
            var col = catColour(c.category);

            svg.appendChild(textEl(labelW - 8, y + barH * 0.68, c.category, {
                "text-anchor": "end", "font-size": "11", fill: "#555", "font-family": FONT_SANS
            }));

            svg.appendChild(svgEl("rect", {
                x: labelW, y: y, width: Math.max(w, 2), height: barH,
                rx: 4, fill: col, opacity: "0.65"
            }));

            svg.appendChild(textEl(labelW + w + 6, y + barH * 0.68, fmtPct(c.zero_reviews_pct), {
                "font-size": "11", fill: "#888", "font-family": FONT_MONO
            }));
        });

        container.appendChild(svg);
    }

    /* ================================================================== *
     *  7. Marketplace metrics panel
     * ================================================================== */

    function renderMarketplaceMetrics(container, mm) {
        if (!mm) return;
        var ts = mm.sessions_top_share || {};
        var cs = mm.cold_start || {};

        var items = [
            ["Топ-1% → доля сессий", fmtPct(ts.top_1_pct || 0)],
            ["Топ-5% → доля сессий", fmtPct(ts.top_5_pct || 0)],
            ["Топ-10% → доля сессий", fmtPct(ts.top_10_pct || 0)],
            ["Gini (сессии)", (mm.sessions_gini || 0).toFixed(3)],
            ["Холодный старт: 0 отзывов", fmtPct(cs.zero_reviews_pct || 0)],
            ["Холодный старт: ≤1 сессия", fmtPct(cs.leq1_sessions_pct || 0)],
            ["Ценовой разброс p75/p25", "×" + (mm.price_dispersion_p75_p25 || 0).toFixed(2)],
            ["Покрытие отзывами (≥1)", fmtPct(mm.reviews_coverage_pct || 0)]
        ];

        var html = '<div class="metrics-grid">';
        items.forEach(function (pair) {
            html += '<div class="metric-item">' +
                '<span class="metric-value">' + pair[1] + '</span>' +
                '<span class="metric-label">' + pair[0] + '</span>' +
                '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
    }

    /* ================================================================== *
     *  8. Demand vs Supply by category
     * ================================================================== */

    function renderDemandSupply(container, catMarketplace) {
        container.innerHTML = "";
        if (!catMarketplace || !catMarketplace.length) return;

        var barH = 26, gap = 6, labelW = 160, chartW = 700, rightPad = 120;
        var totalH = catMarketplace.length * (barH + gap) + 12;

        /* Cap axis at p95 of ratios for readability */
        var allRatios = catMarketplace.map(function (c) { return c.demand_supply_ratio; }).sort(function (a, b) { return a - b; });
        var p95idx = Math.min(Math.floor(allRatios.length * 0.95), allRatios.length - 1);
        var p95val = allRatios[p95idx] || 1;
        var maxRatio = Math.min(p95val, allRatios[allRatios.length - 1]) * 1.1;
        if (maxRatio < 1) maxRatio = Math.max.apply(null, allRatios) * 1.1;

        var svg = svgEl("svg", {
            width: "100%", viewBox: "0 0 " + chartW + " " + totalH,
            style: "display:block; max-width:100%; height:auto;"
        });

        var barArea = chartW - labelW - rightPad;

        /* reference line at ratio=1 */
        var x1line = labelW + (1.0 / maxRatio) * barArea;
        if (x1line > labelW && x1line < labelW + barArea) {
            svg.appendChild(svgEl("line", {
                x1: x1line, y1: 0, x2: x1line, y2: totalH,
                stroke: "rgba(17,17,17,0.16)", "stroke-width": 1, "stroke-dasharray": "4,3"
            }));
            svg.appendChild(textEl(x1line, totalH, "1.0×", Object.assign({ "text-anchor": "middle" }, TICK_ATTRS)));
        }

        /* grid */
        var ticks = 4;
        for (var t = 0; t <= ticks; t++) {
            var tv = (maxRatio / ticks) * t;
            var tx = labelW + (tv / maxRatio) * barArea;
            svg.appendChild(svgEl("line", { x1: tx, y1: 0, x2: tx, y2: totalH - 2, stroke: GRID_STROKE, "stroke-width": 1 }));
        }

        catMarketplace.forEach(function (c, i) {
            var y = i * (barH + gap) + 4;
            var ratio = c.demand_supply_ratio;
            var cappedRatio = Math.min(ratio, maxRatio);
            var w = (cappedRatio / maxRatio) * barArea;
            var col = catColour(c.category);

            /* label */
            svg.appendChild(textEl(labelW - 8, y + barH * 0.68, c.category, {
                "text-anchor": "end", "font-size": "11", fill: "#555", "font-family": FONT_SANS
            }));

            /* bar */
            svg.appendChild(svgEl("rect", {
                x: labelW, y: y, width: Math.max(w, 2), height: barH,
                rx: 4, fill: col, opacity: "0.72"
            }));

            /* ratio + demand/supply text */
            var ratioTxt = ratio.toFixed(2) + "×";
            var detailTxt = "Спрос " + fmtPct(c.sessions_share) + " · Предл. " + fmtPct(c.mentors_share);
            svg.appendChild(textEl(labelW + w + 6, y + barH * 0.42, ratioTxt, {
                "font-size": "11", fill: "#111", "font-weight": "600", "font-family": FONT_MONO
            }));
            svg.appendChild(textEl(labelW + w + 6, y + barH * 0.88, detailTxt, {
                "font-size": "9", fill: "#999", "font-family": FONT_MONO
            }));
        });

        container.appendChild(svg);
    }

    /* ================================================================== *
     *  9. Core vs Long Tail composition
     * ================================================================== */

    function renderCoreSegments(container, coreData) {
        container.innerHTML = "";
        if (!coreData) return;

        var segments = [
            { key: "core_top_5_pct", label: "Ядро (топ-5%)", color: "#0071e3" },
            { key: "mid_next_25_pct", label: "Средний слой (25%)", color: "#047857" },
            { key: "long_tail_rest", label: "Длинный хвост", color: "#b45309" }
        ];

        /* --- Stacked bar (SVG) --- */
        var W = 700, barH = 40, padTop = 28, padBottom = 8;
        var H = barH + padTop + padBottom;

        var svg = svgEl("svg", {
            width: "100%", viewBox: "0 0 " + W + " " + H,
            style: "display:block; max-width:100%; height:auto; margin-bottom:0.75rem;"
        });

        var x = 0;
        segments.forEach(function (seg) {
            var d = coreData[seg.key];
            if (!d) return;
            var w = d.sessions_share * W;

            svg.appendChild(svgEl("rect", {
                x: x, y: padTop, width: Math.max(w, 1), height: barH,
                fill: seg.color, opacity: "0.75",
                rx: x === 0 ? 6 : (x + w >= W - 1 ? 6 : 0)
            }));

            /* label above bar */
            if (w > 40) {
                svg.appendChild(textEl(x + w / 2, padTop - 8, seg.label, {
                    "text-anchor": "middle", "font-size": "11", fill: "#555",
                    "font-weight": "600", "font-family": FONT_SANS
                }));
                svg.appendChild(textEl(x + w / 2, padTop + barH / 2 + 5, fmtPct(d.sessions_share) + " сессий", {
                    "text-anchor": "middle", "font-size": "11", fill: "#fff",
                    "font-weight": "600", "font-family": FONT_MONO
                }));
            }

            x += w;
        });

        container.appendChild(svg);

        /* --- Summary table (DOM) --- */
        var table = document.createElement("div");
        table.className = "table-wrap";

        var html = '<table><thead><tr>' +
            '<th>Сегмент</th>' +
            '<th style="text-align:right">Менторов</th>' +
            '<th style="text-align:right">Сессий</th>' +
            '<th style="text-align:right">Мед. цена</th>' +
            '<th style="text-align:right">Мед. сессии</th>' +
            '<th style="text-align:right">Мед. отзывы</th>' +
            '</tr></thead><tbody>';

        segments.forEach(function (seg) {
            var d = coreData[seg.key];
            if (!d) return;
            html += '<tr>' +
                '<td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + seg.color + ';margin-right:6px;opacity:0.75;"></span>' + seg.label + '</td>' +
                '<td style="text-align:right;font-family:ui-monospace,monospace;font-size:0.85rem">' + fmtPct(d.mentors_share) + '</td>' +
                '<td style="text-align:right;font-family:ui-monospace,monospace;font-size:0.85rem">' + fmtPct(d.sessions_share) + '</td>' +
                '<td style="text-align:right;font-family:ui-monospace,monospace;font-size:0.85rem">' + fmtK(d.median_price) + '</td>' +
                '<td style="text-align:right;font-family:ui-monospace,monospace;font-size:0.85rem">' + fmtK(d.median_sessions) + '</td>' +
                '<td style="text-align:right;font-family:ui-monospace,monospace;font-size:0.85rem">' + fmtK(d.median_reviews) + '</td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        table.innerHTML = html;
        container.appendChild(table);
    }

    /* ================================================================== *
     *  10. Histogram — reusable for price / sessions distributions
     * ================================================================== */

    function renderHistogram(container, histData, xLabel) {
        container.innerHTML = "";
        var bins = histData ? (histData.bin_edges || histData.bins) : null;
        if (!bins || !bins.length) return;

        var counts = histData.counts;
        var nBins = counts.length;
        var maxCount = Math.max.apply(null, counts);
        if (maxCount === 0) maxCount = 1;

        var W = 700, H = 300;
        var pad = { top: 16, right: 20, bottom: 52, left: 54 };
        var plotW = W - pad.left - pad.right;
        var plotH = H - pad.top - pad.bottom;

        var svg = svgEl("svg", {
            width: "100%", viewBox: "0 0 " + W + " " + H,
            style: "display:block; max-width:100%; height:auto;"
        });

        var barW = plotW / nBins;

        /* Y grid + ticks */
        var yTicks = 5;
        for (var j = 0; j <= yTicks; j++) {
            var yv = (maxCount / yTicks) * j;
            var yy = pad.top + plotH - (yv / maxCount) * plotH;
            svg.appendChild(svgEl("line", { x1: pad.left, y1: yy, x2: pad.left + plotW, y2: yy, stroke: GRID_STROKE, "stroke-width": 1 }));
            svg.appendChild(textEl(pad.left - 8, yy + 3, String(Math.round(yv)), Object.assign({ "text-anchor": "end" }, TICK_ATTRS)));
        }

        /* bars */
        for (var i = 0; i < nBins; i++) {
            var h = (counts[i] / maxCount) * plotH;
            var x = pad.left + i * barW;
            var y = pad.top + plotH - h;
            svg.appendChild(svgEl("rect", {
                x: x + 0.5, y: y, width: Math.max(barW - 1, 1), height: Math.max(h, 0),
                fill: "#0071e3", opacity: "0.62", rx: 1
            }));
        }

        /* X ticks — show ~6 evenly spaced bin edges */
        var xTickStep = Math.max(1, Math.floor(nBins / 6));
        for (var t = 0; t <= nBins; t += xTickStep) {
            var tx = pad.left + t * barW;
            svg.appendChild(textEl(tx, pad.top + plotH + 14, fmtK(bins[t]), Object.assign({ "text-anchor": "middle" }, TICK_ATTRS)));
        }

        /* axis labels */
        svg.appendChild(textEl(pad.left + plotW / 2, H - 4, xLabel, Object.assign({ "text-anchor": "middle" }, LABEL_ATTRS)));
        svg.appendChild(textEl(0, 0, "Количество менторов", Object.assign({
            "text-anchor": "middle",
            transform: "translate(14," + (pad.top + plotH / 2) + ") rotate(-90)"
        }, LABEL_ATTRS)));

        /* border */
        svg.appendChild(svgEl("rect", { x: pad.left, y: pad.top, width: plotW, height: plotH, fill: "none", stroke: "rgba(17,17,17,0.08)" }));

        container.appendChild(svg);
    }

    /* ================================================================== *
     *  11. Correlation heatmap (3×3)
     * ================================================================== */

    function renderHeatmap(container, corrData) {
        container.innerHTML = "";
        if (!corrData || !corrData.matrix) return;

        var labels = corrData.labels;
        var matrix = corrData.matrix;
        var n = labels.length;

        var cellSize = 90, labelW = 80, topPad = 60;
        var W = labelW + n * cellSize + 10;
        var H = topPad + n * cellSize + 10;

        var svg = svgEl("svg", {
            width: "100%", viewBox: "0 0 " + W + " " + H,
            style: "display:block; max-width:380px; height:auto;"
        });

        /* colour interpolation: white (corr=0) → blue (corr=1), red for negative */
        function corrColour(v) {
            if (v >= 0) {
                var t = Math.min(v, 1);
                var r = Math.round(255 * (1 - t * 0.7));
                var g = Math.round(255 * (1 - t * 0.7));
                return "rgb(" + r + "," + g + ",255)";
            }
            var t2 = Math.min(Math.abs(v), 1);
            var g2 = Math.round(255 * (1 - t2 * 0.7));
            var b2 = Math.round(255 * (1 - t2 * 0.7));
            return "rgb(255," + g2 + "," + b2 + ")";
        }

        /* column headers */
        for (var c = 0; c < n; c++) {
            svg.appendChild(textEl(
                labelW + c * cellSize + cellSize / 2,
                topPad - 12,
                labels[c],
                Object.assign({ "text-anchor": "middle", "font-weight": "600" }, LABEL_ATTRS)
            ));
        }

        for (var row = 0; row < n; row++) {
            /* row label */
            svg.appendChild(textEl(
                labelW - 8,
                topPad + row * cellSize + cellSize / 2 + 4,
                labels[row],
                Object.assign({ "text-anchor": "end", "font-weight": "600" }, LABEL_ATTRS)
            ));

            for (var col = 0; col < n; col++) {
                var val = matrix[row][col];
                var x = labelW + col * cellSize;
                var y = topPad + row * cellSize;

                svg.appendChild(svgEl("rect", {
                    x: x + 1, y: y + 1,
                    width: cellSize - 2, height: cellSize - 2,
                    rx: 6, fill: corrColour(val), stroke: "rgba(17,17,17,0.06)", "stroke-width": 1
                }));

                svg.appendChild(textEl(
                    x + cellSize / 2,
                    y + cellSize / 2 + 5,
                    val.toFixed(2),
                    { "text-anchor": "middle", "font-size": "13", fill: Math.abs(val) > 0.5 ? "#fff" : "#333", "font-weight": "600", "font-family": FONT_MONO }
                ));
            }
        }

        container.appendChild(svg);
    }

    /* ================================================================== *
     *  12. Affordable active mentors table
     * ================================================================== */

    function renderAffordableTable(container, rows) {
        if (!rows || !rows.length) return;
        var html = '<table><thead><tr>' +
            '<th style="width:35%">Ментор</th>' +
            '<th>Категория</th>' +
            '<th style="text-align:right">Цена</th>' +
            '<th style="text-align:right">Сессии</th>' +
            '<th style="text-align:right">Отзывы</th>' +
            '</tr></thead><tbody>';

        rows.forEach(function (r) {
            var nameCell = r.profile_url
                ? '<a href="' + r.profile_url + '" target="_blank" rel="noopener">' + r.name + '</a>'
                : r.name;
            html += '<tr>' +
                '<td>' + nameCell + '</td>' +
                '<td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + catColour(r.derived_category) + ';margin-right:5px;"></span>' + r.derived_category + '</td>' +
                '<td style="text-align:right;font-family:ui-monospace,monospace;font-size:0.85rem">' + fmtK(r.price) + '</td>' +
                '<td style="text-align:right;font-family:ui-monospace,monospace;font-size:0.85rem">' + fmtK(r.sessions_count) + '</td>' +
                '<td style="text-align:right;font-family:ui-monospace,monospace;font-size:0.85rem">' + fmtK(r.reviews_count) + '</td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    /* ================================================================== *
     *  Shared tooltip helper
     * ================================================================== */

    function attachTooltip(svg) {
        var tip = document.createElement("div");
        tip.style.cssText = "position:fixed;pointer-events:none;background:#111;color:#fff;padding:4px 10px;border-radius:6px;font-size:12px;display:none;z-index:99;white-space:nowrap;font-family:-apple-system,sans-serif;";
        document.body.appendChild(tip);

        svg.addEventListener("mousemove", function (e) {
            var t = e.target;
            if (t.getAttribute && t.getAttribute("data-tip")) {
                tip.textContent = t.getAttribute("data-tip");
                tip.style.display = "block";
                tip.style.left = e.clientX + 12 + "px";
                tip.style.top = e.clientY - 28 + "px";
            } else {
                tip.style.display = "none";
            }
        });
        svg.addEventListener("mouseleave", function () { tip.style.display = "none"; });
    }

    /* ================================================================== *
     *  Init
     * ================================================================== */

    function init() {
        fetch("summary.json")
            .then(function (r) { return r.json(); })
            .then(function (data) {
                /* Pre-assign colours in category order */
                data.counts.categories.forEach(function (c) { catColour(c.category); });

                /* Bar chart — category counts */
                var barEl = document.getElementById("chart-categories");
                if (barEl) renderBarChart(barEl, data.counts.categories);

                /* Scatter (p99-capped) */
                var scatterEl = document.getElementById("chart-scatter");
                if (scatterEl) renderScatter(scatterEl, data, "All");

                /* Category filter dropdown */
                var sel = document.getElementById("cat-filter");
                if (sel && scatterEl) {
                    sel.innerHTML = '<option value="All">Все категории</option>';
                    data.counts.categories.forEach(function (c) {
                        var opt = document.createElement("option");
                        opt.value = c.category;
                        opt.textContent = c.category + " (" + c.mentors + ")";
                        sel.appendChild(opt);
                    });
                    sel.addEventListener("change", function () {
                        renderScatter(scatterEl, data, sel.value);
                    });
                }

                /* Top tables */
                var tSess = document.getElementById("table-top-sessions");
                if (tSess) renderTable(tSess, data.top_tables.top_sessions, "Ментор (по сессиям)");

                var tRev = document.getElementById("table-top-reviews");
                if (tRev) renderTable(tRev, data.top_tables.top_reviews, "Ментор (по отзывам)");

                /* Price stats card */
                var priceStats = document.getElementById("price-stats");
                if (priceStats) {
                    var p = data.price;
                    priceStats.innerHTML =
                        '<span class="value">' + fmtK(p.median) + '</span>' +
                        '<span class="label">медиана цены (руб/час)</span>' +
                        '<span class="label" style="margin-top:2px;font-size:0.72rem;">p25=' + fmtK(p.p25) + '  p75=' + fmtK(p.p75) + '  max=' + fmtK(p.max) + '</span>';
                }

                var sessStats = document.getElementById("sessions-stats");
                if (sessStats) {
                    var s = data.sessions;
                    sessStats.innerHTML =
                        '<span class="value">' + fmtK(s.median) + '</span>' +
                        '<span class="label">медиана сессий</span>' +
                        '<span class="label" style="margin-top:2px;font-size:0.72rem;">p25=' + fmtK(s.p25) + '  p75=' + fmtK(s.p75) + '  max=' + fmtK(s.max) + '</span>';
                }

                /* ---- NEW CHARTS ---- */

                /* Lorenz curve */
                var lorenzEl = document.getElementById("chart-lorenz");
                if (lorenzEl && data.lorenz) {
                    renderLorenz(
                        lorenzEl,
                        data.lorenz.sessions_lorenz_points,
                        data.marketplace_metrics ? data.marketplace_metrics.sessions_gini : 0
                    );
                }

                /* Category price bands */
                var catPriceEl = document.getElementById("chart-category-price");
                if (catPriceEl && data.category_tables) {
                    renderCategoryPrice(catPriceEl, data.category_tables.category_price);
                }

                /* Cold start by category */
                var coldEl = document.getElementById("chart-cold-start");
                if (coldEl && data.category_tables) {
                    renderColdStart(coldEl, data.category_tables.cold_start_by_category);
                }

                /* Marketplace metrics panel */
                var mmEl = document.getElementById("marketplace-metrics");
                if (mmEl && data.marketplace_metrics) {
                    renderMarketplaceMetrics(mmEl, data.marketplace_metrics);
                }

                /* Demand vs Supply */
                var dsEl = document.getElementById("chart-demand-supply");
                if (dsEl && data.category_marketplace) {
                    renderDemandSupply(dsEl, data.category_marketplace);
                }

                /* Core vs Long Tail */
                var csEl = document.getElementById("chart-core-segments");
                if (csEl && data.core_segments) {
                    renderCoreSegments(csEl, data.core_segments);
                }

                /* Price histogram */
                var phEl = document.getElementById("chart-price-hist");
                if (phEl && data.charts_data && data.charts_data.distributions) {
                    renderHistogram(phEl, data.charts_data.distributions.price_hist, "Цена, руб/час (ограничено p99)");
                }

                /* Sessions histogram */
                var shEl = document.getElementById("chart-sessions-hist");
                if (shEl && data.charts_data && data.charts_data.distributions) {
                    renderHistogram(shEl, data.charts_data.distributions.sessions_hist, "Сессии (ограничено p99)");
                }

                /* Correlation heatmap */
                var hmEl = document.getElementById("chart-heatmap");
                var hmData = data.charts_data
                    ? (data.charts_data.correlation_heatmap || data.charts_data.correlation_matrix)
                    : null;
                if (hmEl && hmData) {
                    renderHeatmap(hmEl, hmData);
                }

                /* Affordable active mentors */
                var aaEl = document.getElementById("table-affordable-active");
                if (aaEl && data.tables && data.tables.affordable_active) {
                    renderAffordableTable(aaEl, data.tables.affordable_active);
                }
            })
            .catch(function (err) {
                console.error("charts.js: failed to load summary.json", err);
            });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
