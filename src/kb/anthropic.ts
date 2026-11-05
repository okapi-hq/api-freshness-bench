import type { Fact, Rule, Slot } from '../types.ts';
import { current, deprecated, fails, invalid, modelRules, rowsFrom, type Row } from './facts.ts';

export const ANTHROPIC_DEPRECATIONS = 'https://platform.claude.com/docs/en/about-claude/model-deprecations';

const ROWS: Row[] = [
  ['claude-instant-1.2', '2024-11-06', null],
  ['claude-2.0', '2025-07-21', null],
  ['claude-2.1', '2025-07-21', null],
  ['claude-3-sonnet-20240229', '2025-07-21', null],
  ['claude-3-opus-20240229', '2026-01-05', '2025-06-30'],
  ['claude-3-opus-latest', '2026-01-05', '2025-06-30'],
  ['claude-3-5-sonnet-20240620', '2025-10-28', '2025-08-13'],
  ['claude-3-5-sonnet-20241022', '2025-10-28', '2025-08-13'],
  ['claude-3-5-sonnet-latest', '2025-10-28', '2025-08-13'],
  ['claude-3-7-sonnet-20250219', '2026-02-19', '2025-10-28'],
  ['claude-3-7-sonnet-latest', '2026-02-19', '2025-10-28'],
  ['claude-3-5-haiku-20241022', '2026-02-19', '2025-12-19'],
  ['claude-3-5-haiku-latest', '2026-02-19', '2025-12-19'],
  ['claude-3-haiku-20240307', '2026-04-20', '2026-02-19'],
  ['claude-sonnet-4-20250514', '2026-06-15', '2026-04-14'],
  ['claude-sonnet-4-0', '2026-06-15', '2026-04-14'],
  ['claude-sonnet-4-latest', '2026-06-15', '2026-04-14'],
  ['claude-opus-4-20250514', '2026-06-15', '2026-04-14'],
  ['claude-opus-4-0', '2026-06-15', '2026-04-14'],
  ['claude-opus-4-1-20250805', '2026-08-05', '2026-06-05'],
  ['claude-opus-4-1', '2026-08-05', '2026-06-05'],
  ['claude-sonnet-4-5', '2026-11-30', '2026-09-30'],
  ['claude-sonnet-4-5-20250929', '2026-11-30', '2026-09-30'],
  ['claude-haiku-4-5'],
  ['claude-haiku-4-5-20251001'],
  ['claude-opus-4-5-20250514', { outcome: 'invalid', source: ANTHROPIC_DEPRECATIONS, origin: 'provider', note: 'Not a Claude model id: Claude Opus 4.5 is claude-opus-4-5-20251101.' }],
  ['claude-opus-4-5'],
  ['claude-opus-4-5-20251101'],
  ['claude-opus-4-6'],
  ['claude-sonnet-4-6'],
  ['claude-opus-4-7'],
  ['claude-opus-4-8'],
  ['claude-sonnet-5'],
  ['claude-opus-5'],
  ['claude-fable-5'],
  ['claude-fable-5-1'],
  ['claude-opus-5-5'],
  ['claude-sonnet-5-5'],
  ['claude-haiku-5-5'],
];

const RELEASED: Record<string, string> = {
  'claude-haiku-4-5': '2025-10-15',
  'claude-haiku-4-5-20251001': '2025-10-15',
  'claude-opus-4-5': '2025-11-24',
  'claude-opus-4-5-20251101': '2025-11-24',
  'claude-opus-4-6': '2026-02-04',
  'claude-sonnet-4-6': '2026-02-17',
  'claude-opus-4-7': '2026-04-14',
  'claude-opus-4-8': '2026-05-28',
  'claude-sonnet-5': '2026-06-29',
  'claude-opus-5': '2026-07-24',
  'claude-fable-5': '2026-06-07',
  'claude-fable-5-1': '2026-09-01',
  'claude-opus-5-5': '2026-09-22',
  'claude-sonnet-5-5': '2026-09-28',
  'claude-haiku-5-5': '2026-10-07',
};

export const ANTHROPIC_MODEL_RULES: Rule[] = modelRules(rowsFrom(ROWS, ANTHROPIC_DEPRECATIONS, RELEASED));

/** A Claude model id: a version digit or a family name after `claude-` (not a crate called claude-cli). */
export const ANTHROPIC_CANDIDATE =
  '(?<=["\'`=:\\s/])(claude-(?:\\d|instant|opus|sonnet|haiku|fable|mythos|v\\d)[\\w.-]*)(?=["\'`\\s,;)}\\]:@]|$)';

export function anthropicModelSlot(): Slot {
  return {
    id: 'model',
    label: 'Model',
    rules: ANTHROPIC_MODEL_RULES,
    candidate: ANTHROPIC_CANDIDATE,
    candidateFlags: 'gm',
    absent: 'missing',
  };
}

/** Models that take no sampling parameter but the default (models.dev `temperature: false`). */
const NO_SAMPLING = [
  'claude-opus-4-7', 'claude-opus-4-8', 'claude-opus-5', 'claude-opus-5-5', 'claude-sonnet-5',
  'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5', 'claude-fable-5-1',
];

/** Models on which a fixed thinking budget is refused: adaptive thinking only. */
const NO_BUDGET = NO_SAMPLING;
/** Models on which a thinking budget still works but is deprecated. */
const BUDGET_DEPRECATED = ['claude-opus-4-6', 'claude-sonnet-4-6'];

const MIGRATION = 'https://platform.claude.com/docs/en/models/opus-5-5/migration-guide';
const SONNET_55 = 'https://platform.claude.com/docs/en/models/sonnet-5-5/migration-guide';
const API_VERSION = 'https://platform.claude.com/docs/en/api/migration-2026-10-21';
const PY_SDK_1 = 'https://raw.githubusercontent.com/anthropics/anthropic-sdk-python/main/MIGRATION.md';

/** The first Claude model that refused sampling parameters and fixed thinking budgets. */
const OPUS_47_RELEASE = '2026-04-14';

const SAMPLING = '(?<![\\w$])(?:temperature|top_p|top_k|topP|topK)["\']?\\s*[:=]\\s*[\\d.]';

const SAMPLING_V2026: Fact = invalid(API_VERSION, {
  origin: 'changelog',
  quote: 'a request that sends temperature, top_p, or top_k returns a 400 error, even at the parameter\'s default value.',
  note: 'The SDK releases of 2026-10-21 (Python 2.0, TypeScript 1.0) send this API version by default.',
});

export const ANTHROPIC_PARAM_RULES: Rule[] = [
  {
    id: 'sampling-new-model',
    label: 'temperature / top_p on a model that refuses sampling parameters',
    pattern: SAMPLING,
    requiresAny: NO_SAMPLING.map((m) => `model.${m}`),
    fact: invalid(SONNET_55, {
      origin: 'provider',
      quote: 'Sampling parameters return an error. Remove temperature, top_p, and top_k.',
      announced: OPUS_47_RELEASE,
      note: 'Claude Opus 4.7 and later, Sonnet 5 and later, Haiku 5.5 and Fable: models.dev lists temperature: false. Opus 4.7, the first, was released on 2026-04-14.',
    }),
  },
  {
    id: 'sampling-python-sdk',
    label: 'temperature= in messages.create (removed from the Python SDK 1.0)',
    pattern: '(?<![\\w$])(?:temperature|top_p|top_k)\\s*=\\s*(?!None)[\\w.]',
    requires: ['sdk.python'],
    unless: ['params.sampling-new-model'],
    sdk: { pkg: 'anthropic', breaksFrom: 1, pinned: current(MIGRATION) },
    fact: invalid(PY_SDK_1, {
      origin: 'changelog',
      quote: 'Current models do not use these sampling parameters',
      announced: '2026-08-20',
      note: 'anthropic 1.0.0 (2026-08-20) removed them; pin anthropic<1 to keep them on older models.',
    }),
  },
  {
    id: 'sampling-ts-sdk',
    label: 'temperature on API version 2026-10-21 (TypeScript SDK 1.0)',
    pattern: SAMPLING,
    requires: ['sdk.typescript'],
    unless: ['params.sampling-new-model'],
    sdk: { pkg: '@anthropic-ai/sdk', breaksFrom: 1, pinned: current(MIGRATION) },
    fact: { ...SAMPLING_V2026, announced: '2026-10-21' },
  },
  {
    id: 'sampling-raw-2026',
    label: 'temperature with anthropic-version: 2026-10-21',
    pattern: SAMPLING,
    requires: ['sdk.version-2026'],
    unless: ['params.sampling-new-model'],
    fact: { ...SAMPLING_V2026, announced: '2026-10-21' },
  },
  {
    id: 'budget-refused',
    label: 'thinking with budget_tokens on a model that only thinks adaptively',
    pattern: '(?<![\\w$])budget_?[tT]okens["\']?\\s*[:=]',
    requiresAny: NO_BUDGET.map((m) => `model.${m}`),
    fact: invalid(MIGRATION, {
      origin: 'provider',
      quote: 'is no longer supported on Claude Opus 4.7 and later models and returns a 400 error.',
      announced: OPUS_47_RELEASE,
      note: 'Opus 4.7, the first model to refuse it, was released on 2026-04-14.',
    }),
  },
  {
    id: 'budget-deprecated',
    label: 'thinking with budget_tokens (deprecated on 4.6)',
    pattern: '(?<![\\w$])budget_?[tT]okens["\']?\\s*[:=]',
    requiresAny: BUDGET_DEPRECATED.map((m) => `model.${m}`),
    fact: deprecated('2026-02-04', SONNET_55, {
      origin: 'provider',
      quote: 'as a deprecated setting.',
      note: 'Claude Sonnet 4.6 (and Opus 4.6) accept a fixed thinking budget as a deprecated setting.',
    }),
  },
  {
    id: 'adaptive',
    label: 'adaptive thinking',
    pattern: 'type["\']?\\s*[:=]\\s*["\']adaptive["\']',
    fact: current(MIGRATION),
  },
];

export function anthropicParamSlot(): Slot {
  return { id: 'params', label: 'Request parameters', rules: ANTHROPIC_PARAM_RULES, absent: 'ok' };
}

export const ANTHROPIC_SDK_RULES: Rule[] = [
  { id: 'python', label: 'anthropic (Python)', pattern: '(?:^|\\n)\\s*(?:import anthropic|from anthropic(?:\\.\\w+)? import)', fact: current(PY_SDK_1) },
  { id: 'typescript', label: '@anthropic-ai/sdk', pattern: '["\']@anthropic-ai/sdk["\']', fact: current('https://github.com/anthropics/anthropic-sdk-typescript') },
  {
    id: 'version-2023',
    label: 'anthropic-version: 2023-06-01',
    pattern: 'anthropic-version["\']?\\s*[:,=]\\s*["\']?2023-06-01',
    fact: current(API_VERSION, { note: 'Still served; the SDKs released on 2026-10-21 send 2026-10-21 by default.' }),
  },
  { id: 'messages-endpoint', label: 'POST /v1/messages', pattern: '/v1/messages(?![\\w/])', fact: current(API_VERSION) },
  {
    id: 'version-2026',
    label: 'anthropic-version: 2026-10-21',
    pattern: 'anthropic-version["\']?\\s*[:,=]\\s*["\']?2026-10-21',
    fact: current(API_VERSION),
  },
  {
    id: 'text-completions',
    label: 'Text Completions API (/v1/complete)',
    pattern: '(?<!chat\\.)completions\\.create\\(|HUMAN_PROMPT|AI_PROMPT|/v1/complete(?![\\w])|max_tokens_to_sample',
    fact: invalid(PY_SDK_1, {
      origin: 'changelog',
      quote: 'client.completions.create() (the /v1/complete endpoint)',
      announced: '2026-08-20',
    }),
  },
];

export function anthropicSdkSlot(): Slot {
  return { id: 'sdk', label: 'SDK and API version', rules: ANTHROPIC_SDK_RULES, absent: 'ok' };
}

export { fails };
