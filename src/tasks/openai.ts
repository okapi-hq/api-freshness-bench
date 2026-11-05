import type { Rule, Task } from '../types.ts';
import { deprecated, invalid } from '../kb/facts.ts';
import { OPENAI_MODEL_RULES, openaiModelSlot, openaiParamSlot, openaiSdkSlot } from '../kb/openai.ts';
import { rule, slot } from '../kb/rule.ts';

/** Go constants that name OpenAI models: sashabaranov/go-openai and the official openai-go. */
const GO_CONSTANTS: Record<string, string> = {
  GPT3Dot5Turbo: 'gpt-3.5-turbo',
  GPT4: 'gpt-4',
  GPT4Turbo: 'gpt-4-turbo',
  GPT4TurboPreview: 'gpt-4-turbo-preview',
  GPT4o: 'gpt-4o',
  GPT4oMini: 'gpt-4o-mini',
  GPT4Dot1: 'gpt-4.1',
  GPT4Dot1Mini: 'gpt-4.1-mini',
  GPT4Dot1Nano: 'gpt-4.1-nano',
  O1: 'o1',
  O1Mini: 'o1-mini',
  O3: 'o3',
  O3Mini: 'o3-mini',
  O4Mini: 'o4-mini',
  GPT5: 'gpt-5',
  GPT5Mini: 'gpt-5-mini',
  GPT5Nano: 'gpt-5-nano',
  ChatModelGPT3_5Turbo: 'gpt-3.5-turbo',
  ChatModelGPT4: 'gpt-4',
  ChatModelGPT4Turbo: 'gpt-4-turbo',
  ChatModelGPT4o: 'gpt-4o',
  ChatModelGPT4oMini: 'gpt-4o-mini',
  ChatModelGPT4_1: 'gpt-4.1',
  ChatModelGPT4_1Mini: 'gpt-4.1-mini',
  ChatModelGPT4_1Nano: 'gpt-4.1-nano',
  ChatModelO1: 'o1',
  ChatModelO3Mini: 'o3-mini',
  ChatModelO3: 'o3',
  ChatModelO4Mini: 'o4-mini',
  ChatModelGPT5: 'gpt-5',
  ChatModelGPT5Mini: 'gpt-5-mini',
  ChatModelGPT5Nano: 'gpt-5-nano',
  ChatModelGPT5_1: 'gpt-5.1',
  ChatModelGPT5_2: 'gpt-5.2',
};

function goConstantRules(): Rule[] {
  return Object.entries(GO_CONSTANTS).map(([name, id]) => {
    const model = OPENAI_MODEL_RULES.find((r) => r.id === id);
    if (!model) throw new Error(`no OpenAI model ${id}`);
    return rule(`go:${name}`, `${name} (${id})`, `(?:openai|shared)\\.${name}(?![\\w])`, model.fact);
  });
}

const GO_F = rule(
  'go-f-helper',
  'openai.F(…) field wrappers (openai-go before 1.0)',
  'openai\\.F\\(',
  invalid('https://github.com/openai/openai-go/blob/main/MIGRATION.md', {
    origin: 'changelog',
    quote: 'To reduce verbosity, the `openai.F(...)` and `param.Field[T]` have been removed.',
    announced: '2025-05-19',
  }),
  {
    sdk: {
      pkg: 'github.com/openai/openai-go',
      breaksFrom: 1,
      pinned: deprecated('2025-05-19', 'https://github.com/openai/openai-go/blob/main/MIGRATION.md', { origin: 'changelog' }),
    },
  },
);


export const OPENAI_TASKS: Task[] = [
  {
    id: 'openai-summarize-py',
    title: 'Summarize a text file with OpenAI',
    category: 'inference',
    provider: 'OpenAI',
    language: 'python',
    style: 'sdk',
    prompt:
      'Write a Python command-line tool that reads a text file given as an argument and prints a three-bullet summary of it, using the OpenAI API.',
    evidence: "OpenAI retires gpt-4o-mini and gpt-4o on 2027-01-14 and shut down gpt-4 and gpt-3.5-turbo on 2026-10-23. Reasoning models such as gpt-5-mini reject a custom temperature. All of them turn up in repositories Okapi monitors.",
    slots: [openaiModelSlot(), openaiParamSlot(), openaiSdkSlot()],
  },
  {
    id: 'openai-support-assistant-ts',
    title: 'Support assistant over PDF manuals with OpenAI',
    category: 'inference',
    provider: 'OpenAI',
    language: 'typescript',
    style: 'sdk',
    prompt:
      "Build a Node.js (TypeScript) customer-support assistant with OpenAI. It answers questions from a set of PDF manuals that I upload once, and it keeps each user's conversation history between requests. Expose it as an Express POST /ask endpoint.",
    evidence: "OpenAI shut down the Assistants API (/v1/assistants, /v1/threads) on 2026-08-26. The chat models this kind of app reaches for, gpt-4o-mini and gpt-4o, retire on 2027-01-14.",
    slots: [openaiSdkSlot(), openaiModelSlot(), openaiParamSlot()],
  },
  {
    id: 'openai-transcribe-node',
    title: 'Transcribe an audio file with OpenAI',
    category: 'inference',
    provider: 'OpenAI',
    language: 'javascript',
    style: 'sdk',
    prompt:
      "Write a Node.js script that transcribes an MP3 file to text with OpenAI's speech-to-text API and writes the transcript next to the audio file.",
    evidence: "OpenAI announced on 2026-08-26 that whisper-1 and the gpt-4o transcription models retire on 2027-02-26. whisper-1 is among the breaking changes Okapi finds most often.",
    slots: [openaiModelSlot(), openaiSdkSlot()],
  },
  {
    id: 'openai-image-py',
    title: 'Generate an image with OpenAI',
    category: 'inference',
    provider: 'OpenAI',
    language: 'python',
    style: 'sdk',
    prompt:
      "Write a Python function that generates a 1024x1024 product illustration from a text prompt with OpenAI's image generation API and saves it as a PNG file.",
    evidence: "OpenAI shut down dall-e-3 on 2026-05-12 and gpt-image-1 on 2026-10-23.",
    slots: [openaiModelSlot(), openaiSdkSlot()],
  },
  {
    id: 'openai-commit-go',
    title: 'Commit messages from a diff with OpenAI, in Go',
    category: 'inference',
    provider: 'OpenAI',
    language: 'go',
    style: 'sdk',
    prompt:
      'Write a Go CLI that reads the output of `git diff --staged` and asks OpenAI to write a conventional commit message for it, then prints the message.',
    evidence: "openai-go 1.0 removed the openai.F helpers older Go examples use, and the chat models Go code usually names, gpt-4o-mini and gpt-4o, retire on 2027-01-14.",
    slots: [openaiModelSlot(goConstantRules()), openaiParamSlot(), slot('go-sdk', 'Go SDK', [GO_F])],
  },
];
