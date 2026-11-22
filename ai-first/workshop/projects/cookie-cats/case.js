const buttons = document.querySelectorAll('.choices button');
const comparisons = {
  keep: 'Вы предлагаете закрыть вопрос о переносе. Если цель — недельное удержание, цифры говорят в пользу 30-го уровня. Агент оставил бы его в игре, но перед окончательным отказом проверил бы, как сформировали группы и чего команда ждала от релиза.',
  request: 'Отложить решение обоснованно. Агент тоже запросил бы цель релиза и план распределения. Пока команда их уточняет, он предлагает сохранить действующую версию с барьером на 30-м уровне.'
};
for (const button of buttons) {
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => {
    for (const other of buttons) other.setAttribute('aria-pressed', String(other === button));
    document.querySelector('#chosen').textContent = 'Ваш выбор — «' + button.textContent + '».';
    document.querySelector('#comparison').textContent = comparisons[button.value];
    document.querySelector('#review').hidden = false;
    document.querySelector('#result-title').focus();
  });
}
