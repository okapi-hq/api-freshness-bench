"""Runs every task on every model listed, a small batch at a time, within Kaggle's daily quota.

    python3 kaggle/queue_runs.py runs/ -m gpt-6.1-sol -m claude-opus-5-5-default ... [--reserves reserves.json]

Models go in the order given. Kaggle reserves each request's worst-case cost before it
runs and refuses a request that doesn't fit the day's quota (`--reserves`, from
kaggle/reserves.py, says how much per model), and it drops runs started beyond some
number in flight (they stay "Unspecified" and never start). So the queue starts up to
`--batch` missing task and model pairs whose reservations fit the quota left, in model
order: when the next model's requests no longer fit, cheaper models further down use the
day's last dollars. It waits until each run is completed, errored or dropped, collects
the answers (kaggle/collect.py), and goes on. A pair that errored or was dropped is tried
again, `--tries` times in all. Safe to stop and restart: it resumes from
runs/answers.jsonl and runs/queue-state.json.
"""

import argparse
import json
import re
import subprocess
import sys
import time
from collections import Counter
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

import collect  # noqa: E402
from run import PREFIX, remaining_today, start  # noqa: E402

FINAL = {"Completed", "Errored"}


def log(message: str) -> None:
    print(f"{time.strftime('%F %T')} {message}", flush=True)


def statuses(task: str) -> dict:
    """The latest run status of each model on the task, as `kaggle b tasks status` shows it."""
    for attempt in range(4):
        res = subprocess.run(["kaggle", "b", "tasks", "status", PREFIX + task], capture_output=True, text=True, timeout=120)
        if "Model" in res.stdout:
            return {m.group(1): m.group(2) for m in re.finditer(r"^(\S+)\s+([A-Z][a-z]+)\b", res.stdout, re.M) if m.group(1) != "Model"}
        time.sleep(10 * (attempt + 1))
    return {}


def wait_for(batch: list, lost_after: float, give_up: float) -> None:
    """Waits until every pair of the batch is completed or errored, or still unstarted after `lost_after` seconds."""
    began = time.time()
    while time.time() - began < give_up:
        time.sleep(90)
        seen = {t: statuses(t) for t in dict.fromkeys(t for t, _ in batch)}
        open_pairs = [(t, m) for t, m in batch if seen[t].get(m) not in FINAL]
        if not open_pairs:
            return
        if time.time() - began > lost_after and all(seen[t].get(m) == "Unspecified" for t, m in open_pairs):
            return


def done_pairs(out: Path) -> set:
    path = out / "answers.jsonl"
    return {(r["task"], r["model"]) for r in map(json.loads, path.read_text().splitlines()) if r} if path.exists() else set()


def next_batch(pending: list, tries: dict, limit: int) -> tuple:
    """The pairs that can run: missing, with tries left, and not completed or running on Kaggle already.

    Only a pair started before can be running or done on Kaggle, so only those cost a status call
    (Kaggle rate-limits them). A completed one is waiting for its download: fetched, not run again.
    """
    candidates = [p for p in pending if tries.get("|".join(p), 0) < limit]
    tried = [p for p in candidates if tries.get("|".join(p), 0) > 0]
    seen = {t: statuses(t) for t in dict.fromkeys(t for t, _ in tried)}
    landed = [(t, m) for t, m in tried if seen[t].get(m) == "Completed"]
    for t, m in landed:
        tries[f"{t}|{m}"] = tries.get(f"{t}|{m}", 0) + 1
    running = [(t, m) for t, m in tried if seen[t].get(m) in {"Running", "Queued", "Scheduled", "Pending"} or not seen[t]]
    busy = set(landed) | set(running)
    return [p for p in candidates if p not in busy], landed, running


def within_budget(eligible: list, reserve_of, budget: float, size: int) -> list:
    """The first pairs, in model order, whose reservations fit the budget.

    A pair that doesn't fit is skipped, so the day's last dollars go to cheaper models down the list.
    """
    batch = []
    for t, m in eligible:
        if reserve_of(m) <= budget:
            batch.append((t, m))
            budget -= reserve_of(m)
            if len(batch) == size:
                break
    return batch


def start_batch(batch: list, tries: dict) -> None:
    for task in dict.fromkeys(t for t, _ in batch):
        models = [m for t, m in batch if t == task]
        if start([task], models):
            for m in models:
                tries[f"{task}|{m}"] = tries.get(f"{task}|{m}", 0) + 1


def loop(args, tasks: list, out: Path) -> int:
    state_path = out / "queue-state.json"
    tries = json.loads(state_path.read_text()) if state_path.exists() else {}
    fetch = None
    while True:
        try:
            fetch = step(args, tasks, out, state_path, tries, fetch)
        except subprocess.SubprocessError as err:
            log(f"Kaggle did not answer ({type(err).__name__}), trying again in 5 minutes")
            time.sleep(300)
        if fetch == "done":
            return 0


def step(args, tasks: list, out: Path, state_path: Path, tries: dict, fetch):
    """One turn of the queue; returns the tasks to download on the next turn, or "done"."""
    collect.collect(out, fetch)
    done = done_pairs(out)
    pending = [(t, m) for m in args.model for t in tasks if (t, m) not in done]
    eligible, landed, running = next_batch(pending, tries, args.tries)
    state_path.write_text(json.dumps(tries))
    if landed or running:
        log(f"{len(landed)} runs completed but not downloaded, {len(running)} still running: waiting")
        time.sleep(60)
        return list(dict.fromkeys(t for t, _ in landed + running))
    if not eligible:
        log(f"finished: {len(done)} answers, {len(pending)} pairs given up")
        return "done"
    left = remaining_today()
    # Kaggle reserves each request's worst-case cost up front and refuses one that does not fit.
    batch = within_budget(eligible, lambda m: args.reserves.get(m, args.reserve), left - args.keep, args.batch)
    if not batch:
        log(f"${left:.2f} left today, waiting")
        time.sleep(args.every * 60)
        return []
    start_batch(batch, tries)
    state_path.write_text(json.dumps(tries))
    models = ", ".join(f"{m} x{n}" for m, n in Counter(m for _, m in batch).items())
    log(f"${left:.2f} left, started {len(batch)} ({models}), {len(pending)} pending")
    wait_for(batch, args.lost_after * 60, args.give_up * 60)
    time.sleep(60)
    return list(dict.fromkeys(t for t, _ in batch))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("-m", "--model", action="append", required=True)
    ap.add_argument("--batch", type=int, default=12)
    ap.add_argument("--keep", type=float, default=0.2, help="dollars to leave unspent each day")
    ap.add_argument("--reserve", type=float, default=1.3, help="dollars Kaggle may reserve per request of a model --reserves doesn't list")
    ap.add_argument("--reserves", help="JSON of dollars reserved per request, by model (kaggle/reserves.py)")
    ap.add_argument("--every", type=float, default=30, help="minutes between quota checks when the day's quota is spent")
    ap.add_argument("--lost-after", type=float, default=10, help="minutes before an unstarted run counts as dropped")
    ap.add_argument("--give-up", type=float, default=45, help="minutes to wait for a batch at most")
    ap.add_argument("--tries", type=int, default=3)
    args = ap.parse_args()
    args.reserves = json.loads(Path(args.reserves).read_text()) if args.reserves else {}
    tasks = [t["id"] for t in json.loads((HERE / "tasks.json").read_text())["tasks"]]
    return loop(args, tasks, Path(args.out))


if __name__ == "__main__":
    sys.exit(main())
