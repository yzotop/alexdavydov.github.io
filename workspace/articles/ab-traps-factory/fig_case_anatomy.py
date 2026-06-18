#!/usr/bin/env python3
"""fig_case_anatomy.svg — anatomy of a synthetic trap case.
Shows contract + data (visible) + ground truth (hidden). davydov.my palette."""
import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
from matplotlib import rcParams
from matplotlib.patches import Rectangle, FancyArrowPatch

INK="#1a1a1a"; MUTED="#6b6b6b"; AXIS="#d4d4d0"; ACCENT="#e63946"
rcParams["font.family"]="DejaVu Sans"; rcParams["svg.fonttype"]="none"

fig, ax = plt.subplots(figsize=(7.2, 4.4))
ax.set_xlim(0,12); ax.set_ylim(0,8); ax.axis("off")

def box(x,y,w,h,title,lines,edge=AXIS,tcol=INK,lw=1.0):
    ax.add_patch(Rectangle((x,y),w,h,facecolor="none",edgecolor=edge,linewidth=lw))
    ax.text(x+0.25, y+h-0.4, title, fontsize=10, color=tcol, fontweight="bold")
    for i,l in enumerate(lines):
        ax.text(x+0.25, y+h-0.85-i*0.42, l, fontsize=8, color=MUTED)

# left: what the factory builds
ax.text(0.2, 7.6, "ФАБРИКА ГЕНЕРИРУЕТ", fontsize=9, color=ACCENT)

box(0.2, 4.7, 5.4, 2.5, "contract + data  (видит решающий)",
    ["• метрики, пороги, guardrails",
     "• таблица результатов (control vs test)",
     "• заметки: окно, метод, контекст",
     "  «+4% за 7 дней», «общий рынок»…"], edge=INK, lw=1.4)

box(0.2, 1.9, 5.4, 2.3, "truth  (скрыт от решающего)",
    ["• правильный вердикт: investigate",
     "• тип ловушки: novelty_effect",
     "• обоснование эталона",
     "  — для проверки, не для подсказки"], edge=ACCENT, tcol=ACCENT, lw=1.4)

# arrow to right
arr = FancyArrowPatch((5.8,4.6),(7.1,4.6), arrowstyle="-|>", mutation_scale=14,
                      color=INK, lw=1.2)
ax.add_patch(arr)

# right: the task
ax.text(7.3, 7.6, "ЗАДАЧА", fontsize=9, color=ACCENT)
box(7.3, 4.3, 4.5, 2.8, "решающий выносит вердикт",
    ["видя только contract + data:",
     "",
     "  ship / no-ship / investigate",
     "",
     "→ сверка с truth = оценка"], edge=INK, lw=1.4)

ax.text(7.3, 3.4, "Ловушка заложена by design,", fontsize=8.5, color=MUTED)
ax.text(7.3, 2.95, "правильный ответ известен —", fontsize=8.5, color=MUTED)
ax.text(7.3, 2.5, "поэтому кейс измерим.", fontsize=8.5, color=INK)

plt.tight_layout()
plt.savefig("fig_case_anatomy.svg", format="svg", bbox_inches="tight", transparent=True)
print("wrote fig_case_anatomy.svg")
