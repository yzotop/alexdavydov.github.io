#!/usr/bin/env python3
"""fig_metric_gap.svg — 3-way vs binary accuracy per trap (dumbbell).
Big gaps = metric choice changes the verdict. davydov.my style."""
import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
from matplotlib import rcParams

INK="#1a1a1a"; MUTED="#6b6b6b"; AXIS="#d4d4d0"; ACCENT="#e63946"
rcParams["font.family"]="DejaVu Sans"; rcParams["svg.fonttype"]="none"

# (trap, 3way, binary) Sonnet free
data = [
    ("multiple_comparisons", 1.00, 1.00),
    ("guardrail_violation", 1.00, 1.00),
    ("long_term_reversal", 1.00, 1.00),
    ("segment_conflict", 1.00, 1.00),
    ("not_significant", 0.84, 1.00),
    ("practically_small", 0.72, 0.97),
    ("underpowered", 0.11, 1.00),
    ("simpson_paradox", 0.00, 1.00),
    ("novelty_effect", 0.00, 0.00),
]
labels=[d[0] for d in data]
three=[d[1] for d in data]; binr=[d[2] for d in data]
y=range(len(labels))

fig, ax = plt.subplots(figsize=(5.8, 4.0))
for i,(t,b) in enumerate(zip(three,binr)):
    gap = b-t
    lc = ACCENT if gap>0.3 else AXIS
    ax.plot([t,b],[i,i], color=lc, lw=1.6 if gap>0.3 else 1.0, zorder=2)
ax.scatter(three, y, color=INK, s=34, zorder=3, label="строгая (3-way)")
ax.scatter(binr, y, facecolors="none", edgecolors=MUTED, s=34, linewidths=1.2,
           zorder=3, label="грубая (катить/нет)")

ax.set_yticks(list(y)); ax.set_yticklabels(labels, fontsize=8.5)
ax.set_xlim(-0.05,1.08); ax.set_xlabel("точность", fontsize=9.5, color=MUTED)
for s in ["top","right"]: ax.spines[s].set_visible(False)
for s in ["left","bottom"]:
    ax.spines[s].set_color(AXIS); ax.spines[s].set_linewidth(0.8)
ax.tick_params(colors=MUTED, labelsize=8.5, length=0)
ax.legend(fontsize=8.5, frameon=False, loc="lower right")
plt.tight_layout()
plt.savefig("fig_metric_gap.svg", format="svg", bbox_inches="tight", transparent=True)
print("wrote fig_metric_gap.svg")
