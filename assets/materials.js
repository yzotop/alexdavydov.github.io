/* Без JavaScript тематические полки открываются штатными средствами браузера. */
(() => {
  const search = document.querySelector('#catalog-query');
  const topic = document.querySelector('#catalog-topic');
  const shelves = [...document.querySelectorAll('[data-catalog-topic]')];
  const empty = document.querySelector('#catalog-empty');
  const manuallyOpened = new Set();

  function readAddress() {
    const params = new URLSearchParams(location.search);
    topic.value = params.get('topic') || 'all';
    if (!topic.value) topic.value = 'all';
    search.value = params.get('q') || '';
  }

  function update(writeAddress = true) {
    const query = search.value.toLocaleLowerCase('ru').trim();
    const filtering = Boolean(query || topic.value !== 'all');
    topic.closest('label').hidden = !filtering;
    let visible = 0;
    for (const shelf of shelves) {
      const inTopic = topic.value === 'all' || shelf.dataset.catalogTopic === topic.value;
      let matches = 0;
      for (const item of shelf.querySelectorAll('.dv-catalog-item')) {
        item.hidden = !inTopic || !item.textContent.toLocaleLowerCase('ru').includes(query);
        if (!item.hidden) matches++;
      }
      visible += matches;
      shelf.hidden = !matches;
      shelf.open = filtering ? Boolean(matches) : manuallyOpened.has(shelf.id);
    }
    empty.hidden = visible > 0;
    if (writeAddress && location.protocol !== 'file:') {
      const url = new URL(location.href);
      topic.value === 'all' ? url.searchParams.delete('topic') : url.searchParams.set('topic', topic.value);
      query ? url.searchParams.set('q', search.value) : url.searchParams.delete('q');
      history.replaceState(null, '', url);
    }
  }

  for (const shelf of shelves) {
    shelf.addEventListener('toggle', () => {
      if (search.value.trim() || topic.value !== 'all') return;
      if (shelf.open) manuallyOpened.add(shelf.id);
      else manuallyOpened.delete(shelf.id);
    });
  }
  function restore() {
    readAddress();
    const anchored = document.getElementById(location.hash.slice(1));
    if (anchored?.matches('.material-shelf')) manuallyOpened.add(anchored.id);
    update(false);
  }
  search.addEventListener('input', () => update());
  topic.addEventListener('change', () => update());
  addEventListener('popstate', restore);
  addEventListener('pageshow', restore);
  document.querySelector('.catalog-lookup').hidden = false;
  restore();
})();
