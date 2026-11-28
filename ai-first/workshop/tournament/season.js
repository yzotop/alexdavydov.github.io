"use strict";
const season = JSON.parse(document.getElementById("season-data").textContent);
const scenarios = [
  { id:"atlas", name:"Атлас", title:"Не испортить верный вывод", deck:"Проверить подпись к A/B-тесту.",
    variants:["Оставить подпись","Исправить подпись","Отложить до получения данных"],
    source:'Upworthy Research Archive, Matias и соавторы, CC BY 4.0. <a href="https://upworthy.natematias.com/">Описание архива</a>.',
    task:'<p>Два варианта получили 19 кликов на 2 246 показов и 7 кликов на 2 318. Отличались и заголовок, и изображение. Какую подпись оставить в карточке?</p><blockquote class="trn-task-quote">«У первого пакета доля кликов выше примерно на 0,54 процентного пункта. Между пакетами изменились и заголовок, и изображение; вклад только текста по этому тесту определить нельзя».</blockquote>' },
  { id:"sasha", name:"Саша", title:"Изменились числа. Меняется ли вывод?", deck:"Учесть поздний возврат в июньской записке.",
    variants:["Сохранить положительный вывод","Пересмотреть вывод","Запросить недостающие данные"],
    source:"Учебный синтетический срез проекта «Саша». Сравниваются версии записки.",
    task:'<p>Июньские продажи после скидок — 4 743 174,85. Возвраты — 447 666,40. Июнь прошлого года по чистой выручке — 3 591 133,86.</p><p>Возврат 500,00 произошёл 30 июня, а зарегистрирован 25 июля. По правилам возврат относится к месяцу события. Что станет с фразой «В июне наблюдается положительная годовая динамика»?</p>' },
  { id:"stocks", name:"Запасы", title:"Приоритет поменялся. Пересобери заказ", deck:"Собрать выполнимый заказ при жёстком бюджете.",
    source:'Online Retail II, Daqing Chen, UCI, CC BY 4.0. Цены и остатки — учебная симуляция. <a href="https://doi.org/10.24432/C5CG6D">Исходный набор</a>.',
    task:"<p>Лимит 280 881 ₽. Поставка 20 июня. Выберите целое количество по каждому SKU, соблюдая пределы строк. До уточнения допустимы разные выполнимые заказы. Исторические корзины дают информацию о совместных покупках.</p>" },
];
const rosterNotes = {
  T1:"Исполнитель → ответ", T2:"Рецепт → исполнитель → ответ",
  T3:"Черновик → самопроверка", T4:"Исполнитель → проверяющий → исправление",
  T5:"Два независимых ответа → сверка и сведение",
};
const phaseNames = {
  draft:"Первый черновик", review:"Отдельное ревью", "solution-a":"Независимое решение А",
  "solution-b":"Независимое решение Б", final:"Итоговый ответ",
};
const stageNames = { first:"Первый ответ", check:"Проверка", clarified:"После уточнения" };
const teams = Object.keys(season.config.teams);
const $ = id => document.getElementById(id);
const escape = val => String(val ?? "").replace(/[&<>"']/g, mark =>
  ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[mark]);
const fmt = (v, decimals=0) => Number(v).toLocaleString("ru-RU", {maximumFractionDigits:decimals,minimumFractionDigits:decimals});
const money = mg => fmt(mg / 10, mg % 10 ? 1 : 0) + " ₽";
const publicNames = {T1:"Одиночка", T2:"По рецепту", T3:"Самопроверка", T4:"С ревью", T5:"Два решения"};
const teamName = id => publicNames[id] ?? season.config.teams[id].label;
const resultWave = id => id === "stocks" ? "stocks-clarified" : id;

let readerChoices = {};
try { readerChoices = JSON.parse(localStorage.getItem("davydov-season-probe-1") || "{}") || {}; } catch {}
const state = { round:"atlas", main:"T1", other:"", stage:"first", mode:"reader" };

function current() { return scenarios.find(item => item.id === state.round); }
function status(wave, team) { return season.checks[wave][team].status; }
function ready(wave) { return teams.every(team => Boolean(season.calls[wave + "-" + team + "-final"]?.complete)); }
function revealed() { return state.mode === "watch" || Boolean(readerChoices[state.round]); }
function saveChoice(key, value) {
  readerChoices[key] = value;
  try { localStorage.setItem("davydov-season-probe-1", JSON.stringify(readerChoices)); } catch {}
}
function rounds() {
  $("round-tabs").innerHTML = scenarios.map((r, i) =>
    `<button class="trn-round-tab" type="button" data-round="${r.id}" aria-pressed="${state.round === r.id}"><b>${i+1}. ${r.name}</b><span>${r.deck}</span></button>`).join("");
  const r = current();
  $("round-state").textContent = ready(resultWave(r.id)) ? "Волны завершены" : "Доступные ответы сохранены";
  $("round-title").textContent = r.title;
  $("round-number").textContent = r.name;
  $("round-source").innerHTML = r.source;
  $("round-task").innerHTML = r.task + (r.id === "stocks" ? `<p class="trn-muted">Для наглядности суммы показаны в рублях в условном масштабе £1 = 100 ₽. Это не валютный курс; исходное задание и ответы — в фунтах.</p>` : "") + `<details><summary>${r.id === "stocks" ? "Оригинал задания, суммы в фунтах" : "Полные условия задачи"}</summary><p class="trn-packet">${escape(season.packets[r.id])}</p></details>`;
  renderReader();
  $("round-results").hidden = !revealed();
  if (revealed()) renderMatches();
}
function stockForm(clarified) {
  const ref = season.references.stocks;
  const entries = Object.entries(ref.skus);
  const defaults = readerChoices[clarified ? "stocks-clarified" : "stocks"] ?? {};
  return `<form id="choice-form"><table aria-label="Ведомость заказа читателя"><thead><tr><th>SKU</th><th class="trn-number">Цена</th><th class="trn-number">Предел</th><th class="trn-number">Заказать</th></tr></thead><tbody>${
      entries.map(([sku, row]) => `<tr><th scope="row">${sku}</th><td class="trn-number">${money(row.price)}</td><td class="trn-number">${row.cap}</td><td class="trn-number"><input type="number" required name="${sku}" aria-label="Количество ${sku}" min="0" max="${row.cap}" step="1" value="${escape(defaults[sku] ?? 0)}"></td></tr>`).join("")
    }</tbody></table><p id="order-meter" class="trn-feedback" aria-live="polite"></p><button class="trn-button trn-solid" type="submit">${clarified ? "Сохранить новый заказ" : "Сохранить заказ и открыть ответы"}</button></form>`;
}
function stockMeter() {
  const form = $("choice-form");
  if (!form || !$("order-meter")) return;
  const ref = season.references.stocks;
  const total = Object.entries(ref.skus).reduce((sum, [sku, r]) => sum + (Number(form.elements.namedItem(sku).value) || 0) * r.price, 0);
  $("order-meter").textContent = `Ваш заказ ${money(total)}. ${total <= ref.budget ? "Остаток" : "Превышение"} ${money(Math.abs(ref.budget-total))}.`;
}
function renderReader() {
  const r = current();
  const node = $("reader");
  node.className = "trn-reader";
  if (state.mode === "watch") {
    node.innerHTML = "";
    return;
  }
  const choice = readerChoices[r.id];
  if (!choice) {
    if (r.id === "stocks") {
      node.innerHTML = stockForm(false);
      stockMeter();
      return;
    }
    node.innerHTML = `<form id="choice-form"><p><b>Ваше решение</b></p><div class="trn-choices">${r.variants.map((label,i) =>
      `<label class="trn-choice"><input name="answer" type="radio" value="${i}" required> ${label}</label>`).join("")}</div><button class="trn-button trn-solid" type="submit">Сохранить выбор и открыть ответы</button></form>`;
    return;
  }
  const summary = r.id === "stocks"
    ? "Ваш первый заказ · " + Object.entries(choice).map(([sku, q]) => `${sku} × ${q}`).join(", ")
    : "Ваш выбор · " + choice;
  node.innerHTML = `<p class="trn-feedback">${escape(summary)}</p>`;
  if (r.id === "stocks" && state.stage === "clarified") {
    node.innerHTML += `<blockquote class="trn-task-quote">${escape(season.packets.clarification)}</blockquote>`;
    if (readerChoices["stocks-clarified"]) {
      node.innerHTML += `<p class="trn-feedback">Ваш пересмотр · ${escape(Object.entries(readerChoices["stocks-clarified"]).map(([sku, q]) => `${sku} × ${q}`).join(", "))}</p>`;
    } else {
      node.innerHTML += stockForm(true);
      stockMeter();
    }
  }
}
function evidenceQuote(quote, inventory) {
  if (!quote) return "";
  const fragment = `<blockquote class="trn-task-quote">${escape(quote)}</blockquote>`;
  return inventory ? `<details class="trn-source-quote"><summary>Цитата из ответа · оригинал, суммы в фунтах</summary>${fragment}</details>` : fragment;
}
function stockProse(text) {
  return text.replace(/\b(\d(?:[\d ]*\d)?) mGBP вместо (\d+)/g, (_, expected, stated) =>
    `${money(Number(expected.replaceAll(" ", "")))} вместо ${money(Number(stated))}`
  ).replace(/\b(\d(?:[\d ]*\d)?) mGBP\b/g, (_, amount) => money(Number(amount.replaceAll(" ", "")))).replace(/£([\d \u00a0\u202f]+(?:[,.]\d+)?)/g, (_, amount) =>
    money(Math.round(Number(amount.replace(/[ \u00a0\u202f]/g, "").replace(",", ".")) * 1000)));
}
function step(wave, team, phase) {
  const key = `${wave}-${team}-${phase}`;
  const call = season.calls[key];
  if (!call?.complete) return `<div class="trn-step"><b>${phaseNames[phase]}</b><p>${call?.technical ? "Технический сбой" : "Выдача отсутствует"}.</p></div>`;
  const answer = call.answer;
  const fullExcerpt = answer.review ?? answer.evidence ?? "";
  const pivot = wave === "stocks-clarified" && team === "T4" && phase === "review"
    ? fullExcerpt.indexOf("Если «строго»") : -1;
  const excerpt = pivot >= 0 ? fullExcerpt.slice(pivot) : fullExcerpt;
  const prefix = excerpt.match(/^(?:\s*\S+){33}/)?.[0];
  const short = prefix && excerpt.slice(prefix.length).trim() ? prefix + "…" : excerpt;
  const totals = answer.lines && call.check?.actual_mGBP !== undefined ? ` · смета ${money(call.check.actual_mGBP)}` : "";
  const inventory = wave.startsWith("stocks");
  const notes = call.check ? [...call.check.hard, ...call.check.soft] : [];
  return `<div class="trn-step"><b>${phaseNames[phase]}</b><small>${fmt(call.wall_seconds,1)} с${totals}</small>
    ${evidenceQuote(short, inventory)}${notes.length ? `<p><small>${escape(inventory ? stockProse(notes.join(". ")) : notes.join(". "))}</small></p>` : ""}
    <a href="raw/${escape(call.answer_file)}">${inventory ? "Оригинал, суммы в фунтах" : "Полный ответ"}</a></div>`;
}
function referenceBlock(wave) {
  if (wave === "atlas") return "CTR 0,846% и 0,302%. Разница +0,544 п.п. Изменились заголовок и изображение, раздельный вклад неизвестен.";
  if (wave === "sasha") return "Чистая выручка уменьшается на 500,00. YoY меняется с +19,61% на +19,60%. Положительный знак сохраняется.";
  const ref = season.references.stocks;
  return wave === "stocks-clarified"
    ? `По ключу приоритетного товара нужно заказать ${ref.priority_qty} единиц. Общая стоимость ${money(ref.refined_total)}, остаток ${money(ref.budget - ref.refined_total)}.`
    : `Пропорциональный заказ стоит ${money(ref.first_total)}. Другой выполнимый заказ допустим при обосновании.`;
}
function reviewSummary() {
  const final = season.calls["stocks-clarified-T4-final"];
  const units = final?.answer?.lines.find(row => row.sku === "21212")?.qty;
  const total = final?.check?.actual_mGBP;
  if (units === undefined || total === undefined) return "";
  return `<ol class="trn-review-summary" aria-label="Ход команды после уточнения">
    <li><b>Черновик уже был верным.</b></li>
    <li><b>Проверяющий заметил неоднозначность.</b> Нужно потратить всю сумму или только уложиться в неё?</li>
    <li><b>Заказ остался прежним.</b> ${units} единиц приоритетного товара и ${money(season.references.stocks.budget - total)} остатка.</li>
  </ol>`;
}
function changes(team) {
  const before = season.calls[`stocks-${team}-final`]?.answer;
  const after = season.calls[`stocks-clarified-${team}-final`]?.answer;
  if (!before?.lines || !after?.lines) return "";
  const initial = Object.fromEntries(before.lines.map(row=>[row.sku,row.qty]));
  return `<table><thead><tr><th>SKU</th><th class="trn-number">Было</th><th class="trn-number">Стало</th></tr></thead><tbody>${
    after.lines.map(row=>`<tr><th scope="row">${escape(row.sku)}</th><td class="trn-number">${escape(initial[row.sku] ?? "—")}</td><td class="trn-number">${escape(row.qty)}</td></tr>`).join("")
  }</tbody></table>`;
}
function renderMatches() {
  const rr = current();
  const stages = rr.id === "stocks" ? ["first","check","clarified"] : ["first","check"];
  $("stage-tabs").innerHTML = stages.map(k => `<button type="button" data-stage="${k}" aria-pressed="${k===state.stage}">${stageNames[k]}</button>`).join("");
  $("main-team").value = state.main;
  $("other-team").value = state.other;
  const result = $("matches");
  const list = [state.main, ...(state.other && state.other !== state.main ? [state.other] : [])];
  result.classList.toggle("trn-compare", list.length > 1);
  if (state.stage === "clarified" && state.mode === "reader" && !readerChoices["stocks-clarified"]) {
    result.innerHTML = "";
    return;
  }
  result.innerHTML = list.map(team => {
    const spec = season.config.teams[team];
    const wave = state.stage === "clarified" ? "stocks-clarified" : rr.id;
    const entry = season.checks[wave][team];
    const note = entry.annotation;
    const inventory = rr.id === "stocks";
    const summary = wave === "stocks-clarified" && team === "T4" ? reviewSummary() : "";
    const reason = note?.reason && (inventory ? stockProse(note.reason) : note.reason);
    const verdict = `<p><b>${escape(entry.status)}</b>${reason && !summary ? " · " + escape(reason) : ""}</p>`;
    const metrics = entry.check ? [...entry.check.hard,...entry.check.soft] : [];
    const quotation = evidenceQuote(note?.quote, inventory);
    const finalFile = season.calls[`${wave}-${team}-final`]?.answer_file;
    const evidence = `${verdict}${quotation}<p class="trn-muted">${escape(referenceBlock(wave))}</p>${
      metrics.map(m=>`<p>${escape(inventory ? stockProse(m) : m)}</p>`).join("")}${note?.disputed ? `<p class="trn-muted">${escape(note.dispute_reason)} Оценка дана по зафиксированному ключу и ждёт авторской проверки.</p>` : ""}`;
    const timeline = Object.keys(spec).filter(k=>k!=="label").map(phase=>step(wave,team,phase)).join("");
    let content;
    if (state.stage === "check") {
      content = evidence + (finalFile ? `<p><a href="raw/${escape(finalFile)}">${inventory ? "Оригинал, суммы в фунтах" : "Полный ответ"}</a></p>` : "");
    } else if (state.stage === "clarified") {
      content = summary + evidence + `<details><summary>Оригинал уточнения, суммы в фунтах</summary><blockquote class="trn-task-quote">${escape(season.packets.clarification)}</blockquote></details>` + changes(team) + timeline;
    } else {
      content = verdict + `<details><summary>${inventory ? "Оригинал задания, суммы в фунтах" : "Вход"}</summary><p class="trn-packet">${escape(season.packets[rr.id])}</p></details>` + timeline;
    }
    return `<article class="trn-match"><h4>${escape(teamName(team))}</h4>${content}</article>`;
  }).join("");
}
function costs(team) {
  const calls = Object.values(season.calls).filter(r => r.call.includes(`-${team}-`));
  const seconds = calls.reduce((acc,r)=>acc+(r.wall_seconds ?? 0),0);
  const input = calls.reduce((acc,r)=>acc+(r.usage?.input_tokens ?? 0),0);
  const output = calls.reduce((acc,r)=>acc+(r.usage?.output_tokens ?? 0),0);
  return {calls:calls.length,seconds,input,output};
}
function accepted(team) { return scenarios.filter(r=>status(resultWave(r.id),team)==="Принято").length; }
function selection(round, team) {
  state.round=round; state.main=team; state.mode="watch";
  state.stage = round === "stocks" ? "clarified" : "check";
  rounds();
  $("round-title").focus({preventScroll:true}); $("rounds").scrollIntoView();
}
function statusButton(r,t) {
  const a=status(resultWave(r.id),t);
  return `<button class="trn-table-link" type="button" data-score-team="${t}" data-score-round="${r.id}" aria-label="${r.name}, ${escape(teamName(t))}: ${escape(a)}">${escape(a)}</button>`;
}
function scores() {
  const full = scenarios.every(r=>teams.every(team=>["Принято","Нужна доработка","Задача не решена"].includes(status(resultWave(r.id),team))));
  const max = Math.max(...teams.map(accepted));
  const leading = teams.filter(t=>accepted(t)===max);
  $("ranking").textContent = !full ? "Таблица неполная. Показываем доступные ответы и зафиксированные оценки." :
    leading.length > 1 ? `Ничья по качеству у ${leading.length} команд. Принято ${max} из 3.` :
    `По числу принятых задач впереди «${teamName(leading[0])}». Принято ${max} из 3.`;
  const dur = c => `${fmt(c.seconds,1)} с`;
  const token = c => `${fmt(c.input)} / ${fmt(c.output)}`;
  $("desktop-score").innerHTML = `<table class="trn-score-table"><thead><tr><th>Команда</th><th>Атлас</th><th>Саша</th><th>Запасы¹</th><th class="trn-number">Принято</th><th class="trn-number">Вызовы</th><th class="trn-number">Время</th><th class="trn-number">Токены²</th></tr></thead><tbody>${
    teams.map(t=>{
      const c=costs(t);
      return `<tr><th scope="row">${escape(teamName(t))}</th>${scenarios.map(r=>`<td>${statusButton(r,t)}</td>`).join("")}
        <td class="trn-number">${accepted(t)} / 3</td><td class="trn-number">${c.calls}</td><td class="trn-number">${dur(c)}</td><td class="trn-number">${token(c)}</td></tr>`;
    }).join("")
  }</tbody></table>`;
  $("mobile-score").innerHTML = `<div class="trn-score-list-head" aria-hidden="true"><span>Команда</span><span>Принято</span></div><ul class="trn-score-list">${teams.map(t=>{
    const c=costs(t);
    return `<li><details><summary><b>${escape(teamName(t))}</b><span class="trn-score-count"><span class="trn-visually-hidden">Принято </span>${accepted(t)} из 3</span></summary>
      <div class="trn-score-detail"><ul class="trn-round-scores">${scenarios.map(r=>`<li><span>${r.name}</span>${statusButton(r,t)}</li>`).join("")}</ul>
      <p class="trn-muted">Вызовы ${c.calls} · ${dur(c)} · токены ${token(c)}</p></div></details></li>`;
  }).join("")}</ul>`;
  $("cost-note").textContent = "¹ В таблице Запасы после уточнения. ² Вход и выход по журналу, включая кэшированный вход. Время — сумма времени вызовов, которые местами шли параллельно. Счёт дан по зафиксированному ключу. Числа проверил код, смысл оценил организатор. Формулировка «Запасов» и приёмка Александром открыты. В ответы не вмешивались.";
}
document.addEventListener("click", event => {
  const target=event.target.closest("a,button");
  if (!target) return;
  if (target.id==="play") { state.mode="reader"; rounds(); }
  if (target.id==="spectate") { state.mode="watch"; rounds(); }
  if (target.dataset.round) { state.round=target.dataset.round; state.stage="first"; rounds(); $("round-title").focus(); }
  if (target.dataset.stage) { state.stage=target.dataset.stage; renderReader(); renderMatches(); $("stage-tabs").querySelector(`[data-stage="${state.stage}"]`).focus(); }
  if (target.dataset.scoreTeam) selection(target.dataset.scoreRound,target.dataset.scoreTeam);
});
document.addEventListener("input",event=>{
  if (event.target.closest("#choice-form")) stockMeter();
});
document.addEventListener("change",event=>{
  const t=event.target;
  if (t.id==="main-team") { state.main=t.value; renderMatches(); }
  if (t.id==="other-team") { state.other=t.value; if(t.value===state.main) state.other=""; renderMatches(); }
});
$("reader").addEventListener("submit",event=>{
  event.preventDefault();
  const data=new FormData(event.target);
  if(state.round==="stocks") {
    const q=Object.fromEntries([...data].map(([sku,n])=>[sku,Number(n)]));
    const ref=season.references.stocks;
    const total=Object.entries(q).reduce((sum,[sku,n])=>sum+n*ref.skus[sku].price,0);
    if(total>ref.budget){ $("order-meter").textContent=`Превышение ${money(total-ref.budget)}. Уменьшите заказ.`; return; }
    const key=state.stage==="clarified" ? "stocks-clarified" : "stocks";
    saveChoice(key,q);
  } else {
    const choice=current().variants[Number(data.get("answer"))];
    if(!choice) return;
    saveChoice(state.round,choice);
  }
  rounds();
  $("main-team").focus();
});
$("roster").innerHTML=teams.map((t,i)=>`<li><span class="trn-index">${i+1}</span><div><b>${escape(teamName(t))}</b><small>${rosterNotes[t]}</small></div></li>`).join("");
const options=teams.map(t=>`<option value="${t}">${escape(teamName(t))}</option>`).join("");
$("main-team").innerHTML=options;
$("other-team").insertAdjacentHTML("beforeend",options);
$("edition").textContent=`Пробный сезон · ${season.config.model} · ${season.completed} вызовов`;
$("season-takeaway").textContent=stockProse(season.takeaway);
rounds();
scores();
