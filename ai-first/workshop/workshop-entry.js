(() => {
  const workshop = '/ai-first/workshop/';
  const practicum = workshop + 'practicum/';
  const july = practicum + 'july/';
  const routes = {
    colleague: july,
    'task-download': july + '#source-zip',
    'first-answer': july + '#finding',
    'save-answer': july + '#download',
    'answer-status': july + '#save',
    solution: july,
    method: workshop + 'recipes/what-to-delegate/',
    'lab-result': workshop + 'evidence/review.html',
    'observed-result': workshop + 'evidence/review.html',
    sasha: workshop + 'sasha/',
    'sasha-plan': workshop + 'sasha/',
    'sasha-plan-result': workshop + 'sasha/',
    recipes: workshop + 'recipes/',
    'recipes-heading': workshop + 'recipes/',
    reading: '/shared-memory/'
  };

  function openBookmark() {
    const id = location.hash.slice(1);
    if (id === 'downloads') {
      const downloads = document.getElementById('downloads');
      if (downloads) downloads.open = true;
      else location.replace(practicum + '#downloads');
    } else if (Object.hasOwn(routes, id)) {
      location.replace(routes[id]);
    }
  }

  window.addEventListener('hashchange', openBookmark);
  openBookmark();
})();
