const get = (id) => document.getElementById(id);
const actionLabels = {
  A: "Выбрать A",
  B: "Выбрать B",
  clarify: "Уточнить цель",
  data: "Запросить данные",
  wait: "Пока отложить выбор",
};
const phases = ["first", "goal", "second", "comparison"];
const storagePrefix = "davydov-atlas-practice-v1:";
const emptyState = () => ({
  version: 1,
  phase: "first",
  first: { action: "", reason: "" },
  second: { action: "", reason: "" },
});
const validMove = (move) => Boolean(actionLabels[move.action] && move.reason.trim());
function restoreState(saved) {
  const state = emptyState();
  if (!saved || saved.version !== 1) return state;
  for (const key of ["first", "second"]) {
    if (saved[key] && actionLabels[saved[key].action]) state[key].action = saved[key].action;
    if (typeof saved[key]?.reason === "string") state[key].reason = saved[key].reason;
  }
  if (phases.includes(saved.phase)) state.phase = saved.phase;
  if (!validMove(state.first)) state.phase = "first";
  if (["second", "comparison"].includes(state.phase) && !validMove(state.second))
    state.phase = "goal";
  return state;
}
async function init() {
  const response = await fetch(new URL("scenarios.json", import.meta.url), { cache: "no-cache" });
  if (!response.ok) throw new Error("Упражнения не загрузились");
  const cases = await response.json();
  const byId = new Map(cases.map((item) => [item.id, item]));
  for (const item of cases) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.company + " · " + item.title;
    get("case-select").append(option);
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = "?case=" + encodeURIComponent(item.id);
    link.textContent = item.company + " · " + item.title;
    li.append(link);
    get("exercise-list").append(li);
  }
  const requested = new URL(location.href).searchParams.get("case");
  const item = byId.get(requested);
  get("load-status").textContent = "";
  if (!item) {
    if (requested) get("load-status").textContent = "Опыт не найден. Выберите один из списка.";
    return;
  }
  get("picker").hidden = true;
  get("exercise").hidden = false;
  get("case-select").value = item.id;
  get("case-select").addEventListener("change", () => {
    location.href = "?case=" + encodeURIComponent(get("case-select").value);
  });
  get("case-title").textContent = item.company + " · " + item.title;
  // Only project-authored packet and original agent transcripts use HTML.
  // Reader input is always assigned through value or textContent.
  get("packet").innerHTML = item.packet_html;
  get("source-link").href = item.source;
  get("source-locator").textContent = item.locator;
  get("back-atlas").href = "../#" + item.id;
  const storageKey = storagePrefix + item.id;
  let state = emptyState();
  let stored = false;
  try {
    state = restoreState(JSON.parse(localStorage.getItem(storageKey) || "null"));
  } catch {
    // A fresh draft still works when storage is unavailable or malformed.
  }
  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      stored = true;
    } catch {
      stored = false;
    }
    get("save-status").textContent = stored
      ? "Оба хода сохраняются в этом браузере."
      : "Браузер запретил сохранение. Сохраните свои ответы перед закрытием страницы.";
  }
  function renderComparison() {
    get("guidance").replaceChildren();
    get("agent-responses").replaceChildren();
    if (state.phase !== "comparison") return;
    for (const [label, text] of item.guidance) {
      const term = document.createElement("dt");
      term.textContent = label;
      const description = document.createElement("dd");
      description.textContent = text;
      get("guidance").append(term, description);
    }
    get("agent-rule").textContent = "Агент с правилом дополнительно получил инструкцию «" + item.rule + "»";
    get("agent-verdict").textContent = item.verdict;
    for (const original of item.responses) {
      const detail = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = original.label;
      const content = document.createElement("div");
      content.className = "original-answer";
      content.innerHTML = original.html;
      const link = document.createElement("a");
      link.href = original.href;
      link.textContent = "Подлинный ответ целиком · TXT";
      detail.append(summary, content, link);
      get("agent-responses").append(detail);
    }
    get("full-review").href = item.review_href;
  }
  function render() {
    const afterFirst = state.phase !== "first";
    const afterSecond = ["second", "comparison"].includes(state.phase);
    get("first-form").hidden = afterFirst;
    get("first-record").hidden = !afterFirst;
    get("team-section").hidden = !afterFirst;
    get("second-form").hidden = !afterFirst || afterSecond;
    get("second-record").hidden = !afterSecond;
    get("compare-entry").hidden = !afterSecond || state.phase === "comparison";
    get("comparison").hidden = state.phase !== "comparison";
    for (const turn of ["first", "second"]) {
      get(turn + "-action").value = state[turn].action;
      get(turn + "-reason").value = state[turn].reason;
    }
    get("first-choice").textContent = afterFirst ? actionLabels[state.first.action] : "";
    get("first-basis").textContent = afterFirst ? state.first.reason : "";
    get("team-reply").textContent = afterFirst ? item.team_reply : "";
    get("second-choice").textContent = afterSecond ? actionLabels[state.second.action] : "";
    get("second-basis").textContent = afterSecond ? state.second.reason : "";
    get("choice-change").textContent = afterSecond
      ? "До уточнения: «" + actionLabels[state.first.action] + "». После: «" + actionLabels[state.second.action] + "»."
      : "";
    get("agent-rule").textContent = "";
    get("agent-verdict").textContent = "";
    renderComparison();
  }
  function focusSection(id) {
    const heading = get(id);
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: "start" });
  }
  for (const turn of ["first", "second"]) {
    for (const key of ["action", "reason"]) get(turn + "-" + key).addEventListener("input", () => {
      if ((turn === "first" && state.phase !== "first") || (turn === "second" && state.phase !== "goal")) return;
      if (key === "reason") get(turn + "-reason").setCustomValidity("");
      state[turn][key] = get(turn + "-" + key).value;
      persist();
    });
    get(turn + "-form").addEventListener("submit", (event) => {
      event.preventDefault();
      if ((turn === "first" && state.phase !== "first") || (turn === "second" && state.phase !== "goal")) return;
      state[turn] = {
        action: get(turn + "-action").value,
        reason: get(turn + "-reason").value,
      };
      if (!validMove(state[turn])) {
        get(turn + "-reason").setCustomValidity("Кратко укажите основание решения.");
        get(turn + "-form").reportValidity();
        return;
      }
      state.phase = turn === "first" ? "goal" : "second";
      persist();
      render();
      if (turn === "first") focusSection("team-heading");
      else {
        get("second-record").scrollIntoView({ block: "start" });
        get("show-comparison").focus({ preventScroll: true });
      }
    });
  }
  get("show-comparison").addEventListener("click", () => {
    if (state.phase !== "second") return;
    state.phase = "comparison";
    persist();
    render();
    focusSection("comparison-heading");
  });
  get("reset").addEventListener("click", () => {
    state = emptyState();
    let cleared = true;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      cleared = false;
    }
    render();
    get("save-status").textContent = cleared
      ? "Оба хода в этом опыте сброшены."
      : "Ходы очищены на странице. Браузер запретил удалить сохранённый черновик.";
    get("first-form").scrollIntoView({ block: "start" });
    get("first-action").focus({ preventScroll: true });
  });
  render();
  // Check whether the browser can persist this exercise without changing its phase.
  persist();
}
init().catch(() => {
  get("load-status").textContent = "Не удалось загрузить упражнения. Обновите страницу.";
});
