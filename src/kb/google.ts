import type { Rule, Slot } from '../types.ts';
import { current, deprecated, fails, modelRules, rowsFrom, type Row } from './facts.ts';

export const GEMINI_DEPRECATIONS = 'https://ai.google.dev/gemini-api/docs/deprecations';
const CHANGELOG = 'https://ai.google.dev/gemini-api/docs/changelog';

const ROWS: Row[] = [
  ['gemini-pro', '2025-02-15', null],
  ['gemini-1.0-pro', '2025-02-15', null],
  ['gemini-pro-vision', '2024-07-12', null],
  ['gemini-1.5-pro', '2025-09-29', null],
  ['gemini-1.5-pro-latest', '2025-09-29', null],
  ['gemini-1.5-pro-002', '2025-09-29', null],
  ['gemini-1.5-flash', '2025-09-29', null],
  ['gemini-1.5-flash-latest', '2025-09-29', null],
  ['gemini-1.5-flash-002', '2025-09-29', null],
  ['gemini-1.5-flash-8b', '2025-09-29', null],
  ['gemini-2.0-flash-exp', '2025-12-09', null],
  ['gemini-2.0-flash', '2026-06-01', '2026-02-18'],
  ['gemini-2.0-flash-001', '2026-06-01', '2026-02-18'],
  ['gemini-2.0-flash-lite', '2026-06-01', '2026-02-18'],
  ['gemini-2.0-flash-lite-001', '2026-06-01', '2026-02-18'],
  ['gemini-2.5-flash-preview-05-20', '2025-11-18', null],
  ['gemini-2.5-flash-preview-09-25', '2026-02-17', null],
  ['gemini-2.5-pro-preview-06-05', '2025-12-02', null],
  ['gemini-2.5-pro-preview-05-06', '2025-12-02', null],
  ['gemini-3-pro-preview', '2026-03-09', null],
  ['gemini-3.1-flash-lite-preview', '2026-05-25', null],
  ['gemini-1.5-mini', { outcome: 'invalid', source: GEMINI_DEPRECATIONS, origin: 'provider', note: 'No Gemini model was ever called gemini-1.5-mini.' }],
  ['gemini-2.5-flash'],
  ['gemini-2.5-pro'],
  ['gemini-2.5-flash-lite'],
  ['gemini-3-flash-preview'],
  ['gemini-3.1-pro-preview'],
  ['gemini-3.1-flash-lite'],
  ['gemini-3.5-flash'],
  ['gemini-3.5-flash-lite'],
  ['gemini-3.6-flash'],
  ['gemini-3.7-flash'],
  ['gemini-3.8-flash'],
  ['gemini-4-argon'],
  ['gemini-flash-latest'],
  ['gemini-flash-lite-latest'],
  ['gemini-pro-latest'],
  ['embedding-001', '2025-10-30', null],
  ['gemini-embedding-exp-03-07', '2025-10-30', null],
  ['text-embedding-004', '2026-01-14', '2025-12-03'],
  ['gemini-embedding-001'],
  ['gemini-embedding-2'],
  ['imagen-3.0-generate-002', '2025-11-10', null],
  ['imagen-4.0-generate-001', '2026-08-17', null],
];

const RELEASED: Record<string, string> = {
  'gemini-2.5-flash': '2025-06-17',
  'gemini-2.5-pro': '2025-06-17',
  'gemini-2.5-flash-lite': '2025-07-22',
  'gemini-3-flash-preview': '2025-12-17',
  'gemini-3.1-pro-preview': '2026-02-19',
  'gemini-3.1-flash-lite': '2026-05-07',
  'gemini-3.5-flash': '2026-05-19',
  'gemini-3.5-flash-lite': '2026-07-21',
  'gemini-3.6-flash': '2026-07-21',
  'gemini-3.7-flash': '2026-08-13',
  'gemini-3.8-flash': '2026-09-02',
  'gemini-4-argon': '2026-10-13',
  'gemini-flash-latest': '2026-08-13',
  'gemini-embedding-001': '2025-05-20',
  'gemini-embedding-2': '2026-04-22',
};

const rows = rowsFrom(ROWS, GEMINI_DEPRECATIONS, RELEASED);
for (const r of rows) {
  if (r.id.startsWith('gemini-1.5')) r.fact = { ...r.fact, source: `${CHANGELOG}#09-29-2025` };
}

export const GEMINI_MODEL_RULES: Rule[] = modelRules(rows);

export const GEMINI_CANDIDATE =
  '(?<=["\'`=:\\s/])((?:gemini|text-embedding|embedding|imagen|veo)-[\\w.-]+)(?=["\'`\\s,;)}\\]:]|$)';

export function geminiModelSlot(): Slot {
  return {
    id: 'model',
    label: 'Model',
    rules: GEMINI_MODEL_RULES,
    candidate: GEMINI_CANDIDATE,
    candidateFlags: 'gm',
    absent: 'missing',
  };
}

const PY_LEGACY = 'https://raw.githubusercontent.com/google-gemini/deprecated-generative-ai-python/main/README.md';
const JS_LEGACY = 'https://raw.githubusercontent.com/google-gemini/deprecated-generative-ai-js/main/README.md';

export const GEMINI_SDK_RULES: Rule[] = [
  {
    id: 'python-legacy',
    label: 'google-generativeai (legacy Python SDK)',
    pattern: 'import google\\.generativeai|from google import generativeai|from google\\.generativeai',
    fact: deprecated('2025-02-06', PY_LEGACY, {
      origin: 'provider',
      quote: 'All support for this repository ended permanently on November 30, 2025.',
      note: 'Move to google-genai (from google import genai; genai.Client()).',
    }),
  },
  {
    id: 'python-genai',
    label: 'google-genai (Python)',
    pattern: 'from google import genai|import google\\.genai|genai\\.Client\\(',
    fact: current('https://github.com/googleapis/python-genai'),
  },
  {
    id: 'js-legacy',
    label: '@google/generative-ai (legacy JavaScript SDK)',
    pattern: '["\']@google/generative-ai["\']|new\\s+GoogleGenerativeAI\\s*\\(',
    fact: deprecated('2025-03-25', JS_LEGACY, {
      origin: 'provider',
      quote: 'Please be advised that this repository is now considered legacy.',
      note: 'Move to @google/genai (new GoogleGenAI({ apiKey })).',
    }),
  },
  {
    id: 'js-genai',
    label: '@google/genai',
    pattern: '["\']@google/genai["\']|new\\s+GoogleGenAI\\s*\\(',
    fact: current('https://github.com/googleapis/js-genai'),
  },
  {
    id: 'android-legacy',
    label: 'Google AI client SDK for Android (com.google.ai.client.generativeai)',
    pattern: 'com\\.google\\.ai\\.client\\.generativeai',
    fact: deprecated('2025-02-06', 'https://github.com/google-gemini/generative-ai-android', {
      origin: 'provider',
      quote: "We don't plan to add anything to this SDK or making any further changes.",
      note: 'Move to Firebase AI Logic (com.google.firebase:firebase-ai).',
    }),
  },
  {
    id: 'palm',
    label: 'PaLM API (generateText, v1beta2/v1beta3)',
    pattern: 'generativelanguage\\.googleapis\\.com/v1beta[23]|:generateText|models/text-bison|chat-bison',
    fact: fails('2024-08-15', undefined, CHANGELOG, { origin: 'provider', note: 'The PaLM API was shut down.' }),
  },
];

export function geminiSdkSlot(): Slot {
  return { id: 'sdk', label: 'SDK', rules: GEMINI_SDK_RULES, absent: 'ok' };
}
