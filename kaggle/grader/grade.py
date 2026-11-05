"""Grades one answer against one task (port of `src/grader/grade.ts`)."""

from .expand import expand_constants
from .extract import read_answer
from .jsregex import js, trim
from .manifest import major_of, read_majors
from .registry import dependency_findings
from .status import BENCH_DATE, status_of, worst

WARNING = js(r"retired|deprecat|sunset|shut(?:ting)? down|no longer (?:available|supported|work)|discontinu|end[- ]of[- ]life|decommission", "i")
FENCED = js(r"```[\s\S]*?```", "g")
TRAILING = js(r"[.-]+$")


def regex_of(pattern: str, flags: "str | None" = None):
    return js(pattern, (flags or "").replace("g", ""))


def excerpt_at(text: str, index: int) -> str:
    """The line holding the match, trimmed: what the report shows as evidence."""
    start = text.rfind("\n", 0, index + 1) + 1
    end = text.find("\n", index)
    line = text[start:] if end == -1 else text[start:end]
    return trim(line)[:200]


def find_hits(task: dict, code: str, manifest: str) -> dict:
    hits: dict = {}
    for slot in task["slots"]:
        for rule in slot["rules"]:
            text = manifest if rule.get("scope") == "manifest" else code
            m = regex_of(rule["pattern"], rule.get("flags")).search(text)
            if m:
                hits[f"{slot['id']}.{rule['id']}"] = (slot, rule, excerpt_at(text, m.start()))
    return hits


def holds(rule: dict, kept: set) -> bool:
    if not all(k in kept for k in rule.get("requires") or []):
        return False
    if rule.get("requiresAny") is not None and not any(k in kept for k in rule["requiresAny"]):
        return False
    return not any(k in kept for k in rule.get("unless") or [])


def apply_conditions(hits: dict) -> list:
    """Keeps the hits whose conditions hold against the other kept hits, until the kept set settles."""
    kept = set(hits)
    for _ in range(6):
        nxt = {k for k, (_, rule, _) in hits.items() if holds(rule, kept)}
        if nxt == kept:
            break
        kept = nxt
    return [h for k, h in hits.items() if k in kept]


def fact_for(rule: dict, majors: dict) -> dict:
    """The fact a hit stands on: an SDK gate swaps it when the manifest keeps the old major."""
    sdk = rule.get("sdk")
    if not sdk:
        return rule["fact"]
    return sdk["pinned"] if major_of(majors, sdk["pkg"]) < sdk["breaksFrom"] else rule["fact"]


def finding_of(hit, majors: dict, today: str) -> dict:
    slot, rule, excerpt = hit
    fact = fact_for(rule, majors)
    return {"slot": slot["id"], "rule": rule["id"], "label": rule["label"], "verdict": status_of(fact, today), "fact": fact, "excerpt": excerpt}


def unknown_candidates(slot: dict, code: str) -> list:
    """Values shaped like the slot's that no rule explains: one `unknown` finding each."""
    if not slot.get("candidate"):
        return []
    seen, out = set(), []
    pattern = regex_of(slot["candidate"], slot.get("candidateFlags"))
    for m in pattern.finditer(code):
        group = m.group(1) if pattern.groups >= 1 else None
        value = TRAILING.sub("", group if group is not None else m.group(0), count=1)
        if value in seen:
            continue
        seen.add(value)
        if any(r.get("scope") != "manifest" and regex_of(r["pattern"], r.get("flags")).search(value) for r in slot["rules"]):
            continue
        excerpt = excerpt_at(code, m.start())
        unknown_as = slot.get("unknownAs")
        if unknown_as:
            out.append({"slot": slot["id"], "rule": "not-listed", "label": value, "verdict": status_of(unknown_as), "fact": unknown_as, "excerpt": excerpt})
        else:
            out.append({"slot": slot["id"], "rule": None, "label": value, "verdict": "unknown", "fact": None, "excerpt": excerpt})
    return out


def warns(answer: str) -> bool:
    """The answer's prose, code blocks removed: does it warn about what it uses?"""
    return bool(WARNING.search(FENCED.sub("", answer)))


def grade_answer(task: dict, answer: str, today: str = BENCH_DATE, registry: "dict | None" = None) -> dict:
    code, manifest, blocks = read_answer(answer)
    code = f"{code}\n\n{expand_constants(code)}"
    majors = read_majors(blocks)
    findings = [finding_of(h, majors, today) for h in apply_conditions(find_hits(task, code, manifest))]
    for slot in task["slots"]:
        findings.extend(unknown_candidates(slot, code))
    if registry is not None:
        findings.extend(dependency_findings(blocks, registry))
    filled = {f["slot"] for f in findings}
    for s in task["slots"]:
        if s["absent"] == "broken" and s["id"] not in filled:
            label = s.get("absentNote") or f"no {s['label']}"
            findings.append({"slot": s["id"], "rule": None, "label": label, "verdict": "broken", "fact": None, "excerpt": ""})
    missing = [s["id"] for s in task["slots"] if s["absent"] == "missing" and s["id"] not in filled]
    verdicts = [f["verdict"] for f in findings] + (["missing"] if missing else [])
    return {"task": task["id"], "verdict": worst(verdicts), "findings": findings, "missing": missing, "warned": warns(answer)}
