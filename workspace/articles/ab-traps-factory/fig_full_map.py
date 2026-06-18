#!/usr/bin/env python3
"""fig_full_map.svg — 33 trap types in 4 behavioral zones. Hero map.
davydov.my palette, swiss grid."""
import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
from matplotlib import rcParams
from matplotlib.patches import Rectangle

INK="#1a1a1a"; MUTED="#6b6b6b"; AXIS="#d4d4d0"; ACCENT="#e63946"; BG="#f8f8f6"
rcParams["font.family"]="DejaVu Sans"; rcParams["svg.fonttype"]="none"

# 4 zones, each: title, subtitle, list of traps
zones = [
    ("Очевидные", "ловят все, даже дешёвая модель",
     ["guardrail", "multiple_comp", "segment_conflict", "SRM", "heterogeneity",
      "bots", "contamination", "ratio_metric", "CUPED", "heavy_tails",
      "logging_bug", "missing_data"], INK),
    ("Серая зона вердикта", "обе не катят, спорят об оттенке",
     ["simpson", "posttreatment", "longterm_value", "underpowered", "HARKing"], MUTED),
    ("Вывести из контекста", "отделяет сильную модель от слабой",
     ["interference", "incomplete_cycles", "twyman", "seasonality",
      "external_shock", "narrow_general", "dilution"], ACCENT),
    ("Структурно слепые", "сигнала в данных нет — обе честно investigate",
     ["novelty", "long_term_reversal"], MUTED),
]

fig, ax = plt.subplots(figsize=(7.0, 6.6))
ax.set_xlim(0, 10); ax.set_ylim(0, 14); ax.axis("off")

y = 13.3
for title, sub, traps, col in zones:
    # zone header
    ax.text(0.2, y, title, fontsize=12.5, color=col, fontweight="bold")
    ax.text(0.2, y-0.42, sub, fontsize=8.5, color=MUTED, style="italic")
    y -= 1.05
    # trap chips, wrap at ~3 per row
    x = 0.3
    per_row = 3
    for i, t in enumerate(traps):
        if i and i % per_row == 0:
            y -= 0.62; x = 0.3
        w = 3.05
        ax.add_patch(Rectangle((x, y-0.34), w, 0.5, facecolor="none",
                                edgecolor=AXIS, linewidth=0.8))
        ax.text(x+0.12, y-0.05, t, fontsize=8, color=INK, va="center")
        x += w + 0.15
    y -= 1.15

plt.tight_layout()
plt.savefig("fig_full_map.svg", format="svg", bbox_inches="tight", transparent=True)
print("wrote fig_full_map.svg")
