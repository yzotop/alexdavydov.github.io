# Аудит репозитория перед публикацией на GitHub Pages

**Дата аудита:** 2025-01-XX  
**Цель:** Выявить файлы, которые не должны попасть в публичный репозиторий или на GitHub Pages

---

## 1. Явный мусор (системные файлы)

### .DS_Store файлы (macOS)

**Найдено:** 8 файлов

```
.DS_Store
lab/.DS_Store
lab/ab-decisions/.DS_Store
lab/ab-decisions/practice/.DS_Store
lab/ab-practice/.DS_Store
lab/ab-practice/assets/.DS_Store
lab/graphs-analytics/.DS_Store
lab/graphs-analytics/modules/.DS_Store
```

**Рекомендация:** 
- Удалить все .DS_Store файлы
- Добавить в `.gitignore`: `.DS_Store` и `**/.DS_Store`

**Команды:**
```bash
find . -name ".DS_Store" -type f -delete
echo ".DS_Store" >> .gitignore
echo "**/.DS_Store" >> .gitignore
```

### Другие системные файлы

**Найдено:** Не обнаружено
- Thumbs.db (Windows) — не найдено
- *.log — не найдено
- *.tmp — не найдено
- __pycache__ — не найдено
- node_modules — не найдено
- .pytest_cache — не найдено

---

## 2. Dev-only файлы (черновики, документация разработки)

### Markdown файлы в корне проекта

**Найдено:** 4 файла, не используемых сайтом

1. **COURSE_EXTRACT.md**
   - Структурный экстракт курса
   - Не используется в HTML
   - **Рекомендация:** Можно оставить (документация), но можно и вынести в отдельную ветку

2. **COURSE_STRUCTURE.md**
   - Структура курсов
   - Не используется в HTML
   - **Рекомендация:** Можно оставить (документация), но можно и вынести в отдельную ветку

3. **PROJECT_STRUCTURE.md**
   - Структура проекта
   - Не используется в HTML
   - **Рекомендация:** Можно оставить (документация), но можно и вынести в отдельную ветку

4. **STRUCTURE_ANALYSIS.md**
   - Анализ структуры курсов
   - Не используется в HTML
   - **Рекомендация:** Можно оставить (документация), но можно и вынести в отдельную ветку

### Markdown файлы в подпапках

1. **lab/ab-decisions/ARCHITECTURE_PROPOSAL.md**
   - Предложение по архитектуре
   - Не используется в HTML
   - **Рекомендация:** Dev-only, можно вынести или удалить

2. **lab/graphs-as-argument/CHECK_REPORT.md**
   - Отчёт проверки
   - Не используется в HTML
   - **Рекомендация:** Dev-only, можно вынести или удалить

3. **lab/ab-practice/ПРАКТИКА_AB_ТЕСТИРОВАНИЯ.md**
   - Документация практики
   - Не используется в HTML
   - **Рекомендация:** Dev-only, можно вынести или удалить

### README.md файлы

**Найдено:**
- `README.md` (корень) — стандартный файл, можно оставить
- `real_tests/README.md` — см. раздел про real_tests

---

## 3. Неиспользуемые файлы и папки

### Пустые папки

1. **lab/monetization/assets/**
   - Пустая папка
   - **Рекомендация:** Удалить или оставить для будущего использования

### PDF файлы

**Найдено в real_tests/:**
- `conf12427.pdf`
- `conf12428.pdf`
- `conf12433.pdf`
- `conf12435.pdf`

**Статус:** Не используются в HTML (не найдено ссылок на .pdf)

**Рекомендация:** См. раздел про real_tests/

---

## 4. ⚠️ КРИТИЧНО: Папка real_tests/

### Содержимое

**Найдено:**
- 17 markdown файлов с описаниями реальных A/B-тестов (KOAN-*.md)
- 4 PDF файла (conf*.pdf)
- 2 индексных файла (AB_TESTS_INDEX.md, README.md)

**Всего:** 23 файла

### Риск публикации на GitHub Pages

**КРИТИЧЕСКИЙ РИСК:**

1. **Конфиденциальность:**
   - Файлы содержат описания реальных экспериментов из продакшена
   - Даже при анонимизации могут содержать чувствительную бизнес-информацию
   - PDF файлы могут содержать неанонимизированные данные

2. **Публичный доступ:**
   - GitHub Pages делает репозиторий полностью публичным
   - Файлы будут доступны по прямым URL
   - Индексация поисковыми системами

3. **Юридические риски:**
   - Возможные нарушения NDA
   - Утечка конкурентной информации
   - Проблемы с compliance

### Решение A: Вынести real_tests в private репозиторий

**Описание:**
Создать отдельный private репозиторий для real_tests и использовать его только локально.

**Шаги:**
1. Создать новый private репозиторий (например, `alexdavydov-real-tests-private`)
2. Скопировать папку `real_tests/` в новый репозиторий
3. Удалить `real_tests/` из основного репозитория
4. Добавить `real_tests/` в `.gitignore` основного репозитория
5. Использовать git submodule или просто клонировать отдельно при необходимости

**Плюсы:**
- Полная изоляция конфиденциальных данных
- Можно работать с тестами локально
- Не влияет на основной репозиторий

**Минусы:**
- Нужно поддерживать два репозитория
- Сложнее синхронизация

**Команды:**
```bash
# Создать новый private repo на GitHub, затем:
cd /path/to/new-private-repo
cp -r ../alexdavydov.github.io/real_tests .
git add .
git commit -m "Move real_tests to private repo"
git push

# В основном репозитории:
cd /path/to/alexdavydov.github.io
echo "real_tests/" >> .gitignore
git rm -r --cached real_tests/
git commit -m "Remove real_tests (moved to private repo)"
```

### Решение B: Держать real_tests в отдельной ветке, не деплоимой

**Описание:**
Оставить `real_tests/` в отдельной ветке (например, `dev` или `real-tests`), которая не деплоится на GitHub Pages.

**Шаги:**
1. Создать ветку `real-tests` или использовать существующую `dev`
2. Переместить `real_tests/` только в эту ветку
3. В `main`/`master` ветке удалить `real_tests/`
4. Настроить GitHub Pages деплой только из `main`/`master`
5. Добавить `real_tests/` в `.gitignore` в `main`/`master`

**Плюсы:**
- Всё в одном репозитории
- Легко переключаться между ветками
- GitHub Pages автоматически не деплоит другие ветки

**Минусы:**
- Риск случайного мерджа в main
- Нужно следить за настройками деплоя

**Команды:**
```bash
# Создать ветку для real_tests
git checkout -b real-tests
# real_tests/ уже есть в этой ветке

# В main ветке:
git checkout main
echo "real_tests/" >> .gitignore
git rm -r --cached real_tests/
git commit -m "Remove real_tests from main (keep in real-tests branch)"

# Настроить GitHub Pages:
# Settings → Pages → Source: Deploy from a branch → main
```

### Решение C: Держать real_tests локально и добавить в .gitignore

**Описание:**
Удалить `real_tests/` из git, но оставить локально. Добавить в `.gitignore`.

**Шаги:**
1. Добавить `real_tests/` в `.gitignore`
2. Удалить `real_tests/` из git индекса (но оставить локально)
3. Закоммитить изменения
4. Создать backup папки на случай потери

**Плюсы:**
- Простое решение
- Не нужны дополнительные репозитории или ветки
- Файлы остаются локально для работы

**Минусы:**
- Нет версионности для real_tests
- Риск потери при переустановке системы
- Нельзя синхронизировать между машинами через git

**Команды:**
```bash
# Добавить в .gitignore
echo "real_tests/" >> .gitignore

# Удалить из git, но оставить локально
git rm -r --cached real_tests/

# Закоммитить
git commit -m "Remove real_tests from repository (keep local)"

# Создать backup
cp -r real_tests/ ~/backup/real_tests/
```

### Рекомендация

**Рекомендуется Решение B (отдельная ветка):**
- Баланс между безопасностью и удобством
- Всё в одном репозитории
- Легко контролировать деплой

**Альтернатива — Решение A (private repo):**
- Если нужна максимальная безопасность
- Если real_tests используются редко

---

## 5. Резюме и план действий

### Критичные действия (обязательно)

1. **Удалить .DS_Store файлы** и добавить в `.gitignore`
2. **Вынести real_tests/** одним из предложенных способов
3. **Создать .gitignore** (если отсутствует) с базовыми правилами

### Рекомендуемые действия

1. **Удалить или вынести dev-only markdown файлы:**
   - `lab/ab-decisions/ARCHITECTURE_PROPOSAL.md`
   - `lab/graphs-as-argument/CHECK_REPORT.md`
   - `lab/ab-practice/ПРАКТИКА_AB_ТЕСТИРОВАНИЯ.md`

2. **Принять решение по документации в корне:**
   - `COURSE_EXTRACT.md`
   - `COURSE_STRUCTURE.md`
   - `PROJECT_STRUCTURE.md`
   - `STRUCTURE_ANALYSIS.md`
   
   Можно оставить (полезная документация) или вынести в отдельную ветку.

3. **Удалить пустую папку:**
   - `lab/monetization/assets/` (если не планируется использование)

### Опциональные действия

1. Проверить все HTML файлы на наличие битых ссылок
2. Проверить все используемые assets на наличие в репозитории
3. Оптимизировать размер репозитория (если есть большие файлы)

---

## 6. Рекомендуемый .gitignore

Создать файл `.gitignore` в корне проекта:

```gitignore
# macOS
.DS_Store
**/.DS_Store

# Windows
Thumbs.db
ehthumbs.db
Desktop.ini

# Editor
.vscode/
.idea/
*.swp
*.swo
*~

# Logs
*.log
npm-debug.log*

# Temporary files
*.tmp
*.temp
*.bak
*.backup

# Python
__pycache__/
*.py[cod]
*$py.class
.pytest_cache/

# Node
node_modules/
npm-debug.log
yarn-error.log

# Real tests (конфиденциальные данные)
real_tests/

# Dev documentation (опционально)
# COURSE_EXTRACT.md
# COURSE_STRUCTURE.md
# PROJECT_STRUCTURE.md
# STRUCTURE_ANALYSIS.md
```

---

## 7. Проверка перед публикацией

### Чеклист перед деплоем на GitHub Pages

- [ ] Все .DS_Store файлы удалены
- [ ] `.gitignore` создан и содержит необходимые правила
- [ ] `real_tests/` вынесен из main ветки или добавлен в `.gitignore`
- [ ] Dev-only markdown файлы удалены или вынесены
- [ ] Пустые папки удалены
- [ ] Настройки GitHub Pages указывают на правильную ветку (main/master)
- [ ] Проверено, что в main ветке нет конфиденциальных данных
- [ ] Создан backup важных файлов

### Команда для финальной проверки

```bash
# Проверить, что real_tests не в main
git ls-files | grep real_tests

# Проверить .DS_Store
find . -name ".DS_Store" -type f

# Проверить размер репозитория
du -sh .

# Проверить, что нет больших файлов (>10MB)
find . -type f -size +10M -not -path "./.git/*"
```

---

## Примечания

- Этот аудит не удаляет файлы автоматически
- Все действия нужно выполнить вручную
- Рекомендуется создать backup перед массовыми изменениями
- После выполнения действий провести повторный аудит

---

**Статус:** Аудит завершён. Требуется ручное выполнение рекомендаций.

