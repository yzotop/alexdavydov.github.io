#!/usr/bin/env python3
"""Генератор data.js для исследователя палитры Ultraboost.

Источник: ub_final.csv (рядом с этим файлом), 45 расцветок трёх поколений.
Вывод: data.js — обычный скрипт, вешающий window.PALETTE_DATA.
Не JSON и не fetch: так страница открывается и по file://.

Генератор воспроизводит источник как есть и ничего не схлопывает.
В частности, tier остаётся раздельным (seasonal_cold / seasonal_gtx /
seasonal_heat), потому что за этими метками стоят разные цены —
$200, $230 и $220 — и в интерфейсе они разведены по трём кнопкам.

Правило репо: генератор и его вывод коммитятся вместе.
Запуск: python3 build_data.py
"""
import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    with open(os.path.join(HERE, 'ub_final.csv'), encoding='utf-8') as f:
        rows = list(csv.DictReader(f))

    out = []
    for r in rows:
        out.append({
            'sku': r['sku'],
            'gen': r['gen'],
            'name': r['nickname'],
            'colorway': r['colorway'],
            'main': r['main_color'],
            'date': r['release_date'],
            'tier': r['tier'],
            'price': int(float(r['retail_usd'])),
            'own': r['owned'].strip().lower() == 'yes',
        })

    with open(os.path.join(HERE, 'data.js'), 'w', encoding='utf-8') as f:
        f.write('/* СГЕНЕРИРОВАНО build_data.py из ub_final.csv.\n')
        f.write('   Руками не править — следующий прогон генератора сотрёт правку. */\n')
        f.write('window.PALETTE_DATA=')
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')

    gens = {}
    tiers = {}
    for i in out:
        gens[i['gen']] = gens.get(i['gen'], 0) + 1
        tiers[i['tier']] = tiers.get(i['tier'], 0) + 1
    print(f'data.js: {len(out)} расцветок')
    print(f'  поколения: {gens}')
    print(f'  слои:      {tiers}')
    print(f'  в коллекции: {sum(i["own"] for i in out)}')


if __name__ == '__main__':
    main()
