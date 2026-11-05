import type { Task } from '../types.ts';
import { current, deprecated, fails } from '../kb/facts.ts';
import { geminiModelSlot, geminiSdkSlot } from '../kb/google.ts';
import { deepseekModelSlot, groqModelSlot, xaiModelSlot } from '../kb/inference.ts';
import { openrouterModelSlot } from '../kb/openrouter.ts';
import { required, rule, slot } from '../kb/rule.ts';

const FIREBASE_AI = 'https://firebase.google.com/docs/ai-logic/migrate-to-latest-sdk';
const HF_PROVIDERS = 'https://huggingface.co/docs/inference-providers/index';
const ASSEMBLY = 'https://www.assemblyai.com/changelog';

const kotlinSdk = slot('android-sdk', 'Android SDK', [
  rule(
    'firebase-vertexai',
    'Vertex AI in Firebase (firebase-vertexai)',
    'firebase-vertexai|com\\.google\\.firebase\\.vertexai|Firebase\\.vertexAI',
    deprecated('2025-05-20', FIREBASE_AI, {
      origin: 'provider',
      note: 'Renamed Firebase AI Logic: move to com.google.firebase:firebase-ai.',
    }),
  ),
  rule('firebase-ai', 'Firebase AI Logic (firebase-ai)', 'firebase-ai|com\\.google\\.firebase\\.ai|Firebase\\.ai\\(', current(FIREBASE_AI)),
]);

const hfEndpoint = required('endpoint', 'Inference endpoint', [
  rule(
    'api-inference',
    'api-inference.huggingface.co (serverless Inference API)',
    'api-inference\\.huggingface\\.co',
    fails('2026-10-20', undefined, HF_PROVIDERS, {
      origin: 'okapi',
      note: 'The host no longer resolves (Okapi host check, 2026-10-20); Inference Providers serve from router.huggingface.co.',
    }),
  ),
  rule('router', 'router.huggingface.co (Inference Providers)', 'router\\.huggingface\\.co', current(HF_PROVIDERS)),
  rule('inference-client', 'huggingface_hub InferenceClient', 'InferenceClient\\s*\\(', current(HF_PROVIDERS)),
]);

const assemblyParams = slot('params', 'Request parameters', [
  rule(
    'summarization',
    'summarization / summary_model (legacy Summarization)',
    '(?<![\\w])(?:summarization|summary_model|summary_type)["\']?\\s*[:=]',
    fails('2026-10-20', '2026-10-06', ASSEMBLY, {
      quote: 'The legacy Summarization model (the top-level summarization boolean and summary_model parameter) and the legacy Auto Chapters model are deprecated.',
      note: 'Use Summarization under Speech Understanding (speech_understanding.request.summarization).',
    }),
  ),
  rule(
    'auto-chapters',
    'auto_chapters (legacy Auto Chapters)',
    '(?<![\\w])auto_?[cC]hapters["\']?\\s*[:=]',
    fails('2026-10-20', '2026-10-06', ASSEMBLY, { note: 'Use Summarization under Speech Understanding.' }),
  ),
  rule(
    'lemur',
    'LeMUR (/lemur/v3)',
    '/lemur/v3|\\.lemur\\.|lemur\\.(?:task|summary|questionAnswer)',
    fails('2026-03-31', '2025-11-18', ASSEMBLY, {
      quote: 'LeMUR will be deprecated on March 31, 2026 and will no longer work after this date.',
      note: 'Migrate to the LLM Gateway.',
    }),
  ),
  rule(
    'speech-model',
    'speech_model (single model)',
    '(?<![\\w])speech_?[mM]odel["\']?\\s*[:=]',
    deprecated('2026-07-10', ASSEMBLY, {
      quote: 'Passing a current model name ( universal-2 , universal-3-5-pro ) to the async speech_model field now returns a 400.',
      note: 'Send speech_models (a list) instead.',
    }),
  ),
]);

export const INFERENCE_TASKS: Task[] = [
  {
    id: 'gemini-classify-py',
    title: 'Classify reviews with Gemini',
    category: 'inference',
    provider: 'Google Gemini',
    language: 'python',
    style: 'sdk',
    prompt:
      'Write a Python script that sends a list of customer reviews to the Gemini API, classifies each as positive, negative or neutral, and prints a JSON summary of the counts.',
    evidence: "Google shut down gemini-2.0-flash on 2026-06-01, after the Gemini 1.5 models. The google-generativeai package is deprecated in favor of google-genai.",
    slots: [geminiModelSlot(), geminiSdkSlot()],
  },
  {
    id: 'gemini-embed-ts',
    title: 'Semantic search with Gemini embeddings',
    category: 'inference',
    provider: 'Google Gemini',
    language: 'typescript',
    style: 'sdk',
    prompt:
      'Write a TypeScript module that embeds a list of product descriptions with the Gemini API and returns the three closest to a search query by cosine similarity.',
    evidence: "Google shut down text-embedding-004 on 2026-01-14, and @google/generative-ai is deprecated in favor of @google/genai.",
    slots: [geminiModelSlot(), geminiSdkSlot()],
  },
  {
    id: 'gemini-android-kotlin',
    title: 'Gemini in an Android app, in Kotlin',
    category: 'inference',
    provider: 'Google Gemini',
    language: 'kotlin',
    style: 'sdk',
    prompt:
      "Write an Android ViewModel in Kotlin that sends the user's question to Gemini and exposes the streamed answer as a StateFlow<String>, with the Gradle dependencies it needs.",
    evidence: "Google deprecated its Google AI client SDK for Android (com.google.ai.client.generativeai) on 2025-02-06; Android apps now go through Firebase AI Logic.",
    slots: [geminiModelSlot(), geminiSdkSlot(), kotlinSdk],
  },
  {
    id: 'groq-chat-nextjs',
    title: 'Streaming chatbot route on Groq',
    category: 'inference',
    provider: 'Groq',
    language: 'typescript',
    style: 'sdk',
    prompt: 'Add a Next.js App Router API route that streams chat completions from Groq for a fast chatbot.',
    evidence: "Groq stopped serving llama-3.1-8b-instant and llama-3.3-70b-versatile on its free and developer tiers on 2026-08-16.",
    slots: [groqModelSlot()],
  },
  {
    id: 'openrouter-free-py',
    title: 'A chatbot on a free OpenRouter model',
    category: 'inference',
    provider: 'OpenRouter',
    language: 'python',
    style: 'rest',
    prompt: "Write a small Python chatbot for the terminal that talks to a free model through OpenRouter's API and keeps the conversation history.",
    evidence: "OpenRouter drops free model variants often. On 2026-10-24 it listed 469 models, 17 of them free, and answered that any other id does not exist.",
    slots: [openrouterModelSlot()],
  },
  {
    id: 'deepseek-py',
    title: 'Ask DeepSeek a coding question',
    category: 'inference',
    provider: 'DeepSeek',
    language: 'python',
    style: 'sdk',
    prompt: "Write a Python script that sends a coding question to DeepSeek's API and prints the answer, streaming tokens as they arrive.",
    evidence: "DeepSeek retired the deepseek-chat and deepseek-reasoner names on 2026-07-24, three months after announcing it.",
    slots: [deepseekModelSlot()],
  },
  {
    id: 'hf-sentiment-py',
    title: 'Hosted sentiment analysis on Hugging Face',
    category: 'inference',
    provider: 'Hugging Face',
    language: 'python',
    style: 'rest',
    prompt:
      "Write a Python script that runs sentiment analysis on a list of product reviews with a model hosted on Hugging Face, calling Hugging Face's hosted inference over HTTP with requests (no local model).",
    evidence: "Hugging Face's serverless Inference API host, api-inference.huggingface.co, no longer resolves; hosted inference now goes through its router.",
    slots: [hfEndpoint],
  },
  {
    id: 'xai-grok-py',
    title: 'One-line summaries with xAI Grok',
    category: 'inference',
    provider: 'xAI',
    language: 'python',
    style: 'sdk',
    prompt: "Write a Python script that sends a list of headlines to xAI's Grok API and prints a witty one-line summary.",
    evidence: "xAI shut down grok-2 on 2026-10-14 and answers older grok-3 and grok-4 ids from newer models.",
    slots: [xaiModelSlot()],
  },
  {
    id: 'assemblyai-podcast-node',
    title: 'Podcast transcript, summary and chapters with AssemblyAI',
    category: 'inference',
    provider: 'AssemblyAI',
    language: 'javascript',
    style: 'sdk',
    prompt:
      'Write a Node.js script that transcribes a podcast episode from its URL with AssemblyAI and also produces a short summary and chapter markers with timestamps.',
    evidence: "AssemblyAI stopped its legacy Summarization and Auto Chapters on 2026-10-20, and LeMUR on 2026-03-31.",
    slots: [assemblyParams],
  },
];
