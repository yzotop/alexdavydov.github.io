#!/usr/bin/env bash
# enrich_library.sh — обогащает workspace/library/index.json полями
# summary / author / difficulty для заметок из knowledge-vault через `claude -p`.
#
# Usage:
#   scripts/enrich_library.sh --dry-run                       # ничего не пишет, печатает план
#   scripts/enrich_library.sh                                 # боевой прогон
#   scripts/enrich_library.sh --force                         # перезатереть уже обогащённые
#   scripts/enrich_library.sh --limit 5                       # обработать максимум N заметок
#   scripts/enrich_library.sh --src /custom/path/data/AB      # другая исходная папка
#
# Ничего параллельно не делает (последовательный вызов claude -p).
# После каждой успешной записи перезаписывает index.json целиком —
# скрипт безопасно прерывать (Ctrl-C), при повторном запуске пропустит
# уже обогащённые записи.

set -euo pipefail

# ── defaults ─────────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INDEX_JSON="$REPO_ROOT/workspace/library/index.json"
SRC_DIR="/Users/involute/knowledge/involutevault/data/AB"
MODEL="sonnet"
DRY_RUN=0
FORCE=0
LIMIT=0
MAX_CHARS=3000

# ── args ─────────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --force)   FORCE=1;   shift ;;
    --limit)   LIMIT="$2"; shift 2 ;;
    --src)     SRC_DIR="$2"; shift 2 ;;
    --model)   MODEL="$2"; shift 2 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

[[ -f "$INDEX_JSON" ]] || { echo "ERR: not found $INDEX_JSON" >&2; exit 1; }
[[ -d "$SRC_DIR"   ]] || { echo "ERR: not found $SRC_DIR"   >&2; exit 1; }
command -v claude >/dev/null || { echo "ERR: claude CLI not in PATH" >&2; exit 1; }

echo "── enrich_library ──"
echo "  index:     $INDEX_JSON"
echo "  source:    $SRC_DIR"
echo "  model:     $MODEL"
echo "  dry-run:   $DRY_RUN"
echo "  force:     $FORCE"
echo "  limit:     ${LIMIT:-0}"
echo

# ── prompt (стабильный, на русском) ─────────────────────────────────────────
read -r -d '' PROMPT_HEADER <<'EOF' || true
Верни JSON со следующей схемой (без markdown-обёртки, без пояснений):

{
  "summary":    "<строка на русском, одно предложение, СТРОГО ≤120 символов: что это и зачем читать>",
  "author":     "<имя автора из frontmatter или null, если автор не указан или совпадает с company>",
  "difficulty": "<одно из ровно четырёх значений: базовый | методология | продвинутый | экспертный>"
}

Правила difficulty (только эти четыре русских значения, ни в коем случае не английские):
- "базовый"     — введение, без формул и матстатистики
- "методология" — принципы и процессы, лёгкая математика
- "продвинутый" — статкритерии, формулы, код на Python
- "экспертный"  — глубокая математика, ML, симуляции, доказательства

Правила summary:
- одно предложение
- НЕ длиннее 120 символов (важно)
- по делу: что внутри статьи и какую задачу читателя она решает
- без воды («хорошая статья», «обязательно к прочтению» и т.п.)
- на русском

Текст статьи:
EOF

SYSTEM_PROMPT="Ты обогащаешь библиотеку davydov.my. Возвращаешь СТРОГО один JSON-объект по заданной схеме. Без markdown, без префиксов, без пояснений. Значение difficulty — одно из четырёх русских слов: базовый, методология, продвинутый, экспертный."

# ── вспомогательная python-логика ───────────────────────────────────────────
# фронтматер → link  (через python, чтобы не плодить awk-магию)
get_link() {
  python3 - "$1" <<'PY'
import sys, re
txt=open(sys.argv[1], encoding="utf-8").read()
m=re.match(r"^---\n(.*?)\n---", txt, re.S)
if not m: sys.exit(0)
mm=re.search(r"^link:\s*(.+)$", m.group(1), re.M)
print(mm.group(1).strip() if mm else "")
PY
}

# проверка: есть ли в index.json уже все три поля для записи с этим link
already_enriched() {
  local link="$1"
  python3 - "$INDEX_JSON" "$link" <<'PY'
import json, sys
data=json.load(open(sys.argv[1], encoding="utf-8"))
link=sys.argv[2]
for e in data:
    if e.get("link")==link:
        ok = all(k in e and e[k] is not None for k in ("summary","difficulty"))
        # author может быть null — это валидное значение, считаем поле "обогащённым" если ключ присутствует
        ok = ok and ("author" in e)
        sys.exit(0 if ok else 1)
sys.exit(2)  # не найдено
PY
}

# найти id записи по link
find_id() {
  python3 - "$INDEX_JSON" "$1" <<'PY'
import json, sys
data=json.load(open(sys.argv[1], encoding="utf-8"))
for e in data:
    if e.get("link")==sys.argv[2]:
        print(e["id"]); sys.exit(0)
sys.exit(0)
PY
}

# атомарно обновить три поля у записи с заданным link
apply_update() {
  local link="$1" jsonpayload="$2"
  python3 - "$INDEX_JSON" "$link" "$jsonpayload" <<'PY'
import json, sys, os, tempfile
path, link, payload = sys.argv[1], sys.argv[2], sys.argv[3]
upd = json.loads(payload)
data = json.load(open(path, encoding="utf-8"))
touched=False
for e in data:
    if e.get("link")==link:
        e["summary"]    = upd.get("summary")
        e["author"]     = upd.get("author")
        e["difficulty"] = upd.get("difficulty")
        touched=True
        break
if not touched: sys.exit(3)
# atomic write
fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".index.", suffix=".tmp")
with os.fdopen(fd,"w",encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2); f.write("\n")
os.replace(tmp, path)
PY
}

# вытащить тело заметки без frontmatter, первые $MAX_CHARS символов
get_body() {
  python3 - "$1" "$MAX_CHARS" <<'PY'
import sys, re
txt=open(sys.argv[1], encoding="utf-8").read()
body=re.sub(r"^---\n.*?\n---\n?", "", txt, count=1, flags=re.S)
print(body[:int(sys.argv[2])])
PY
}

# вызвать claude -p и вернуть распарсенный JSON (или непустой exit code на ошибку)
PARSER="$(cd "$(dirname "$0")" && pwd)/_parse_claude_response.py"
call_claude() {
  local body="$1"
  local full_prompt
  full_prompt="${PROMPT_HEADER}
${body}"
  printf '%s' "$full_prompt" | claude -p \
      --model "$MODEL" \
      --append-system-prompt "$SYSTEM_PROMPT" \
      --output-format json 2>/dev/null \
    | python3 "$PARSER"
}

# ── main loop ────────────────────────────────────────────────────────────────
total=0; processed=0; skipped=0; missing=0; errors=0
FILES=()
while IFS= read -r line; do
  FILES+=("$line")
done < <(find "$SRC_DIR" -maxdepth 1 -type f -name "*.md" ! -name "INDEX.md" | sort)

for f in "${FILES[@]}"; do
  total=$((total+1))
  name=$(basename "$f")
  link=$(get_link "$f")
  if [[ -z "$link" ]]; then
    printf "  [no-link]   %s\n" "$name"
    missing=$((missing+1))
    continue
  fi
  id=$(find_id "$link")
  if [[ -z "$id" ]]; then
    printf "  [no-entry]  %s   link=%s\n" "$name" "$link"
    missing=$((missing+1))
    continue
  fi

  if [[ "$FORCE" -eq 0 ]]; then
    if already_enriched "$link"; then
      printf "  [skip] id=%-3s  %s\n" "$id" "$name"
      skipped=$((skipped+1))
      continue
    fi
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf "  [PLAN] id=%-3s  %s\n" "$id" "$name"
    processed=$((processed+1))
    if [[ "$LIMIT" -gt 0 && "$processed" -ge "$LIMIT" ]]; then break; fi
    continue
  fi

  body=$(get_body "$f")
  printf "  [api]  id=%-3s  %s ... " "$id" "$name"
  if upd=$(call_claude "$body"); then
    apply_update "$link" "$upd"
    printf "ok  diff=%s\n" "$(echo "$upd" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read()).get("difficulty"))')"
    processed=$((processed+1))
  else
    printf "ERR\n"
    errors=$((errors+1))
  fi

  if [[ "$LIMIT" -gt 0 && "$processed" -ge "$LIMIT" ]]; then break; fi
done

echo
echo "── summary ──"
printf "  scanned:    %d\n" "$total"
printf "  processed:  %d\n" "$processed"
printf "  skipped:    %d  (уже обогащены — снять флагом --force)\n" "$skipped"
printf "  missing:    %d  (нет в index.json или без link)\n" "$missing"
printf "  errors:     %d\n" "$errors"
