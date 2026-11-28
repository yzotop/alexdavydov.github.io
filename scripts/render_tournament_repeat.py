#!/usr/bin/env python3
"""Render the reader-only repeat from frozen public data; never run models."""
from pathlib import Path
from html import escape
import argparse
import json
import re

ROOT = Path(__file__).resolve().parents[1]


def render(root=ROOT):
    page = root / "ai-first/workshop/tournament"
    repeat = page / "repeat"
    data = json.loads((repeat / "RESULTS.json").read_text())
    def money(value):
        return f"{value // 10:,}".replace(",", "\u00a0") + " ₽"
    def original(path, label):
        text = (page / path).read_text()
        return f'<details class="trn-repeat-original"><summary>{escape(label)} · оригинал, суммы в фунтах</summary><pre>{escape(text)}</pre><p><a href="{escape(path)}">Скачать оригинал без изменений</a></p></details>'
    def conditions(prefix):
        return original(f"repeat/conditions/{prefix}-stocks.txt", "Полное задание") + original(f"repeat/conditions/{prefix}-stock-clarification.txt", "Уточнение заказа")
    rows = "".join(f'<tr><th scope="row"><a href="#repeat-{t["id"]}">{escape(t["name"])}</a></th><td class="trn-number">{t["before_priority_qty"]}</td><td class="trn-number">{t["new_priority_qty"]}</td></tr>' for t in data["teams"])
    order = "".join(f'<tr><th scope="row">{r["sku"]}</th><td class="trn-number">{r["qty"]}</td></tr>' for r in data["order"])
    def stages(team):
        return "".join('<div class="trn-step"><h4>' + escape(s["label"]) + '</h4>' + original('repeat/' + s['file'], 'Полный ответ') + '</div>' for s in team['stages'])
    review = next(t for t in data['teams'] if t['id'] == 'T4')
    others = "".join(f'<details class="trn-repeat-team" id="repeat-{t["id"]}"><summary>{escape(t["name"])}</summary><p><a href="raw/stocks-{t["id"]}-final-answer.json">Прежняя первая заявка · оригинал, суммы в фунтах</a></p>{stages(t)}</details>' for t in data['teams'] if t['id'] != 'T4')
    return f'''<section id="stocks-repeat" class="trn-section trn-repeat" aria-labelledby="repeat-title">
<div class="trn-section-head"><h2 id="repeat-title">Повтор: уточнили условие закупки</h2></div>
<p class="trn-context">Отдельный повтор · 10 новых вызовов · gpt-6.2-sol / medium</p>
<p class="trn-statement">В первом раунде четыре команды потратили весь бюджет. Мы уточнили: бюджет — потолок, приоритетный товар — по максимуму. В этом повторе все пять команд сошлись. Проверяющий подтвердил расчёт, но правильный заказ уже был в черновике.</p>
<p class="trn-muted">Это отдельный результат. <a href="#scoreboard">Предварительный счёт первого сезона</a> — 2/3 и 3/3 — сохранён.</p>
<div id="repeat-conditions" class="trn-repeat-conditions">
<p class="trn-repeat-unit">Ниже — редакторская адаптация условий для сравнения, не дословная цитата. Для наглядности суммы показаны в рублях в условном масштабе £1 = 100 ₽. Это не валютный курс; исходное задание и ответы — в фунтах.</p>
<div class="trn-repeat-condition-grid">
<article id="repeat-before"><h3>Старое условие</h3><p><strong>Бюджет строго {money(data['budget_mGBP'])}.</strong></p><p>«Сначала выделите допустимые количества для пары…»</p><p>Слово «строго» допускало два прочтения: потратить всю сумму или не превысить её. Требование к количеству приоритетного товара допускало трактовку.</p>{conditions('before')}</article>
<article id="repeat-after"><h3>Новое условие</h3><p><strong>Бюджет — потолок: не больше {money(data['budget_mGBP'])}. Остаток допустим.</strong></p><p>Приоритетный SKU 21212 — по максимуму таблицы. Не уменьшать его количество ради расходования всей суммы.</p><p>Цены, таблица, ограничения и правило распределения остатка сохранены.</p>{conditions('after')}</article>
</div></div>
<div id="repeat-teams" class="trn-repeat-part"><h3>Все пять команд сошлись</h3>
<table class="trn-repeat-table"><caption>Количество приоритетного товара · SKU 21212, единиц</caption><thead><tr><th scope="col">Команда</th><th scope="col" class="trn-number">Раньше</th><th scope="col" class="trn-number">В повторе</th></tr></thead><tbody>{rows}</tbody></table>
<p>Совпало не только количество приоритетного товара: у всех пяти команд одинаков <strong>весь заказ</strong>.</p>
<table class="trn-repeat-order"><caption>Одинаковый итоговый заказ всех команд</caption><thead><tr><th scope="col">SKU</th><th scope="col" class="trn-number">Количество, ед.</th></tr></thead><tbody>{order}</tbody></table>
<p class="trn-statement">Бюджет {money(data['budget_mGBP'])} · стоимость {money(data['total_mGBP'])} · остаток {money(data['budget_mGBP'] - data['total_mGBP'])}.</p>
</div>
<div id="repeat-T4" class="trn-repeat-part"><h3 id="repeat-review">С ревью: подтвердил верный черновик</h3>
<ol class="trn-review-summary"><li><b>Правильный черновик.</b> Все количества и смета уже соответствовали явному условию.</li><li><b>Проверяющий подтвердил расчёт.</b> Проверил порядок дробных остатков и смету.</li><li><b>Финал побайтно совпал с черновиком.</b> 0 исправленных и 0 внесённых ошибок решения.</li></ol>
<p>Это подтверждение в одном повторе, а не вывод о том, что ревью вообще бесполезно. Самопроверка и сведение двух независимых решений также сохранили уже правильные количества.</p>
<p><a href="raw/stocks-T4-final-answer.json">Прежняя первая заявка команды · оригинал, суммы в фунтах</a></p>
{stages(review)}
</div>
<div class="trn-repeat-part"><h3>Ответы остальных команд</h3>{others}</div>
<div class="trn-repeat-part"><h3>Что повтор показывает и чего не доказывает</h3>
<p>После явного уточнения в этом повторе все пять конфигураций сошлись. Модель — gpt-6.2-sol / medium; роли и таблица прежние. Каждая команда получила свою прежнюю первую заявку. Первые заявки у команд различались: это повтор прежней стадии, а не полностью одинаковая история между командами.</p>
<p>Прежние ответы уточнённого раунда, его оценки и ключ агентам не показывали. Пять прежних первых заявок — сохранённые входы, не новые вызовы. В повторе 10 новых вызовов и 10 новых оригинальных ответов.</p>
<p class="trn-ranking-note">Один повтор: влияние формулировки и случайность генерации не разделены. Смысловая оценка организатора не слепая. Этот результат не устанавливает надёжность конфигураций и не доказывает превосходство архитектуры.</p>
<p><a href="repeat/RESULTS.json">Публичная сводка повтора · JSON</a> · <a href="#scoreboard">Вернуться к первому сезону</a></p></div>
</section>'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    path = ROOT / 'ai-first/workshop/tournament/index.html'
    text = path.read_text()
    start, end = '<!-- repeat:start -->', '<!-- repeat:end -->'
    assert text.count(start) == text.count(end) == 1
    result = re.sub(re.escape(start) + '.*?' + re.escape(end), lambda _: start + '\n' + render() + '\n' + end, text, flags=re.S)
    if args.check:
        assert result == text, 'Generated repeat block drift'
        print('Tournament repeat matches frozen public data')
    elif result != text:
        path.write_text(result)
        print('Rendered tournament repeat')


if __name__ == '__main__':
    main()
