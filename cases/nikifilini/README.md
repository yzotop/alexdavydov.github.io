# NIKIFILINI Store — D2C Fashion Catalog Analysis

Extraction and analysis of the public [NIKIFILINI](https://nikifilinistore.ru)
product catalog. The pipeline scrapes the WooCommerce shop listing,
normalises product data, and produces analytical outputs including
price distributions, category breakdowns, and stock-out analysis.

## Project Structure

```
cases/nikifilini/
├── nikifilini_extractor.py      # Step 1: Scrape catalog (HTML parsing)
├── build_case_artifacts.py      # Step 2: Aggregate → summary.json
├── charts.js                    # SVG chart rendering (vanilla JS)
├── index.html                   # Case study page
├── pyproject.toml               # Tooling config (black, ruff, mypy)
├── requirements.txt             # Python dependencies
├── README.md
│
│   Generated artefacts:
├── nikifilini_catalog_raw.json  # Raw scraped records
├── nikifilini_catalog.csv       # Normalised flat dataset
└── summary.json                 # Aggregated data for charts
```

## Prerequisites

- Python ≥ 3.11
- pip

## Setup

```bash
cd cases/nikifilini
python -m venv venv
source venv/bin/activate        # macOS / Linux
pip install -r requirements.txt
```

## Running the Pipeline

```bash
# Step 1 — Scrape the catalog (~2–3 min with rate limiting)
python nikifilini_extractor.py

# Step 2 — Build summary.json
python build_case_artifacts.py

# Step 3 — Open the case study page
open index.html
# or serve locally:
python -m http.server 8889
```

## Ethical Scraping Disclaimer

This project accesses only **publicly available data** from the
NIKIFILINI online store catalog.

- **Does NOT scrape personal data** — only product listings.
- **Does NOT bypass authentication** or CAPTCHA.
- Adds a **0.4–1.0 second random delay** between requests.
- Includes **3 retries with exponential backoff** for transient errors.
- Sets a realistic `User-Agent` header.
- Stops automatically after **3 consecutive empty responses**.

## Data Usage Note

The extracted data is intended for **research and educational purposes
only**. Do not redistribute the data or use it for commercial purposes.
