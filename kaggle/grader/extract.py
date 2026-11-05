"""Reads a model's answer the way a developer copies it (port of `src/grader/extract.ts`).

The fenced code blocks, each with its language and file name when the answer
gives one, comments removed so that a model named only in a comment is not a call.
"""

from .jsregex import js, trim


class Block:
    """A fenced code block: its language, the file name the answer gives it, its text."""

    __slots__ = ("lang", "file", "text", "manifest")

    def __init__(self, lang: str, file: "str | None", text: str, manifest: bool):
        self.lang, self.file, self.text, self.manifest = lang, file, text, manifest


FENCE = js(r"^(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)^\1[ \t]*$", "gm")
FILE_NAME = js(
    r"([\w./-]+\.(?:json|jsx|js|mjs|cjs|tsx|ts|py|go|rs|php|kts|kt|java|rb|dart|swift|cs|toml|txt|mod|yaml|yml|gradle|html|env|example|sh|lock)(?![\w])|Dockerfile|Gemfile|Pipfile|\.env(?:\.\w+)?)"
)
MANIFEST_FILE = js(
    r"(^|\/)(requirements[\w.-]*\.txt|pyproject\.toml|package\.json|go\.mod|composer\.json|Cargo\.toml|build\.gradle(\.kts)?|pubspec\.yaml|Gemfile|Pipfile|setup\.py|deno\.json)$",
    "i",
)

# The languages a manifest's block may be tagged with, by extension.
MANIFEST_LANGS = {
    "txt": ["txt", "text", "plaintext", "requirements", "pip"],
    "json": ["json", "jsonc", "json5"],
    "toml": ["toml"],
    "mod": ["go", "mod", "gomod", "text", "txt"],
    "kts": ["kotlin", "kts", "gradle"],
    "gradle": ["gradle", "groovy"],
    "yaml": ["yaml", "yml"],
    "py": ["python", "py"],
}

# A line that runs a command names files as arguments: `pip install -r requirements.txt`.
COMMAND_LINE = js(r"(?:^|[\s`$])(?:pip3?|npm|pnpm|yarn|npx|python3?|node|go|cargo|composer|gradle|cd)\s+[\w-]")
MANIFEST_LINE = js(
    r"^[A-Za-z0-9][A-Za-z0-9_.\-]*(\[[^\]]*\])?\s*((==|>=|<=|~=|!=|>|<)\s*[\w.*+!-]+\s*(,\s*(==|>=|<=|~=|!=|>|<)\s*[\w.*+!-]+\s*)*)?(;.*)?$"
)


def js_len(s: str) -> int:
    """A string's length in UTF-16 code units, as JavaScript counts it."""
    return len(s.encode("utf-16-le")) // 2


def fits(file: str, lang: str) -> bool:
    """A manifest named above a block in another language is prose about the manifest, not the block's name."""
    if not lang or not MANIFEST_FILE.search(file):
        return True
    langs = MANIFEST_LANGS.get(file.split(".")[-1].lower())
    return not langs or lang in langs


def file_for(info: str, before: str, lang: str) -> "str | None":
    """The file name an answer gives a block: in its info string, or the line just above it."""
    in_info = FILE_NAME.search(info)
    if in_info and js(r"[./]").search(in_info.group(1)):
        return in_info.group(1)
    lines = [l for l in before.split("\n") if trim(l)][-2:]
    for line in reversed(lines):
        if js_len(line) > 140 or COMMAND_LINE.search(line):
            continue
        m = FILE_NAME.search(line)
        if m and fits(m.group(1), lang):
            return m.group(1)
    return None


def looks_like_manifest(lang: str, file: "str | None", text: str) -> bool:
    if file and MANIFEST_FILE.search(file):
        return True
    if lang == "json" and js(r'"(dev)?[dD]ependencies"\s*:').search(text):
        return True
    if file and js(r"(^|\/)\.env").search(file):
        return False
    if js(r"^(text|txt|requirements|pip)?$").search(lang) and trim(text):
        lines = [l for l in text.split("\n") if trim(l) and not trim(l).startswith("#")]
        if any(js(r"\.(txt|py|json|toml|cfg|lock|md)$", "i").search(trim(l)) for l in lines):
            return False
        # `pkg`, `pkg==1.2`, `pkg>=1,<2`, `pkg[extra]~=1.0`; never `NAME=value` (an env file).
        return len(lines) > 0 and all(MANIFEST_LINE.search(trim(l)) for l in lines)
    return False


def extract_blocks(answer: str) -> "list[Block]":
    blocks: list[Block] = []
    last = 0
    for m in FENCE.finditer(answer):
        info = trim(m.group(2))
        lang = (js(r"[\s{:]").split(info)[0] or "").lower()
        file = file_for(info, answer[last : m.start()], lang)
        blocks.append(Block(lang, file, m.group(3), looks_like_manifest(lang, file, m.group(3))))
        last = m.end()
    if not blocks and trim(answer):
        blocks.append(Block("", None, answer, False))
    return blocks


HASH_LANGS = set("py python python3 sh bash shell zsh toml yaml yml ruby rb r dotenv env ini conf text txt requirements dockerfile makefile".split())
SLASH_LANGS = set(
    "js javascript jsx ts typescript tsx mjs cjs go golang rust rs java kotlin kt kts swift c cpp cs csharp dart php scala groovy gradle json5 jsonc".split()
)
BLANK = js(r"\s")


def strip_slash_line(line: str) -> str:
    """Removes `//` line comments outside strings, keeping `://` in URLs."""
    quote, i = None, 0
    while i < len(line):
        c = line[i]
        if quote:
            if c == "\\":
                i += 1
            elif c == quote:
                quote = None
        elif c in "\"'`":
            quote = c
        elif c == "/" and line[i + 1 : i + 2] == "/" and (i == 0 or line[i - 1] != ":"):
            return line[:i]
        i += 1
    return line


def strip_hash_line(line: str) -> str:
    """Removes `#` comments outside strings (a whole-line comment or a trailing one)."""
    quote, i = None, 0
    while i < len(line):
        c = line[i]
        if quote:
            if c == "\\":
                i += 1
            elif c == quote:
                quote = None
        elif c in "\"'":
            quote = c
        elif c == "#" and (i == 0 or BLANK.match(line[i - 1])):
            return line[:i]
        i += 1
    return line


def strip_python_docstrings(text: str) -> str:
    """Removes triple-quoted strings that open a statement; strings pair in order."""

    def keep(m) -> str:
        line_start = text.rfind("\n", 0, m.start()) + 1
        return "" if not trim(text[line_start : m.start()]) else m.group(0)

    return js(r"(\"\"\"|''')[\s\S]*?\1", "g").sub(keep, text)


def strip_comments(lang: str, text: str) -> str:
    if lang in HASH_LANGS:
        body = strip_python_docstrings(text) if lang.startswith("py") else text
        return "\n".join(strip_hash_line(l) for l in body.split("\n"))
    if lang in SLASH_LANGS:
        no_blocks = js(r"\/\*[\s\S]*?\*\/", "g").sub("", text)
        lines = [strip_slash_line(l) for l in no_blocks.split("\n")]
        return "\n".join(strip_hash_line(l) for l in lines) if lang == "php" else "\n".join(lines)
    if lang in ("html", "xml", "vue", "svelte"):
        return js(r"<!--[\s\S]*?-->", "g").sub("", text)
    return text


# Shell blocks are how to run the code, not the code: they only tell what gets installed.
COMMAND_LANGS = set("sh bash shell zsh console terminal powershell ps1 cmd bat".split())
LANG_OF = {"py": "python", "ts": "ts", "js": "js", "go": "go", "rs": "rust", "php": "php", "kt": "kotlin"}


def lang_of(file: "str | None") -> str:
    ext = file.split(".")[-1].lower() if file is not None else ""
    return LANG_OF.get(ext, ext)


def read_answer(answer: str) -> "tuple[str, str, list[Block]]":
    """The answer's code with comments removed, its dependency manifests apart, and its blocks."""
    blocks = extract_blocks(answer)
    code: list[str] = []
    manifest: list[str] = []
    for b in blocks:
        if b.manifest:
            manifest.append(b.text)
        elif b.lang not in COMMAND_LANGS:
            code.append(strip_comments(b.lang or lang_of(b.file), b.text))
    return "\n\n".join(code), "\n\n".join(manifest), blocks
