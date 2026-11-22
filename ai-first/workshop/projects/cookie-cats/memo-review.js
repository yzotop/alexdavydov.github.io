for (const form of document.querySelectorAll('.memo-review')) {
  const status = form.querySelector('[role=status]');
  const comment = form.querySelector('textarea');
  const key = 'cookie-cats:2026-11-22:v1:' + form.id;
  const labels = {accept: 'Вы приняли записку.', revise: 'Вы вернули записку на доработку.'};
  function show(record) {
    status.textContent = labels[record.action] + (record.comment ? ' Ваш комментарий — ' + record.comment : '');
  }
  try {
    const previous = JSON.parse(localStorage.getItem(key));
    if (previous && Object.hasOwn(labels, previous.action) && typeof previous.comment === 'string') {
      comment.value = previous.comment;
      show(previous);
    }
  } catch {}
  form.addEventListener('submit', event => {
    event.preventDefault();
    const action = event.submitter?.value;
    if (!Object.hasOwn(labels, action)) return;
    const record = {action, comment: comment.value.trim()};
    if (action === 'revise' && !record.comment) {
      status.textContent = 'Напишите, что агенту нужно проверить или изменить.';
      comment.focus();
      return;
    }
    show(record);
    try { localStorage.setItem(key, JSON.stringify(record)); }
    catch { status.textContent += ' Решение доступно до закрытия страницы.'; }
  });
}
