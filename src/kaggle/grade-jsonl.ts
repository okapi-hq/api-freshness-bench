import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { taskById } from '../tasks/index.ts';
import { extractBlocks } from '../grader/extract.ts';
import { gradeAnswer } from '../grader/grade.ts';
import { fillCache, wantedPackages, type Cache } from '../grader/registry.ts';
import { BENCH_DATE } from '../grader/status.ts';

/**
 * Grades a JSONL of answers (`{"id", "task", "answer"}` per line) with the
 * TypeScript grader, one JSONL line per answer: the reference the Python
 * grader that runs on Kaggle is checked against (`kaggle/equivalence.py`).
 * With `--registry`, the packages the answers install are read from npm and
 * PyPI into that cache first (entries already there are kept), as on Kaggle.
 *
 *   node src/kaggle/grade-jsonl.ts --in answers.jsonl --out graded.jsonl [--registry cache.json] [--offline]
 */

const { values } = parseArgs({
  options: { in: { type: 'string' }, out: { type: 'string' }, registry: { type: 'string' }, offline: { type: 'boolean', default: false } },
});
if (!values.in || !values.out) throw new Error('--in and --out are required');

const rows = readFileSync(values.in, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line) as { id: string; task: string; answer: string });
const wanted = values.offline ? [] : rows.flatMap((r) => wantedPackages(extractBlocks(r.answer)));
const registry: Cache | undefined = values.registry ? await fillCache(values.registry, wanted, new Date().toISOString().slice(0, 10)) : undefined;

const out = rows.map(({ id, task, answer }) => {
  const g = gradeAnswer(taskById(task), answer, BENCH_DATE, registry);
  const findings = g.findings.map((f) => ({ slot: f.slot, rule: f.rule, label: f.label, verdict: f.verdict, excerpt: f.excerpt }));
  return JSON.stringify({ id, task, verdict: g.verdict, findings, missing: g.missing, warned: g.warned });
});
writeFileSync(values.out, `${out.join('\n')}\n`);
console.log(`${out.length} answers graded`);
