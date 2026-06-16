#!/usr/bin/env python3
"""
Generate fig_sgr_effect.svg — SGR effect on accuracy by model.
Matches davydov.my article SVG style (DejaVu Sans, site palette).
Run: python3 fig_sgr_effect.py  →  writes fig_sgr_effect.svg next to it.
"""
import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
from matplotlib import rcParams

# --- site palette ---
INK = "#1a1a1a"
MUTED = "#6b6b6b"
AXIS = "#d4d4d0"
ACCENT = "#e63946"   # harm
POS = "#1a1a1a"      # benefit (ink, neutral-strong)
NEUTRAL = "#d4d4d0"  # no effect

rcParams["font.family"] = "DejaVu Sans"
rcParams["svg.fonttype"] = "none"

# --- data (free → sgr accuracy delta, p.p.) ---
models = ["Opus 4.8", "Opus 4.7", "Sonnet 4.6", "Haiku 4.5"]
deltas = [-8.2, -2.4, 5.9, 0.0]
colors = [ACCENT if d < 0 else (POS if d > 0 else NEUTRAL) for d in deltas]

fig, ax = plt.subplots(figsize=(5.2, 3.4))

bars = ax.bar(models, deltas, color=colors, width=0.62, zorder=3)

# zero line — accent, the reference
ax.axhline(0, color=ACCENT, linewidth=1.0, zorder=2)

# value labels
for b, d in zip(bars, deltas):
    txt = f"{'+' if d > 0 else ''}{d:.1f}"
    va = "bottom" if d >= 0 else "top"
    off = 0.25 if d >= 0 else -0.25
    ax.text(b.get_x() + b.get_width() / 2, d + off, txt,
            ha="center", va=va, fontsize=9.5, color=INK)

ax.set_ylim(-10, 8)
ax.set_ylabel("Δ точности от SGR (п.п.)", fontsize=10, color=INK)
ax.set_xlabel("модели по убыванию свободной точности →", fontsize=9.5, color=MUTED)

# axis cosmetics — swiss minimal
for spine in ["top", "right"]:
    ax.spines[spine].set_visible(False)
for spine in ["left", "bottom"]:
    ax.spines[spine].set_color(AXIS)
    ax.spines[spine].set_linewidth(0.8)
ax.tick_params(colors=MUTED, labelsize=9, length=0)
ax.set_axisbelow(True)
ax.yaxis.grid(True, color=AXIS, linewidth=0.5, alpha=0.6)

plt.tight_layout()
plt.savefig("fig_sgr_effect.svg", format="svg", bbox_inches="tight", transparent=True)
print("wrote fig_sgr_effect.svg")
