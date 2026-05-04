/**
 * Revenue Calculator - Interactive model for price × volume trade-off
 */

(function() {
    'use strict';

    // State
    let state = {
        cpm: 100,
        shows: 100,
        elasticity: -1.0
    };

    // Base values (indices)
    const baseCpm = 100;
    const baseShows = 100;
    
    // CPM domain for chart
    const CPM_DOMAIN = [40, 240];

    /**
     * Calculate shows index based on CPM and elasticity
     * Formula: ShowsIndex = baseShows * (CPMIndex/100)^(elasticity)
     */
    function calculateShowsFromCpm(cpmIndex, baseShowsValue, elasticity) {
        if (elasticity === 0) {
            return baseShowsValue;
        }
        const cpmRatio = cpmIndex / 100;
        return baseShowsValue * Math.pow(cpmRatio, elasticity);
    }

    /**
     * Calculate revenue index
     * RevenueIndex = (CPMIndex/100) * (ShowsIndex/100) * 100
     */
    function calculateRevenue(cpmIndex = state.cpm, baseShowsValue = state.shows, elasticity = state.elasticity) {
        const showsIndex = calculateShowsFromCpm(cpmIndex, baseShowsValue, elasticity);
        const revenueIndex = (cpmIndex / 100) * (showsIndex / 100) * 100;
        return {
            cpmIndex,
            showsIndex,
            revenueIndex
        };
    }

    /**
     * Calculate revenue vs price curve
     */
    function calculateRevVsPrice() {
        const points = [];
        const elasticity = state.elasticity;
        const baseShowsValue = state.shows;
        
        for (let cpm = CPM_DOMAIN[0]; cpm <= CPM_DOMAIN[1]; cpm += 1) {
            const result = calculateRevenue(cpm, baseShowsValue, elasticity);
            points.push({
                cpm,
                revenue: result.revenueIndex
            });
        }
        
        return points;
    }

    /**
     * Find optimal CPM (where revenue is maximum)
     * Returns { cpm, revenue }
     */
    function findOptimalCpm() {
        const curve = calculateRevVsPrice();
        let maxRevenue = -Infinity;
        let optimalCpm = 100;
        
        curve.forEach(point => {
            if (point.revenue > maxRevenue) {
                maxRevenue = point.revenue;
                optimalCpm = point.cpm;
            }
        });
        
        return {
            cpm: optimalCpm,
            revenue: maxRevenue
        };
    }

    /**
     * Calculate local sensitivity (ΔRevenue / ΔCPM) at current CPM
     */
    function calculateLocalSensitivity(cpm) {
        const revPlus = calculateRevenue(cpm + 1).revenueIndex;
        const revMinus = calculateRevenue(cpm - 1).revenueIndex;
        const sensitivity = (revPlus - revMinus) / 2;
        return sensitivity;
    }

    /**
     * Find plateau zone (where revenue ≥ Revenue_opt - 0.3)
     * Returns { left, right, width } or null if plateau is too narrow
     */
    function findPlateau(optimal) {
        const curve = calculateRevVsPrice();
        const threshold = optimal.revenue - 0.3;
        
        let left = null;
        let right = null;
        
        // Find left boundary
        for (let i = 0; i < curve.length; i++) {
            if (curve[i].revenue >= threshold) {
                left = curve[i].cpm;
                break;
            }
        }
        
        // Find right boundary
        for (let i = curve.length - 1; i >= 0; i--) {
            if (curve[i].revenue >= threshold) {
                right = curve[i].cpm;
                break;
            }
        }
        
        if (left === null || right === null || (right - left) < 10) {
            return null; // Plateau too narrow or doesn't exist
        }
        
        return {
            left,
            right,
            width: right - left
        };
    }

    /**
     * Get verdict text based on current position relative to plateau
     */
    function getVerdict(currentCpm, plateau) {
        if (!plateau) {
            // Fallback if no plateau
            const optimal = findOptimalCpm();
            const diff = currentCpm - optimal.cpm;
            if (diff < -4) {
                return 'Рост CPM может увеличить выручку.';
            } else if (diff > 4) {
                return 'Дальнейший рост CPM снижает выручку.';
            } else {
                return 'Вы находитесь рядом с оптимумом.';
            }
        }
        
        if (currentCpm < plateau.left) {
            return 'Рост CPM может увеличить выручку.';
        } else if (currentCpm > plateau.right) {
            return 'Дальнейший рост CPM снижает выручку.';
        } else {
            return 'Вы находитесь в плато: оптимизация CPM даёт слабый эффект.';
        }
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
     * Update all displays and chart
     */
    function updateAll() {
        const result = calculateRevenue();
        const optimal = findOptimalCpm();
        const plateau = findPlateau(optimal);
        const sensitivity = calculateLocalSensitivity(result.cpmIndex);
        const verdict = getVerdict(result.cpmIndex, plateau);
        
        // Update KPI
        document.getElementById('revenue-index').textContent = result.revenueIndex.toFixed(1);
        document.getElementById('cpm-index').textContent = result.cpmIndex.toFixed(1);
        document.getElementById('shows-index').textContent = result.showsIndex.toFixed(1);
        
        // Update context
        const ctxEl = document.getElementById('chart-context');
        if (ctxEl) {
            ctxEl.innerHTML = `Контекст: CPM <strong>${result.cpmIndex.toFixed(0)}</strong> · Показы <strong>${result.showsIndex.toFixed(1)}</strong> · Эластичность <strong>${state.elasticity.toFixed(2)}</strong>`;
        }
        
        // Update warning (decision hint)
        const warnEl = document.getElementById('chart-warning');
        if (warnEl) {
            const eps = 3;
            const cpm = result.cpmIndex;
            const cpmOpt = optimal.cpm;
            
            if (cpm > cpmOpt + eps) {
                warnEl.textContent = 'Вы справа от оптимума: рост CPM снижает выручку.';
            } else if (cpm < cpmOpt - eps) {
                warnEl.textContent = 'Вы слева от оптимума: рост CPM может увеличить выручку.';
            } else {
                warnEl.textContent = 'Вы рядом с оптимумом: эффект от изменения CPM будет слабым.';
            }
        }
        
        // Update sensitivity display
        const sensitivityEl = document.getElementById('sensitivity-value');
        if (sensitivityEl) {
            sensitivityEl.textContent = sensitivity.toFixed(1);
        }
        
        // Update plateau info
        const plateauEl = document.getElementById('plateau-info');
        if (plateauEl) {
            if (plateau && plateau.width >= 10) {
                plateauEl.textContent = 'Плато выручки: широкий диапазон CPM даёт почти одинаковый результат.';
                plateauEl.style.display = 'block';
            } else {
                plateauEl.style.display = 'none';
            }
        }
        
        // Update verdict
        const verdictEl = document.getElementById('chart-verdict');
        if (verdictEl) {
            verdictEl.textContent = verdict;
        }
        
        // Update chart
        updateRevVsPriceChart();
    }

    /**
     * Render revenue vs price chart
     */
    function updateRevVsPriceChart() {
        const containerSize = getContainerSize('#rev-vs-price-chart');
        const margin = { top: 20, right: 100, bottom: 40, left: 60 };
        const width = Math.max(280, containerSize.width - margin.left - margin.right);
        const height = Math.max(220, containerSize.height - margin.top - margin.bottom);
        const small = width < 500;
        
        d3.select('#rev-vs-price-chart').selectAll('*').remove();
        
        const svg = d3.select('#rev-vs-price-chart')
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);
        
        const g = svg.append('g')
            .attr('class', 'calc-chart')
            .attr('transform', `translate(${margin.left},${margin.top})`);
        
        const curve = calculateRevVsPrice();
        const current = calculateRevenue();
        const optimal = findOptimalCpm();
        const plateau = findPlateau(optimal);
        
        // Calculate ghost point (+5% CPM)
        const ghostCpm = current.cpmIndex * 1.05;
        const ghostRevenue = calculateRevenue(ghostCpm).revenueIndex;
        const ghostDelta = ghostRevenue - current.revenueIndex;
        const showGhost = ghostCpm >= CPM_DOMAIN[0] && ghostCpm <= CPM_DOMAIN[1];
        
        // Scales - use CPM domain
        const revenueExtent = d3.extent(curve, d => d.revenue);
        
        const xScale = d3.scaleLinear()
            .domain(CPM_DOMAIN)
            .range([0, width])
            .clamp(true);
        
        const yScale = d3.scaleLinear()
            .domain([revenueExtent[0] * 0.98, revenueExtent[1] * 1.02])
            .nice()
            .range([height, 0]);
        
        // Grid
        const xTicks = xScale.ticks(6);
        const yTicks = yScale.ticks(6);
        
        g.selectAll('.grid-x')
            .data(xTicks)
            .enter()
            .append('line')
            .attr('class', 'grid')
            .attr('x1', d => xScale(d))
            .attr('x2', d => xScale(d))
            .attr('y1', 0)
            .attr('y2', height);
        
        g.selectAll('.grid-y')
            .data(yTicks)
            .enter()
            .append('line')
            .attr('class', 'grid')
            .attr('x1', 0)
            .attr('x2', width)
            .attr('y1', d => yScale(d))
            .attr('y2', d => yScale(d));
        
        // Plateau zone (before curve)
        if (plateau && plateau.width >= 10) {
            const plateauLeft = xScale(plateau.left);
            const plateauRight = xScale(plateau.right);
            
            g.append('rect')
                .attr('class', 'zone-plateau')
                .attr('x', plateauLeft)
                .attr('y', 0)
                .attr('width', plateauRight - plateauLeft)
                .attr('height', height)
                .attr('fill', '#f3f4f6')
                .attr('opacity', 0.6);
        }
        
        // Revenue curve
        const line = d3.line()
            .x(d => xScale(d.cpm))
            .y(d => yScale(d.revenue))
            .curve(d3.curveMonotoneX);
        
        g.append('path')
            .datum(curve)
            .attr('class', 'line line-test')
            .attr('d', line);
        
        // Optimal vertical line (before points)
        const optimalX = xScale(optimal.cpm);
        g.append('line')
            .attr('class', 'vline vline-optimal')
            .attr('x1', optimalX)
            .attr('x2', optimalX)
            .attr('y1', 0)
            .attr('y2', height)
            .attr('stroke', '#e5e7eb')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '3,3')
            .attr('opacity', 0.8);
        
        // Optimal point (hollow circle ○)
        g.append('circle')
            .attr('class', 'point point-optimal')
            .attr('cx', optimalX)
            .attr('cy', yScale(optimal.revenue))
            .attr('r', 5)
            .attr('fill', 'none')
            .attr('stroke', '#111827')
            .attr('stroke-width', 1.5);
        
        // Optimal point label (only if not small)
        if (!small) {
            const labelX = optimalX + 8;
            const labelY = yScale(optimal.revenue) - 8;
            const labelText = g.append('text')
                .attr('class', 'label')
                .attr('x', labelX)
                .attr('y', labelY)
                .attr('text-anchor', 'start')
                .style('font-size', '11px')
                .style('fill', '#9ca3af')
                .text('optimum');
            
            // Check if label goes beyond right edge, adjust if needed
            const labelBBox = labelText.node().getBBox();
            if (labelX + labelBBox.width > width) {
                labelText.attr('x', optimalX - 45)
                    .attr('text-anchor', 'end');
            }
        }
        
        // Current CPM vertical line
        g.append('line')
            .attr('class', 'vline')
            .attr('x1', xScale(current.cpmIndex))
            .attr('x2', xScale(current.cpmIndex))
            .attr('y1', 0)
            .attr('y2', height);
        
        // Current point (filled circle ●)
        g.append('circle')
            .attr('class', 'point')
            .attr('cx', xScale(current.cpmIndex))
            .attr('cy', yScale(current.revenueIndex))
            .attr('r', 5);
        
        // Current point label (only if not small)
        if (!small) {
            g.append('text')
                .attr('class', 'label')
                .attr('x', xScale(current.cpmIndex) + 10)
                .attr('y', yScale(current.revenueIndex))
                .attr('dy', '0.35em')
                .style('font-size', '11px')
                .text(`R=${current.revenueIndex.toFixed(1)}`);
        }
        
        // Ghost point (+5% CPM)
        if (showGhost && !small) {
            const ghostX = xScale(ghostCpm);
            const ghostY = yScale(ghostRevenue);
            
            // Dashed line from current to ghost
            g.append('line')
                .attr('class', 'ghost-line')
                .attr('x1', xScale(current.cpmIndex))
                .attr('y1', yScale(current.revenueIndex))
                .attr('x2', ghostX)
                .attr('y2', ghostY)
                .attr('stroke', '#9ca3af')
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '2,2')
                .attr('opacity', 0.6);
            
            // Ghost point (hollow, small)
            g.append('circle')
                .attr('class', 'point ghost-point')
                .attr('cx', ghostX)
                .attr('cy', ghostY)
                .attr('r', 3)
                .attr('fill', 'none')
                .attr('stroke', '#9ca3af')
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '2,2');
            
            // Ghost label
            const ghostLabelText = `+5% CPM → ${ghostDelta >= 0 ? '+' : ''}${ghostDelta.toFixed(1)}% выручки`;
            g.append('text')
                .attr('class', 'label')
                .attr('x', ghostX + 6)
                .attr('y', ghostY - 6)
                .attr('text-anchor', 'start')
                .style('font-size', '10px')
                .style('fill', '#6b7280')
                .style('opacity', 0.7)
                .text(ghostLabelText);
        }
        
        // Axes
        const xAxis = d3.axisBottom(xScale)
            .ticks(6)
            .tickFormat(d => d);
        
        const yAxis = d3.axisLeft(yScale)
            .ticks(6)
            .tickFormat(d => d.toFixed(0));
        
        g.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(xAxis);
        
        g.append('g')
            .attr('class', 'axis')
            .call(yAxis);
        
        // Axis labels (only if not small)
        if (!small) {
            g.append('text')
                .attr('class', 'label')
                .attr('x', width / 2)
                .attr('y', height + 30)
                .attr('text-anchor', 'middle')
                .text('CPM (индекс)');
            
            g.append('text')
                .attr('class', 'label')
                .attr('x', -height / 2)
                .attr('y', -45)
                .attr('text-anchor', 'middle')
                .attr('transform', 'rotate(-90)')
                .text('Выручка (индекс)');
        }
    }

    /**
     * Setup ResizeObserver for responsive chart
     */
    function setupResizeObserver() {
        const el = document.querySelector('#rev-vs-price-chart');
        if (!el) return;
        
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                // Debounce resize updates
                clearTimeout(el._resizeTimeout);
                el._resizeTimeout = setTimeout(() => {
                    updateRevVsPriceChart();
                }, 120);
            }
        });
        
        resizeObserver.observe(el);
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

    // Initialize all sliders
    initSlider('cpm', 'cpm-value', v => Math.round(v), 1);
    initSlider('shows', 'shows-value', v => Math.round(v), 1);
    initSlider('elasticity', 'elasticity-value', v => (v / 20).toFixed(1), 20);

    // Initial update
    updateAll();
    
    // Setup resize observer after initial render
    if (window.ResizeObserver) {
        setupResizeObserver();
    }
})();
