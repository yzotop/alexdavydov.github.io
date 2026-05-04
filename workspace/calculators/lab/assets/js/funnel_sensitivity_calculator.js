/**
 * Funnel Sensitivity Calculator
 * Calculates local sensitivity of +1 percentage point for each funnel stage
 * Funnel: Requests → Responses → Shows → Monet shows → Clicks → CPM → Revenue
 * RevenueIndex = (RequestsIndex/100) * RR * SR * MR * (CPM_eff_index/100) * 100
 * Where CPM_eff_index = CPMIndex * (CTR / CTR_base)
 */

(function() {
    'use strict';

    // State (UI values)
    let state = {
        // Left controls
        requestsIndex: 100,     // Requests index (50..200)
        fillRatePct: 80,        // Fill rate (%) - Responses / Requests
        showRatePct: 80,        // Show rate (%) - MonetShows / Responses
        cpm: 50,                // CPM in ₽
        revenueBaseRub: 1000000 // Base revenue in ₽
    };

    // Baseline parameters for index model
    const FILL_RATE_BASE = 0.80;
    const SHOW_RATE_BASE = 0.80;
    const CPM_BASE = 50;

    /**
     * Compute revenue index for given parameters (new model)
     * RevenueIndex = 100 * (RequestsIndex/100) * (FillRate/FILL_RATE_BASE)
     *                        * (ShowRate/SHOW_RATE_BASE) * (CPM/CPM_BASE)
     */
    function computeRevenueIndex(requestsIndex, fillRate, showRate, cpm) {
        const reqFactor = requestsIndex / 100;
        const fillFactor = fillRate / FILL_RATE_BASE;
        const showFactor = showRate / SHOW_RATE_BASE;
        const cpmFactor = cpm / CPM_BASE;
        return 100 * reqFactor * fillFactor * showFactor * cpmFactor;
    }

    /**
     * Compute full base model (indexes and revenue)
     */
    function computeBaseModel() {
        const requestsIndex = state.requestsIndex;
        const fillRate = state.fillRatePct / 100;
        const showRate = state.showRatePct / 100;
        const cpm = state.cpm;
        const revenueBase = state.revenueBaseRub;

        const revenueIndex = computeRevenueIndex(requestsIndex, fillRate, showRate, cpm);
        const revenueRub = revenueBase * (revenueIndex / 100);
        const deltaPct = revenueIndex - 100;
        const deltaRub = revenueRub - revenueBase;

        const responsesIndex = requestsIndex * fillRate;
        const monetShowsIndex = responsesIndex * showRate;

        return {
            requestsIndex,
            fillRate,
            showRate,
            cpm,
            revenueBase,
            revenueIndex,
            revenueRub,
            deltaPct,
            deltaRub,
            responsesIndex,
            monetShowsIndex
        };
    }

    /**
     * Get container dimensions
     */
    function getContainerSize(selector, minWidth = 280, minHeight = 220) {
        const el = document.querySelector(selector);
        if (!el) {
            return { width: minWidth, height: minHeight };
        }
        const rect = el.getBoundingClientRect();
        return {
            width: Math.max(minWidth, rect.width || minWidth),
            height: Math.max(minHeight, rect.height || minHeight)
        };
    }

    /**
     * Render pivot table with bars (pure HTML/CSS)
     */
    function renderPivot(rows) {
        const tableEl = document.getElementById('pp-table');
        const debugEl = document.getElementById('pp-debug');
        
        if (!tableEl) {
            console.error('Container #pp-table not found');
            return;
        }

        // Check for bad data
        const bad = rows.filter(r => !Number.isFinite(r.base) || !Number.isFinite(r.effectPct) || !Number.isFinite(r.effectRub));
        if (bad.length > 0) {
            if (debugEl) {
                debugEl.style.display = 'block';
                debugEl.textContent = 'BAD DATA: ' + bad.map(r => r.key).join(', ');
            }
            // Replace NaN with 0
            rows.forEach(r => {
                if (!Number.isFinite(r.base)) r.base = 0;
                if (!Number.isFinite(r.effectPct)) r.effectPct = 0;
                if (!Number.isFinite(r.effectRub)) r.effectRub = 0;
            });
        } else {
            if (debugEl) {
                debugEl.style.display = 'none';
            }
        }

        // Calculate max effect for scale (by percentage)
        // Note: All effects are positive (marginal +1 step), so we use max, not max(abs(...))
        // Previously used diverging scale (zero-centered), but simplified to one-sided bars starting from 0
        const maxEffect = Math.max(...rows.map(r => Math.max(r.effectPct, 0)), 1);
        const barWidth = 300; // Fixed width for bar container

        // Clear table
        tableEl.innerHTML = '';

        // Determine best row once for styling and callout
        const best = rows.reduce((a, b) => b.effectPct > a.effectPct ? b : a, rows[0]);

        // Create grid
        const grid = document.createElement('div');
        grid.className = 'pp-grid';

        // Headers
        grid.appendChild(createCell('pp-head', 'Этап'));
        grid.appendChild(createCell('pp-head', 'База'));
        grid.appendChild(createCell('pp-head', 'Δ выручки'));

        // Rows
        rows.forEach(row => {
            // Key
            const keyCell = createCell('pp-cell pp-key', row.key);
            if (row === best) {
                keyCell.style.fontWeight = '600';
            }
            grid.appendChild(keyCell);
            
            // Base value + badge
            const baseText = row.key === 'Requests' || row.key === 'CPM' 
                ? `${row.base.toFixed(1)} (индекс)`
                : `${row.base.toFixed(1)}%`;
            const baseCell = createCell('pp-cell pp-base', baseText);
            const badge = createLevelBadge(row.key, row.base);
            if (badge) {
                baseCell.appendChild(badge);
            }
            grid.appendChild(baseCell);
            
            // Bar cell
            const barCell = document.createElement('div');
            barCell.className = 'pp-cell pp-barcell';
            
            const barWrap = document.createElement('div');
            barWrap.className = 'pp-barwrap';
            barWrap.style.width = barWidth + 'px';
            
            // Bar (one-sided, starting from 0)
            // Note: Only positive effects are modeled (+1 step), so bars always go right from 0
            if (row.effectPct >= 0.05) {
                const bar = document.createElement('div');
                bar.className = 'pp-bar ' + (row === best ? 'pp-bar-best' : 'pp-bar-normal');
                
                const barPct = (row.effectPct / maxEffect) * 100;
                const barPx = Math.max((barWidth * barPct / 100), 2);
                
                bar.style.left = '0';
                bar.style.width = barPx + 'px';
                
                barWrap.appendChild(bar);
            }
            
            barCell.appendChild(barWrap);
            
            // Value text
            const valText = document.createElement('div');
            valText.className = 'pp-val';
            if (row.effectPct < 0.05) {
                valText.className += ' pp-zeroText';
                valText.textContent = '≈0.0% / ≈0 ₽';
            } else {
                valText.className += ' pp-pos';
                valText.textContent = '+' + row.effectPct.toFixed(2) + '% / +' + formatRub(row.effectRub);
            }
            barCell.appendChild(valText);
            
            grid.appendChild(barCell);
        });

        tableEl.appendChild(grid);

        // Callout summary (над таблицей)
        const calloutEl = document.getElementById('pp-callout');
        if (calloutEl && best) {
            const signClass = best.effectPct > 0 ? 'pp-pos' : (best.effectPct < 0 ? 'pp-neg' : 'pp-zeroText');
            const effectPctText = (best.effectPct >= 0 ? '+' : '') + best.effectPct.toFixed(2) + '%';
            const effectRubText = (best.effectRub >= 0 ? '+' : '−') + formatRub(best.effectRub);
            calloutEl.innerHTML = `
                <div style="font-weight:600;">Лучший рычаг сейчас: ${best.key}</div>
                <div class="${signClass}">+1 шаг (${best.unit}) → ${effectPctText} / ${effectRubText} к выручке</div>
            `;
        }

        // Short explainer (под таблицей)
        const explainerEl = document.getElementById('pivot-explainer');
        if (explainerEl && best) {
            explainerEl.textContent = buildExplainer(best, rows);
        }
    }

    function formatRub(value) {
        // Formats absolute value with thin spaces and ₽, sign handled by caller
        const abs = Math.round(Math.abs(value));
        return abs.toLocaleString('ru-RU') + ' ₽';
    }

    /**
     * Helper to create cell element
     */
    function createCell(className, text) {
        const cell = document.createElement('div');
        cell.className = className;
        cell.textContent = text;
        return cell;
    }
    function createLevelBadge(key, base) {
        let label = '';
        let cls = 'pp-badge-base';
        let value = base;
        let baseValue = 0;

        if (key === 'Requests') {
            baseValue = 100;
            value = base;
        } else if (key === 'Fill rate') {
            baseValue = 80;
            value = base;
        } else if (key === 'Show rate') {
            baseValue = 80;
            value = base;
        } else if (key === 'CPM') {
            baseValue = 50;
            value = base;
        } else {
            return null;
        }

        const ratio = baseValue === 0 ? 1 : value / baseValue;
        if (ratio < 0.995) {
            label = 'ниже базы';
            cls = 'pp-badge-low';
        } else if (ratio > 1.005) {
            label = 'выше базы';
            cls = 'pp-badge-high';
        } else {
            label = 'в базе';
            cls = 'pp-badge-base';
        }

        const badge = document.createElement('span');
        badge.className = 'pp-badge ' + cls;
        badge.textContent = label;
        return badge;
    }

    function buildExplainer(best, rows) {
        const findBase = k => rows.find(r => r.key === k)?.base || 0;
        if (best.key === 'Fill rate') {
            const v = findBase('Fill rate');
            if (v < 60) {
                return `Fill rate низкий (${v.toFixed(1)}%), поэтому +1 п.п. даёт большой мультипликативный эффект.`;
            }
            if (v <= 80) {
                return `Fill rate в районе нормы (${v.toFixed(1)}%), но именно его рост сейчас сильнее всего масштабирует выручку.`;
            }
            return `Fill rate уже высокий (${v.toFixed(1)}%), но даже небольшой рост даёт заметный мультипликативный эффект.`;
        }
        if (best.key === 'Show rate') {
            const v = findBase('Show rate');
            if (v < 60) {
                return `Show rate низкий (${v.toFixed(1)}%), улучшение монетизируемых показов даёт больше, чем просто рост трафика или CPM.`;
            }
            if (v <= 85) {
                return `Show rate в районе нормы (${v.toFixed(1)}%), но именно он сейчас даёт максимальный прирост выручки.`;
            }
            return `Show rate уже высокий (${v.toFixed(1)}%), маржинальный эффект ограничен, но всё ещё лучший среди рычагов.`;
        }
        if (best.key === 'CPM') {
            const c = findBase('CPM');
            const cpmIndex = (c / CPM_BASE) * 100;
            if (cpmIndex < 90) {
                return `CPM ниже базы (${c.toFixed(0)} ₽), поэтому +1 ₽ почти напрямую конвертируется в рост выручки.`;
            }
            if (cpmIndex <= 110) {
                return `CPM около базы (${c.toFixed(0)} ₽), и его рост даёт наибольший прирост денег в текущей конфигурации.`;
            }
            return `CPM уже высокий (${c.toFixed(0)} ₽), но его дополнительный рост остаётся самым сильным рычагом.`;
        }
        if (best.key === 'Requests') {
            const r = findBase('Requests');
            if (r < 90) {
                return `Requests ниже базы (${r.toFixed(1)}), рост объёма усиливает все последующие этапы воронки.`;
            }
            return `Requests масштабируют всю воронку, поэтому даже небольшой рост трафика даёт максимальный прирост выручки.`;
        }
        return '';
    }

    /**
     * Compute decomposition of effect: Control vs Test
     * Returns array of effects in ₽ for each stage
     * 
     * Formula:
     * Revenue = Revenue_base * (Req/Req_base) * (Fill/Fill_base) * (Show/Show_base) * (CPM/CPM_base)
     * 
     * Decomposition:
     * 1. Requests effect: Revenue_base * ((Req_curr/Req_base) - 1)
     * 2. Fill rate effect: Revenue_base * (Req_curr/Req_base) * ((Fill_curr/Fill_base) - 1)
     * 3. Show rate effect: Revenue_base * (Req_curr/Req_base) * (Fill_curr/Fill_base) * ((Show_curr/Show_base) - 1)
     * 4. CPM effect: Revenue_base * (Req_curr/Req_base) * (Fill_curr/Fill_base) * (Show_curr/Show_base) * ((CPM_curr/CPM_base) - 1)
     */
    function computeDecomposition() {
        // Base values (CONTROL)
        const reqBase = 100;  // Requests_base index
        const fillBase = 0.80; // Fill_rate_base
        const showBase = 0.80; // Show_rate_base
        const cpmBase = 50;    // CPM_base
        const revenueBase = state.revenueBaseRub;

        // Current values (TEST)
        const reqCurr = state.requestsIndex;
        const fillCurr = state.fillRatePct / 100;
        const showCurr = state.showRatePct / 100;
        const cpmCurr = state.cpm;

        // Calculate effects
        const reqEffect = revenueBase * ((reqCurr / reqBase) - 1);
        
        const reqFactor = reqCurr / reqBase;
        const fillEffect = revenueBase * reqFactor * ((fillCurr / fillBase) - 1);
        
        const fillFactor = fillCurr / fillBase;
        const showEffect = revenueBase * reqFactor * fillFactor * ((showCurr / showBase) - 1);
        
        const showFactor = showCurr / showBase;
        const cpmEffect = revenueBase * reqFactor * fillFactor * showFactor * ((cpmCurr / cpmBase) - 1);

        return [
            { key: 'Requests', effect: reqEffect },
            { key: 'Fill rate', effect: fillEffect },
            { key: 'Show rate', effect: showEffect },
            { key: 'CPM', effect: cpmEffect }
        ];
    }

    /**
     * Render Control vs Test decomposition block
     */
    function renderControlVsTest() {
        const tableEl = document.getElementById('cvst-table');
        const summaryEl = document.getElementById('cvst-summary');
        
        if (!tableEl) {
            return; // Block not present, skip
        }

        const decomposition = computeDecomposition();
        const totalEffect = decomposition.reduce((sum, item) => sum + item.effect, 0);

        // Calculate max absolute effect for scale
        const maxAbs = Math.max(...decomposition.map(r => Math.abs(r.effect)), Math.abs(totalEffect), 1);
        const barWidth = 300;

        // Clear table
        tableEl.innerHTML = '';

        // Create grid
        const grid = document.createElement('div');
        grid.className = 'cvst-grid';

        // Headers
        grid.appendChild(createCell('cvst-head', 'Этап'));
        grid.appendChild(createCell('cvst-head', 'Δ выручки (₽)'));

        // Rows
        decomposition.forEach(row => {
            // Key
            const keyCell = createCell('cvst-cell', row.key);
            grid.appendChild(keyCell);

            // Bar cell
            const barCell = document.createElement('div');
            barCell.className = 'cvst-cell';
            
            const barWrap = document.createElement('div');
            barWrap.className = 'cvst-barwrap';
            barWrap.style.width = barWidth + 'px';
            
            // Bar
            if (Math.abs(row.effect) >= 1) {
                const bar = document.createElement('div');
                const isPositive = row.effect > 0;
                bar.className = 'cvst-bar ' + (isPositive ? 'cvst-bar-pos' : 'cvst-bar-neg');
                
                const barPct = (Math.abs(row.effect) / maxAbs) * 100;
                const barPx = Math.max((barWidth * barPct / 100), 2);
                
                bar.style.width = barPx + 'px';
                barWrap.appendChild(bar);
            }
            
            barCell.appendChild(barWrap);
            
            // Value text
            const valText = document.createElement('div');
            valText.className = 'cvst-val';
            if (Math.abs(row.effect) < 1) {
                valText.className += ' pp-zeroText';
                valText.textContent = '≈0 ₽';
            } else {
                valText.className += (row.effect > 0 ? ' pp-pos' : ' pp-neg');
                const sign = row.effect >= 0 ? '+' : '−';
                valText.textContent = sign + formatRub(row.effect);
            }
            barCell.appendChild(valText);
            
            grid.appendChild(barCell);
        });

        // Total row
        const totalKeyCell = createCell('cvst-cell cvst-total', 'Итого');
        grid.appendChild(totalKeyCell);

        const totalBarCell = document.createElement('div');
        totalBarCell.className = 'cvst-cell cvst-total';
        
        const totalBarWrap = document.createElement('div');
        totalBarWrap.className = 'cvst-barwrap';
        totalBarWrap.style.width = barWidth + 'px';
        
        if (Math.abs(totalEffect) >= 1) {
            const totalBar = document.createElement('div');
            const isPositive = totalEffect > 0;
            totalBar.className = 'cvst-bar ' + (isPositive ? 'cvst-bar-pos' : 'cvst-bar-neg');
            
            const barPct = (Math.abs(totalEffect) / maxAbs) * 100;
            const barPx = Math.max((barWidth * barPct / 100), 2);
            
            totalBar.style.width = barPx + 'px';
            totalBarWrap.appendChild(totalBar);
        }
        
        totalBarCell.appendChild(totalBarWrap);
        
        const totalValText = document.createElement('div');
        totalValText.className = 'cvst-val cvst-total';
        if (Math.abs(totalEffect) < 1) {
            totalValText.className += ' pp-zeroText';
            totalValText.textContent = '≈0 ₽';
        } else {
            totalValText.className += (totalEffect > 0 ? ' pp-pos' : ' pp-neg');
            const sign = totalEffect >= 0 ? '+' : '−';
            totalValText.textContent = sign + formatRub(totalEffect);
        }
        totalBarCell.appendChild(totalValText);
        
        grid.appendChild(totalBarCell);

        tableEl.appendChild(grid);

        // Summary text
        if (summaryEl) {
            const cpmEffect = decomposition.find(r => r.key === 'CPM')?.effect || 0;
            const fillEffect = decomposition.find(r => r.key === 'Fill rate')?.effect || 0;
            const showEffect = decomposition.find(r => r.key === 'Show rate')?.effect || 0;
            
            let summaryText = '';
            if (totalEffect > 0 && cpmEffect > 0 && (fillEffect < 0 || showEffect < 0)) {
                summaryText = 'Рост CPM перекрыл потери на Fill / Show rate.';
            } else if (totalEffect < 0) {
                summaryText = 'Потери в Fill / Show rate не компенсированы ростом CPM.';
            } else {
                summaryText = 'Эффекты шагов взаимно компенсируются.';
            }
            summaryEl.textContent = summaryText;
        }
    }

    /**
     * Update all displays and charts
     */
    function updateAll() {
        // Base model
        const model = computeBaseModel();

        // Top KPI: revenue and delta
        const revenueRubEl = document.getElementById('revenue-rub');
        const deltaRubEl = document.getElementById('delta-rub');
        const deltaPctEl = document.getElementById('delta-pct');
        const metaIndexEl = document.getElementById('meta-index');
        const metaBreakdownEl = document.getElementById('meta-breakdown');
        const metaDriversEl = document.getElementById('meta-drivers');
        const baseDisplayEl = document.getElementById('revenue-base-display');

        if (revenueRubEl) {
            revenueRubEl.textContent = formatRub(model.revenueRub);
        }

        if (deltaRubEl) {
            const delta = model.deltaRub;
            const sign = delta > 0 ? '+' : (delta < 0 ? '−' : '');
            deltaRubEl.textContent = sign + formatRub(delta);
            deltaRubEl.classList.remove('pp-pos', 'pp-neg', 'pp-zeroText');
            if (Math.abs(delta) < 1) {
                deltaRubEl.classList.add('pp-zeroText');
            } else if (delta > 0) {
                deltaRubEl.classList.add('pp-pos');
            } else {
                deltaRubEl.classList.add('pp-neg');
            }
        }

        if (deltaPctEl) {
            const d = model.deltaPct;
            deltaPctEl.textContent = '(' + (d >= 0 ? '+' : '') + d.toFixed(2) + '%)';
            deltaPctEl.classList.remove('pp-pos', 'pp-neg', 'pp-zeroText');
            if (Math.abs(model.deltaRub) < 1) {
                deltaPctEl.classList.add('pp-zeroText');
            } else if (d > 0) {
                deltaPctEl.classList.add('pp-pos');
            } else if (d < 0) {
                deltaPctEl.classList.add('pp-neg');
            }
        }

        if (metaIndexEl) {
            metaIndexEl.textContent = 'Index: ' + model.revenueIndex.toFixed(1);
        }

        if (metaBreakdownEl) {
            metaBreakdownEl.textContent =
                `Req ${model.requestsIndex.toFixed(1)} | ` +
                `Fill ${(model.fillRate * 100).toFixed(1)}% | ` +
                `Show ${(model.showRate * 100).toFixed(1)}% | ` +
                `CPM ${model.cpm.toFixed(0)} ₽`;
        }

        if (baseDisplayEl) {
            baseDisplayEl.textContent = formatRub(model.revenueBase);
        }

        // Drivers decomposition
        if (metaDriversEl) {
            const reqRatio = model.requestsIndex / 100;
            const fillRatio = (model.fillRate * 100) / 80;
            const showRatio = (model.showRate * 100) / 80;
            const cpmRatio = model.cpm / 50;

            function driverText(label, ratio) {
                const pct = (ratio - 1) * 100;
                const cls = pct > 0.1 ? 'pp-pos' : (pct < -0.1 ? 'pp-neg' : 'pp-zeroText');
                const sign = pct >= 0 ? '+' : '';
                return `<span class="${cls}">${label}: ${sign}${pct.toFixed(1)}%</span>`;
            }

            const parts = [
                driverText('Requests', reqRatio),
                driverText('Fill rate', fillRatio),
                driverText('Show rate', showRatio),
                driverText('CPM', cpmRatio)
            ];

            const totalSign = model.deltaPct >= 0 ? '+' : '';
            const totalCls = Math.abs(model.deltaPct) < 0.1 ? 'pp-zeroText' : (model.deltaPct > 0 ? 'pp-pos' : 'pp-neg');

            metaDriversEl.innerHTML =
                parts.join(' · ') +
                `<br><span class="${totalCls}">Итого: ${totalSign}${model.deltaPct.toFixed(2)}%</span>`;
        }

        // Base revenue index for marginal effects
        const baseIndex = model.revenueIndex;
        const baseRevenue = model.revenueBase;

        // Guard against zero base index
        const safeBaseIndex = baseIndex === 0 ? 1 : baseIndex;

        // Effects for each lever
        const fillRate = model.fillRate;
        const showRate = model.showRate;
        const requestsIndex = model.requestsIndex;
        const cpm = model.cpm;

        // Requests: +1%
        const reqIndex2 = requestsIndex * 1.01;
        const revIndexReq = computeRevenueIndex(reqIndex2, fillRate, showRate, cpm);

        // Fill rate: +1 п.п.
        const fill2 = Math.min(fillRate + 0.01, 0.99);
        const revIndexFill = computeRevenueIndex(requestsIndex, fill2, showRate, cpm);

        // Show rate: +1 п.п.
        const show2 = Math.min(showRate + 0.01, 0.99);
        const revIndexShow = computeRevenueIndex(requestsIndex, fillRate, show2, cpm);

        // CPM: +1 ₽
        const cpm2 = cpm + 1;
        const revIndexCpm = computeRevenueIndex(requestsIndex, fillRate, showRate, cpm2);

        function effectPair(afterIndex) {
            const effectPct = (afterIndex / safeBaseIndex - 1) * 100;
            const effectRub = baseRevenue * (afterIndex - baseIndex) / 100;
            return { effectPct, effectRub };
        }

        const reqEff = effectPair(revIndexReq);
        const fillEff = effectPair(revIndexFill);
        const showEff = effectPair(revIndexShow);
        const cpmEff = effectPair(revIndexCpm);

        // Rows in fixed order
        const rows = [
            {
                key: 'Requests',
                unit: '+1%',
                base: requestsIndex,
                effectPct: reqEff.effectPct,
                effectRub: reqEff.effectRub
            },
            {
                key: 'Fill rate',
                unit: '+1 п.п.',
                base: state.fillRatePct,
                effectPct: fillEff.effectPct,
                effectRub: fillEff.effectRub
            },
            {
                key: 'Show rate',
                unit: '+1 п.п.',
                base: state.showRatePct,
                effectPct: showEff.effectPct,
                effectRub: showEff.effectRub
            },
            {
                key: 'CPM',
                unit: '+1 ₽',
                base: cpm,
                effectPct: cpmEff.effectPct,
                effectRub: cpmEff.effectRub
            }
        ];

        // Render pivot table
        renderPivot(rows);

        // Render Control vs Test decomposition (Graph #5)
        renderControlVsTest();
    }

    /**
     * Initialize slider
     */
    function initSlider(id, stateKey, displayId, formatFn, scale = 1) {
        const slider = document.getElementById(id);
        const display = document.getElementById(displayId);
        
        if (!slider || !display) {
            console.warn('Missing slider or display for', id);
            return;
        }
        
        function update() {
            const raw = parseFloat(slider.value);
            const value = isNaN(raw) ? 0 : raw / scale;
            state[stateKey] = value;
            display.textContent = formatFn(value);
            updateAll();
        }
        
        slider.addEventListener('input', update);
        update();
    }

    function initRevenueInput() {
        const input = document.getElementById('revenue-base-input');
        if (!input) {
            console.warn('Missing revenue base input');
            return;
        }
        function onChange() {
            const raw = parseFloat(input.value);
            state.revenueBaseRub = isNaN(raw) ? 0 : Math.max(0, raw);
            updateAll();
        }
        input.addEventListener('input', onChange);
        input.addEventListener('change', onChange);
        onChange();
    }


    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        // Initialize all sliders
        initSlider('requests', 'requestsIndex', 'requests-value', v => Math.round(v), 1);
        initSlider('fill-rate', 'fillRatePct', 'fill-rate-value', v => v.toFixed(1), 1);
        initSlider('show-rate', 'showRatePct', 'show-rate-value', v => v.toFixed(1), 1);
        initSlider('cpm', 'cpm', 'cpm-value', v => Math.round(v), 1);
        initRevenueInput();

        const resetBtn = document.getElementById('reset-to-base');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                const setSlider = (id, value) => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.value = String(value);
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                };
                setSlider('requests', 100);
                setSlider('fill-rate', 80);
                setSlider('show-rate', 80);
                setSlider('cpm', 50);

                const baseInput = document.getElementById('revenue-base-input');
                if (baseInput) {
                    baseInput.value = '1000000';
                    baseInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        }

        // Initial update (in case some controls were missing)
        updateAll();
    }
})();

