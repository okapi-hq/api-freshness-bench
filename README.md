# Okapi Bench

Do AI models write API integrations that still work?

Okapi Bench asks a model for 48 small integrations with third-party APIs, then checks every model id, endpoint, SDK call and API version in its code against the breaking changes [Okapi](https://okapi.bot/?utm_source=okapi-bench&utm_medium=github&utm_content=readme-top) tracks. The models run on [Kaggle](https://www.kaggle.com/benchmarks), which serves them all the same way. This repository holds the tasks, the facts they're graded against and the grader, so you can check how every verdict was reached.

Made by [Okapi](https://okapi.bot/?utm_source=okapi-bench&utm_medium=github&utm_content=readme-top), a GitHub app that opens a pull request when an API your code calls is retired or changed.

## How it works

Each task is a short request, written the way a developer would ask: "Write a Python command-line tool that reads a text file given as an argument and prints a three-bullet summary of it, using the OpenAI API." It names the provider but never a version, so the model picks the model id, the endpoint and the SDK. The 48 tasks cover 15 kinds of API (AI inference, messaging, payments, crypto, data, agent protocols and more) in 9 languages, through SDKs, raw HTTP, MCP and A2A. Every model gets the same system prompt ([src/prompt.ts](src/prompt.ts)), the same date line and up to 32,000 output tokens, reasoning included. That's more than any answer has needed so far.

The grader reads the code blocks and the dependency manifests in the answer, comments left out. It finds the values each task cares about and looks each one up in a knowledge base of breaking changes. Every fact there has a source, usually a quote from it, the day it was announced and the day it takes effect. A pinned old SDK keeps the old API working; an unpinned one installs today's release. Packages the answer installs are looked up on npm and PyPI: one that doesn't exist fails the install.

An answer is broken if something in it fails today, at risk if something stops or gets redirected within six months, deprecated if something is deprecated with no end date yet, and clean otherwise. One dead call breaks an integration, so an answer gets the worst of its values. On Kaggle, a task passes when the answer is clean; an answer that never makes the call the task asks for fails. A value the knowledge base doesn't list (a model id nobody catalogued) doesn't fail the task: every failure points to a source.

The knowledge base is dated. This edition judges the code as of October 24, 2026.

## What's in here

- `src/tasks`: the 48 tasks, with the values each one recognizes and the fact behind each value.
- `src/kb`: shared facts, such as each AI provider's models and their retirement dates. `npm run kb:check` fetches every source and checks its quote is still on the page.
- `src/grader`: the grader, in TypeScript.
- `kaggle/grader`: the same grader in Python, which is what runs on Kaggle. It gives the same verdict and the same findings as the TypeScript one on every answer we've compared, and the tests hold it to that.
- `kaggle/tasks.json`: the tasks as JSON, exported from `src/tasks`.
- `kaggle/build.py`: writes one Kaggle task per benchmark task. Each file carries its prompt, its facts and the whole grader, so what runs on Kaggle can be read on Kaggle.
- `kaggle/queue_runs.py`: runs every task on every model, a few at a time, within Kaggle's daily quota. `kaggle/reserves.py` works out what Kaggle holds back for each model's requests, so the queue can spend the whole quota. `kaggle/collect.py` downloads the answers as JSONL for the TypeScript grader.

## Run it

You need Node 24 or later and Python 3.12 or later.

```sh
npm install
npm test                     # TypeScript and Python tests
npm run kaggle:build         # kaggle/build/api-freshness-<task>.py
kaggle benchmarks tasks push api-freshness-openai-summarize-py -f kaggle/build/api-freshness-openai-summarize-py.py
kaggle benchmarks tasks run api-freshness-openai-summarize-py -m gemini-3.8-flash
```

To grade answers you got elsewhere, put them in a JSONL file, one `{"id", "task", "answer"}` per line, and run `npm run grade -- --in answers.jsonl --out graded.jsonl`.

To add a task, add it to a file in `src/tasks` with the current values and the stale ones, a source for each fact, and a quote when the source states it. Run `npm run kaggle:build`, then run the task on a few models. Every value the grader can't place comes back as `unknown`, for review.

## Limits

The tasks come from APIs that changed, so a score shows how a model handles churn, not how often a random integration breaks. Answers are single-turn, with no tools and no execution: an agent that runs its code or reads the docs would catch some of what fails here. Regular expressions read the code, so a value written in an unusual way can slip through. A model id or endpoint the knowledge base doesn't list is never counted against the model. One answer per task and model gives a margin of about fifteen points either way on a model's score.

## License

MIT.

## About Okapi

[Okapi](https://okapi.bot/?utm_source=okapi-bench&utm_medium=github&utm_content=readme-about) watches the third-party API calls in your repositories and opens a pull request when a provider retires or changes one. Its knowledge base is the one behind this benchmark, kept up to date. [Try it on your repositories](https://okapi.bot/?utm_source=okapi-bench&utm_medium=github&utm_content=readme-about) or [browse the breaking changes it tracks](https://okapi.bot/breaking-changes?utm_source=okapi-bench&utm_medium=github&utm_content=readme-about).
