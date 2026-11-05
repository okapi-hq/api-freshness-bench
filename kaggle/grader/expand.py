"""Light constant propagation (port of `src/grader/expand.ts`).

Code often builds a URL from a base constant (`API = "https://api.spotify.com/v1"`,
then `${API}/recommendations`). The grader matches the code and, beside it, a copy
where each constant holding a URL, a path, a version or an id is written in place
of its name, with string concatenations joined, so the endpoint it calls reads whole.
"""

import re

from .jsregex import js, replace_value

ASSIGN = js(
    r"""(?:\b(?:const|let|var|final|static|val|pub)\s+)?\$?\b([A-Za-z_][A-Za-z0-9_]*)\b[ \t]*(?::[ \t]*[&\w<>[\]' ]+?[ \t]*)?(?::=|=)[ \t]*(?:(?:os\.environ\.get|os\.getenv|getenv|env)\(\s*["'][^"']+["']\s*,\s*|process\.env\.\w+\s*(?:\|\||\?\?)\s*|Deno\.env\.get\(["'][^"']+["']\)\s*(?:\|\||\?\?)\s*)?(?:r|f|b)?["'`]([^"'`\n]{2,200})["'`]""",
    "g",
)
DEFINE = js(r"""define\(\s*["']([A-Za-z_]\w*)["']\s*,\s*["']([^"'\n]{2,200})["']\s*\)""", "g")
HAS_BLANK = js(r"\s")
URLISH = js(r"^(https?:|wss?:|\/|v?\d)")
HOSTISH = js(r"^[\w.-]+\.[a-z]{2,}(\/|$)")
IDISH = js(r"^[\w.:/-]{2,80}$")
JOIN_PLUS = js(r"""["'`]\s*\+\s*["'`]""", "g")
JOIN_DOT = js(r"""["'`]\s*\.\s*["'`]""", "g")


def worth(value: str) -> bool:
    """Values worth inlining: URLs, paths, version strings, ids. Not prose."""
    if HAS_BLANK.search(value):
        return False
    return bool(URLISH.search(value) or HOSTISH.search(value) or IDISH.search(value))


def constants_of(code: str) -> "dict[str, str]":
    out: dict[str, str] = {}
    for pattern in (ASSIGN, DEFINE):
        for m in pattern.finditer(code):
            name, value = m.group(1), m.group(2)
            if len(name) < 2 or not worth(value) or name in out:
                continue
            out[name] = value
    return out


def expand_constants(code: str) -> str:
    """The code with every worthwhile constant written in place of its uses."""
    constants = constants_of(code)
    if not constants:
        return ""
    out = code
    for name, value in constants.items():
        # A class constant read through its instance or class (`self.BASE_URL`, `this.baseUrl`, `static::API`).
        n = rf"(?:(?:self|this|cls|Self|static)(?:\.|::))?\$?{name}"
        # Inside a template or an f-string the value goes in bare; a bare use gets quotes, so joins below close up.
        out = js(rf"\$\{{\s*{n}\s*\}}|(?<![\w$])\{{\s*{n}\s*\}}", "g").sub(replace_value(value), out)
        out = js(rf"(?<![\w$.\"'`/{{])\$?{n}(?![\w(])", "g").sub(replace_value(f'"{value}"'), out)
    return JOIN_DOT.sub("", JOIN_PLUS.sub("", out))
