// Scenario prices in rubles per purchasing unit, reviewed on 2026-11-21.
// Source quantities are fixed by the April decision; only the purchase prices change.
const clientOrder = (() => {
  const source = typeof module === 'undefined' ? {items, allocateRatio} : require('./order.js');
  const priceList = [
    [125, 'шт.', ['15036']], [55, 'шт.', ['17003']], [135, 'шт.', ['20725']],
    [80, 'уп. 72 шт.', ['21212', '21213', '84992']], [65, 'уп. 60 шт.', ['21977', '84991']],
    [180, 'шт.', ['21232']], [18, 'уп. 12 шт.', ['21980', '21981', '21982', '21984', '21985']],
    [115, 'шт.', ['22178']], [25, 'шт.', ['22197']],
    [180, 'шт.', ['22386', '85099B', '85099C', '85099F']],
    [110, 'шт.', ['71459']], [35, 'шт.', ['84077']], [22, 'шт.', ['84270']],
    [270, 'шт.', ['84347']], [40, 'шт.', ['84568', '84598']], [105, 'шт.', ['84755']],
    [90, 'шт.', ['84879']], [125, 'шт.', ['84946']], [210, 'шт.', ['85123A']]
  ];
  const prices = new Map();
  for (const [rubles, unit, skus] of priceList) {
    for (const sku of skus) {
      if (prices.has(sku)) throw new Error('Repeated price for ' + sku);
      prices.set(sku, {cost: rubles * 100, unit});
    }
  }
  const catalog = source.items.map(({sku, name, need}) => {
    if (!prices.has(sku)) throw new Error('Missing purchase price for ' + sku);
    return {sku, name, need, ...prices.get(sku)};
  });
  const required = catalog.reduce((sum, row) => sum + row.cost * row.need, 0);
  const isBag = row => row.sku === '85099B' || row.sku === '22386';
  const bags = catalog.filter(isBag);
  const others = catalog.filter(row => !isBag(row));
  const bagCost = bags.reduce((sum, row) => sum + row.cost * row.need, 0);
  function allocate(kopecks, policy = 'proportional') {
    if (!Number.isSafeInteger(kopecks) || kopecks < 0 || kopecks > 4558520000)
      throw new RangeError('Budget outside supported range');
    if (policy === 'proportional') return source.allocateRatio(kopecks, 1, catalog, required);
    if (policy !== 'bags') throw new RangeError('Unknown purchase policy');
    const first = source.allocateRatio(Math.min(kopecks, bagCost), 1, bags, bagCost);
    const rest = source.allocateRatio(Math.max(0, kopecks - bagCost), 1, others, required - bagCost);
    const rows = [...first.rows, ...rest.rows].sort((a, b) => a.sku.localeCompare(b.sku));
    return {rows, budget: kopecks, required, spend: first.spend + rest.spend,
      units: first.units + rest.units, cutCount: first.cutCount + rest.cutCount};
  }
  function compare(kopecks) {
    const proportional = allocate(kopecks);
    const priority = allocate(kopecks, 'bags');
    const deltas = new Map();
    for (const [i, row] of priority.rows.entries()) {
      const change = row.units - proportional.rows[i].units;
      deltas.set(row.sku, {sku: row.sku, name: row.name, before: proportional.rows[i].units,
        after: row.units, change, money: change * row.cost});
    }
    const cuts = [...deltas.values()].filter(row => !isBag(row) && row.money < 0)
      .sort((a, b) => a.money - b.money || a.sku.localeCompare(b.sku));
    const bagGain = bags.reduce((sum, row) => sum + deltas.get(row.sku).money, 0);
    return {proportional, bags: priority, deltas, cuts, bagGain};
  }
  function tradeoff(comparison, policy) {
    const top = comparison.cuts[0];
    if (!top) {
      const changed = [...comparison.deltas.values()].some(r => r.change !== 0);
      return [changed ? 'С приоритетом изменяется количество сумок. По остальным позициям оба заказа совпали.'
                      : 'При этом бюджете количества по всем позициям совпадают.'];
    }
    const [from, to] = policy === 'bags' ? [top.before, top.after] : [top.after, top.before];
    const context = policy === 'bags' ? 'При переходе к сумкам' : 'При переходе от приоритета сумок к общему правилу';
    const amount = (-top.money / 100).toLocaleString('ru-RU');
    return [
      context + ' сильнее всего по сумме меняется товар «' + top.name + '». Заказ меняется с ' + from + ' до ' + to + ' ед., разница ' + amount + ' ₽.',
      context + ' наибольшая разница в расходах приходится на товар «' + top.name + '» (' + amount + ' ₽). Количество меняется с ' + from + ' до ' + to + ' ед.'
    ];
  }
  return {items: catalog, required, bagCost, allocate, compare, tradeoff};
})();
if (typeof module !== 'undefined') module.exports = clientOrder;
