const issueList = document.querySelector('.inventory-issues');
const sidebar = window.matchMedia('(min-width: 851px)');

function setIssueListLayout() {
  issueList.open = sidebar.matches;
}

setIssueListLayout();
sidebar.addEventListener('change', setIssueListLayout);
