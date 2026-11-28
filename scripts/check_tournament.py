#!/usr/bin/env python3
"""Guard the frozen, reader-only tournament publication without running models."""
from pathlib import Path
import hashlib
from fractions import Fraction
import json
import re

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {
    "raw/atlas-T1-final-answer.json": "7911585c86603d18cb25902b23ef7eb197ffeafc49ceddd0ea8a6fde0915f440",
    "raw/atlas-T2-final-answer.json": "dad3d1b90ed98c4fd9cdd5bfbe081f371fc99426acf1857e3fb2f2e7b96787b2",
    "raw/atlas-T3-draft-answer.json": "3e12e9f31de5be526e336b4a1f47c33e01fa25fc457c0d00a5e3d37fae8b06df",
    "raw/atlas-T3-final-answer.json": "4bee2a3f747258bb94cd71a83ee37d844a4e51f1e5fab18f1fc4df16ebc17add",
    "raw/atlas-T4-draft-answer.json": "451cd88349b9aba17b9d2d8139909aecca11ce3110b3fdcbd04faf04c1cba6b2",
    "raw/atlas-T4-final-answer.json": "451cd88349b9aba17b9d2d8139909aecca11ce3110b3fdcbd04faf04c1cba6b2",
    "raw/atlas-T4-review-answer.json": "23ebff96ac4c130d30228239b9decb8fe0337b2655c8f3d12a8946943ea26cbb",
    "raw/atlas-T5-final-answer.json": "9541179fca7a770b08f8196e6678116b0a431df79cf75efcb78f4a39246f6651",
    "raw/atlas-T5-solution-a-answer.json": "32e0a9602d3cdf76802a9eebd389b6078ad8eb89ee7c02d3f58c77a5c64fa998",
    "raw/atlas-T5-solution-b-answer.json": "6c54de08763f951d009d673865f2a990c954f9143e1a71ca3c99ccf8e1387a65",
    "raw/sasha-T1-final-answer.json": "9c9ab05ef689e1945804e7d0741ec24212cfba7d241872e654b67cc0cc588951",
    "raw/sasha-T2-final-answer.json": "b2602999bcabbd8c6fef069fae09948f34daf31cfbec6dd98b95344d71ffc359",
    "raw/sasha-T3-draft-answer.json": "77861395eb2ed78cdcf2407c4049a936f392843e512c632e32ab65a5c1f32e82",
    "raw/sasha-T3-final-answer.json": "c397ef3116895a33f9d295b7b7022242129e7d89ba029c1de2acb0738898d1f6",
    "raw/sasha-T4-draft-answer.json": "4bc0bcd500e2f9f9ce755defbd36b7f313deb689c074a0009380ec2e5c92f94e",
    "raw/sasha-T4-final-answer.json": "4bc0bcd500e2f9f9ce755defbd36b7f313deb689c074a0009380ec2e5c92f94e",
    "raw/sasha-T4-review-answer.json": "60ad1d5b2b031d3003d5e7e8af29a5aa7f447e3b8eaf5da73452a2df5c53516d",
    "raw/sasha-T5-final-answer.json": "51d4deeddaf31ef8092e90a4ab6ec40650b93b0ffd36305c4727935541d0896b",
    "raw/sasha-T5-solution-a-answer.json": "ddefe3271715ab08b032551f05c930a481ffc9838f628014d71c3855630229be",
    "raw/sasha-T5-solution-b-answer.json": "fd95bbee334a9071591a156185599e83238288dc9011fc6cf27789006c3ae676",
    "raw/stocks-T1-final-answer.json": "1f4acb327bf662d582fbfbffaf419fb7fb54b4d9c717edf216697425a109ca33",
    "raw/stocks-T2-final-answer.json": "1b7fef028b24eae2739efdca83b9b2b1a122da0f865426bf247b7914817d70b7",
    "raw/stocks-T3-draft-answer.json": "c0a92753cebba2e9044a3228d20af34a1c023ba01ef014eb7dcfeddeecd03cda",
    "raw/stocks-T3-final-answer.json": "9e23e4ffd7e41d50e66e1d8eb378785dd168c918d0c16379238958ba3a49d0a2",
    "raw/stocks-T4-draft-answer.json": "8bd032fad284781f3e40a2fdac717003126a9687cb2392e65f17041f3cdd9811",
    "raw/stocks-T4-final-answer.json": "8bd032fad284781f3e40a2fdac717003126a9687cb2392e65f17041f3cdd9811",
    "raw/stocks-T4-review-answer.json": "633ade6491ff4458e6fef2c2026ba101ee4f3116081a72b52fdb4b4b3d9ae4fa",
    "raw/stocks-T5-final-answer.json": "0ff5fc2e01ba0d57302a97de80a23b8c148387ba5ef73bbbadb4f57e58760343",
    "raw/stocks-T5-solution-a-answer.json": "ef5398f1eb4df2f96041330c9d36f9321a704e9c23180c7990070a7f64bd05ff",
    "raw/stocks-T5-solution-b-answer.json": "f9d46a0824f3f3394385fefb5f91f7853f818a3eaf6bf47d6b0f90108e9edc1b",
    "raw/stocks-clarified-T1-final-answer.json": "b2ea741549de9b35b211c6278fa8f04261ea55ff9f0981425543d7ce67e5537d",
    "raw/stocks-clarified-T2-final-answer.json": "7b5b7df81015ba4f35a76efcda6b7ab5c873b797216a6dc26d5147ca7f462c2b",
    "raw/stocks-clarified-T3-draft-answer.json": "828e6acc269ff076d03c9150baa092d2afeefd74dfc1051f6303c016e6ebde27",
    "raw/stocks-clarified-T3-final-answer.json": "e96d0b055a2cbd473b2e2fa2d5a227c986c9660282f98e2eb724b7b42b0345f3",
    "raw/stocks-clarified-T4-draft-answer.json": "5a8021a448c43f361be7a7a80576a5185c66fbc56f7ac59340cbfd7cdbaa0fdd",
    "raw/stocks-clarified-T4-final-answer.json": "8977b1fc38116f0e8ad1aa0980f22b8eff4b071ca16111246a90de1f68351549",
    "raw/stocks-clarified-T4-review-answer.json": "729ae846f4eda72306c982526c8f28b5097c7c80056144e43e03894a551802e2",
    "raw/stocks-clarified-T5-final-answer.json": "125db3ff126d129567a5c2b8f37c85731dbc70222d40a9bef5ec76a95feebf52",
    "raw/stocks-clarified-T5-solution-a-answer.json": "626f29ebe8cdc14988ed8be48de1284ff42b8a82912f6ca5e6906dff16aec69a",
    "raw/stocks-clarified-T5-solution-b-answer.json": "db63e4ee0f077c882ad81c0a0361b3414e5771a19b95135baacd1281161cb0e3"
}


REPEAT_EXPECTED = {
    "repeat/raw/stocks-clarified-T1-final-answer.json": "5c3fb495d88637e475ac96a011b2ab939e4275e308f3b406543f796a619df595",
    "repeat/raw/stocks-clarified-T2-final-answer.json": "9e87e5e5be98dc322e1c0da87110eadd3c1f1b28d8360c2b6c0ae1a70572a55e",
    "repeat/raw/stocks-clarified-T3-draft-answer.json": "a84708e4dce30450ac53c2e7e59fa2d7bc7010cfdb5f63f83d70518d0621d6c7",
    "repeat/raw/stocks-clarified-T3-final-answer.json": "313dcf753788a5fafa9c9f71ceb70021f859380e93e8676ec8dba4537bc1595f",
    "repeat/raw/stocks-clarified-T4-draft-answer.json": "51b25e492a9af7af7c6b90fb57e1139ac42441ffafccad11418af2866a93f926",
    "repeat/raw/stocks-clarified-T4-final-answer.json": "51b25e492a9af7af7c6b90fb57e1139ac42441ffafccad11418af2866a93f926",
    "repeat/raw/stocks-clarified-T4-review-answer.json": "fc5a0eea6d4471416eaf77419db79f36b45cc5d6a13d5a224a50eb1a05ed4b25",
    "repeat/raw/stocks-clarified-T5-final-answer.json": "dbd01daee52f877c885b53c6b228ff9bd09ec7af1a0b846956856030c4258295",
    "repeat/raw/stocks-clarified-T5-solution-a-answer.json": "3a2ccfb16394b7fe812b308b3fe536cc555c5a332df7a1e89c0f8814ac01c43e",
    "repeat/raw/stocks-clarified-T5-solution-b-answer.json": "58b8b12c28fb8cf1e6630edc9b1a49714464e3ab69c0f957a9f7643e2cd3c9c4"
}
CONDITION_EXPECTED = {
    "repeat/conditions/before-stocks.txt": "9915a9475636c0d2ccb779f1d7e1933920be15a72b2b4ecfa9067317390bb8c8",
    "repeat/conditions/before-stock-clarification.txt": "9f4e497df0b545b9bcafcc5247ec1b75e1f96509636d1f6737324f8c90b12d9e",
    "repeat/conditions/after-stocks.txt": "cb43d7906a5f42b834cf20a78fb396f7098d772622ba52b4ff28b9c5304021e6",
    "repeat/conditions/after-stock-clarification.txt": "2e0cfa8e51b14e3dd9fee864978d4313eb8b05d0d128fdb4d4116f2682c73ad2"
}

PAIR_EXPECTED = {
    "review-pair/raw/case-17-final-answer.json": "51b25e492a9af7af7c6b90fb57e1139ac42441ffafccad11418af2866a93f926",
    "review-pair/raw/case-42-final-answer.json": "98d7588b40e80ddd619aaaadb1a84d2b875f2ef5e1c0d73d016f022288c218f9",
    "review-pair/raw/case-17-review-answer.json": "aceedd2f5f2bf54ca0d19ba295bc51d76d4928d5d61b87709204740d6534de46",
    "review-pair/raw/case-42-review-answer.json": "c59cf0005a81ab7a1a5a2e30dafce7c9021c5ee73c4651a8c2f76bcb23c480b5"
}
DRAFT_EXPECTED = {
    "review-pair/inputs/case-17-draft.json": "51b25e492a9af7af7c6b90fb57e1139ac42441ffafccad11418af2866a93f926",
    "review-pair/inputs/case-42-draft.json": "70be1f85322000f21ae8b7b3a6c6ea98aa3d57903f51760eb7287d4a368d2a41"
}

def check(root=ROOT):
    page = root / "ai-first/workshop/tournament"
    allowed = {"index.html", "season.css", "season.js", "RESULTS.json", "repeat/RESULTS.json", "review-pair/RESULTS.json", *EXPECTED, *REPEAT_EXPECTED, *CONDITION_EXPECTED, *PAIR_EXPECTED, *DRAFT_EXPECTED}
    actual = {str(p.relative_to(page)) for p in page.rglob("*") if p.is_file()}
    assert actual == allowed, ("Unexpected or missing public files", actual ^ allowed)
    data = json.loads((page / "RESULTS.json").read_text())
    html = (page / "index.html").read_text()
    embedded = re.search(r'<script type="application/json" id="season-data">(.*?)</script>', html, re.S)
    assert embedded and json.loads(embedded[1]) == data, "Embedded data drift"
    assert set(data) == {"config", "completed", "checks", "calls", "references", "takeaway", "packets"}
    assert set(data["config"]) == {"model", "teams"}, "Private config in publication"
    assert data["config"]["model"] == "gpt-6.2-sol" and data["completed"] == 40
    assert len(data["calls"]) == len(EXPECTED) == 40
    for filename, sha in EXPECTED.items():
        raw = (page / filename).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == sha, ("Changed original", filename)
        key = filename.removeprefix("raw/").removesuffix("-answer.json")
        call = data["calls"][key]
        assert set(call) <= {"call", "complete", "answer_file", "answer", "wall_seconds", "usage", "check"}
        assert call["answer"] == json.loads(raw), ("Embedded original drift", filename)
        assert call["answer_file"] == Path(filename).name and call["complete"]
        assert set(call.get("check", {})) <= {"hard", "soft", "actual_mGBP"}
    for wave in data["checks"].values():
        for entry in wave.values():
            assert set(entry) <= {"status", "annotation", "check"}
            assert set(entry.get("check", {})) <= {"hard", "soft", "actual_mGBP"}
            assert set(entry.get("annotation", {})) <= {"reason", "quote", "disputed", "dispute_reason"}
    teams = data["config"]["teams"]
    assert len(teams) == 5
    scores = {t: sum(data["checks"][w][t]["status"] == "Принято"
                     for w in ("atlas", "sasha", "stocks-clarified")) for t in teams}
    assert scores == {"T1": 2, "T2": 2, "T3": 2, "T4": 3, "T5": 2}
    assert "Предварительный итог по зафиксированному ключу" in html
    assert "Судья видел конфигурации" in html and "одна серия не доказывает надёжность" in html
    assert 'style="' not in html and 'style="' not in (page / "season.js").read_text()
    for filename, sha in {**REPEAT_EXPECTED, **CONDITION_EXPECTED}.items():
        assert hashlib.sha256((page / filename).read_bytes()).hexdigest() == sha, ("Changed repeat original", filename)
    repeated = json.loads((page / "repeat/RESULTS.json").read_text())
    assert set(repeated) == {"model", "effort", "calls_count", "budget_mGBP", "total_mGBP", "order", "teams", "review"}
    assert repeated["model"] == "gpt-6.2-sol" and repeated["effort"] == "medium" and repeated["calls_count"] == 10
    assert repeated["review"] == {"fixed_errors": 0, "new_errors": 0, "byte_identical": True}
    assert [r["before_priority_qty"] for r in repeated["teams"]] == [376, 376, 376, 388, 376]
    assert [r["new_priority_qty"] for r in repeated["teams"]] == [388] * 5
    for team in repeated["teams"]:
        old = data["calls"]["stocks-clarified-" + team["id"] + "-final"]["answer"]
        assert next(r["qty"] for r in old["lines"] if r["sku"] == "21212") == team["before_priority_qty"]
        assert set(team) == {"id", "name", "before_priority_qty", "new_priority_qty", "stages"}
        for stage in team["stages"]:
            assert set(stage) == {"label", "file"} and "repeat/" + stage["file"] in REPEAT_EXPECTED
            answer = json.loads((page / "repeat" / stage["file"]).read_text())
            if "lines" in answer:
                assert answer["lines"] == repeated["order"] and answer["total_mGBP"] == repeated["total_mGBP"]
    assert all(set(row) == {"sku", "qty"} for row in repeated["order"])
    assert [row["qty"] for row in repeated["order"]] == [388, 962, 0, 782, 436, 530]
    skus = data["references"]["stocks"]["skus"]
    assert sum(row["qty"] * skus[row["sku"]]["price"] for row in repeated["order"]) == repeated["total_mGBP"]
    assert all(isinstance(row["qty"], int) and 0 <= row["qty"] <= skus[row["sku"]]["cap"] for row in repeated["order"])
    assert repeated["budget_mGBP"] == 2808810 and repeated["total_mGBP"] == 2808660
    assert (page / "repeat/raw/stocks-clarified-T4-draft-answer.json").read_bytes() == (page / "repeat/raw/stocks-clarified-T4-final-answer.json").read_bytes()
    from render_tournament_repeat import render
    block = re.search(r'<!-- repeat:start -->\n?(.*?)<!-- repeat:end -->', html, re.S)
    assert block and block[1].strip() == render(root).strip(), "Generated repeat block drift"
    for filename, sha in {**PAIR_EXPECTED, **DRAFT_EXPECTED}.items():
        assert hashlib.sha256((page / filename).read_bytes()).hexdigest() == sha, ("Changed pair original", filename)
    paired = json.loads((page / "review-pair/RESULTS.json").read_text())
    assert set(paired) == {"model", "effort", "model_calls", "prepared_drafts", "budget_mGBP", "total_mGBP", "order", "cases"}
    assert paired["model"] == "gpt-6.2-sol" and paired["effort"] == "medium" and paired["model_calls"] == 4 and paired["prepared_drafts"] == 2
    assert paired["budget_mGBP"] == repeated["budget_mGBP"] and paired["total_mGBP"] == repeated["total_mGBP"] and paired["order"] == repeated["order"]
    assert [c["id"] for c in paired["cases"]] == ["case-17", "case-42"] and [c["artificial_error"] for c in paired["cases"]] == [False, True]
    # Recompute the public allocation rule independently of model/judge outputs.
    allocation = {"21212": skus["21212"]["cap"], "84991": 0}
    rest = paired["budget_mGBP"] - allocation["21212"] * skus["21212"]["price"]
    other = {k: v for k, v in skus.items() if k not in allocation}
    share = Fraction(rest, sum(v["cap"] * v["price"] for v in other.values()))
    exact = {k: share * v["cap"] for k, v in other.items()}
    floor = {k: v.numerator // v.denominator for k, v in exact.items()}
    left = rest - sum(floor[k] * other[k]["price"] for k in other)
    for sku in sorted(other, key=lambda k: (-(exact[k] - floor[k]), k)):
        if floor[sku] < other[sku]["cap"] and left >= other[sku]["price"]:
            floor[sku] += 1
            left -= other[sku]["price"]
    allocation.update(floor)
    assert allocation == {r["sku"]: r["qty"] for r in paired["order"]} and left == 150
    for case in paired["cases"]:
        assert set(case) == {"id", "title", "artificial_error", "draft", "review", "final"}
        assert "review-pair/" + case["draft"] in DRAFT_EXPECTED
        assert all("review-pair/" + case[k] in PAIR_EXPECTED for k in ("review", "final"))
        draft = json.loads((page / "review-pair" / case["draft"]).read_text())
        final = json.loads((page / "review-pair" / case["final"]).read_text())
        assert final["lines"] == paired["order"] and final["total_mGBP"] == paired["total_mGBP"]
        assert sum(r["qty"] * skus[r["sku"]]["price"] for r in draft["lines"]) == paired["total_mGBP"]
        assert all(isinstance(r["qty"], int) and 0 <= r["qty"] <= skus[r["sku"]]["cap"] for r in draft["lines"])
        delta = {a["sku"]: a["qty"] - b["qty"] for a,b in zip(draft["lines"], final["lines"]) if a["qty"] != b["qty"]}
        assert delta == ({"85099B": 1, "85099F": -1} if case["artificial_error"] else {})
    assert (page / "review-pair/inputs/case-17-draft.json").read_bytes() == (page / "review-pair/raw/case-17-final-answer.json").read_bytes() == (page / "repeat/raw/stocks-clarified-T4-draft-answer.json").read_bytes()
    from render_tournament_pair import render as render_pair
    pair_block = re.search(r'<!-- pair:start -->\n?(.*?)<!-- pair:end -->', html, re.S)
    assert pair_block and pair_block[1].strip() == render_pair(root).strip(), "Generated pair block drift"
    print("Tournament: 54 model answers + 2 prepared inputs; unchanged correct draft, exact injected delta and pair generator PASS")
    print("Tournament: 40 frozen originals + 10 repeat originals, original conditions and repeat generator PASS")
    print("Tournament: 40 frozen originals, public-only files/data, scores and preliminary caveats PASS")


if __name__ == "__main__":
    check()
