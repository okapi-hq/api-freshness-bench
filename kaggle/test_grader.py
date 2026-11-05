"""Tests of the Python grader: python3 -m unittest discover -s kaggle"""

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))

import build  # noqa: E402
from grader.grade import grade_answer  # noqa: E402
from grader.jsregex import js  # noqa: E402
from grader.ranges import max_satisfying, valid_range  # noqa: E402

TASKS = {t["id"]: t for t in json.loads((HERE / "tasks.json").read_text())["tasks"]}
FIXTURES = ROOT / "test" / "fixtures"
ANSWERS = [json.loads(line) for line in (FIXTURES / "answers.jsonl").read_text().splitlines() if line]
REGISTRY = json.loads((FIXTURES / "registry.json").read_text())


class JavaScriptRegex(unittest.TestCase):
    def test_lookbehinds_of_several_widths(self):
        model = js(r"""(?<=^|["'`=:\s/(,\[])gpt-4o(?=["'`\s,;)}\]:]|$)""", "im")
        self.assertTrue(model.search('model="gpt-4o"'))
        self.assertTrue(model.search("x\ngpt-4o"))
        self.assertFalse(model.search('"gpt-4o-mini"'))
        guard = js(r"(?<!(?:startswith|includes)\(['\"])gpt-\w+")
        self.assertFalse(guard.search('name.startswith("gpt-4")'))
        self.assertTrue(guard.search('model="gpt-4"'))

    def test_anchors_dot_and_spaces_mean_what_they_mean_in_javascript(self):
        self.assertIsNone(js("a$").search("a\n"))
        self.assertTrue(js("a$", "m").search("a\r\nb"))
        self.assertIsNone(js("a.b").search("a\rb"))
        self.assertTrue(js(r"a\sb").search("a b"))
        self.assertIsNone(js(r"\w").search("é"))


class Semver(unittest.TestCase):
    VERSIONS = ["1.0.0", "1.2.3", "1.9.0", "2.0.0-beta.1", "2.0.0", "2.1.0", "3.0.0-rc.1"]

    def test_ranges_resolve_as_node_semver_does(self):
        # Expected values read from node-semver 7.8.5.
        cases = {"^1.2": "1.9.0", "~1.2.0": "1.2.3", ">=1.5 <2": "1.9.0", "1.x": "1.9.0", "*": "2.1.0", "": "2.1.0",
                 ">1": "2.1.0", "<=1.2": "1.2.3", "^0.0.1": None, "1.2.3 || ^2": "2.1.0", "v2": "2.1.0", "=1": "1.9.0"}
        for rng, expected in cases.items():
            self.assertTrue(valid_range(rng), rng)
            self.assertEqual(max_satisfying(self.VERSIONS, rng), expected, rng)
        for rng in ("latest", "npm:foo@1", 5):
            self.assertFalse(valid_range(rng), rng)


class Grader(unittest.TestCase):
    def test_fixtures_get_their_verdicts(self):
        for a in ANSWERS:
            with self.subTest(a["id"]):
                self.assertEqual(grade_answer(TASKS[a["task"]], a["answer"], registry=REGISTRY)["verdict"], a["verdict"])

    @unittest.skipUnless(shutil.which("node"), "needs node for the TypeScript grader")
    def test_same_findings_as_the_typescript_grader(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "ts.jsonl"
            registry = Path(tmp) / "registry.json"
            shutil.copy(FIXTURES / "registry.json", registry)
            cmd = ["node", "src/kaggle/grade-jsonl.ts", "--in", str(FIXTURES / "answers.jsonl"), "--out", str(out), "--registry", str(registry), "--offline"]
            subprocess.run(cmd, cwd=ROOT, check=True, capture_output=True)
            for ref in map(json.loads, out.read_text().splitlines()):
                a = next(x for x in ANSWERS if x["id"] == ref["id"])
                py = grade_answer(TASKS[a["task"]], a["answer"], registry=REGISTRY)
                key = lambda f: (f["slot"], f["rule"] or "", f["label"], f["verdict"])  # noqa: E731
                self.assertEqual(sorted(map(key, py["findings"])), sorted(map(key, ref["findings"])), ref["id"])
                self.assertEqual((py["verdict"], py["missing"], py["warned"]), (ref["verdict"], ref["missing"], ref["warned"]))


class Build(unittest.TestCase):
    def test_every_task_builds_into_a_python_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            build.main(Path(tmp))
            files = sorted(Path(tmp).glob("api-freshness-*.py"))
            self.assertEqual(len(files), len(TASKS))
            for f in files:
                compile(f.read_text(), str(f), "exec")


if __name__ == "__main__":
    unittest.main()
