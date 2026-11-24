"""Review two observed rates and explicit evidence checks. Python 3, standard library."""
import argparse
from datetime import date
import json
from pathlib import Path


def assess(rule, packet):
    """Return the status of a documented check from its inputs, not from the memo."""
    if not rule["basis"].strip():
        raise ValueError("Explain what evidence this check uses")
    if rule["kind"] == "date_warning":
        start, end = (date.fromisoformat(rule[key]) for key in ("start", "end"))
        if end < start:
            raise ValueError("Invalid date interval")
        dates = [arm.get("date") for arm in packet["arms"]]
        observed = [date.fromisoformat(value) for value in dates if value]
        if any(start <= day <= end for day in observed):
            return "block"
        return "pass" if len(observed) == len(dates) else "missing"
    if rule["kind"] == "requires_document":
        reference = packet.get("evidence", {}).get(rule["document"])
        return "pass" if isinstance(reference, str) and reference.strip() else "missing"
    raise ValueError("Unknown review rule: " + rule["kind"])


def review(packet):
    first, second = packet["arms"]
    labels = [arm["label"] for arm in (first, second)]
    if not all(isinstance(label, str) and label.strip() for label in labels) or labels[0] == labels[1]:
        raise ValueError("Two distinct arm labels are required")
    rates = []
    for arm in (first, second):
        events, total = arm["events"], arm["total"]
        if type(events) is not int or type(total) is not int or not 0 <= events <= total or total == 0:
            raise ValueError("Expected integer counts with 0 <= events <= total and total > 0")
        rates.append(events / total)

    checks = packet["checks"]
    if not checks:
        raise ValueError("Specify the evidence required for the proposed claim")
    outstanding = []
    for check in checks:
        status = assess(check, packet)
        if status != "pass":
            outstanding.append({"name": check["name"], "status": status, "basis": check["basis"]})
    if any(check["status"] == "block" for check in outstanding):
        decision = "withhold_claim"
    elif outstanding:
        decision = "request_evidence"
    else:
        decision = "ready_for_human_review"
    return {"claim": packet["claim"], "rates": dict(zip(labels, rates)),
            "first_minus_second_pp": 100 * (rates[0] - rates[1]),
            "decision": decision, "outstanding": outstanding}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("packet", type=Path)
    args = parser.parse_args()
    print(json.dumps(review(json.loads(args.packet.read_text(encoding="utf-8"))),
                     indent=2, ensure_ascii=False))
