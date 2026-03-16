# Entity Registry (Canonical Snapshot)

Дата: 2026-03-16  
Scope: publish-слой `alexdavydov.github.io`

Формат:

- `slug`
- `entity_type`
- `canonical_url`
- `filesystem_path`
- `legacy_urls`
- `status`
- `notes`

| slug | entity_type | canonical_url | filesystem_path | legacy_urls | status | notes |
| --- | --- | --- | --- | --- | --- | --- |
| macbook-market | case | `/cases/macbook-market/` | `cases/macbook-market/` | - | active | Canonical case |
| nloto-portfolio | case | `/cases/nloto-portfolio/` | `cases/nloto-portfolio/` | - | active | Canonical case |
| nikifilini | case | `/cases/nikifilini/` | `cases/nikifilini/` | `/cases/nikifilini/story_v1..v43/*` | active | Redirects configured |
| solvery-mentors | case | `/cases/solvery-mentors/` | `cases/solvery-mentors/` | - | active | Canonical case |
| ab-test | simulator | `/simulators/ab-test/` | `simulators/ab-test/` | - | active | Canonical simulator |
| ad-fatigue | simulator | `/simulators/ad-fatigue/` | `simulators/ad-fatigue/` | `/simulators/ad-fatigue-live/` | active | Live variant exists |
| ad-auction | simulator | `/simulators/ad-auction/` | `simulators/ad-auction/` | `/simulators/ad-auction-pressure/` | active | Pressure variant exists |
| marketplace-live | simulator | `/simulators/marketplace-live/` | `simulators/marketplace-live/` | - | active | Canonical simulator |
| ride-hailing | simulator | `/simulators/ride-hailing/` | `simulators/ride-hailing/` | `/simulators/ride-hailing-mvp/` | active | MVP variant exists |
| ad-monetization | simulator | `/simulators/ad-monetization/` | `simulators/ad-monetization/` | `/calculators/ad-monetization/` | active | Multi-surface alias |
| scenario-planning | calculator | `/calculators/scenario-planning/` | `calculators/scenario-planning/` | `/lab/simulators/scenario-planning/`, `/lab/calculators/scenario-planning/` | active | Canonical calculator |
| revenue | calculator | `/calculators/revenue/` | `calculators/revenue/index.html` | `/calculators/lab/revenue.html`, `/lab/calculators/revenue.html` | active | Stage-2C: flat canonical surface; shared assets from `/calculators/lab/assets/*`; `links.css` fixed to stable `/lab/assets/css/links.css` |
| rollout | calculator | `/calculators/rollout/` | `calculators/rollout/index.html` | `/calculators/lab/rollout.html`, `/lab/calculators/rollout.html` | active | Stage-2A: flat canonical surface; shared assets still from `/calculators/lab/assets/*` |
| rollout-compare | calculator | `/calculators/rollout-compare/` | `calculators/rollout-compare/index.html` | `/calculators/lab/rollout-compare.html`, `/lab/calculators/rollout-compare.html` | active | Stage-2B: flat canonical surface; shared assets still from `/calculators/lab/assets/*` |
| funnel-sensitivity | calculator | `/calculators/funnel-sensitivity/` | `calculators/funnel-sensitivity/index.html` | `/calculators/lab/funnel-sensitivity.html`, `/lab/calculators/funnel-sensitivity.html` | active | Stage-2D: flat canonical surface; shared assets still from `/calculators/lab/assets/*` |
| monetization | course | `/lab/monetization/` | `lab/monetization/` | - | active | Course content in lab layer |
| ab-decisions | course | `/lab/ab-decisions/` | `lab/ab-decisions/` | removed practice/checklist paths | active | Course content in lab layer |
| product-analytics | course | `/lab/product-analytics/` | `lab/product-analytics/` | - | active | Course content in lab layer |
| ab-stat-os | course | `/lab/ab-stat-os/` | `lab/ab-stat-os/` | - | draft | Course content in lab layer |
| quasi-experiments | course | `/lab/quasi-experiments/` | `lab/quasi-experiments/` | - | active | Course content in lab layer |
| glossary | knowledge-page | `/lab/glossary/` | `lab/glossary/` | - | active | Domain glossary page |
| knowledge-main | knowledge-hub | `/knowledge/` | `knowledge/index.html` | - | active | Knowledge section hub |
| courses-main | catalog-hub | `/courses/` | `courses/index.html` | - | active | Catalog reads from `lab/_manifest.json` |

## Legacy / compatibility layers (non-canonical)

| path | role | status |
| --- | --- | --- |
| `/lab/calculators/*` | compatibility redirects to canonical calculators (`/calculators/*`); hub aliases resolve to `/calculators/` | legacy |
| `/lab/simulators/*` | nested lab hub (non-canonical for simulator entities) | legacy/secondary |
| `/calculators/lab/*` | nested legacy calculator layer | legacy |

Stage-1 note:

- `calculators/index.html` больше не использует relative `./lab/*` для этих 4 calculator surfaces.
- Stage-2A update: `rollout` переведён в flat canonical `/calculators/rollout/`.
- Stage-2B update: `rollout-compare` переведён в flat canonical `/calculators/rollout-compare/`.
- Stage-2C update: `revenue` переведён в flat canonical `/calculators/revenue/`.
- Stage-2D update: `funnel-sensitivity` переведён в flat canonical `/calculators/funnel-sensitivity/`.
- Stage-3B update: heavy compatibility pages в `calculators/lab/` (4 main + 4 about) заменены на thin redirect stubs к flat canonical surfaces.
- `calculators/lab/index.html` на этом шаге намеренно не менялся.
- Stage-3C update: `calculators/lab/index.html` и hub aliases `/lab/calculators/`, `/lab/calculators/index.html` теперь резолвятся в `/calculators/`.
- `rollout` migration (Stage-2A) остаётся без изменений.
- `rollout-compare` migration (Stage-2B) остаётся без изменений.
- `revenue` migration (Stage-2C) остаётся без изменений.
