# Site Map — davydov.my

Интерактивная карта сущностей сайта (calculators, simulators, courses, cases) по образцу System Map.

## Использование

- Открыть `index.html` в браузере (или через local server)
- Либо: https://yzotop.github.io/alexdavydov.github.io/site-map/

## Обновление данных

```bash
cd site-map/
./update_site_map.sh
```

Скрипт читает `docs/site/ENTITY_REGISTRY_CANONICAL_2026-03.md` и генерирует `site-map.json`.

## Источники

- ENTITY_REGISTRY_CANONICAL_2026-03.md — канонический реестр сущностей
- SITE_MAP_DAVYDOVMY.md — краткий справочник по типам сущностей
