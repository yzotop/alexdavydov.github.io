/* charts.js — Vanilla SVG charts for the NIKIFILINI case study.
 *
 * Reads summary.json (relative), renders:
 *   1.  Price histogram                    → #chart-price-hist
 *   2.  Category SKU counts (horiz. bars)  → #chart-category-counts
 *   3.  Category price bands (whiskers)    → #chart-category-price
 *   4.  OOS by category (horiz. bars)      → #chart-oos-category
 *   5.  Top expensive table                → #table-expensive
 *   6.  Top affordable table               → #table-affordable
 *   7.  Top discounted table               → #table-discount
 *
 * No dependencies. No build step. Vanilla JS + inline SVG.
 * --------------------------------------------------------------------- */

(function () {
    "use strict";

    /* ---- colour palette ---- */
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

    /* ---- text style constants ---- */
    var FONT_SANS = "-apple-system, BlinkMacSystemFont, sans-serif";
    var FONT_MONO = "ui-monospace, 'SF Mono', monospace";
    var TICK_ATTRS = { "font-size": "10", fill: "#999", "font-family": FONT_MONO };
    var LABEL_ATTRS = { "font-size": "11", fill: "#555", "font-family": FONT_SANS };
    var GRID_STROKE = "rgba(17,17,17,0.06)";

    /* ---- formatting ---- */
    function fmtK(n) {
        if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
        return String(Math.round(n));
    }

    function fmtRub(n) {
        if (n == null) return "—";
        return Math.round(n).toLocaleString("ru-RU") + " ₽";
    }

    function fmtPct(n) {
        return (n * 100).toFixed(1) + "%";
    }

    /* ================================================================== *
     *  1. Price histogram
     * ================================================================== */

    function renderPriceHistogram(container, histData) {
        container.innerHTML = "";
        if (!histData || !histData.bins || !histData.bins.length) return;

        var bins = histData.bins;
        var W = 700, H = 320;
        var pad = { top: 16, right: 20, bottom: 52, left: 52 };
        var plotW = W - pad.left - pad.right;
        var plotH = H - pad.top - pad.bottom;

        var maxCount = Math.max.apply(null, bins.map(function (b) { return b.count; }));
        if (maxCount === 0) maxCount = 1;

        var svg = svgEl("svg", {
            width: "100%", viewBox: "0 0 " + W + " " + H,
            style: "display:block; max-width:100%; height:auto;"
        });

        /* Y grid */
        var yTicks = 5;
        for (var j = 0; j <= yTicks; j++) {
            var yv = (maxCount / yTicks) * j;
            var yy = pad.top + plotH - (yv / maxCount) * plotH;
            svg.appendChild(svgEl("line", { x1: pad.left, y1: yy, x2: pad.left + plotW, y2: yy, stroke: GRID_STROKE, "stroke-width": 1 }));
            svg.appendChild(textEl(pad.left - 8, yy + 3, String(Math.round(yv)), Object.assign({ "text-anchor": "end" }, TICK_ATTRS)));
        }

        /* Bars */
        var barW = plotW / bins.length;
        var barGap = Math.max(1, barW * 0.08);

        bins.forEach(function (b, i) {
            var bh = (b.count / maxCount) * plotH;
            var bx = pad.left + i * barW + barGap / 2;
            var by = pad.top + plotH - bh;

            svg.appendChild(svgEl("rect", {
                x: bx, y: by, width: Math.max(barW - barGap, 1), height: bh,
                fill: "#0071e3", opacity: "0.72", rx: 1
            }));
        });

        /* X ticks — show every ~5th bin */
        var step = Math.max(1, Math.floor(bins.length / 6));
        for (var k = 0; k < bins.length; k += step) {
            var tx = pad.left + k * barW + barW / 2;
            svg.appendChild(textEl(tx, H - 10, fmtK(bins[k].bin_lo), Object.assign({ "text-anchor": "middle" }, TICK_ATTRS)));
        }

        /* Axis labels */
        svg.appendChild(textEl(pad.left + plotW / 2, H - 0, "Цена, ₽ (ограничено p99)", Object.assign({ "text-anchor": "middle" }, LABEL_ATTRS)));
        svg.appendChild(textEl(0, 0, "Кол-во SKU", Object.assign({
            "text-anchor": "middle",
            transform: "translate(14," + (pad.top + plotH / 2) + ") rotate(-90)"
        }, LABEL_ATTRS)));

        /* Border */
        svg.appendChild(svgEl("rect", { x: pad.left, y: pad.top, width: plotW, height: plotH, fill: "none", stroke: "rgba(17,17,17,0.08)" }));

        container.appendChild(svg);
    }

    /* ================================================================== *
     *  2. Horizontal bar chart — category counts
     * ================================================================== */

    function renderCategoryCounts(container, categories) {
        container.innerHTML = "";
        if (!categories || !categories.length) return;

        var barH = 26, gap = 6, labelW = 130, chartW = 700, rightPad = 65;
        var totalH = categories.length * (barH + gap) + 12;
        var maxVal = Math.max.apply(null, categories.map(function (c) { return c.sku_count; }));

        var svg = svgEl("svg", {
            width: "100%", viewBox: "0 0 " + chartW + " " + totalH,
            style: "display:block; max-width:100%; height:auto;"
        });

        var barArea = chartW - labelW - rightPad;

        categories.forEach(function (c, i) {
            var y = i * (barH + gap) + 4;
            var w = (c.sku_count / maxVal) * barArea;
            var col = catColour(c.category);

            svg.appendChild(textEl(labelW - 8, y + barH * 0.68, c.category, {
                "text-anchor": "end", "font-size": "11", fill: "#555", "font-family": FONT_SANS
            }));

            svg.appendChild(svgEl("rect", {
                x: labelW, y: y, width: Math.max(w, 2), height: barH,
                rx: 4, fill: col, opacity: "0.82"
            }));

            var label = String(c.sku_count) + " (" + fmtPct(c.sku_share) + ")";
            svg.appendChild(textEl(labelW + w + 6, y + barH * 0.68, label, {
                "font-size": "10", fill: "#888", "font-family": FONT_MONO
            }));
        });

        container.appendChild(svg);
    }

    /* ================================================================== *
     *  3. Category price bands — whiskers p25..p75 + median dot
     * ================================================================== */

    function renderCategoryPriceBands(container, catPrice) {
        container.innerHTML = "";
        if (!catPrice || !catPrice.length) return;

        var barH = 24, gap = 6, labelW = 130, chartW = 700, rightPad = 70;
        var totalH = catPrice.length * (barH + gap) + 16;
        var maxVal = Math.max.apply(null, catPrice.map(function (c) { return c.p75; }));
        maxVal *= 1.15;

        var svg = svgEl("svg", {
            width: "100%", viewBox: "0 0 " + chartW + " " + totalH,
            style: "display:block; max-width:100%; height:auto;"
        });

        var barArea = chartW - labelW - rightPad;

        /* Tick marks */
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

            /* Label */
            svg.appendChild(textEl(labelW - 8, y + barH * 0.68, c.category, {
                "text-anchor": "end", "font-size": "11", fill: "#555", "font-family": FONT_SANS
            }));

            /* Whisker line p25..p75 */
            var x25 = labelW + (c.p25 / maxVal) * barArea;
            var x75 = labelW + (c.p75 / maxVal) * barArea;
            svg.appendChild(svgEl("line", {
                x1: x25, y1: midY, x2: x75, y2: midY,
                stroke: col, "stroke-width": 3, opacity: "0.5", "stroke-linecap": "round"
            }));

            /* Median dot */
            var xMed = labelW + (c.median / maxVal) * barArea;
            svg.appendChild(svgEl("circle", {
                cx: xMed, cy: midY, r: 5,
                fill: col, stroke: "#fff", "stroke-width": 1.5
            }));

            /* Value label */
            svg.appendChild(textEl(x75 + 8, midY + 3.5, fmtK(c.median) + " ₽", {
                "font-size": "10", fill: "#888", "font-family": FONT_MONO
            }));
        });

        container.appendChild(svg);
    }

    /* ================================================================== *
     *  4. OOS by category — horizontal bars
     * ================================================================== */

    function renderOOSByCategory(container, oosData) {
        container.innerHTML = "";
        if (!oosData || !oosData.length) return;

        /* Filter to categories with at least some OOS */
        var data = oosData.filter(function (d) { return d.out_of_stock > 0; });
        if (!data.length) {
            container.innerHTML = '<p style="color:rgba(17,17,17,.38);font-size:0.85rem;">Нет данных о stock-out.</p>';
            return;
        }

        var barH = 24, gap = 6, labelW = 130, chartW = 700, rightPad = 65;
        var totalH = data.length * (barH + gap) + 12;

        var svg = svgEl("svg", {
            width: "100%", viewBox: "0 0 " + chartW + " " + totalH,
            style: "display:block; max-width:100%; height:auto;"
        });

        var barArea = chartW - labelW - rightPad;

        data.forEach(function (d, i) {
            var y = i * (barH + gap) + 4;
            var w = d.oos_share * barArea;
            var col = "#dc2626";

            svg.appendChild(textEl(labelW - 8, y + barH * 0.68, d.category, {
                "text-anchor": "end", "font-size": "11", fill: "#555", "font-family": FONT_SANS
            }));

            svg.appendChild(svgEl("rect", {
                x: labelW, y: y, width: Math.max(w, 2), height: barH,
                rx: 4, fill: col, opacity: "0.55"
            }));

            var label = fmtPct(d.oos_share) + " (" + d.out_of_stock + "/" + d.total + ")";
            svg.appendChild(textEl(labelW + w + 6, y + barH * 0.68, label, {
                "font-size": "10", fill: "#888", "font-family": FONT_MONO
            }));
        });

        container.appendChild(svg);
    }

    /* ================================================================== *
     *  5. Tables
     * ================================================================== */

    function renderProductTable(container, rows, title, showDiscount) {
        if (!rows || !rows.length) {
            container.innerHTML = '<p style="color:rgba(17,17,17,.38);font-size:0.85rem;">Нет данных.</p>';
            return;
        }

        var html = '<table><thead><tr>' +
            '<th style="width:40%">' + title + '</th>' +
            '<th>Категория</th>' +
            '<th style="text-align:right">Цена</th>';

        if (showDiscount) {
            html += '<th style="text-align:right">Было</th>' +
                '<th style="text-align:right">Скидка</th>';
        }

        html += '<th style="text-align:center">Наличие</th>' +
            '</tr></thead><tbody>';

        rows.forEach(function (r) {
            var link = r.product_url
                ? '<a href="' + r.product_url + '" target="_blank" rel="noopener">' + r.title + '</a>'
                : r.title;

            html += '<tr>' +
                '<td>' + link + '</td>' +
                '<td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + catColour(r.category) + ';margin-right:5px;"></span>' + r.category + '</td>' +
                '<td style="text-align:right;font-family:ui-monospace,monospace;font-size:0.85rem">' + fmtRub(r.price_current) + '</td>';

            if (showDiscount) {
                var disc = (r.price_old && r.price_current)
                    ? Math.round((1 - r.price_current / r.price_old) * 100) + "%"
                    : "—";
                html += '<td style="text-align:right;font-family:ui-monospace,monospace;font-size:0.85rem;color:#999;text-decoration:line-through;">' + fmtRub(r.price_old) + '</td>' +
                    '<td style="text-align:right;font-family:ui-monospace,monospace;font-size:0.85rem;color:#dc2626;">' + disc + '</td>';
            }

            html += '<td style="text-align:center">' + (r.in_stock ? '✓' : '<span style="color:#dc2626">✗</span>') + '</td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    /* ================================================================== *
     *  KPI injection
     * ================================================================== */

    function injectKPIs(kpis) {
        var map = {
            "kpi-sku": kpis.sku_total,
            "kpi-categories": kpis.categories_total,
            "kpi-median-price": fmtRub(kpis.median_price),
            "kpi-discount": fmtPct(kpis.discount_share),
        };
        Object.keys(map).forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.textContent = String(map[id]);
        });
    }

    /* ================================================================== *
     *  Bootstrap
     * ================================================================== */

    fetch("summary.json")
        .then(function (r) { return r.json(); })
        .then(function (data) {
            var cd = data.charts_data || {};
            var tb = data.tables || {};

            /* KPIs */
            if (data.kpis) injectKPIs(data.kpis);

            /* Charts */
            var el;
            el = document.getElementById("chart-price-hist");
            if (el) renderPriceHistogram(el, cd.price_hist);

            el = document.getElementById("chart-category-counts");
            if (el) renderCategoryCounts(el, cd.category_counts);

            el = document.getElementById("chart-category-price");
            if (el) renderCategoryPriceBands(el, cd.category_price_bands);

            el = document.getElementById("chart-oos-category");
            if (el) renderOOSByCategory(el, cd.oos_by_category);

            /* Tables */
            el = document.getElementById("table-expensive");
            if (el) renderProductTable(el, tb.top_20_expensive, "Товар", false);

            el = document.getElementById("table-affordable");
            if (el) renderProductTable(el, tb.top_20_affordable, "Товар", false);

            el = document.getElementById("table-discount");
            if (el) renderProductTable(el, tb.discounted_top_20, "Товар", true);
        })
        .catch(function (err) {
            console.error("charts.js: failed to load summary.json", err);
        });
})();
