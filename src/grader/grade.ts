import type { Fact, Finding, Rule, Slot, Task, TaskGrade, Verdict } from '../types.ts';
import { expandConstants } from './expand.ts';
import { readAnswer } from './extract.ts';
import { majorOf, readMajors, type Majors } from './manifest.ts';
import { dependencyFindings, type Cache } from './registry.ts';
import { BENCH_DATE, statusOf, worst } from './status.ts';

interface Hit {
  slot: Slot;
  rule: Rule;
  excerpt: string;
}

const cache = new Map<string, RegExp>();

function regexOf(pattern: string, flags = ''): RegExp {
  const key = `${flags}/${pattern}`;
  let re = cache.get(key);
  if (!re) {
    re = new RegExp(pattern, flags.includes('g') ? flags : `${flags}g`);
    cache.set(key, re);
  }
  re.lastIndex = 0;
  return re;
}

/** The line holding the match, trimmed: what the report shows as evidence. */
function excerptAt(text: string, index: number): string {
  const start = text.lastIndexOf('\n', index) + 1;
  const end = text.indexOf('\n', index);
  return text.slice(start, end === -1 ? undefined : end).trim().slice(0, 200);
}

function findHits(task: Task, code: string, manifest: string): Map<string, Hit> {
  const hits = new Map<string, Hit>();
  for (const slot of task.slots) {
    for (const rule of slot.rules) {
      const text = rule.scope === 'manifest' ? manifest : code;
      const m = regexOf(rule.pattern, rule.flags).exec(text);
      if (m) hits.set(`${slot.id}.${rule.id}`, { slot, rule, excerpt: excerptAt(text, m.index) });
    }
  }
  return hits;
}

function holds(rule: Rule, kept: Set<string>): boolean {
  if (!(rule.requires ?? []).every((k) => kept.has(k))) return false;
  if (rule.requiresAny && !rule.requiresAny.some((k) => kept.has(k))) return false;
  return !(rule.unless ?? []).some((k) => kept.has(k));
}

/**
 * Keeps the hits whose conditions hold against the other kept hits: `requires`
 * all kept, `requiresAny` one kept, `unless` none kept. Conditions refer to
 * each other, so this runs until the kept set no longer changes.
 */
function applyConditions(hits: Map<string, Hit>): Hit[] {
  let kept = new Set(hits.keys());
  for (let i = 0; i < 6; i++) {
    const next = new Set([...hits.entries()].filter(([, h]) => holds(h.rule, kept)).map(([k]) => k));
    if (next.size === kept.size && [...next].every((k) => kept.has(k))) break;
    kept = next;
  }
  return [...hits.entries()].filter(([k]) => kept.has(k)).map(([, h]) => h);
}

/** The fact a hit stands on: an SDK gate swaps it when the manifest keeps the old major. */
function factFor(rule: Rule, majors: Majors): Fact {
  if (!rule.sdk) return rule.fact;
  return majorOf(majors, rule.sdk.pkg) < rule.sdk.breaksFrom ? rule.sdk.pinned : rule.fact;
}

function findingOf(hit: Hit, majors: Majors, today: string): Finding {
  const fact = factFor(hit.rule, majors);
  return {
    slot: hit.slot.id,
    rule: hit.rule.id,
    label: hit.rule.label,
    verdict: statusOf(fact, today),
    fact,
    excerpt: hit.excerpt,
  };
}

/** Values shaped like the slot's that no rule explains: one `unknown` finding each. */
function unknownCandidates(slot: Slot, code: string): Finding[] {
  if (!slot.candidate) return [];
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const m of code.matchAll(regexOf(slot.candidate, slot.candidateFlags))) {
    const value = (m[1] ?? m[0]).replace(/[.-]+$/, '');
    if (seen.has(value)) continue;
    seen.add(value);
    const known = slot.rules.some((r) => r.scope !== 'manifest' && regexOf(r.pattern, r.flags).test(value));
    if (known) continue;
    const excerpt = excerptAt(code, m.index ?? 0);
    if (slot.unknownAs) {
      out.push({ slot: slot.id, rule: 'not-listed', label: value, verdict: statusOf(slot.unknownAs), fact: slot.unknownAs, excerpt });
    } else {
      out.push({ slot: slot.id, rule: null, label: value, verdict: 'unknown', fact: null, excerpt });
    }
  }
  return out;
}

const WARNING = /retired|deprecat|sunset|shut(?:ting)? down|no longer (?:available|supported|work)|discontinu|end[- ]of[- ]life|decommission/i;

/** The answer's prose, code blocks removed: does it warn about what it uses? */
function warns(answer: string): boolean {
  return WARNING.test(answer.replace(/```[\s\S]*?```/g, ''));
}

export function gradeAnswer(task: Task, answer: string, today = BENCH_DATE, registry?: Cache): TaskGrade {
  const read = readAnswer(answer);
  const { manifest, blocks } = read;
  const code = `${read.code}\n\n${expandConstants(read.code)}`;
  const majors = readMajors(blocks);
  const kept = applyConditions(findHits(task, code, manifest));
  const findings = kept.map((h) => findingOf(h, majors, today));
  for (const slot of task.slots) findings.push(...unknownCandidates(slot, code));
  if (registry) findings.push(...dependencyFindings(blocks, registry));
  const filled = new Set(findings.map((f) => f.slot));
  for (const s of task.slots.filter((x) => x.absent === 'broken' && !filled.has(x.id))) {
    findings.push({ slot: s.id, rule: null, label: s.absentNote ?? `no ${s.label}`, verdict: 'broken', fact: null, excerpt: '' });
  }
  const missing = task.slots.filter((s) => s.absent === 'missing' && !filled.has(s.id)).map((s) => s.id);
  const verdicts: (Verdict | 'missing')[] = findings.map((f) => f.verdict);
  if (missing.length) verdicts.push('missing');
  return { task: task.id, verdict: worst(verdicts), findings, missing, warned: warns(answer) };
}
