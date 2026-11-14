(() => {
  const select = document.querySelector('#sasha-plan');
  const result = document.querySelector('#sasha-plan-result');
  const format = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
  const load = async (name) => {
    const response = await fetch('/ai-first/workshop/data/july/' + name + '.json');
    if (!response.ok) throw new Error('Данные не загрузились');
    return response.json();
  };

  async function start() {
    const [actual, planA, planB] = await Promise.all(['actual', 'plan-A', 'plan-B'].map(load));
    const plans = { A: planA, B: planB };
    const facts = new Map(actual.rows.map(row => [row.store_id, Number(row.net)]));

    function compare() {
      const plan = plans[select.value];
      const comparison = plan.rows.map(row => ({
        store: row.store_id,
        fact: facts.get(row.store_id),
        plan: Number(row.net),
        difference: facts.get(row.store_id) - Number(row.net)
      }));
      const [first] = comparison.sort((a, b) => a.difference - b.difference);
      result.textContent = 'Магазин №' + first.store + '. Отклонение от плана ' + select.value +
        ': ' + format.format(first.difference) + '. Чистая выручка: ' + format.format(first.fact) +
        ' по факту при плане ' + format.format(first.plan) + '.';
    }

    select.addEventListener('change', compare);
    compare();
  }

  start().catch(() => {
    select.disabled = true;
    result.textContent = 'Не удалось загрузить данные для сравнения. Откройте исходники по ссылкам ниже.';
  });
})();
