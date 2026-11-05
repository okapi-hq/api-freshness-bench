/**
 * The highest major each package the answer depends on can install: what
 * `pip install -r requirements.txt` or `npm install` would pick today. A
 * package the code imports with no manifest entry installs its latest release.
 */

export type Majors = Map<string, number>;

const NONE = Number.POSITIVE_INFINITY;

function normalise(name: string): string {
  return name.toLowerCase().replace(/[_.]+/g, '-');
}

/** The highest major a version range allows (`^4.2` → 4, `>=1,<2` → 1, `*` → ∞). */
export function maxMajor(spec: string): number {
  const s = spec.trim().replace(/^v/, '');
  if (!s || s === '*' || s === 'latest' || s === 'x') return NONE;
  const lt = s.match(/<\s*=?\s*v?(\d+)(?:\.(\d+))?/);
  if (lt) {
    const major = Number(lt[1]);
    const inclusive = /<=/.test(s);
    const minorZero = !lt[2] || Number(lt[2]) === 0;
    return inclusive || !minorZero ? major : major - 1;
  }
  if (/^(>=|>)/.test(s) && !/,/.test(s)) return NONE;
  const pinned = s.match(/^(?:\^|~|~=|==|=)?\s*v?(\d+)/);
  if (pinned) return Number(pinned[1]);
  return NONE;
}

function addSpec(out: Majors, name: string, spec: string): void {
  const key = normalise(name);
  const major = maxMajor(spec);
  const prev = out.get(key);
  out.set(key, prev === undefined ? major : Math.max(prev, major));
}

function fromRequirements(text: string, out: Majors): void {
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([A-Za-z0-9][A-Za-z0-9_.-]*)(\[[^\]]*\])?\s*((?:[=<>~!]=?|===)\s*[^;\s]+(?:\s*,\s*[=<>~!]=?\s*[^;\s,]+)*)?/);
    if (m && !/^(-|https?:)/.test(line)) addSpec(out, m[1], m[3] ?? '');
  }
}

function fromPackageJson(text: string, out: Majors): void {
  try {
    const json = JSON.parse(text) as Record<string, Record<string, string> | undefined>;
    for (const key of ['dependencies', 'devDependencies', 'peerDependencies', 'require', 'require-dev']) {
      for (const [name, spec] of Object.entries(json[key] ?? {})) addSpec(out, name, spec);
    }
  } catch {
    for (const m of text.matchAll(/"(@?[\w./-]+)"\s*:\s*"([^"]+)"/g)) addSpec(out, m[1], m[2]);
  }
}

function fromTomlAndOthers(text: string, out: Majors): void {
  // pyproject (PEP 621 strings and Poetry tables), Cargo, go.mod, composer, gradle, pubspec.
  for (const m of text.matchAll(/["']([A-Za-z0-9][\w.-]*)(\[[^\]]*\])?\s*([=<>~!^]=?[^"']*)?["']/g)) {
    if (m[3]) addSpec(out, m[1], m[3]);
  }
  for (const m of text.matchAll(/^\s*([A-Za-z0-9][\w.-]*)\s*=\s*\{?\s*(?:version\s*=\s*)?["']([^"']+)["']/gm)) {
    addSpec(out, m[1], m[2]);
  }
  for (const m of text.matchAll(/^\s*(?:require\s+)?([\w.-]+\.[a-z]{2,}\/[\w./-]+)\s+v(\d+)\S*/gm)) {
    const path = m[1].replace(/\/v\d+$/, '');
    addSpec(out, path, m[2]);
  }
  for (const m of text.matchAll(/["']([\w.-]+):([\w.-]+):([\w.+-]+)["']/g)) addSpec(out, `${m[1]}:${m[2]}`, m[3]);
  for (const m of text.matchAll(/^\s{2,}([a-z][\w]*):\s*\^?([\d.]+)/gm)) addSpec(out, m[1], m[2]);
}

/** `pip install x==1`, `npm i x@4`, `go get x@v1`… anywhere in the answer's blocks. */
function fromInstallCommands(text: string, out: Majors): void {
  const cmd = /(?:pip3?|uv pip|poetry|npm|pnpm|yarn|bun|go|composer|cargo)[ \t]+(?:install|add|get|require|i)[ \t]+([^\n&|;]+)/g;
  for (const m of text.matchAll(cmd)) {
    for (const token of m[1].split(/\s+/)) {
      if (!token || token.startsWith('-')) continue;
      const clean = token.replace(/^["']|["']$/g, '');
      const at = clean.match(/^(@?[^@=<>~!]+)(?:@|==|>=|~=|<|<=|=)?(.*)$/);
      if (!at) continue;
      const op = clean.slice(at[1].length).match(/^[@=<>~!]+/)?.[0] ?? '';
      const spec = op === '@' ? at[2] : `${op.replace('@', '')}${at[2]}`;
      addSpec(out, at[1], spec);
    }
  }
}

export interface ManifestBlock {
  file: string | null;
  text: string;
  manifest: boolean;
}

function fromManifest(block: ManifestBlock, out: Majors): void {
  const t = block.text.trim();
  const file = block.file?.toLowerCase() ?? '';
  if (file.endsWith('package.json') || file.endsWith('composer.json') || t.startsWith('{')) {
    fromPackageJson(t, out);
  } else if (/requirements|pipfile/.test(file) || !/[[{]|^\s*module\s|:\s/m.test(t)) {
    fromRequirements(t, out);
  } else {
    fromTomlAndOthers(t, out);
  }
}

/** Every package the answer's manifests and install commands name, with its highest major. */
export function readMajors(blocks: ManifestBlock[]): Majors {
  const out: Majors = new Map();
  for (const block of blocks) {
    if (block.manifest) fromManifest(block, out);
    fromInstallCommands(block.text, out);
  }
  return out;
}

/** The highest major of `pkg` the answer can install (∞ when it does not say). */
export function majorOf(majors: Majors, pkg: string): number {
  return majors.get(normalise(pkg)) ?? NONE;
}
