# Alex Davydov — Systems Gallery

A minimal static site for exploring system patterns and mathematical visualizations, deployed on GitHub Pages.

## 🌍 Live site

https://yzotop.github.io/alexdavydov.github.io/

Deployed via GitHub Pages from `main` branch.

## What This Is

This repository contains a systems gallery inspired by Yan Holtz's approach, but focused on system patterns rather than chart types. The gallery is organized into five categories exploring different aspects of adaptive systems under uncertainty. The site is built with pure HTML, CSS, and JavaScript—no build tools or frameworks required.

## Gallery Categories

The gallery is organized into five conceptual categories:

1. **Distributions of States** — Explore how mass is arranged across possible states, without history or causality. Only the geometry of how mass is distributed.

2. **Pressure & Reshaping** — How external forces reshape distributions. Constraints that compress, expand, or redirect mass across state space.

3. **Transitions & Flows** — Movement between states. How systems evolve, migrate, or transform over time.

4. **Time as State Space** — Temporal dimensions as coordinates. How sequences, histories, and trajectories form geometric structures.

5. **Equilibrium & Breakdown** — Stable configurations and their failure modes. Points where systems hold, and thresholds where they collapse.

## Running Locally

### Option A: Direct File Opening
Simply open `index.html` in your web browser. Note that some features may be limited when opening files directly (file:// protocol).

### Option B: Local Server (Recommended)
Run a simple HTTP server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Deployment

To deploy this site to GitHub Pages:

1. **Create the repository**: Create a new GitHub repository. For a user/organization page, name it `username.github.io` (must match your GitHub username exactly). For a project page, use any repository name.

2. **Push the code**: Push all files to the `main` branch of the repository.

3. **Enable GitHub Pages**:
   - Go to your repository settings
   - Navigate to "Pages" in the left sidebar
   - Under "Source", select "Deploy from a branch"
   - Choose `main` branch and `/ (root)` folder
   - Click "Save"

4. **Access your site**: 
   - For user/organization pages: `https://username.github.io`
   - For project pages: `https://username.github.io/repository-name`
   
   This site is deployed as a project page at `https://yzotop.github.io/alexdavydov.github.io/`

## Structure

```
alexdavydov.github.io/
├── index.html                          # Main gallery entry point
├── lab/
│   ├── distributions/
│   │   ├── index.html                  # Category index
│   │   ├── uniform-1-100.html          # Normal distribution visualization
│   │   └── divisors-1-100.html         # Divisors matrix visualization
│   ├── pressure/
│   │   └── index.html                  # Category index
│   ├── transitions/
│   │   └── index.html                  # Category index
│   ├── time/
│   │   └── index.html                  # Category index
│   └── equilibrium/
│       └── index.html                  # Category index
└── README.md                           # This file
```

## Technologies

- **HTML5**: Semantic markup
- **CSS3**: Minimal, clean styling
- **JavaScript**: Vanilla JS
- **D3.js v7**: Data visualization (loaded via CDN)

## UI / UX Style Guide

Все калькуляторы, графики и интерактивные страницы в проекте должны соответствовать единому стиль-гайду для обеспечения консистентности и читаемости.

См. [`STYLE_GUIDE_CURSOR.md`](./STYLE_GUIDE_CURSOR.md) для детальных правил по:
- Визуальному стилю (цвета, типографика, отступы)
- Паттернам калькуляторов и графиков
- Семантике цветов (зелёный/красный/серый)
- Sanity-checks и критериям готовности

## Design Patterns

Все новые калькуляторы и интерактивные страницы должны следовать установленным дизайн-паттернам для обеспечения единообразия и предсказуемости интерфейса.

См. [`DESIGN_PATTERNS.md`](./DESIGN_PATTERNS.md) для описания паттернов:
- Общая структура страницы-калькулятора (две колонки)
- Паттерн «Главная метрика»
- Паттерн «Текст-интерпретация»
- Паттерн «Сколько стоит +1 шаг»
- Паттерн «Контроль vs тест»
- Паттерн «Сравнение сценариев»
- Паттерн «Детали расчёта»

## Glossary

Единый язык проекта: определения терминов аналитики и монетизации. На страницах курса и в калькуляторах используются ссылки на [`GLOSSARY.md`](./GLOSSARY.md) вместо дублирования определений.

## Maintenance (internal)

Internal maintainer notes (deploy checklist, private materials policy, `real_tests/` workflow) are documented in [`INTERNALS.md`](./INTERNALS.md).

