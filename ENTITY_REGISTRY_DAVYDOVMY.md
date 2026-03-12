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
| lab/calculators hub | `/lab/calculators` | calculators | hub | legacy | Nested hub still present |
| lab/simulators hub | `/lab/simulators` | simulators | hub | active | Nested hub still present |
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
  - `calculator`: 1
  - `course`: 6
  - `knowledge-page`: 5
  - `career-page`: 2
  - `landing`: 1
- Total removed entities: 8
- Open ambiguities:
  - `lab/monetization/experiments/*` pages still exist and are active as a **module inside monetization**, despite removal of standalone `/lab/experiments/`.
  - Nested hubs (`/lab/calculators`, `/calculators/lab`) are legacy/misplaced and may need normalization in v3.

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
    {"entity":"lab/calculators hub","path":"/lab/calculators","relation_to":"calculators","relation_type":"hub","status":"legacy","notes":"Nested hub still present"},
    {"entity":"lab/simulators hub","path":"/lab/simulators","relation_to":"simulators","relation_type":"hub","status":"active","notes":"Nested hub still present"},
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
