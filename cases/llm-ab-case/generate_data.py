"""
Маркетплейс: генератор данных для сквозного разбора трёх процессов.

Связка процессов (причинная цепочка):
  LLM-классификатор категоризирует товары (со скрытой ошибкой на части категорий)
    -> категория влияет на ранжирование в выдаче
      -> A/B-тест: новый алгоритм ранжирования сильнее опирается на категорию
        -> монетизация: измеряем выручку и здоровье продукта

Скрытый дефект, который свяжет всё вместе:
  LLM хорошо классифицирует частые категории и плохо — редкие (long tail).
  Новый алгоритм ранжирования сильнее доверяет предсказанной категории.
  Поэтому на товарах из "хвоста", где классификатор ошибается, новый алгоритм
  показывает нерелевантную выдачу. Краткосрочно выручка растёт (больше показов
  рекламы), но retention в этих сегментах падает.
"""

import numpy as np
import pandas as pd

RNG = np.random.default_rng(20260524)

# ----------------------------------------------------------------------
# 1. Каталог товаров и их ИСТИННЫЕ категории
# ----------------------------------------------------------------------
N_PRODUCTS = 6000

# Категории с разной частотой: head (частые) + long tail (редкие)
CATEGORIES = [
    "electronics", "clothing", "home", "beauty", "sports",   # head — частые
    "books", "toys", "auto", "garden", "pet",                # mid
    "jewelry", "music", "crafts", "vintage", "industrial",   # tail — редкие
]
# вероятности: head доминирует, tail редок (реалистичный long-tail)
cat_weights = np.array([22, 18, 14, 10, 8, 6, 5, 4, 3, 3, 2, 2, 1.5, 1, 0.5])
cat_weights = cat_weights / cat_weights.sum()

true_category = RNG.choice(CATEGORIES, size=N_PRODUCTS, p=cat_weights)

products = pd.DataFrame({
    "product_id": np.arange(N_PRODUCTS),
    "true_category": true_category,
    "base_quality": RNG.beta(2, 3, N_PRODUCTS),   # внутреннее качество товара 0..1
    "price": np.round(RNG.lognormal(3.0, 0.8, N_PRODUCTS), 2),
})

# ----------------------------------------------------------------------
# 2. LLM-КЛАССИФИКАТОР: предсказанная категория (со скрытым дефектом)
# ----------------------------------------------------------------------
# Точность зависит от частоты категории: head ~0.93, tail ~0.62
# Это и есть "category-matching" дефект: bench (где категории сбалансированы)
# покажет высокую среднюю точность, а в production (реальный long-tail трафик)
# ошибки концентрируются в хвосте.

cat_freq_rank = {c: i for i, c in enumerate(CATEGORIES)}  # 0 = самая частая

def per_category_accuracy(cat):
    # линейно падает от 0.93 (head) к 0.62 (tail)
    r = cat_freq_rank[cat] / (len(CATEGORIES) - 1)
    return 0.93 - 0.31 * r

pred_category = []
for tc in products["true_category"]:
    acc = per_category_accuracy(tc)
    if RNG.random() < acc:
        pred_category.append(tc)                       # верно
    else:
        # ошибка: уходит в случайную ДРУГУЮ категорию (чаще в частую — типичный bias)
        others = [c for c in CATEGORIES if c != tc]
        w = cat_weights[[CATEGORIES.index(c) for c in others]]
        w = w / w.sum()
        pred_category.append(RNG.choice(others, p=w))

products["pred_category"] = pred_category
products["category_correct"] = (products["true_category"] == products["pred_category"]).astype(int)

# ----------------------------------------------------------------------
# 3. A/B-ТЕСТ: пользователи, рандомизация, две ветки ранжирования
# ----------------------------------------------------------------------
N_USERS = 40000

# Скрытая склонность пользователя тратить (spender propensity) — она же
# проявляется и в pre-period (pre_arpu), и в период эксперимента (revenue).
# Именно это делает pre_arpu полезной ковариатой для CUPED.
spender = RNG.gamma(2.0, 1.0, N_USERS)        # >0, тяжёлый хвост — реалистично

users = pd.DataFrame({
    "user_id": np.arange(N_USERS),
    "group": RNG.choice(["control", "treatment"], size=N_USERS),
    "spender": spender,
    # pre-period ARPU: функция склонности + шум (наблюдали ДО теста)
    "pre_arpu": np.round(np.clip(2.0 * spender + RNG.normal(0, 1.0, N_USERS), 0, None), 2),
    # сегмент интереса: какую категорию пользователь преимущественно смотрит
    "fav_category": RNG.choice(CATEGORIES, size=N_USERS, p=cat_weights),
})

# ----------------------------------------------------------------------
# 4. СЕССИИ: показы, клики, выручка — зависят от ветки и от корректности категории
# ----------------------------------------------------------------------
# Механика:
#   - в обеих ветках пользователю показывают товары из его fav_category
#   - control: ранжирование по base_quality (категорию использует слабо)
#   - treatment: новый алгоритм сильнее опирается на pred_category
#       => если классификатор ошибся, treatment показывает нерелевантное,
#          но ВЫРАЧИВАЕТ больше рекламы краткосрочно (больше показов/скроллов),
#          а удовлетворённость (-> retention) падает.

# средняя корректность классификатора в категории — для расчёта эффекта
cat_acc = {c: per_category_accuracy(c) for c in CATEGORIES}

rows = []
for u in users.itertuples():
    acc = cat_acc[u.fav_category]            # насколько хорошо классиф. в его категории
    is_treat = (u.group == "treatment")
    spend_mult = u.spender / 2.0             # множитель склонности тратить (~среднее 1.0)

    # базовые показы рекламы за период
    base_ad_impressions = RNG.poisson(30)

    if is_treat:
        # новый алгоритм: +показы рекламы (выручка вверх), но релевантность
        # зависит от точности классификатора в этой категории
        ad_impr = base_ad_impressions + RNG.poisson(6)
        relevance = acc                       # чем хуже классиф., тем хуже выдача
    else:
        ad_impr = base_ad_impressions
        relevance = 0.85                      # control стабилен, не зависит от классиф.

    ctr = np.clip(0.02 + 0.05 * relevance + RNG.normal(0, 0.005), 0.001, None)
    ad_clicks = RNG.binomial(ad_impr, ctr)
    cpc = RNG.lognormal(-1.0, 0.3)            # цена за клик
    ad_revenue = ad_clicks * cpc * spend_mult

    # органическая выручка (покупки) — зависит от релевантности и склонности тратить
    purchase_rate = np.clip(0.03 * relevance + RNG.normal(0, 0.004), 0.001, None)
    purchases = RNG.binomial(ad_impr, purchase_rate)
    order_value = RNG.lognormal(2.5, 0.5) * spend_mult
    org_revenue = purchases * order_value

    total_revenue = ad_revenue + org_revenue

    # retention (вернётся ли через 7 дней): зависит от релевантности (удовлетворённость)
    # treatment с плохой релевантностью (ошибки классиф.) -> retention падает
    ret_prob = np.clip(0.45 + 0.35 * relevance - 0.10 * (ad_impr > 33), 0.05, 0.95)
    retained_d7 = int(RNG.random() < ret_prob)

    rows.append({
        "user_id": u.user_id,
        "group": u.group,
        "fav_category": u.fav_category,
        "pre_arpu": u.pre_arpu,
        "ad_impressions": ad_impr,
        "ad_clicks": ad_clicks,
        "ad_revenue": round(ad_revenue, 4),
        "org_revenue": round(org_revenue, 4),
        "revenue": round(total_revenue, 4),
        "purchases": purchases,
        "retained_d7": retained_d7,
    })

sessions = pd.DataFrame(rows)

# ----------------------------------------------------------------------
# Сохраняем
# ----------------------------------------------------------------------
products.to_csv("combine/products.csv", index=False)
users.to_csv("combine/users.csv", index=False)
sessions.to_csv("combine/sessions.csv", index=False)

print("Данные сгенерированы:")
print(f"  products: {len(products)} строк ({products['true_category'].nunique()} категорий)")
print(f"  users:    {len(users)} строк")
print(f"  sessions: {len(sessions)} строк")
print()
print("Проверка связки (классификатор):")
overall_acc = products["category_correct"].mean()
print(f"  Общая точность классификатора (bench-style): {overall_acc:.3f}")
print()
print("Точность по категориям (head -> tail):")
acc_by_cat = products.groupby("true_category")["category_correct"].agg(["mean", "count"])
acc_by_cat = acc_by_cat.reindex(CATEGORIES)
print(acc_by_cat.to_string())
