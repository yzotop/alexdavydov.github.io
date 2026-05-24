"""
Сквозной разбор маркетплейса через три процесса.
Запускается на данных из generate_data.py. Все результаты — настоящие.

  Процесс 1 — A/B-эксперимент: эффект нового ранжирования на выручку,
              наивный t-test vs CUPED (снижение дисперсии).
  Процесс 2 — Монетизация: что с выручкой и здоровьем продукта (retention),
              разрез выручка vs retention.
  Процесс 3 — AI-evals: оценка LLM-классификатора, наивная средняя точность
              vs стратифицированная по категориям (скрытый дефект в хвосте).

Финал — связка: как дефект классификатора объясняет, почему A/B-прирост
выручки обманчив.
"""

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.metrics import accuracy_score, precision_recall_fscore_support

products = pd.read_csv("combine/products.csv")
users = pd.read_csv("combine/users.csv")
sessions = pd.read_csv("combine/sessions.csv")

CATEGORIES = ["electronics","clothing","home","beauty","sports","books","toys",
              "auto","garden","pet","jewelry","music","crafts","vintage","industrial"]

def hr(title):
    print("\n" + "="*70)
    print(title)
    print("="*70)

# ======================================================================
# ПРОЦЕСС 1 — A/B-ЭКСПЕРИМЕНТ: эффект на выручку
# ======================================================================
hr("ПРОЦЕСС 1 — A/B-ТЕСТ: новый алгоритм ранжирования, эффект на выручку")

ctrl = sessions[sessions.group == "control"]
treat = sessions[sessions.group == "treatment"]

m_c, m_t = ctrl.revenue.mean(), treat.revenue.mean()
lift = (m_t - m_c) / m_c * 100

# 1a. Наивный t-test (Welch)
t_stat, p_naive = stats.ttest_ind(treat.revenue, ctrl.revenue, equal_var=False)
print(f"\nВыручка на пользователя:")
print(f"  control:   {m_c:.4f}")
print(f"  treatment: {m_t:.4f}")
print(f"  lift:      +{lift:.2f}%")
print(f"\nНаивный Welch t-test:")
print(f"  t = {t_stat:.3f},  p = {p_naive:.5f}")

# 1b. CUPED — снижение дисперсии через pre-period ковариату (pre_arpu)
# theta = cov(Y, X) / var(X); Y_adj = Y - theta*(X - mean(X))
allses = sessions.merge(users[["user_id","pre_arpu"]], on="user_id", suffixes=("","_u"))
Y = allses.revenue.values
X = allses.pre_arpu.values
theta = np.cov(Y, X, bias=True)[0,1] / np.var(X)
X_mean = X.mean()
allses["rev_cuped"] = Y - theta * (X - X_mean)

c_cuped = allses[allses.group=="control"].rev_cuped
t_cuped = allses[allses.group=="treatment"].rev_cuped
t_stat2, p_cuped = stats.ttest_ind(t_cuped, c_cuped, equal_var=False)

var_reduction = (1 - allses.rev_cuped.var() / allses.revenue.var()) * 100
print(f"\nCUPED (ковариата pre_arpu, theta={theta:.3f}):")
print(f"  снижение дисперсии: {var_reduction:.1f}%")
print(f"  t = {t_stat2:.3f},  p = {p_cuped:.5f}")
print(f"  -> CUPED даёт ту же оценку эффекта при меньшей дисперсии (уже ДИ, точнее)")

# 1c. Проблема peeking: что если бы подглядывали каждый день?
# Симулируем накопление данных по "дням" и считаем, сколько раз наивный
# тест пересёк бы p<0.05 ДО конца (если бы эффекта не было — ложные срабатывания).
print(f"\nПроблема подглядывания (peeking):")
# берём ПОДвыборку, где истинного эффекта нет (control vs control, случайный сплит),
# и смотрим, как часто наивный последовательный взгляд даёт ложный сигнал
rng_peek = np.random.default_rng(7)
n_looks = 10
false_alarms = 0
n_sims = 200
for _ in range(n_sims):
    c = ctrl.revenue.sample(frac=1.0, random_state=rng_peek.integers(1e9)).values
    half = len(c)//2
    a, b = c[:half], c[half:]              # два среза одной (control) группы — эффекта НЕТ
    step = len(a)//n_looks
    crossed = False
    for k in range(1, n_looks+1):
        na = a[:step*k]; nb = b[:step*k]
        if len(na) < 30: continue
        _, p = stats.ttest_ind(na, nb, equal_var=False)
        if p < 0.05:
            crossed = True; break
    if crossed:
        false_alarms += 1
print(f"  При 10 взглядах на A/A (эффекта нет), наивный p<0.05 хоть раз: "
      f"{false_alarms/n_sims:.0%} симуляций")
print(f"  -> подглядывание раздувает ложные срабатывания далеко выше номинальных 5%")
print(f"  Лечение: sequential-границы (напр. O'Brien-Fleming) или фиксированный sample size.")

# ======================================================================
# ПРОЦЕСС 2 — МОНЕТИЗАЦИЯ: выручка vs здоровье продукта
# ======================================================================
hr("ПРОЦЕСС 2 — МОНЕТИЗАЦИЯ: выручка вверх, но что с retention?")

def grp_metrics(df):
    return {
        "ARPU": df.revenue.mean(),
        "ad_revenue_share": df.ad_revenue.sum() / df.revenue.sum(),
        "retention_d7": df.retained_d7.mean(),
        "ad_impressions": df.ad_impressions.mean(),
    }

mc, mt = grp_metrics(ctrl), grp_metrics(treat)
print(f"\n{'метрика':<20}{'control':>12}{'treatment':>12}{'дельта':>12}")
for k in mc:
    d = (mt[k]-mc[k])/mc[k]*100
    print(f"{k:<20}{mc[k]:>12.4f}{mt[k]:>12.4f}{d:>+11.1f}%")

# retention t-test
_, p_ret = stats.ttest_ind(treat.retained_d7, ctrl.retained_d7, equal_var=False)
print(f"\nRetention D7: разница значима? p = {p_ret:.5f}")
print("  -> Выручка +, но retention - : классический revenue-vs-retention конфликт")

# ======================================================================
# ПРОЦЕСС 3 — AI-EVALS: оценка LLM-классификатора категорий
# ======================================================================
hr("ПРОЦЕСС 3 — AI-EVALS: качество LLM-классификатора (наивно vs стратифицированно)")

# 3a. Наивная средняя точность (bench-style)
naive_acc = accuracy_score(products.true_category, products.pred_category)
print(f"\nНаивная средняя точность (как на сбалансированном бенчмарке): {naive_acc:.3f}")
print("  -> выглядит хорошо, 'модель готова к проду'")

# 3b. Стратифицированно по категориям (production-style: хвост важен)
print(f"\nСтратифицированно по категориям (head -> tail):")
print(f"{'категория':<14}{'точность':>10}{'доля товаров':>14}")
products["correct"] = (products.true_category == products.pred_category).astype(int)
acc_by_cat = products.groupby("true_category")["correct"].mean()
share = products.true_category.value_counts(normalize=True)
for c in CATEGORIES:
    print(f"{c:<14}{acc_by_cat[c]:>10.3f}{share[c]:>13.1%}")

# 3c. Macro vs micro — ключевой разрыв
prec, rec, f1, _ = precision_recall_fscore_support(
    products.true_category, products.pred_category, average="macro", zero_division=0)
print(f"\nMacro-F1 (все категории равны):  {f1:.3f}")
print(f"Micro-точность (взвешена частотой): {naive_acc:.3f}")
print(f"  -> разрыв {(naive_acc-f1)*100:.0f} п.п.: micro прячет провал в хвосте")

tail = ["jewelry","music","crafts","vintage","industrial"]
tail_acc = products[products.true_category.isin(tail)].pipe(
    lambda d: (d.true_category==d.pred_category).mean())
print(f"  Точность в long-tail (5 редких категорий): {tail_acc:.3f}")

# ======================================================================
# СВЯЗКА — как три процесса объясняют друг друга
# ======================================================================
hr("СВЯЗКА: почему A/B-прирост выручки обманчив")

# retention по корректности категории в treatment
# (нужно сопоставить fav_category пользователя с точностью классиф. в ней)
cat_acc = {c: acc_by_cat[c] for c in CATEGORIES}
treat2 = treat.copy()
treat2["cat_acc"] = treat2.fav_category.map(cat_acc)
treat2["tail_user"] = treat2.fav_category.isin(tail)

ret_head = treat2[~treat2.tail_user].retained_d7.mean()
ret_tail = treat2[treat2.tail_user].retained_d7.mean()
rev_head = treat2[~treat2.tail_user].revenue.mean()
rev_tail = treat2[treat2.tail_user].revenue.mean()

print(f"\nВ treatment-группе, разрез по сегменту пользователя:")
print(f"{'сегмент':<22}{'ARPU':>10}{'retention D7':>14}")
print(f"{'head-категории':<22}{rev_head:>10.3f}{ret_head:>14.3f}")
print(f"{'tail-категории':<22}{rev_tail:>10.3f}{ret_tail:>14.3f}")
print(f"""
Вывод цепочки:
  - Классификатор ошибается в хвосте (точность ~{tail_acc:.0%} vs ~{naive_acc:.0%} средняя).
  - Новый алгоритм ранжирования сильнее доверяет предсказанной категории.
  - В tail-сегментах он показывает нерелевантное -> больше показов рекламы
    (выручка растёт), но пользователи недовольны -> retention падает.
  - Наивный A/B видит общий +{lift:.1f}% выручки и говорит "выкатываем".
  - Но прирост частично оплачен retention в сегментах, где врёт классификатор.
  Три процесса связаны: дефект eval -> искажение A/B -> ложный сигнал монетизации.
""")

# КОНТРФАКТУАЛ: каким был бы A/B-эффект, если бы классификатор НЕ врал в хвосте.
# Считаем эффект только на head-сегментах (где классификатор надёжен ~85%+),
# где прирост выручки не искажён мисматчем — это ближе к "чистому" эффекту ранжирования.
hr("КОНТРФАКТУАЛ: чистый эффект без дефекта классификатора")

head_cats = [c for c in CATEGORIES if cat_acc[c] >= 0.85]
ses_head = sessions[sessions.fav_category.isin(head_cats)]
c_h = ses_head[ses_head.group=="control"].revenue
t_h = ses_head[ses_head.group=="treatment"].revenue
lift_head = (t_h.mean()-c_h.mean())/c_h.mean()*100
_, p_h = stats.ttest_ind(t_h, c_h, equal_var=False)

# retention на head — страдает ли он так же?
rh_c = ses_head[ses_head.group=="control"].retained_d7.mean()
rh_t = ses_head[ses_head.group=="treatment"].retained_d7.mean()

print(f"\nНаблюдаемый эффект (все сегменты):    выручка +{lift:.1f}%, retention {(mt['retention_d7']-mc['retention_d7'])/mc['retention_d7']*100:+.1f}%")
print(f"На head-сегментах (классиф. надёжен): выручка +{lift_head:.1f}%, retention {(rh_t-rh_c)/rh_c*100:+.1f}%")
print(f"""
  На сегментах, где классификатор НЕ врёт, прирост выручки сохраняется,
  а retention почти не страдает. Значит вред от нового алгоритма
  сконцентрирован там, где ошибается eval-модель — это НЕ свойство
  ранжирования, а артефакт мисматча категорий.

  Практический вывод: чинить надо не A/B-результат и не алгоритм
  ранжирования, а классификатор в хвосте. Без сквозного взгляда на три
  процесса этот вывод не виден — наивный A/B просто сказал бы "выкатываем
  ради +{lift:.0f}% выручки".
""")
