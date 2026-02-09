# Download test-task folders from Google Drive

Скачивает содержимое папок Google Drive по ссылкам из `data/test-tasks.v1.json`.

## Установка

```bash
cd /path/to/alexdavydov.github.io
python3 -m venv .venv && source .venv/bin/activate
pip install -r scripts/requirements-download.txt
```

## Запуск

```bash
# Превью (без скачивания)
python3 scripts/download_test_tasks_from_drive.py --dry-run

# Полное скачивание
python3 scripts/download_test_tasks_from_drive.py
```

## Результат

| Что | Где |
|---|---|
| Скачанные файлы | `data/test-tasks/raw/<folder>/` |
| Лог скачивания | `data/test-tasks/download.log` |

## Ошибки доступа

Если папка требует авторизации, в логе и в stdout будет `FAILED_PERMISSION`.
Скрипт продолжит скачивание остальных папок. В конце — summary со списком failed.
