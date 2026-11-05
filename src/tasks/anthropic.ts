import type { Task } from '../types.ts';
import { anthropicModelSlot, anthropicParamSlot, anthropicSdkSlot } from '../kb/anthropic.ts';


export const ANTHROPIC_TASKS: Task[] = [
  {
    id: 'anthropic-extract-py',
    title: 'Extract invoice fields with Claude',
    category: 'inference',
    provider: 'Anthropic',
    language: 'python',
    style: 'sdk',
    prompt:
      'Write a Python function that sends the text of an invoice to Claude and returns the vendor name, invoice date, total amount and currency as a dict. Make the output as deterministic as possible.',
    evidence: "Anthropic shut down claude-sonnet-4-20250514 on 2026-06-15, after the Claude 3.5 and 3.7 Sonnet models; claude-sonnet-4-5 retires on 2026-11-30. The Python SDK 1.0 removed sampling parameters such as temperature.",
    slots: [anthropicModelSlot(), anthropicParamSlot(), anthropicSdkSlot()],
  },
  {
    id: 'anthropic-thinking-ts',
    title: 'Claude with extended thinking, in TypeScript',
    category: 'inference',
    provider: 'Anthropic',
    language: 'typescript',
    style: 'sdk',
    prompt:
      "Write a TypeScript function that asks Claude to solve a scheduling puzzle given as text, with extended thinking enabled so it reasons before answering, and returns only Claude's final answer.",
    evidence: "Fixed thinking budgets (budget_tokens) return a 400 on Claude Opus 4.7 and later, and sampling parameters return a 400 on every model under API version 2026-10-21.",
    slots: [anthropicModelSlot(), anthropicParamSlot(), anthropicSdkSlot()],
  },
  {
    id: 'anthropic-cli-rust',
    title: 'A Claude CLI in Rust over raw HTTP',
    category: 'inference',
    provider: 'Anthropic',
    language: 'rust',
    style: 'rest',
    prompt:
      'Write a small Rust CLI (reqwest + serde) that sends the text given on stdin to the Claude Messages API over HTTP and prints the reply.',
    evidence: "Over raw HTTP the code picks the model id and the anthropic-version header itself: claude-sonnet-4-20250514 shut down on 2026-06-15 and claude-sonnet-4-5 retires on 2026-11-30.",
    slots: [anthropicModelSlot(), anthropicParamSlot(), anthropicSdkSlot()],
  },
];
