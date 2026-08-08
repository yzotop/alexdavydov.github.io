/* ui.js — крутилки, отрисовка графиков, метрики */

(() => {
  'use strict';

  const U = window.Utils;
  if (!U) throw new Error('utils.js must load before ui.js');

  // Цвета берём из тех же CSS-переменных, что и вёрстка: перекрашивать
  // скин в одном месте, а не по двум системам сразу.
  function theme() {
    const cs = getComputedStyle(document.documentElement);
    const v = (name, fallback) => (cs.getPropertyValue(name) || fallback).trim();
    return {
      accent: v('--accent', '#60a5fa'),
      text: v('--text', 'rgba(255,255,255,0.92)'),
      muted: v('--muted', 'rgba(255,255,255,0.70)'),
      muted2: v('--muted2', 'rgba(255,255,255,0.55)'),
      grid: v('--grid', 'rgba(255,255,255,0.08)'),
      axis: v('--axis', 'rgba(255,255,255,0.22)'),
      mono: v('--mono', 'ui-monospace, monospace'),
      bar: 'rgba(148, 163, 184, 0.55)',
    };
  }

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const [k, val] of Object.entries(attrs)) {
        if (k === 'text') e.textContent = val;
        else if (k === 'class') e.className = val;
        else e.setAttribute(k, val);
      }
    }
    if (children) for (const c of children) e.appendChild(c);
    return e;
  }

  /* ── Контролы ───────────────────────────────────────────────────────── */

  const CONTROLS = [
    {
      key: 'pd', min: 0, max: 100, step: 1, def: 80,
      label: 'Вероятность заказать напиток',
      fmt: (v) => `${v}%`,
      toParam: (v) => v / 100,
      hint: 'Возьмёт ли гость кофе или чай к еде. Самая маржинальная часть чека.',
    },
    {
      key: 'q', min: 0, max: 100, step: 1, def: 25,
      label: 'Attach-rate добавок',
      fmt: (v) => `${v}%`,
      toParam: (v) => v / 100,
      hint: 'Как часто цепляется каждая доступная платная добавка: бекон, лосось, авокадо.',
    },
    {
      key: 'r', min: 40, max: 100, step: 1, def: 75,
      label: 'Затухание внимания по листам',
      fmt: (v) => (v / 100).toFixed(2),
      toParam: (v) => v / 100,
      hint: '0.40 — задние листы почти не читают. 1.00 — все восемь листов смотрят одинаково.',
    },
  ];

  const MARGIN_CONTROLS = [
    {
      key: 'fc', min: 15, max: 60, step: 1, def: 35,
      label: 'Food-cost еды',
      fmt: (v) => `${v}%`,
      toParam: (v) => v / 100,
    },
    {
      key: 'dc', min: 8, max: 45, step: 1, def: 18,
      label: 'Food-cost напитков',
      fmt: (v) => `${v}%`,
      toParam: (v) => v / 100,
    },
  ];

  function createSlider(spec, state, onChange) {
    const value = el('div', { class: 'field__value' });
    const row = el('div', { class: 'field__row' }, [
      el('div', { class: 'field__label', text: spec.label }),
      value,
    ]);
    const input = el('input', {
      type: 'range', min: spec.min, max: spec.max, step: spec.step, value: state[spec.key],
    });

    const paint = () => { value.textContent = spec.fmt(Number(input.value)); };
    input.addEventListener('input', () => {
      state[spec.key] = Number(input.value);
      paint();
      onChange();
    });
    paint();

    const wrap = el('div', { class: 'field' }, [row, input]);
    if (spec.hint) wrap.appendChild(el('div', { class: 'field__hint', text: spec.hint }));
    return { wrap, input, paint };
  }

  function createToggle(spec, state, onChange) {
    const input = el('input', { type: 'checkbox' });
    input.checked = !!state[spec.key];
    input.addEventListener('change', () => {
      state[spec.key] = input.checked;
      onChange();
    });
    const label = el('label', { class: 'toggle' }, [input, el('span', { text: spec.label })]);
    const wrap = el('div', { class: 'field' }, [label]);
    if (spec.hint) wrap.appendChild(el('div', { class: 'field__hint', text: spec.hint }));
    return { wrap, input };
  }

  /* ── Гистограмма ────────────────────────────────────────────────────── */

  // Бины по 100 ₽. На 150 ₽ горбик заказов из одной позиции сливается со
  // склоном: провал между ним и главной модой всего 7% высоты. На 100 ₽
  // провал 44% и виден, на 75 ₽ уже лезет гребёнка от дискретной сетки цен.
  //
  // Шкала обрывается на 1500 ₽, всё что выше — в накопительный бин «1500+».
  // При p90 ≈ 1000 честная шкала до 2100 оставляла 40% полотна пустым, а
  // хвост при этом не прячется: он виден отдельным столбиком с явной
  // подписью. Это не то же самое, что неравномерные бины втихую — читатель
  // видит, что последний столбик считает «и всё остальное».
  const HIST_BIN_W = 100;
  const HIST_MAX = 1500;
  const HIST_BINS = HIST_MAX / HIST_BIN_W + 1; // 15 обычных + накопительный

  function drawHistogram(canvas, checks, mean, t) {
    const { cssW: W, cssH: H, dpr } = U.resizeCanvas(canvas);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    const padB = 22;
    const padT = 16;
    const plotH = H - padB - padT;
    if (plotH <= 0 || W <= 0) return;

    const counts = new Array(HIST_BINS).fill(0);
    for (let i = 0; i < checks.length; i++) {
      counts[Math.min(HIST_BINS - 1, Math.floor(checks[i] / HIST_BIN_W))]++;
    }
    const maxCount = Math.max(1, ...counts);
    const slot = W / HIST_BINS;
    const gap = Math.min(2, slot * 0.16);
    // Регулярная часть шкалы — всё, кроме накопительного столбика справа.
    // Линию среднего позиционируем по ней, иначе overflow-бин сдвинул бы её.
    const scaleW = slot * (HIST_BINS - 1);

    for (let i = 0; i < HIST_BINS; i++) {
      const h = (counts[i] / maxCount) * plotH;
      if (h <= 0) continue;
      // накопительный столбик приглушаем: он про «и всё остальное»,
      // а не про очередной интервал в 100 ₽
      ctx.fillStyle = i === HIST_BINS - 1 ? t.grid : t.bar;
      ctx.fillRect(i * slot + gap / 2, padT + plotH - h, Math.max(1, slot - gap), h);
    }

    // ось
    ctx.strokeStyle = t.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, padT + plotH + 0.5);
    ctx.lineTo(W, padT + plotH + 0.5);
    ctx.stroke();

    // линия среднего
    const mx = (mean / HIST_MAX) * scaleW;
    if (mx > 0 && mx < W) {
      ctx.strokeStyle = t.accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mx, padT - 8);
      ctx.lineTo(mx, padT + plotH);
      ctx.stroke();

      ctx.font = `11px ${t.mono}`;
      ctx.fillStyle = t.accent;
      const label = `среднее ${Math.round(mean)} ₽`;
      const tw = ctx.measureText(label).width;
      // у правого края подпись уводим влево, иначе обрежется рамкой карточки
      ctx.textAlign = mx + 6 + tw > W ? 'right' : 'left';
      ctx.fillText(label, ctx.textAlign === 'right' ? mx - 6 : mx + 6, padT - 1);
    }

    // подписи оси
    ctx.font = `10px ${t.mono}`;
    ctx.fillStyle = t.muted2;
    ctx.textAlign = 'left';
    ctx.fillText('0', 0, H - 6);
    ctx.textAlign = 'center';
    ctx.fillText('500 ₽', scaleW * (500 / HIST_MAX), H - 6);
    ctx.fillText('1000 ₽', scaleW * (1000 / HIST_MAX), H - 6);
    ctx.textAlign = 'right';
    ctx.fillText(`${HIST_MAX}+ ₽`, W, H - 6);
  }

  /* ── Бар рычагов ────────────────────────────────────────────────────── */

  function drawLevers(canvas, levers, t) {
    const { cssW: W, cssH: H, dpr } = U.resizeCanvas(canvas);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    if (W <= 0 || H <= 0) return;

    const labelW = Math.min(140, W * 0.38);
    const valueW = 58;
    const trackX = labelW + 10;
    const trackW = Math.max(10, W - trackX - valueW);
    const rowH = H / levers.length;
    const barH = Math.min(26, rowH * 0.55);

    const maxV = Math.max(1, ...levers.map((l) => Math.abs(l.value)));

    levers.forEach((l, i) => {
      const cy = i * rowH + rowH / 2;
      const w = (Math.max(0, l.value) / maxV) * trackW;

      ctx.fillStyle = i === 0 ? t.accent : t.bar;
      ctx.fillRect(trackX, cy - barH / 2, w, barH);

      ctx.font = `12px ${t.mono}`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = t.text;
      ctx.fillText(l.label, labelW, cy);

      ctx.textAlign = 'left';
      ctx.fillStyle = i === 0 ? t.accent : t.muted;
      ctx.fillText(`+${Math.round(l.value)} ₽`, trackX + w + 8, cy);
    });
    ctx.textBaseline = 'alphabetic';
  }

  /* ── Сборка ─────────────────────────────────────────────────────────── */

  function createUI({ sim, elements }) {
    const state = {};
    for (const s of CONTROLS.concat(MARGIN_CONTROLS)) state[s.key] = s.def;
    state.ep = false;

    const sliders = [];
    let dirty = false;

    function params() {
      const p = { ep: state.ep };
      for (const s of CONTROLS.concat(MARGIN_CONTROLS)) p[s.key] = s.toParam(state[s.key]);
      return p;
    }

    // Крутилки не пересчитывают модель на лету: 20 000 заказов × 7 сценариев
    // на каждое движение ползунка — это лаг. Помечаем результат устаревшим
    // и ждём Run. Батч, не поток.
    function markDirty() {
      dirty = true;
      elements.statusBadge.textContent = 'Крутилки изменены';
      elements.statusBadge.className = 'badge badge--warn';
    }

    const toggleSpec = {
      key: 'ep',
      label: 'Расширить апселл на топ-12 блюд',
      hint: 'Что если добавки повесить не на два блюда, а на двенадцать самых дорогих? Гипотетический ход, в меню его нет.',
    };

    for (const spec of CONTROLS) {
      const s = createSlider(spec, state, markDirty);
      elements.controlsBehavior.appendChild(s.wrap);
      sliders.push({ spec, ...s });
    }
    elements.controlsBehavior.appendChild(createToggle(toggleSpec, state, markDirty).wrap);

    elements.controlsMargin.appendChild(el('div', {
      class: 'field__note',
      text: 'Себестоимости в данных нет. Эти два ползунка — твои допущения, не мои данные: вся маржа справа считается по ним.',
    }));
    for (const spec of MARGIN_CONTROLS) {
      const s = createSlider(spec, state, markDirty);
      elements.controlsMargin.appendChild(s.wrap);
      sliders.push({ spec, ...s });
    }

    let last = null;

    function render() {
      if (!last) return;
      const t = theme();
      drawHistogram(elements.chartHist, last.dist.checks, last.dist.mean, t);
      drawLevers(elements.chartLevers, last.levers, t);
    }

    function run() {
      const res = sim.run(params());
      last = res;
      const d = res.dist;

      elements.hMean.textContent = U.fmtInt(d.mean);
      elements.hSub.textContent = `медиана ${U.fmtInt(d.median)} ₽ · p90 ${U.fmtInt(d.p90)} ₽`;
      elements.mMean.textContent = U.fmtRub(d.mean);
      elements.mMedian.textContent = U.fmtRub(d.median);
      elements.mP90.textContent = U.fmtRub(d.p90);
      elements.mGross.textContent = U.fmtRub(d.gm);
      elements.mGrossPct.textContent = U.fmtPct(d.gmp);
      elements.runInfo.textContent =
        `${res.orders.toLocaleString('ru-RU')} заказов · ${d.n.toLocaleString('ru-RU')} непустых · ${Math.round(res.ms)} мс`;

      dirty = false;
      elements.statusBadge.textContent = 'Готово';
      elements.statusBadge.className = 'badge badge--ok';
      render();
    }

    function reset() {
      for (const s of sliders) {
        state[s.spec.key] = s.spec.def;
        s.input.value = String(s.spec.def);
        s.paint();
      }
      state.ep = false;
      const cb = elements.controlsBehavior.querySelector('input[type="checkbox"]');
      if (cb) cb.checked = false;
      sim.reset();
      run();
    }

    // Сид: меняем — перетряхиваем матрицу случайных чисел и считаем заново,
    // чтобы «Готово» на экране всегда соответствовало полю Seed.
    function applySeed(value) {
      const s = U.clamp(Math.trunc(Number(value) || 1), 1, 999999999);
      elements.seedInput.value = String(s);
      sim.setSeed(s);
      run();
    }

    elements.seedInput.value = String(sim.seed);
    elements.seedInput.addEventListener('change', () => applySeed(elements.seedInput.value));
    elements.randomizeSeedBtn.addEventListener('click', () => {
      applySeed(Math.floor(Math.random() * 999999999) + 1);
    });
    elements.runBtn.addEventListener('click', run);
    elements.resetBtn.addEventListener('click', reset);

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(render, 120);
    });

    return { run, reset, isDirty: () => dirty };
  }

  window.UI = { createUI };
})();
