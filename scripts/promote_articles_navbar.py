#!/usr/bin/env python3
"""Replace Заметки with Статьи in compact nav-links only (site-wide HTML)."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NAV_LINKS_RE = re.compile(
    r'(<div class="nav-links">)(.*?)(</div>)',
    re.DOTALL,
)
NOTES_LINK_RE = re.compile(
    r'<a href="/notes/"[^>]*>Заметки</a>',
)
REPLACEMENT = '<a href="/workspace/articles/">Статьи</a>'


def process_file(path: Path) -> tuple[bool, bool]:
    """Return (changed, has_nav_links_without_notes_pattern)."""
    text = path.read_text(encoding="utf-8")
    if 'class="nav-links"' not in text:
        return False, False

    has_nav_links = True
    changed = False
    drift = False

    def repl_nav_links(m: re.Match[str]) -> str:
        nonlocal changed, drift
        open_tag, inner, close_tag = m.group(1), m.group(2), m.group(3)
        if NOTES_LINK_RE.search(inner):
            new_inner = NOTES_LINK_RE.sub(REPLACEMENT, inner, count=1)
            if new_inner != inner:
                changed = True
            return open_tag + new_inner + close_tag
        drift = True
        return m.group(0)

    new_text = NAV_LINKS_RE.sub(repl_nav_links, text, count=1)

    if changed:
        path.write_text(new_text, encoding="utf-8")

    return changed, has_nav_links and drift


def main() -> int:
    changed_files: list[str] = []
    drift_files: list[str] = []

    for path in sorted(ROOT.rglob("*.html")):
        if "_archive" in path.parts:
            continue
        changed, drift = process_file(path)
        rel = path.relative_to(ROOT).as_posix()
        if changed:
            changed_files.append(rel)
        if drift:
            drift_files.append(rel)

    print(f"Changed files: {len(changed_files)}")
    for rel in changed_files:
        print(f"  {rel}")

    if drift_files:
        print(f"\nDrift (nav-links present, Заметки pattern not found): {len(drift_files)}")
        for rel in drift_files:
            print(f"  {rel}")
    else:
        print("\nDrift: none")

    return 0


if __name__ == "__main__":
    sys.exit(main())
