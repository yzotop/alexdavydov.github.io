/* charts_story.js — SVG charts for NIKIFILINI Telegram story slides.
 *
 * Renders into fixed 1080×1920 slide containers.
 * No dependencies. Vanilla JS + inline SVG.
 * ----------------------------------------------------------------- */

(function () {
    "use strict";

    var PALETTE = [
        "#111", "#0071e3", "#047857", "#b45309", "#7c3aed",
        "#dc2626", "#0891b2", "#4f46e5", "#c2410c", "#059669"
    ];

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

    var FONT = "'SF Pro Display', -apple-system, 'Helvetica Neue', sans-serif";
    var MONO = "'SF Mono', ui-monospace, 'Cascadia Code', monospace";

    function fmtRub(n) {
        if (n == null) return "—";
        return Math.round(n).toLocaleString("ru-RU") + " ₽";
    }

    function fmtPct(n) {
        if (n == null) return "—";
        return n.toFixed(1) + "%";
    }

    /* ==================================================================
     *  Horizontal bar chart (category mix / stock-out)
     * ================================================================== */

    function renderHBar(container, items, valueKey, labelKey, opts) {
        container.innerHTML = "";
        if (!items || !items.length) return;

        opts = opts || {};
        var W = opts.width || 920;
        var barH = opts.barH || 52;
        var gap = opts.gap || 14;
        var labelW = opts.labelW || 260;
        var rightPad = opts.rightPad || 220;
        var totalH = items.length * (barH + gap) + 10;
        var maxVal = Math.max.apply(null, items.map(function (d) { return d[valueKey]; }));
        if (maxVal === 0) maxVal = 1;
        var barArea = W - labelW - rightPad;
        var color = opts.color || "#111";

        var svg = svgEl("svg", {
            width: W, height: totalH,
            style: "display:block;"
        });

        items.forEach(function (d, i) {
            var y = i * (barH + gap);
            var w = (d[valueKey] / maxVal) * barArea;

            svg.appendChild(textEl(labelW - 16, y + barH * 0.64, d[labelKey], {
                "text-anchor": "end", "font-size": "28", fill: "#333", "font-family": FONT, "font-weight": "500"
            }));

            svg.appendChild(svgEl("rect", {
                x: labelW, y: y + 4, width: Math.max(w, 4), height: barH - 8,
                rx: 8, fill: color, opacity: "0.82"
            }));

            var valText = opts.fmtValue ? opts.fmtValue(d) : String(d[valueKey]);
            svg.appendChild(textEl(labelW + w + 12, y + barH * 0.64, valText, {
                "font-size": "26", fill: "#888", "font-family": MONO
            }));
        });

        container.appendChild(svg);
    }

    /* ==================================================================
     *  Price histogram
     * ================================================================== */

    function renderHistogram(container, histData) {
        container.innerHTML = "";
        if (!histData || !histData.bins || !histData.bins.length) return;

        var bins = histData.bins;
        var W = 920, H = 550;
        var pad = { top: 20, right: 30, bottom: 80, left: 80 };
        var plotW = W - pad.left - pad.right;
        var plotH = H - pad.top - pad.bottom;

        var maxCount = Math.max.apply(null, bins.map(function (b) { return b.count; }));
        if (maxCount === 0) maxCount = 1;

        var svg = svgEl("svg", { width: W, height: H, style: "display:block;" });

        /* Y-grid */
        var yTicks = 4;
        for (var j = 0; j <= yTicks; j++) {
            var yv = (maxCount / yTicks) * j;
            var yy = pad.top + plotH - (yv / maxCount) * plotH;
            svg.appendChild(svgEl("line", {
                x1: pad.left, y1: yy, x2: pad.left + plotW, y2: yy,
                stroke: "rgba(0,0,0,0.06)", "stroke-width": 1
            }));
            svg.appendChild(textEl(pad.left - 12, yy + 5, String(Math.round(yv)), {
                "text-anchor": "end", "font-size": "22", fill: "#aaa", "font-family": MONO
            }));
        }

        /* Bars */
        var barW = plotW / bins.length;
        var barGap = Math.max(2, barW * 0.1);

        bins.forEach(function (b, i) {
            var bh = (b.count / maxCount) * plotH;
            var bx = pad.left + i * barW + barGap / 2;
            var by = pad.top + plotH - bh;
            svg.appendChild(svgEl("rect", {
                x: bx, y: by, width: Math.max(barW - barGap, 2), height: bh,
                fill: "#111", opacity: "0.78", rx: 3
            }));
        });

        /* X-ticks */
        var step = Math.max(1, Math.floor(bins.length / 5));
        for (var k = 0; k < bins.length; k += step) {
            var tx = pad.left + k * barW + barW / 2;
            var label = Math.round(bins[k].bin_lo / 1000) + "k";
            svg.appendChild(textEl(tx, H - 20, label, {
                "text-anchor": "middle", "font-size": "24", fill: "#aaa", "font-family": MONO
            }));
        }

        svg.appendChild(textEl(pad.left + plotW / 2, H - 0, "Цена, ₽", {
            "text-anchor": "middle", "font-size": "24", fill: "#999", "font-family": FONT
        }));

        /* Border */
        svg.appendChild(svgEl("rect", {
            x: pad.left, y: pad.top, width: plotW, height: plotH,
            fill: "none", stroke: "rgba(0,0,0,0.06)"
        }));

        container.appendChild(svg);
    }

    /* ==================================================================
     *  Mini table (top-3 rows)
     * ================================================================== */

    function renderMiniTable(container, rows, columns) {
        if (!rows || !rows.length) {
            container.innerHTML = '<p style="color:#999;font-size:28px;">Нет данных</p>';
            return;
        }

        var html = '<table style="width:100%;border-collapse:collapse;font-size:28px;line-height:1.5;">';
        html += '<thead><tr>';
        columns.forEach(function (col) {
            html += '<th style="text-align:' + (col.align || 'left') + ';padding:16px 12px;border-bottom:2px solid #eee;color:#999;font-size:22px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">' + col.header + '</th>';
        });
        html += '</tr></thead><tbody>';

        rows.forEach(function (r, i) {
            html += '<tr style="border-bottom:1px solid #f3f3f3;">';
            columns.forEach(function (col) {
                var val = col.render ? col.render(r) : (r[col.key] != null ? String(r[col.key]) : "—");
                html += '<td style="padding:18px 12px;text-align:' + (col.align || 'left') + ';' + (col.style || '') + '">' + val + '</td>';
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    /* ==================================================================
     *  KPI cards injection (slide 1)
     * ================================================================== */

    function injectKPI(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = String(value);
    }

    /* ==================================================================
     *  Bootstrap
     * ================================================================== */

    fetch("story_summary.json")
        .then(function (r) { return r.json(); })
        .then(function (data) {
            var k = data.kpis || {};

            /* Slide 1: KPIs */
            injectKPI("s1-sku", k.sku_total);
            injectKPI("s1-cats", k.categories_count);
            injectKPI("s1-median", fmtRub(k.median_price));
            injectKPI("s1-discount", fmtPct(k.share_discounted));

            /* Slide 2: Category mix */
            var el = document.getElementById("s2-chart");
            if (el && data.category_mix) {
                renderHBar(el, data.category_mix, "count", "category", {
                    color: "#111",
                    fmtValue: function (d) { return d.count + " (" + d.share + "%)"; }
                });
            }

            /* Slide 3: Price histogram */
            el = document.getElementById("s3-chart");
            if (el && data.price_hist) {
                renderHistogram(el, data.price_hist);
            }
            var capEl = document.getElementById("s3-cap");
            if (capEl && data.price_hist) {
                capEl.textContent = "Ось ограничена p99 = " + fmtRub(data.price_hist.cap_price_p99);
            }

            /* Slide 4: Top discounts table */
            el = document.getElementById("s4-table");
            if (el && data.top_discount) {
                var hasDisc = data.top_discount[0] && data.top_discount[0].discount_pct != null;
                var cols = [
                    { header: "Товар", key: "title", style: "font-weight:500;" },
                    { header: "Цена", key: "price", align: "right", style: "font-family:" + MONO + ";", render: function (r) { return fmtRub(r.price); } },
                ];
                if (hasDisc) {
                    cols.push({
                        header: "Скидка", key: "discount_pct", align: "right",
                        style: "color:#dc2626;font-weight:700;font-family:" + MONO + ";",
                        render: function (r) { return r.discount_pct != null ? "-" + r.discount_pct + "%" : "—"; }
                    });
                }
                renderMiniTable(el, data.top_discount, cols);
            }
            var pa = data.promo_anchor || {};
            injectKPI("s4-share", pa.has_discount_data ? fmtPct(pa.share_with_discount) : "—");
            injectKPI("s4-median-disc", pa.median_discount != null ? "-" + pa.median_discount + "%" : "—");

            /* Slide 5: Stock-out */
            el = document.getElementById("s5-chart");
            if (el) {
                var sdata = data.stockout_by_category || [];
                if (sdata.length > 0) {
                    renderHBar(el, sdata, "oos_pct", "category", {
                        color: "#dc2626",
                        fmtValue: function (d) { return d.oos_pct + "% (" + d.oos + "/" + d.total + ")"; }
                    });
                } else {
                    el.innerHTML = '<div style="padding:40px 0;color:#999;font-size:28px;">Данных по stock-out нет в каталоге.</div>';
                }
            }
            if (k.share_oos != null) {
                injectKPI("s5-oos-total", fmtPct(k.share_oos));
            }
        })
        .catch(function (err) {
            console.error("charts_story.js:", err);
        });
})();
