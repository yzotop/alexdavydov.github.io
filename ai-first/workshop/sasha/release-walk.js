(() => {
  const root = document.querySelector('.sr');
  if (!root) return;
  const steps = [...root.querySelectorAll('.sr-step')];
  const ids = new Set(steps.map(step => step.id));
  const navigation = [...root.querySelectorAll('.sr-nav a')];
  function show(id, scroll) {
    steps.forEach(step => { step.hidden = step.id !== id; });
    navigation.forEach(link => {
      if (link.hash === `#${id}`) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
    if (scroll) document.getElementById('walk').scrollIntoView({block: 'start'});
  }
  root.classList.add('sr-enhanced');
  const initial = location.hash.slice(1);
  show(ids.has(initial) ? initial : 'data', false);
  root.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || !ids.has(link.hash.slice(1)) || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    history.pushState(null, '', link.hash);
    show(link.hash.slice(1), true);
    const heading = document.getElementById(link.hash.slice(1)).querySelector('h2');
    heading.setAttribute('tabindex', '-1');
    heading.focus({preventScroll: true});
    const detail = link.dataset.openDetail && document.getElementById(link.dataset.openDetail);
    if (detail && detail.tagName === 'DETAILS') {
      detail.open = true;
      detail.scrollIntoView({block: 'start'});
      detail.querySelector('summary').focus({preventScroll: true});
    }
  });
  window.addEventListener('popstate', () => show(ids.has(location.hash.slice(1)) ? location.hash.slice(1) : 'data', true));
  window.addEventListener('hashchange', () => { if (ids.has(location.hash.slice(1))) show(location.hash.slice(1), true); });
})();
