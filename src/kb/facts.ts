import type { Fact, Rule } from '../types.ts';

/** Builders for the facts the tasks cite: each keeps its source and, when known, its dates. */

type Origin = Fact['origin'];

interface Extra {
  /** For a value that never worked or was removed: when its end was announced or shipped. */
  announced?: string;
  quote?: string;
  note?: string;
  origin?: Origin;
  released?: string;
}

export function current(source: string, extra: Extra = {}): Fact {
  return { outcome: 'ok', source, origin: extra.origin ?? 'provider', ...extra };
}

export function fails(effective: string, announced: string | undefined, source: string, extra: Extra = {}): Fact {
  return { outcome: 'fails', effective, announced, source, origin: extra.origin ?? 'okapi', ...extra };
}

export function deprecated(announced: string | undefined, source: string, extra: Extra = {}): Fact {
  return { outcome: 'keeps_working', announced, source, origin: extra.origin ?? 'okapi', ...extra };
}

export function redirected(effective: string, announced: string | undefined, source: string, extra: Extra = {}): Fact {
  return { outcome: 'redirected', effective, announced, source, origin: extra.origin ?? 'okapi', ...extra };
}

export function invalid(source: string, extra: Extra = {}): Fact {
  return { outcome: 'invalid', source, origin: extra.origin ?? 'provider', ...extra };
}

/** A regular expression matching `s` literally. */
export function lit(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/**
 * A model id as code writes it: inside a string, after `=` or `:` in a config
 * line, or after a slash in a path (`models/gemini-2.0-flash`), and not as the
 * prefix of a longer id (`gpt-4o` is not `gpt-4o-mini`).
 */
export function modelPattern(id: string, exact = false): string {
  // A `:` may end an id in a path (`gemini-2.0-flash:generateContent`), unless ids carry
  // variants after one (OpenRouter's `:free`), where the whole slug must match.
  return `(?<=^|["'\`=:\\s/(,\\[])${lit(id)}(?=["'\`\\s,;)}\\]${exact ? '' : ':'}]|$)`;
}

/** A whole identifier or word, as an API's parameter or method name. */
export function word(name: string): string {
  return `(?<![\\w$])${lit(name)}(?![\\w$])`;
}

export interface ModelRow {
  id: string;
  fact: Fact;
}

/** One rule per model id, matched case-insensitively. */
export function modelRules(rows: ModelRow[], exact = false): Rule[] {
  return rows.map((r) => ({
    id: r.id,
    label: r.id,
    pattern: modelPattern(r.id, exact),
    flags: 'im',
    fact: r.fact,
  }));
}

/** A table row helper: `[id, shutdown, announced]`, `[id]` current, or a full fact. */
export type Row = [string] | [string, string | null, string | null] | [string, Fact];

export function rowsFrom(rows: Row[], source: string, released?: Record<string, string>): ModelRow[] {
  return rows.map((row) => {
    const [id, a, b] = row;
    if (a && typeof a === 'object') return { id, fact: a };
    if (!a) return { id, fact: current(source, { origin: 'okapi', released: released?.[id] }) };
    return { id, fact: fails(a, (b as string | null) ?? undefined, source) };
  });
}
