"""Downloads the Kaggle runs of every task and writes their answers as JSONL.

    python3 kaggle/collect.py runs/        # kaggle b tasks download, for each task
    python3 kaggle/collect.py runs/ --no-download

Each task's current version is read from Kaggle once and kept in runs/versions.json:
delete that file after pushing new versions. Writes `runs/answers.jsonl`: one `{"id", "task", "model", "answer", "passed", "failed"}`
per run, ready for `npm run grade -- --in runs/answers.jsonl --out runs/graded.jsonl`.
"""

import json
import re
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).parent
PREFIX = "api-freshness-"


def download(task: str, out: Path) -> None:
    cmd = ["kaggle", "b", "tasks", "download", PREFIX + task, "-o", str(out / task)]
    subprocess.run(cmd, check=False, capture_output=True, timeout=600)


def answer_of(run: dict) -> "str | None":
    """The model's reply: the last message of the task's chat."""
    for conversation in run.get("conversations", []):
        for request in conversation.get("requests", []):
            contents = request.get("contents", [])
            if contents and contents[-1].get("role") == "CONTENT_ROLE_ASSISTANT":
                return "".join(p.get("text", "") for p in contents[-1].get("parts", []))
    return None


def record(task: str, path: Path) -> "dict | None":
    run = json.loads(path.read_text())
    if run.get("state") != "BENCHMARK_TASK_RUN_STATE_COMPLETED":
        return None
    answer = answer_of(run)
    if answer is None:
        return None
    # The model's folder carries the slug `kaggle b tasks run -m` takes; the record's own slug can differ.
    model = path.parent.parent.name
    results = run.get("results") or [{}]
    return {
        "id": f"{task}/{model}/{path.parent.name}",
        "task": task,
        "model": model,
        "served": run["modelVersion"]["slug"],
        "version": int(path.parent.parent.parent.name),
        "started": run.get("startTime"),
        "answer": answer,
        "passed": results[0].get("booleanResult"),
        "failed": [a["expectation"] for a in run.get("assertions", []) if not a["status"].endswith("PASSED")],
    }


def current_version(task: str) -> "int | None":
    """The task's version on Kaggle now, the one its page ranks."""
    for _ in range(3):
        res = subprocess.run(["kaggle", "b", "tasks", "status", PREFIX + task], capture_output=True, text=True, timeout=120)
        m = re.search(r"^Version:\s+(\d+)", res.stdout, re.M)
        if m:
            return int(m.group(1))
        time.sleep(10)
    return None


def current_versions(out: Path, tasks: list) -> dict:
    """Each task's current version, read from Kaggle once and kept in runs/versions.json."""
    path = out / "versions.json"
    versions = json.loads(path.read_text()) if path.exists() else {}
    for task in tasks:
        if task not in versions:
            versions[task] = current_version(task)
    path.write_text(json.dumps(versions, indent=0))
    return versions


def collect(out: Path, fetch: "list | None" = None) -> int:
    """Downloads the runs of the `fetch` tasks (all by default), then writes every answer of each task's current version."""
    tasks = [t["id"] for t in json.loads((HERE / "tasks.json").read_text())["tasks"]]
    versions = current_versions(out, tasks)
    for task in tasks if fetch is None else fetch:
        download(task, out)
    rows = []
    for task in tasks:
        folder = out / task / f"{PREFIX}{task}" / str(versions.get(task))
        for path in sorted(folder.glob("**/*.run.json")):
            row = record(task, path)
            if row:
                rows.append(row)
    # One answer per task and model: the latest Kaggle completed, the one its task page shows.
    latest: dict = {}
    for r in sorted(rows, key=lambda r: r["started"] or ""):
        latest[(r["task"], r["model"])] = r
    rows = list(latest.values())
    (out / "answers.jsonl").write_text("".join(json.dumps(r) + "\n" for r in rows))
    print(f"{len(rows)} answers from {len({r['model'] for r in rows})} models in {out / 'answers.jsonl'}", flush=True)
    return len(rows)


if __name__ == "__main__":
    collect(Path(sys.argv[1]), [] if "--no-download" in sys.argv else None)
