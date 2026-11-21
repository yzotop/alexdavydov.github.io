'use strict';
const el = id => document.getElementById(id);
const n = value => value.toLocaleString('ru-RU');
const fieldText = kopecks => (kopecks / 100).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2});
const isClient = document.body.dataset.scenario === 'null';
const orderItems = isClient ? clientOrder.items : items;
const requiredCost = isClient ? clientOrder.required : required;
const inKopecks = isClient ? value => value : toKopecks;
let policy = 'proportional';
let comparison;
const cacheKey = budget => isClient ? policy + '/' + budget : budget;
const rubles = value => fieldText(inKopecks(value)) + ' ₽';
const fullBudget = isClient ? requiredCost : Math.ceil(requiredCost * rubRate / 100000);
const colors = {'85099B':'#b83c3e','22386':'#c36694'};
const cache = new Map();
if (isClient) {
  for (const [key, value] of Object.entries(clientExamples)) cache.set(key,value);
  el('full-preset').dataset.kopecks=String(fullBudget);
} else {
  for (const [key, value] of Object.entries(examples)) cache.set(toKopecks(Number(key)*10),value);
  cache.set(fullBudget,examples[979787]);
  cache.set(30000000,example300k);
}
let current, state;
function pairRow(row) {
  const color = colors[row.sku];
  return '<div class="bag" style="--bag:'+color+'"><span class="sample" aria-hidden="true"></span><div><div class="bag-top"><strong>'+
    (row.sku==='85099B'?'Красная сумка':'Розовая сумка')+'</strong><small>'+row.sku+'</small></div><div class="bar"><i style="width:'+(100*row.units/row.need)+
    '%"></i></div><div class="bag-bottom"><span><b>'+n(row.units)+'</b> из '+n(row.need)+' шт.'+(isClient?' · '+n(row.units*row.cost/100)+' ₽':'')+'</span><span>Снято '+n(row.need-row.units)+'</span></div></div></div>';
}
function renderTable() {
  const shown=state.rows.filter(row=>!el('onlycut').checked||row.units<row.need);
  el('table').innerHTML=shown.map(r=>{
    const delta=isClient ? comparison.deltas.get(r.sku) : null;
    const quantities=delta ? [delta.before,delta.after] : [r.units];
    const quantityCells=quantities.map((q,i)=>'<td class="'+(i===(policy==='bags'?1:0)?'qty':'')+'">'+n(q)+'</td>').join('');
    return '<tr '+(colors[r.sku]?'data-bag style="--bag:'+colors[r.sku]+'"':'')+'><td>'+r.name+'<small>'+r.sku+(isClient?' · '+r.unit:'')+'</small></td><td>'+fieldText(inKopecks(r.cost))+'</td><td>'+n(r.need)+'</td>'+quantityCells+'<td>'+n(r.need-r.units)+'</td><td>'+fieldText(inKopecks(r.units*r.cost))+'</td></tr>';
  }).join('');
  el('empty').hidden=shown.length>0;
  el('linecount').textContent='Сокращено позиций: '+state.cutCount+' из '+orderItems.length+'. Показано: '+shown.length+'.';
}
function para(parent,tag,text) {
  const node=document.createElement(tag);node.textContent=text;parent.append(node);
}
function showReply(reply,tag) {
  const box=el('ai');box.replaceChildren();
  para(box,'small',tag);
  for(const key of ['budget','red','pink','tradeoff']) if(reply[key]) para(box,'p',reply[key]);
}
function renderComparison() {
  const {bagGain,cuts,deltas}=comparison;
  const extra=[...deltas.values()].filter(r=>colors[r.sku]).reduce((total,r)=>total+r.change,0);
  const same=[...deltas.values()].every(r=>r.change===0);
  let summary='Оба правила дают одинаковый заказ при этом бюджете.';
  if (!same) {
    const bagsText=extra>0 ? 'Приоритет добавит '+n(extra)+' сумок на '+n(bagGain/100)+' ₽.' :
      'Число сумок при этом бюджете одинаковое.';
    summary=bagsText+' При пропорциональном заказе расход составит '+n(comparison.proportional.spend/100)+
      ' ₽, с приоритетом — '+n(comparison.bags.spend/100)+' ₽.';
    if (cuts.length) summary+=' Сокращено других позиций: '+cuts.length+'. Самые большие сокращения по сумме показаны ниже.';
  }
  el('trade-summary').textContent=summary;
  const list=el('top-cuts');
  list.replaceChildren();
  for (const row of cuts.slice(0,3)) {
    const line=document.createElement('div');line.className='cut-line';
    para(line,'strong',row.name);
    para(line,'span',n(row.before)+' → '+n(row.after)+' ед.');
    para(line,'span','−'+n(-row.money/100)+' ₽');
    list.append(line);
  }
}
function render(kopecks,formatInput=true) {
  current=kopecks;
  if (isClient) {
    comparison=clientOrder.compare(kopecks);
    state=comparison[policy];
    renderComparison();
  } else state=allocateRub(kopecks);
  el('inputError').hidden=true;el('money').removeAttribute('aria-invalid');
  if(formatInput) el('money').value=fieldText(kopecks);
  const max=Math.max(isClient ? 2000000 : 600000,Math.ceil(kopecks/100/10000)*10000);
  el('slider').max=max;el('slider').value=kopecks/100;el('axisMax').textContent=n(max)+' ₽';
  el('slider').setAttribute('aria-valuetext',fieldText(kopecks)+' ₽');
  document.querySelectorAll('[data-kopecks]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.kopecks===kopecks)));
  el('needed').textContent=fieldText(fullBudget)+' ₽';el('spend').textContent=rubles(state.spend);
  el('left').textContent=fieldText(kopecks-inKopecks(state.spend))+' ₽';el('units').textContent=n(state.units);
  el('removed').textContent=n(state.rows.reduce((sum,r)=>sum+r.need-r.units,0));
  el('bags').innerHTML=['85099B','22386'].map(s=>pairRow(state.rows.find(r=>r.sku===s))).join('');
  const short=Math.max(0,requiredCost-state.budget);
  const percent=100*state.budget/requiredCost;
  const shareText=short>0 && percent>=99.995 ? 'чуть меньше 100%' : percent.toLocaleString('ru-RU',{maximumFractionDigits:2})+'%';
  el('reason').textContent=kopecks===0?'При нулевом бюджете все количества к заказу равны нулю.':short>0?
    'До полной заявки не хватает '+fieldText(fullBudget-kopecks)+' ₽. До округления каждая строка получает '+shareText+' запрошенного количества.':
    'Полная заявка помещается в лимит. Все позиции заказаны в запрошенном количестве.';
  if (isClient && policy==='bags' && kopecks>0 && short>0) {
    el('reason').textContent=kopecks<clientOrder.bagCost ?
      'Для обеих сумок нужно 315 180 ₽. Бюджет делится между двумя расцветками по их заявке. Другие товары пока отложены.' :
      'На обе расцветки выделено 315 180 ₽. Для остальных товаров доступно '+rubles(kopecks-clientOrder.bagCost)+'.';
  }
  el('ai').replaceChildren();el('ask').disabled=false;el('ask').hidden=false;el('ask').textContent='Показать пояснение';
  if(cache.has(cacheKey(current))) {
    showReply(cache.get(cacheKey(current)),'Локальная модель Qwen · сохранённый ответ для выбранного заказа');
    el('ask').hidden=true;
  }
  renderTable();
}
el('ask').onclick=()=>{
  const parts={budget:state.budget>=requiredCost?'Бюджета хватает на полную заявку.':'К обеим расцветкам применяется общее ограничение бюджета.'};
  for(const [key,sku] of [['red','85099B'],['pink','22386']]) {
    const r=state.rows.find(x=>x.sku===sku);
    parts[key]=r.name+' — в заявке '+n(r.need)+' шт., в заказе '+n(r.units)+' шт., сокращено '+n(r.need-r.units)+' шт.';
  }
  if(isClient) {
    parts.budget=el('reason').textContent;
    parts.tradeoff=clientOrder.tradeoff(comparison,policy)[0];
  }
  showReply(parts,'Пояснение по шаблону, числа из расчёта');
};
document.querySelectorAll('[data-kopecks]').forEach(b=>b.onclick=()=>render(Number(b.dataset.kopecks)));
el('slider').oninput=e=>render(Math.round(Number(e.target.value)*100));
el('money').oninput=e=>{
  const raw=e.target.value.replace(/\s/g,'').replace(',','.');
  const cents=Math.round(Number(raw)*100);
  if(!/^\d+(\.\d{0,2})?$/.test(raw)||!Number.isSafeInteger(cents)||cents>4558520000) {
    el('money').setAttribute('aria-invalid','true');
    el('inputError').hidden=false;el('inputError').textContent='Введите от 0 до 45 585 200 ₽, до двух знаков после запятой. Ниже — последний верный расчёт.';
    return;
  }
  render(cents,false);
};
el('money').onblur=()=>{if(!el('money').hasAttribute('aria-invalid'))el('money').value=fieldText(current);};
for (const radio of document.querySelectorAll('input[name="policy"]')) {
  radio.onchange=()=>{policy=radio.value;render(current);};
}
el('onlycut').onchange=renderTable;
render(isClient ? 100000000 : toKopecks(9094200));
