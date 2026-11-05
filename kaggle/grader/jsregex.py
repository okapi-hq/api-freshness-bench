"""JavaScript regular expressions, run by Python's `re`.

The knowledge base writes its patterns for JavaScript. This module rewrites a
JavaScript pattern into an equivalent Python one: lookbehinds of several widths
are split into fixed-width ones, `.`, `^` and `$` keep their JavaScript meaning,
and `[` inside a character class is escaped. `\\w`, `\\d` and `\\b` are ASCII,
as in JavaScript without the `u` flag.
"""

import re
from functools import lru_cache

LINE_END = "\\n\\r\\u2028\\u2029"
DOT = f"[^{LINE_END}]"
# JavaScript's \\s: Unicode spaces and line ends, not Python's ASCII set.
SPACE_CLASS = "\\t\\n\\v\\f\\r \\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff"
# Letter escapes JavaScript knows; any other letter escape is the letter itself.
KNOWN = set("bBdDwWsSnrtvf")
GROUP = re.compile(r"\((?:\?(?:<=|<!|=|!|:|<([A-Za-z_]\w*)>))?")
QUANT = re.compile(r"\*\??|\+\??|\?\??|\{\d+(?:,\d*)?\}\??")


class Unsupported(ValueError):
    """A pattern this converter cannot rewrite faithfully."""


def _class_end(src: str, i: int) -> int:
    """Index just past the character class that opens at `src[i] == '['`."""
    j = i + 1
    if j < len(src) and src[j] == "^":
        j += 1
    while j < len(src):
        if src[j] == "\\":
            j += 2
            continue
        if src[j] == "]":
            return j + 1
        j += 1
    raise Unsupported(f"unterminated class in {src!r}")


def _convert_class(body: str) -> str:
    """A JavaScript class `[...]` as Python writes it: `[`, and doubled `&|~-`, escaped."""
    if body == "[]":
        return "(?!)"
    if body == "[^]":
        return "[\\s\\S]"
    out, i = [], 1
    if body[1:2] == "^":
        out.append("^")
        i = 2
    while i < len(body) - 1:
        c = body[i]
        if c == "\\":
            esc, i = _escape(body, i, in_class=True)
            out.append(esc)
            continue
        if c == "[" or (c in "&|~-" and out and out[-1] == c):
            out.append("\\" + c)
        else:
            out.append(c)
        i += 1
    return "[" + "".join(out) + "]"


def _escape(src: str, i: int, in_class: bool) -> tuple[str, int]:
    """The Python spelling of the escape at `src[i] == '\\\\'`, and the index after it."""
    letter = src[i + 1 : i + 2]
    if not letter:
        raise Unsupported(f"trailing backslash in {src!r}")
    if letter == "u" and re.match(r"[0-9a-fA-F]{4}", src[i + 2 : i + 6]):
        return src[i : i + 6], i + 6
    if letter == "x" and re.match(r"[0-9a-fA-F]{2}", src[i + 2 : i + 4]):
        return src[i : i + 4], i + 4
    if letter == "s":
        return (SPACE_CLASS if in_class else f"[{SPACE_CLASS}]"), i + 2
    if letter == "S" and not in_class:
        return f"[^{SPACE_CLASS}]", i + 2
    if letter.isalpha() and letter not in KNOWN:
        return re.escape(letter), i + 2
    return src[i : i + 2], i + 2


class _Parser:
    """A recursive-descent reader of a JavaScript pattern into (python_source, width) pieces."""

    def __init__(self, src: str, flags: str):
        self.src, self.i = src, 0
        self.multiline, self.dotall = "m" in flags, "s" in flags

    def alternatives(self) -> list[list[tuple[str, object]]]:
        """Top-level alternatives until `)` or the end; each a list of (source, width) atoms."""
        alts: list[list[tuple[str, object]]] = [[]]
        while self.i < len(self.src) and self.src[self.i] != ")":
            if self.src[self.i] == "|":
                self.i += 1
                alts.append([])
                continue
            alts[-1].append(self.atom())
        return alts

    def atom(self) -> tuple[str, object]:
        src, i = self.src, self.i
        c = src[i]
        if c == "\\":
            letter = src[i + 1 : i + 2]
            esc, self.i = _escape(src, i, in_class=False)
            if letter in ("b", "B"):
                return self.quantified(esc, 0)
            if letter.isdigit() and letter != "0":
                return self.quantified(esc, None)
            return self.quantified(esc, 1)
        if c == "[":
            end = _class_end(src, i)
            self.i = end
            return self.quantified(_convert_class(src[i:end]), 1)
        if c == "(":
            return self.group()
        if c == ".":
            self.i += 1
            return self.quantified("[\\s\\S]" if self.dotall else DOT, 1)
        if c == "^":
            self.i += 1
            return ((f"(?:\\A|(?<=[{LINE_END}]))" if self.multiline else "\\A"), 0)
        if c == "$":
            self.i += 1
            return ((f"(?=[{LINE_END}]|\\Z)" if self.multiline else "\\Z"), 0)
        if c == "{" and not QUANT.match(src, i):
            self.i += 1
            return self.quantified("\\{", 1)
        self.i += 1
        return self.quantified(re.escape(c) if c in " #" else c, 1)

    def group(self) -> tuple[str, object]:
        src = self.src
        head = GROUP.match(src, self.i)
        opener = head.group(0)
        self.i += len(opener)
        alts = self.alternatives()
        if self.i >= len(src):
            raise Unsupported(f"unbalanced group in {src!r}")
        self.i += 1
        if opener in ("(?<=", "(?<!"):
            return (_lookbehind(opener == "(?<=", alts), 0)
        body = "|".join("".join(s for s, _ in alt) for alt in alts)
        if opener in ("(?=", "(?!"):
            return (f"{opener}{body})", 0)
        if head.group(1):
            opener = f"(?P<{head.group(1)}>"
        width = _width(alts)
        return self.quantified(f"{opener}{body})", width, alts if opener == "(?:" else None)

    def quantified(self, atom: str, width, alts=None) -> tuple[str, object]:
        m = QUANT.match(self.src, self.i)
        if not m:
            return (atom, width if alts is None else (width, alts))
        self.i = m.end()
        q = m.group(0)
        fixed = re.fullmatch(r"\{(\d+)(?:,(\d+))?\}", q)
        if width is not None and fixed and (fixed.group(2) is None or fixed.group(1) == fixed.group(2)):
            return (atom + q, width * int(fixed.group(1)))
        return (atom + q, 0 if width == 0 else None)


def _width_of(w) -> object:
    return w[0] if isinstance(w, tuple) else w


def _width(alts) -> object:
    widths = set()
    for alt in alts:
        total = 0
        for _, w in alt:
            w = _width_of(w)
            if w is None:
                return None
            total += w
        widths.add(total)
    return widths.pop() if len(widths) == 1 else None


def _expand(alt, limit=256) -> list[tuple[str, int]]:
    """Every fixed-width spelling of one alternative, distributing its non-capturing groups."""
    out = [("", 0)]
    for src, w in alt:
        if isinstance(w, tuple):
            width, inner = w
            if width is None:
                options = [o for a in inner for o in _expand(a, limit)]
            else:
                options = [(src, width)]
        elif w is None:
            raise Unsupported(f"variable-width lookbehind piece {src!r}")
        else:
            options = [(src, w)]
        out = [(a + b, x + y) for a, x in out for b, y in options]
        if len(out) > limit:
            raise Unsupported("lookbehind expands too far")
    return out


def _lookbehind(positive: bool, alts) -> str:
    """A lookbehind as Python accepts it: one fixed-width lookbehind per width."""
    by_width: dict[int, list[str]] = {}
    for alt in alts:
        for src, w in _expand(alt):
            by_width.setdefault(w, []).append(src)
    parts = []
    for w, srcs in by_width.items():
        body = "|".join(srcs)
        if w == 0:
            parts.append(f"(?:{body})" if positive else f"(?!(?:{body}))")
        else:
            parts.append(f"(?<={body})" if positive else f"(?<!{body})")
    if positive:
        return parts[0] if len(parts) == 1 else "(?:" + "|".join(parts) + ")"
    return "".join(parts)


def to_python(src: str, flags: str = "") -> str:
    """The Python source of a JavaScript pattern."""
    parser = _Parser(src, flags)
    alts = parser.alternatives()
    if parser.i != len(src):
        raise Unsupported(f"unbalanced ) in {src!r}")
    return "|".join("".join(s for s, _ in alt) for alt in alts)


@lru_cache(maxsize=None)
def js(src: str, flags: str = "") -> "re.Pattern[str]":
    """A JavaScript pattern, compiled by Python with JavaScript's meaning."""
    py_flags = re.ASCII
    if "i" in flags:
        py_flags |= re.IGNORECASE
    return re.compile(to_python(src, flags), py_flags)


SPACE_CHARS = "\t\n\v\f\r \u00a0\u1680" + "".join(chr(c) for c in range(0x2000, 0x200B)) + "\u2028\u2029\u202f\u205f\u3000\ufeff"


def trim(s: str) -> str:
    """`String.prototype.trim`: JavaScript's spaces, not Python's."""
    return s.strip(SPACE_CHARS)


def replace_value(value: str):
    """A `re.sub` replacement that reads `value` as JavaScript reads a replacement string."""

    def expand(m: "re.Match[str]") -> str:
        out, i = [], 0
        while i < len(value):
            c, nxt = value[i], value[i + 1 : i + 2]
            if c == "$" and nxt == "$":
                out.append("$")
                i += 2
            elif c == "$" and nxt == "&":
                out.append(m.group(0))
                i += 2
            elif c == "$" and nxt == "`":
                out.append(m.string[: m.start()])
                i += 2
            elif c == "$" and nxt == "'":
                out.append(m.string[m.end() :])
                i += 2
            else:
                out.append(c)
                i += 1
        return "".join(out)

    return expand
