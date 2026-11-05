import { readFileSync } from 'node:fs';
import type { Slot } from '../types.ts';
import { current, fails, modelRules, type ModelRow } from './facts.ts';

/**
 * OpenRouter serves what its model list says, nothing else: a slug that is
 * not on the list is refused. The list is a snapshot read on the benchmark
 * day (`data/openrouter-models-2026-10-24.json`), with each model's
 * expiration date when OpenRouter set one.
 */

interface Snapshot {
  readAt: string;
  source: string;
  models: [string, string | null][];
}

const SNAPSHOT = JSON.parse(
  readFileSync(new URL('./data/openrouter-models-2026-10-24.json', import.meta.url), 'utf8'),
) as Snapshot;

const VENDORS = [...new Set(SNAPSHOT.models.map(([id]) => id.split('/')[0].replace(/^~/, '')))];
const PAST_VENDORS = ['huggingfaceh4', 'openchat', 'gryphe', 'cognitivecomputations', 'mistral', 'meta', 'nousresearch', 'teknium', 'austism', 'jondurbin', 'koboldai', 'pygmalionai', 'phind', 'databricks', '01-ai', 'thudm', 'allenai', 'eva-unit-01', 'sophosympatheia', 'neversleep'];

export function openrouterModelSlot(): Slot {
  const rows: ModelRow[] = SNAPSHOT.models.map(([id, expires]) => ({
    id,
    fact: expires
      ? fails(expires, undefined, SNAPSHOT.source, { origin: 'provider', note: `OpenRouter stops serving it on ${expires}.` })
      : current(SNAPSHOT.source, { origin: 'provider' }),
  }));
  const vendors = [...new Set([...VENDORS, ...PAST_VENDORS])].map((v) => v.replace(/[.-]/g, '\\$&')).join('|');
  return {
    id: 'model',
    label: 'OpenRouter model',
    rules: modelRules(rows, true),
    candidate: `(?<=["'\`=:\\s])(~?(?:${vendors})/[a-z0-9][\\w.:-]*)(?=["'\`\\s,;)}\\]]|$)`,
    candidateFlags: 'gm',
    // Dated to the snapshot: when OpenRouter dropped a slug is not on record, so no model is
    // held to it in the knowable lens.
    unknownAs: fails(SNAPSHOT.readAt, undefined, SNAPSHOT.source, {
      origin: 'provider',
      note: `Not on OpenRouter's model list on ${SNAPSHOT.readAt}: the API answers that the model does not exist. Okapi reports these as "<model> is not served by OpenRouter".`,
    }),
    absent: 'missing',
  };
}
