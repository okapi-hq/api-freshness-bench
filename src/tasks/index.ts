import type { Task } from '../types.ts';
import { ANTHROPIC_TASKS } from './anthropic.ts';
import { COMMERCE_TASKS } from './commerce.ts';
import { DATA_TASKS } from './data.ts';
import { INFERENCE_TASKS } from './inference.ts';
import { MESSAGING_TASKS } from './messaging.ts';
import { OPENAI_TASKS } from './openai.ts';
import { PROTOCOL_TASKS } from './protocols.ts';
import { SOCIAL_TASKS } from './social.ts';

export const TASKS: Task[] = [
  ...OPENAI_TASKS,
  ...ANTHROPIC_TASKS,
  ...INFERENCE_TASKS,
  ...MESSAGING_TASKS,
  ...SOCIAL_TASKS,
  ...COMMERCE_TASKS,
  ...DATA_TASKS,
  ...PROTOCOL_TASKS,
];

export function taskById(id: string): Task {
  const task = TASKS.find((t) => t.id === id);
  if (!task) throw new Error(`unknown task ${id}`);
  return task;
}

/** Checks the task set once: unique ids, compilable patterns, rules referenced by conditions exist. */
export function validateTasks(tasks: Task[] = TASKS): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const task of tasks) {
    if (ids.has(task.id)) errors.push(`duplicate task ${task.id}`);
    ids.add(task.id);
    const keys = new Set(task.slots.flatMap((s) => s.rules.map((r) => `${s.id}.${r.id}`)));
    for (const s of task.slots) {
      for (const r of s.rules) {
        try {
          new RegExp(r.pattern, r.flags);
        } catch (err) {
          errors.push(`${task.id} ${s.id}.${r.id}: ${(err as Error).message}`);
        }
        for (const k of [...(r.requires ?? []), ...(r.requiresAny ?? []), ...(r.unless ?? [])]) {
          if (!keys.has(k) && !(r.requiresAny ?? []).includes(k)) errors.push(`${task.id} ${s.id}.${r.id}: unknown ${k}`);
        }
      }
    }
  }
  return errors;
}
