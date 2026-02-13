# System Map (system-map/) — каноничная карта системы

```bash
cd /Users/involute/projects/public/alexdavydov.github.io/system-map && ./update_system_map.sh
```

Это **не просто визуализация дерева файлов**.

System Map — это **семантический снапшот** моей персональной системы:
- knowledge management (Obsidian vault)
- проекты/код (projects/)
- runtime state и датасеты (data/)
- автоматизация (jobs / DAGs в personal-os)
- prompt agents (Cursor agents)
- связи (symlinks projects → data)

Карта отвечает на вопросы:
- “Что вообще существует в системе прямо сейчас?”
- “Что канонично, а что runtime?”
- “Где живут агенты и где запускаются процессы?”
- “Как проекты, данные и процессы связаны?”

---

## Каноничные источники (source of truth)

System Map строится **из фактов файловой системы** и registry-доков.

### Root paths
Берутся из:
- `/Users/involute/projects/cursor/registry/paths.yaml`

### Registry (каноника терминов и структуры)
- `/Users/involute/projects/cursor/registry/glossary.md`
- `/Users/involute/projects/cursor/registry/architecture.md`
- `/Users/involute/projects/cursor/registry/agents.md`

### Narrative (не-канонично, заметки)
- `/Users/involute/projects/cursor/memory/*`

---

## Что находится в этой папке

`system-map/` содержит:
- `index.html` — интерактивный viewer
- `system.json` — machine-readable модель системы (с deterministic IDs)
- `update_system_map.sh` — генератор, который пересобирает `system.json` (single snapshot)

---

## Важные принципы

- **Single snapshot**: карта описывает систему “как сейчас”.
- Обновление делается **явно** (командой), авто-обновления нет.
- Viewer не модифицирует систему — это read-only инструмент.
- В UI есть **виртуальные узлы** (UI-only):
  - `All Agents` — агрегирует всех prompt agents
  - `All Jobs` — агрегирует все jobs/dags
  Это не реальные папки и не дубликаты сущностей.

---

## Как посмотреть

### Вариант 1 — просто открыть
Открой `index.html` в браузере.

### Вариант 2 — через локальный сервер (если браузер ругается на fetch)
```bash
cd /Users/involute/projects/public/alexdavydov.github.io/system-map
python3 -m http.server 8080
