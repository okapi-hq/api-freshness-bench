import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import semver from 'semver';
import type { Finding } from '../types.ts';
import type { Block } from './extract.ts';

/**
 * Every package an answer installs must exist, and on npm the version its range
 * resolves to must not be deprecated by its author. A package name that is on
 * neither registry is a hallucinated dependency: the install fails (and anyone
 * can register the name). Registry answers are cached with the day they were
 * read, so a grading run is repeatable.
 */

export type Registry = 'npm' | 'pypi';

export interface PackageInfo {
  exists: boolean;
  /** npm: version → its deprecation message. */
  deprecated?: Record<string, string>;
  versions?: string[];
  latest?: string;
  readAt: string;
}

export type Cache = Record<string, PackageInfo>;

export interface Wanted {
  registry: Registry;
  name: string;
  range: string;
  runtime: boolean;
}

const NPM_NAME = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i;
const PY_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function fromPackageJson(text: string, out: Wanted[]): void {
  try {
    const json = JSON.parse(text) as Record<string, Record<string, string> | undefined>;
    for (const [key, runtime] of [['dependencies', true], ['devDependencies', false]] as const) {
      for (const [name, range] of Object.entries(json[key] ?? {})) {
        if (NPM_NAME.test(name) && !/^(file|link|workspace|git|https?):/.test(range)) out.push({ registry: 'npm', name, range, runtime });
      }
    }
  } catch {}
}

function fromRequirements(text: string, out: Wanted[]): void {
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line || /^(-|https?:|git\+)/.test(line)) continue;
    const m = line.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]*\])?\s*(.*)$/);
    if (!m || !PY_NAME.test(m[1]) || /\.(txt|py|json|toml|cfg|lock|md|in)$/i.test(m[1])) continue;
    out.push({ registry: 'pypi', name: m[1], range: m[2].split(';')[0].trim(), runtime: true });
  }
}

function fromInstall(text: string, out: Wanted[]): void {
  for (const m of text.matchAll(/(?:^|\n)[ \t]*(?:\$[ \t]*)?(pip3?|uv pip|npm|pnpm|yarn|bun)[ \t]+(?:install|add|i)[ \t]+([^\n&|;#]+)/g)) {
    const registry: Registry = m[1].startsWith('pip') || m[1] === 'uv pip' ? 'pypi' : 'npm';
    const tokens = m[2].trim().split(/\s+/);
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      // `-r requirements.txt`, `-e .`, a file or a path: not a package name.
      if (/^-[rce]$|^--(?:requirement|constraint|editable)$/.test(token)) i++;
      if (!token || token.startsWith('-') || token.startsWith('.') || /\.(txt|whl|gz|zip|toml|json|lock)$/.test(token)) continue;
      if (token.includes('/') && registry === 'pypi') continue;
      const clean = token.replace(/^["']|["']$/g, '').replace(/\[[^\]]*\]/, '');
      const name = registry === 'npm' ? clean.replace(/(?<=.)@[^/]*$/, '') : clean.split(/[=<>~!]/)[0];
      if ((registry === 'npm' ? NPM_NAME : PY_NAME).test(name)) out.push({ registry, name, range: '', runtime: true });
    }
  }
}

/** A package an MCP config or a shell line runs with npx (`"command": "npx", "args": ["-y", "pkg"]`). */
function fromNpx(text: string, out: Wanted[]): void {
  const lists = [...text.matchAll(/"command"\s*:\s*"npx"[\s\S]{0,240}?"args"\s*:\s*\[([^\]]*)\]/g)].map((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
  for (const m of text.matchAll(/(?:^|\n)[ \t]*(?:\$[ \t]*)?npx[ \t]+((?:-[\w-]+[ \t]+)*)(@?[\w./-]+(?:@[\w.^~-]+)?)/g)) lists.push([m[2]]);
  for (const args of lists) {
    const pkg = args.find((a) => !a.startsWith('-') && !/^https?:/.test(a));
    if (!pkg) continue;
    const name = pkg.replace(/(?<=.)@[^/]*$/, '');
    if (NPM_NAME.test(name)) out.push({ registry: 'npm', name, range: '', runtime: true });
  }
}

/** The packages an answer's manifests and install commands ask for. */
export function wantedPackages(blocks: Block[]): Wanted[] {
  const out: Wanted[] = [];
  for (const b of blocks) {
    const file = b.file?.toLowerCase() ?? '';
    if (b.manifest && (file.endsWith('package.json') || (b.lang === 'json' && /"dependencies"/.test(b.text)))) fromPackageJson(b.text, out);
    else if (b.manifest && (/requirements/.test(file) || (!file && !/[{=]\s*["{]/.test(b.text) && !/^\s*\[/m.test(b.text)))) fromRequirements(b.text, out);
    fromInstall(b.text, out);
    fromNpx(b.text, out);
  }
  const seen = new Set<string>();
  return out.filter((w) => {
    const k = `${w.registry}:${w.name.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const key = (w: { registry: Registry; name: string }) => `${w.registry}:${w.name.toLowerCase()}`;

async function fetchInfo(w: Wanted, today: string): Promise<PackageInfo> {
  if (w.registry === 'npm') {
    const res = await fetch(`https://registry.npmjs.org/${w.name.replace('/', '%2F')}`, {
      headers: { accept: 'application/vnd.npm.install-v1+json' },
    });
    if (res.status === 404) return { exists: false, readAt: today };
    const doc = (await res.json()) as { versions?: Record<string, { deprecated?: string }>; 'dist-tags'?: { latest?: string } };
    const versions = Object.keys(doc.versions ?? {});
    const deprecated: Record<string, string> = {};
    for (const [v, meta] of Object.entries(doc.versions ?? {})) if (meta.deprecated) deprecated[v] = meta.deprecated;
    return { exists: true, versions, deprecated, latest: doc['dist-tags']?.latest, readAt: today };
  }
  const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(w.name)}/json`);
  if (res.status === 404) return { exists: false, readAt: today };
  const doc = (await res.json()) as { info?: { version?: string } };
  return { exists: true, latest: doc.info?.version, readAt: today };
}

/** Reads every package not yet cached from its registry, a few at a time. */
export async function fillCache(path: string, wanted: Wanted[], today: string): Promise<Cache> {
  const cache: Cache = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  const todo = wanted.filter((w, i) => !cache[key(w)] && wanted.findIndex((x) => key(x) === key(w)) === i);
  for (let i = 0; i < todo.length; i += 8) {
    await Promise.all(
      todo.slice(i, i + 8).map(async (w) => {
        try {
          cache[key(w)] = await fetchInfo(w, today);
        } catch {}
      }),
    );
  }
  writeFileSync(path, JSON.stringify(cache));
  return cache;
}

const NPM = 'https://www.npmjs.com/package/';
const PYPI = 'https://pypi.org/project/';

/** One finding per hallucinated package, and per npm runtime dependency whose resolved version is deprecated. */
export function dependencyFindings(blocks: Block[], cache: Cache): Finding[] {
  const out: Finding[] = [];
  for (const w of wantedPackages(blocks)) {
    const info = cache[key(w)];
    if (!info) continue;
    const source = `${w.registry === 'npm' ? NPM : PYPI}${w.name}`;
    if (!info.exists) {
      out.push({ slot: 'deps', rule: 'nonexistent', label: `${w.name} (not on ${w.registry})`, verdict: 'broken', excerpt: `${w.name} ${w.range}`.trim(),
        fact: { outcome: 'invalid', source, origin: 'registry', note: `No package named ${w.name} on ${w.registry} (${info.readAt}): the install fails.` } });
      continue;
    }
    if (w.registry !== 'npm' || !w.runtime || !info.versions?.length) continue;
    const range = w.range && semver.validRange(w.range) ? w.range : info.latest ?? '*';
    const resolved = semver.maxSatisfying(info.versions, range) ?? info.latest;
    // Only a package its author retired as a whole (its latest release deprecated too), not one old
    // release flagged for a bug or a vulnerability: that is dependency hygiene, not an API going away.
    const message = resolved && info.latest && info.deprecated?.[info.latest] ? info.deprecated?.[resolved] : undefined;
    if (message) {
      out.push({ slot: 'deps', rule: 'npm-deprecated', label: `${w.name}@${resolved} (deprecated on npm)`, verdict: 'deprecated', excerpt: `${w.name} ${w.range}`.trim(),
        fact: { outcome: 'keeps_working', source, origin: 'registry', quote: message.slice(0, 240) } });
    }
  }
  return out;
}
