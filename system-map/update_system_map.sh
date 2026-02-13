#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# update_system_map.sh  —  Regenerate system.json from filesystem
# Usage:  cd system-map/ && ./update_system_map.sh
# Deps:   python3 (stdlib only)
# ──────────────────────────────────────────────────────────────
set -euo pipefail

export SYSTEM_MAP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

python3 << 'PYEOF'
import json, os, glob, re, datetime, pathlib, tempfile

HOME = os.path.expanduser('~')
SCRIPT_DIR = os.environ['SYSTEM_MAP_DIR']
OUTPUT = os.path.join(SCRIPT_DIR, 'system.json')

# ── helpers ──────────────────────────────────────────────────

def parse_yaml(path):
    """Parse simple KEY: "VALUE" YAML (no nesting)."""
    d = {}
    if not os.path.isfile(path):
        return d
    for line in open(path):
        line = line.strip()
        if not line or line.startswith('#') or ':' not in line:
            continue
        k, _, v = line.partition(':')
        v = v.strip().strip('"').strip("'").split('#')[0].strip()
        if v:
            d[k.strip()] = v
    return d

cfg = parse_yaml(os.path.join(HOME, 'projects/cursor/registry/paths.yaml'))
P = cfg.get('PROJECTS_ROOT', os.path.join(HOME, 'projects'))
D = cfg.get('DATA_ROOT', os.path.join(HOME, 'data'))

def ls_dirs(path):
    if not os.path.isdir(path):
        return []
    return sorted(d for d in os.listdir(path)
                  if os.path.isdir(os.path.join(path, d)) and not d.startswith('.'))

def exists(*parts):
    return os.path.isdir(os.path.join(*parts))

def relh(p):
    return os.path.relpath(p, HOME)

def docstr(f):
    try:
        t = open(f).read(2048)
        m = re.search(r'"""(.+?)"""', t, re.DOTALL) or re.search(r"'''(.+?)'''", t, re.DOTALL)
        return m.group(1).strip().split('\n')[0][:120] if m else ''
    except Exception:
        return ''

def md_title(f):
    try:
        for line in open(f):
            s = line.strip()
            if s.startswith('# '):
                return s[2:].strip()[:120]
            if s and not s.startswith('---'):
                return s[:120]
    except Exception:
        pass
    return ''

# ── configuration ────────────────────────────────────────────

DOMAIN_ORDER = ['core', 'cursor', 'lab', 'knowledge', 'public', 'work', 'business']

DOMAIN_DESC = {
    'core':      'Personal automation, health data, scheduling',
    'cursor':    'Cursor IDE context: prompt agents, playbooks, registry',
    'lab':       'Research and experiments',
    'knowledge': 'Obsidian vault (markdown knowledge base)',
    'public':    'Personal brand static site',
    'work':      'Employer-specific projects and artifacts',
    'business':  'Commercial side projects',
}

# Known repos per domain (lab/work/business are discovered dynamically)
KNOWN_REPOS = {
    'core':      ['personal-os'],
    'knowledge': ['involutevault'],
    'public':    ['alexdavydov.github.io'],
}

# Bin scripts that are always classified as utility (exact stem match)
UTIL_EXACT = frozenset({
    'graph', 'pack', 'agent_prepare', 'apply_patch',
    'changed', 'changed_json', 'weekly', 'run_agent',
})

# ══════════════════════════════════════════════════════════════
# DOMAINS
# ══════════════════════════════════════════════════════════════

domains = []
for dn in DOMAIN_ORDER:
    dp = os.path.join(P, dn)
    if not os.path.isdir(dp):
        continue
    dom = {
        'id': f'domain.{dn}',
        'name': dn,
        'path': f'projects/{dn}',
        'role': 'canonical',
        'description': DOMAIN_DESC.get(dn, dn),
    }

    # ── repos ──
    if dn in KNOWN_REPOS:
        rnames = KNOWN_REPOS[dn]
    elif dn == 'cursor':
        rnames = []          # cursor is structured differently (no git subrepos)
    else:
        rnames = ls_dirs(dp)  # lab/work/business: discover first-level dirs

    repos = []
    for rn in rnames:
        rp = os.path.join(dp, rn)
        if not os.path.isdir(rp):
            continue
        repo = {
            'id': f'repo.{rn}',
            'name': rn,
            'path': f'projects/{dn}/{rn}',
            'role': 'canonical',
            'description': '',
        }
        rm = os.path.join(rp, 'README.md')
        if os.path.isfile(rm):
            t = md_title(rm)
            if t:
                repo['description'] = t
        # detect symlinks inside repo (known subdirectories)
        sls = []
        for sub in ['data', 'data/health', 'data/knowledge', 'runtime/logs']:
            sp = os.path.join(rp, sub)
            if os.path.islink(sp):
                tgt = os.readlink(sp)
                if not os.path.isabs(tgt):
                    tgt = os.path.normpath(os.path.join(os.path.dirname(sp), tgt))
                sls.append({'from': sub, 'to': tgt})
        # also check first-level sub-projects (e.g. lab repos with data/ symlinks)
        for sd in ls_dirs(rp):
            for subsub in ['data']:
                sp = os.path.join(rp, sd, subsub)
                if os.path.islink(sp):
                    tgt = os.readlink(sp)
                    if not os.path.isabs(tgt):
                        tgt = os.path.normpath(os.path.join(os.path.dirname(sp), tgt))
                    sls.append({'from': f'{sd}/{subsub}', 'to': tgt})
        if sls:
            repo['symlinks'] = sls
        repos.append(repo)

    dom['repos'] = repos
    if dn == 'cursor':
        dom['subdirs'] = [
            s for s in ['agents', 'memory', 'playbooks', 'registry', 'rules']
            if s in ls_dirs(dp)
        ]
    domains.append(dom)

# ══════════════════════════════════════════════════════════════
# AGENTS
# ══════════════════════════════════════════════════════════════

agents = []
adir = os.path.join(P, 'cursor/agents')
if os.path.isdir(adir):
    for f in sorted(glob.glob(os.path.join(adir, '*.md'))):
        s = pathlib.Path(f).stem
        agents.append({
            'id': f'agent.{s}',
            'name': s.replace('_', ' ').title(),
            'type': 'prompt_agent',
            'definition': f'cursor/agents/{s}.md',
            'role': 'canonical',
            'purpose': md_title(f) or 'TBD',
            'scope': [],
            'authority': 'TBD',
        })

# ══════════════════════════════════════════════════════════════
# SCHEDULE INFO (best-effort parse of agents.yaml)
# ══════════════════════════════════════════════════════════════

schedule_map = {}       # stem -> schedule string
sensitivity_map = {}    # stem -> sensitivity string
ayaml = os.path.join(P, 'core/personal-os/config/agents.yaml')
if os.path.isfile(ayaml):
    cur = None
    for line in open(ayaml):
        m = re.match(r'^  (\w[\w-]*):', line)       # indented key under "agents:"
        if m:
            cur = m.group(1)
            continue
        m2 = re.match(r'^\s+schedule:\s*(.+)', line)
        if m2 and cur:
            schedule_map[cur] = m2.group(1).strip()
        m3 = re.match(r'^\s+sensitivity:\s*(.+)', line)
        if m3 and cur:
            sensitivity_map[cur] = m3.group(1).strip()

# ══════════════════════════════════════════════════════════════
# JOBS / DAGS / UTILITIES
# ══════════════════════════════════════════════════════════════

jobs = []
dag_stems = set()
dag_cmap = {}           # dag stem -> file contents

ddir = os.path.join(P, 'core/personal-os/runtime/dags')
bdir = os.path.join(P, 'core/personal-os/runtime/bin')
config_src = 'core/personal-os/config/agents.yaml' if os.path.isfile(ayaml) else None

# ── DAGs ──
if os.path.isdir(ddir):
    for f in sorted(glob.glob(os.path.join(ddir, '*.py'))):
        s = pathlib.Path(f).stem
        if s.startswith('__'):
            continue
        dag_stems.add(s)
        try:
            c = open(f).read()
        except Exception:
            c = ''
        dag_cmap[s] = c
        entry = {
            'id': f'job.{s}',
            'name': s,
            'type': 'dag',
            'code_path': f'core/personal-os/runtime/dags/{s}.py',
        }
        if s in schedule_map:
            entry['schedule'] = schedule_map[s]
        if s in sensitivity_map:
            entry['sensitivity'] = sensitivity_map[s]
        if config_src:
            entry['config_source'] = config_src
        jobs.append(entry)

# ── Bin scripts ──
all_dag_txt = '\n'.join(dag_cmap.values())

def classify(stem):
    """Classify a bin script as 'utility' or 'job'."""
    if stem in UTIL_EXACT:
        return 'utility'
    if stem.startswith('launchd_'):
        return 'utility'
    if stem.endswith('_console'):
        return 'utility'
    if any(kw in stem for kw in ('ask', 'index', 'validate')):
        return 'utility'
    if stem in all_dag_txt:
        return 'job'
    return 'utility'

btmap = {}   # bin stem -> classified type
if os.path.isdir(bdir):
    for f in sorted(glob.glob(os.path.join(bdir, '*.py'))):
        s = pathlib.Path(f).stem
        if s.startswith('__') or s in dag_stems:
            continue
        t = classify(s)
        btmap[s] = t
        jid = f'job.{s}' if t == 'job' else f'util.{s}'
        entry = {
            'id': jid,
            'name': s,
            'type': t,
            'code_path': f'core/personal-os/runtime/bin/{s}.py',
        }
        # schedule / sensitivity from agents.yaml (some bin scripts are listed there too)
        if s in schedule_map:
            entry['schedule'] = schedule_map[s]
        if s in sensitivity_map:
            entry['sensitivity'] = sensitivity_map[s]
        p = docstr(f)
        if p:
            entry['purpose'] = p
        # called_by relation
        for ds, dc in dag_cmap.items():
            if s in dc:
                entry['called_by'] = {'target': f'job.{ds}', 'resolved': True}
                break
        jobs.append(entry)

# ── resolve DAG calls ──
for j in jobs:
    if j['type'] != 'dag' or j['name'] not in dag_cmap:
        continue
    dc = dag_cmap[j['name']]
    calls = []
    for bs, bt in btmap.items():
        if bs in dc:
            cid = f'job.{bs}' if bt == 'job' else f'util.{bs}'
            calls.append({'target': cid, 'resolved': True})
    if calls:
        j['calls'] = calls

# ══════════════════════════════════════════════════════════════
# DATA AREAS
# ══════════════════════════════════════════════════════════════

data_areas = []

def add_da(rp, dtype, role, desc, domain):
    slug = rp.replace('/', '-').replace('_', '-')
    data_areas.append({
        'id': f'data.{slug}',
        'domain': domain,
        'path': f'data/{rp}',
        'type': dtype,
        'role': role,
        'description': desc,
    })

# system areas (special IDs for backward compat)
if exists(D, '_secrets'):
    data_areas.append({
        'id': 'data.secrets',
        'domain': '_system',
        'path': 'data/_secrets',
        'type': 'secrets',
        'role': 'runtime',
        'description': 'Telegram sessions, API credentials',
    })
if exists(D, '_tmp'):
    data_areas.append({
        'id': 'data.tmp-backups',
        'domain': '_system',
        'path': 'data/_tmp',
        'type': 'cache',
        'role': 'runtime',
        'description': 'Migration backups (timestamped)',
    })

# personal-os health pipeline
for rp, dt, desc in [
    ('personal-os/health/garmin/raw',               'raw',      'Garmin API daily fetch results'),
    ('personal-os/health/garmin/normalized',         'derived',  'Garmin data normalized daily/weekly'),
    ('personal-os/health/garmin/dashboards',         'artifact', 'Dashboard artifacts and build scripts'),
    ('personal-os/health/training_sheet/raw',        'raw',      'Training data CSV download'),
    ('personal-os/health/training_sheet/normalized', 'derived',  'Training sheet normalized'),
]:
    if exists(D, rp):
        add_da(rp, dt, 'runtime', desc, 'personal-os')

if exists(D, 'personal-os/knowledge'):
    add_da('personal-os/knowledge', 'derived', 'runtime',
           'FTS DB, context JSON, prompts, graph', 'personal-os')
if exists(D, 'personal-os/runtime/logs'):
    add_da('personal-os/runtime/logs', 'logs', 'runtime',
           'DAG execution logs', 'personal-os')

# lab data (deeper structure: project/data or project/sub-area)
for proj in (ls_dirs(os.path.join(D, 'lab')) if exists(D, 'lab') else []):
    pp = os.path.join(D, 'lab', proj)
    if exists(pp, 'data'):
        add_da(f'lab/{proj}/data', 'raw', 'runtime', f'{proj} project data', 'lab')
    else:
        for sub in ls_dirs(pp):
            add_da(f'lab/{proj}/{sub}', 'raw', 'runtime',
                   f'{proj}/{sub} data', 'lab')

# work data (one entry per project)
for proj in (ls_dirs(os.path.join(D, 'work')) if exists(D, 'work') else []):
    add_da(f'work/{proj}', 'raw', 'runtime', f'{proj} work data', 'work')

# business / knowledge data (if any subdirs exist)
for area in ['business', 'knowledge']:
    for proj in (ls_dirs(os.path.join(D, area)) if exists(D, area) else []):
        add_da(f'{area}/{proj}', 'raw', 'runtime', f'{proj} data', area)

# ══════════════════════════════════════════════════════════════
# SYMLINKS
# ══════════════════════════════════════════════════════════════

symlinks = []
seen_sym = set()

def add_sym(frm, to):
    fr = relh(frm)
    tr = relh(to)
    slug = fr.replace('projects/', '', 1).replace('/', '-')
    sid = f'sym.{slug}'
    if sid in seen_sym:
        return
    seen_sym.add(sid)
    symlinks.append({'from': fr, 'to': tr, 'id': sid})

for root, dirs, _ in os.walk(P, followlinks=False):
    depth = root.replace(P, '').count(os.sep)
    if depth >= 5:
        dirs.clear()
        continue
    for d in list(dirs):
        fp = os.path.join(root, d)
        if os.path.islink(fp):
            tgt = os.readlink(fp)
            if not os.path.isabs(tgt):
                tgt = os.path.normpath(os.path.join(root, tgt))
            add_sym(fp, tgt)
            dirs.remove(d)

# ══════════════════════════════════════════════════════════════
# ID CONTRACT
# ══════════════════════════════════════════════════════════════

id_contract = {
    'rule': 'All IDs are deterministic slugs derived from entity path and type prefix.',
    'entity_format': '{type_prefix}.{name_or_path_slug}',
    'virtual_format': 'group.{context}-{name} | root.{name} | virtual.{name}',
    'symlink_format': 'sym.{slugified_from_path}',
    'examples': {
        'domain.core':  'domain + name',
        'repo.personal-os': 'repo + dir name',
        'agent.lab_curator': 'agent + definition filename stem',
        'job.weekly_health': 'job + dag/script name',
        'util.overview_console': 'util + utility script name',
        'data.personal-os-health-garmin-raw': 'data + path slug',
        'sym.core-personal-os-data-health': 'sym + slugified from-path',
    },
    'virtual_examples': {
        'root.projects': 'synthetic root for projects/ tree',
        'root.data':     'synthetic root for data/ tree',
        'group.cursor-agents':    'virtual grouping for cursor/agents subdir',
        'group.dags':             'virtual grouping for DAG scripts',
        'group.data-personal-os': 'virtual grouping for personal-os data areas',
        'virtual.all_agents': 'UI-only aggregation of all prompt agents',
        'virtual.all_jobs':   'UI-only aggregation of all jobs/DAGs',
    },
    'uniqueness': 'All IDs are globally unique across all entity types and virtual nodes.',
}

# ══════════════════════════════════════════════════════════════
# ASSEMBLE & WRITE
# ══════════════════════════════════════════════════════════════

out = {
    'meta': {
        'schema_version': '2.2',
        'generated_at': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'generated_by': 'system-map',
        'description': 'Canonical system map \u2014 projects, data, agents, jobs, data flows',
        'canonical_sources': [
            'projects/cursor/registry/paths.yaml',
            'projects/cursor/registry/architecture.md',
            'projects/cursor/registry/agents.md',
            'projects/cursor/registry/glossary.md',
            'projects/core/personal-os/config/agents.yaml',
        ],
        'id_contract': id_contract,
    },
    'roots': {
        'PROJECTS_ROOT': P,
        'DATA_ROOT': D,
    },
    'domains': domains,
    'agents': agents,
    'jobs': jobs,
    'data_areas': data_areas,
    'symlinks': symlinks,
}

# atomic write: temp file + rename
fd, tmp = tempfile.mkstemp(dir=SCRIPT_DIR, suffix='.json')
with os.fdopen(fd, 'w') as f:
    json.dump(out, f, indent=2, ensure_ascii=False)
    f.write('\n')
os.rename(tmp, OUTPUT)

# ── report ───────────────────────────────────────────────────

print(f'system.json updated: {OUTPUT}')
print(f'  schema_version : {out["meta"]["schema_version"]}')
print(f'  generated_at   : {out["meta"]["generated_at"]}')
print(f'  domains        : {len(domains)}')
print(f'  repos          : {sum(len(d.get("repos", [])) for d in domains)}')
print(f'  agents         : {len(agents)}')
print(f'  jobs (total)   : {len(jobs)}')
print(f'    dags         : {sum(1 for j in jobs if j["type"] == "dag")}')
print(f'    pipeline     : {sum(1 for j in jobs if j["type"] == "job")}')
print(f'    utilities    : {sum(1 for j in jobs if j["type"] == "utility")}')
print(f'  data_areas     : {len(data_areas)}')
print(f'  symlinks       : {len(symlinks)}')
print()
# sample IDs
all_ids = []
for d in domains:
    all_ids.append(d['id'])
    for r in d.get('repos', []):
        all_ids.append(r['id'])
for a in agents:
    all_ids.append(a['id'])
for j in jobs:
    all_ids.append(j['id'])
for da in data_areas:
    all_ids.append(da['id'])
for s in symlinks:
    all_ids.append(s['id'])
print(f'  total IDs      : {len(all_ids)}')
print(f'  unique IDs     : {len(set(all_ids))}')
if len(all_ids) != len(set(all_ids)):
    dupes = [x for x in all_ids if all_ids.count(x) > 1]
    print(f'  DUPLICATES     : {set(dupes)}')
else:
    print('  all IDs unique : yes')
PYEOF
