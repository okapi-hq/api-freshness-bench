import type { Fact, Rule, Slot } from '../types.ts';

/** Shorthands for the tasks' own rules and slots. */

export function rule(id: string, label: string, pattern: string, fact: Fact, extra: Partial<Rule> = {}): Rule {
  return { id, label, pattern, fact, ...extra };
}

export function slot(id: string, label: string, rules: Rule[], extra: Partial<Slot> = {}): Slot {
  return { id, label, rules, absent: 'ok', ...extra };
}

/** A slot the answer must fill: an answer that never names it is `missing`. */
export function required(id: string, label: string, rules: Rule[], extra: Partial<Slot> = {}): Slot {
  return { id, label, rules, absent: 'missing', ...extra };
}
