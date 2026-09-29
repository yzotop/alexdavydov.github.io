# План: переезд статей из `/workspace/articles/` в `/articles/`

Решение автора от 2026-09-29: корень — `/articles/`, переезд не раньше
28.11.2026, после доклада 26 ноября. До этой даты ничего не переносить.

Зачем: слова Workspace на сайте больше нет, а статьи живут по адресам
`/workspace/articles/…`. Выигрыш косметический, поэтому только после доклада.

## Что переезжает

- 24 статьи из `workspace/articles/<slug>/` в `articles/<slug>/`.
- `workspace/articles/index.html` (сейчас заглушка) остаётся заглушкой,
  цель — хаб `/ai-analyst/`.

Остаются на месте, в эту волну не входят:

- `/workspace/mechanics/`;
- `/workspace/blind-verdict-evals/` (AI-evals заморожены);
- девять живых симуляторов в `/workspace/simulators/`. Статьи встраивают
  их абсолютным адресом `/workspace/simulators/…`, адреса не трогаем.

Относительных ссылок `../` в статьях нет (проверено 2026-09-29): перенос
на уровень выше ничего внутри страниц не ломает.

## Шаги

1. `git mv workspace/articles/<slug> articles/<slug>` — история файлов
   сохраняется.
2. На каждом старом адресе — заглушка, как в этапе 1 (сентябрь 2026):
   `meta refresh` и `canonical` на новый адрес. Серверных переадресаций
   на GitHub Pages нет. Ссылки в постах и у внешних сайтов не правим —
   их уводит заглушка.
3. В самих статьях: `canonical`, `og:url`, `og:image`.
4. Генераторы и скрипты с явным путём `workspace/articles`:
   `render_series_block.py`, `generate_sitemap.py`,
   `promote_articles_navbar.py`, `check_class_collisions.py`.
5. `.github/workflows/site-qa.yml`, шаг `seo-artifacts`:
   `git diff --exit-code workspace/articles` → `articles`.
6. Перегенерировать хаб `/ai-analyst/`, главную, блоки серии, карту сайта.
7. `assets/search-index.json` — адреса статей.
8. Ссылки на статьи из `/cases/`, `/about/`, `/talks/`, симуляторов
   и из статей друг на друга — на новые адреса, чтобы не ходить через
   заглушку.
9. `CLAUDE.md` и `design-system.md` — пути в примерах.

## Проверки

До мержа:

- lychee с `--remap` (без кеша);
- `check_redirects.py` — каждая заглушка ведёт на существующую страницу;
- `check_meta_css_refs.py` — `og:url`, `og:image` совпадают с адресом;
- `seo-artifacts` — генераторы не дают расхождения;
- отрицательный тест: временный коммит с заглушкой на несуществующий адрес
  → красный CI → `git revert` → зелёный.

После выкладки:

- `curl` по всем 24 старым адресам: ответ 200, заглушка с новым адресом;
- `curl` по новым адресам: 200 и нужный `canonical`;
- Search Console: заново отправить `sitemap.xml`.

Весь переезд — один PR.
