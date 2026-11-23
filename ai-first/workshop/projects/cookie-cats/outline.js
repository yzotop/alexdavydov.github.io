const outline = document.querySelector('.cats-outline');
const wideLayout = window.matchMedia('(min-width: 851px)');
function fitOutline() {
  outline.open = wideLayout.matches;
}
fitOutline();
wideLayout.addEventListener('change', fitOutline);
