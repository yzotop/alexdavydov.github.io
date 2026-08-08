/* sim.js — модель среднего чека. Батч Monte Carlo, без внутреннего времени.
 *
 * Заказ собирается как «одно блюдо + напиток + добавки»:
 *   — блюдо берётся с вероятностью PF_FOOD, напиток — с вероятностью pd;
 *   — что именно выбрано, решает внимание: вес позиции = r^(лист-1) · 0.85^(позиция-1);
 *   — каждая доступная платная добавка цепляется независимо с вероятностью q.
 * Пустой заказ (не выпало ни блюда, ни напитка) в чеки не попадает.
 *
 * Это модель на ЗАЯВЛЕННОМ спросе: веса реконструированы из раскладки меню,
 * а не измерены по чекам. Себестоимости в данных нет — food-cost задаёт
 * пользователь двумя ползунками.
 */

(() => {
  'use strict';

  const U = window.Utils;
  if (!U) throw new Error('utils.js must load before sim.js');

  const N_ORDERS = 20000;

  // Вероятность, что гость вообще возьмёт еду. Константа, в крутилки не
  // выведена: кейс исследует напиток и апселл, а не «пришёл ли поесть».
  const PF_FOOD = 0.9;

  // Затухание внимания вниз по разделу. Отдельной крутилкой не выведено —
  // в кейсе показано, что позиция внутри раздела с ценой не коррелирует
  // (r = −0.05), то есть этот рычаг заведение и так не использует.
  const POS_DECAY = 0.85;

  // Гипотетический набор добавок, который вешается на топ-блюда при
  // включённом «расширить апселл»: корнишоны / бекон / авокадо.
  const EXTRA_ADDONS = [99, 155, 212];
  const EXTEND_TOP_N = 12;

  // Ширина строки матрицы случайных чисел: еда, выбор еды, напиток,
  // выбор напитка + по одному числу на каждую возможную добавку.
  // Девять — максимум по меню («Яичница / омлет»), расширенный апселл
  // добавляет только три, так что запас не нужен.
  const MAX_ADDONS = 9;
  const STRIDE = 4 + MAX_ADDONS;

  function normalizedWeights(items, r) {
    const w = new Float64Array(items.length);
    let sum = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const x = Math.pow(r, it.page - 1) * Math.pow(POS_DECAY, it.spos - 1);
      w[i] = x;
      sum += x;
    }
    if (sum > 0) for (let i = 0; i < w.length; i++) w[i] /= sum;
    return w;
  }

  // Розыгрыш по кумулятивным весам заранее вытянутым числом u.
  function pickBy(items, weights, u) {
    let c = 0;
    for (let i = 0; i < items.length; i++) {
      c += weights[i];
      if (u <= c) return items[i];
    }
    return items[items.length - 1];
  }

  class Sim {
    constructor(menu, seed) {
      this.menu = menu;
      this.foods = menu.filter((i) => i.food);
      this.drinks = menu.filter((i) => !i.food);

      // Топ-N еды по цене, у которой добавок нет: именно на них вешается
      // гипотетический апселл. Множество от параметров не зависит —
      // считаем один раз.
      this.extendSet = new Set(
        this.foods
          .filter((i) => i.addons.length === 0)
          .sort((a, b) => b.price - a.price)
          .slice(0, EXTEND_TOP_N)
          .map((i) => i.name)
      );

      this.seed = (seed >>> 0) || 1;
      this.draws = null;
      this.reset();
    }

    setSeed(seed) {
      this.seed = (seed >>> 0) || 1;
      this.reset();
    }

    /* Предрозыгрыш общей матрицы случайных чисел (common random numbers).
     *
     * Зачем не тянуть числа по ходу: у рычага сравниваются два сценария, и
     * если каждый тянет из общего последовательного потока, то стоит ветвлению
     * измениться — потоки расходятся, и разница двух прогонов наполовину шум.
     * Одного сида для этого мало: он делает воспроизводимым прогон, но не
     * сравнение. Здесь каждое решение получает своё число по фиксированному
     * смещению, одинаковое во всех сценариях. Разброс рычага между сидами
     * падает примерно с 6 ₽ до 1.5 ₽.
     */
    reset() {
      const rng = new U.RNG(this.seed);
      const d = new Float64Array(N_ORDERS * STRIDE);
      for (let i = 0; i < d.length; i++) d[i] = rng.float();
      this.draws = d;
    }

    /* Один прогон. collect=false считает только среднее — для рычагов
     * распределение не нужно, а сортировка 20k чисел шесть лишних раз
     * заметна на глаз. */
    _simulate(p, collect) {
      const { foods, drinks, draws } = this;
      const wf = normalizedWeights(foods, p.r);
      const wd = normalizedWeights(drinks, p.r);
      const extend = p.ep ? this.extendSet : null;

      const checks = collect ? new Float64Array(N_ORDERS) : null;
      let n = 0;
      let revenue = 0;
      let cost = 0;

      for (let k = 0; k < N_ORDERS; k++) {
        const o = k * STRIDE;
        let total = 0;
        let c = 0;

        if (draws[o] < PF_FOOD) {
          const item = pickBy(foods, wf, draws[o + 1]);
          total += item.price;
          c += item.price * p.fc;

          let addons = item.addons;
          if (addons.length === 0 && extend && extend.has(item.name)) {
            addons = EXTRA_ADDONS;
          }
          for (let j = 0; j < addons.length; j++) {
            if (draws[o + 4 + j] < p.q) {
              total += addons[j];
              c += addons[j] * p.fc;
            }
          }
        }

        if (draws[o + 2] < p.pd) {
          const item = pickBy(drinks, wd, draws[o + 3]);
          total += item.price;
          c += item.price * p.dc;
        }

        if (total > 0) {
          if (collect) checks[n] = total;
          n++;
          revenue += total;
          cost += c;
        }
      }

      if (n === 0) {
        return { mean: 0, median: 0, p90: 0, gm: 0, gmp: 0, n: 0, checks: [] };
      }

      const mean = revenue / n;
      if (!collect) return { mean, n };

      const sorted = checks.subarray(0, n).slice().sort();
      return {
        mean,
        median: sorted[Math.floor(n / 2)],
        p90: sorted[Math.floor(n * 0.9)],
        gm: (revenue - cost) / n,
        gmp: (revenue - cost) / revenue,
        n,
        checks: sorted,
      };
    }

    /* Рычаги. Определение единое для кейса и симулятора: полный размах
     * контрола, от минимума до максимума, при остальных крутилках на месте.
     * Это НЕ запас роста от текущей точки — там, где крутилка уже почти
     * на максимуме, запас мал, а цена вопроса у рычага та же. */
    _levers(p) {
      const swing = (lo, hi) => this._simulate({ ...p, ...hi }, false).mean
                              - this._simulate({ ...p, ...lo }, false).mean;
      return [
        { key: 'drink',  label: 'Заказ напитка',  value: swing({ pd: 0 }, { pd: 1 }) },
        { key: 'attach', label: 'Attach добавок', value: swing({ q: 0 }, { q: 1 }) },
        { key: 'width',  label: 'Ширина апселла', value: swing({ ep: false }, { ep: true }) },
      ];
    }

    run(params) {
      const t0 = (typeof performance !== 'undefined' && performance.now)
        ? performance.now() : Date.now();
      const dist = this._simulate(params, true);
      const levers = this._levers(params);
      const t1 = (typeof performance !== 'undefined' && performance.now)
        ? performance.now() : Date.now();
      return { dist, levers, orders: N_ORDERS, ms: t1 - t0 };
    }
  }

  window.Sim = {
    createSim: (menu, seed) => new Sim(menu, seed),
    N_ORDERS,
    PF_FOOD,
  };
})();
