/* Фильтры улучшают статический каталог: без JavaScript видны все материалы. */
(() => {
  const grid = document.querySelector('#catalog-grid');
  if (!grid) return;
  const search = document.querySelector('#catalog-query');
  const buttons = [...document.querySelectorAll('[data-topic-filter]')];
  const items = [...grid.querySelectorAll('.dv-catalog-item')];
  const empty = document.querySelector('#catalog-empty');
  let topic = 'all';

  function readAddress() {
    const params = new URLSearchParams(location.search);
    const requested = params.get('topic') || 'all';
    topic = buttons.some(b => b.dataset.topicFilter === requested) ? requested : 'all';
    search.value = params.get('q') || '';
  }

  function update(writeAddress = true) {
    const query = search.value.toLocaleLowerCase('ru').trim();
    let visible = 0;
    items.forEach(item => {
      item.hidden = !((topic === 'all' || item.dataset.topic === topic)
        && item.textContent.toLocaleLowerCase('ru').includes(query));
      if (!item.hidden) visible++;
    });
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.topicFilter === topic)));
    empty.hidden = visible > 0;
    if (writeAddress) {
      const params = new URLSearchParams(location.search);
      topic === 'all' ? params.delete('topic') : params.set('topic', topic);
      query ? params.set('q', search.value) : params.delete('q');
      const suffix = params.toString();
      history.replaceState(null, '', location.pathname + (suffix ? '?' + suffix : '') + location.hash);
    }
  }

  buttons.forEach(button => button.addEventListener('click', () => {
    topic = button.dataset.topicFilter;
    update();
  }));
  search.addEventListener('input', () => update());
  addEventListener('popstate', () => { readAddress(); update(false); });
  addEventListener('pageshow', () => { readAddress(); update(false); });
  readAddress();
  update(false);
})();
