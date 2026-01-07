# Отчет о проверке мини-курса "Графики как аргумент"

## ✅ Структура файлов
Все 11 файлов на месте:
- index.html (главная страница курса)
- syllabus.html (программа курса)
- checklist.html (чек-лист)
- 8 уроков (ab-test-table.html → kpi-signal.html)

## ✅ Порядок уроков
1. ab-test-table.html - Итоговая таблица A/B-теста
2. colored-table.html - Цветная таблица
3. pivot-table.html - Pivot-таблица
4. message-title.html - График без сообщения
5. pie-over-time.html - Доли во времени
6. multigroup-lines.html - Мультигрупп A/B
7. honest-time-axis.html - Ось времени
8. kpi-signal.html - KPI для решения

## ✅ Навигация между уроками

### Навигация "Предыдущий/Следующий урок":
- ✅ ab-test-table.html → colored-table.html (только "Следующий", первый урок)
- ✅ colored-table.html → ab-test-table.html и pivot-table.html
- ✅ pivot-table.html → colored-table.html и message-title.html
- ✅ message-title.html → pivot-table.html и pie-over-time.html
- ✅ pie-over-time.html → message-title.html и multigroup-lines.html
- ✅ multigroup-lines.html → pie-over-time.html и honest-time-axis.html
- ✅ honest-time-axis.html → multigroup-lines.html и kpi-signal.html
- ✅ kpi-signal.html → honest-time-axis.html (только "Предыдущий", последний урок)

### Верхняя навигация (Курс/Программа/Чеклист):
- ✅ index.html: Курс (active), Программа, Чеклист
- ✅ syllabus.html: Курс, Программа (active), Чеклист
- ✅ checklist.html: Курс, Программа, Чеклист (active)
- ✅ Все уроки: Курс, Программа, Чеклист (все ссылки работают)

## ✅ Кнопки и ссылки

### Главная страница (index.html):
- ✅ Кнопка "Начать" → ab-test-table.html
- ✅ Кнопка "Программа" → syllabus.html
- ✅ Все ссылки "→ Открыть урок" работают (8 уроков)

### Программа (syllabus.html):
- ✅ Кнопка "Начать курс" → ab-test-table.html
- ✅ Все ссылки "→ Открыть урок" работают (8 уроков)

### Чеклист (checklist.html):
- ✅ "← Назад к программе" → syllabus.html
- ✅ "Начать курс заново" → ab-test-table.html

## ✅ Названия и заголовки

### Консистентность title и h1:
- ✅ Все уроки: title и h1 совпадают
- ✅ index.html: "Графики как аргумент"
- ✅ syllabus.html: "Программа курса: Графики как аргумент"
- ✅ checklist.html: "Чек-лист: решение за 10 секунд"

### Названия уроков в index.html и syllabus.html:
- ✅ Все названия совпадают с заголовками в самих уроках
- ✅ Все описания консистентны

## ✅ Логика надписей

### Кнопки:
- ✅ "Начать" (index.html) - логично, ведет к первому уроку
- ✅ "Начать курс" (syllabus.html) - логично, ведет к первому уроку
- ✅ "Начать курс заново" (checklist.html) - логично, ведет к первому уроку
- ✅ "Программа" (index.html) - логично, ведет к syllabus.html

### Навигация:
- ✅ "← Предыдущий урок" - корректно для всех уроков кроме первого
- ✅ "Следующий урок →" - корректно для всех уроков кроме последнего
- ✅ "← Назад к программе" (checklist.html) - логично

### Названия разделов:
- ✅ "Юнит 1: Таблицы как аргумент" (index.html)
- ✅ "Юнит 2: Графики как аргумент" (index.html)
- ✅ "Уроки курса" (syllabus.html)
- ✅ "A) Сообщение", "B) Сравнение", "C) Честность формы" (checklist.html)

## ✅ Итоговая оценка

**Все проверки пройдены успешно!**

- ✅ Все ссылки работают корректно
- ✅ Навигация логична и последовательна
- ✅ Названия консистентны во всех файлах
- ✅ Кнопки ведут на правильные страницы
- ✅ Порядок уроков соблюден
- ✅ Нет битых ссылок
- ✅ Логика надписей понятна и последовательна

