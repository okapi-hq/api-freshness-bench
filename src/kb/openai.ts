import type { Fact, Rule, Slot } from '../types.ts';
import { current, deprecated, fails, invalid, modelRules, rowsFrom, word, type Row } from './facts.ts';

/** OpenAI's models as Okapi reads its deprecations page (shutdown, announced). */
export const OPENAI_DEPRECATIONS = 'https://developers.openai.com/api/docs/deprecations';

const ROWS: Row[] = [
  ['gpt-3.5-turbo', '2026-10-23', '2026-04-22'],
  ['gpt-3.5-turbo-0125', '2026-10-23', '2026-04-22'],
  ['gpt-3.5-turbo-1106', '2026-09-28', '2025-09-26'],
  ['gpt-3.5-turbo-0613', '2024-09-13', '2023-11-06'],
  ['gpt-3.5-turbo-16k', '2024-09-13', '2023-11-06'],
  ['gpt-3.5-turbo-16k-0613', '2024-09-13', '2023-11-06'],
  ['gpt-3.5-turbo-0301', '2024-09-13', '2023-06-13'],
  ['gpt-3.5-turbo-instruct', '2026-09-28', '2025-09-26'],
  ['text-davinci-003', '2024-01-04', '2023-07-06'],
  ['text-davinci-002', '2024-01-04', '2023-07-06'],
  ['text-curie-001', '2024-01-04', '2023-07-06'],
  ['davinci-002', '2026-09-28', '2025-09-26'],
  ['babbage-002', '2026-09-28', '2025-09-26'],
  ['gpt-4', '2026-10-23', '2026-04-22'],
  ['gpt-4-0613', '2026-10-23', '2026-04-22'],
  ['gpt-4-0314', '2026-03-26', '2025-09-26'],
  ['gpt-4-32k', '2025-06-06', '2024-06-06'],
  ['gpt-4-turbo', '2026-10-23', '2026-04-22'],
  ['gpt-4-turbo-2024-04-09', '2026-10-23', '2026-04-22'],
  ['gpt-4-turbo-preview', '2026-03-26', '2025-09-26'],
  ['gpt-4-0125-preview', '2026-03-26', '2025-09-26'],
  ['gpt-4-1106-preview', '2026-10-23', '2026-04-22'],
  ['gpt-4-vision-preview', '2024-12-06', '2024-06-06'],
  ['gpt-4o', '2027-01-14', '2026-10-14'],
  ['gpt-4o-2024-05-13', '2026-10-23', '2026-04-22'],
  ['gpt-4o-2024-08-06', '2027-01-14', '2026-10-14'],
  ['gpt-4o-2024-11-20', '2027-01-14', '2026-10-14'],
  ['gpt-4o-mini', '2027-01-14', '2026-10-14'],
  ['gpt-4o-mini-2024-07-18', '2027-01-14', '2026-10-14'],
  ['gpt-4.1', '2027-01-14', '2026-10-14'],
  ['gpt-4.1-2025-04-14', '2027-01-14', '2026-10-14'],
  ['gpt-4.1-mini', '2027-01-14', '2026-10-14'],
  ['gpt-4.1-mini-2025-04-14', '2027-01-14', '2026-10-14'],
  ['gpt-4.1-nano', '2026-10-23', '2026-04-22'],
  ['gpt-4.1-nano-2025-04-14', '2026-10-23', '2026-04-22'],
  ['gpt-4.5-preview', '2025-07-14', '2025-04-14'],
  ['chatgpt-4o-latest', '2026-02-17', '2025-11-18'],
  ['o1-preview', '2025-07-28', '2025-04-28'],
  ['o1-mini', '2025-10-27', '2025-04-28'],
  ['o1', '2026-10-23', '2026-04-22'],
  ['o1-pro', '2026-10-23', '2026-04-22'],
  ['o3-mini', '2026-10-23', '2026-04-22'],
  ['o4-mini', '2026-10-23', '2026-04-22'],
  ['o3', '2026-12-11', '2026-06-11'],
  ['o3-pro', '2026-12-11', '2026-06-11'],
  ['gpt-5', '2026-12-11', '2026-06-11'],
  ['gpt-5-2025-08-07', '2026-12-11', '2026-06-11'],
  ['gpt-5-mini', '2026-12-11', '2026-06-11'],
  ['gpt-5-nano', '2026-12-11', '2026-06-11'],
  ['gpt-5-pro', '2026-12-11', '2026-06-11'],
  ['gpt-5-chat-latest', '2026-07-23', '2026-04-22'],
  ['gpt-5-codex', '2026-07-23', '2026-04-22'],
  ['gpt-5.1', '2027-04-01', '2026-10-01'],
  ['gpt-5.1-chat-latest', '2026-07-23', '2026-04-22'],
  ['gpt-5.1-codex', '2026-07-23', '2026-04-22'],
  ['gpt-5.2'],
  ['gpt-5.2-pro'],
  ['gpt-5.2-chat-latest', '2026-08-10', '2026-05-08'],
  ['gpt-5.3-chat-latest', '2026-08-10', '2026-05-08'],
  ['gpt-5.3-codex', '2027-04-01', '2026-10-01'],
  ['gpt-5.4'],
  ['gpt-5.4-mini'],
  ['gpt-5.4-pro'],
  ['gpt-5.4-nano', '2027-04-01', '2026-10-01'],
  ['gpt-5.5'],
  ['gpt-5.5-pro'],
  ['gpt-5.6'],
  ['gpt-5.6-sol'],
  ['gpt-5.6-terra'],
  ['gpt-5.6-luna'],
  ['gpt-6-sol'],
  ['gpt-6-luna'],
  ['gpt-6-astra'],
  ['gpt-6.1-sol'],
  ['text-embedding-3-small'],
  ['text-embedding-3-large'],
  ['text-embedding-ada-002'],
  ['whisper-1', '2027-02-26', '2026-08-26'],
  ['gpt-4o-transcribe', '2027-02-26', '2026-08-26'],
  ['gpt-4o-mini-transcribe', '2027-02-26', '2026-08-26'],
  ['gpt-4o-transcribe-diarize', '2027-02-26', '2026-08-26'],
  ['gpt-4o-mini-transcribe-2025-03-20', '2027-01-20', '2026-07-20'],
  ['gpt-transcribe'],
  ['gpt-live-transcribe'],
  ['tts-1', '2027-01-06', '2026-10-01'],
  ['tts-1-hd', '2027-01-06', '2026-10-01'],
  ['gpt-4o-mini-tts', '2027-01-06', '2026-10-01'],
  ['gpt-realtime-2.1'],
  ['gpt-realtime-2.1-mini'],
  ['dall-e-2', '2026-05-12', '2025-11-14'],
  ['dall-e-3', '2026-05-12', '2025-11-14'],
  ['gpt-image-1', '2026-10-23', '2026-04-22'],
  ['gpt-image-1-mini', '2026-12-01', '2026-06-02'],
  ['gpt-image-1.5', '2026-12-01', '2026-06-02'],
  ['chatgpt-image-latest', '2026-12-01', '2026-06-02'],
  ['gpt-image-2'],
  ['gpt-image-2.5-sunburst'],
  ['gpt-image-2.5-flare'],
  ['text-moderation-latest', '2025-10-27', '2025-04-28'],
  ['omni-moderation-latest'],
];

const RELEASED: Record<string, string> = {
  'gpt-5.2': '2025-12-11',
  'gpt-5.2-pro': '2025-12-11',
  'gpt-5.4': '2026-03-05',
  'gpt-5.4-mini': '2026-03-17',
  'gpt-5.4-pro': '2026-03-05',
  'gpt-5.5': '2026-04-23',
  'gpt-5.5-pro': '2026-04-23',
  'gpt-5.6': '2026-07-09',
  'gpt-5.6-sol': '2026-07-09',
  'gpt-5.6-terra': '2026-07-09',
  'gpt-5.6-luna': '2026-07-09',
  'gpt-6-sol': '2026-09-22',
  'gpt-6-luna': '2026-09-22',
  'gpt-6-astra': '2026-09-04',
  'gpt-6.1-sol': '2026-09-29',
  'text-embedding-3-small': '2024-01-25',
  'text-embedding-3-large': '2024-01-25',
  'text-embedding-ada-002': '2022-12-15',
  'gpt-image-2': '2026-04-21',
};

export const OPENAI_MODEL_RULES: Rule[] = modelRules(rowsFrom(ROWS, OPENAI_DEPRECATIONS, RELEASED));

/** Any string that looks like an OpenAI model id: an unknown one is reviewed. */
// A prefix test (`model.startswith("gpt-image")`) names a family, not a model.
export const OPENAI_CANDIDATE =
  '(?<=["\'`=:\\s/])(?<!(?:startswith|startsWith|endswith|endsWith|includes)\\(["\'`])((?:gpt-[\\w.-]+|chatgpt-[\\w.-]+|o[1-9](?:-[\\w.-]+)?|text-(?:embedding|davinci|curie|babbage|moderation)-[\\w.-]+|whisper-[\\w.-]+|tts-[\\w.-]+|dall-e-[\\w.-]+|(?:davinci|babbage)-\\d+|omni-moderation-[\\w.-]+))(?=["\'`\\s,;)}\\]:]|$)';

export function openaiModelSlot(extra: Rule[] = []): Slot {
  return {
    id: 'model',
    label: 'Model',
    rules: [...OPENAI_MODEL_RULES, ...extra],
    candidate: OPENAI_CANDIDATE,
    candidateFlags: 'gm',
    absent: 'missing',
  };
}

/** Models that take no sampling parameter but the default (models.dev: `temperature: false`). */
const NO_TEMPERATURE = [
  'gpt-5', 'gpt-5-2025-08-07', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5-pro', 'gpt-5.2-pro', 'gpt-5.4-pro',
  'gpt-5.5', 'gpt-5.5-pro', 'gpt-5.6', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-6-sol',
  'gpt-6-luna', 'gpt-6-astra', 'gpt-6.1-sol', 'o1', 'o1-pro', 'o3', 'o3-mini', 'o3-pro', 'o4-mini',
];

/** Reasoning models: `max_tokens` is refused, `max_completion_tokens` is the length limit. */
const REASONING = [
  ...NO_TEMPERATURE, 'gpt-5.1', 'gpt-5.2', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'o1-mini', 'o1-preview',
];

const MODELS_DEV = 'https://models.dev/api.json#openai';
const API_REF = 'https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml';

export const OPENAI_PARAM_RULES: Rule[] = [
  {
    id: 'temperature-reasoning',
    label: 'temperature on a model that only takes the default',
    pattern: '(?<![\\w$])temperature["\']?\\s*[:=]\\s*(?!1(?:\\.0+)?(?![\\d.]))\\d',
    requiresAny: NO_TEMPERATURE.map((m) => `model.${m}`),
    fact: invalid(MODELS_DEV, {
      origin: 'okapi',
      note: 'models.dev lists temperature: false for these models; the API answers 400 unless it is the default (1). Okapi publishes it as "<model> rejects temperature" (gpt-5-mini, gpt-5-nano, gpt-5.5, o3-mini in production).',
    }),
  },
  {
    id: 'max-tokens-reasoning',
    label: 'max_tokens on a reasoning model',
    pattern: '(?<![\\w$])max_tokens["\']?\\s*[:=]',
    requiresAny: REASONING.map((m) => `model.${m}`),
    unless: ['params.responses-api'],
    fact: invalid(API_REF, {
      quote: 'This value is now deprecated in favor of max_completion_tokens, and is not compatible with',
      note: "Reasoning models answer 400 \"Unsupported parameter: 'max_tokens'… Use 'max_completion_tokens' instead.\"",
    }),
  },
  {
    id: 'max-tokens',
    label: 'max_tokens (deprecated for max_completion_tokens)',
    pattern: '(?<![\\w$])max_tokens["\']?\\s*[:=]',
    unless: ['params.max-tokens-reasoning', 'params.responses-api'],
    fact: deprecated('2024-09-12', API_REF, {
      quote: 'This value is now deprecated in favor of max_completion_tokens',
      note: "OpenAI's API reference (openapi.yaml), the chat completions max_tokens field.",
    }),
  },
  {
    id: 'functions',
    label: 'functions / function_call (deprecated for tools)',
    pattern: '(?<![\\w$])(?:functions|function_call)["\']?\\s*[:=]\\s*[\\[{"\']',
    fact: deprecated('2023-11-06', API_REF, { quote: 'Deprecated in favor of tools.', note: "OpenAI's API reference (openapi.yaml), the functions field." }),
  },
  {
    id: 'responses-api',
    label: 'Responses API',
    pattern: 'responses\\.(?:create|parse|stream)\\(|/v1/responses',
    fact: current('https://platform.openai.com/docs/api-reference/responses'),
  },
];

export function openaiParamSlot(): Slot {
  return { id: 'params', label: 'Request parameters', rules: OPENAI_PARAM_RULES, absent: 'ok' };
}

/** The `openai` Python SDK below 1.0: `openai.ChatCompletion.create` and friends. */
const PY_V0: Fact = invalid('https://raw.githubusercontent.com/openai/openai-python/main/src/openai/lib/_old_api.py', {
  origin: 'changelog',
  quote: 'but this is no longer supported in openai>=1.0.0',
  note: 'APIRemovedInV1 is raised unless the manifest pins openai<1.',
});

const PY_V0_PINNED: Fact = deprecated('2023-11-06', 'https://github.com/openai/openai-python/discussions/742', {
  origin: 'changelog',
  note: 'Pinned below 1.0: works against the API, on an SDK OpenAI no longer maintains.',
});

const NODE_V3: Fact = invalid('https://github.com/openai/openai-node/discussions/217', {
  origin: 'changelog',
  quote: 'v4 is a complete rewrite of the SDK',
  note: 'Configuration and OpenAIApi do not exist from openai v4 on.',
});

export const OPENAI_SDK_RULES: Rule[] = [
  {
    id: 'python-v0',
    label: 'openai.ChatCompletion / openai.Completion (SDK < 1.0)',
    pattern: 'openai\\.(?:ChatCompletion|Completion|Audio|Image|Embedding|Moderation)\\.(?:create|acreate|transcribe|translate)',
    sdk: { pkg: 'openai', breaksFrom: 1, pinned: PY_V0_PINNED },
    fact: PY_V0,
  },
  {
    id: 'node-v3',
    label: 'new OpenAIApi(new Configuration()) (SDK < 4)',
    pattern: 'new\\s+OpenAIApi\\s*\\(|createChatCompletion\\s*\\(|createCompletion\\s*\\(',
    sdk: { pkg: 'openai', breaksFrom: 4, pinned: { ...NODE_V3, outcome: 'keeps_working', announced: '2023-08-16' } },
    fact: NODE_V3,
  },
  {
    id: 'assistants',
    label: 'Assistants API (threads, runs)',
    pattern: 'beta\\.(?:assistants|threads)|/v1/(?:assistants|threads)|OpenAI-Beta["\']?\\s*:\\s*["\']assistants',
    fact: fails('2026-08-26', '2025-08-26', OPENAI_DEPRECATIONS, {
      quote: 'On August 26th, 2025, we notified developers using the Assistants API of its deprecation and removal from the API one year later, on August 26, 2026.',
      note: 'Migrate to the Responses API and Conversations API.',
    }),
  },
  {
    id: 'v1-sdk',
    label: 'OpenAI client (SDK ≥ 1.0)',
    pattern: '(?<![\\w$])(?:OpenAI|AsyncOpenAI|AzureOpenAI)\\s*\\(|new\\s+OpenAI\\s*\\(',
    fact: current('https://github.com/openai/openai-python'),
  },
];

export function openaiSdkSlot(): Slot {
  return { id: 'sdk', label: 'SDK usage', rules: OPENAI_SDK_RULES, absent: 'ok' };
}

export { word };
