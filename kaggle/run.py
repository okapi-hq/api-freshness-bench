"""Starts Kaggle runs of the pushed tasks for some models, within the day's quota.

    python3 kaggle/run.py -m gpt-6.1-sol -m claude-opus-5-5-default [--done runs/answers.jsonl] [--keep 1.50]

Skips the task and model pairs already in `--done` (from kaggle/collect.py) and
stops when the day's remaining Model Proxy quota drops below `--keep` dollars.
Runs are started, not awaited: collect them later with kaggle/collect.py, or let
kaggle/queue_runs.py do both.
"""

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).parent
PREFIX = "api-freshness-"


def remaining_today() -> float:
    """Dollars left today on the Model Proxy quota; 0 when Kaggle does not answer."""
    for attempt in range(4):
        out = subprocess.run(["kaggle", "b", "quota"], capture_output=True, text=True, timeout=120).stdout
        m = re.search(r"^Daily\s+\$([\d.]+)\s+\$([\d.]+)", out, re.M)
        if m:
            return float(m.group(2))
        time.sleep(15 * (attempt + 1))
    print("cannot read the quota", flush=True)
    return 0.0


def start(tasks: list, models: list) -> list:
    """Starts each task on the models; returns the tasks Kaggle accepted."""
    started = []
    for task in tasks:
        cmd = ["kaggle", "b", "tasks", "run", PREFIX + task] + [x for m in models for x in ("-m", m)]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if res.returncode == 0:
            started.append(task)
        print(f"{'started' if res.returncode == 0 else 'FAILED '} {task}: {' '.join(models)}", flush=True)
        if res.returncode != 0:
            print(f"{res.stdout[-400:]}{res.stderr[-400:]}", flush=True)
        time.sleep(2)
    return started


def errored(task: str) -> set:
    """The models whose latest run of the task errored."""
    out = subprocess.run(["kaggle", "b", "tasks", "status", PREFIX + task], capture_output=True, text=True, timeout=120).stdout
    return {m.group(1) for m in re.finditer(r"^(\S+)\s+Errored\b", out, re.M)}


def done_pairs(path: "str | None") -> set:
    if not path or not Path(path).exists():
        return set()
    return {(r["task"], r["model"]) for r in map(json.loads, Path(path).read_text().splitlines()) if r}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("-m", "--model", action="append", required=True)
    ap.add_argument("--done")
    ap.add_argument("--keep", type=float, default=1.5)
    ap.add_argument("--tasks", help="comma-separated task ids (default: all)")
    args = ap.parse_args()
    tasks = [t["id"] for t in json.loads((HERE / "tasks.json").read_text())["tasks"]]
    if args.tasks:
        tasks = [t for t in tasks if t in args.tasks.split(",")]
    done = done_pairs(args.done)
    count = 0
    for i, task in enumerate(tasks):
        models = [m for m in args.model if (task, m) not in done]
        if not models:
            continue
        if i % 8 == 0 and remaining_today() < args.keep:
            print(f"stopping before {task}: less than ${args.keep} left today")
            break
        count += len(models) * len(start([task], models))
    print(f"{count} runs started")
    return 0


if __name__ == "__main__":
    sys.exit(main())
