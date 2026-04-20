#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# update_site_map.sh — Regenerate site-map.json from ENTITY_REGISTRY + filesystem
# Usage:  cd site-map/ && ./update_site_map.sh
# Deps:   python3 (stdlib only)
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REGISTRY="$REPO_ROOT/docs/site/ENTITY_REGISTRY_CANONICAL_2026-03.md"
OUTPUT="$SCRIPT_DIR/site-map.json"

python3 << PYEOF
import json, os, re, datetime, tempfile

REGISTRY_PATH = """${REGISTRY}"""
OUTPUT_PATH = """${OUTPUT}"""

def parse_entity_registry(path):
    """Parse ENTITY_REGISTRY markdown table into list of entities."""
    entities = []
    if not os.path.isfile(path):
        return entities
    in_table = False
    for line in open(path, encoding='utf-8'):
        line = line.rstrip()
        if '| slug |' in line and 'entity_type' in line:
            in_table = True
            continue
        if in_table and line.startswith('|') and not line.strip().replace('-','').replace('|','').strip():
            continue  # separator row
        if in_table and line.startswith('|'):
            parts = [p.strip() for p in line.split('|')[1:-1]]
            if len(parts) >= 6:
                slug, etype, url, fspath, legacy, status, *rest = parts
                notes = rest[0] if rest else ''
                def strip_md(s):
                    t = (s or '').strip().replace(chr(96), '')
                    return t.strip()
                if slug and not slug.startswith('---'):
                    entities.append({
                        'slug': slug,
                        'entity_type': etype,
                        'canonical_url': strip_md(url),
                        'filesystem_path': strip_md(fspath),
                        'legacy_urls': strip_md(legacy) if legacy and legacy != '-' else '',
                        'status': status,
                        'notes': notes,
                    })
        elif in_table and not line.strip():
            break
    return entities

SECTION_ORDER = ['calculators', 'simulators', 'courses', 'cases', 'knowledge', 'hubs', 'other']

def build_sections(entities):
    """Group entities into sections."""
    section_map = {
        'calculator': ('section.calculators', 'Calculators', 'Параметрические калькуляторы: ввод → расчёт'),
        'simulator': ('section.simulators', 'Simulators', 'Интерактивные симуляции: живая модель'),
        'course': ('section.courses', 'Courses', 'Курсы: контент в lab/, каталог в /courses/'),
        'case': ('section.cases', 'Cases', 'Кейсы / портфолио'),
        'knowledge-page': ('section.knowledge', 'Knowledge', 'Глоссарий и knowledge-страницы'),
        'knowledge-hub': ('section.knowledge', 'Knowledge', 'Knowledge hub'),
        'catalog-hub': ('section.hubs', 'Hubs', 'Каталоги и витрины'),
    }
    sections = {}
    for e in entities:
        etype = e['entity_type']
        sid, sname, sdesc = section_map.get(etype, ('section.other', 'Other', ''))
        if sid not in sections:
            sections[sid] = {'id': sid, 'name': sname, 'description': sdesc, 'entities': []}
        eid = f"{etype}.{e['slug']}"
        sections[sid]['entities'].append({
            'id': eid,
            'slug': e['slug'],
            'type': etype,
            'url': e['canonical_url'],
            'path': e['filesystem_path'],
            'status': e['status'],
            'legacy_urls': e['legacy_urls'],
            'notes': e['notes'],
        })
    ordered = []
    for k in SECTION_ORDER:
        sid = f'section.{k}'
        if sid in sections:
            ordered.append(sections[sid])
    for sid, s in sections.items():
        if s not in ordered:
            ordered.append(s)
    return ordered

legacy_layers = [
    {'path': '/lab/calculators/*', 'role': 'Redirects to /calculators/', 'status': 'legacy'},
    {'path': '/lab/simulators/*', 'role': 'Redirects to /simulators/', 'status': 'legacy'},
    {'path': '/calculators/lab/*', 'role': 'Compatibility + shared assets', 'status': 'legacy'},
]

entities = parse_entity_registry(REGISTRY_PATH)
sections = build_sections(entities)

out = {
    'meta': {
        'schema_version': '1.0',
        'generated_at': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'generated_by': 'site-map',
        'description': 'davydov.my site map — calculators, simulators, courses, cases',
        'canonical_sources': ['docs/site/ENTITY_REGISTRY_CANONICAL_2026-03.md'],
    },
    'site_base': 'https://yzotop.github.io/alexdavydov.github.io',
    'sections': sections,
    'legacy': legacy_layers,
}

script_dir = os.path.dirname(OUTPUT_PATH)
fd, tmp = tempfile.mkstemp(dir=script_dir, suffix='.json')
with os.fdopen(fd, 'w') as f:
    json.dump(out, f, indent=2, ensure_ascii=False)
    f.write('\n')
os.rename(tmp, OUTPUT_PATH)

print(f'site-map.json updated: {OUTPUT_PATH}')
print(f'  sections: {len(sections)}')
print(f'  entities: {sum(len(s["entities"]) for s in sections)}')
print(f'  legacy: {len(legacy_layers)}')
PYEOF
