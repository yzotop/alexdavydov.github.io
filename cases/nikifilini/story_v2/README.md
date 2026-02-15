# NIKIFILINI — Telegram Story Pack V2

Refined visual system with subtle color accents.  
5 vertical slides (1080×1920) for Telegram stories.

**Stories are NOT published on the website — Telegram only.**

## Quick start

```bash
cd cases/nikifilini/story_v2
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
playwright install chromium

python3 build_story_artifacts.py   # → story_summary.json
python3 export_story.py            # → export/story_01.png … story_05.png
```

## Preview

Open `story.html` via a local server (fetch needs HTTP):

```bash
python3 -m http.server 8080
# open http://localhost:8080/story.html
```

## Color system

| Theme             | Color   | Hex       |
|-------------------|---------|-----------|
| Ассортимент       | graphite| `#2B2B2B` |
| Цены              | blue    | `#3A6EA5` |
| Скидки            | amber   | `#C68A2E` |
| Stock-out         | red     | `#C44536` |
