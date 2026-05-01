#!/usr/bin/env python3
"""Generate OG PNG cards (1200×630) from SVG via rsvg-convert.

Usage:
    python3 scripts/generate_og.py          # all SVGs in assets/og/
    python3 scripts/generate_og.py home     # only home.svg
"""
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OG_DIR = REPO / "assets" / "og"
RSVG = "rsvg-convert"


def generate(name: str) -> None:
    svg = OG_DIR / f"{name}.svg"
    png = OG_DIR / f"{name}.png"
    if not svg.exists():
        sys.exit(f"ERROR: {svg} not found")
    subprocess.run(
        [RSVG, "-w", "1200", "-h", "630", "-o", str(png), str(svg)],
        check=True,
    )
    kb = png.stat().st_size // 1024
    print(f"OK  assets/og/{png.name}  ({kb} KB)")


def main() -> None:
    names = sys.argv[1:] if len(sys.argv) > 1 else [p.stem for p in sorted(OG_DIR.glob("*.svg"))]
    for name in names:
        generate(name)


if __name__ == "__main__":
    main()
