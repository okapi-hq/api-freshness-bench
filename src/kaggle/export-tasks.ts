import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { TASKS, validateTasks } from '../tasks/index.ts';
import { SYSTEM_PROMPT } from '../prompt.ts';
import { BENCH_DATE, HORIZON_DAYS } from '../grader/status.ts';

/**
 * Writes the tasks, their rules and facts as JSON for the Python grader that
 * runs on Kaggle (`kaggle/tasks.json`). The patterns stay JavaScript regular
 * expressions; the Python grader converts them as it loads them.
 *
 *   node src/kaggle/export-tasks.ts
 */

const ROOT = join(dirname(new URL(import.meta.url).pathname), '..', '..');

const errors = validateTasks();
if (errors.length) throw new Error(errors.join('\n'));

const out = { date: BENCH_DATE, horizonDays: HORIZON_DAYS, system: SYSTEM_PROMPT, tasks: TASKS };
writeFileSync(join(ROOT, 'kaggle', 'tasks.json'), `${JSON.stringify(out, null, 1)}\n`);
console.log(`${TASKS.length} tasks, ${TASKS.reduce((n, t) => n + t.slots.reduce((m, s) => m + s.rules.length, 0), 0)} rules`);
