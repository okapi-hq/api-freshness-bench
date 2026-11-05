"""The highest major each package the answer depends on can install (port of `src/grader/manifest.ts`).

What `pip install -r requirements.txt` or `npm install` would pick today. A package
the code imports with no manifest entry installs its latest release.
"""

import json
import math

from .jsregex import js, trim

NONE = math.inf


def normalise(name: str) -> str:
    return js(r"[_.]+", "g").sub("-", name.lower())


def max_major(spec: str) -> float:
    """The highest major a version range allows (`^4.2` → 4, `>=1,<2` → 1, `*` → ∞)."""
    s = js(r"^v").sub("", trim(spec), count=1)
    if not s or s in ("*", "latest", "x"):
        return NONE
    lt = js(r"<\s*=?\s*v?(\d+)(?:\.(\d+))?").search(s)
    if lt:
        major = int(lt.group(1))
        inclusive = bool(js(r"<=").search(s))
        minor_zero = lt.group(2) is None or int(lt.group(2)) == 0
        return major if inclusive or not minor_zero else major - 1
    if js(r"^(>=|>)").search(s) and "," not in s:
        return NONE
    pinned = js(r"^(?:\^|~|~=|==|=)?\s*v?(\d+)").search(s)
    return int(pinned.group(1)) if pinned else NONE


def add_spec(out: dict, name: str, spec) -> None:
    if not isinstance(spec, str):
        raise TypeError("spec.trim is not a function")
    key = normalise(name)
    major = max_major(spec)
    out[key] = major if key not in out else max(out[key], major)


PINNED_REQUIREMENT = js(r"^([A-Za-z0-9][A-Za-z0-9_.-]*)(\[[^\]]*\])?\s*((?:[=<>~!]=?|===)\s*[^;\s]+(?:\s*,\s*[=<>~!]=?\s*[^;\s,]+)*)?")
LINE_COMMENT = js(r"#.*")


def majors_from_requirements(text: str, out: dict) -> None:
    for raw in text.split("\n"):
        line = trim(LINE_COMMENT.sub("", raw, count=1))
        m = PINNED_REQUIREMENT.search(line)
        if m and not js(r"^(-|https?:)").search(line):
            add_spec(out, m.group(1), m.group(3) or "")


def js_entries(value) -> list:
    """`Object.entries(value ?? {})` for a parsed JSON value."""
    if isinstance(value, dict):
        return list(value.items())
    if isinstance(value, str):
        return [(str(i), c) for i, c in enumerate(value)]
    if isinstance(value, list):
        return [(str(i), v) for i, v in enumerate(value)]
    return []


def majors_from_package_json(text: str, out: dict) -> None:
    try:
        doc = json.loads(text)
        if doc is None:
            raise TypeError("null")
        for key in ("dependencies", "devDependencies", "peerDependencies", "require", "require-dev"):
            for name, spec in js_entries(doc.get(key) if isinstance(doc, dict) else None):
                add_spec(out, name, spec)
    except (ValueError, TypeError, RecursionError):
        for m in js(r'"(@?[\w./-]+)"\s*:\s*"([^"]+)"', "g").finditer(text):
            add_spec(out, m.group(1), m.group(2))


TOML_STRING = js(r"""["']([A-Za-z0-9][\w.-]*)(\[[^\]]*\])?\s*([=<>~!^]=?[^"']*)?["']""", "g")
TOML_KEY = js(r"""^\s*([A-Za-z0-9][\w.-]*)\s*=\s*\{?\s*(?:version\s*=\s*)?["']([^"']+)["']""", "gm")
GO_REQUIRE = js(r"^\s*(?:require\s+)?([\w.-]+\.[a-z]{2,}\/[\w./-]+)\s+v(\d+)\S*", "gm")
GRADLE = js(r"""["']([\w.-]+):([\w.-]+):([\w.+-]+)["']""", "g")
PUBSPEC = js(r"^\s{2,}([a-z][\w]*):\s*\^?([\d.]+)", "gm")


def from_toml_and_others(text: str, out: dict) -> None:
    """pyproject (PEP 621 strings and Poetry tables), Cargo, go.mod, composer, gradle, pubspec."""
    for m in TOML_STRING.finditer(text):
        if m.group(3):
            add_spec(out, m.group(1), m.group(3))
    for m in TOML_KEY.finditer(text):
        add_spec(out, m.group(1), m.group(2))
    for m in GO_REQUIRE.finditer(text):
        add_spec(out, js(r"\/v\d+$").sub("", m.group(1), count=1), m.group(2))
    for m in GRADLE.finditer(text):
        add_spec(out, f"{m.group(1)}:{m.group(2)}", m.group(3))
    for m in PUBSPEC.finditer(text):
        add_spec(out, m.group(1), m.group(2))


INSTALL_COMMAND = js(r"(?:pip3?|uv pip|poetry|npm|pnpm|yarn|bun|go|composer|cargo)[ \t]+(?:install|add|get|require|i)[ \t]+([^\n&|;]+)", "g")
TOKEN = js(r"^(@?[^@=<>~!]+)(?:@|==|>=|~=|<|<=|=)?(.*)$")
EDGE_QUOTES = js(r"""^["']|["']$""", "g")
OPERATOR = js(r"^[@=<>~!]+")


def from_install_commands(text: str, out: dict) -> None:
    """`pip install x==1`, `npm i x@4`, `go get x@v1`… anywhere in the answer's blocks."""
    for m in INSTALL_COMMAND.finditer(text):
        for token in js(r"\s+").split(m.group(1)):
            if not token or token.startswith("-"):
                continue
            clean = EDGE_QUOTES.sub("", token)
            at = TOKEN.search(clean)
            if not at:
                continue
            op_match = OPERATOR.search(clean[len(at.group(1)) :])
            op = op_match.group(0) if op_match else ""
            spec = at.group(2) if op == "@" else f"{op.replace('@', '', 1)}{at.group(2)}"
            add_spec(out, at.group(1), spec)


def from_manifest(block, out: dict) -> None:
    t = trim(block.text)
    file = block.file.lower() if block.file is not None else ""
    if file.endswith("package.json") or file.endswith("composer.json") or t.startswith("{"):
        majors_from_package_json(t, out)
    elif js(r"requirements|pipfile").search(file) or not js(r"[[{]|^\s*module\s|:\s", "m").search(t):
        majors_from_requirements(t, out)
    else:
        from_toml_and_others(t, out)


def read_majors(blocks) -> dict:
    """Every package the answer's manifests and install commands name, with its highest major."""
    out: dict = {}
    for block in blocks:
        if block.manifest:
            from_manifest(block, out)
        from_install_commands(block.text, out)
    return out


def major_of(majors: dict, pkg: str) -> float:
    """The highest major of `pkg` the answer can install (∞ when it does not say)."""
    return majors.get(normalise(pkg), NONE)
