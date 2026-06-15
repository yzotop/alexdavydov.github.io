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

KEY_EXTS = ('.sh', '.md', '.py')

def scan_key_files(rp, max_depth=2):
    """Return list of {name, ext, rel_path} for .sh, .md, .py under rp (max_depth levels)."""
    out = []
    if not os.path.isdir(rp):
        return out
    try:
        for root, dirs, files in os.walk(rp):
            depth = root[len(rp):].count(os.sep)
            if depth >= max_depth:
                dirs.clear()
                continue
            rel_root = os.path.relpath(root, rp) if root != rp else ''
            for f in files:
                if f.startswith('.'):
                    continue
                ext = os.path.splitext(f)[1].lower()
                if ext in KEY_EXTS:
                    rel = os.path.join(rel_root, f) if rel_root else f
                    out.append({'name': f, 'ext': ext[1:], 'rel_path': rel})
    except OSError:
        pass
    return sorted(out, key=lambda x: (x['ext'], x['rel_path']))

def git_remote(rp):
    """Return 'github' | 'gitlab' | None for a project path."""
    gc = os.path.join(rp, '.git', 'config')
    if not os.path.isfile(gc):
        return None
    try:
        for line in open(gc):
            if 'url' in line.lower() and '=' in line:
                url = line.split('=', 1)[1].strip()
                if 'github.com' in url:
                    return 'github'
                if 'gitlab.com' in url:
                    return 'gitlab'
                break
    except Exception:
        pass
    return None

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

# Knowledge base lives at involute/knowledge/involutevault — not on map (Obsidian-only)
# core/personal-os retired 2026-03
DOMAIN_ORDER = ['cursor', 'lab', 'public', 'work']

DOMAIN_DESC = {
    'cursor':    'Cursor IDE context: prompt agents, playbooks, registry',
    'lab':       'Research and experiments',
    'public':    'Personal brand static site',
    'work':      'Employer-specific projects and artifacts',
}

# Known projects per domain (lab/work are discovered dynamically)
KNOWN_PROJECTS = {
    'public':    ['alexdavydov.github.io'],
}

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

    # ── projects ──
    if dn in KNOWN_PROJECTS:
        pnames = KNOWN_PROJECTS[dn]
    elif dn == 'cursor':
        pnames = []          # cursor is structured differently (no sub-projects)
    else:
        pnames = ls_dirs(dp)  # lab/work: discover first-level dirs

    projects = []
    for pn in pnames:
        pp = os.path.join(dp, pn)
        if not os.path.isdir(pp):
            continue
        proj = {
            'id': f'project.{pn}',
            'name': pn,
            'path': f'projects/{dn}/{pn}',
            'role': 'canonical',
            'description': '',
            'git_remote': git_remote(pp),  # 'github' | 'gitlab' | None
            'project_kind': 'code',
        }
        rm = os.path.join(pp, 'README.md')
        if os.path.isfile(rm):
            t = md_title(rm)
            if t:
                proj['description'] = t
        # detect symlinks inside project (known subdirectories)
        sls = []
        for sub in ['data', 'data/health', 'data/knowledge', 'runtime/logs']:
            sp = os.path.join(pp, sub)
            if os.path.islink(sp):
                tgt = os.readlink(sp)
                if not os.path.isabs(tgt):
                    tgt = os.path.normpath(os.path.join(os.path.dirname(sp), tgt))
                sls.append({'from': sub, 'to': tgt})
        # also check first-level sub-projects (e.g. lab projects with data/ symlinks)
        for sd in ls_dirs(pp):
            for subsub in ['data']:
                sp = os.path.join(pp, sd, subsub)
                if os.path.islink(sp):
                    tgt = os.readlink(sp)
                    if not os.path.isabs(tgt):
                        tgt = os.path.normpath(os.path.join(os.path.dirname(sp), tgt))
                    sls.append({'from': f'{sd}/{subsub}', 'to': tgt})
        if sls:
            proj['symlinks'] = sls
        kf = scan_key_files(pp)
        if kf:
            proj['key_files'] = kf[:50]   # cap at 50
        projects.append(proj)

    dom['projects'] = projects
    if dn == 'cursor':
        dom['subdirs'] = [
            s for s in ['agents', 'memory', 'playbooks', 'registry', 'rules']
            if s in ls_dirs(dp)
        ]
        kf = scan_key_files(dp)
        if kf:
            dom['key_files'] = kf[:50]
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
# JOBS (personal-os retired — no runtime jobs)
# ══════════════════════════════════════════════════════════════

jobs = []

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

# knowledge data (if any subdirs exist)
for area in ['knowledge']:
    for proj in (ls_dirs(os.path.join(D, area)) if exists(D, area) else []):
        add_da(f'{area}/{proj}', 'raw', 'runtime', f'{proj} data', area)

# music data (one entry per project)
for proj in (ls_dirs(os.path.join(D, 'music')) if exists(D, 'music') else []):
    add_da(f'music/{proj}', 'raw', 'runtime', f'{proj} music data', 'music')

# public data (site builds, test tasks, etc.)
for proj in (ls_dirs(os.path.join(D, 'public')) if exists(D, 'public') else []):
    add_da(f'public/{proj}', 'raw', 'runtime', f'{proj} public/site data', 'public')

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
# GLOSSARY (from cursor/registry/glossary.md)
# ══════════════════════════════════════════════════════════════

def parse_glossary(path):
    """Parse glossary.md into [{section, term, definition}...]."""
    if not os.path.isfile(path):
        return []
    items = []
    cur_section = ''
    cur_term = ''
    cur_def = []
    def flush():
        nonlocal cur_term, cur_def
        if cur_term:
            def_text = '\n'.join(cur_def).strip()
            if def_text:
                items.append({'section': cur_section, 'term': cur_term, 'definition': def_text})
        cur_term = ''
        cur_def = []

    for line in open(path, encoding='utf-8'):
        line_r = line.rstrip()
        if line.startswith('## '):
            flush()
            cur_section = line[3:].strip()
        elif line.startswith('### '):
            flush()
            cur_term = line[4:].strip()
        elif cur_term and line.strip() and not line.startswith('#'):
            cur_def.append(line_r)
    flush()
    return items

glossary_path = os.path.join(P, 'cursor', 'registry', 'glossary.md')
glossary = parse_glossary(glossary_path)

# ══════════════════════════════════════════════════════════════
# ID CONTRACT
# ══════════════════════════════════════════════════════════════

id_contract = {
    'rule': 'All IDs are deterministic slugs derived from entity path and type prefix.',
    'entity_format': '{type_prefix}.{name_or_path_slug}',
    'virtual_format': 'group.{context}-{name} | root.{name} | virtual.{name}',
    'symlink_format': 'sym.{slugified_from_path}',
    'examples': {
        'domain.cursor': 'domain + name',
        'project.alexdavydov.github.io': 'project + dir name',
        'agent.lab_curator': 'agent + definition filename stem',
        'data.lab-project-data': 'data + path slug',
        'sym.cursor-project-data': 'sym + slugified from-path',
    },
    'virtual_examples': {
        'root.projects': 'synthetic root for projects/ tree',
        'root.data':     'synthetic root for data/ tree',
        'group.cursor-agents':    'virtual grouping for cursor/agents subdir',
        'group.dags':             'virtual grouping for DAG scripts',
        'group.data-lab': 'virtual grouping for domain data areas',
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
    'glossary': glossary,
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
print(f'  projects       : {sum(len(d.get("projects", [])) for d in domains)}')
print(f'  agents         : {len(agents)}')
print(f'  jobs (total)   : {len(jobs)}')
print(f'    dags         : {sum(1 for j in jobs if j["type"] == "dag")}')
print(f'    pipeline     : {sum(1 for j in jobs if j["type"] == "job")}')
print(f'    utilities    : {sum(1 for j in jobs if j["type"] == "utility")}')
print(f'  data_areas     : {len(data_areas)}')
print(f'  symlinks       : {len(symlinks)}')
print(f'  glossary terms : {len(glossary)}')
print()
# sample IDs
all_ids = []
for d in domains:
    all_ids.append(d['id'])
    for r in d.get('projects', []):
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
