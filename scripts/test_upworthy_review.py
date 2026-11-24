"""Regression checks for evidence changing a decision while the counts stay fixed."""
import json
import runpy
import unittest
from pathlib import Path

CASE = Path(__file__).resolve().parents[1] / "ai-first/workshop/projects/upworthy"
review = runpy.run_path(str(CASE / "review.py"))["review"]


def load(name):
    return json.loads((CASE / name).read_text(encoding="utf-8"))


class ReviewTest(unittest.TestCase):
    def test_new_source_changes_permitted_claim(self):
        packet = load("experiment.json")
        warning = packet["checks"][0]
        self.assertEqual(review(packet)["decision"], "withhold_claim")
        self.assertAlmostEqual(review(packet)["first_minus_second_pp"], 0.2970391858)
        for arm, date in zip(packet["arms"], (warning["start"], warning["end"])):
            arm["date"] = date
        self.assertEqual(review(packet)["decision"], "withhold_claim")
        for arm in packet["arms"]:
            arm.pop("date")
        self.assertEqual(review(packet)["decision"], "request_evidence")
        for arm in packet["arms"]:
            arm["date"] = "2014-01-11"
        self.assertEqual(review(packet)["decision"], "ready_for_human_review")

    def test_transfer_to_retention(self):
        packet = load("cookie-cats.json")
        result = review(packet)
        self.assertEqual(result["decision"], "request_evidence")
        self.assertEqual(len(result["outstanding"]), 2)
        self.assertAlmostEqual(result["first_minus_second_pp"], -0.8201298315)
        packet["evidence"] = {"assignment_plan": "example-plan"}
        self.assertEqual(len(review(packet)["outstanding"]), 1)

    def test_invalid_counts_and_unknown_rule(self):
        packet = load("experiment.json")
        packet["arms"][0]["total"] = 0
        with self.assertRaises(ValueError):
            review(packet)
        packet = load("experiment.json")
        packet["checks"][0]["kind"] = "typo"
        with self.assertRaises(ValueError):
            review(packet)


if __name__ == "__main__":
    unittest.main()
