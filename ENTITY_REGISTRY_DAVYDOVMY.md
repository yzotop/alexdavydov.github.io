# ENTITY REGISTRY V2: davydov.my

Generated from current publish layer snapshot in:
`/Users/involute/projects/public/alexdavydov.github.io`

Scanned sections:
- `/cases`
- `/simulators`
- `/calculators`
- `/lab`
- `/knowledge`
- `/career`
- `/companies`

## Section Hubs
| entity | canonical_path | notes |
|---|---|---|
| cases | `/cases` | Section hub for case studies |
| simulators | `/simulators` | Section hub for live simulators |
| calculators | `/calculators` | Section hub for parameter calculators |
| lab | `/lab` | Tools/lab hub |
| knowledge | `/knowledge` | Knowledge hub |
| career | `/career` | Career hub |
| companies | `/companies` | Companies landing/hub |

## Canonical Content Entities
| entity | canonical_type | canonical_path | aliases | relation_type | status | notes |
|---|---|---|---|---|---|---|
| macbook-market | case | `/cases/macbook-market` | - | none | active | Canonical case |
| nloto-portfolio | case | `/cases/nloto-portfolio` | - | none | active | Canonical case |
| nikifilini | case | `/cases/nikifilini` | - | none | active | Canonical case |
| solvery-mentors | case | `/cases/solvery-mentors` | - | none | active | Canonical case |
| ab-test | simulator | `/simulators/ab-test` | - | none | active | Canonical simulator |
| ad-fatigue | simulator | `/simulators/ad-fatigue` | - | none | active | Base entity for live variant |
| marketplace-live | simulator | `/simulators/marketplace-live` | - | none | active | Standalone live simulator |
| ad-auction | simulator | `/simulators/ad-auction` | - | none | active | Base entity for pressure variant |
| ride-hailing | simulator | `/simulators/ride-hailing` | - | none | active | Calculator surface removed; simulator remains canonical |
| ad-monetization | simulator | `/simulators/ad-monetization` | `/calculators/ad-monetization` | multi-surface | active | One entity exposed in two sections |
| scenario-planning | calculator | `/calculators/scenario-planning` | - | none | active | Canonical calculator |
| rollout | calculator | `/calculators/rollout` | `/calculators/lab/rollout.html`, `/lab/calculators/rollout.html` | canonical+compat | active | Stage-2A flat canonical surface |
| rollout-compare | calculator | `/calculators/rollout-compare` | `/calculators/lab/rollout-compare.html`, `/lab/calculators/rollout-compare.html` | canonical+compat | active | Stage-2B flat canonical surface |
| revenue | calculator | `/calculators/revenue` | `/calculators/lab/revenue.html`, `/lab/calculators/revenue.html` | canonical+compat | active | Stage-2C flat canonical surface |
| funnel-sensitivity | calculator | `/calculators/funnel-sensitivity` | `/calculators/lab/funnel-sensitivity.html`, `/lab/calculators/funnel-sensitivity.html` | canonical+compat | active | Stage-2D flat canonical surface |
| monetization | course | `/lab/monetization` | - | none | active | Canonical lab course |
| ab-decisions | course | `/lab/ab-decisions` | - | none | active | Practice/checklist removed; core course active |
| product-analytics | course | `/lab/product-analytics` | - | none | active | Canonical lab course |
| ab-stat-os | course | `/lab/ab-stat-os` | - | none | draft | Draft status from manifest |
| quasi-experiments | course | `/lab/quasi-experiments` | - | none | active | Canonical lab course |
| glossary | knowledge-page | `/lab/glossary` | - | none | active | Lab glossary |
| analytics | knowledge-page | `/knowledge/analytics` | - | none | active | Knowledge section page |
| competencies | course | `/knowledge/competencies` | - | none | active | Competency framework section |
| test-tasks | knowledge-page | `/knowledge/test-tasks` | - | none | active | Knowledge page |
| blog | knowledge-page | `/knowledge/blog` | - | none | active | Knowledge/blog landing |
| management | knowledge-page | `/knowledge/management` | - | none | active | Knowledge page |
| executive | career-page | `/career/executive` | - | none | active | Career deep-dive page |
| results | career-page | `/career/results` | - | none | active | Career outcomes page |
| companies-main | landing | `/companies` | - | none | active | Companies landing page |

## Variants / Aliases / Misplaced
| entity | path | relation_to | relation_type | status | notes |
|---|---|---|---|---|---|
| ad-fatigue-live | `/simulators/ad-fatigue-live` | ad-fatigue | variant | active | Live variant |
| ad-auction-pressure | `/simulators/ad-auction-pressure` | ad-auction | variant | active | Pressure variant |
| ride-hailing-mvp | `/simulators/ride-hailing-mvp` | ride-hailing | variant | active | MVP branch |
| ad-monetization (calculator surface) | `/calculators/ad-monetization` | ad-monetization | alias | active | Calculator alias for simulator entity |
| revenue (calculator nested surface) | `/calculators/lab/revenue.html` | revenue | compatibility | legacy | Stage-2C: flat canonical `/calculators/revenue` is active |
| rollout (calculator nested surface) | `/calculators/lab/rollout.html` | rollout | compatibility | legacy | Stage-2A: flat canonical `/calculators/rollout` is active |
| rollout-compare (calculator nested surface) | `/calculators/lab/rollout-compare.html` | rollout-compare | compatibility | legacy | Stage-2B: flat canonical `/calculators/rollout-compare` is active |
| funnel-sensitivity (calculator nested surface) | `/calculators/lab/funnel-sensitivity.html` | funnel-sensitivity | compatibility | legacy | Stage-2D: flat canonical `/calculators/funnel-sensitivity` is active |
| lab/calculators hub | `/lab/calculators` | calculators | hub | legacy | Nested hub still present |
| lab/simulators hub | `/lab/simulators` | simulators | hub | legacy | Nested hub still present (compatibility layer) |
| calculators/lab hub | `/calculators/lab` | lab | misplaced | legacy | Nested lab hub under calculators |

## Removed / Deprecated
| entity | previous_path | removal_status | notes |
|---|---|---|---|
| warehouse-ops | `/simulators/warehouse-ops` | removed | Simulator removed from publish layer |
| retail-retention | `/simulators/retail-retention` | removed | Simulator removed from publish layer |
| aladdin-lite | `/lab/simulators/aladdin-lite` | removed | Lab simulator removed |
| ride-hailing (calculator surface) | `/calculators/ride-hailing` | removed | Alias surface removed; simulator remains active |
| practice | `/lab/ab-decisions/practice/` | removed | Practice block/pages removed |
| checklist | `/lab/ab-decisions/checklist.html` | removed | Checklist page removed |
| experiments | `/lab/experiments/` | removed | Course removed |
| graphs-analytics | `/lab/graphs-analytics/` | removed | Course removed |

## Summary
- Total active entities by type (canonical table):
  - `case`: 4
  - `simulator`: 5
  - `calculator`: 5
  - `course`: 6
  - `knowledge-page`: 5
  - `career-page`: 2
  - `landing`: 1
- Total removed entities: 8
- Open ambiguities:
  - `lab/monetization/experiments/*` pages still exist and are active as a **module inside monetization**, despite removal of standalone `/lab/experiments/`.
  - Nested hubs (`/lab/calculators`, `/calculators/lab`) are legacy/misplaced and may need normalization in v3.
- Stage-1 migration status (calculators):
  - Completed for `revenue`, `rollout`, `rollout-compare`, `funnel-sensitivity`.
  - `calculators/index.html` now uses flat canonical calculator targets for all stage-2 migrated entities.
- Stage-2A migration status:
  - `rollout` moved to flat canonical surface: `/calculators/rollout` (+ `/calculators/rollout/about/`).
  - Nested `/calculators/lab/rollout.html` retained as compatibility/runtime legacy surface.
  - Shared assets for rollout remain served from `/calculators/lab/assets/*`.
- Stage-2B migration status:
  - `rollout-compare` moved to flat canonical surface: `/calculators/rollout-compare` (+ `/calculators/rollout-compare/about/`).
  - Nested `/calculators/lab/rollout-compare.html` retained as compatibility/runtime legacy surface.
  - Shared assets for rollout-compare remain served from `/calculators/lab/assets/*`.
  - Stage-2A rollout migration remains unchanged.
- Stage-2C migration status:
  - `revenue` moved to flat canonical surface: `/calculators/revenue` (+ `/calculators/revenue/about/`).
  - Nested `/calculators/lab/revenue.html` retained as compatibility/runtime legacy surface.
  - Shared assets for revenue remain served from `/calculators/lab/assets/*`.
  - Path-sensitive dependency fixed via stable `/lab/assets/css/links.css`.
  - Glossary anchors `/lab/glossary/#...` preserved.
  - Stage-2A rollout and Stage-2B rollout-compare migrations remain unchanged.
- Stage-2D migration status:
  - `funnel-sensitivity` moved to flat canonical surface: `/calculators/funnel-sensitivity` (+ `/calculators/funnel-sensitivity/about/`).
  - Nested `/calculators/lab/funnel-sensitivity.html` retained as compatibility/runtime legacy surface.
  - Shared assets for funnel-sensitivity remain served from `/calculators/lab/assets/*`.
  - DOM-heavy and inline-style sections preserved with minimal path rewiring.
  - Stage-2A rollout, Stage-2B rollout-compare, and Stage-2C revenue migrations remain unchanged.
- Stage-3A cleanup status:
  - Legacy alias pages in `/lab/calculators/{revenue,rollout,rollout-compare,funnel-sensitivity}.html` now redirect directly to flat canonical `/calculators/<slug>/`.
  - Intermediate hop via `/calculators/lab/<slug>.html` removed for these 4 aliases.
  - `calculators/lab/*` and `calculators/lab/assets/*` remain unchanged.
- Stage-3B cleanup status:
  - Heavy compatibility pages in `/calculators/lab/` (4 main + 4 about) converted to thin redirect stubs.
  - Legacy URLs are preserved as compatibility endpoints targeting flat canonical calculators.
  - `calculators/lab/assets/*` remains active and unchanged.
  - `calculators/lab/index.html` intentionally unchanged in this step.
- Stage-3C cleanup status:
  - `calculators/lab/index.html` converted from legacy hub to thin redirect stub targeting `/calculators/`.
  - `/lab/calculators/` and `/lab/calculators/index.html` hub aliases now resolve directly to `/calculators/`.
  - `calculators/lab/` is treated as compatibility/asset-layer entry rather than nested runtime hub.
  - `calculators/lab/assets/*` remains active and unchanged.

## Machine-Readable Block

```json
{
  "registry_version": "v2",
  "site": "davydov.my",
  "generated_at": "2026-03-11",
  "workspace_root": "/Users/involute/projects/public/alexdavydov.github.io",
  "section_hubs": [
    {"entity":"cases","canonical_path":"/cases","notes":"Section hub for case studies"},
    {"entity":"simulators","canonical_path":"/simulators","notes":"Section hub for live simulators"},
    {"entity":"calculators","canonical_path":"/calculators","notes":"Section hub for parameter calculators"},
    {"entity":"lab","canonical_path":"/lab","notes":"Tools/lab hub"},
    {"entity":"knowledge","canonical_path":"/knowledge","notes":"Knowledge hub"},
    {"entity":"career","canonical_path":"/career","notes":"Career hub"},
    {"entity":"companies","canonical_path":"/companies","notes":"Companies landing/hub"}
  ],
  "canonical_content_entities": [
    {"entity":"macbook-market","canonical_type":"case","canonical_path":"/cases/macbook-market","aliases":[],"relation_type":"none","status":"active","notes":"Canonical case"},
    {"entity":"nloto-portfolio","canonical_type":"case","canonical_path":"/cases/nloto-portfolio","aliases":[],"relation_type":"none","status":"active","notes":"Canonical case"},
    {"entity":"nikifilini","canonical_type":"case","canonical_path":"/cases/nikifilini","aliases":[],"relation_type":"none","status":"active","notes":"Canonical case"},
    {"entity":"solvery-mentors","canonical_type":"case","canonical_path":"/cases/solvery-mentors","aliases":[],"relation_type":"none","status":"active","notes":"Canonical case"},
    {"entity":"ab-test","canonical_type":"simulator","canonical_path":"/simulators/ab-test","aliases":[],"relation_type":"none","status":"active","notes":"Canonical simulator"},
    {"entity":"ad-fatigue","canonical_type":"simulator","canonical_path":"/simulators/ad-fatigue","aliases":[],"relation_type":"none","status":"active","notes":"Base entity for live variant"},
    {"entity":"marketplace-live","canonical_type":"simulator","canonical_path":"/simulators/marketplace-live","aliases":[],"relation_type":"none","status":"active","notes":"Standalone live simulator"},
    {"entity":"ad-auction","canonical_type":"simulator","canonical_path":"/simulators/ad-auction","aliases":[],"relation_type":"none","status":"active","notes":"Base entity for pressure variant"},
    {"entity":"ride-hailing","canonical_type":"simulator","canonical_path":"/simulators/ride-hailing","aliases":[],"relation_type":"none","status":"active","notes":"Calculator surface removed; simulator remains canonical"},
    {"entity":"ad-monetization","canonical_type":"simulator","canonical_path":"/simulators/ad-monetization","aliases":["/calculators/ad-monetization"],"relation_type":"multi-surface","status":"active","notes":"One entity exposed in two sections"},
    {"entity":"scenario-planning","canonical_type":"calculator","canonical_path":"/calculators/scenario-planning","aliases":[],"relation_type":"none","status":"active","notes":"Canonical calculator"},
    {"entity":"rollout","canonical_type":"calculator","canonical_path":"/calculators/rollout","aliases":["/calculators/lab/rollout.html","/lab/calculators/rollout.html"],"relation_type":"canonical+compat","status":"active","notes":"Stage-2A flat canonical surface"},
    {"entity":"rollout-compare","canonical_type":"calculator","canonical_path":"/calculators/rollout-compare","aliases":["/calculators/lab/rollout-compare.html","/lab/calculators/rollout-compare.html"],"relation_type":"canonical+compat","status":"active","notes":"Stage-2B flat canonical surface"},
    {"entity":"revenue","canonical_type":"calculator","canonical_path":"/calculators/revenue","aliases":["/calculators/lab/revenue.html","/lab/calculators/revenue.html"],"relation_type":"canonical+compat","status":"active","notes":"Stage-2C flat canonical surface"},
    {"entity":"funnel-sensitivity","canonical_type":"calculator","canonical_path":"/calculators/funnel-sensitivity","aliases":["/calculators/lab/funnel-sensitivity.html","/lab/calculators/funnel-sensitivity.html"],"relation_type":"canonical+compat","status":"active","notes":"Stage-2D flat canonical surface"},
    {"entity":"monetization","canonical_type":"course","canonical_path":"/lab/monetization","aliases":[],"relation_type":"none","status":"active","notes":"Canonical lab course"},
    {"entity":"ab-decisions","canonical_type":"course","canonical_path":"/lab/ab-decisions","aliases":[],"relation_type":"none","status":"active","notes":"Practice/checklist removed; core course active"},
    {"entity":"product-analytics","canonical_type":"course","canonical_path":"/lab/product-analytics","aliases":[],"relation_type":"none","status":"active","notes":"Canonical lab course"},
    {"entity":"ab-stat-os","canonical_type":"course","canonical_path":"/lab/ab-stat-os","aliases":[],"relation_type":"none","status":"draft","notes":"Draft status from manifest"},
    {"entity":"quasi-experiments","canonical_type":"course","canonical_path":"/lab/quasi-experiments","aliases":[],"relation_type":"none","status":"active","notes":"Canonical lab course"},
    {"entity":"glossary","canonical_type":"knowledge-page","canonical_path":"/lab/glossary","aliases":[],"relation_type":"none","status":"active","notes":"Lab glossary"},
    {"entity":"analytics","canonical_type":"knowledge-page","canonical_path":"/knowledge/analytics","aliases":[],"relation_type":"none","status":"active","notes":"Knowledge section page"},
    {"entity":"competencies","canonical_type":"course","canonical_path":"/knowledge/competencies","aliases":[],"relation_type":"none","status":"active","notes":"Competency framework section"},
    {"entity":"test-tasks","canonical_type":"knowledge-page","canonical_path":"/knowledge/test-tasks","aliases":[],"relation_type":"none","status":"active","notes":"Knowledge page"},
    {"entity":"blog","canonical_type":"knowledge-page","canonical_path":"/knowledge/blog","aliases":[],"relation_type":"none","status":"active","notes":"Knowledge/blog landing"},
    {"entity":"management","canonical_type":"knowledge-page","canonical_path":"/knowledge/management","aliases":[],"relation_type":"none","status":"active","notes":"Knowledge page"},
    {"entity":"executive","canonical_type":"career-page","canonical_path":"/career/executive","aliases":[],"relation_type":"none","status":"active","notes":"Career deep-dive page"},
    {"entity":"results","canonical_type":"career-page","canonical_path":"/career/results","aliases":[],"relation_type":"none","status":"active","notes":"Career outcomes page"},
    {"entity":"companies-main","canonical_type":"landing","canonical_path":"/companies","aliases":[],"relation_type":"none","status":"active","notes":"Companies landing page"}
  ],
  "variants_aliases_misplaced": [
    {"entity":"ad-fatigue-live","path":"/simulators/ad-fatigue-live","relation_to":"ad-fatigue","relation_type":"variant","status":"active","notes":"Live variant"},
    {"entity":"ad-auction-pressure","path":"/simulators/ad-auction-pressure","relation_to":"ad-auction","relation_type":"variant","status":"active","notes":"Pressure variant"},
    {"entity":"ride-hailing-mvp","path":"/simulators/ride-hailing-mvp","relation_to":"ride-hailing","relation_type":"variant","status":"active","notes":"MVP branch"},
    {"entity":"ad-monetization (calculator surface)","path":"/calculators/ad-monetization","relation_to":"ad-monetization","relation_type":"alias","status":"active","notes":"Calculator alias for simulator entity"},
    {"entity":"revenue (calculator nested surface)","path":"/calculators/lab/revenue.html","relation_to":"revenue","relation_type":"compatibility","status":"legacy","notes":"Stage-2C: flat canonical /calculators/revenue is active"},
    {"entity":"rollout (calculator nested surface)","path":"/calculators/lab/rollout.html","relation_to":"rollout","relation_type":"compatibility","status":"legacy","notes":"Stage-2A: flat canonical /calculators/rollout is active"},
    {"entity":"rollout-compare (calculator nested surface)","path":"/calculators/lab/rollout-compare.html","relation_to":"rollout-compare","relation_type":"compatibility","status":"legacy","notes":"Stage-2B: flat canonical /calculators/rollout-compare is active"},
    {"entity":"funnel-sensitivity (calculator nested surface)","path":"/calculators/lab/funnel-sensitivity.html","relation_to":"funnel-sensitivity","relation_type":"compatibility","status":"legacy","notes":"Stage-2D: flat canonical /calculators/funnel-sensitivity is active"},
    {"entity":"lab/calculators hub","path":"/lab/calculators","relation_to":"calculators","relation_type":"hub","status":"legacy","notes":"Nested hub still present"},
    {"entity":"lab/simulators hub","path":"/lab/simulators","relation_to":"simulators","relation_type":"hub","status":"legacy","notes":"Nested hub still present (compatibility layer)"},
    {"entity":"calculators/lab hub","path":"/calculators/lab","relation_to":"lab","relation_type":"misplaced","status":"legacy","notes":"Nested lab hub under calculators"}
  ],
  "removed_deprecated": [
    {"entity":"warehouse-ops","previous_path":"/simulators/warehouse-ops","removal_status":"removed","notes":"Simulator removed from publish layer"},
    {"entity":"retail-retention","previous_path":"/simulators/retail-retention","removal_status":"removed","notes":"Simulator removed from publish layer"},
    {"entity":"aladdin-lite","previous_path":"/lab/simulators/aladdin-lite","removal_status":"removed","notes":"Lab simulator removed"},
    {"entity":"ride-hailing (calculator surface)","previous_path":"/calculators/ride-hailing","removal_status":"removed","notes":"Alias surface removed; simulator remains active"},
    {"entity":"practice","previous_path":"/lab/ab-decisions/practice/","removal_status":"removed","notes":"Practice block/pages removed"},
    {"entity":"checklist","previous_path":"/lab/ab-decisions/checklist.html","removal_status":"removed","notes":"Checklist page removed"},
    {"entity":"experiments","previous_path":"/lab/experiments/","removal_status":"removed","notes":"Course removed"},
    {"entity":"graphs-analytics","previous_path":"/lab/graphs-analytics/","removal_status":"removed","notes":"Course removed"}
  ]
}
```
