import type { Fact, Status, Verdict } from '../types.ts';

/** The day the benchmark reads the world: every fact is judged as of this day. */
export const BENCH_DATE = '2026-10-24';

/**
 * How far ahead "keeps working" looks: a change dated within six months is at
 * risk, as Okapi's at-risk level is a dated change still ahead.
 */
export const HORIZON_DAYS = 182;

const DAY = 86_400_000;

export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

/** What a call built on this fact gets, on `today`, looking `horizon` days ahead. */
export function statusOf(fact: Fact, today = BENCH_DATE, horizon = HORIZON_DAYS): Status {
  const until = addDays(today, horizon);
  switch (fact.outcome) {
    case 'ok':
      return 'ok';
    case 'invalid':
      return 'broken';
    case 'keeps_working':
      return 'deprecated';
    case 'redirected':
      if (!fact.effective) return 'deprecated';
      return fact.effective <= until ? 'at_risk' : 'ok';
    case 'fails':
      if (!fact.effective) return 'deprecated';
      if (fact.effective <= today) return 'broken';
      return fact.effective <= until ? 'at_risk' : 'ok';
  }
}

/**
 * Could a model whose knowledge cutoff is the month `cutoff` (`2026-06`) have
 * known this change? Only when the provider announced it before that month
 * began (the benefit of the doubt goes to the model); with no announcement on
 * record, when it had already taken effect by then.
 */
export function knowable(fact: Fact, cutoff: string): boolean {
  const start = `${cutoff.slice(0, 7)}-01`;
  if (fact.announced) return fact.announced < start;
  if (fact.effective) return fact.effective < start;
  return true;
}

/**
 * Had the provider made this change public by `day`? By its announcement when one is on record,
 * else by the day it took effect; an undated deprecation or a value that never existed always.
 */
export function publicBy(fact: Fact, day: string): boolean {
  if (fact.announced) return fact.announced <= day;
  if (fact.effective) return fact.effective <= day;
  return true;
}

/** What a call built on this fact got on `day`, counting only a change already public then. */
export function statusOn(fact: Fact, day: string): Status {
  return publicBy(fact, day) ? statusOf(fact, day) : 'ok';
}

const RANK: Record<Verdict | 'missing', number> = {
  ok: 0,
  deprecated: 1,
  at_risk: 2,
  missing: 3,
  unknown: 4,
  broken: 5,
};

/** The worst of several verdicts: one broken call breaks the integration. */
export function worst<T extends Verdict | 'missing'>(verdicts: T[]): T | 'ok' {
  let out: T | 'ok' = 'ok';
  for (const v of verdicts) if (RANK[v] > RANK[out]) out = v;
  return out;
}
