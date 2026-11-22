// Chapter 5 starts with the manager's decision. Chapter 9 starts with an agent's memo.
const independentCall = new URLSearchParams(location.search).get('from') === 'choice';
if (independentCall) {
  const get = id => document.getElementById(id);
  const pickPlan = new Option('Выберите версию', '');
  pickPlan.disabled = true;
  get('plan').prepend(pickPlan);
  const review = get('review');
  const memo = get('memo');
  const savedMemo = memo.querySelector('details');
  savedMemo.querySelector('summary').textContent = 'Сравнить с исходной запиской агента';
  review.querySelector('h2').after(savedMemo);
  review.append(get('source-zip').closest('details'));
  memo.hidden = true;
  memo.querySelector('.extracts').remove();
  document.querySelector('[data-step="memo"]').remove();
  get('dataPane').querySelector('[data-view="memo"]').remove();
  document.querySelector('main .lead').textContent =
    'До планёрки есть время на один звонок. По итогам июля выберите магазин с наибольшим отставанием по чистой выручке в деньгах. С какого вопроса начнёте разговор?';
  get('dataPane').querySelector('h2 + p').textContent =
    'Проверьте, какой план утвердил владелец. Сравните факт с этим планом по всем магазинам.';
  const dailyIntro = get('group').closest('.filters').previousElementSibling;
  dailyIntro.textContent = 'Посмотрите, на какие товары и даты приходится отклонение продаж до возвратов.';
  const dailyPlan = document.createElement('span');
  dailyPlan.id = 'dailyPlan';
  dailyPlan.textContent = ' Дневная разбивка дана для плана A.';
  dailyIntro.append(dailyPlan);
  get('finding').parentElement.firstChild.textContent = 'Какой магазин выбрали и на каком расчёте основан выбор?';
  get('change').parentElement.firstChild.textContent = 'Что ещё нужно узнать, чтобы объяснить отставание?';
  get('question').parentElement.firstChild.textContent = 'С какого вопроса начнёте разговор с управляющим?';
}
