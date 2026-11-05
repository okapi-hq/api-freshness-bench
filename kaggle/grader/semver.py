"""The part of node-semver 7.8.5 the registry check uses: `validRange` and `maxSatisfying`.

A port, not a reimplementation: the token patterns are node-semver's own
(`internal/re.js`, `src`), and each function follows the JavaScript it is named after.
"""

from .jsregex import js, trim

FULL = "^v?(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:\\d*[a-zA-Z-][a-zA-Z0-9-]*|0|[1-9]\\d*)(?:\\.(?:\\d*[a-zA-Z-][a-zA-Z0-9-]*|0|[1-9]\\d*))*))?(?:\\+([a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)*))?$"
XRANGE = "^((?:<|>)?=?)\\s*[v=\\s]*(0|[1-9]\\d*|x|X|\\*)(?:\\.(0|[1-9]\\d*|x|X|\\*)(?:\\.(0|[1-9]\\d*|x|X|\\*)(?:(?:-((?:\\d*[a-zA-Z-][a-zA-Z0-9-]*|0|[1-9]\\d*)(?:\\.(?:\\d*[a-zA-Z-][a-zA-Z0-9-]*|0|[1-9]\\d*))*)))?(?:\\+([a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)*))?)?)?$"
TILDE = "^(?:~>?)[v=\\s]*(0|[1-9]\\d*|x|X|\\*)(?:\\.(0|[1-9]\\d*|x|X|\\*)(?:\\.(0|[1-9]\\d*|x|X|\\*)(?:(?:-((?:\\d*[a-zA-Z-][a-zA-Z0-9-]*|0|[1-9]\\d*)(?:\\.(?:\\d*[a-zA-Z-][a-zA-Z0-9-]*|0|[1-9]\\d*))*)))?(?:\\+([a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)*))?)?)?$"
CARET = "^(?:\\^)[v=\\s]*(0|[1-9]\\d*|x|X|\\*)(?:\\.(0|[1-9]\\d*|x|X|\\*)(?:\\.(0|[1-9]\\d*|x|X|\\*)(?:(?:-((?:\\d*[a-zA-Z-][a-zA-Z0-9-]*|0|[1-9]\\d*)(?:\\.(?:\\d*[a-zA-Z-][a-zA-Z0-9-]*|0|[1-9]\\d*))*)))?(?:\\+([a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)*))?)?)?$"
COMPARATOR = "^((?:<|>)?=?)\\s*(v?(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:\\d*[a-zA-Z-][a-zA-Z0-9-]*|0|[1-9]\\d*)(?:\\.(?:\\d*[a-zA-Z-][a-zA-Z0-9-]*|0|[1-9]\\d*))*))?(?:\\+([a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)*))?)$|^$"
COMPARATORTRIM = "(\\s*)((?:<|>)?=?)\\s*([v=\\s]*(\\d+)\\.(\\d+)\\.(\\d+)(?:-?((?:\\d*[a-zA-Z-][a-zA-Z0-9-]*|\\d+)(?:\\.(?:\\d*[a-zA-Z-][a-zA-Z0-9-]*|\\d+))*))?(?:\\+([a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)*))?|[v=\\s]*(0|[1-9]\\d*|x|X|\\*)(?:\\.(0|[1-9]\\d*|x|X|\\*)(?:\\.(0|[1-9]\\d*|x|X|\\*)(?:(?:-((?:\\d*[a-zA-Z-][a-zA-Z0-9-]*|0|[1-9]\\d*)(?:\\.(?:\\d*[a-zA-Z-][a-zA-Z0-9-]*|0|[1-9]\\d*))*)))?(?:\\+([a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)*))?)?)?)"
TILDETRIM = "(\\s*)(?:~>?)\\s+"
CARETTRIM = "(\\s*)(?:\\^)\\s+"
HYPHENRANGE = "^\\s*([v=\\s]*(0|[1-9]\\d*|x|X|\\*)(?:\\.(0|[1-9]\\d*|x|X|\\*)(?:\\.(0|[1-9]\\d*|x|X|\\*)(?:(?:-((?:\\d*[a-zA-Z-][a-zA-Z0-9-]*|0|[1-9]\\d*)(?:\\.(?:\\d*[a-zA-Z-][a-zA-Z0-9-]*|0|[1-9]\\d*))*)))?(?:\\+([a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)*))?)?)?)\\s+-\\s+([v=\\s]*(0|[1-9]\\d*|x|X|\\*)(?:\\.(0|[1-9]\\d*|x|X|\\*)(?:\\.(0|[1-9]\\d*|x|X|\\*)(?:(?:-((?:\\d*[a-zA-Z-][a-zA-Z0-9-]*|0|[1-9]\\d*)(?:\\.(?:\\d*[a-zA-Z-][a-zA-Z0-9-]*|0|[1-9]\\d*))*)))?(?:\\+([a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)*))?)?)?)\\s*$"
STAR = "(<|>)?=?\\s*\\*"
GTE0 = "^\\s*>=\\s*0\\.0\\.0\\s*$"
BUILD = "(?:\\+([a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)*))"
MAX_LENGTH = 256
MAX_SAFE_INTEGER = 2**53 - 1
NUMERIC = js(r"^[0-9]+$")
SPACES = js(r"\s+")
ANY = None


class Invalid(ValueError):
    pass


class Version:
    """`SemVer`, strict (not loose)."""

    def __init__(self, version: str):
        if len(version) > MAX_LENGTH:
            raise Invalid("too long")
        m = js(FULL).search(trim(version))
        if not m:
            raise Invalid(f"Invalid Version: {version}")
        self.major, self.minor, self.patch = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if max(self.major, self.minor, self.patch) > MAX_SAFE_INTEGER:
            raise Invalid("Invalid version")
        self.prerelease = [] if not m.group(4) else [_numberify(i) for i in m.group(4).split(".")]
        self.version = f"{self.major}.{self.minor}.{self.patch}"
        if self.prerelease:
            self.version += "-" + ".".join(str(p) for p in self.prerelease)

    def compare(self, other: "Version") -> int:
        if other.version == self.version:
            return 0
        main = _cmp((self.major, self.minor, self.patch), (other.major, other.minor, other.patch))
        return main or self.compare_pre(other)

    def compare_pre(self, other: "Version") -> int:
        a, b = self.prerelease, other.prerelease
        if a and not b:
            return -1
        if not a and b:
            return 1
        if not a and not b:
            return 0
        i = 0
        while True:
            x = a[i] if i < len(a) else None
            y = b[i] if i < len(b) else None
            if x is None and y is None:
                return 0
            if y is None:
                return 1
            if x is None:
                return -1
            if x == y and type(x) is type(y):
                i += 1
                continue
            return compare_identifiers(x, y)


def _numberify(identifier: str):
    if NUMERIC.search(identifier):
        num = int(identifier)
        if 0 <= num < MAX_SAFE_INTEGER:
            return num
    return identifier


def _cmp(a, b) -> int:
    return 0 if a == b else (-1 if a < b else 1)


def compare_identifiers(a, b) -> int:
    if isinstance(a, int) and isinstance(b, int):
        return _cmp(a, b)
    anum, bnum = bool(NUMERIC.search(str(a))), bool(NUMERIC.search(str(b)))
    if anum and bnum:
        a, b = int(a), int(b)
    if a == b:
        return 0
    if anum and not bnum:
        return -1
    if bnum and not anum:
        return 1
    return -1 if str(a) < str(b) else 1


class Comparator:
    def __init__(self, comp: str):
        comp = " ".join(SPACES.split(trim(comp)))
        m = js(COMPARATOR).search(comp)
        if not m:
            raise Invalid(f"Invalid comparator: {comp}")
        self.operator = m.group(1) if m.group(1) is not None else ""
        if self.operator == "=":
            self.operator = ""
        self.semver = Version(m.group(2)) if m.group(2) else ANY
        self.value = "" if self.semver is ANY else self.operator + self.semver.version

    def test(self, version: Version) -> bool:
        if self.semver is ANY:
            return True
        c = version.compare(self.semver)
        return {"": c == 0, ">": c > 0, ">=": c >= 0, "<": c < 0, "<=": c <= 0}[self.operator]

