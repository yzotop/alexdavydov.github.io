# Sync test-task folders from Google Drive (rclone)

Скачивает тестовые задания из Google Drive — включая **private "Shared with me"** папки,
которые недоступны через gdown.

**Скачиваются только документы** (pdf, doc, docx, xls, xlsx, csv, ipynb, txt, md, pptx, ppt).
Видео, картинки, архивы и прочие медиа-файлы **игнорируются** (allowlist + `--exclude "*"`).

## 1. Установка rclone

```bash
brew install rclone
```

## 2. Настройка remote

```bash
rclone config
```

В интерактивном мастере:
1. **n** — new remote
2. Name: **gdrive**
3. Storage: **drive** (Google Drive)
4. client_id / client_secret: оставить пустыми (Enter)
5. Scope: **1** (Full access)
6. root_folder_id: пустой (Enter)
7. service_account_file: пустой (Enter)
8. Advanced config: **n**
9. Auto config: **y** — откроется браузер, залогиниться в Google-аккаунт
10. Team Drive: **n**
11. Подтвердить: **y**

## 3. Проверка доступа

```bash
# Проверить что remote создан
rclone listremotes | grep '^gdrive:$'

# Список shared-with-me папок верхнего уровня (discovery)
rclone lsd gdrive: --drive-shared-with-me

# Содержимое конкретной папки по ID (БЕЗ --drive-shared-with-me!)
rclone lsf gdrive: \
  --drive-root-folder-id "1z7IYlaE8RK6yrQTBba4KGALu8cpd8EGR" \
  --max-depth 1
```

## 4. Запуск

```bash
cd ~/projects/public/alexdavydov.github.io

# Превью — покажет статистику и первые 10 папок
bash scripts/sync_test_tasks_from_gdrive.sh --dry-run

# Реальное скачивание
bash scripts/sync_test_tasks_from_gdrive.sh

# Продолжить с 42-й папки (если прервали)
bash scripts/sync_test_tasks_from_gdrive.sh --start-from 42

# Повторить только FAILED-папки из предыдущего запуска
bash scripts/sync_test_tasks_from_gdrive.sh --only-failed
```

### Подробный прогресс

По умолчанию скрипт показывает только `[N/M] dirname... OK`.
Для подробного прогресса rclone (скорость, ETA) установите переменную:

```bash
TT_PROGRESS=1 bash scripts/sync_test_tasks_from_gdrive.sh
```

> **Примечание:** в режиме `TT_PROGRESS=1` rclone работает на переднем плане —
> защита от >500MB папок не активна. В обычном режиме размер папки проверяется
> каждые 5 секунд и при превышении лимита загрузка прерывается (FAILED_TOO_LARGE).

## 5. Результат

Данные хранятся **вне репозитория**: `~/data/public/davydov-my/test-tasks/`

| Что | Где |
|---|---|
| Скачанные файлы | `~/data/public/davydov-my/test-tasks/raw/<Company — Position [id]>/` |
| Лог | `~/data/public/davydov-my/test-tasks/rclone-sync.log` |
| Логи ошибок (per-folder) | `~/data/public/davydov-my/test-tasks/rclone-fails/<folder_id>.log` |

## 6. Как работает rclone-команда

Скачивание одной папки вручную (для теста):

```bash
rclone copy gdrive: /tmp/test-folder/ \
  --drive-root-folder-id "1z7IYlaE8RK6yrQTBba4KGALu8cpd8EGR" \
  --fast-list \
  --transfers 4 --checkers 8 --tpslimit 10 \
  --retries 3 --low-level-retries 10 --timeout 30s --contimeout 20s \
  --include "*.pdf" --include "*.doc" --include "*.docx" \
  --include "*.xls" --include "*.xlsx" --include "*.csv" \
  --include "*.ipynb" --include "*.txt" --include "*.md" \
  --include "*.pptx" --include "*.ppt" \
  --exclude "*" \
  --stats 5s --stats-one-line --stats-unit bytes \
  --log-level INFO --verbose
```

### Ключевые флаги

| Флаг | Что делает |
|---|---|
| `--drive-root-folder-id ID` | Переключает "корень" Drive на конкретную папку по ID |
| `--include "*.pdf"` ... | Allowlist — скачивает **только** перечисленные расширения |
| `--exclude "*"` | Блокирует всё, что не попало в include (видео, картинки и т.д.) |
| `--transfers 4` | Параллельные загрузки внутри одной папки (4 — безопасный дефолт) |
| `--checkers 8` | Потоки проверки файлов |
| `--tpslimit 10` | Ограничение API-запросов (10 TPS, чтобы не триггерить rate limits) |
| `--retries 3` | Повторные попытки при ошибках |
| `--low-level-retries 10` | Повторы на уровне HTTP (для нестабильного соединения) |
| `--timeout 30s` | Таймаут на передачу данных |
| `--contimeout 20s` | Таймаут на установку соединения |
| `--stats 5s --stats-one-line` | Прогресс каждые 5 секунд (скорость, кол-во файлов, ETA) |
| `--fast-list` | Быстрое получение списка файлов (один API-запрос вместо рекурсии) |

### Почему НЕ используется --drive-shared-with-me

`--drive-shared-with-me` заставляет rclone **игнорировать** `--drive-root-folder-id`
и работать со ВСЕМ содержимым "Shared with me" (сотни файлов и папок).
Без этого флага `--drive-root-folder-id` корректно ограничивает scope до конкретной папки.

Shared-with-me нужен только для **discovery** (просмотр списка расшаренных папок):
```bash
rclone lsd gdrive: --drive-shared-with-me   # OK: discovery
```
Но НЕ для скачивания конкретной папки по ID.

### Фильтр расширений

Скрипт скачивает только:
`pdf`, `doc`, `docx`, `xls`, `xlsx`, `csv`, `ipynb`, `txt`, `md`, `pptx`, `ppt`

Всё остальное (mp4, mov, png, jpg, zip, gz и т.д.) — **игнорируется**.

## 7. Предохранители

| Предохранитель | Что делает |
|---|---|
| **Pre-copy probe** | `rclone lsf --recursive --files-only` с фильтрами. Если 0 doc-файлов → `FAILED_NO_MATCH` |
| **Size guard (500MB)** | Каждые 5 сек проверяет `du -sm`. Если >500MB → kill rclone, `FAILED_TOO_LARGE` |
| **Resume/skip** | Непустая target_dir → SKIP (не перекачивает) |
| **Ctrl+C** | Graceful interrupt, summary, exit 130 |

## 8. Статусы в логе

| Статус | Значение |
|---|---|
| `COPIED` | Успешно скачано |
| `SKIPPED` | Уже скачано (непустая папка) |
| `FAILED_PERMISSION` | Нет доступа к папке (probe failed) |
| `FAILED_NO_MATCH` | 0 doc-файлов в папке (только видео/картинки) |
| `FAILED_TOO_LARGE` | Папка превысила 500MB — загрузка прервана |
| `FAILED` | Ошибка rclone (сеть, таймаут и др.) |
| `INTERRUPTED` | Пользователь нажал Ctrl+C |

## 9. Докачка / retry

```bash
# Повторить только ранее FAILED-папки
bash scripts/sync_test_tasks_from_gdrive.sh --only-failed

# Посмотреть подробный лог конкретной ошибки
cat ~/data/public/davydov-my/test-tasks/rclone-fails/<folder_id>.log
```

`--only-failed` парсит `rclone-sync.log`, находит folder_id с последним статусом `FAILED_*`,
удаляет их (возможно пустые) target_dir и пробует заново.

## 10. Troubleshooting

| Проблема | Решение |
|---|---|
| `ERROR: rclone remote 'gdrive' not configured` | `rclone config` и создать remote `gdrive` |
| `FAILED_PERMISSION` | Владелец папки не расшарил её вашему аккаунту |
| `FAILED_NO_MATCH` | Папка содержит только медиа (видео/фото), а не документы |
| `FAILED_TOO_LARGE` | Папка >500MB даже с фильтрами. Проверить: `rclone lsf gdrive: --drive-root-folder-id ID --recursive --files-only` |
| `googleapi: Error 404` | Папка удалена или ссылка неверная |
| Медленно | Нормально для 100 папок; `--transfers 4` для параллелизма внутри каждой папки |
