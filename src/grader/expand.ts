/**
 * Light constant propagation: code often builds a URL from a base constant
 * (`API = "https://api.spotify.com/v1"`, then `${API}/recommendations`). The
 * grader matches the code and, beside it, a copy where each constant holding a
 * URL, a path, a version or an id is written in place of its name, with string
 * concatenations joined, so the endpoint it calls reads whole.
 */

const ASSIGN =
  /(?:\b(?:const|let|var|final|static|val|pub)\s+)?\$?\b([A-Za-z_][A-Za-z0-9_]*)\b[ \t]*(?::[ \t]*[&\w<>[\]' ]+?[ \t]*)?(?::=|=)[ \t]*(?:(?:os\.environ\.get|os\.getenv|getenv|env)\(\s*["'][^"']+["']\s*,\s*|process\.env\.\w+\s*(?:\|\||\?\?)\s*|Deno\.env\.get\(["'][^"']+["']\)\s*(?:\|\||\?\?)\s*)?(?:r|f|b)?["'`]([^"'`\n]{2,200})["'`]/g;

const DEFINE = /define\(\s*["']([A-Za-z_]\w*)["']\s*,\s*["']([^"'\n]{2,200})["']\s*\)/g;

/** Values worth inlining: URLs, paths, version strings, ids. Not prose. */
function worth(value: string): boolean {
  if (/\s/.test(value)) return false;
  return /^(https?:|wss?:|\/|v?\d)/.test(value) || /^[\w.-]+\.[a-z]{2,}(\/|$)/.test(value) || /^[\w.:/-]{2,80}$/.test(value);
}

export function constantsOf(code: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const re of [ASSIGN, DEFINE]) {
    re.lastIndex = 0;
    for (const m of code.matchAll(re)) {
      const [, name, value] = m;
      if (name.length < 2 || !worth(value) || out.has(name)) continue;
      out.set(name, value);
    }
  }
  return out;
}

function escape(name: string): string {
  return name.replace(/[$]/g, '\\$');
}

/** The code with every worthwhile constant written in place of its uses. */
export function expandConstants(code: string): string {
  const constants = constantsOf(code);
  if (!constants.size) return '';
  let out = code;
  for (const [name, value] of constants) {
    // A class constant read through its instance or class (`self.BASE_URL`, `this.baseUrl`, `static::API`).
    const n = `(?:(?:self|this|cls|Self|static)(?:\\.|::))?\\$?${escape(name)}`;
    // Inside a template or an f-string the value goes in bare; a bare use gets quotes, so joins below close up.
    out = out.replace(new RegExp(`\\$\\{\\s*${n}\\s*\\}|(?<![\\w$])\\{\\s*${n}\\s*\\}`, 'g'), value);
    out = out.replace(new RegExp(`(?<![\\w$."'\`/{])\\$?${n}(?![\\w(])`, 'g'), `"${value}"`);
  }
  return out.replace(/["'`]\s*\+\s*["'`]/g, '').replace(/["'`]\s*\.\s*["'`]/g, '');
}
