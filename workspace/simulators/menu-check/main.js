/* main.js — bootstrap. Батч: считаем по Run, живого цикла нет. */

(() => {
  'use strict';

  const SimMod = window.Sim;
  const UIMod = window.UI;
  if (!SimMod || !UIMod) throw new Error('Dependencies missing: utils/sim/ui');

  const DEFAULT_SEED = 42;

  function init() {
    const menu = window.MENU_DATA;
    if (!Array.isArray(menu) || menu.length === 0) {
      throw new Error('data/menu.js не загружен: нет window.MENU_DATA. '
        + 'Собери его командой python3 build_data.py');
    }

    const ids = [
      'statusBadge', 'seedInput', 'randomizeSeedBtn', 'runBtn', 'resetBtn',
      'controlsBehavior', 'controlsMargin',
      'hMean', 'hSub', 'runInfo', 'chartHist', 'chartLevers',
      'mMean', 'mMedian', 'mP90', 'mGross', 'mGrossPct',
    ];
    const elements = {};
    for (const id of ids) {
      const node = document.getElementById(id);
      if (!node) throw new Error(`Missing required element: ${id}`);
      elements[id] = node;
    }

    const sim = SimMod.createSim(menu, DEFAULT_SEED);
    const ui = UIMod.createUI({ sim, elements });

    // Первый прогон сразу: пустой экран с кнопкой «Run» ничего не объясняет,
    // а посчитать 20 000 заказов дешевле, чем прочитать заголовок.
    ui.run();
  }

  window.addEventListener('DOMContentLoaded', () => {
    try {
      init();
    } catch (err) {
      const pre = document.createElement('pre');
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.padding = '16px';
      pre.style.margin = '16px';
      pre.style.borderRadius = '12px';
      pre.style.border = '1px solid rgba(251,113,133,0.6)';
      pre.style.background = 'rgba(251,113,133,0.12)';
      pre.style.color = '#fee2e2';
      pre.textContent = String(err && err.stack ? err.stack : err);
      document.body.appendChild(pre);
      throw err;
    }
  });
})();
