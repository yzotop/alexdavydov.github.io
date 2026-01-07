/**
 * AB Charts - Common module for rendering A/B test scenario charts
 * Canonical light style with CSS classes
 */

(function() {
    'use strict';

    // Default configuration
    const defaults = {
        width: null, // auto from container
        height: 420,
        margin: { top: 20, right: 80, bottom: 40, left: 50 }, // right margin increased for labels
        responsive: true,
        theme: {
            background: '#ffffff',
            grid: true
        },
        axis: {
            xLabel: '',
            yLabel: '',
            xTicks: null,
            yTicks: null,
            yFormat: d => d.toFixed(1)
        },
        annotations: {
            enabled: false,
            lines: [],
            bands: [],
            labels: [],
            markers: []
        },
        tooltip: {
            enabled: true
        }
    };

    /**
     * Determine series class name
     */
    function getSeriesClass(series) {
        const name = (series.name || '').toLowerCase();
        if (name.includes('control')) return 'ab-control';
        if (name.includes('test')) return 'ab-test';
        if (series.type === 'secondary' || name.includes('secondary')) return 'ab-secondary';
        return 'ab-test'; // default
    }

    /**
     * Determine label class name
     */
    function getLabelClass(series) {
        const name = (series.name || '').toLowerCase();
        if (name.includes('control')) return 'ab-label ab-label-control';
        if (name.includes('test')) return 'ab-label ab-label-test';
        if (series.type === 'secondary' || name.includes('secondary')) return 'ab-label ab-label-secondary';
        return 'ab-label ab-label-test';
    }

    /**
     * Render scenario chart
     * @param {Object} options - Chart configuration
     */
    function renderScenarioChart(options) {
        const config = Object.assign({}, defaults, options);
        const el = typeof config.el === 'string' 
            ? document.querySelector(config.el) 
            : config.el;
        
        if (!el) {
            console.error('Chart container not found:', config.el);
            return;
        }

        // Clear container
        el.innerHTML = '';

        // Get container dimensions
        const containerWidth = el.clientWidth || 800;
        const width = config.width || (containerWidth - config.margin.left - config.margin.right);
        const height = config.height - config.margin.top - config.margin.bottom;
        const totalWidth = width + config.margin.left + config.margin.right;
        const totalHeight = height + config.margin.top + config.margin.bottom;

        // Create SVG - NO background rectangle
        const svg = d3.select(el)
            .append('svg')
            .attr('width', totalWidth)
            .attr('height', totalHeight)
            .attr('viewBox', `0 0 ${totalWidth} ${totalHeight}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        const g = svg.append('g')
            .attr('class', 'ab-chart')
            .attr('transform', `translate(${config.margin.left},${config.margin.top})`);

        // Prepare data
        if (!config.series || !config.series.length) {
            console.error('No series data provided');
            return;
        }

        // Flatten all data points for domain calculation
        const allData = config.series.flatMap(s => s.values || []);
        const xExtent = d3.extent(allData, d => d.x);
        const yExtent = d3.extent(allData, d => d.y);

        // Scales
        const xScale = d3.scaleLinear()
            .domain(xExtent)
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain([yExtent[0] * 0.98, yExtent[1] * 1.02]) // Add padding
            .nice()
            .range([height, 0]);

        // Grid lines - horizontal only (canonical style)
        if (config.theme.grid) {
            g.selectAll('.ab-grid')
                .data(yScale.ticks(config.axis.yTicks || 5))
                .enter()
                .append('line')
                .attr('class', 'ab-grid')
                .attr('x1', 0)
                .attr('x2', width)
                .attr('y1', d => yScale(d))
                .attr('y2', d => yScale(d));
        }

        // Annotations: bands (shaded areas) - BEFORE lines so they appear behind
        if (config.annotations.enabled && config.annotations.bands) {
            config.annotations.bands.forEach(band => {
                const x0 = band.x0 !== undefined ? band.x0 : (band.xStart || band.x);
                const x1 = band.x1 !== undefined ? band.x1 : (band.xEnd || band.x);
                const y0 = band.y0 !== undefined ? band.y0 : (band.yMin || yExtent[0]);
                const y1 = band.y1 !== undefined ? band.y1 : (band.yMax || yExtent[1]);
                
                g.append('rect')
                    .attr('class', 'ab-band')
                    .attr('x', xScale(x0))
                    .attr('y', yScale(y1))
                    .attr('width', xScale(x1) - xScale(x0))
                    .attr('height', yScale(y0) - yScale(y1));
            });
        }

        // Line generator
        const line = d3.line()
            .x(d => xScale(d.x))
            .y(d => yScale(d.y))
            .curve(d3.curveMonotoneX);

        // Render series
        config.series.forEach((series, idx) => {
            const seriesClass = getSeriesClass(series);
            const isDashed = series.dashed || series.dashArray || (series.name && series.name.toLowerCase().includes('control'));
            const dashArray = series.dashArray || (isDashed ? '4,4' : null);

            // Line path
            const path = g.append('path')
                .datum(series.values)
                .attr('class', `ab-line ${seriesClass}`)
                .attr('d', line);

            if (dashArray) {
                path.attr('stroke-dasharray', dashArray);
            }
        });

        // Series labels on the right (canonical style)
        config.series.forEach((series) => {
            if (series.values && series.values.length > 0) {
                const lastPoint = series.values[series.values.length - 1];
                const labelClass = getLabelClass(series);
                const labelText = series.name || series.label || `Series ${idx + 1}`;
                
                g.append('text')
                    .attr('class', labelClass)
                    .attr('x', width + 8) // Right margin
                    .attr('y', yScale(lastPoint.y))
                    .attr('dy', '0.35em') // Vertical alignment
                    .text(labelText);
            }
        });

        // Annotations: vertical lines
        if (config.annotations.enabled && config.annotations.lines) {
            config.annotations.lines.forEach(lineConfig => {
                const x = xScale(lineConfig.x);
                const vline = g.append('line')
                    .attr('class', 'ab-vline')
                    .attr('x1', x)
                    .attr('x2', x)
                    .attr('y1', 0)
                    .attr('y2', height);

                // Optional label
                if (lineConfig.label) {
                    g.append('text')
                        .attr('class', 'ab-label')
                        .attr('x', x + 6)
                        .attr('y', 12)
                        .text(lineConfig.label);
                }
            });
        }

        // Annotations: markers (circles)
        if (config.annotations.enabled && config.annotations.markers) {
            config.annotations.markers.forEach(marker => {
                const x = xScale(marker.x);
                const y = yScale(marker.y);
                g.append('circle')
                    .attr('cx', x)
                    .attr('cy', y)
                    .attr('r', marker.radius || 3)
                    .attr('class', 'ab-marker')
                    .attr('fill', 'currentColor')
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 1);
            });
        }

        // Annotations: labels (text annotations)
        if (config.annotations.enabled && config.annotations.labels) {
            config.annotations.labels.forEach(labelConfig => {
                const x = xScale(labelConfig.x);
                const y = yScale(labelConfig.y);
                const textAnchor = labelConfig.textAnchor || 'start';
                const dx = labelConfig.dx || (textAnchor === 'end' ? -6 : 6);
                const dy = labelConfig.dy || -6;
                
                g.append('text')
                    .attr('class', 'ab-label')
                    .attr('x', x)
                    .attr('y', y)
                    .attr('dx', dx)
                    .attr('dy', dy)
                    .attr('text-anchor', textAnchor)
                    .attr('font-size', labelConfig.fontSize || '12px')
                    .attr('font-weight', labelConfig.fontWeight || '400')
                    .text(labelConfig.text);
            });
        }

        // Axes - using CSS classes
        const xAxis = d3.axisBottom(xScale)
            .ticks(config.axis.xTicks || Math.min(10, xExtent[1] - xExtent[0]))
            .tickFormat(d => Math.round(d));

        const yAxis = d3.axisLeft(yScale)
            .ticks(config.axis.yTicks || 5)
            .tickFormat(config.axis.yFormat);

        const xAxisG = g.append('g')
            .attr('class', 'ab-axis ab-axis-x')
            .attr('transform', `translate(0,${height})`)
            .call(xAxis);

        const yAxisG = g.append('g')
            .attr('class', 'ab-axis ab-axis-y')
            .call(yAxis);

        // Axis labels
        if (config.axis.xLabel) {
            g.append('text')
                .attr('class', 'ab-axis-label ab-axis-label-x')
                .attr('x', width / 2)
                .attr('y', height + config.margin.bottom - 5)
                .attr('text-anchor', 'middle')
                .text(config.axis.xLabel);
        }

        if (config.axis.yLabel) {
            g.append('text')
                .attr('class', 'ab-axis-label ab-axis-label-y')
                .attr('x', -height / 2)
                .attr('y', -config.margin.left + 15)
                .attr('text-anchor', 'middle')
                .attr('transform', 'rotate(-90)')
                .text(config.axis.yLabel);
        }

        // Tooltip (optional) - using CSS class
        if (config.tooltip && config.tooltip.enabled) {
            const tooltip = d3.select('body').append('div')
                .attr('class', 'ab-tooltip')
                .style('opacity', 0);

            // Add invisible overlay for mouse tracking
            g.append('rect')
                .attr('width', width)
                .attr('height', height)
                .attr('fill', 'transparent')
                .attr('class', 'ab-overlay')
                .on('mousemove', function(event) {
                    const [mx] = d3.pointer(event);
                    const x = xScale.invert(mx);
                    const closest = findClosestPoint(config.series, x);
                    if (closest) {
                        tooltip
                            .style('opacity', 1)
                            .style('left', (event.pageX + 10) + 'px')
                            .style('top', (event.pageY - 10) + 'px')
                            .html(`День ${Math.round(closest.x)}<br/>${closest.series}: ${config.axis.yFormat(closest.y)}`);
                    }
                })
                .on('mouseout', () => {
                    tooltip.style('opacity', 0);
                });
        }

        // Responsive resize
        if (config.responsive) {
            const resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    const newWidth = entry.contentRect.width - config.margin.left - config.margin.right;
                    if (newWidth > 0 && newWidth !== width) {
                        // Re-render on resize
                        renderScenarioChart(options);
                    }
                }
            });
            resizeObserver.observe(el);
        }
    }

    /**
     * Find closest data point to x value
     */
    function findClosestPoint(series, x) {
        let closest = null;
        let minDist = Infinity;
        series.forEach(s => {
            s.values.forEach(d => {
                const dist = Math.abs(d.x - x);
                if (dist < minDist) {
                    minDist = dist;
                    closest = { ...d, series: s.name };
                }
            });
        });
        return closest;
    }

    /**
     * Toggle between clean and annotated modes
     */
    function toggleChartMode(chartId, mode) {
        const chart = document.getElementById(chartId);
        if (!chart) return;
        
        // Store mode in data attribute
        chart.dataset.mode = mode;
        
        // Re-render with appropriate annotations
        // This will be handled by the scenario-specific code
        const event = new CustomEvent('chartModeChange', { 
            detail: { chartId, mode } 
        });
        document.dispatchEvent(event);
    }

    // Export to global scope
    window.ABCharts = {
        render: renderScenarioChart,
        toggleMode: toggleChartMode
    };

})();
