"""Rebuild the reproducible case packet from an unmodified OSF exploratory CSV."""
import csv
from collections import defaultdict
from hashlib import sha256
import json
from pathlib import Path
from sys import argv

SOURCE = "https://osf.io/download/3vqmp/"
HASH = "8368313b060f4015a0c6fb34e6d788163cee29554144aba9390b14922eb9d8ce"
NOTICE = "https://upworthy.natematias.com/2024-06-upworthy-archive-update.html"


def choose(source):
    if sha256(source.read_bytes()).hexdigest() != HASH:
        raise ValueError("Archive differs from the OSF snapshot used in this case")
    tests = defaultdict(list)
    with source.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            tests[row["clickability_test_id"]].append(row)
    candidates = []
    for test_id, arms in tests.items():
        if len(arms) != 2:
            continue
        a, b = sorted(arms, key=lambda arm: arm["created_at"])
        if not a["eyecatcher_id"] or a["eyecatcher_id"] != b["eyecatcher_id"] or a["headline"] == b["headline"]:
            continue
        if all("2013-06-25" <= arm["created_at"][:10] <= "2014-01-10" and int(arm["impressions"]) > 0 for arm in (a, b)):
            candidates.append((a["created_at"], test_id, a, b))
    _, test_id, a, b = min(candidates, key=lambda candidate: candidate[:2])
    return {"source": SOURCE, "sha256": HASH, "test_id": test_id, "metric": "clicks / impressions",
            "claim": "Можно рекомендовать редактору вариант A на основании причинного эффекта заголовка.",
            "arms": [{"label": label, "events": int(row["clicks"]), "total": int(row["impressions"]),
                      "date": row["created_at"][:10], "image_id": row["eyecatcher_id"]}
                     for label, row in zip(("A", "B"), (a, b))],
            "checks": [{"name": "Пригодность рандомизации для подтверждающего вывода", "kind": "date_warning",
                        "start": "2013-06-25", "end": "2014-01-10",
                        "basis": "Авторы архива рекомендуют исключать этот интервал при подтверждающем анализе.", "source": NOTICE}]}


if __name__ == "__main__":
    print(json.dumps(choose(Path(argv[1])), ensure_ascii=False, indent=2))
