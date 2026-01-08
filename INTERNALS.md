# INTERNALS.md

Внутренние заметки для сопровождения репозитория и деплоя.  
Этот документ предназначен для разработчиков и мейнтейнеров проекта, а не для читателей курса.

---

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

