const items = [
  {
    "sku": "15036",
    "name": "Шёлковый веер",
    "need": 1817,
    "cost": 450
  },
  {
    "sku": "17003",
    "name": "Кошелёк из парчи",
    "need": 1144,
    "cost": 126
  },
  {
    "sku": "20725",
    "name": "Сумка для обеда в горох",
    "need": 496,
    "cost": 990
  },
  {
    "sku": "21212",
    "name": "Формочки Retro Spot, 72 шт.",
    "need": 482,
    "cost": 330
  },
  {
    "sku": "21213",
    "name": "Формочки Skull, 72 шт.",
    "need": 152,
    "cost": 330
  },
  {
    "sku": "21232",
    "name": "Керамическая шкатулка",
    "need": 214,
    "cost": 750
  },
  {
    "sku": "21977",
    "name": "Формочки Pink Paisley, 60 шт.",
    "need": 404,
    "cost": 330
  },
  {
    "sku": "21980",
    "name": "Салфетки Red Spotty",
    "need": 123,
    "cost": 174
  },
  {
    "sku": "21981",
    "name": "Салфетки Woodland",
    "need": 51,
    "cost": 174
  },
  {
    "sku": "21982",
    "name": "Салфетки Suki",
    "need": 0,
    "cost": 174
  },
  {
    "sku": "21984",
    "name": "Салфетки Pink Paisley",
    "need": 0,
    "cost": 174
  },
  {
    "sku": "21985",
    "name": "Салфетки Hearts",
    "need": 0,
    "cost": 174
  },
  {
    "sku": "22178",
    "name": "Стеклянный подсвечник",
    "need": 1089,
    "cost": 750
  },
  {
    "sku": "22197",
    "name": "Стакан для попкорна",
    "need": 1270,
    "cost": 510
  },
  {
    "sku": "22386",
    "name": "Большая розовая сумка в горох",
    "need": 507,
    "cost": 1170
  },
  {
    "sku": "71459",
    "name": "Подсвечник в банке",
    "need": 127,
    "cost": 510
  },
  {
    "sku": "84077",
    "name": "Игрушечный планер",
    "need": 2948,
    "cost": 126
  },
  {
    "sku": "84270",
    "name": "Кольцо Bubble Gum",
    "need": 0,
    "cost": 126
  },
  {
    "sku": "84347",
    "name": "Вращающийся подсвечник",
    "need": 0,
    "cost": 1530
  },
  {
    "sku": "84568",
    "name": "Нашивки с буквами, для девочек",
    "need": 1123,
    "cost": 258
  },
  {
    "sku": "84598",
    "name": "Нашивки с буквами, для мальчиков",
    "need": 188,
    "cost": 258
  },
  {
    "sku": "84755",
    "name": "Подвесной стеклянный подсвечник",
    "need": 171,
    "cost": 390
  },
  {
    "sku": "84879",
    "name": "Декоративная птица",
    "need": 533,
    "cost": 1014
  },
  {
    "sku": "84946",
    "name": "Подсвечник под старину",
    "need": 119,
    "cost": 750
  },
  {
    "sku": "84991",
    "name": "Формочки Teatime, 60 шт.",
    "need": 636,
    "cost": 330
  },
  {
    "sku": "84992",
    "name": "Формочки Sweetheart, 72 шт.",
    "need": 199,
    "cost": 330
  },
  {
    "sku": "85099B",
    "name": "Большая красная сумка в горох",
    "need": 1244,
    "cost": 1170
  },
  {
    "sku": "85099C",
    "name": "Большая сумка Baroque",
    "need": 460,
    "cost": 1170
  },
  {
    "sku": "85099F",
    "name": "Большая сумка Strawberry",
    "need": 676,
    "cost": 1170
  },
  {
    "sku": "85123A",
    "name": "Подвесной подсвечник-сердце",
    "need": 691,
    "cost": 1770
  }
];
// Currency is stored in thousandths of a pound, including fractional unit costs in E1.
const required = items.reduce((sum, item) => sum + item.cost * item.need, 0);
function allocate(pence) {
  if (!Number.isSafeInteger(pence) || pence < 0 || pence > 100000000)
    throw new RangeError('Budget outside supported range');
  return allocateRatio(pence * 10, 1);
}

// CBR rate in force on 4 April 2011. 1 mGBP costs 455852 / 100000 kopecks.
const rubRate = 455852;
function toKopecks(mGBP) {
  return Math.round(mGBP * rubRate / 100000);
}
function allocateRub(kopecks) {
  if (!Number.isSafeInteger(kopecks) || kopecks < 0 || kopecks > 4558520000)
    throw new RangeError('Budget outside supported range');
  return allocateRatio(kopecks * 25000, rubRate / 4);
}
function allocateRatio(numerator, denominator, catalog = items, totalCost = required) {
  const budget = numerator / denominator;
  const total = BigInt(totalCost * denominator);
  const cap = BigInt(Math.min(numerator, Number(total)));
  const rows = catalog.map(item => {
    const share = BigInt(item.need) * cap;
    return { ...item, units: Number(share / total), remainder: Number(share % total) };
  });
  let spend = rows.reduce((sum, row) => sum + row.units * row.cost, 0);
  // The source is sorted by SKU. Stable sorting preserves this tie-break.
  for (const row of [...rows].sort((a, b) => b.remainder - a.remainder)) {
    if (row.units < row.need && (spend + row.cost) * denominator <= numerator) {
      row.units += 1;
      spend += row.cost;
    }
  }
  return {rows, spend, budget, required: totalCost, units: rows.reduce((n,r) => n+r.units,0),
    cutCount: rows.filter(r => r.units < r.need).length};
}
if (typeof module !== 'undefined') module.exports = {allocate, allocateRub, toKopecks, items, required, allocateRatio};
