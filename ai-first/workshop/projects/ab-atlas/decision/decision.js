const get = (id) => document.getElementById(id);
const element = (tag, text) => {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  return node;
};
const normalize = (value) => value.toLocaleLowerCase("ru").replaceAll("ё", "е");
const fields = [
  ["goal", "Цель"],
  ["action", "Действие"],
  ["basis", "Основание"],
  ["limits", "Ограничения вывода"],
  ["missing", "Каких данных не хватает"],
];
const storageKey = "davydov-atlas-decision-v1";

async function init() {
  const response = await fetch(new URL("../cases.json", import.meta.url), { cache: "no-cache" });
  if (!response.ok) throw new Error("Каталог не загрузился");
  const cases = await response.json();
  const byId = new Map(cases.map((item) => [item.id, item]));
  const comparison = new Set();
  const compareButtons = new Map();
  const entries = [];
  const sourceSelect = get("memo-case");
  let page = 0;
  let matches = [];
  const pageSize = 12;
  let storageAvailable = true;

  function sourceLinks(item, label = "Первоисточник") {
    const link = element("a", label);
    link.href = item.source;
    const links = element("span");
    links.append(link);
    if (item.extra_url) {
      const extra = element("a", item.extra_label || "Дополнительный источник");
      extra.href = item.extra_url;
      links.append(" · ", extra);
    }
    return links;
  }
  function facts(pairs) {
    const list = element("dl");
    for (const [label, value] of pairs) {
      list.append(element("dt", label), element("dd", value || "Не указано"));
    }
    return list;
  }
  function metrics(item) {
    const list = element("ul");
    for (const row of item.results) {
      const entry = element("li");
      const description = row.reported ?? (row.absolute == null
        ? "Оценка не опубликована"
        : row.absolute.toLocaleString("ru-RU", { maximumFractionDigits: 4 }) + " " + row.unit + " (пересчёт)");
      entry.append(element("strong", row.metric), element("p", description),
        element("small", "Знаменатель / единица: " + (row.denominator || item.unit || "Не указано")));
      list.append(entry);
    }
    return list;
  }
  function renderComparison() {
    get("compare").hidden = comparison.size === 0;
    get("compare-items").replaceChildren();
    get("compare-status").textContent = comparison.size === 1
      ? "Выберите второй опыт, чтобы сопоставить изменения, окна и знаменатели." : "";
    for (const [id, button] of compareButtons)
      button.setAttribute("aria-pressed", String(comparison.has(id)));
    for (const id of comparison) {
      const item = byId.get(id);
      const box = element("article");
      box.append(element("h3", item.company + " · " + item.title), facts([
        ["Что изменили", item.change],
        ["Дизайн", item.design],
        ["Окно", item.window],
        ["Единица назначения / анализа", item.unit],
        ["Группы", item.groups.map((group) => group.label).join(" ")],
      ]), metrics(item), element("p", item.note), sourceLinks(item));
      const remove = element("button", "Убрать из сравнения");
      remove.type = "button";
      remove.addEventListener("click", () => {
        comparison.delete(id);
        renderComparison();
      });
      box.append(remove);
      get("compare-items").append(box);
    }
  }
  function updateMemo() {
    const note = Object.fromEntries(fields.map(([id]) => [id, get(id).value]));
    note.source = sourceSelect.value;
    const item = byId.get(note.source);
    get("memo-source").replaceChildren();
    const sections = fields.map(([id, label]) => label + "\n" + (note[id].trim() || "—"));
    if (item) {
      const atlasURL = "https://davydov.my/ai-first/workshop/projects/ab-atlas/#" + encodeURIComponent(item.id);
      const atlasLink = element("a", "Эксперимент в Атласе");
      atlasLink.href = "../#" + item.id;
      get("memo-source").append(sourceLinks(item), element("p", item.locator), atlasLink);
      const citation = [item.company, item.title, item.locator, item.source, atlasURL];
      if (item.extra_url) citation.push(item.extra_url);
      sections.push("Источник\n" + citation.join("\n"));
    } else sections.push("Источник\nВыберите эксперимент");
    get("preview").value = sections.join("\n\n");
    get("copy-status").textContent = "";
    try {
      localStorage.setItem(storageKey, JSON.stringify(note));
      storageAvailable = true;
    } catch {
      storageAvailable = false;
    }
    get("save-status").textContent = storageAvailable
      ? "Черновик сохранён в этом браузере."
      : "Браузер запретил сохранение. Скопируйте текст перед закрытием страницы.";
  }
  function useCase(item) {
    sourceSelect.value = item.id;
    updateMemo();
    history.replaceState(null, "", "?case=" + encodeURIComponent(item.id) + "#memo");
    get("memo").scrollIntoView({ block: "start" });
    get("goal").focus({ preventScroll: true });
  }
  for (const item of cases) {
    const option = element("option", item.company + " · " + item.title);
    option.value = item.id;
    sourceSelect.append(option);
    const card = element("article");
    card.className = "decision-case";
    card.id = "test-" + item.id;
    card.append(element("small", item.company), element("h3", item.title),
      element("p", item.source_summary || item.note));
    const detail = element("details");
    detail.append(element("summary", "Данные и ограничения"), facts([
      ["Задача", item.task],
      ["Что изменили", item.change],
      ["Дизайн", item.design],
      ["Единица назначения / анализа", item.unit],
      ["Окно", item.window],
      ["Группы", item.groups.map((group) => group.label).join(" ")],
    ]), metrics(item), element("p", item.note), sourceLinks(item),
      element("p", item.locator));
    card.append(detail);
    for (const report of item.analyses ?? []) {
      const reviewLink = element("a", "Разбор · " + report.question);
      reviewLink.href = "../" + report.href;
      const row = element("p");
      row.append(reviewLink);
      card.append(row);
    }
    const actions = element("div");
    actions.className = "decision-actions";
    const use = element("button", "В записку");
    use.type = "button";
    use.addEventListener("click", () => useCase(item));
    const compare = element("button", "Сравнить");
    compare.type = "button";
    compare.setAttribute("aria-pressed", "false");
    compare.addEventListener("click", () => {
      if (comparison.has(item.id)) comparison.delete(item.id);
      else if (comparison.size < 2) comparison.add(item.id);
      else {
        get("compare-status").textContent = "Уберите один из двух выбранных опытов.";
        get("compare").scrollIntoView({ block: "start" });
        return;
      }
      renderComparison();
      if (comparison.size === 2) {
        get("compare").scrollIntoView({ block: "start" });
        get("compare-title").focus({ preventScroll: true });
      }
    });
    compareButtons.set(item.id, compare);
    actions.append(use, compare);
    if (item.practice_url) {
      const practice = element("a", "Прими решение сам");
      practice.href = "../" + item.practice_url;
      actions.append(practice);
    }
    card.append(actions);
    const searchable = [item.company, item.title, item.task, item.change, item.industry,
      item.note, ...item.results.map((row) => row.metric)].join(" ");
    entries.push({ card, text: normalize(searchable) });
  }
  function showPage() {
    get("cards").replaceChildren(...matches.slice(page * pageSize, (page + 1) * pageSize).map((entry) => entry.card));
    get("matches").textContent = matches.length
      ? "Найдено " + matches.length + " из " + cases.length
      : "По этому запросу опытов нет. Измените запрос.";
    get("prev").disabled = page === 0;
    get("next").disabled = (page + 1) * pageSize >= matches.length;
    get("results-page").textContent = matches.length
      ? (page * pageSize + 1) + "–" + Math.min((page + 1) * pageSize, matches.length) : "";
  }
  function filter() {
    const words = normalize(get("search").value).trim().split(/\s+/);
    matches = entries.filter((entry) => words.every((word) => entry.text.includes(word)));
    page = 0;
    showPage();
  }
  get("search").addEventListener("input", filter);
  for (const [id, delta] of [["prev", -1], ["next", 1]]) get(id).addEventListener("click", () => {
    page += delta;
    showPage();
    get("matches").scrollIntoView();
  });
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    if (saved && typeof saved === "object") {
      for (const [id] of fields) if (typeof saved[id] === "string") get(id).value = saved[id];
      if (byId.has(saved.source)) sourceSelect.value = saved.source;
    }
  } catch {
    storageAvailable = false;
  }
  const requested = new URL(location.href).searchParams.get("case");
  if (byId.has(requested)) sourceSelect.value = requested;
  for (const [id] of fields) get(id).addEventListener("input", updateMemo);
  sourceSelect.addEventListener("change", () => {
    const url = new URL(location.href);
    url.searchParams.set("case", sourceSelect.value);
    history.replaceState(null, "", url);
    updateMemo();
  });
  function selectText() {
    const preview = get("preview");
    preview.focus();
    preview.select();
    preview.setSelectionRange(0, preview.value.length);
    get("copy-status").textContent = "Текст выделен. Выберите «Копировать» в меню браузера.";
  }
  get("select-text").addEventListener("click", selectText);
  get("copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(get("preview").value);
      get("copy-status").textContent = "Записка скопирована.";
    } catch {
      selectText();
    }
  });
  updateMemo();
  filter();
  if (byId.has(requested) && location.hash === "#memo") {
    get("memo").scrollIntoView({ block: "start" });
    get("goal").focus({ preventScroll: true });
  }
}
init().catch(() => {
  get("matches").textContent = "Не удалось загрузить каталог. Обновите страницу.";
});
