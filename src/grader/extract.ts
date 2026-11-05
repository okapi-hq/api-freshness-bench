/**
 * Reads a model's answer the way a developer copies it: the fenced code
 * blocks, each with its language and file name when the answer gives one,
 * comments removed so that a model named only in a comment is not a call.
 */

export interface Block {
  lang: string;
  file: string | null;
  text: string;
  manifest: boolean;
}

const FENCE = /^(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)^\1[ \t]*$/gm;
const FILE_NAME =
  /([\w./-]+\.(?:json|jsx|js|mjs|cjs|tsx|ts|py|go|rs|php|kts|kt|java|rb|dart|swift|cs|toml|txt|mod|yaml|yml|gradle|html|env|example|sh|lock)(?![\w])|Dockerfile|Gemfile|Pipfile|\.env(?:\.\w+)?)/;
const MANIFEST_FILE =
  /(^|\/)(requirements[\w.-]*\.txt|pyproject\.toml|package\.json|go\.mod|composer\.json|Cargo\.toml|build\.gradle(\.kts)?|pubspec\.yaml|Gemfile|Pipfile|setup\.py|deno\.json)$/i;

/** The languages a manifest's block may be tagged with, by extension. */
const MANIFEST_LANGS: Record<string, string[]> = {
  txt: ['txt', 'text', 'plaintext', 'requirements', 'pip'],
  json: ['json', 'jsonc', 'json5'],
  toml: ['toml'],
  mod: ['go', 'mod', 'gomod', 'text', 'txt'],
  kts: ['kotlin', 'kts', 'gradle'],
  gradle: ['gradle', 'groovy'],
  yaml: ['yaml', 'yml'],
  py: ['python', 'py'],
};

/** A manifest named above a block in another language is prose about the manifest, not the block's name. */
function fits(file: string, lang: string): boolean {
  if (!lang || !MANIFEST_FILE.test(file)) return true;
  const langs = MANIFEST_LANGS[file.split('.').pop()!.toLowerCase()];
  return !langs || langs.includes(lang);
}

/** A line that runs a command names files as arguments: `pip install -r requirements.txt`. */
const COMMAND_LINE = /(?:^|[\s`$])(?:pip3?|npm|pnpm|yarn|npx|python3?|node|go|cargo|composer|gradle|cd)\s+[\w-]/;

/** The file name an answer gives a block: in its info string, or the line just above it. */
function fileFor(info: string, before: string, lang: string): string | null {
  const inInfo = info.match(FILE_NAME);
  if (inInfo && /[./]/.test(inInfo[1])) return inInfo[1];
  const lines = before.split('\n').filter((l) => l.trim()).slice(-2);
  for (const line of lines.reverse()) {
    if (line.length > 140 || COMMAND_LINE.test(line)) continue;
    const m = line.match(FILE_NAME);
    if (m && fits(m[1], lang)) return m[1];
  }
  return null;
}

function looksLikeManifest(lang: string, file: string | null, text: string): boolean {
  if (file && MANIFEST_FILE.test(file)) return true;
  if (lang === 'json' && /"(dev)?[dD]ependencies"\s*:/.test(text)) return true;
  if (file && /(^|\/)\.env/.test(file)) return false;
  if (/^(text|txt|requirements|pip)?$/.test(lang) && text.trim()) {
    const lines = text.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
    if (lines.some((l) => /\.(txt|py|json|toml|cfg|lock|md)$/i.test(l.trim()))) return false;
    // `pkg`, `pkg==1.2`, `pkg>=1,<2`, `pkg[extra]~=1.0`; never `NAME=value` (an env file).
    return lines.length > 0 && lines.every((l) => /^[A-Za-z0-9][A-Za-z0-9_.\-]*(\[[^\]]*\])?\s*((==|>=|<=|~=|!=|>|<)\s*[\w.*+!-]+\s*(,\s*(==|>=|<=|~=|!=|>|<)\s*[\w.*+!-]+\s*)*)?(;.*)?$/.test(l.trim()));
  }
  return false;
}

export function extractBlocks(answer: string): Block[] {
  const blocks: Block[] = [];
  let last = 0;
  for (const m of answer.matchAll(FENCE)) {
    const info = m[2].trim();
    const lang = (info.split(/[\s{:]/)[0] || '').toLowerCase();
    const file = fileFor(info, answer.slice(last, m.index), lang);
    blocks.push({ lang, file, text: m[3], manifest: looksLikeManifest(lang, file, m[3]) });
    last = (m.index ?? 0) + m[0].length;
  }
  if (!blocks.length && answer.trim()) {
    blocks.push({ lang: '', file: null, text: answer, manifest: false });
  }
  return blocks;
}

const HASH_LANGS = /^(py|python|python3|sh|bash|shell|zsh|toml|yaml|yml|ruby|rb|r|dotenv|env|ini|conf|text|txt|requirements|dockerfile|makefile)$/;
const SLASH_LANGS = /^(js|javascript|jsx|ts|typescript|tsx|mjs|cjs|go|golang|rust|rs|java|kotlin|kt|kts|swift|c|cpp|cs|csharp|dart|php|scala|groovy|gradle|json5|jsonc)$/;

/** Removes `//` line comments outside strings, keeping `://` in URLs. */
function stripSlashLine(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '/' && line[i + 1] === '/' && line[i - 1] !== ':') return line.slice(0, i);
  }
  return line;
}

/** Removes `#` comments outside strings (a whole-line comment or a trailing one). */
function stripHashLine(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

/**
 * Removes docstrings: triple-quoted strings that open a statement. Strings are paired in order,
 * so the closing quotes of a prompt (`PROMPT = """…` then `"""` alone on a line) never open one.
 */
function stripPythonDocstrings(text: string): string {
  return text.replace(/("""|''')[\s\S]*?\1/g, (match: string, _quote: string, offset: number) => {
    const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
    return /^\s*$/.test(text.slice(lineStart, offset)) ? '' : match;
  });
}

export function stripComments(lang: string, text: string): string {
  if (HASH_LANGS.test(lang)) {
    const body = /^py/.test(lang) ? stripPythonDocstrings(text) : text;
    return body.split('\n').map(stripHashLine).join('\n');
  }
  if (SLASH_LANGS.test(lang)) {
    const noBlocks = text.replace(/\/\*[\s\S]*?\*\//g, '');
    const lines = noBlocks.split('\n').map(stripSlashLine);
    return lang === 'php' ? lines.map(stripHashLine).join('\n') : lines.join('\n');
  }
  if (/^(html|xml|vue|svelte)$/.test(lang)) return text.replace(/<!--[\s\S]*?-->/g, '');
  return text;
}

/** Shell blocks are how to run the code, not the code: they only tell what gets installed. */
const COMMAND_LANGS = /^(sh|bash|shell|zsh|console|terminal|powershell|ps1|cmd|bat)$/;

/** The answer's code with comments removed, and its dependency manifests apart. */
export function readAnswer(answer: string): { code: string; manifest: string; blocks: Block[] } {
  const blocks = extractBlocks(answer);
  const code: string[] = [];
  const manifest: string[] = [];
  for (const b of blocks) {
    if (b.manifest) manifest.push(b.text);
    else if (!COMMAND_LANGS.test(b.lang)) code.push(stripComments(b.lang || langOf(b.file), b.text));
  }
  return { code: code.join('\n\n'), manifest: manifest.join('\n\n'), blocks };
}

function langOf(file: string | null): string {
  const ext = file?.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = { py: 'python', ts: 'ts', js: 'js', go: 'go', rs: 'rust', php: 'php', kt: 'kotlin' };
  return map[ext] ?? ext;
}
