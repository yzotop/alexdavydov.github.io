# Solvery Mentors — Data Extraction & Analytics Pipeline

A fully reproducible pipeline for extracting and analysing the public
[Solvery mentors catalog](https://solvery.io/ru/mentors). The pipeline
detects the API endpoint automatically, extracts all mentor records with
pagination support, validates the data, and produces analytical outputs
including TF-IDF + KMeans clustering.

## Project Structure

```
solvery_research/
├── detect_endpoint.py            # Step 1: Detect API endpoint via Playwright
├── solvery_extractor.py          # Step 2–3: Extract all mentors + validate
├── solvery_analysis.ipynb        # Step 4–5: EDA notebook + TF-IDF clustering
├── pyproject.toml                # Tooling config (black, ruff, mypy)
├── requirements.txt              # Python dependencies
├── README.md
│
│   Generated artefacts:
├── detected_endpoint.txt         # Detected endpoint configuration (JSON)
├── solvery_mentors_raw.json      # Raw API responses
├── solvery_mentors.csv           # Normalised flat dataset (14 fields)
└── solvery_mentors_clustered.csv # Dataset with KMeans cluster labels
```

## Prerequisites

- Python ≥ 3.11
- pip

## Setup

```bash
cd solvery_research
python -m venv .venv
source .venv/bin/activate        # macOS / Linux
pip install -r requirements.txt
playwright install chromium
```

## Running the Pipeline

Execute the steps **in order**:

```bash
# Step 1 — Detect the API endpoint (opens a headed browser)
python detect_endpoint.py

# Step 2 — Extract all mentors + print validation report (Step 3)
python solvery_extractor.py

# Step 4–5 — Open the analysis notebook
jupyter notebook solvery_analysis.ipynb
```

### Step 1: Endpoint Detection (`detect_endpoint.py`)

Opens a Chromium browser in **headed mode**, navigates to the mentors
catalog, clicks the "Показать еще" button, intercepts network traffic,
identifies JSON responses containing mentor data, and saves the best
endpoint configuration to `detected_endpoint.txt`.

### Step 2–3: Data Extraction & Validation (`solvery_extractor.py`)

Reads the endpoint from `detected_endpoint.txt`, auto-detects the
pagination strategy (page / offset+limit / cursor), iterates through all
pages, normalises fields, deduplicates by `mentor_id`, and saves:

- `solvery_mentors_raw.json` — raw API responses
- `solvery_mentors.csv` — normalised flat CSV

A **validation report** is printed at the end:

| Metric                  | Description                       |
|-------------------------|-----------------------------------|
| Total mentors           | Number of unique records          |
| Duplicate `mentor_id`s  | Count of duplicate IDs            |
| % missing price         | Mentors without a price value     |
| % missing sessions      | Mentors without a sessions count  |
| % missing reviews       | Mentors without a reviews count   |

### Step 4–5: Analysis Notebook (`solvery_analysis.ipynb`)

1. Loads the CSV and converts numeric columns.
2. Plots price and session-count histograms.
3. Plots scatter charts (price vs sessions, sessions vs reviews).
4. Computes median price and median sessions by the top 15 skills.
5. Prints the correlation matrix.
6. Lists top 20 mentors by sessions, top 20 by reviews, and 10 cheapest
   mentors with 200+ sessions.
7. Applies TF-IDF vectorisation on skills and KMeans clustering (k=5).
8. Saves `solvery_mentors_clustered.csv`.

## Code Quality

The project is configured for automated checks via `pyproject.toml`:

```bash
# Format
black detect_endpoint.py solvery_extractor.py

# Lint
ruff check detect_endpoint.py solvery_extractor.py

# Type-check
mypy detect_endpoint.py solvery_extractor.py

# Notebook lint
nbqa ruff solvery_analysis.ipynb
```

## Ethical Scraping Disclaimer

This project accesses only **publicly available data** through the same
API endpoints that the Solvery website uses for its public catalog page.

- **Respects `robots.txt`** directives.
- **Does NOT scrape individual profile pages** — only the catalog listing
  endpoint (triggered by the "Показать еще" button).
- Adds a **0.5–1.0 second random delay** between requests.
- Includes **3 retries with exponential backoff** for transient errors.
- Sets a realistic `User-Agent` header and standard browser headers.
- Stops automatically after **3 consecutive empty responses**.

## Data Usage Note

The extracted data is intended for **research and educational purposes
only**. Do not redistribute the data or use it for commercial purposes
without reviewing and complying with the
[Solvery Terms of Service](https://solvery.io). The authors of this
project bear no responsibility for misuse of the extracted data.
