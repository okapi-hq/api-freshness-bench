"""Checks the Python grader against the TypeScript one, answer by answer.

    node src/kaggle/grade-jsonl.ts --in answers.jsonl --out ts.jsonl --registry cache.json
    python3 kaggle/equivalence.py answers.jsonl ts.jsonl [cache.json]

Every answer must get the same verdict, the same findings (slot, rule, label,
verdict) and the same missing slots. Exits 1 on the first differences, listed.
"""

import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from grader.grade import grade_answer  # noqa: E402

TASKS = {t["id"]: t for t in json.loads((Path(__file__).parent / "tasks.json").read_text())["tasks"]}


def key(f: dict) -> tuple:
    return (f["slot"], f["rule"], f["label"], f["verdict"])


def main(answers_path: str, reference_path: str, cache_path: "str | None" = None) -> int:
    cache = json.loads(Path(cache_path).read_text()) if cache_path else None
    answers = {a["id"]: a for a in map(json.loads, Path(answers_path).read_text().splitlines()) if a}
    reference = [json.loads(line) for line in Path(reference_path).read_text().splitlines() if line]
    diffs, verdicts = [], Counter()
    for ref in reference:
        a = answers[ref["id"]]
        py = grade_answer(TASKS[a["task"]], a["answer"], registry=cache)
        verdicts[py["verdict"]] += 1
        same = (
            py["verdict"] == ref["verdict"]
            and sorted(map(key, py["findings"])) == sorted(map(key, ref["findings"]))
            and py["missing"] == ref["missing"]
            and py["warned"] == ref["warned"]
        )
        if not same:
            diffs.append((ref["id"], ref["verdict"], py["verdict"], set(map(key, ref["findings"])) ^ set(map(key, py["findings"]))))
    print(f"{len(reference)} answers, {len(diffs)} differ; Python verdicts {dict(verdicts)}")
    for d in diffs[:30]:
        print(" ", d)
    return 1 if diffs else 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
