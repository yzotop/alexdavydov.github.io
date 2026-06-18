#!/usr/bin/env python3
"""fig_categories.svg — 7 categories of A/B traps, count per category.
davydov.my palette, swiss grid."""
import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
from matplotlib import rcParams

INK="#1a1a1a"; MUTED="#6b6b6b"; AXIS="#d4d4d0"; ACCENT="#e63946"
rcParams["font.family"]="DejaVu Sans"; rcParams["svg.fonttype"]="none"

# 7 categories: name, example traps
cats = [
    ("1 · Дизайн", "единица рандомизации, плохой OEC, дилюция"),
    ("2 · Целостность назначения", "SRM, контаминация, боты"),
    ("3 · Качество данных", "пропуски, дубли событий, баг логирования"),
    ("4 · Время", "неполные циклы, peeking, внешний шок, сезонность"),
    ("5 · Анализ", "Симпсон, множественность, ratio-метрики, CUPED, хвосты"),
    ("6 · Интерпретация", "Twyman, winner's curse, интерференция, HARKing"),
    ("7 · Внешняя валидность", "узкий сегмент, долгосрочная ценность, новизна"),
]

fig, ax = plt.subplots(figsize=(7.0, 5.0))
ax.set_xlim(0,10); ax.set_ylim(0,len(cats)+0.5); ax.axis("off")

for i,(name,examples) in enumerate(cats):
    y = len(cats) - i
    # category bar (accent left edge)
    ax.plot([0.2,0.2],[y-0.34,y+0.16], color=ACCENT, lw=3, solid_capstyle="butt")
    ax.text(0.45, y, name, fontsize=12, color=INK, fontweight="bold", va="center")
    ax.text(0.45, y-0.34, examples, fontsize=9, color=MUTED, va="center")

plt.tight_layout()
plt.savefig("fig_categories.svg", format="svg", bbox_inches="tight", transparent=True)
print("wrote fig_categories.svg")
