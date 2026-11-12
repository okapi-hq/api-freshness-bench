import type { Slot } from '../types.ts';
import { current, deprecated, fails, invalid, modelRules, redirected, rowsFrom, type Row } from './facts.ts';

/** Groq, DeepSeek and xAI model tables, from Okapi's model registry and their pages. */

const GROQ = 'https://console.groq.com/docs/deprecations';
const TIERS = 'Applies to free and developer tiers: a new key gets errors; committed-spend contracts are not affected.';

const GROQ_ROWS: Row[] = [
  ['mixtral-8x7b-32768', '2025-03-20', null],
  ['llama2-70b-4096', '2024-01-01', null],
  ['gemma-7b-it', '2024-12-18', null],
  ['gemma2-9b-it', '2025-10-08', '2025-08-08'],
  ['llama3-70b-8192', '2025-08-30', '2025-05-31'],
  ['llama3-8b-8192', '2025-08-30', '2025-05-31'],
  ['llama-3.1-70b-versatile', '2025-01-24', null],
  ['llama-3.2-90b-vision-preview', '2025-04-14', '2025-04-07'],
  ['llama-3.2-11b-vision-preview', '2025-04-14', '2025-04-07'],
  ['llama-3.2-3b-preview', '2025-04-14', '2025-04-07'],
  ['llama-3.2-1b-preview', '2025-04-14', '2025-04-07'],
  ['deepseek-r1-distill-llama-70b', '2025-10-02', '2025-09-02'],
  ['qwen-qwq-32b', '2025-07-14', null],
  ['mistral-saba-24b', '2025-07-30', null],
  ['moonshotai/kimi-k2-instruct', '2025-10-10', '2025-09-10'],
  ['moonshotai/kimi-k2-instruct-0905', '2026-04-15', '2026-03-23'],
  ['meta-llama/llama-4-maverick-17b-128e-instruct', '2026-03-09', '2026-02-20'],
  ['llama-3.3-70b', { outcome: 'invalid', source: GROQ, origin: 'provider', note: 'Not a Groq model id (llama-3.3-70b-versatile was).' }],
  ['llama-3.1-8b', { outcome: 'invalid', source: GROQ, origin: 'provider', note: 'Not a Groq model id (llama-3.1-8b-instant was).' }],
  ['openai/gpt-oss-120b'],
  ['openai/gpt-oss-20b'],
  ['qwen/qwen3.8-27b'],
  ['whisper-large-v3'],
  ['whisper-large-v3-turbo'],
];

const groqRows = rowsFrom(GROQ_ROWS, GROQ, {
  'openai/gpt-oss-120b': '2025-08-05',
  'openai/gpt-oss-20b': '2025-08-05',
  'qwen/qwen3.8-27b': '2026-08-14',
});
for (const [id, day] of [
  ['llama-3.1-8b-instant', '2026-08-16'],
  ['llama-3.3-70b-versatile', '2026-08-16'],
  ['qwen/qwen3-32b', '2026-07-17'],
  ['meta-llama/llama-4-scout-17b-16e-instruct', '2026-07-17'],
  ['qwen/qwen3.6-27b', '2026-09-14'],
]) {
  groqRows.push({ id, fact: fails(day, day === '2026-09-14' ? undefined : '2026-06-17', GROQ, { note: TIERS }) });
}

export function groqModelSlot(): Slot {
  return {
    id: 'model',
    label: 'Model',
    rules: modelRules(groqRows),
    candidate:
      '(?<=["\'`=:\\s/])((?:llama|mixtral|gemma|qwen|deepseek|openai/gpt-oss|meta-llama|moonshotai|mistral|whisper|compound|groq/)[\\w./-]*)(?=["\'`\\s,;)}\\]:]|$)',
    candidateFlags: 'gm',
    absent: 'missing',
  };
}

const DEEPSEEK = 'https://api-docs.deepseek.com/updates/#date-2026-04-24';

export function deepseekModelSlot(): Slot {
  const legacy = (id: string, note: string) => ({
    id,
    fact: fails('2026-07-24', '2026-04-24', DEEPSEEK, {
      quote: 'The two legacy API model names, deepseek-chat and deepseek-reasoner, will be discontinued in three months (2026-07-24).',
      note,
    }),
  });
  return {
    id: 'model',
    label: 'Model',
    rules: modelRules([
      legacy('deepseek-chat', 'Move to deepseek-v4-flash with thinking disabled.'),
      legacy('deepseek-reasoner', 'Move to deepseek-v4-flash with thinking enabled.'),
      { id: 'deepseek-coder', fact: fails('2024-09-05', undefined, 'https://api-docs.deepseek.com/news/news0905', { origin: 'provider', note: 'Merged into deepseek-chat, itself discontinued on 2026-07-24.' }) },
      { id: 'deepseek-v4-flash', fact: deprecated(undefined, 'https://models.dev/api.json#deepseek', { announced: '2026-10-17', note: 'Answered by a newer model; DeepSeek now lists deepseek-flash, released on 2026-10-17.' }) },
      { id: 'deepseek-flash', fact: current('https://api-docs.deepseek.com/quick_start/pricing', { released: '2026-10-17' }) },
      { id: 'deepseek-v4-pro', fact: current('https://api-docs.deepseek.com/quick_start/pricing', { released: '2026-08-13' }) },
    ]),
    candidate: '(?<=["\'`=:\\s/])(deepseek-[\\w.-]+)(?=["\'`\\s,;)}\\]:]|$)',
    candidateFlags: 'gm',
    absent: 'missing',
  };
}

const XAI = 'https://docs.x.ai/docs/models';

export function xaiModelSlot(): Slot {
  const xaiRedirect = (id: string) => ({
    id,
    fact: redirected('2026-10-24', undefined, XAI, { note: 'xAI answers this id from a newer model.' }),
  });
  return {
    id: 'model',
    label: 'Model',
    rules: modelRules([
      { id: 'grok-1', fact: invalid(XAI, { note: 'Not a model the xAI API serves: Grok-1 is an open-weights release.' }) },
      { id: 'grok-1.0', fact: invalid(XAI, { note: 'Not a model the xAI API serves: Grok-1 is an open-weights release.' }) },
      { id: 'grok-beta', fact: fails('2025-04-15', undefined, XAI, { origin: 'provider' }) },
      { id: 'grok-vision-beta', fact: fails('2025-04-15', undefined, XAI, { origin: 'provider' }) },
      { id: 'grok-2', fact: fails('2026-10-14', undefined, XAI) },
      { id: 'grok-2-1212', fact: fails('2026-10-14', undefined, XAI) },
      { id: 'grok-2-latest', fact: fails('2026-10-14', undefined, XAI) },
      { id: 'grok-2-vision-1212', fact: fails('2026-10-14', undefined, XAI) },
      xaiRedirect('grok-3'),
      xaiRedirect('grok-3-mini'),
      xaiRedirect('grok-3-latest'),
      {
        id: 'grok-3-fast',
        fact: redirected('2026-10-24', undefined, XAI, { note: 'Not on xAI\'s model list; read as the grok-3 family, which xAI answers from a newer model.' }),
      },
      xaiRedirect('grok-4-0709'),
      xaiRedirect('grok-4'),
      xaiRedirect('grok-4-latest'),
      xaiRedirect('grok-4-fast-reasoning'),
      {
        id: 'grok-4-fast',
        fact: redirected('2026-10-24', undefined, XAI, { note: 'Not on xAI\'s model list; read as the grok-4-fast family, which xAI answers from a newer model.' }),
      },
      xaiRedirect('grok-4-fast-non-reasoning'),
      xaiRedirect('grok-4-1-fast-reasoning'),
      xaiRedirect('grok-4-1-fast-non-reasoning'),
      xaiRedirect('grok-code-fast-1'),
      { id: 'grok-4.20-0309-reasoning', fact: current(XAI, { released: '2026-03-09' }) },
      { id: 'grok-4.20-0309-non-reasoning', fact: current(XAI, { released: '2026-03-09' }) },
      // Aliases xAI's model page lists beside the dated ids (read 2026-10-25).
      { id: 'grok-4.20', fact: current(XAI, { released: '2026-03-09' }) },
      { id: 'grok-4.20-reasoning', fact: current(XAI, { released: '2026-03-09' }) },
      { id: 'grok-4.20-non-reasoning', fact: current(XAI, { released: '2026-03-09' }) },
      { id: 'grok-4.3', fact: current(XAI, { released: '2026-04-17' }) },
      { id: 'grok-4.5', fact: current(XAI, { released: '2026-07-08' }) },
      { id: 'grok-4.6', fact: current(XAI, { released: '2026-08-12' }) },
      { id: 'grok-4.7', fact: current(XAI, { released: '2026-09-21' }) },
    ]).concat({
      id: 'latest',
      label: 'latest (no such xAI model)',
      pattern: 'model["\']?\\s*[:=]\\s*["\']latest["\']',
      fact: { outcome: 'invalid', source: XAI, origin: 'provider', note: 'xAI has no model named latest: its aliases carry a model name (grok-4.20-beta-latest).' },
    }),
    candidate: '(?<=["\'`=:\\s/])(grok-[\\w.-]+)(?=["\'`\\s,;)}\\]:]|$)',
    candidateFlags: 'gm',
    absent: 'missing',
  };
}
