// Keep the chapter when two stories share a recipe. Direct entries use the first chapter.
const trail = document.querySelector('.reader-trail');
const origins = JSON.parse(trail.dataset.origins);
const requested = new URLSearchParams(location.search).get('from');
const chapter = Object.hasOwn(origins, requested) ? requested : Object.keys(origins)[0];
const back = trail.querySelector('[data-origin]');
back.href = '../chapters/' + chapter + '.html#practice';
back.textContent = origins[chapter];
const resume = document.querySelector('[data-resume]');
if (resume) {
  resume.href = back.href;
  resume.textContent = 'Вернуться к чтению · ' + origins[chapter];
}
function carryChapter(link) {
  const dest = new URL(link.getAttribute('href'), location.href);
  dest.searchParams.set('from', chapter);
  link.href = dest.href;
}
document.querySelectorAll('a[data-reader-route]').forEach(carryChapter);
// The R7 exercise adds its onward links after the learner submits a first attempt.
document.addEventListener('click', event => {
  const link = event.target.closest('a[data-reader-route]');
  if (link) carryChapter(link);
});
