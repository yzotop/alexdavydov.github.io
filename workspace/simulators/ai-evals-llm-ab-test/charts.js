// Canvas-отрисовка power curve и распределений.
// Используем чистый Canvas API без библиотек.

const Charts = {

  // Получить computed CSS variable (для адаптации к токенам styles.css)
  getCssVar: function(name, fallback) {
    const val = getComputedStyle(document.documentElement)
                  .getPropertyValue(name).trim();
    return val || fallback;
  },

  // Power curve.
  drawPowerCurve: function(canvas, points, currentN, currentPower) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const accent = Charts.getCssVar('--accent', '#3b82f6');
    const muted = Charts.getCssVar('--muted', '#94a3b8');
    const text = Charts.getCssVar('--text', '#1e293b');

    const padL = 50, padR = 20, padT = 20, padB = 40;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    // X — N, Y — power [0, 1]
    const nMin = points[0].n;
    const nMax = points[points.length - 1].n;
    const xScale = (n) => padL + ((n - nMin) / (nMax - nMin)) * plotW;
    const yScale = (p) => padT + (1 - p) * plotH;

    // Axes
    ctx.strokeStyle = muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    // Y ticks: 0, 0.2, 0.4, 0.6, 0.8, 1.0
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
      ctx.fillText(p.toFixed(1), padL - 6, y);
    }

    // X ticks (5 evenly spaced)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= 4; i++) {
      const n = Math.round(nMin + ((nMax - nMin) * i) / 4);
      const x = xScale(n);
      ctx.beginPath();
      ctx.moveTo(x, padT + plotH);
      ctx.lineTo(x, padT + plotH + 3);
      ctx.stroke();
      ctx.fillText(n.toString(), x, padT + plotH + 6);
    }

    // Axis labels
    ctx.fillStyle = text;
    ctx.font = '11px var(--sans), sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N (диалогов на группу)', padL + plotW / 2, h - 8);

    ctx.save();
    ctx.translate(14, padT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Power', 0, 0);
    ctx.restore();

    // Naive curve (серая)
    ctx.strokeStyle = muted;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    points.forEach((pt, i) => {
      const x = xScale(pt.n);
      const y = yScale(pt.powerNaive);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Corrected curve (синяя, основная)
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((pt, i) => {
      const x = xScale(pt.n);
      const y = yScale(pt.powerCorrected);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Target power line (горизонтальная)
    ctx.strokeStyle = muted;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(padL, yScale(currentPower));
    ctx.lineTo(padL + plotW, yScale(currentPower));
    ctx.stroke();
    ctx.setLineDash([]);

    // Current N vertical line + точка пересечения
    if (currentN >= nMin && currentN <= nMax) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(xScale(currentN), padT);
      ctx.lineTo(xScale(currentN), padT + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Точка
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(xScale(currentN), yScale(currentPower), 4, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Legend (top right)
    ctx.font = '10px var(--sans), sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = accent;
    ctx.fillText('— С поправкой на stochasticity', padL + plotW - 180, padT + 12);
    ctx.fillStyle = muted;
    ctx.fillText('-- Naive (без поправки)', padL + plotW - 180, padT + 26);
  },

  // Распределения.
  drawDistributions: function(canvas, distData) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const accent = Charts.getCssVar('--accent', '#3b82f6');
    const muted = Charts.getCssVar('--muted', '#94a3b8');
    const text = Charts.getCssVar('--text', '#1e293b');

    const padL = 40, padR = 20, padT = 20, padB = 40;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const xs = distData.xs;
    const pdfA = distData.pdfA;
    const pdfB = distData.pdfB;

    const xMin = xs[0];
    const xMax = xs[xs.length - 1];
    const yMax = Math.max(...pdfA, ...pdfB) * 1.1;

    const xScale = (x) => padL + ((x - xMin) / (xMax - xMin)) * plotW;
    const yScale = (y) => padT + (1 - y / yMax) * plotH;

    // Axes (только X)
    ctx.strokeStyle = muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    // X ticks: 1, 2, 3, 4, 5
    ctx.fillStyle = muted;
    ctx.font = '10px var(--mono), monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let v = 1; v <= 5; v++) {
      const x = xScale(v);
      ctx.beginPath();
      ctx.moveTo(x, padT + plotH);
      ctx.lineTo(x, padT + plotH + 3);
      ctx.stroke();
      ctx.fillText(v.toString(), x, padT + plotH + 6);
    }

    // X axis label
    ctx.fillStyle = text;
    ctx.font = '11px var(--sans), sans-serif';
    ctx.fillText('CSAT (1-5 stars)', padL + plotW / 2, h - 8);

    // Distribution A (текущая модель) — синяя сплошная
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < xs.length; i++) {
      const x = xScale(xs[i]);
      const y = yScale(pdfA[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill под кривой A
    ctx.fillStyle = accent + '15';  // 15 = ~8% alpha
    ctx.beginPath();
    ctx.moveTo(xScale(xs[0]), padT + plotH);
    for (let i = 0; i < xs.length; i++) {
      ctx.lineTo(xScale(xs[i]), yScale(pdfA[i]));
    }
    ctx.lineTo(xScale(xs[xs.length-1]), padT + plotH);
    ctx.closePath();
    ctx.fill();

    // Distribution B (новая модель) — серая dashed
    ctx.strokeStyle = muted;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    for (let i = 0; i < xs.length; i++) {
      const x = xScale(xs[i]);
      const y = yScale(pdfB[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Mean markers
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(xScale(distData.muA), padT);
    ctx.lineTo(xScale(distData.muA), padT + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = muted;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(xScale(distData.muB), padT);
    ctx.lineTo(xScale(distData.muB), padT + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Legend
    ctx.font = '10px var(--sans), sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = accent;
    ctx.fillText('— Model A (μ=' + distData.muA.toFixed(2) + ')', padL + 10, padT + 4);
    ctx.fillStyle = muted;
    ctx.fillText('-- Model B (μ=' + distData.muB.toFixed(2) + ')', padL + 10, padT + 18);
  }
};
