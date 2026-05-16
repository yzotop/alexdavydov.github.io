// Canvas charts: distribution (golden vs prod) + precision per segment.

const Charts = {

  getCssVar: function(name, fallback) {
    const val = getComputedStyle(document.documentElement)
                  .getPropertyValue(name).trim();
    return val || fallback;
  },

  // Distribution chart — grouped bars golden vs production by segment
  drawDistribution: function(canvas, perSegment) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const accent = Charts.getCssVar('--accent', '#3b82f6');
    const green = '#16a34a';
    const muted = Charts.getCssVar('--muted', '#94a3b8');
    const text = Charts.getCssVar('--text', '#1e293b');

    const segments = ['electronics', 'fashion', 'food', 'long_tail'];
    const labels = ['Electronics', 'Fashion', 'Food', 'Long tail'];

    const padL = 40, padR = 20, padT = 20, padB = 40;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const groupW = plotW / segments.length;
    const barW = groupW * 0.35;
    const barGap = groupW * 0.05;

    // Find max value for y-scale
    const allVals = segments.flatMap(s => [
      perSegment[s].golden_share, perSegment[s].prod_share
    ]);
    const yMax = Math.max(...allVals, 0.5);

    const yScale = (v) => padT + (1 - v / yMax) * plotH;

    // Axes
    ctx.strokeStyle = muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    // Y ticks
    ctx.fillStyle = muted;
    ctx.font = '10px var(--mono), monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const v = (yMax * i) / yTicks;
      const y = yScale(v);
      ctx.beginPath();
      ctx.moveTo(padL - 3, y);
      ctx.lineTo(padL, y);
      ctx.stroke();
      ctx.fillText((v * 100).toFixed(0) + '%', padL - 6, y);
    }

    // Draw bars per segment
    segments.forEach((seg, i) => {
      const cx = padL + groupW * i + groupW / 2;
      const segData = perSegment[seg];

      // Golden bar (left, green)
      const xGold = cx - barW - barGap / 2;
      const yGold = yScale(segData.golden_share);
      ctx.fillStyle = green;
      ctx.fillRect(xGold, yGold, barW, padT + plotH - yGold);

      // Production bar (right, blue)
      const xProd = cx + barGap / 2;
      const yProd = yScale(segData.prod_share);
      ctx.fillStyle = accent;
      ctx.fillRect(xProd, yProd, barW, padT + plotH - yProd);

      // Value labels above bars
      ctx.fillStyle = text;
      ctx.font = '9px var(--sans), sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText((segData.golden_share * 100).toFixed(0) + '%',
                   xGold + barW / 2, yGold - 2);
      ctx.fillText((segData.prod_share * 100).toFixed(0) + '%',
                   xProd + barW / 2, yProd - 2);

      // X label (segment name)
      ctx.fillStyle = text;
      ctx.font = '10px var(--sans), sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(labels[i], cx, padT + plotH + 6);
    });

    // Legend (top-right)
    ctx.font = '10px var(--sans), sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const lx = padL + plotW - 110;
    ctx.fillStyle = green;
    ctx.fillRect(lx, padT, 10, 10);
    ctx.fillStyle = text;
    ctx.fillText('Golden set', lx + 14, padT + 1);
    ctx.fillStyle = accent;
    ctx.fillRect(lx, padT + 14, 10, 10);
    ctx.fillStyle = text;
    ctx.fillText('Production', lx + 14, padT + 15);
  },

  // Precision per segment chart — bars + n_needed labels
  drawPrecision: function(canvas, perSegment) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const accent = Charts.getCssVar('--accent', '#3b82f6');
    const muted = Charts.getCssVar('--muted', '#94a3b8');
    const text = Charts.getCssVar('--text', '#1e293b');

    const segments = ['electronics', 'fashion', 'food', 'long_tail'];
    const labels = ['Electronics', 'Fashion', 'Food', 'Long tail'];

    const padL = 40, padR = 20, padT = 20, padB = 50;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const groupW = plotW / segments.length;
    const barW = groupW * 0.55;

    // y-scale 0-1 (precision)
    const yScale = (v) => padT + (1 - v) * plotH;

    // Axes
    ctx.strokeStyle = muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    // Y ticks
    ctx.fillStyle = muted;
    ctx.font = '10px var(--mono), monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let p = 0; p <= 1.0001; p += 0.2) {
      const y = yScale(p);
      ctx.beginPath();
      ctx.moveTo(padL - 3, y);
      ctx.lineTo(padL, y);
      ctx.stroke();
      ctx.fillText((p * 100).toFixed(0) + '%', padL - 6, y);
    }

    // Color by precision: < 0.6 red, 0.6-0.8 orange, > 0.8 green
    function colorForPrecision(p) {
      if (p >= 0.8) return '#16a34a';
      if (p >= 0.6) return '#f59e0b';
      return '#dc2626';
    }

    // Draw bars
    segments.forEach((seg, i) => {
      const cx = padL + groupW * i + groupW / 2;
      const segData = perSegment[seg];

      const x = cx - barW / 2;
      const y = yScale(segData.precision);
      ctx.fillStyle = colorForPrecision(segData.precision);
      ctx.fillRect(x, y, barW, padT + plotH - y);

      // Precision label above bar
      ctx.fillStyle = text;
      ctx.font = 'bold 11px var(--sans), sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText((segData.precision * 100).toFixed(0) + '%',
                   cx, y - 2);

      // Segment name + n_needed below x-axis
      ctx.fillStyle = text;
      ctx.font = '10px var(--sans), sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(labels[i], cx, padT + plotH + 6);

      ctx.fillStyle = muted;
      ctx.font = '9px var(--mono), monospace';
      ctx.fillText('n=' + Utils.fmtInt(segData.n_needed),
                   cx, padT + plotH + 22);
    });
  }
};
