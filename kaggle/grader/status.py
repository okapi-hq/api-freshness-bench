"""What a call gets on a day (port of `src/grader/status.ts`)."""

from datetime import date, timedelta

# The day the benchmark reads the world: every fact is judged as of this day.
BENCH_DATE = "2026-10-24"
# How far ahead "keeps working" looks: a change dated within six months is at risk.
HORIZON_DAYS = 182


def add_days(day: str, days: int) -> str:
    return (date.fromisoformat(day) + timedelta(days=days)).isoformat()


def status_of(fact: dict, today: str = BENCH_DATE, horizon: int = HORIZON_DAYS) -> "str | None":
    """What a call built on this fact gets, on `today`, looking `horizon` days ahead."""
    until = add_days(today, horizon)
    outcome, effective = fact.get("outcome"), fact.get("effective")
    if outcome == "ok":
        return "ok"
    if outcome == "invalid":
        return "broken"
    if outcome == "keeps_working":
        return "deprecated"
    if outcome == "redirected":
        if not effective:
            return "deprecated"
        return "at_risk" if effective <= until else "ok"
    if outcome == "fails":
        if not effective:
            return "deprecated"
        if effective <= today:
            return "broken"
        return "at_risk" if effective <= until else "ok"
    return None


RANK = {"ok": 0, "deprecated": 1, "at_risk": 2, "missing": 3, "unknown": 4, "broken": 5}


def worst(verdicts: list) -> str:
    """The worst of several verdicts: one broken call breaks the integration."""
    out = "ok"
    for v in verdicts:
        if RANK.get(v, -1) > RANK[out]:
            out = v
    return out
