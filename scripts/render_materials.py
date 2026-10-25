#!/usr/bin/env python3
"""Собрать каталог из статей и /cases/. --check проверяет без записи."""
import argparse
import sys

from site_materials import ROOT, catalog_item, materials, replace_block


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        rows = materials()
        items = "\n".join(catalog_item(a) for a in rows)
        page = ROOT / "materials/index.html"
        old = page.read_text()
        new = replace_block(old, "catalog", items)
    except (ValueError, OSError) as exc:
        print(f"ОСТАНОВ: {exc}. Ничего не записано.", file=sys.stderr)
        return 1
    if args.check and old != new:
        print("Каталог расходится с источниками", file=sys.stderr)
        return 1
    if old != new:
        page.write_text(new)
    print(f"  /materials/: {len(rows)} материалов; " + ("без изменений" if old == new else "обновлён"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
