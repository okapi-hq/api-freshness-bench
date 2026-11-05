"""node-semver 7.8.5 ranges (`classes/range.js`): `validRange` and `maxSatisfying`, as the registry check uses them."""

from .jsregex import js, trim
from .semver import ANY, BUILD, CARET, COMPARATORTRIM, GTE0, HYPHENRANGE, SPACES, STAR, TILDE, TILDETRIM, CARETTRIM, XRANGE, Comparator, Invalid, Version


def _is_x(identifier) -> bool:
    return not identifier or identifier.lower() == "x" or identifier == "*"


def _invalid_order(major, minor, patch) -> bool:
    return (_is_x(major) and not _is_x(minor)) or (_is_x(minor) and bool(patch) and not _is_x(patch))


def _tilde(m) -> str:
    major, minor, patch, pre = m.group(1), m.group(2), m.group(3), m.group(4)
    if _is_x(major):
        return ""
    if _is_x(minor):
        return f">={major}.0.0 <{int(major) + 1}.0.0-0"
    if _is_x(patch):
        return f">={major}.{minor}.0 <{major}.{int(minor) + 1}.0-0"
    if pre:
        return f">={major}.{minor}.{patch}-{pre} <{major}.{int(minor) + 1}.0-0"
    return f">={major}.{minor}.{patch} <{major}.{int(minor) + 1}.0-0"


def _caret(m) -> str:
    major, minor, patch, pre = m.group(1), m.group(2), m.group(3), m.group(4)
    if _is_x(major):
        return ""
    if _is_x(minor):
        return f">={major}.0.0 <{int(major) + 1}.0.0-0"
    if _is_x(patch):
        upper = f"{major}.{int(minor) + 1}.0-0" if major == "0" else f"{int(major) + 1}.0.0-0"
        return f">={major}.{minor}.0 <{upper}"
    low = f">={major}.{minor}.{patch}" + (f"-{pre}" if pre else "")
    if major == "0":
        upper = f"{major}.{minor}.{int(patch) + 1}-0" if minor == "0" else f"{major}.{int(minor) + 1}.0-0"
    else:
        upper = f"{int(major) + 1}.0.0-0"
    return f"{low} <{upper}"


def _xrange(m) -> str:
    comp, gtlt, major, minor, patch = m.group(0), m.group(1), m.group(2), m.group(3), m.group(4)
    if _invalid_order(major, minor, patch):
        return m.string
    x_major = _is_x(major)
    x_minor = x_major or _is_x(minor)
    any_x = x_minor or _is_x(patch)
    if gtlt == "=" and any_x:
        gtlt = ""
    pre = ""
    if x_major:
        return "<0.0.0-0" if gtlt in (">", "<") else "*"
    if gtlt and any_x:
        minor = 0 if x_minor else minor
        patch = 0
        if gtlt == ">":
            gtlt = ">="
            if x_minor:
                major, minor, patch = int(major) + 1, 0, 0
            else:
                minor, patch = int(minor) + 1, 0
        elif gtlt == "<=":
            gtlt = "<"
            if x_minor:
                major = int(major) + 1
            else:
                minor = int(minor) + 1
        if gtlt == "<":
            pre = "-0"
        return f"{gtlt}{major}.{minor}.{patch}{pre}"
    if x_minor:
        return f">={major}.0.0{pre} <{int(major) + 1}.0.0-0"
    if any_x:
        return f">={major}.{minor}.0{pre} <{major}.{int(minor) + 1}.0-0"
    return comp


def _hyphen(m) -> str:
    frm, f_major, f_minor, f_patch, f_pre = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
    to, t_major, t_minor, t_patch, t_pre = m.group(7), m.group(8), m.group(9), m.group(10), m.group(11)
    if _is_x(f_major):
        frm = ""
    elif _is_x(f_minor):
        frm = f">={f_major}.0.0"
    elif _is_x(f_patch):
        frm = f">={f_major}.{f_minor}.0"
    else:
        frm = f">={frm}"
    if _is_x(t_major):
        to = ""
    elif _is_x(t_minor):
        to = f"<{int(t_major) + 1}.0.0-0"
    elif _is_x(t_patch):
        to = f"<{t_major}.{int(t_minor) + 1}.0-0"
    elif t_pre:
        to = f"<={t_major}.{t_minor}.{t_patch}-{t_pre}"
    else:
        to = f"<={to}"
    return trim(f"{frm} {to}")


def _each(comp: str, pattern: str, fn) -> str:
    return " ".join(js(pattern).sub(fn, c, count=1) for c in SPACES.split(trim(comp)))


def _parse_comparator(comp: str) -> str:
    comp = js(BUILD).sub("", comp, count=1)
    comp = _each(comp, CARET, _caret)
    comp = _each(comp, TILDE, _tilde)
    comp = " ".join(js(XRANGE).sub(_xrange, trim(c), count=1) for c in SPACES.split(comp))
    return js(STAR).sub("", trim(comp), count=1)


def _groups(*indexes):
    return lambda m: "".join(m.group(i) or "" for i in indexes)


def _parse_range(rng: str) -> list:
    rng = js(BUILD, "g").sub("", rng)
    rng = js(HYPHENRANGE).sub(_hyphen, rng, count=1)
    rng = js(COMPARATORTRIM, "g").sub(_groups(1, 2, 3), rng)
    rng = js(TILDETRIM, "g").sub(lambda m: (m.group(1) or "") + "~", rng)
    rng = js(CARETTRIM, "g").sub(lambda m: (m.group(1) or "") + "^", rng)
    parts = SPACES.split(" ".join(_parse_comparator(c) for c in rng.split(" ")))
    comparators = [Comparator(js(GTE0).sub("", trim(c), count=1)) for c in parts]
    by_value: dict = {}
    for c in comparators:
        if c.value == "<0.0.0-0":
            return [c]
        by_value[c.value] = c
    if len(by_value) > 1 and "" in by_value:
        del by_value[""]
    return list(by_value.values())


class Range:
    def __init__(self, rng: str):
        raw = js(r"\s+", "g").sub(" ", trim(rng))
        sets = [s for s in (_parse_range(trim(r)) for r in raw.split("||")) if s]
        if not sets:
            raise Invalid(f"Invalid SemVer Range: {raw}")
        if len(sets) > 1:
            first = sets[0]
            sets = [s for s in sets if s[0].value != "<0.0.0-0"] or [first]
            if len(sets) > 1:
                sets = next(([s] for s in sets if len(s) == 1 and s[0].value == ""), sets)
        self.sets = sets

    def test(self, version: str) -> bool:
        try:
            v = Version(version)
        except Invalid:
            return False
        return any(_test_set(s, v) for s in self.sets)


def _test_set(comparators: list, version: Version) -> bool:
    if not all(c.test(version) for c in comparators):
        return False
    if version.prerelease:
        for c in comparators:
            if c.semver is ANY or not c.semver.prerelease:
                continue
            s = c.semver
            if (s.major, s.minor, s.patch) == (version.major, version.minor, version.patch):
                return True
        return False
    return True


def valid_range(rng) -> bool:
    """`semver.validRange(range)` is truthy."""
    try:
        Range(rng)
        return True
    except Exception:
        return False


def max_satisfying(versions: list, rng: str):
    """`semver.maxSatisfying(versions, range)`."""
    try:
        r = Range(rng)
    except Exception:
        return None
    best, best_v = None, None
    for v in versions:
        if r.test(v):
            if best is None or best_v.compare(Version(v)) == -1:
                best, best_v = v, Version(v)
    return best
