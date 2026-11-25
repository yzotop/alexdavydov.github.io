const byId = (id) => document.getElementById(id);
const relativePercent = (value) =>
  value == null ? "Не определено" : number(value) + "%";
const esc = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const number = (n) =>
  n.toLocaleString("ru-RU", { maximumSignificantDigits: 5 });
function table(headers, rows) {
  return (
    '<div class="atlas-table"><table><thead><tr>' +
    headers.map((h) => "<th>" + esc(h) + "</th>").join("") +
    "</tr></thead><tbody>" +
    rows
      .map(
        (r) =>
          "<tr>" + r.map((v) => "<td>" + esc(v) + "</td>").join("") + "</tr>",
      )
      .join("") +
    "</tbody></table></div>"
  );
}
function caseSummary(company, title, note) {
  return (
    '<summary><span class="org">' +
    esc(company) +
    '</span><span class="case-name">' +
    esc(title) +
    '</span><span class="summary-note">' +
    esc(note) +
    "</span></summary>"
  );
}
function shortResult(c) {
  const r = c.results[0];
  if (!r) return "Для сравнения не хватает второй группы";
  if (c.selection_reason) return c.selection_reason;
  if (c.results.length === 1 && r.reported && r.reported.length < 110)
    return r.reported;
  if (c.results.length === 1 && r.absolute != null && r.unit === "п.п.") {
    const pp = r.absolute.toLocaleString("ru-RU", {
      maximumFractionDigits: Math.abs(r.absolute) < 0.01 ? 4 : 2,
      signDisplay: "exceptZero",
    });
    return r.metric + " · " + pp + " п. п.";
  }
  return (
    c.outcome ||
    (c.company === "ASOS"
      ? "Четыре обезличенные метрики"
      : c.metrics
          .map((m) => m.name)
          .slice(0, 2)
          .join(" · ")) ||
    c.evidence
  );
}
function renderCard(c) {
  const fields = [
    ["Задача пользователя", c.task],
    ["Что изменили", c.change],
    ["Тема", c.intervention_family],
    ["Компания · отрасль", c.company + " · " + c.industry],
    ["Единица / аудитория", c.unit],
    ["Плановый сплит", c.planned_split],
    ["Окно", c.window],
    [
      "Метрики в карточке",
      c.metrics.length
        ? c.metrics.length +
          " · " +
          c.metrics.map((m) => m.name + " (" + m.type + ")").join(", ")
        : null,
    ],
    ["Статкритерий команды", c.reported_test],
  ];
  if (c.outcome) fields.unshift(["Результат теста", c.outcome]);
  if (c.selection_reason) fields.unshift(["Почему выбран", c.selection_reason]);
  if (c.variant_count != null)
    fields.push(["Опубликовано вариантов с базой", c.variant_count]);
  if (c.archive_split)
    fields.push(
      ["Часть архива", c.archive_split],
      [
        "Период возможного сбоя",
        c.randomization_risk_period
          ? "Да, по дате создания пакета"
          : "Даты создания вне указанного периода",
      ],
    );
  const groups = c.groups.length
    ? "headline" in c.groups[0]
      ? table(
          ["Пакет", "Заголовок", "ID изображения", "Клики / показы"],
          c.groups.map((g) => [
            g.label,
            g.headline || "—",
            g.image || "—",
            g.clicks + " / " + g.impressions,
          ]),
        )
      : table(
          ["Группа", "Клиентов"],
          c.groups.map((g) => [g.label, number(g.n)]),
        )
    : "";
  let results;
  if (!c.results.length) {
    results = "<p>Для сравнения нужен второй опубликованный вариант.</p>";
  } else if (c.results[0].base_events != null) {
    const percent = (v) =>
      (100 * v).toLocaleString("ru-RU", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + "%";
    const arm = (events, n, rate) =>
      events.toLocaleString("ru-RU") +
      " / " +
      n.toLocaleString("ru-RU") +
      " (" +
      percent(rate) +
      ")";
    results =
      table(
        [
          "Метрика",
          c.base_label || "Контроль",
          c.variant_label || "Вариант",
          "Разница, п.п.",
          "Относительно контроля",
        ],
        c.results.map((r) => [
          c.variant_count > 2 ? r.metric + " · " + r.comparison : r.metric,
          arm(r.base_events, r.base_n, r.baseline),
          arm(r.variant_events, r.variant_n, r.treatment),
          number(r.absolute),
          relativePercent(r.relative_pct),
        ]),
      ) +
      "<small>В каждой группе указаны число событий, знаменатель и доля. Разница рассчитана до округления.</small>";
  } else if (c.evidence === "Пересчёт по опубликованным долям") {
    results =
      table(
        [
          "Метрика",
          "Контроль",
          "Вариант",
          "Разница, п.п.",
          "Относительно контроля",
        ],
        c.results.map((r) => [
          c.variant_count > 2 ? r.metric + " · " + r.comparison : r.metric,
          number(r.baseline * 100) + "%",
          number(r.treatment * 100) + "%",
          number(r.absolute),
          relativePercent(r.relative_pct),
        ]),
      ) +
      "<small>Приближённый пересчёт по округлённым долям из публикации.</small>";
  } else if (c.evidence === "Пересчёт") {
    const daily = c.results[0].day != null;
    const labels = [
      "Сравнение",
      "Метрика",
      "База / вариант¹",
      "Разница",
      "Отн. разница",
    ];
    if (daily) labels.push("День", "N базы / варианта");
    results =
      table(
        labels,
        c.results.map((r) => {
          const values = [
            r.comparison,
            r.metric,
            number(r.baseline) + " / " + number(r.treatment),
            number(r.absolute) + " " + r.unit,
            r.relative_pct == null ? "—" : number(r.relative_pct) + "%",
          ];
          if (daily)
            values.push(
              number(r.day),
              number(r.n_control) + " / " + number(r.n_variant),
            );
          return values;
        }),
      ) +
      "<small>¹ Доли указаны от 0 до 1. Разница посчитана до округления.</small>";
  } else
    results = table(
      ["Метрика", "Что сообщила команда"],
      c.results.map((r) => [r.metric, r.reported]),
    );
  const facts =
    '<details class="facts"><summary>Дизайн и параметры</summary><dl>' +
    fields
      .map(
        ([k, v]) =>
          "<dt>" + esc(k) + "</dt><dd>" + esc(v ?? "Не указано") + "</dd>",
      )
      .join("") +
    "</dl>" +
    groups +
    "</details>";
  return (
    '<details id="' +
    esc(c.id) +
    '">' +
    caseSummary(c.company, c.title, shortResult(c)) +
    '<div class="body"><p>' +
    esc(c.design) +
    "</p><h3>" +
    esc(c.evidence) +
    "</h3>" +
    results +
    "<p>" +
    esc(c.note) +
    "</p>" +
    (c.has_review
      ? '<p><a href="reviews/' + encodeURIComponent(c.id) + '.html">Как агент проверил записку</a></p>'
      : "") +
    (c.goal_case
      ? '<p><a href="goal-clarification/' + encodeURIComponent(c.goal_case) + '">До и после уточнения цели</a></p>'
      : "") +
    facts +
    '<p><a href="' +
    esc(c.source) +
    '">Первоисточник</a> · ' +
    esc(c.locator) +
    (c.extra_url
      ? ' · <a href="' + esc(c.extra_url) + '">' + esc(c.extra_label) + "</a>"
      : "") +
    (c.company === "Upworthy"
      ? ' · <a href="https://upworthy.natematias.com/about-the-archive">Словарь архива</a>'
      : "") +
    ' · <a href="#' +
    esc(c.id) +
    '">Ссылка на тест</a></p></div></details>'
  );
}

async function init() {
  const response = await fetch(new URL("cases.json?v=e166f74376bb", import.meta.url));
  if (!response.ok) throw new Error("Не удалось загрузить подборку");
  const cards = await response.json();
  const full = new Map(cards.map((card) => [card.id, card]));
  const companies = {};
  for (const card of cards)
    companies[card.company] = (companies[card.company] || 0) + 1;
  const entries = cards.map((c) => ({
    id: c.id,
    title: c.title,
    company: c.company,
    hasReview: c.has_review,
    task: c.task,
    change: c.change,
    family: c.intervention_family,
    evidence: c.evidence,
    shape: c.subtype,
    risk: c.randomization_risk_period,
    search: JSON.stringify(c).toLocaleLowerCase(),
  }));
  const fmt = (n) => n.toLocaleString("ru-RU");
  function option(id, label, value) {
    const o = document.createElement("option");
    o.textContent = label;
    o.value = value;
    byId(id).add(o);
  }
  for (const [company, n] of Object.entries(companies).sort())
    option("co", company + " (" + fmt(n) + ")", company);
  for (const key of ["task", "change", "family"]) {
    for (const v of [...new Set(entries.map((e) => e[key]))].sort((a, b) =>
      a.localeCompare(b, "ru"),
    ))
      option(key, v, v);
  }
  for (const v of [
    ...new Set(entries.map((e) => e.shape).filter(Boolean)),
  ].sort())
    option("shape", v, v);

  let selected = [],
    page = 0;
  const pageSize = 20;
  function renderPage() {
    const slice = selected.slice(page * pageSize, (page + 1) * pageSize);
    byId("list").innerHTML =
      slice.map((e) => renderCard(full.get(e.id))).join("") ||
      "<p>Совпадений нет. Измените запрос или сбросьте фильтры.</p>";
    byId("total").textContent =
      "Найдено " + fmt(selected.length) + " из " + fmt(cards.length);
    byId("page").textContent = selected.length
      ? fmt(page * pageSize + 1) + "–" + fmt(page * pageSize + slice.length)
      : "";
    byId("prev").disabled = page === 0;
    byId("next").disabled = (page + 1) * pageSize >= selected.length;
  }
  byId("atlas-filter").addEventListener("submit", (event) =>
    event.preventDefault(),
  );
  function filter() {
    const reviewsOnly = byId("with-review").checked;
    const words = byId("q").value.trim().toLocaleLowerCase().split(/\s+/);
    selected = entries.filter(
      (e) =>
        (!reviewsOnly || e.hasReview) &&
        (!byId("task").value || e.task === byId("task").value) &&
        (!byId("change").value || e.change === byId("change").value) &&
        (!byId("family").value || byId("family").value === e.family) &&
        (!byId("co").value ||
          (byId("co").value === "__other_sources"
            ? e.company !== "Upworthy"
            : byId("co").value === e.company)) &&
        (!byId("ev").value || byId("ev").value === e.evidence) &&
        (!byId("shape").value || byId("shape").value === e.shape) &&
        (!byId("risk").value || e.risk === (byId("risk").value === "flag")) &&
        words.every((w) => e.search.includes(w)),
    );
    if (reviewsOnly) {
      const featuredId = "NA-2715";
      selected.sort((a, b) => Number(b.id === featuredId) - Number(a.id === featuredId));
    }
    page = 0;
    renderPage();
  }
  byId("atlas-filter").addEventListener("input", filter);
  byId("atlas-filter").addEventListener("reset", () => setTimeout(filter, 0));
  for (const [id, delta] of [
    ["prev", -1],
    ["next", 1],
  ])
    byId(id).onclick = () => {
      page += delta;
      renderPage();
      byId("total").scrollIntoView();
    };
  filter();
  function openLinkedCase() {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    if (
      !selected.some((e) => e.id === id) &&
      entries.some((e) => e.id === id)
    ) {
      byId("with-review").checked = false;
      for (const el of byId("atlas-filter").querySelectorAll('input[type="search"], select'))
        el.value = "";
      filter();
    }
    const i = selected.findIndex((e) => e.id === id);

    if (i >= 0) {
      page = Math.floor(i / pageSize);
      renderPage();
      const el = byId(selected[i].id);
      el.open = true;
      el.scrollIntoView();
    }
  }
  window.addEventListener("hashchange", openLinkedCase);
  openLinkedCase();
}
init().catch(() => {
  byId("total").textContent =
    "Не удалось загрузить карточки. Обновите страницу.";
});
