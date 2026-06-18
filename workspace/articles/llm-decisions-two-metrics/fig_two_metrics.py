#!/usr/bin/env python3
"""fig_two_metrics.svg — strict vs anti-ship scatter, Haiku.
Points on diagonal = metrics agree; points far above = strict misleads.
davydov.my palette."""
import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
from matplotlib import rcParams

INK="#1a1a1a"; MUTED="#6b6b6b"; AXIS="#d4d4d0"; ACCENT="#e63946"
rcParams["font.family"]="DejaVu Sans"; rcParams["svg.fonttype"]="none"

# Haiku: (trap, strict, anti) — the model where the gap is dramatic
data = [
    ("interference", 0.00, 0.00),
    ("incomplete_cycles", 0.08, 0.08),
    ("twyman", 0.11, 0.11),
    ("seasonality", 0.50, 0.50),
    ("external_shock", 0.62, 0.62),
    ("simpson", 0.65, 1.00),
    ("posttreatment", 0.62, 1.00),
    ("peeking", 0.00, 1.00),
    ("dilution", 0.17, 1.00),
    ("longterm_value", 0.44, 1.00),
    ("underpowered", 0.38, 1.00),
    ("harking", 0.00, 1.00),
    ("narrow_gen", 0.85, 0.85),
    ("event_dup", 0.60, 1.00),
]

fig, ax = plt.subplots(figsize=(6.4, 6.4))
# diagonal
ax.plot([0,1],[0,1], color=AXIS, lw=1, ls=(0,(4,3)), zorder=1)
offsets = {
    "peeking": (8,5), "harking": (8,-11), "dilution": (8,5),
    "underpowered": (8,-11), "longterm_value": (8,9), "posttreatment": (-78,-2),
    "simpson": (8,5), "event_dup": (-66,-2),
    "interference": (8,-5), "incomplete_cycles": (8,-12), "twyman": (8,7),
    "seasonality": (8,-3), "external_shock": (8,-3), "narrow_gen": (8,-3),
}
for trap,s,a in data:
    gap = a - s
    col = ACCENT if gap > 0.3 else INK
    ax.scatter(s, a, s=46, color=col, zorder=3)
    dx,dy = offsets.get(trap,(6,-3))
    ax.annotate(trap, (s,a), fontsize=7, color=MUTED,
                xytext=(dx,dy), textcoords="offset points")

ax.set_xlim(-0.05,1.08); ax.set_ylim(-0.05,1.08)
ax.set_xlabel("строгая точность (точный вердикт)", fontsize=10, color=MUTED)
ax.set_ylabel("безопасность (не катит невалидное)", fontsize=10, color=MUTED)
for s in ["top","right"]: ax.spines[s].set_visible(False)
for s in ["left","bottom"]:
    ax.spines[s].set_color(AXIS); ax.spines[s].set_linewidth(0.8)
ax.tick_params(colors=MUTED, labelsize=8.5, length=0)
# annotation zones
ax.text(0.05, 0.97, "метрики расходятся:\nстрогая занижает", fontsize=8,
        color=ACCENT, va="top")
ax.text(0.62, 0.40, "метрики согласны\n(на диагонали)", fontsize=8,
        color=MUTED, va="top")
plt.tight_layout()
plt.savefig("fig_two_metrics.svg", format="svg", bbox_inches="tight", transparent=True)
print("wrote fig_two_metrics.svg")
