"""Validate and render a final Sasha calendar release for static Pages."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from hashlib import sha256
from html import escape
import json
import re

MSK = timezone(timedelta(hours=3))
FIRST = "20261116"
SCHEMA = "sasha.calendar-week.public.v1"
FIELDS = set("""schema release_id kind data_kind timezone periods snapshot_at_utc
calculated_at_utc published_at_utc metrics definitions memo memo_kind limitations checks
evidence revision_sha256""".split())
METRICS = {
    "sales_amount": "Продажи после скидок",
    "returns_amount": "Сумма возвратов",
    "net_revenue": "Чистая выручка",
}
STATUS = {
    "numeric": {"passed": "пройдена"},
    "model": {"not_run": "не выполнялась", "passed": "пройдена",
              "needs_review": "требует проверки", "error": "завершилась ошибкой"},
    "human": {"pending": "ожидается", "accepted": "принята", "rejected": "отклонена"},
}
INITIAL = {"model": "not_run", "human": "pending"}
LABELS = {"numeric": "Числовая сверка", "model": "Модельная проверка", "human": "Приёмка человеком"}
PRIVATE = re.compile(
    r"/(?:Users|home|Volumes|private/tmp)/|https?://|[\w.+-]+@[\w.-]+\.[a-z]{2,}|"
    r"\b(?:bearer\s|api[_-]?key|password)|gh[pousr]_[a-z0-9_]{30,}|sk-[a-z0-9_-]{30,}"
    r"|\b(?:GOAPAKE-\d+|СНИЛС)", re.I,
)
HEX = re.compile(r"[0-9a-f]{64}")
CENT = Decimal("0.01")
DEFINITIONS = {
    "sales_amount": "Продажи завершённых заказов: количество × цена единицы минус скидка, по дате заказа.",
    "returns_amount": "Возвращённое количество × исходная цена единицы без перераспределения скидки, по дате возврата.",
    "net_revenue": "Продажи после скидок минус сумма возвратов. Все магазины, все каналы, включая гостей.",
    "receipts": "События [начало, конец); received_at <= собственный конец каждого окна. Часовая зона Europe/Moscow.",
}
LIMITATIONS = [
    "Данные синтетические; изменения не являются реальным бизнес-эффектом.",
    "Причины изменений неизвестны.",
    "Возвраты периода могут относиться к продажам более ранних недель; это не когортная вероятность возврата.",
    "Поздние получения после собственной отсечки не включены. Закрытие недели не означает полной зрелости возвратов.",
]


def require(condition, problem):
    if not condition:
        raise ValueError(problem)


def digest(data):
    return sha256(data).hexdigest()


def canonical(data):
    return json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def timestamp(value):
    dt = datetime.fromisoformat(value)
    require(dt.tzinfo is not None, "timestamp without offset")
    return dt.astimezone(MSK)


def number(value):
    require(type(value) in (int, float), "expected numeric value")
    amount = Decimal(str(value))
    require(amount.is_finite() and amount == amount.quantize(CENT), "invalid money or percentage precision")
    return amount


def validate(data, now):
    require(set(data) == FIELDS, "unexpected release fields")
    require((data["schema"], data["kind"], data["data_kind"], data["timezone"], data["memo_kind"]) ==
            (SCHEMA, "final", "synthetic", "Europe/Moscow", "verified_numeric_summary"), "not an allowed final release")
    release = re.fullmatch(r"week-(\d{8})-final", data["release_id"])
    require(release and release[1] >= FIRST, "release outside authorization")
    require(digest(canonical({k:v for k,v in data.items() if k != "revision_sha256"})) ==
            data["revision_sha256"], "invalid revision hash")
    require(not PRIVATE.search(json.dumps(data, ensure_ascii=False)), "private text in artifact")
    require(isinstance(data["memo"],str) and 1 <= len(data["memo"]) <= 1600, "invalid memo")
    require(data["definitions"]==DEFINITIONS and data["limitations"]==LIMITATIONS,
            "unexpected definitions or limitations")
    require(set(data["periods"]) == {"previous", "current"}, "invalid periods")
    ranges = []
    for side in ("previous","current"):
        period = data["periods"][side]
        require(set(period) == {"start","end_exclusive","receipt_cutoff"}, "invalid period fields")
        start,end,cutoff = (timestamp(period[k]) for k in ("start","end_exclusive","receipt_cutoff"))
        require(start.weekday()==0 and start.hour==start.minute==start.second==start.microsecond==0
                and end-start==timedelta(days=7) and cutoff==end and end<=now, "incomplete or future week")
        ranges.append((start,end))
    require(ranges[0][1] == ranges[1][0] and ranges[1][0].strftime("%Y%m%d")==release[1],
            "release and period mismatch")
    end = ranges[1][1]
    require(end <= timestamp(data["snapshot_at_utc"]) <= timestamp(data["calculated_at_utc"])
            <= timestamp(data["published_at_utc"]) <= now, "invalid calculation timeline")
    require(now >= end + timedelta(hours=10), "before scheduled release window")
    require(set(data["evidence"])=={"source","report","memo","receipt","bi","numeric_audit"}
            and all(HEX.fullmatch(h) for h in data["evidence"].values()), "missing evidence")
    require(set(data["checks"])==set(STATUS), "invalid check set")
    for role, check in data["checks"].items():
        require(set(check)=={"status","checked_at_utc","evidence_sha256"} and check["status"] in STATUS[role],
                "invalid check status")
        date, proof = check["checked_at_utc"],check["evidence_sha256"]
        require(date is None or timestamp(date)<=now, "future check")
        require(proof is None or HEX.fullmatch(proof), "invalid check evidence")
        if check["status"] in {"passed","accepted","rejected"}:
            require(date and proof, "confirmed status lacks proof and time")
    require(data["checks"]["numeric"]["evidence_sha256"]==data["evidence"]["numeric_audit"],
            "numeric audit hash mismatch")
    require(len(data["metrics"])==3 and {m["metric_id"] for m in data["metrics"]}==set(METRICS),
            "invalid metric set")
    rows = {m["metric_id"]:m for m in data["metrics"]}
    for key, row in rows.items():
        require(set(row)=={"metric_id","name","unit","previous","current","change","change_pct"}
                and row["name"]==METRICS[key] and row["unit"]=="условные денежные единицы", "invalid metric fields")
        prev,current,change = (number(row[k]) for k in ("previous","current","change"))
        require(current-prev==change, "amounts disagree")
        pct = (change*100/prev).quantize(CENT, rounding=ROUND_HALF_UP) if prev else None
        actual = number(row["change_pct"]) if row["change_pct"] is not None else None
        require(pct==actual, "percentages disagree")
    for side in ("previous","current"):
        require(number(rows["sales_amount"][side])-number(rows["returns_amount"][side])==
                number(rows["net_revenue"][side]), "net revenue disagrees")
    net=rows["net_revenue"]
    pace = (f'изменение {net["change_pct"]}%'
            if net["change_pct"] is not None else 'темп не определяется при нулевой базе')
    expected_memo = (f'Чистая выручка: {net["previous"]:.2f} → {net["current"]:.2f} условных денежных единиц; '
                     f'{pace}. Причина изменения неизвестна. Данные синтетические.')
    require(data["memo"]==expected_memo, "memo differs from verified values")


def should_update(candidate, current):
    if current is None or candidate["release_id"] > current["release_id"]:
        return True
    if candidate["release_id"] < current["release_id"] or candidate == current:
        return False
    immutable = FIELDS - {"checks","revision_sha256"}
    require(all(candidate[k]==current[k] for k in immutable), "same release facts changed")
    for role, before in current["checks"].items():
        after = candidate["checks"][role]
        if after == before:
            continue
        require(role != "numeric", "numeric proof changed")
        if after["status"] == INITIAL[role] or (before["status"]=="passed" and after["status"]=="error"):
            return False
        past,new = before["checked_at_utc"],after["checked_at_utc"]
        if past and (not new or timestamp(new)<=timestamp(past)):
            return False
        require(after["evidence_sha256"], "status update lacks evidence")
    return True


def format_amount(value, signed=False):
    if value is None:
        return "—"
    return format(value,"+,.2f" if signed else ",.2f").replace(",", "\u202f").replace(".",",").replace("-", "−")


def window(period):
    start=timestamp(period["start"])
    end=timestamp(period["end_exclusive"])-timedelta(days=1)
    return f"{start:%d.%m}–{end:%d.%m.%Y}"


def replace_block(page, name, content):
    start=f"<!-- sasha-week:{name}:start -->\n"
    end=f"<!-- sasha-week:{name}:end -->"
    require(page.count(start)==page.count(end)==1 and page.index(start)<page.index(end), "missing or repeated block")
    a=page.index(start)+len(start)
    return page[:a]+content+page[page.index(end,a):]


def get_block(page, name):
    return page.split(f"<!-- sasha-week:{name}:start -->\n",1)[1].split(f"<!-- sasha-week:{name}:end -->",1)[0]


def render(page, data):
    rows={m["metric_id"]:m for m in data["metrics"]}
    periods={side:window(p) for side,p in data["periods"].items()}
    statuses=data["checks"]
    rid=data["revision_sha256"]
    old=get_block(page,"report")
    if 'id="interim-title"' in old:
        interim='<details class="sr-calendar-archive"><summary>Промежуточный отчёт за 16–21 ноября 2026</summary>\n'+old+get_block(page,"table")+'</details>\n'
        page=replace_block(page,"interim",interim)
    stats=' · '.join(f'{METRICS[k]} <strong>{format_amount(rows[k]["change_pct"],True)}{"%" if rows[k]["change_pct"] is not None else ""}</strong>' for k in METRICS)
    all_checks=''.join(f'<li>{LABELS[k]} — {STATUS[k][v["status"]]}.</li>' for k,v in statuses.items())
    summary=f'''<h2 id="sasha-week-title" data-revision="{rid}">Отчёт за завершённую неделю</h2>
<p class="sr-note">{periods["current"]} против {periods["previous"]} · МСК · учебные данные</p>
<p>{stats}</p>
<p class="sr-note sr14-current-status">Записка составлена программно. Числовая сверка пройдена. Модельная проверка — {STATUS["model"][statuses["model"]["status"]]}. Приёмка человеком — {STATUS["human"][statuses["human"]["status"]]}.</p>
<div class="sr14-current-links"><a href="#sasha-week-check">Сверить цифры ↓</a><details><summary>Записка и статус проверок</summary><p>{escape(data["memo"])}</p><ul>{all_checks}</ul></details></div>
'''
    table_rows=[]
    for row in (rows[key] for key in METRICS):
        cells=[format_amount(row[k],k.startswith("change")) for k in ("previous","current","change","change_pct")]
        table_rows.append(f'<tr><th scope="row">{row["name"]}</th>'+''.join(f"<td>{v}</td>" for v in cells)+"</tr>")
    definitions=''.join(f'<li>{escape(text)}</li>' for text in data["definitions"].values())
    limits=''.join(f'<li>{escape(x)}</li>' for x in data["limitations"])
    table=f'''<section class="dv-section-wrap sr14-check" aria-labelledby="sasha-week-check-title">
<h2 id="sasha-week-check-title">Сверка завершённой недели</h2>
<div id="sasha-week-check" class="table-wrap" role="region" tabindex="0" aria-labelledby="sasha-week-check-title">
<table><thead><tr><th scope="col">Показатель</th><th scope="col">{periods["previous"]}</th><th scope="col">{periods["current"]}</th><th scope="col">Изменение, ед.</th><th scope="col">Изменение, %</th></tr></thead>
<tbody>{"".join(table_rows)}</tbody></table></div>
<p class="sr-note">Условные денежные единицы. Каждая неделя взята по собственную отсечку.</p>
<details><summary>Определения и границы</summary><ul>{definitions}{limits}</ul></details>
<p><a href="calendar-current.json">Цифры, статусы и основания проверки · JSON</a></p>
</section>
'''
    page=page.replace('aria-labelledby="interim-title"','aria-label="Текущий отчёт и пример выпуска"',1)
    description=f'Отчёт о продажах и возвратах учебной сети за {periods["current"]}. Сверка цифр и журнал выпусков Саши.'
    page,count=re.subn(r'(<meta (?:name="description"|property="og:description") content=")[^"]*(">)',
                       lambda m:m[1]+escape(description,quote=True)+m[2],page)
    require(count==2, "expected two descriptions")
    return replace_block(replace_block(page,"report",summary),"table",table)
