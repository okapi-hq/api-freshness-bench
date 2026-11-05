"""Writes one self-contained Kaggle task per benchmark task, in kaggle/build/.

    node src/kaggle/export-tasks.ts    # kaggle/tasks.json, from src/tasks
    python3 kaggle/build.py            # kaggle/build/api-freshness-<task>.py

Each file holds the task's prompt, its rules and facts, and the grader (the
modules of kaggle/grader, in one piece), so what runs on Kaggle can be read
on Kaggle. Push one with `kaggle b tasks push <name> -f <file>`.
"""

import ast
import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
GRADER = HERE / "grader"
OUT = HERE / "build"
MODULES = ["jsregex", "semver", "ranges", "status", "extract", "expand", "manifest", "registry", "grade"]
REPO = "https://github.com/okapi-hq/api-freshness-bench"
# Output tokens a model may spend on an answer, reasoning included: more than any answer has needed
# so far (about 20,000), and a cap Kaggle's proxy needs to reserve a request's cost.
MAX_OUTPUT_TOKENS = 32000


def okapi_url(content: str, path: str = "/") -> str:
    return f"https://okapi.bot{path}?utm_source=kaggle&utm_medium=benchmark&utm_content={content}"


def module_body(name: str, imports: set) -> str:
    """A grader module without its docstring and imports; its stdlib imports go to `imports`."""
    src = (GRADER / f"{name}.py").read_text()
    tree = ast.parse(src)
    lines = src.split("\n")
    drop = set()
    for node in tree.body:
        is_doc = isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant) and isinstance(node.value.value, str)
        if isinstance(node, (ast.Import, ast.ImportFrom)) or is_doc:
            drop.update(range(node.lineno - 1, node.end_lineno))
            if isinstance(node, (ast.Import, ast.ImportFrom)) and not (isinstance(node, ast.ImportFrom) and node.level):
                imports.add(ast.get_source_segment(src, node))
    doc = ast.get_docstring(tree) or ""
    body = "\n".join(l for i, l in enumerate(lines) if i not in drop).strip("\n")
    return f"# --- {name}.py: {doc.splitlines()[0] if doc else ''}\n\n{body}\n"


def check_names() -> None:
    """The modules share one namespace once inlined: no top-level name may repeat."""
    seen: dict = {}
    for name in MODULES:
        for node in ast.parse((GRADER / f"{name}.py").read_text()).body:
            targets = [node.name] if isinstance(node, (ast.FunctionDef, ast.ClassDef)) else []
            if isinstance(node, ast.Assign):
                targets = [t.id for t in node.targets if isinstance(t, ast.Name)]
            for t in targets:
                if t in seen and seen[t] != name:
                    raise SystemExit(f"{t} is defined in both {seen[t]}.py and {name}.py")
                seen[t] = name


def task_json(task: dict) -> str:
    text = json.dumps(task, indent=1, ensure_ascii=False)
    if '"""' in text or text.endswith("\\"):
        raise SystemExit(f"{task['id']}: its JSON cannot sit in a raw string")
    return text


def header(task: dict, edition: str) -> str:
    return f"""# %%
# API freshness, {task['title']}.
#
# {task['evidence']}
#
# The model gets the prompt below and writes the code. The grader then reads every model id,
# endpoint, SDK call and API version in it and looks each one up in the facts below: the
# breaking changes Okapi tracks ({okapi_url(task['id'] + '-header')}), as of {edition}, each
# with its source. The task passes when nothing in the code is broken, retiring within six
# months or deprecated. The model may spend up to {MAX_OUTPUT_TOKENS:,} output tokens on its answer,
# reasoning included. Tasks, grader and method: {REPO}
"""


def task_cell(task: dict, name: str) -> str:
    description = (
        f"{task['title']}. Every API call is checked against the breaking changes Okapi tracks "
        f"(https://okapi.bot/?utm_source=kaggle). Grader: {REPO}"
    )
    if len(description) > 255 or len(name) > 255:
        raise SystemExit(f"{name}: Kaggle takes 255 characters at most ({len(description)})")
    return f'''# %%
FAILS = {{"broken": "fails today", "at_risk": "retires or redirects within six months", "deprecated": "is deprecated"}}


def described(f: dict) -> str:
    fact = f.get("fact") or {{}}
    when = f", on {{fact['effective']}}" if fact.get("effective") else ""
    source = f" ({{fact['source']}})" if fact.get("source") else ""
    return f"{{f['label']}}{{when}}{{source}}"


@kbench.task(name={name!r}, description={description!r})
def api_freshness(llm) -> bool:
    with kbench.chats.new(system_instructions=f"{{SYSTEM}}\\nToday's date is {{EDITION}}."):
        answer = llm.prompt(PROMPT, extra_api_params={{"max_completion_tokens": MAX_OUTPUT_TOKENS}})
    registry = read_registries(extract_blocks(answer), datetime.date.today().isoformat())
    grade = grade_answer(TASK, answer, today=EDITION, registry=registry)
    labels = {{s["id"]: s["label"] for s in TASK["slots"]}}
    kbench.assertions.assert_true(
        not grade["missing"],
        expectation="The code makes the choices the task needs"
        + (f"; it never names: {{', '.join(labels[m] for m in grade['missing'])}}" if grade["missing"] else ""),
    )
    for verdict, says in FAILS.items():
        found = [f for f in grade["findings"] if f["verdict"] == verdict]
        kbench.assertions.assert_true(
            not found, expectation=f"Nothing it uses {{says}}" + (f": {{'; '.join(map(described, found))}}" if found else "")
        )
    return not grade["missing"] and not any(f["verdict"] in FAILS for f in grade["findings"])


api_freshness.run(kbench.llm)
'''


def build(data: dict, grader: str, imports: list, out: Path = OUT) -> int:
    out.mkdir(exist_ok=True)
    for task in data["tasks"]:
        name = f"api-freshness-{task['id']}"
        consts = (
            f"EDITION = {data['date']!r}\nMAX_OUTPUT_TOKENS = {MAX_OUTPUT_TOKENS}\n"
            f"SYSTEM = {data['system']!r}\nPROMPT = {task['prompt']!r}\n"
            f'TASK = json.loads(r"""{task_json(task)}""")\n'
        )
        top = "\n".join(imports) + "\n\nimport kaggle_benchmarks as kbench\n"
        text = f"{header(task, data['date'])}\n{top}\n{consts}\n\n# %%\n{grader}\n\n{task_cell(task, name)}"
        (out / f"{name}.py").write_text(text)
    return len(data["tasks"])


def main(out: Path = OUT) -> int:
    check_names()
    imports: set = {"import datetime", "import json"}
    grader = "\n\n".join(module_body(m, imports) for m in MODULES)
    data = json.loads((HERE / "tasks.json").read_text())
    n = build(data, grader, sorted(imports, key=lambda s: (s.startswith("from"), s)), out)
    print(f"{n} tasks written to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
