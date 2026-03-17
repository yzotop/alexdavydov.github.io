# Структура проекта alexdavydov.github.io (current-state)

Документ отражает текущую IA-модель и согласован с `docs/site/*`.

## IA contract

- `/courses/` — public catalog hub.
- Canonical course content currently lives in `lab/<course-slug>/*`.
- `lab/index.html` — tools hub.
- `lab/calculators/*` и `lab/simulators/*` — legacy/compatibility layers.
- `lab/_manifest.json` — mixed registry feed (не courses-only manifest).

## High-level структура

```text
alexdavydov.github.io/
├── index.html
├── courses/
│   ├── index.html                # catalog hub (reads lab/_manifest.json)
│   └── README.md                 # courses architecture notes
├── lab/
│   ├── index.html                # tools hub
│   ├── _manifest.json            # mixed registry feed
│   ├── monetization/             # canonical course home
│   ├── ab-decisions/             # canonical course home
│   ├── product-analytics/        # canonical course home
│   ├── ab-stat-os/               # canonical course home (draft)
│   ├── quasi-experiments/        # canonical course home
│   ├── glossary/                 # glossary/knowledge-like node
│   ├── calculators/              # legacy compatibility layer
│   └── simulators/               # legacy compatibility layer
├── calculators/                  # canonical calculators hub/runtime
├── simulators/                   # canonical simulators hub/runtime
└── docs/site/                    # canonical architecture governance docs
```

## Разделение ролей

### `/courses/`

- Витрина и фильтр каталога.
- Не содержит canonical runtime course content.

### `lab/*`

- Содержит canonical course homes.
- Содержит tools hub и mixed utility nodes.
- Содержит legacy compatibility surfaces для calculators/simulators.

### `lab/_manifest.json`

- Технический feed для каталога `/courses/`.
- Может включать `course`, `glossary`, `simulator`, `calculator`.
- Наличие entry в manifest не означает, что это course entity.

## Historical context

- Ранние snapshots структуры (2024 и ранее) описывали старые разделы (`/lab/experiments/`, `/lab/graphs-as-argument/`, вложенные `courses/*` как content roots).
- Эти описания полезны как история, но не должны использоваться как current IA contract.
