#!/usr/bin/env python3
"""Генератор data/menu.js для симулятора menu-check.

Источники: menu_items.csv, menu_addons.csv (рядом с этим файлом).
Вывод: data/menu.js — обычный скрипт, вешающий window.MENU_DATA.
Не JSON и не fetch: так страница открывается и по file://, как остальные
симуляторы в /workspace/simulators/.

Правило репо: генератор и его вывод коммитятся вместе.
Запуск: python3 build_data.py
"""
import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# Разделы меню, которые считаются едой. Всё остальное — напитки.
# Деление нужно модели: еда и напиток выбираются независимо, и food-cost
# у них задаётся разными ползунками.
FOOD = {'лисички', 'завтраки', 'супы', 'салаты', 'горячее', 'сэндвичи'}


def load(name):
    with open(os.path.join(HERE, name), encoding='utf-8') as f:
        return list(csv.DictReader(f))


def main():
    items = load('menu_items.csv')
    addons = load('menu_addons.csv')

    # Добавки привязаны к блюду по имени: у одной «Яичницы / омлета» их девять.
    add_by = {}
    for a in addons:
        add_by.setdefault(a['parent'], []).append(int(float(a['price'])))

    out = []
    for r in items:
        out.append({
            'name': r['item'],
            'sec': r['section'],
            'page': int(r['page']),
            'spos': int(r['section_pos']),
            'price': int(float(r['price'])),
            'food': r['section'] in FOOD,
            'addons': add_by.get(r['item'], []),
        })

    data_dir = os.path.join(HERE, 'data')
    os.makedirs(data_dir, exist_ok=True)
    with open(os.path.join(data_dir, 'menu.js'), 'w', encoding='utf-8') as f:
        f.write('/* СГЕНЕРИРОВАНО build_data.py из menu_items.csv + menu_addons.csv.\n')
        f.write('   Руками не править — следующий прогон генератора сотрёт правку. */\n')
        f.write('window.MENU_DATA=')
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')

    n_food = sum(i['food'] for i in out)
    n_addons = sum(len(i['addons']) for i in out)
    print(f'data/menu.js: {len(out)} позиций '
          f'(еда {n_food}, напитки {len(out) - n_food}), добавок {n_addons}')


if __name__ == '__main__':
    main()
