/**
 * Rollout Calculator - Simplified model for test rollout prediction
 * Revenue = CPM × ShowRate × Requests
 * Revenue(p) = 100*(1-p) + Revenue_test*p, where p ∈ [0..1]
 */

(function() {
    'use strict';

    // State
    let state = {
        dcpm: 0,        // ΔCPM in percentage points
        dshowrate: 0,   // ΔShowRate in percentage points
        drequests: 0,   // ΔRequests in percentage points
        rollout: 100    // Rollout share in percentage
    };

    const baseline = 100;
    const SR_UNCERTAINTY_PP = 0.5; // ±0.5 percentage points uncertainty for ShowRate

    /**
     * Calculate test indices from deltas
     */
    function calculateTestIndices() {
        return {
            cpmIndex: baseline * (1 + state.dcpm / 100),
            showrateIndex: baseline * (1 + state.dshowrate / 100),
            requestsIndex: baseline * (1 + state.drequests / 100)
        };
    }

    /**
     * Calculate revenue mix from deltas (observed effect on mixed traffic)
     * Revenue_mix = 100 * (1 + dCPM/100) * (1 + dShowRate/100) * (1 + dRequests/100)
     */
    function calculateRevenueMix() {
        return baseline *
            (1 + state.dcpm / 100) *
            (1 + state.dshowrate / 100) *
            (1 + state.drequests / 100);
    }

    /**
     * Project revenue mix to 100% rollout
     * Revenue_100 = (Revenue_mix - (1-p)*100) / p
     * where p = share/100
     */
    function calculateRevenue100(share) {
        const p = share / 100;
        if (p <= 0) {
            return baseline;
        }
        const revenueMix = calculateRevenueMix();
        const revenue100 = (revenueMix - (1 - p) * baseline) / p;
        
        // Clamp to reasonable range for display (70-130)
        return Math.max(70, Math.min(130, revenue100));
    }

    /**
     * Calculate revenue at rollout share p (0..1)
     * Revenue(p) = 100*(1-p) + Revenue_100*p
     * This is used for building the curve
     */
    function calculateRevenueAtRollout(rolloutShare) {
        const p = rolloutShare / 100;
        const revenue100 = calculateRevenue100(state.rollout);
        return baseline * (1 - p) + revenue100 * p;
    }

    /**
     * Calculate revenue at rollout share for optimistic scenario (ShowRate + uncertainty)
     */
    function calculateRevenueAtRolloutHi(rolloutShare) {
        const originalDshowrate = state.dshowrate;
        state.dshowrate = originalDshowrate + SR_UNCERTAINTY_PP;
        
        const p = rolloutShare / 100;
        const revenueMixHi = calculateRevenueMix();
        const revenue100Hi = (revenueMixHi - (1 - p) * baseline) / p;
        const revenue100HiClamped = Math.max(70, Math.min(130, revenue100Hi));
        const result = baseline * (1 - p) + revenue100HiClamped * p;
        
        state.dshowrate = originalDshowrate;
        return result;
    }

    /**
     * Calculate revenue at rollout share for pessimistic scenario (ShowRate - uncertainty)
     */
    function calculateRevenueAtRolloutLo(rolloutShare) {
        const originalDshowrate = state.dshowrate;
        state.dshowrate = originalDshowrate - SR_UNCERTAINTY_PP;
        
        const p = rolloutShare / 100;
        const revenueMixLo = calculateRevenueMix();
        const revenue100Lo = (revenueMixLo - (1 - p) * baseline) / p;
        const revenue100LoClamped = Math.max(70, Math.min(130, revenue100Lo));
        const result = baseline * (1 - p) + revenue100LoClamped * p;
        
        state.dshowrate = originalDshowrate;
        return result;
    }

    /**
     * Calculate revenue vs rollout curve
     * Returns base curve with hi/lo uncertainty bands
     */
    function calculateRolloutCurve() {
        const points = [];
        for (let share = 0; share <= 100; share += 2) {
            points.push({
                share,
                revenue: calculateRevenueAtRollout(share),
                revenueHi: calculateRevenueAtRolloutHi(share),
                revenueLo: calculateRevenueAtRolloutLo(share)
            });
        }
        return points;
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
     * Update KPI displays
     */
    function updateKPI() {
        const indices = calculateTestIndices();
        const p = state.rollout / 100;
        
        // Calculate revenue mix (observed effect on mixed traffic)
        const revenueMix = calculateRevenueMix();
        
        // Project to 100% rollout
        let revenue100 = (revenueMix - (1 - p) * baseline) / p;
        
        // Clamp for display (but keep original for calculations)
        const revenue100Display = Math.max(70, Math.min(130, revenue100));
        const delta = revenue100Display - baseline;
        
        // SANITY CHECK (temporary)
        console.log({
            share: state.rollout,
            revenueMix: revenueMix.toFixed(2),
            revenue100: revenue100Display.toFixed(2)
        });
        
        // Determine decision class
        const decision = getDecisionClass(revenue100Display);
        
        // Update main KPI - Revenue at 100%
        const revEl = document.getElementById('revenue-100');
        revEl.classList.remove('good', 'bad', 'neutral');
        revEl.classList.add(decision);
        revEl.textContent = revenue100Display.toFixed(1);
        
        // Update main KPI - Delta
        const deltaEl = document.getElementById('revenue-delta');
        let deltaClass = 'neutral';
        if (delta > 0) {
            deltaClass = 'good';
        } else if (delta < 0) {
            deltaClass = 'bad';
        }
        deltaEl.classList.remove('good', 'bad', 'neutral');
        deltaEl.classList.add(deltaClass);
        deltaEl.textContent = (delta >= 0 ? '+' : '') + delta.toFixed(1);
        
        // Update meta indices
        document.getElementById('cpm-index').textContent = indices.cpmIndex.toFixed(1);
        document.getElementById('showrate-index').textContent = indices.showrateIndex.toFixed(1);
        document.getElementById('requests-index').textContent = indices.requestsIndex.toFixed(1);
        
        // Update verdict (pass revenue100Display, delta, and revenueMix)
        updateVerdict(revenue100Display, delta, revenueMix);
    }

    /**
     * Update verdict text
     */
    function updateVerdict(revenue100, delta100, revenueMix) {
        const verdictEl = document.getElementById('rollout-verdict');
        
        // Use unified decision class
        const decisionClass = getDecisionClass(revenue100);
        
        // Remove old classes and add new one
        verdictEl.classList.remove('good', 'bad', 'neutral');
        verdictEl.classList.add(decisionClass);
        
        // Calculate delta from current to 100%
        const deltaTo100 = revenue100 - revenueMix;
        
        // Line 1: Main verdict with numbers from KPI
        let line1Text = '';
        if (Math.abs(delta100) < 0.5) {
            line1Text = `На 100%: ${revenue100.toFixed(1)} (эффект слабый)`;
        } else {
            const deltaSign = delta100 >= 0 ? '+' : '';
            line1Text = `На 100%: ${revenue100.toFixed(1)} (${deltaSign}${delta100.toFixed(1)} к базе)`;
        }
        
        // Line 2: Current state
        const line2Text = `Сейчас (доля: ${Math.round(state.rollout)}%) → ${revenueMix.toFixed(1)}`;
        
        // Line 3: Path from current to 100%
        const deltaTo100Sign = deltaTo100 >= 0 ? '+' : '';
        const line3Text = `От текущего к 100%: ${deltaTo100Sign}${deltaTo100.toFixed(1)}`;
        
        // Build HTML structure
        verdictEl.innerHTML = `
            <div class="verdict-title ${decisionClass}">${line1Text}</div>
            <div class="verdict-sub">${line2Text}</div>
            <div class="verdict-note">${line3Text}</div>
        `;
    }

    /**
     * Render main rollout chart
     */
    function updateRolloutChart() {
        const containerSize = getContainerSize('#rollout-main-chart');
        const margin = { top: 20, right: 60, bottom: 40, left: 50 };
        const width = Math.max(280, containerSize.width - margin.left - margin.right);
        const height = Math.max(220, containerSize.height - margin.top - margin.bottom);
        
        d3.select('#rollout-main-chart').selectAll('*').remove();
        
        const svg = d3.select('#rollout-main-chart')
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);
        
        const g = svg.append('g')
            .attr('class', 'calc-chart')
            .attr('transform', `translate(${margin.left},${margin.top})`);
        
        const curve = calculateRolloutCurve();
        const revenueMix = calculateRevenueMix();
        const revenue100 = calculateRevenue100(state.rollout);
        
        // Check if small mode (width < 360px)
        const isSmallMode = width < 360;
        const bandOpacity = isSmallMode ? 0.12 : 0.18;
        
        // Scales
        const xScale = d3.scaleLinear()
            .domain([0, 100])
            .range([0, width]);
        
        // Include uncertainty bands in extent calculation
        const allRevenues = curve.flatMap(d => [d.revenue, d.revenueHi, d.revenueLo]);
        const revenueExtent = d3.extent(allRevenues);
        const yScale = d3.scaleLinear()
            .domain([revenueExtent[0] * 0.98, revenueExtent[1] * 1.02])
            .nice()
            .range([height, 0]);
        
        // Grid - only baseline
        const yTicks = yScale.ticks(5);
        
        // Baseline line
        g.append('line')
            .attr('class', 'grid')
            .attr('x1', 0)
            .attr('x2', width)
            .attr('y1', yScale(baseline))
            .attr('y2', yScale(baseline))
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '4 4');
        
        // Uncertainty band using d3.area()
        const area = d3.area()
            .x(d => xScale(d.share))
            .y0(d => yScale(d.revenueLo))
            .y1(d => yScale(d.revenueHi))
            .curve(d3.curveMonotoneX);
        
        g.append('path')
            .datum(curve)
            .attr('class', 'uncertainty-band')
            .attr('d', area)
            .attr('fill', '#9ca3af')
            .attr('opacity', bandOpacity)
            .attr('stroke', 'none');
        
        // Revenue curve (main line, drawn after band)
        const line = d3.line()
            .x(d => xScale(d.share))
            .y(d => yScale(d.revenue))
            .curve(d3.curveMonotoneX);
        
        g.append('path')
            .datum(curve)
            .attr('class', 'line line-test')
            .attr('d', line);
        
        // Plot area boundaries (in g coordinates)
        const x0 = 0;
        const x1 = width;
        const y0 = 0;
        const y1 = height;
        
        // Coordinates for current point (use revenueMix)
        const xCur = xScale(state.rollout);
        const yCur = yScale(revenueMix);
        
        // Coordinates for 100% point
        const x100 = xScale(100);
        const y100 = yScale(revenue100);
        
        // Drop lines for current point
        // Vertical line: from point to x-axis
        g.append('line')
            .attr('class', 'drop-line drop-line-current')
            .attr('x1', xCur)
            .attr('y1', yCur)
            .attr('x2', xCur)
            .attr('y2', y1)
            .attr('stroke', '#9ca3af')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '1.5,3')
            .attr('opacity', 0.9);
        
        // Horizontal line: from point to y-axis
        g.append('line')
            .attr('class', 'drop-line drop-line-current')
            .attr('x1', xCur)
            .attr('y1', yCur)
            .attr('x2', x0)
            .attr('y2', yCur)
            .attr('stroke', '#9ca3af')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '1.5,3')
            .attr('opacity', 0.9);
        
        // Axis markers for current point
        // Marker on X-axis
        g.append('line')
            .attr('class', 'axis-marker axis-marker-current')
            .attr('x1', xCur - 4)
            .attr('y1', y1)
            .attr('x2', xCur + 4)
            .attr('y2', y1)
            .attr('stroke', '#9ca3af')
            .attr('stroke-width', 2)
            .attr('opacity', 0.7);
        
        // Marker on Y-axis
        g.append('line')
            .attr('class', 'axis-marker axis-marker-current')
            .attr('x1', x0)
            .attr('y1', yCur - 4)
            .attr('x2', x0)
            .attr('y2', yCur + 4)
            .attr('stroke', '#9ca3af')
            .attr('stroke-width', 2)
            .attr('opacity', 0.7);
        
        // Determine decision color based on revenue at 100% (use unified function)
        const decisionClass = getDecisionClass(revenue100);
        let decisionColor = '#6b7280'; // neutral
        if (decisionClass === 'bad') {
            decisionColor = '#dc2626'; // bad (red)
        } else if (decisionClass === 'good') {
            decisionColor = '#16a34a'; // good (green)
        }
        
        // Drop lines for 100% point (only if different from current)
        if (state.rollout !== 100) {
            // Vertical line: from point to x-axis
            g.append('line')
                .attr('class', 'drop-line drop-line-100')
                .attr('x1', x100)
                .attr('y1', y100)
                .attr('x2', x100)
                .attr('y2', y1)
                .attr('stroke', '#9ca3af')
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '1.5,3')
                .attr('opacity', 0.6);
            
            // Horizontal line: from point to y-axis
            g.append('line')
                .attr('class', 'drop-line drop-line-100')
                .attr('x1', x100)
                .attr('y1', y100)
                .attr('x2', x0)
                .attr('y2', y100)
                .attr('stroke', '#9ca3af')
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '1.5,3')
                .attr('opacity', 0.6);
            
            // Axis markers for 100% point
            // Marker on X-axis
            g.append('line')
                .attr('class', 'axis-marker axis-marker-100')
                .attr('x1', x100 - 4)
                .attr('y1', y1)
                .attr('x2', x100 + 4)
                .attr('y2', y1)
                .attr('stroke', '#9ca3af')
                .attr('stroke-width', 2)
                .attr('opacity', 0.5);
            
            // Marker on Y-axis
            g.append('line')
                .attr('class', 'axis-marker axis-marker-100')
                .attr('x1', x0)
                .attr('y1', y100 - 4)
                .attr('x2', x0)
                .attr('y2', y100 + 4)
                .attr('stroke', '#9ca3af')
                .attr('stroke-width', 2)
                .attr('opacity', 0.5);
        }
        
        // Current rollout point (filled circle)
        g.append('circle')
            .attr('class', 'point')
            .attr('cx', xCur)
            .attr('cy', yCur)
            .attr('r', 6);
        
        // Label for current point
        g.append('text')
            .attr('class', 'label')
            .attr('x', xCur + 8)
            .attr('y', yCur)
            .attr('dy', '0.35em')
            .text('current');
        
        // Point at 100% (hollow circle) with decision color
        if (state.rollout !== 100) {
            g.append('circle')
                .attr('class', 'point')
                .attr('cx', x100)
                .attr('cy', y100)
                .attr('r', 6)
                .attr('fill', 'none')
                .attr('stroke', decisionColor)
                .attr('stroke-width', 2);
            
            // Label for 100% point
            g.append('text')
                .attr('class', 'label')
                .attr('x', x100 + 8)
                .attr('y', y100)
                .attr('dy', '0.35em')
                .text('100%');
        }
        
        // Axes - only ticks, no labels
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
    function updateAll() {
        updateKPI();
        updateRolloutChart();
    }

    /**
     * Initialize sliders
     */
    function initSlider(id, displayId, formatFn, scale = 1) {
        const slider = document.getElementById(id);
        const display = document.getElementById(displayId);
        
        function update() {
            const value = parseFloat(slider.value) / scale;
            state[id] = value;
            display.textContent = formatFn(value);
            updateAll();
        }
        
        slider.addEventListener('input', update);
        update();
    }

    /**
     * Setup ResizeObserver for responsive charts
     */
    function setupResizeObservers() {
        const el = document.querySelector('#rollout-main-chart');
        if (!el) return;
        
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                clearTimeout(el._resizeTimeout);
                el._resizeTimeout = setTimeout(() => {
                    updateRolloutChart();
                }, 120);
            }
        });
        
        resizeObserver.observe(el);
    }

    // Initialize all sliders
    initSlider('dcpm', 'dcpm-value', v => v.toFixed(1), 1);
    initSlider('dshowrate', 'dshowrate-value', v => v.toFixed(1), 1);
    initSlider('drequests', 'drequests-value', v => v.toFixed(1), 1);
    initSlider('rollout', 'rollout-value', v => Math.round(v), 1);

    // Initial update
    updateAll();
    
    // Setup resize observers after initial render
    if (window.ResizeObserver) {
        setupResizeObservers();
    }

    // ========================================
    // Compare 3 tests functionality
    // ========================================

    /**
     * Compute projection to 100% for a test
     * R(p) = 100*(1-p) + R_test*p
     * R_test = (R(p) - 100*(1-p)) / p
     */
    function computeProjection(share, revenue) {
        const p = share / 100;
        if (p <= 0) {
            return { revenue100: 100, delta: 0 };
        }
        const revenue100 = (revenue - baseline * (1 - p)) / p;
        const delta = revenue100 - baseline;
        return { revenue100, delta };
    }

    /**
     * Read test inputs and compute projections
     */
    function readTestData() {
        const tA_share = parseFloat(document.getElementById('tA_share').value) || 22;
        const tA_rev = parseFloat(document.getElementById('tA_rev').value) || 99.7;
        const tB_share = parseFloat(document.getElementById('tB_share').value) || 22;
        const tB_rev = parseFloat(document.getElementById('tB_rev').value) || 101.0;
        const tC_share = parseFloat(document.getElementById('tC_share').value) || 22;
        const tC_rev = parseFloat(document.getElementById('tC_rev').value) || 98.6;

        const testA = {
            name: 'A',
            share: tA_share,
            revenue: tA_rev,
            ...computeProjection(tA_share, tA_rev)
        };

        const testB = {
            name: 'B',
            share: tB_share,
            revenue: tB_rev,
            ...computeProjection(tB_share, tB_rev)
        };

        const testC = {
            name: 'C',
            share: tC_share,
            revenue: tC_rev,
            ...computeProjection(tC_share, tC_rev)
        };

        return [testA, testB, testC];
    }

    /**
     * Render compare chart
     */
    function renderCompareChart() {
        const containerSize = getContainerSize('#compare-chart');
        const margin = { top: 20, right: 60, bottom: 40, left: 50 };
        const width = Math.max(280, containerSize.width - margin.left - margin.right);
        const height = Math.max(220, containerSize.height - margin.top - margin.bottom);
        
        d3.select('#compare-chart').selectAll('*').remove();
        
        const svg = d3.select('#compare-chart')
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);
        
        const g = svg.append('g')
            .attr('class', 'calc-chart')
            .attr('transform', `translate(${margin.left},${margin.top})`);
        
        const tests = readTestData();
        
        // Calculate extent for y-axis
        const allRevenues = tests.flatMap(t => [t.revenue, t.revenue100, baseline]);
        const revenueExtent = d3.extent(allRevenues);
        const yScale = d3.scaleLinear()
            .domain([revenueExtent[0] * 0.98, revenueExtent[1] * 1.02])
            .nice()
            .range([height, 0]);
        
        const xScale = d3.scaleLinear()
            .domain([0, 100])
            .range([0, width]);
        
        // Baseline line
        g.append('line')
            .attr('class', 'grid')
            .attr('x1', 0)
            .attr('x2', width)
            .attr('y1', yScale(baseline))
            .attr('y2', yScale(baseline))
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '4 4');
        
        // Line styles: A=solid, B=dash "6,4", C=dash "2,3"
        const lineStyles = [
            { name: 'A', dashArray: 'none' },
            { name: 'B', dashArray: '6,4' },
            { name: 'C', dashArray: '2,3' }
        ];
        
        // Draw lines for each test
        tests.forEach((test, idx) => {
            const style = lineStyles[idx];
            const lineData = [
                { x: 0, y: baseline },
                { x: 100, y: test.revenue100 }
            ];
            
            const line = d3.line()
                .x(d => xScale(d.x))
                .y(d => yScale(d.y));
            
            g.append('path')
                .datum(lineData)
                .attr('class', 'line line-test')
                .attr('d', line)
                .attr('stroke', '#111827')
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', style.dashArray)
                .attr('fill', 'none');
            
            // Current point (filled circle)
            g.append('circle')
                .attr('class', 'point')
                .attr('cx', xScale(test.share))
                .attr('cy', yScale(test.revenue))
                .attr('r', 5)
                .attr('fill', '#111827');
            
            // Label for current point
            g.append('text')
                .attr('class', 'label')
                .attr('x', xScale(test.share) + 8)
                .attr('y', yScale(test.revenue))
                .attr('dy', '0.35em')
                .text(test.name);
            
            // Point at 100% (hollow circle)
            g.append('circle')
                .attr('class', 'point')
                .attr('cx', xScale(100))
                .attr('cy', yScale(test.revenue100))
                .attr('r', 5)
                .attr('fill', 'none')
                .attr('stroke', '#111827')
                .attr('stroke-width', 2);
            
            // Label for 100% point (only if not overlapping)
            if (test.share < 85) {
                g.append('text')
                    .attr('class', 'label')
                    .attr('x', xScale(100) + 8)
                    .attr('y', yScale(test.revenue100))
                    .attr('dy', '0.35em')
                    .text(test.name + ' 100%');
            }
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
     * Update compare KPIs and verdict
     */
    function updateCompareUI() {
        const tests = readTestData();
        const kpisEl = document.getElementById('compare-kpis');
        const verdictEl = document.getElementById('compare-verdict');
        
        // Update KPIs
        kpisEl.innerHTML = tests.map(test => `
            <div class="k">
                <div class="l">${test.name} @100%</div>
                <div class="v">${test.revenue100.toFixed(1)}<span style="font-size: 14px; font-weight: 400; color: #6b7280;"> (${test.delta >= 0 ? '+' : ''}${test.delta.toFixed(1)})</span></div>
            </div>
        `).join('');
        
        // Find best test
        const sorted = [...tests].sort((a, b) => b.revenue100 - a.revenue100);
        const best = sorted[0];
        const second = sorted[1];
        
        // Verdict
        let verdictText = '';
        if (best.revenue100 - second.revenue100 < 0.5) {
            verdictText = `Практически одинаково: ${sorted.map(t => `Тест ${t.name} (R=${t.revenue100.toFixed(1)}, Δ=${t.delta >= 0 ? '+' : ''}${t.delta.toFixed(1)})`).join(', ')}.`;
        } else {
            verdictText = `Лучший на 100%: Тест ${best.name} (R=${best.revenue100.toFixed(1)}, Δ=${best.delta >= 0 ? '+' : ''}${best.delta.toFixed(1)}).`;
        }
        
        verdictEl.textContent = verdictText;
    }

    /**
     * Update compare section
     */
    function updateCompare() {
        updateCompareUI();
        renderCompareChart();
    }

    /**
     * Initialize compare inputs
     */
    function initCompareInputs() {
        const inputIds = ['tA_share', 'tA_rev', 'tB_share', 'tB_rev', 'tC_share', 'tC_rev'];
        
        inputIds.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', updateCompare);
                input.addEventListener('change', updateCompare);
            }
        });
        
        // Initial render
        updateCompare();
    }

    /**
     * Setup resize observer for compare chart
     */
    function setupCompareResizeObserver() {
        const el = document.querySelector('#compare-chart');
        if (!el) return;
        
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                clearTimeout(el._resizeTimeout);
                el._resizeTimeout = setTimeout(() => {
                    renderCompareChart();
                }, 120);
            }
        });
        
        resizeObserver.observe(el);
    }

    // Initialize compare functionality
    if (document.getElementById('tA_share')) {
        initCompareInputs();
        if (window.ResizeObserver) {
            setupCompareResizeObserver();
        }
    }
})();
