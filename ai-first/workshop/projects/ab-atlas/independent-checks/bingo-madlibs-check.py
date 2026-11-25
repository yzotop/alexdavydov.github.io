"""Check the displayed rates under explicit integer-count and rounding assumptions."""
from decimal import Decimal as D
from fractions import Fraction

total = 736
standard, madlibs = D('27.55'), D('21.73')


def compatible(n, rate):
    # A reported percentage with two decimals lies within half a displayed unit.
    # Include both tie endpoints so that the conclusion covers either tie rule.
    expected = Fraction(rate) * n / 100
    for registrations in {int(expected), int(expected) + 1}:
        if abs(100 * Fraction(registrations, n) - Fraction(rate)) <= Fraction(1, 200):
            return True
    return False


matches = [n for n in range(1, total)
           if compatible(n, standard) and compatible(total - n, madlibs)]
print(f'Разница: {madlibs - standard:+.2f} п.п.')
print(f'Изменение относительно обычной формы: {(madlibs / standard - 1) * 100:+.2f}%')
print(f'Совместимых разбиений {total} участников при округлении до 0,01%: {len(matches)}')
