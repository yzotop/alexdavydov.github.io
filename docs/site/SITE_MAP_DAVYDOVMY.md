# Карта сайта davydov.my

Краткий справочник по сущностям сайта. Подробности — в `ARCHITECTURE_MODEL_DAVYDOVMY.md` и `ENTITY_REGISTRY_CANONICAL_2026-03.md`.

---

## Четыре типа сущностей (различия)

| Тип | Что это | Где каноника | Примеры |
|-----|---------|--------------|---------|
| **Calculators** | Параметрические калькуляторы: вводишь числа → получаешь расчёт | `/calculators/<slug>/` | rollout, revenue, funnel-sensitivity, scenario-planning |
| **Simulators** | Интерактивные симуляции: взаимодействуешь с моделью, смотришь динамику | `/simulators/<slug>/` | ab-test, ad-auction, ride-hailing, marketplace-live |
| **Courses** | Обучающий контент: модули, уроки, практика | `/lab/<slug>/` | monetization, ab-decisions, product-analytics |
| **Cases** | Кейсы / портфолио: реальные проекты и примеры | `/cases/<slug>/` | macbook-market, nloto-portfolio, solvery-mentors |

---

## Ключевое различие: calculators vs simulators

| | Calculator | Simulator |
|---|------------|-----------|
| **Ввод** | Форма с параметрами | Интерактивное взаимодействие |
| **Вывод** | Числа, таблицы, графики по расчёту | Динамическая модель в реальном времени |
| **Аналогия** | Калькулятор / Excel | Игра / песочница |

**Пограничный случай:** `scenario-planning` — считается calculator (параметрический сценарий), но есть симуляторный вариант в simulators.

---

## Структура разделов (каноническая)

```
/calculators/          ← Калькуляторы (tools)
  rollout/
  revenue/
  funnel-sensitivity/
  scenario-planning/
  ad-monetization/
  lab/                 ← legacy: compatibility + shared assets

/simulators/           ← Симуляции (live surfaces)
  ab-test/
  ad-auction/
  ad-fatigue/
  ad-monetization/     ← есть и в calculators (multi-surface)
  ride-hailing/
  marketplace-live/
  ad-auction-pressure/ ← variant (pressure), не отдельный hub
  ride-hailing-mvp/    ← variant (mvp)

/courses/              ← Каталог курсов (витрина)
  index.html           ← список карточек, читает lab/_manifest.json

/lab/                  ← Контент курсов + tools hub + legacy
  monetization/        ← курс
  ab-decisions/        ← курс
  product-analytics/   ← курс
  quasi-experiments/   ← курс
  ab-stat-os/          ← курс (draft)
  glossary/            ← глоссарий, не курс
  index.html           ← tools hub (не course hub)
  calculators/         ← legacy: redirects → /calculators/
  simulators/          ← legacy: redirects → /simulators/

/cases/                ← Кейсы (портфолио)
  macbook-market/
  nloto-portfolio/
  nikifilini/
  solvery-mentors/

/knowledge/            ← Knowledge hub
```

---

## Где что создавать (decision tree)

```
Новая сущность?
├── Параметры → число/таблица?     → /calculators/<slug>/
├── Интерактивная модель?          → /simulators/<slug>/
├── Обучающий контент (модули)?    → /lab/<slug>/  + запись в courses
└── Реальный кейс / портфолио?     → /cases/<slug>/
```

---

## Частые путаницы

| Путаница | Реальность |
|----------|------------|
| «Курсы в courses/» | Контент курсов живёт в `lab/`, а `courses/` — только каталог-витрина |
| «calculators и simulators — одно» | Разные: calculator = расчёт по формулам, simulator = живая модель |
| «lab/calculators и calculators/» | `lab/calculators/*` — legacy redirects. Каноника — `/calculators/<slug>/` |
| «lab/simulators и simulators/» | То же: `lab/simulators/*` — legacy. Каноника — `/simulators/<slug>/` |
| «scenario-planning — simulator?» | Calculator. Есть compatibility bridge из simulators |

---

## Legacy-слои (не создавать новое)

- `lab/calculators/*` → redirects на `/calculators/`
- `lab/simulators/*` → redirects на `/simulators/`
- `calculators/lab/*` → compatibility + shared assets (не новый hub)

---

## Ссылки

- [ARCHITECTURE_MODEL_DAVYDOVMY.md](./ARCHITECTURE_MODEL_DAVYDOVMY.md) — полная архитектурная модель
- [ENTITY_REGISTRY_CANONICAL_2026-03.md](./ENTITY_REGISTRY_CANONICAL_2026-03.md) — реестр сущностей с canonical URLs

---

## SEO: домен, sitemap, Search Console

- **Канонический сайт:** `https://davydov.my/` (apex). В разметке страниц используются абсолютные `link rel="canonical"` и Open Graph на этот origin.
- **Дубли www / HTTP:** редиректы `www` → apex и `http` → `https` настраиваются в DNS / CDN (GitHub Pages: включить «Enforce HTTPS» в настройках Pages; для `www` — отдельная запись DNS или редирект у регистратора/Cloudflare). Репозиторий не задаёт HTTP-заголовки редиректа.
- **Файлы в корне деплоя:** `robots.txt`, `sitemap.xml`. Sitemap собирается скриптом `scripts/generate_sitemap.py` из `assets/search-index.json` и списка hub-URL.
- **Страница курсов:** статический список и встроенный JSON синхронизируются с `courses/courses-registry.json` через `scripts/render_courses_hub.py` (после правок реестра запустить скрипт и закоммитить `courses/index.html`).

### Google Search Console (ручные шаги)

1. Добавить ресурс **Домен** или **Префикс URL** `https://davydov.my/`.
2. Подтвердить владение (DNS TXT или HTML-файл / meta-тег — см. мастер GSC).
3. Отправить sitemap: `https://davydov.my/sitemap.xml`.
4. Указать предпочитаемый адрес (если доступно), чтобы склеить дубли с `www`.
