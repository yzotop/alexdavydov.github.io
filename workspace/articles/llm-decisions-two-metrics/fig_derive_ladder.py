#!/usr/bin/env python3
"""fig_derive_ladder.svg — anti-ship on derive-from-context traps, Sonnet vs Haiku.
Shows derive-ability scales with capability. davydov.my palette."""
import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
from matplotlib import rcParams

INK="#1a1a1a"; MUTED="#6b6b6b"; AXIS="#d4d4d0"; ACCENT="#e63946"
rcParams["font.family"]="DejaVu Sans"; rcParams["svg.fonttype"]="none"

# derive-from-context traps: anti-ship (Sonnet, Haiku)
data = [
    ("interference", 1.00, 0.00),
    ("incomplete_cycles", 0.85, 0.08),
    ("twyman", 1.00, 0.11),
    ("seasonality", 1.00, 0.50),
    ("external_shock", 1.00, 0.62),
    ("narrow_gen", 1.00, 0.85),
    # explicit-flag controls (both catch)
    ("logging_bug", 1.00, 1.00),
    ("missing_data", 1.00, 1.00),
]
labels=[d[0] for d in data][::-1]
son=[d[1] for d in data][::-1]
hai=[d[2] for d in data][::-1]
y=range(len(labels))

fig, ax = plt.subplots(figsize=(5.8, 4.2))
for i,(s,h) in enumerate(zip(son,hai)):
    ax.plot([h,s],[i,i], color=AXIS, lw=1.2, zorder=1)
ax.scatter(son, y, s=44, color=INK, zorder=3, label="Sonnet (сильнее)")
ax.scatter(hai, y, s=44, color=ACCENT, zorder=3, label="Haiku (слабее)")
ax.set_yticks(list(y)); ax.set_yticklabels(labels, fontsize=8.5)
ax.set_xlim(-0.05,1.08)
ax.set_xlabel("безопасность (не катит невалидное)", fontsize=10, color=MUTED)
for s in ["top","right"]: ax.spines[s].set_visible(False)
for s in ["left","bottom"]:
    ax.spines[s].set_color(AXIS); ax.spines[s].set_linewidth(0.8)
ax.tick_params(colors=MUTED, labelsize=8.5, length=0)
ax.legend(fontsize=8.5, frameon=False, loc="lower left")
plt.tight_layout()
plt.savefig("fig_derive_ladder.svg", format="svg", bbox_inches="tight", transparent=True)
print("wrote fig_derive_ladder.svg")
