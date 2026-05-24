#!/usr/bin/env python3
"""Парсит JSON-обёртку от `claude -p --output-format json`,
извлекает поле result, оттуда — внутренний JSON со схемой
{summary, author, difficulty}. Печатает нормализованный JSON в stdout.
Exit 1 на любой ошибке формата."""
import json, sys, re

try:
    raw = sys.stdin.read()
    outer = json.loads(raw)
except Exception as e:
    print(f"outer parse fail: {e}", file=sys.stderr)
    sys.exit(1)

result = (outer.get("result") or "").strip()
m = re.search(r"\{.*\}", result, re.S)
if not m:
    print(f"no JSON in result: {result[:120]!r}", file=sys.stderr)
    sys.exit(1)

try:
    inner = json.loads(m.group(0))
except Exception as e:
    print(f"inner parse fail: {e}", file=sys.stderr)
    sys.exit(1)

if "summary" not in inner or "difficulty" not in inner:
    print(f"missing required fields: {list(inner.keys())}", file=sys.stderr)
    sys.exit(1)

inner.setdefault("author", None)
# Нормализация: если author совпадает с company-шаблоном/None — пусть будет None
if isinstance(inner.get("author"), str) and inner["author"].lower() in ("null", "none", ""):
    inner["author"] = None

print(json.dumps(inner, ensure_ascii=False))
