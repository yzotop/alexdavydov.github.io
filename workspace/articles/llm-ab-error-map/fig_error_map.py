#!/usr/bin/env python3
"""fig_error_map.svg — accuracy by trap type, sorted, colored by zone.
davydov.my style (DejaVu Sans, site palette). Run: python3 fig_error_map.py"""
import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
from matplotlib import rcParams

INK="#1a1a1a"; MUTED="#6b6b6b"; AXIS="#d4d4d0"; ACCENT="#e63946"
rcParams["font.family"]="DejaVu Sans"; rcParams["svg.fonttype"]="none"

# Sonnet free, 3-way accuracy
data = [
    ("novelty_effect", 0.00),
    ("simpson_paradox", 0.00),
    ("underpowered", 0.11),
    ("practically_small", 0.72),
    ("not_significant", 0.84),
    ("segment_conflict", 1.00),
    ("long_term_reversal", 1.00),
    ("guardrail_violation", 1.00),
    ("multiple_comparisons", 1.00),
]
# sorted worst->best already; plot bottom=worst
labels=[d[0] for d in data][::-1]
vals=[d[1] for d in data][::-1]

def color(v):
    if v < 0.5: return ACCENT      # провал
    if v < 0.95: return MUTED      # слабое
    return INK                     # сильное

colors=[color(v) for v in vals]

fig, ax = plt.subplots(figsize=(5.6, 3.8))
bars=ax.barh(labels, vals, color=colors, height=0.62, zorder=3)
for b,v in zip(bars,vals):
    ax.text(v+0.02, b.get_y()+b.get_height()/2, f"{v:.2f}",
            va="center", ha="left", fontsize=9, color=INK)

ax.set_xlim(0,1.12); ax.set_xlabel("точность вердикта (3-way)", fontsize=9.5, color=MUTED)
ax.axvline(0.5, color=AXIS, lw=0.8, ls=(0,(3,2)), zorder=1)
for s in ["top","right"]: ax.spines[s].set_visible(False)
for s in ["left","bottom"]:
    ax.spines[s].set_color(AXIS); ax.spines[s].set_linewidth(0.8)
ax.tick_params(colors=MUTED, labelsize=8.5, length=0)
ax.set_axisbelow(True)
plt.tight_layout()
plt.savefig("fig_error_map.svg", format="svg", bbox_inches="tight", transparent=True)
print("wrote fig_error_map.svg")
