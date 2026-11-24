function openFestival() {
  const festival = document.getElementById(location.hash.slice(1));
  if (festival instanceof HTMLDetailsElement && !festival.open) {
    festival.open = true;
    festival.scrollIntoView();
  }
}
window.addEventListener('hashchange', openFestival);
openFestival();
