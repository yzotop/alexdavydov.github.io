// Canvas-отрисовка: bar chart + strategy comparison.

const Charts = {

  getCssVar: function(name, fallback) {
    const val = getComputedStyle(document.documentElement)
                  .getPropertyValue(name).trim();
    return val || fallback;
  },

  // ── BAR CHART ────────────────────────────────────────────────
  // Показывает: true win rate (зелёный), estimated win rate (синий),
  // tie rate (серый, только для mirror), ±5 п.п. tolerance.
  drawBarChart: function(canvas, result, params) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const accent  = Charts.getCssVar('--accent', '#3b82f6');
    const muted   = Charts.getCssVar('--muted', '#94a3b8');
    const text    = Charts.getCssVar('--text', '#1e293b');
    const green   = '#16a34a';
    const red     = '#dc2626';

    const padL = 40, padR = 20, padT = 20, padB = 30;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const yScale = (v) => padT + (1 - v) * plotH;

    // Axes
    ctx.strokeStyle = muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    // Y ticks: 0, 0.25, 0.5, 0.75, 1.0
    ctx.fillStyle = muted;
    ctx.font = '10px var(--mono), monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let p = 0; p <= 1.0001; p += 0.25) {
      const y = yScale(p);
      ctx.beginPath();
      ctx.moveTo(padL - 3, y);
      ctx.lineTo(padL, y);
      ctx.stroke();
      ctx.fillText(p.toFixed(2), padL - 5, y);
    }

    // ±5 п.п. tolerance band вокруг true win rate
    const tolerance = 0.05;
    const trueY = yScale(params.trueWinRateB);
    ctx.fillStyle = green + '18';
    ctx.fillRect(padL, yScale(params.trueWinRateB + tolerance),
                 plotW,
                 yScale(params.trueWinRateB - tolerance) - yScale(params.trueWinRateB + tolerance));

    // True win rate line (горизонтальная, зелёная)
    ctx.strokeStyle = green;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(padL, trueY);
    ctx.lineTo(padL + plotW, trueY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Бары
    const isMirror = params.strategy === 'mirror_both';
    const numBars = isMirror ? 3 : 2;  // true, estimated, [tie]
    const barArea = plotW * 0.7;
    const barW = barArea / numBars;
    const barSpacing = plotW * 0.3 / (numBars + 1);

    const bars = [
      { label: 'True B',     value: params.trueWinRateB, color: green },
      { label: 'Est. B',     value: result.winRateB,     color: accent },
    ];
    if (isMirror) {
      bars.push({ label: 'Tie',
                  value: result.tieRateRaw !== undefined
                           ? result.tieRateRaw : result.tieRate,
                  color: muted });
    }

    bars.forEach((bar, idx) => {
      const x = padL + barSpacing * (idx + 1) + barW * idx;
      const barH = (bar.value) * plotH;
      const y = padT + plotH - barH;

      ctx.fillStyle = bar.color + 'cc';
      ctx.fillRect(x, y, barW - 2, barH);

      // Значение поверх бара
      ctx.fillStyle = text;
      ctx.font = '11px var(--mono), monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText((bar.value * 100).toFixed(1) + '%', x + barW / 2 - 1, y - 2);

      // Подпись бара
      ctx.fillStyle = muted;
      ctx.font = '10px var(--sans), sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(bar.label, x + barW / 2 - 1, padT + plotH + 4);
    });

    // CI для estimated (если не mirror — tie rate 0)
    if (result.ci) {
      const ciX = padL + barSpacing * 2 + barW * 1 + barW / 2 - 1;
      const ciY1 = yScale(result.ci[1]);
      const ciY2 = yScale(result.ci[0]);
      ctx.strokeStyle = text;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ciX, ciY1);
      ctx.lineTo(ciX, ciY2);
      ctx.stroke();
      // Усики
      ctx.beginPath();
      ctx.moveTo(ciX - 3, ciY1);
      ctx.lineTo(ciX + 3, ciY1);
      ctx.moveTo(ciX - 3, ciY2);
      ctx.lineTo(ciX + 3, ciY2);
      ctx.stroke();
    }
  },

  // ── STRATEGY COMPARISON CHART ────────────────────────────────
  // 4 бара (по одному на стратегию), горизонтальная линия = true win rate.
  drawStrategyChart: function(canvas, allResults, trueWinRateB) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const accent  = Charts.getCssVar('--accent', '#3b82f6');
    const muted   = Charts.getCssVar('--muted', '#94a3b8');
    const text    = Charts.getCssVar('--text', '#1e293b');
    const green   = '#16a34a';

    const padL = 40, padR = 20, padT = 20, padB = 42;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

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
    for (let p = 0; p <= 1.0001; p += 0.25) {
      const y = yScale(p);
      ctx.beginPath();
      ctx.moveTo(padL - 3, y);
      ctx.lineTo(padL, y);
      ctx.stroke();
      ctx.fillText(p.toFixed(2), padL - 5, y);
    }

    // True win rate line
    ctx.strokeStyle = green;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(padL, yScale(trueWinRateB));
    ctx.lineTo(padL + plotW, yScale(trueWinRateB));
    ctx.stroke();
    ctx.setLineDash([]);

    // 4 стратегии
    const strategies = [
      { key: 'always_A_first', label: 'A first',  color: '#ef4444' },
      { key: 'always_B_first', label: 'B first',  color: '#f97316' },
      { key: 'random_order',   label: 'Random',   color: muted     },
      { key: 'mirror_both',    label: 'Mirror',   color: accent    },
    ];

    const barW = plotW / (strategies.length * 2 + 1);
    const gap = barW;

    strategies.forEach((s, idx) => {
      const res = allResults[s.key];
      const x = padL + gap + idx * (barW + gap);
      const val = res.winRateB;
      const barH = val * plotH;
      const y = padT + plotH - barH;

      ctx.fillStyle = s.color + 'cc';
      ctx.fillRect(x, y, barW, barH);

      // Значение
      ctx.fillStyle = text;
      ctx.font = '10px var(--mono), monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText((val * 100).toFixed(1) + '%', x + barW / 2, y - 2);

      // Подпись в две строки
      ctx.fillStyle = s.key === 'mirror_both' ? accent : muted;
      ctx.font = (s.key === 'mirror_both' ? '700 ' : '') + '10px var(--sans), sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(s.label, x + barW / 2, padT + plotH + 5);
    });

    // True win rate label
    ctx.fillStyle = green;
    ctx.font = '10px var(--sans), sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('true: ' + (trueWinRateB * 100).toFixed(0) + '%',
                 padL + plotW - 60, yScale(trueWinRateB) - 2);
  }
};
