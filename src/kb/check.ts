import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { TASKS } from '../tasks/index.ts';
import type { Fact } from '../types.ts';

/**
 * Fetches every source the knowledge base cites and checks its quote is on the
 * page, as Okapi's archive does (`quoteFound`): the facts stand on their own
 * sources, not on memory. Writes `src/kb/data/kb-check.json`.
 *
 *   node src/kb/check.ts
 */

const ROOT = join(dirname(new URL(import.meta.url).pathname), '..', '..');

function facts(): Fact[] {
  const out: Fact[] = [];
  for (const t of TASKS) {
    for (const s of t.slots) {
      for (const r of s.rules) {
        out.push(r.fact);
        if (r.sdk) out.push(r.sdk.pinned);
      }
    }
  }
  return out;
}

export function normalise(text: string): string {
  return text
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[`*]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .toLowerCase()
    .trim();
}

/** Some sites answer Node's fetch with a bot page: curl gets the page a browser gets. */
function curl(url: string): string | null {
  try {
    return execFileSync('curl', ['-sL', '--max-time', '25', '-A', UA, url], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;
  }
}

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

async function page(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
        accept: 'text/html,text/markdown;q=0.9,*/*;q=0.5',
        'accept-language': 'en',
      },
      signal: AbortSignal.timeout(25_000),
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

async function check(source: string, quote: string): Promise<'found' | 'missing' | 'unreachable'> {
  const target = normalise(quote).replace(/\s*…\s*/g, '…');
  const pieces = target.split('…').map((p) => p.trim()).filter((p) => p.length > 8);
  const variants = [source, source.replace(/#.*$/, '') + (source.includes('.md') ? '' : '.md')];
  let reached = false;
  for (const url of variants) {
    for (const body of [await page(url), curl(url)]) {
      if (!body) continue;
      reached = true;
      const text = normalise(body);
      if (pieces.every((p) => text.includes(p))) return 'found';
    }
  }
  return reached ? 'missing' : 'unreachable';
}

async function main(): Promise<void> {
  const seen = new Map<string, { source: string; quote: string }>();
  for (const f of facts()) if (f.quote) seen.set(`${f.source}\n${f.quote}`, { source: f.source, quote: f.quote });
  const results: { source: string; quote: string; result: string }[] = [];
  const items = [...seen.values()];
  for (let i = 0; i < items.length; i += 6) {
    const batch = await Promise.all(items.slice(i, i + 6).map(async (it) => ({ ...it, result: await check(it.source, it.quote) })));
    results.push(...batch);
  }
  for (const r of results) console.log(`${r.result.padEnd(11)} ${r.source}\n            “${r.quote.slice(0, 110)}”`);
  const count = (v: string) => results.filter((r) => r.result === v).length;
  console.log(`\n${results.length} quotes: ${count('found')} found, ${count('missing')} missing, ${count('unreachable')} unreachable`);
  writeFileSync(join(ROOT, 'src', 'kb', 'data', 'kb-check.json'), JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 1));
}

void main();
