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

1. **Create the repository**: Create a new GitHub repository named `alexdavydov.github.io` (must match your GitHub username exactly).

2. **Push the code**: Push all files to the `main` branch of the repository.

3. **Enable GitHub Pages**:
   - Go to your repository settings
   - Navigate to "Pages" in the left sidebar
   - Under "Source", select "Deploy from a branch"
   - Choose `main` branch and `/ (root)` folder
   - Click "Save"

4. **Access your site**: After a few minutes, your site will be available at `https://alexdavydov.github.io`

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

## Публикация на GitHub Pages — чеклист

Перед публикацией репозитория на GitHub Pages выполните следующие проверки:

1. **Запустите скрипт аудита:**
   ```bash
   bash scripts/publish_audit.sh
   ```
   Скрипт проверит:
   - Наличие .DS_Store файлов
   - Наличие папки `real_tests/` (критично!)
   - Большие файлы (>10MB)
   - PDF файлы
   - Dev-only markdown файлы

2. **Убедитесь, что в ветке `main` нет `real_tests/`:**
   ```bash
   git ls-files | grep real_tests
   ```
   Если команда выводит файлы — они присутствуют в git и будут опубликованы!

3. **Удалите .DS_Store файлы:**
   ```bash
   find . -name ".DS_Store" -type f -delete
   ```

4. **Проверьте большие файлы:**
   ```bash
   find . -type f -size +10M -not -path "./.git/*"
   ```
   Если найдены большие файлы — рассмотрите возможность их оптимизации или исключения.

5. **Настройте GitHub Pages:**
   - Settings → Pages → Source: Deploy from a branch
   - Выберите ветку `main` и папку `/ (root)`
   - **Важно:** GitHub Pages должен деплоиться только из ветки `main`

## Политика приватных материалов

### Папка `real_tests/`

Папка `real_tests/` содержит конфиденциальные данные о реальных A/B-тестах и **НИКОГДА не должна публиковаться на GitHub Pages**.

**Правила работы с `real_tests/`:**

1. **Хранение:** Папка `real_tests/` хранится только в ветке `real-tests` и никогда не мерджится в `main`.

2. **Ветка `main`:** В ветке `main` папка `real_tests/` должна быть:
   - Удалена из git индекса: `git rm -r --cached real_tests/`
   - Добавлена в `.gitignore`: строка `real_tests/`
   - Локально может оставаться (для работы), но не должна быть закоммичена

3. **GitHub Pages:** Деплой на GitHub Pages происходит только из ветки `main`, что гарантирует, что `real_tests/` не будет опубликован.

### Инструкции по выносу `real_tests/` в отдельную ветку

Если `real_tests/` ещё находится в ветке `main`, выполните следующие команды:

```bash
# 1. Создайте ветку real-tests и переключитесь на неё
git checkout -b real-tests

# 2. Убедитесь, что real_tests/ есть в этой ветке
ls real_tests/

# 3. Переключитесь обратно на main
git checkout main

# 4. Удалите real_tests/ из git индекса (но оставьте локально)
git rm -r --cached real_tests/

# 5. Убедитесь, что real_tests/ в .gitignore
echo "real_tests/" >> .gitignore

# 6. Закоммитьте изменения
git add .gitignore
git commit -m "Remove real_tests from main (keep in real-tests branch)"

# 7. Настройте GitHub Pages на деплой только из main
# Settings → Pages → Source: Deploy from a branch → main
```

**Важно:** После выполнения этих команд папка `real_tests/` останется локально на вашем компьютере, но не будет включена в коммиты ветки `main` и не будет опубликована на GitHub Pages.

