#!/usr/bin/env python3
"""Render a frozen control pair; inputs and model answers stay distinct."""
from pathlib import Path
from html import escape
import argparse
import json
import re

ROOT = Path(__file__).resolve().parents[1]


def render(root=ROOT):
    page = root / 'ai-first/workshop/tournament'
    source = page / 'review-pair'
    data = json.loads((source / 'RESULTS.json').read_text())
    def money(n):
        return f'{n // 10:,}'.replace(',', '\u00a0') + ' ₽'
    def original(name, label, review=False):
        text = (source / name).read_text()
        content = '<blockquote class="trn-task-quote">' + escape(json.loads(text)['review']) + '</blockquote>' if review else '<pre>' + escape(text) + '</pre>'
        return f'<details class="trn-repeat-original"><summary>{escape(label)} · оригинал, суммы в фунтах</summary>{content}<p><a href="review-pair/{escape(name)}">Скачать исходный JSON без изменений</a></p></details>'
    cards=[]
    for case in data['cases']:
        draft = json.loads((source / case['draft']).read_text())
        final = json.loads((source / case['final']).read_text())
        a = {r['sku']:r['qty'] for r in draft['lines']}
        b = {r['sku']:r['qty'] for r in final['lines']}
        rows = ''.join(f'<tr><th scope="row">{sku}</th><td class="trn-number">{a[sku]}</td><td class="trn-number">{b[sku]}</td></tr>' for sku in ('85099B','85099F'))
        if case['artificial_error']:
            badge='<p class="trn-pair-injected"><strong>Ошибка внесена специально для контрольной проверки.</strong></p>'
            explanation='Организатор перенёс одну единицу между товарами одинаковой цены: 85099B — с 782 до 783, 85099F — с 436 до 435. Поясняющие изменения к первой заявке согласованы с новыми количествами. Общая сумма, бюджет, максимумы и приоритетный товар остаются правильными, но нарушен алгоритм распределения.'
            finding='Проверяющий без подсказки указал обратные исправления: 85099B 783 → 782 и 85099F 435 → 436. Исполнитель принял их. Другие количества и смета сохранены.'
            outcome='Ошибка распределения исправлена.'
        else:
            badge='<p class="trn-muted">Подготовленный контрольный вход без внесённой ошибки.</p>'
            explanation='Верный черновик взят из предыдущего повтора без изменения. Проверяющий признал его обоснованным; финальный ответ сохранился побайтно, включая обоснование.'
            finding='Проверяющий подтвердил расчёт. В этом контрольном случае — ни ложных замечаний, ни новых ошибок.'
            outcome='Финальный ответ сохранён побайтно.'
        cards.append(f'''<article id="pair-{case['id']}" class="trn-pair-case">
<h3>{escape(case['title'])}</h3>{badge}<p>{explanation}</p>
<p class="trn-pair-outcome"><strong>{outcome}</strong></p>
<table class="trn-repeat-table"><caption>Две проверяемые строки · количество, единиц</caption><thead><tr><th scope="col">SKU</th><th scope="col" class="trn-number">Черновик</th><th scope="col" class="trn-number">Итог</th></tr></thead><tbody>{rows}</tbody></table>
<div class="trn-step trn-pair-stage" data-kind="draft"><h4>Подготовленный черновик</h4><p class="trn-muted">Вход проверки, не новый модельный ответ.</p>{original(case['draft'], 'Прочитать подготовленный вход')}</div>
<div class="trn-step trn-pair-stage" data-kind="review"><h4>Первый ответ проверяющего</h4><p class="trn-muted">Редакторское пояснение: {finding}</p>{original(case['review'], 'Прочитать первое ревью дословно', True)}</div>
<div class="trn-step trn-pair-stage" data-kind="final"><h4>Итоговый заказ</h4><p class="trn-muted">{outcome} Стоимость {money(data['total_mGBP'])}, остаток {money(data['budget_mGBP'] - data['total_mGBP'])}.</p>{original(case['final'], 'Прочитать итоговый ответ')}</div>
</article>''')
    order=''.join(f'<tr><th scope="row">{r["sku"]}</th><td class="trn-number">{r["qty"]}</td></tr>' for r in data['order'])
    return f'''<section id="review-pair" class="trn-section trn-repeat trn-pair" aria-labelledby="pair-title">
<div class="trn-section-head"><h2 id="pair-title">Найдёт ошибку и сохранит верный заказ?</h2></div>
<p class="trn-context">Контрольная пара · 4 новых вызова · 2 подготовленных входа</p>
<p class="trn-statement">На этой паре ревью нашло ошибку распределения и сохранило верный заказ. Ошибка внесена организатором специально; это не новый естественный сбой модели.</p>
<p>Одна модель gpt-6.2-sol / medium. Два первых ревью и два финальных ответа — четыре новых вызова. Два подготовленных черновика — входы проверки, не новые модельные ответы.</p>
<p class="trn-muted">В редакторском объяснении — условные рубли: £1 = 100 ₽. Это не валютный курс. Исходные JSON и дословные ответы ниже сохраняют оригинальные единицы.</p>
<p><a href="#pair-case-17">Верный черновик</a> · <a href="#pair-case-42">Черновик с внесённой ошибкой</a></p>
<div class="trn-pair-grid">{''.join(cards)}</div>
<div class="trn-repeat-part"><h3>Одинаковый итог обоих случаев</h3>
<table class="trn-repeat-order"><caption>Весь итоговый заказ в обоих случаях</caption><thead><tr><th scope="col">SKU</th><th scope="col" class="trn-number">Количество, ед.</th></tr></thead><tbody>{order}</tbody></table>
<p class="trn-statement">Стоимость {money(data['total_mGBP'])}, остаток {money(data['budget_mGBP'] - data['total_mGBP'])}. Условный бюджет — {money(data['budget_mGBP'])}.</p></div>
<div class="trn-repeat-part"><h3>Что было слепым, а что — нет</h3>
<p>Каждый проверяющий видел только свой черновик и одинаковое задание с одной и той же прежней первой заявкой. Проверяющие не знали меток «верный/ошибочный» и наличия другого случая. Финальный исполнитель получал свой черновик и замечания своего проверяющего. Метки на этой странице открыты читателю после проверки.</p>
<p>Организатор оценивал результаты с известными метками. Это одна контрольная пара с искусственной ошибкой, не оценка надёжности. Ветку исправления без ревью не запускали; доказанный причинный прирост качества отсюда не следует.</p>
<p>Товары 85099B и 85099F стоят одинаково — условно 117 ₽ за единицу. Проверка только суммы и лимитов пропускает такую ошибку. Скрипт с полным правилом распределения тоже её находит: здесь нет свидетельства уникальной способности агента.</p>
<p>Общие исходные материалы: <a href="repeat/conditions/after-stocks.txt">полное задание</a>, <a href="repeat/conditions/after-stock-clarification.txt">уточнение</a>, <a href="raw/stocks-T4-final-answer.json">прежняя первая заявка</a>. Оригиналы, суммы в фунтах.</p>
<p><a href="review-pair/RESULTS.json">Публичная сводка пары · JSON</a> · <a href="#stocks-repeat">Предыдущий повтор</a> · <a href="#scoreboard">Предварительный итог первого сезона</a></p>
</div></section>'''


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    path=ROOT/'ai-first/workshop/tournament/index.html'
    text=path.read_text();start,end='<!-- pair:start -->','<!-- pair:end -->'
    assert text.count(start)==text.count(end)==1
    result=re.sub(re.escape(start)+'.*?'+re.escape(end),lambda _:start+'\n'+render()+'\n'+end,text,flags=re.S)
    if args.check:
        assert result==text,'Generated pair block drift'
        print('Tournament pair matches frozen public data')
    elif result!=text:
        path.write_text(result)
        print('Rendered tournament control pair')


if __name__=='__main__':
    main()
