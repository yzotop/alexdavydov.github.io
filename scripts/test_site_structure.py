#!/usr/bin/env python3
"""Проверки публикации на временных копиях; рабочее дерево не меняется."""
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class PublicationChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = tempfile.TemporaryDirectory(prefix="davydov-fixture-")
        cls.fixture = Path(cls.base.name)
        for path in ROOT.rglob("*.html"):
            rel = path.relative_to(ROOT)
            if any(p.startswith((".", "_")) for p in rel.parts):
                continue
            target = cls.fixture / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)
        for name in ["site_materials.py", "render_materials.py", "render_home.py",
                     "render_ai_analyst_hub.py", "check_class_collisions.py",
                     "render_site_header.py"]:
            target = cls.fixture / "scripts" / name
            target.parent.mkdir(exist_ok=True)
            shutil.copy2(ROOT / "scripts" / name, target)
        (cls.fixture / "assets").mkdir(exist_ok=True)
        for name in ["search-index.json", "home-practice.json"]:
            shutil.copy2(ROOT / "assets" / name, cls.fixture / "assets" / name)
        shutil.copytree(ROOT / "_partials", cls.fixture / "_partials")

    @classmethod
    def tearDownClass(cls):
        cls.base.cleanup()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="davydov-negative-")
        self.root = Path(self.temp.name)
        shutil.copytree(self.fixture, self.root, dirs_exist_ok=True)

    def tearDown(self):
        self.temp.cleanup()

    def run_script(self, name, *args):
        return subprocess.run([sys.executable, str(self.root / "scripts" / name), *args],
                              cwd=self.root, capture_output=True, text=True)

    def test_current_outputs_match_sources(self):
        for name in ["render_home.py", "render_materials.py"]:
            result = self.run_script(name, "--check")
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_handwritten_catalog_topic_is_detected_without_writing(self):
        page = self.root / "materials/index.html"
        self.assertIn('data-topic="ai"', page.read_text())
        page.write_text(page.read_text().replace('data-topic="ai"', 'data-topic="money"', 1))
        changed = page.read_bytes()
        self.assertNotEqual(self.run_script("render_materials.py", "--check").returncode, 0)
        self.assertEqual(page.read_bytes(), changed)
        self.assertEqual(self.run_script("render_materials.py").returncode, 0)
        self.assertEqual(self.run_script("render_materials.py", "--check").returncode, 0)

    def test_missing_case_stops_both_generators_without_partial_output(self):
        (self.root / "cases/ub22/index.html").unlink()
        for script, output in [("render_home.py", "index.html"),
                               ("render_materials.py", "materials/index.html")]:
            page = self.root / output
            old = page.read_bytes()
            result = self.run_script(script)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("/cases/ub22/", result.stderr)
            self.assertEqual(page.read_bytes(), old)

    def test_independent_ai_article_does_not_need_a_series_number(self):
        url = "/workspace/articles/new-independent-post/"
        page = self.root / url.strip("/") / "index.html"
        page.parent.mkdir()
        page.write_text('<html><head><meta name="material-topic" content="ai">'
                        '<meta name="description" content="Опубликованный самостоятельный разбор">'
                        '</head><body><h1>Новый AI-first разбор</h1></body></html>')
        index = self.root / "assets/search-index.json"
        entries = json.loads(index.read_text())
        entries.append({"type": "article", "url": url, "tags": ["AI-first"]})
        index.write_text(json.dumps(entries))
        result = self.run_script("render_materials.py")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(f'href="{url}"', (self.root / "materials/index.html").read_text())
        self.assertEqual(self.run_script("render_home.py", "--check").returncode, 0)

    def test_frozen_research_does_not_reappear_from_search_metadata(self):
        url = "/workspace/articles/sgr-ab-decisions/"
        page = self.root / url.strip("/") / "index.html"
        page.write_text('<html><head><meta name="material-topic" content="ai"></head>'
                        '<body><h1>Замороженная статья</h1></body></html>')
        index = self.root / "assets/search-index.json"
        entries = json.loads(index.read_text())
        entries.append({"type": "article", "url": url, "tags": ["AI-first"]})
        index.write_text(json.dumps(entries))
        self.assertEqual(self.run_script("render_materials.py", "--check").returncode, 0)
        self.assertNotIn(f'href="{url}"', (self.root / "materials/index.html").read_text())

    def test_invalid_update_url_does_not_publish(self):
        config = self.root / "assets/home-practice.json"
        data = json.loads(config.read_text())
        data["updates"][0]["url"] = "javascript:alert(1)"
        config.write_text(json.dumps(data))
        page = self.root / "index.html"
        old = page.read_bytes()
        self.assertNotEqual(self.run_script("render_home.py").returncode, 0)
        self.assertEqual(page.read_bytes(), old)

    def test_collision_checker_recognizes_versioned_stylesheet(self):
        # Остальные страницы fixture не имеют собственных стилей этого класса.
        (self.root / "style.css").write_text(".collision_probe{font-size:40px}")
        (self.root / "collision-probe.html").write_text(
            '<link rel="stylesheet" href="/style.css?v=test">'
            '<style>.collision_probe{margin:0}</style><p class="collision_probe">Текст</p>')
        result = self.run_script("check_class_collisions.py")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("collision_probe", result.stderr)

    def test_contacts_stay_on_inner_pages_and_do_not_repeat_on_home(self):
        result = self.run_script("render_site_header.py")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        for name, expected in [("index.html", 0), ("materials/index.html", 1),
                               ("workspace/articles/task-brief/index.html", 1)]:
            footer = (self.root / name).read_text().split('<!-- footer:start -->')[1]
            footer = footer.split('<!-- footer:end -->')[0]
            for url in ["https://t.me/Datalake", "https://www.linkedin.com/in/alexanderdavydow/"]:
                self.assertEqual(footer.count(f'href="{url}"'), expected, name)


if __name__ == "__main__":
    unittest.main(verbosity=2)
