"""Every package an answer installs must exist (port of `src/grader/registry.ts`).

On npm, the version its range resolves to must not be deprecated by its author. A
package name on neither registry is a hallucinated dependency: the install fails,
and anyone can register the name. `read_registries` reads npm and PyPI live.
"""

import json
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from .jsregex import js, trim
from .manifest import js_entries
from .ranges import max_satisfying, valid_range

NPM_NAME = js(r"^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$", "i")
PY_NAME = js(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
LOCAL_RANGE = js(r"^(file|link|workspace|git|https?):")
COMMENT = js(r"#.*")
REQUIREMENT = js(r"^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]*\])?\s*(.*)$")
FILE_LIKE = js(r"\.(txt|py|json|toml|cfg|lock|md|in)$", "i")
INSTALL = js(r"(?:^|\n)[ \t]*(?:\$[ \t]*)?(pip3?|uv pip|npm|pnpm|yarn|bun)[ \t]+(?:install|add|i)[ \t]+([^\n&|;#]+)", "g")
FLAG_WITH_ARG = js(r"^-[rce]$|^--(?:requirement|constraint|editable)$")
ARCHIVE = js(r"\.(txt|whl|gz|zip|toml|json|lock)$")
QUOTES = js(r"""^["']|["']$""", "g")
EXTRAS = js(r"\[[^\]]*\]")
NPM_VERSION = js(r"(?<=.)@[^/]*$")
NPX_CONFIG = js(r'"command"\s*:\s*"npx"[\s\S]{0,240}?"args"\s*:\s*\[([^\]]*)\]', "g")
NPX_LINE = js(r"(?:^|\n)[ \t]*(?:\$[ \t]*)?npx[ \t]+((?:-[\w-]+[ \t]+)*)(@?[\w./-]+(?:@[\w.^~-]+)?)", "g")
TOKEN_GAP = js(r"\s+")


def js_string(value) -> str:
    """`String(value)` for a parsed JSON value."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return "null"
    if isinstance(value, dict):
        return "[object Object]"
    if isinstance(value, list):
        return ",".join("" if v is None else js_string(v) for v in value)
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def from_package_json(text: str, out: list) -> None:
    try:
        doc = json.loads(text)
        if doc is None:
            return
        for key, runtime in (("dependencies", True), ("devDependencies", False)):
            for name, rng in js_entries(doc.get(key) if isinstance(doc, dict) else None):
                if NPM_NAME.search(name) and not LOCAL_RANGE.search(js_string(rng)):
                    out.append({"registry": "npm", "name": name, "range": rng, "runtime": runtime})
    except (ValueError, RecursionError):
        pass


def from_requirements(text: str, out: list) -> None:
    for raw in text.split("\n"):
        line = trim(COMMENT.sub("", raw, count=1))
        if not line or js(r"^(-|https?:|git\+)").search(line):
            continue
        m = REQUIREMENT.search(line)
        if not m or not PY_NAME.search(m.group(1)) or FILE_LIKE.search(m.group(1)):
            continue
        out.append({"registry": "pypi", "name": m.group(1), "range": trim(m.group(2).split(";")[0]), "runtime": True})


def from_install(text: str, out: list) -> None:
    for m in INSTALL.finditer(text):
        registry = "pypi" if m.group(1).startswith("pip") or m.group(1) == "uv pip" else "npm"
        tokens = TOKEN_GAP.split(trim(m.group(2)))
        i = 0
        while i < len(tokens):
            token = tokens[i]
            i += 1
            # `-r requirements.txt`, `-e .`, a file or a path: not a package name.
            if FLAG_WITH_ARG.search(token):
                i += 1
            if not token or token.startswith("-") or token.startswith(".") or ARCHIVE.search(token):
                continue
            if "/" in token and registry == "pypi":
                continue
            clean = EXTRAS.sub("", QUOTES.sub("", token), count=1)
            name = NPM_VERSION.sub("", clean, count=1) if registry == "npm" else js(r"[=<>~!]").split(clean)[0]
            if (NPM_NAME if registry == "npm" else PY_NAME).search(name):
                out.append({"registry": registry, "name": name, "range": "", "runtime": True})


def from_npx(text: str, out: list) -> None:
    """A package an MCP config or a shell line runs with npx."""
    lists = [[x.group(1) for x in js(r'"([^"]+)"', "g").finditer(m.group(1))] for m in NPX_CONFIG.finditer(text)]
    lists += [[m.group(2)] for m in NPX_LINE.finditer(text)]
    for args in lists:
        pkg = next((a for a in args if not a.startswith("-") and not js(r"^https?:").search(a)), None)
        if not pkg:
            continue
        name = NPM_VERSION.sub("", pkg, count=1)
        if NPM_NAME.search(name):
            out.append({"registry": "npm", "name": name, "range": "", "runtime": True})


def key_of(w: dict) -> str:
    return f"{w['registry']}:{w['name'].lower()}"


def wanted_packages(blocks) -> list:
    """The packages an answer's manifests and install commands ask for."""
    out: list = []
    for b in blocks:
        file = b.file.lower() if b.file is not None else ""
        if b.manifest and (file.endswith("package.json") or (b.lang == "json" and js(r'"dependencies"').search(b.text))):
            from_package_json(b.text, out)
        elif b.manifest and (
            js(r"requirements").search(file)
            or (not file and not js(r"""[{=]\s*["{]""").search(b.text) and not js(r"^\s*\[", "m").search(b.text))
        ):
            from_requirements(b.text, out)
        from_install(b.text, out)
        from_npx(b.text, out)
    seen, unique = set(), []
    for w in out:
        if key_of(w) not in seen:
            seen.add(key_of(w))
            unique.append(w)
    return unique


NPM = "https://www.npmjs.com/package/"
PYPI = "https://pypi.org/project/"


def js_truthy(value) -> bool:
    return not (value is None or value is False or value == "" or (isinstance(value, (int, float)) and value == 0))


def _nonexistent(w: dict, info: dict, source: str) -> dict:
    note = f"No package named {w['name']} on {w['registry']} ({info['readAt']}): the install fails."
    return {
        "slot": "deps", "rule": "nonexistent", "label": f"{w['name']} (not on {w['registry']})", "verdict": "broken",
        "excerpt": trim(f"{w['name']} {js_string(w['range'])}"),
        "fact": {"outcome": "invalid", "source": source, "origin": "registry", "note": note},
    }


def _npm_deprecated(w: dict, info: dict) -> "tuple[str | None, str | None]":
    """The version the range installs, and its author's deprecation message if the whole package is retired."""
    versions, latest, deprecated = info.get("versions") or [], info.get("latest"), info.get("deprecated") or {}
    rng = w["range"] if js_truthy(w["range"]) and valid_range(w["range"]) else (latest if latest is not None else "*")
    resolved = max_satisfying(versions, rng)
    resolved = resolved if resolved is not None else latest
    # Only a package its author retired as a whole (its latest release deprecated too), not one old
    # release flagged for a bug or a vulnerability: that is dependency hygiene, not an API going away.
    if resolved and latest and deprecated.get(latest):
        return resolved, deprecated.get(resolved) or None
    return resolved, None


def dependency_findings(blocks, cache: dict) -> list:
    """One finding per hallucinated package, and per npm runtime dependency whose resolved version is deprecated."""
    out = []
    for w in wanted_packages(blocks):
        info = cache.get(key_of(w))
        if not info:
            continue
        source = f"{NPM if w['registry'] == 'npm' else PYPI}{w['name']}"
        if not info.get("exists"):
            out.append(_nonexistent(w, info, source))
            continue
        if w["registry"] != "npm" or not w["runtime"] or not info.get("versions"):
            continue
        resolved, message = _npm_deprecated(w, info)
        if message:
            out.append({
                "slot": "deps", "rule": "npm-deprecated", "label": f"{w['name']}@{resolved} (deprecated on npm)",
                "verdict": "deprecated", "excerpt": trim(f"{w['name']} {js_string(w['range'])}"),
                "fact": {"outcome": "keeps_working", "source": source, "origin": "registry", "quote": message[:240]},
            })
    return out


def _get(url: str, headers: dict, timeout: float):
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status, json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        return err.code, None


def fetch_info(w: dict, today: str, timeout: float = 15.0) -> "dict | None":
    """What npm or PyPI says of a package today; None when the registry could not be read."""
    try:
        if w["registry"] == "npm":
            url = "https://registry.npmjs.org/" + w["name"].replace("/", "%2F", 1)
            status, doc = _get(url, {"accept": "application/vnd.npm.install-v1+json"}, timeout)
            if status == 404:
                return {"exists": False, "readAt": today}
            if not isinstance(doc, dict):
                return None
            versions = doc.get("versions") or {}
            deprecated = {v: meta["deprecated"] for v, meta in versions.items() if isinstance(meta, dict) and meta.get("deprecated")}
            latest = (doc.get("dist-tags") or {}).get("latest")
            return {"exists": True, "versions": list(versions), "deprecated": deprecated, "latest": latest, "readAt": today}
        status, doc = _get(f"https://pypi.org/pypi/{urllib.parse.quote(w['name'], safe='')}/json", {}, timeout)
        if status == 404:
            return {"exists": False, "readAt": today}
        if not isinstance(doc, dict):
            return None
        return {"exists": True, "latest": (doc.get("info") or {}).get("version"), "readAt": today}
    except Exception:
        return None


def read_registries(blocks, today: str, cache: "dict | None" = None) -> dict:
    """Reads every package the answer installs from its registry, a few at a time."""
    cache = {} if cache is None else cache
    todo = [w for w in wanted_packages(blocks) if key_of(w) not in cache]
    with ThreadPoolExecutor(max_workers=8) as pool:
        for w, info in zip(todo, pool.map(lambda w: fetch_info(w, today), todo)):
            if info is not None:
                cache[key_of(w)] = info
    return cache
