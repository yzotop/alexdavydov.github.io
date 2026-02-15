# NIKIFILINI — Telegram Story Pack

5 вертикальных слайдов (1080×1920) для Telegram по кейсу NIKIFILINI.

**Сторис не публикуются на сайт, только для Telegram.**

## Структура

```
stories/nikifilini-telega/
├── build_story_artifacts.py   # Агрегация CSV → story_summary.json
├── story.html                 # 5 слайдов (превью в браузере)
├── charts_story.js            # SVG-рендер графиков
├── export_story.py            # Экспорт слайдов в PNG (Playwright)
├── story_summary.json         # Данные для графиков (авто)
├── requirements.txt
├── README.md
└── export/
    ├── 01.png                 # Слайд 1: Cover + KPI
    ├── 02.png                 # Слайд 2: Ассортимент
    ├── 03.png                 # Слайд 3: Цены
    ├── 04.png                 # Слайд 4: Промо / скидки
    └── 05.png                 # Слайд 5: Stock-out
```

## Запуск

```bash
cd stories/nikifilini-telega
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
playwright install chromium

# 1. Сгенерировать данные
python3 build_story_artifacts.py

# 2. Экспортировать PNG
python3 export_story.py
```

PNG будут в `stories/nikifilini-telega/export/01.png … 05.png`.

## Превью

Открой `story.html` в браузере (через локальный сервер для загрузки JSON):

```bash
python3 -m http.server 8890
# → http://localhost:8890/story.html
```

## Источник данных

CSV каталога NIKIFILINI: `cases/nikifilini/nikifilini_catalog.csv`
