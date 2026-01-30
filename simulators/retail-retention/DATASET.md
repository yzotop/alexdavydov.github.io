# Retail Retention & Revenue Lab — Dataset & Preprocessing

## Dataset
- **Name**: Online Retail II (UCI)
- **Kaggle**: `mashlyn/online-retail-ii-uci`

This simulator is **static** (GitHub Pages). It cannot run Python in the browser, so the dataset must be downloaded manually and preprocessed locally into JSON.

## How to download CSV (manual, login required)
1) Open Kaggle and find dataset `mashlyn/online-retail-ii-uci` (search by name).
2) Log in (Kaggle requires login to download).
3) Click **Download** and extract the archive if needed.
4) Ensure you have a **CSV** file with columns like `Invoice`, `StockCode`, `Description`, `Quantity`, `InvoiceDate`, `UnitPrice`, `CustomerID`, `Country`.

## Where to put the CSV
Place the CSV at:

- `simulators/retail-retention/data/raw/online_retail_ii.csv`

Notes:
- The repo ignores this folder (`data/raw/`) to avoid committing the large Kaggle file.
- macOS is usually case-insensitive, but the expected filename is `online_retail_ii.csv`.

## How to run preprocessing
From repo root:

```bash
python3 scripts/retail_preprocess.py \
  --input simulators/retail-retention/data/raw/online_retail_ii.csv \
  --out simulators/retail-retention/data/processed
```

Optional:
- `--max_offsets N` to cap the cohort horizon (defaults: 12 for months, 16 for weeks).

## What files are generated
The script writes **8** JSON variants (2×2×2 toggles):

- `simulators/retail-retention/data/processed/variant_month_ret0_anon0.json`
- `simulators/retail-retention/data/processed/variant_month_ret0_anon1.json`
- `simulators/retail-retention/data/processed/variant_month_ret1_anon0.json`
- `simulators/retail-retention/data/processed/variant_month_ret1_anon1.json`
- `simulators/retail-retention/data/processed/variant_week_ret0_anon0.json`
- `simulators/retail-retention/data/processed/variant_week_ret0_anon1.json`
- `simulators/retail-retention/data/processed/variant_week_ret1_anon0.json`
- `simulators/retail-retention/data/processed/variant_week_ret1_anon1.json`

The frontend reads **only** these processed JSON files.

## Troubleshooting
- **Encoding / weird characters in Description**: the script reads CSV with permissive decoding; if you still see issues, re-save CSV as UTF‑8.
- **Date parsing errors**: `InvoiceDate` can be ambiguous (month-first vs day-first). The script uses a heuristic and multiple formats; if your export differs, open an issue and include a sample of a few `InvoiceDate` values.
- **Big file / slow run**: preprocessing can take time. It’s a one-time step; commit the processed JSON files to the repo for GitHub Pages.
- **Empty matrices**: if filters remove everything (e.g. returns-only), the script fails fast and tells you which variant is empty.

