/**
 * Rollout Compare Calculator - Compare 3 tests projection to 100%
 * For each test: R(p) = 100*(1-p) + R_test*p
 * R_test = (R_obs - 100*(1-p)) / p
 */

(function() {
    'use strict';

    const baseline = 100;

    // Single point of access to DOM elements
    const els = {
        share: document.getElementById('shareCommon'),
        shareValue: document.getElementById('shareCommonValue'),
        aRev: document.getElementById('tA_rev'),
        bRev: document.getElementById('tB_rev'),
        cRev: document.getElementById('tC_rev'),
        // KPI elements
        kpiBest: document.getElementById('best-test-name'),
        kpiRev100: document.getElementById('best-revenue-100'),
        kpiDelta: document.getElementById('best-delta'),
        meta: document.getElementById('all-tests-meta'),
        verdict: document.getElementById('compare-verdict'),
        allTestsSummary: document.getElementById('all-tests-summary')
    };

    /**
     * Clamp integer value
     */
    function clampInt(value, min, max) {
        const num = parseInt(value, 10);
        if (isNaN(num)) return min;
        return Math.max(min, Math.min(max, num));
    }

    /**
     * Clamp numeric value
     */
    function clampNum(value, min, max) {
        const num = parseFloat(value);
        if (isNaN(num)) return (min + max) / 2;
        return Math.max(min, Math.min(max, num));
    }

    /**
     * Project revenue at mix share to revenue at 100%
     * 
     * Formula: R100 = (Rmix - (1 - p) * 100) / p
     * Where p = sharePct / 100
     * 
     * @param {number} revMix - Revenue (index) at current share
     * @param {number} sharePct - Share percentage (1-33)
     * @returns {Object} { r100, delta }
     */
    function projectTo100(revMix, sharePct) {
        const p = sharePct / 100;
        // p always > 0 because share min=1
        const r100 = (revMix - (1 - p) * baseline) / p;
        return {
            r100: isFinite(r100) ? r100 : baseline,
            delta: isFinite(r100) ? (r100 - baseline) : 0
        };
    }

    /**
     * Pick best test (by r100) and second
     */
    function pickBest(tests) {
        const sorted = [...tests].sort((a, b) => b.r100 - a.r100);
        return {
            best: sorted[0],
            second: sorted[1],
            all: sorted
        };
    }

    /**
     * Determine decision class based on revenue at 100%
     */
    function getDecisionClass(revenue100) {
        if (revenue100 > 101) {
            return 'good';
        } else if (revenue100 < 99) {
            return 'bad';
        } else {
            return 'neutral';
        }
    }

    /**
     * Update decision header with best test info
     */
    function updateDecisionHeader(best, second, all) {
        if (!els.kpiBest || !els.kpiRev100 || !els.kpiDelta || !els.meta || !els.verdict) {
            return;
        }

        const decisionClass = getDecisionClass(best.r100);

        // Update best test name
        els.kpiBest.classList.remove('good', 'bad', 'neutral');
        els.kpiBest.classList.add(decisionClass);
        els.kpiBest.textContent = `Тест ${best.key}`;

        // Update revenue at 100%
        els.kpiRev100.classList.remove('good', 'bad', 'neutral');
        els.kpiRev100.classList.add(decisionClass);
        els.kpiRev100.textContent = best.r100.toFixed(1);

        // Update delta
        let deltaClass = 'neutral';
        if (best.delta > 0) {
            deltaClass = 'good';
        } else if (best.delta < 0) {
            deltaClass = 'bad';
        }
        els.kpiDelta.classList.remove('good', 'bad', 'neutral');
        els.kpiDelta.classList.add(deltaClass);
        els.kpiDelta.textContent = (best.delta >= 0 ? '+' : '') + best.delta.toFixed(1);

        // Update meta: "A: 98.1 | B: 103.4 | C: 97.2"
        const metaText = all.map(t => `${t.key}: ${t.r100.toFixed(1)}`).join(' | ');
        els.meta.textContent = metaText;

        // Update final verdict with structured block
        updateFinalVerdict(best, all);
    }

    /**
     * Get verdict indicator (emoji + color) for a test
     */
    function getVerdictIndicator(delta) {
        if (Math.abs(delta) < 1) {
            return { emoji: '🟡', color: '#6b7280' };
        } else if (delta > 0) {
            return { emoji: '🟢', color: '#16a34a' };
        } else {
            return { emoji: '🔴', color: '#dc2626' };
        }
    }

    /**
     * Update final verdict with structured candidate block
     */
    function updateFinalVerdict(best, all) {
        if (!els.verdict) return;

        // Sort all tests by r100 descending
        const sorted = [...all].sort((a, b) => b.r100 - a.r100);
        const candidate = sorted[0];
        const notRecommended = sorted.slice(1);

        // Build candidate line
        const candidateInd = getVerdictIndicator(candidate.delta);
        const candidateDeltaSign = candidate.delta >= 0 ? '+' : '';
        const candidateLine = `${candidateInd.emoji} Тест ${candidate.key} → ${candidate.r100.toFixed(1)}  (${candidateDeltaSign}${candidate.delta.toFixed(1)})`;

        // Build not recommended lines
        const notRecommendedLines = notRecommended.map(test => {
            const ind = getVerdictIndicator(test.delta);
            const deltaSign = test.delta >= 0 ? '+' : '';
            return `${ind.emoji} Тест ${test.key} → ${test.r100.toFixed(1)}  (${deltaSign}${test.delta.toFixed(1)})`;
        }).join('<br>');

        // Build interpretation
        let interpretation = '';
        const positiveTests = all.filter(t => t.delta > 1);
        const negativeTests = all.filter(t => t.delta < -1);
        
        if (positiveTests.length === 1 && negativeTests.length > 0) {
            const posKey = positiveTests[0].key;
            const negKeys = negativeTests.map(t => t.key).join(' и ');
            interpretation = `Тест ${posKey} масштабируется положительно; ${negKeys} усиливают негативный эффект.`;
        } else if (positiveTests.length > 0) {
            interpretation = `Положительный эффект есть только у ${positiveTests.map(t => t.key).join(', ')}, остальные варианты рискованны.`;
        } else if (negativeTests.length === all.length) {
            interpretation = `Все варианты снижают выручку при раскатке на 100%.`;
        } else {
            interpretation = `Эффекты вариантов взаимно компенсируются или слабы.`;
        }

        els.verdict.innerHTML = `
            <div style="font-size: 0.9rem; font-weight: 500; color: #111; margin-bottom: 0.5rem;">Выбор варианта для раскатки</div>
            <div style="font-size: 0.8rem; color: ${candidateInd.color}; margin-bottom: 0.5rem;">
                <div style="font-weight: 500; margin-bottom: 0.25rem;">Кандидат:</div>
                <div>${candidateLine}</div>
            </div>
            ${notRecommended.length > 0 ? `
                <div style="font-size: 0.8rem; color: #6b7280; margin-bottom: 0.75rem;">
                    <div style="font-weight: 500; margin-bottom: 0.25rem;">Не рекомендованы:</div>
                    <div>${notRecommendedLines}</div>
                </div>
            ` : ''}
            <div style="font-size: 0.75rem; color: #6b7280; font-style: italic; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #e5e7eb;">
                ${interpretation}
            </div>
        `;
    }

    /**
     * Get verdict text and color for a test based on delta
     */
    function getTestVerdict(delta) {
        if (Math.abs(delta) < 1) {
            return { text: 'около базы', color: '#6b7280' };
        } else if (delta > 0) {
            return { text: 'увеличивает выручку', color: '#16a34a' };
        } else {
            return { text: 'снижает выручку', color: '#dc2626' };
        }
    }

    /**
     * Render summary of all tests (A/B/C)
     * Shows current revenue, projection to 100%, and delta with micro-verdicts
     */
    function renderAllTestsSummary(tests, bestTestKey) {
        if (!els.allTestsSummary) return;

        // Get share from first test (all have same share)
        const share = tests[0]?.share || 22;

        // Line styles matching the chart: A=solid, B="6,4", C="2,3"
        const lineStyles = [
            { dashArray: 'none', display: 'solid' },
            { dashArray: '6,4', display: 'dashed' },
            { dashArray: '2,3', display: 'dotted' }
        ];

        // Determine color for delta
        function getDeltaColor(delta) {
            if (delta > 0) return '#16a34a'; // good (green)
            if (delta < 0) return '#dc2626'; // bad (red)
            return '#6b7280'; // neutral (gray)
        }

        const html = tests.map((test, idx) => {
            const style = lineStyles[idx];
            const deltaColor = getDeltaColor(test.delta);
            const deltaSign = test.delta >= 0 ? '+' : '';
            const isBest = bestTestKey && test.key === bestTestKey;
            const verdict = getTestVerdict(test.delta);
            
            // Visual accent for best test: green left border
            const accentStyle = isBest 
                ? 'border-left: 3px solid #16a34a; padding-left: 0.5rem; margin-left: -0.75rem; background-color: rgba(22, 163, 74, 0.06);' 
                : '';
            
            // Create visual indicator (small SVG line) matching chart style
            const indicatorSvg = `
                <svg width="24" height="2" style="margin-right: 0.5rem; vertical-align: middle;">
                    <line x1="0" y1="1" x2="24" y2="1" 
                          stroke="#111827" 
                          stroke-width="2" 
                          stroke-dasharray="${style.dashArray}" />
                </svg>
            `;
            
            return `
                <div style="margin-bottom: 0.75rem; ${accentStyle}">
                    <div style="display: flex; align-items: center; font-size: 0.85rem; line-height: 1.5;">
                        <span style="font-weight: 600; margin-right: 0.5rem; min-width: 1.5rem;">Тест ${test.key}:</span>
                        ${indicatorSvg}
                        <span style="color: #111827; font-weight: 500;">${test.revMix.toFixed(1)}</span>
                        <span style="color: #6b7280; margin: 0 0.5rem;">→</span>
                        <span style="color: #111827; font-weight: 500;">${test.r100.toFixed(1)}</span>
                        <span style="margin-left: 0.75rem; color: ${deltaColor}; font-weight: 500;">Δ ${deltaSign}${test.delta.toFixed(1)}</span>
                    </div>
                    <div style="font-size: 0.7rem; color: ${verdict.color}; margin-left: 2.25rem; margin-top: 0.125rem;">
                        ${verdict.text}
                    </div>
                </div>
            `;
        }).join('');

        els.allTestsSummary.innerHTML = `
            <div style="font-size: 0.75rem; color: #6b7280; margin-bottom: 0.75rem; line-height: 1.4;">
                Сейчас все тесты показаны при доле ${share}%, справа — проекция на 100%.
            </div>
            ${html}
        `;
    }

    /**
     * Validate inputs and show warnings
     * Note: share is now controlled by slider (max=33), so no share validation needed
     */
    function validateInputs(tests) {
        // No validation needed - share is controlled by slider (1-33)
        // Revenue values are just clamped by input min/max
        // All tests are calculated independently
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
     * Render compare chart with 3 tests
     */
    function renderCompareChart(tests, bestTestKey = null) {
        const containerSize = getContainerSize('#compare-main-chart');
        const margin = { top: 20, right: 60, bottom: 40, left: 50 };
        const width = Math.max(280, containerSize.width - margin.left - margin.right);
        const height = Math.max(220, containerSize.height - margin.top - margin.bottom);

        d3.select('#compare-main-chart').selectAll('*').remove();

        const svg = d3.select('#compare-main-chart')
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);

        const g = svg.append('g')
            .attr('class', 'calc-chart')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Scales
        const xScale = d3.scaleLinear()
            .domain([0, 100])
            .range([0, width]);

        // Calculate y extent: include baseline, all revMix, all r100
        const allRevenues = [baseline];
        tests.forEach(t => {
            allRevenues.push(t.revMix, t.r100);
        });
        const revenueExtent = d3.extent(allRevenues);
        const yMin = Math.min(97, revenueExtent[0] - 1);
        const yMax = Math.max(103, revenueExtent[1] + 1);
        
        const yScale = d3.scaleLinear()
            .domain([yMin, yMax])
            .nice()
            .range([height, 0]);

        // Baseline line (y=100)
        g.append('line')
            .attr('class', 'grid')
            .attr('x1', 0)
            .attr('x2', width)
            .attr('y1', yScale(baseline))
            .attr('y2', yScale(baseline))
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '4 4');

        // Line styles: A=solid, B="6,4", C="2,3"
        const lineStyles = [
            { dashArray: 'none' },
            { dashArray: '6,4' },
            { dashArray: '2,3' }
        ];

        // Plot area boundaries
        const x0 = 0;
        const x1 = width;
        const y0 = 0;
        const y1 = height;

        // All tests share the same shareCommon, so xCur is the same for all
        const shareCommon = tests[0].share;
        const xCur = xScale(shareCommon);

        // Draw one vertical drop line (shared X for all tests)
        // Find min and max Y for current points to draw line from top to bottom
        const currentYValues = tests.map(t => yScale(t.revMix));
        const minYCur = Math.min(...currentYValues);
        const maxYCur = Math.max(...currentYValues);

        // Vertical line: from topmost point to x-axis (more transparent since shared)
        g.append('line')
            .attr('class', 'drop-line drop-line-current')
            .attr('x1', xCur)
            .attr('y1', minYCur)
            .attr('x2', xCur)
            .attr('y2', y1)
            .attr('stroke', '#9ca3af')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '1.5,3')
            .attr('opacity', 0.45);

        // Axis marker on X-axis (shared)
        g.append('line')
            .attr('class', 'axis-marker axis-marker-current')
            .attr('x1', xCur - 4)
            .attr('y1', y1)
            .attr('x2', xCur + 4)
            .attr('y2', y1)
            .attr('stroke', '#9ca3af')
            .attr('stroke-width', 2)
            .attr('opacity', 0.7);

        // Draw lines and points for each test
        tests.forEach((test, idx) => {
            const style = lineStyles[idx];
            
            // Determine line color based on delta (sign of effect)
            let lineColor = '#6b7280'; // gray (neutral)
            if (test.delta > 1) {
                lineColor = '#16a34a'; // green (positive)
            } else if (test.delta < -1) {
                lineColor = '#dc2626'; // red (negative)
            }
            
            // Line from (0, 100) to (100, r100)
            const lineData = [
                { x: 0, y: baseline },
                { x: 100, y: test.r100 }
            ];

            const line = d3.line()
                .x(d => xScale(d.x))
                .y(d => yScale(d.y));

            g.append('path')
                .datum(lineData)
                .attr('class', 'line line-test')
                .attr('d', line)
                .attr('stroke', lineColor)
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', style.dashArray)
                .attr('fill', 'none');

            // Current point (filled circle)
            const yCur = yScale(test.revMix);

            // Horizontal line: from point to y-axis (individual for each test)
            g.append('line')
                .attr('class', 'drop-line drop-line-current')
                .attr('x1', xCur)
                .attr('y1', yCur)
                .attr('x2', x0)
                .attr('y2', yCur)
                .attr('stroke', '#9ca3af')
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '1.5,3')
                .attr('opacity', 0.8);

            // Marker on Y-axis (individual for each test)
            g.append('line')
                .attr('class', 'axis-marker axis-marker-current')
                .attr('x1', x0)
                .attr('y1', yCur - 4)
                .attr('x2', x0)
                .attr('y2', yCur + 4)
                .attr('stroke', '#9ca3af')
                .attr('stroke-width', 2)
                .attr('opacity', 0.7);

            // Current point
            g.append('circle')
                .attr('class', 'point')
                .attr('cx', xCur)
                .attr('cy', yCur)
                .attr('r', 6)
                .attr('fill', '#111827');

            // Label for current point
            g.append('text')
                .attr('class', 'label')
                .attr('x', xCur + 8)
                .attr('y', yCur)
                .attr('dy', '0.35em')
                .text(test.key);

            // Point at 100% (hollow circle with label)
            const x100 = xScale(100);
            const y100 = yScale(test.r100);

            // Determine color based on delta (sign of effect)
            let strokeColor = '#6b7280'; // gray (neutral)
            let labelColor = '#6b7280';
            if (test.delta > 1) {
                strokeColor = '#16a34a'; // green
                labelColor = '#16a34a';
            } else if (test.delta < -1) {
                strokeColor = '#dc2626'; // red
                labelColor = '#dc2626';
            }

            g.append('circle')
                .attr('class', 'point')
                .attr('cx', x100)
                .attr('cy', y100)
                .attr('r', 6)
                .attr('fill', 'none')
                .attr('stroke', strokeColor)
                .attr('stroke-width', 2);

            // Label for 100% point (delta value)
            const deltaSign = test.delta >= 0 ? '+' : '';
            const deltaText = `${deltaSign}${test.delta.toFixed(1)}`;
            g.append('text')
                .attr('class', 'label')
                .attr('x', x100 + 8)
                .attr('y', y100)
                .attr('dy', '0.35em')
                .attr('fill', labelColor)
                .attr('font-size', '11px')
                .attr('font-weight', '500')
                .text(deltaText);
        });

        // Axes
        const xAxis = d3.axisBottom(xScale)
            .ticks(6)
            .tickFormat(d => d + '%');

        const yAxis = d3.axisLeft(yScale)
            .ticks(5)
            .tickFormat(d => d.toFixed(0));

        g.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(xAxis);

        g.append('g')
            .attr('class', 'axis')
            .call(yAxis);
    }

    /**
     * Update all displays and charts
     */
    function update() {
        // Read share (common for all tests)
        const share = clampInt(+els.share.value, 1, 33);
        
        // Read revenue mix for each test and project to 100%
        const tests = [
            { key: 'A', revMix: clampNum(+els.aRev.value, 70, 130) },
            { key: 'B', revMix: clampNum(+els.bRev.value, 70, 130) },
            { key: 'C', revMix: clampNum(+els.cRev.value, 70, 130) }
        ].map(t => {
            const pr = projectTo100(t.revMix, share);
            return { ...t, share, r100: pr.r100, delta: pr.delta };
        });
        
        validateInputs(tests);
        const { best, second, all } = pickBest(tests);
        updateDecisionHeader(best, second, all);
        renderAllTestsSummary(tests, best.key);
        renderCompareChart(tests, best.key);
    }

    /**
     * Setup ResizeObserver for responsive charts
     */
    function setupResizeObserver() {
        const el = document.querySelector('#compare-main-chart');
        if (!el) return;

        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                clearTimeout(el._resizeTimeout);
                el._resizeTimeout = setTimeout(() => {
                    const share = clampInt(+els.share.value, 1, 33);
                    const tests = [
                        { key: 'A', revMix: clampNum(+els.aRev.value, 70, 130) },
                        { key: 'B', revMix: clampNum(+els.bRev.value, 70, 130) },
                        { key: 'C', revMix: clampNum(+els.cRev.value, 70, 130) }
                    ].map(t => {
                        const pr = projectTo100(t.revMix, share);
                        return { ...t, share, r100: pr.r100, delta: pr.delta };
                    });
                    const { best } = pickBest(tests);
                    renderCompareChart(tests, best.key);
                }, 120);
            }
        });

        resizeObserver.observe(el);
    }

    /**
     * Initialize event listeners
     */
    function init() {
        // Share slider listener
        if (els.share && els.shareValue) {
            function updateShareValue() {
                els.shareValue.textContent = els.share.value;
                update();
            }
            els.share.addEventListener('input', updateShareValue);
            els.share.addEventListener('change', updateShareValue);
            // Initial display
            els.shareValue.textContent = els.share.value;
        }

        // Revenue inputs listeners
        const revenueInputs = [els.aRev, els.bRev, els.cRev];
        revenueInputs.forEach(input => {
            if (input) {
                input.addEventListener('input', update);
                input.addEventListener('change', update);
            }
        });
    }

    // Initialize
    init();

    // Initial update
    update();

    // Setup resize observer
    if (window.ResizeObserver) {
        setupResizeObserver();
    }
})();

