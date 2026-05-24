"""
Двусторонний рынок (райдхейлинг): почему наивный A/B завышает эффект,
а switchback его чинит.

Механика interference:
  Пассажиры и водители делят ОБЩИЙ пул. Тестируем скидку (повышает
  склонность заказывать). В наивном A/B (рандомизация по пассажирам)
  treatment-пассажиры заказывают чаще -> расхватывают общих водителей
  -> у контроля растёт время ожидания -> контроль конвертит хуже
  -> разница treatment vs control ЗАВЫШЕНА (cannibalization bias).

  Switchback (рандомизация по времени): в каждый интервал ВЕСЬ рынок
  на одном режиме -> две группы не делят пул одновременно -> измеряем
  глобальный эффект без interference.

Истинный глобальный эффект задаём явно (TRUE_LIFT) -> можем сравнить,
кто из дизайнов к нему ближе.
"""
import numpy as np
import pandas as pd
from scipy import stats

RNG = np.random.default_rng(20260524)

# ----------------------------------------------------------------------
# Параметры рынка
# ----------------------------------------------------------------------
N_PERIODS = 2000           # временных интервалов (для switchback)
RIDERS_PER_PERIOD = 50     # пассажиры приходят в каждый интервал
DRIVERS_PER_PERIOD = 22    # ОБЩИЙ пул водителей: ДЕФИЦИТ (спрос ~27-32 > 22)
                           # -> группы реально конкурируют за водителей

BASE_BOOK_PROB = 0.55      # базовая вероятность заказать (без скидки)
DISCOUNT_LIFT  = 0.10      # ИСТИННЫЙ эффект скидки на склонность заказать
                           # (на склонность, до рыночного ограничения)

# Ключевое: завершённость поездки зависит от доступности водителей.
# Если спрос > предложение, часть заказов не находит водителя (или ждёт),
# и конверсия в завершённую поездку падает -> это канал interference.

def market_round(n_riders, treat_frac, discount_on_treat):
    """
    Один интервал рынка.
    treat_frac — доля пассажиров с treatment (скидкой).
    discount_on_treat — действует ли скидка (True для treatment-пассажиров).
    Возвращает по-пассажирные исходы: group, booked, completed, wait.
    """
    groups = RNG.random(n_riders) < treat_frac
    # склонность заказать: базовая + эффект скидки для treatment
    book_prob = np.where(groups & discount_on_treat,
                         BASE_BOOK_PROB + DISCOUNT_LIFT, BASE_BOOK_PROB)
    booked = RNG.random(n_riders) < book_prob

    # спрос на водителей = число заказавших
    demand = booked.sum()
    supply = DRIVERS_PER_PERIOD

    # завершённость: если спрос <= предложение, почти все завершают;
    # если спрос > предложение, водителей не хватает -> часть не завершает,
    # и время ожидания растёт для ВСЕХ заказавших (общий пул!)
    if demand <= supply:
        complete_rate = 0.97
    else:
        # дефицит: завершает только supply/demand доля (грубо)
        complete_rate = 0.97 * supply / demand

    completed = booked & (RNG.random(n_riders) < complete_rate)
    # ожидание: при дефиците treatment-пассажиры (со скидкой = выше приоритет
    # спроса) получают водителей первыми, control ждёт дольше — его водителей
    # "перехватил" treatment. Без дефицита разницы нет.
    base_wait = 3.0 + 0.05 * demand
    if demand > supply:
        deficit = 0.4 * (demand - supply)
        # treatment обслуживается первым -> меньше доп.ожидания; control больше
        wait_t = base_wait + deficit * 0.5
        wait_c = base_wait + deficit * 1.5
    else:
        wait_t = wait_c = base_wait
    waits = np.where(booked,
                     np.where(groups, wait_t, wait_c) + RNG.normal(0, 0.5, n_riders),
                     np.nan)
    return pd.DataFrame({
        "treat": groups, "booked": booked, "completed": completed, "wait": waits
    })

# ----------------------------------------------------------------------
# 1. ИСТИННЫЙ глобальный эффект (контрфактуал):
#    весь рынок без скидки  vs  весь рынок со скидкой.
#    Это то, что мы ХОТИМ измерить.
# ----------------------------------------------------------------------
def global_metric(treat_all):
    """Средняя завершённость поездок, если ВЕСЬ рынок на одном режиме."""
    comp = []
    for _ in range(N_PERIODS):
        df = market_round(RIDERS_PER_PERIOD, treat_frac=(1.0 if treat_all else 0.0),
                          discount_on_treat=treat_all)
        comp.append(df["completed"].mean())
    return np.mean(comp)

m_off = global_metric(False)   # весь рынок без скидки
m_on  = global_metric(True)    # весь рынок со скидкой
true_effect = (m_on - m_off) / m_off * 100

# ----------------------------------------------------------------------
# 2. НАИВНЫЙ A/B: рандомизация по пассажирам, обе группы ОДНОВРЕМЕННО
#    делят общий пул водителей.
# ----------------------------------------------------------------------
naive_rows = []
for _ in range(N_PERIODS):
    df = market_round(RIDERS_PER_PERIOD, treat_frac=0.5, discount_on_treat=True)
    naive_rows.append(df)
naive = pd.concat(naive_rows, ignore_index=True)

ctrl_comp = naive[~naive.treat].completed.mean()
treat_comp = naive[naive.treat].completed.mean()
naive_effect = (treat_comp - ctrl_comp) / ctrl_comp * 100

# ----------------------------------------------------------------------
# 3. SWITCHBACK: рандомизация по времени. Каждый интервал — весь рынок
#    на одном режиме (on/off). Сравниваем on-интервалы vs off-интервалы.
# ----------------------------------------------------------------------
sb_on, sb_off = [], []
for _ in range(N_PERIODS):
    on = RNG.random() < 0.5
    df = market_round(RIDERS_PER_PERIOD, treat_frac=(1.0 if on else 0.0),
                      discount_on_treat=on)
    (sb_on if on else sb_off).append(df["completed"].mean())
sb_on_m, sb_off_m = np.mean(sb_on), np.mean(sb_off)
switchback_effect = (sb_on_m - sb_off_m) / sb_off_m * 100

# ----------------------------------------------------------------------
print("="*64)
print("ДВУСТОРОННИЙ РЫНОК: наивный A/B vs switchback")
print("="*64)
print(f"\nИстинный глобальный эффект скидки на завершённость:  {true_effect:+.1f}%")
print(f"  (весь рынок off {m_off:.3f} -> весь рынок on {m_on:.3f})")
print(f"\nНаивный A/B (рандомизация по пассажирам):           {naive_effect:+.1f}%")
print(f"  control завершённость {ctrl_comp:.3f}, treatment {treat_comp:.3f}")
print(f"  -> ЗАВЫШЕН: treatment расхватал общих водителей, у control")
print(f"     просела завершённость и выросло ожидание (cannibalization)")
print(f"\nSwitchback (рандомизация по времени):               {switchback_effect:+.1f}%")
print(f"  off-интервалы {sb_off_m:.3f}, on-интервалы {sb_on_m:.3f}")
print(f"  -> близко к истинному: группы не делят пул одновременно")
print(f"\nСмещение наивного A/B: {naive_effect - true_effect:+.1f} п.п. "
      f"({(naive_effect-true_effect)/true_effect*100:+.0f}% от истинного)")

# время ожидания контроля — прямое доказательство interference
wait_ctrl = naive[~naive.treat].wait.mean()
wait_treat = naive[naive.treat].wait.mean()
print(f"\nВремя ожидания в наивном A/B: control {wait_ctrl:.1f} мин, "
      f"treatment {wait_treat:.1f} мин")
print(f"  -> control ждёт дольше, хотя ему НИЧЕГО не меняли — его водителей")
print(f"     забрал treatment. Вот механизм interference на цифрах.")
