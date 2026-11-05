import assert from 'node:assert/strict';
import { test } from 'node:test';
import { expandConstants } from '../src/grader/expand.ts';
import { extractBlocks, readAnswer, stripComments } from '../src/grader/extract.ts';
import { gradeAnswer } from '../src/grader/grade.ts';
import { dependencyFindings, wantedPackages, type Cache } from '../src/grader/registry.ts';
import { taskById } from '../src/tasks/index.ts';

test('a base URL constant is inlined where the code uses it', () => {
  const js = "const API = 'https://api.spotify.com/v1';\nawait fetch(`${API}/recommendations?seed=1`);";
  assert.match(expandConstants(js), /https:\/\/api\.spotify\.com\/v1\/recommendations/);
  const py = 'class C:\n    BASE_URL = "https://api.linkedin.com/v2"\n    def f(self):\n        u = f"{self.BASE_URL}/organizationalEntityFollowerStatistics"';
  assert.match(expandConstants(py), /api\.linkedin\.com\/v2\/organizationalEntityFollowerStatistics/);
  assert.match(expandConstants('BASE = "https://x.io/v3"\nurl = BASE + "/latest"'), /"https:\/\/x\.io\/v3\/latest"/);
});

test('a prompt in triple quotes is not a docstring: the code after it stays', () => {
  const py = 'def f():\n    """Doc."""\n    PROMPT = """Classify as "positive" or "negative".\n"""\n    client.create(model="gemini-3.8-flash")\n\ndef g():\n    """Doc."""';
  const out = stripComments('python', py);
  assert.match(out, /gemini-3\.8-flash/);
  assert.doesNotMatch(out, /Doc\./);
});

test('comments go, URLs stay', () => {
  assert.equal(stripComments('js', 'fetch("https://a.b/c") // old: gpt-4').trim(), 'fetch("https://a.b/c")');
  assert.equal(stripComments('python', 'x = "#not a comment"  # a comment').trim(), 'x = "#not a comment"');
});

test('file names, manifests and env files are told apart', () => {
  const answer = [
    '**package.json**', '```json', '{"dependencies": {"openai": "^4.20.0"}}', '```',
    '**.env.example**', '```', 'OPENAI_API_KEY=sk-...', '```',
    '**requirements.txt**', '```', 'anthropic>=0.40,<1', '```',
    '```bash', 'pip install -r requirements.txt', 'npm install && npm start', '```',
  ].join('\n');
  const blocks = extractBlocks(answer);
  assert.deepEqual(blocks.map((b) => [b.file, b.manifest]), [['package.json', true], ['.env.example', false], ['requirements.txt', true], [null, false]]);
  const names = wantedPackages(blocks).map((w) => w.name).sort();
  assert.deepEqual(names, ['anthropic', 'openai']);
});

test('a manifest named in prose above a code block does not name the block', () => {
  const answer = [
    '**requirements.txt**', '```', 'requests==2.31.0', '```',
    '3. Install dependencies: `pip install -r requirements.txt`', '', '```python', 'from weather import forecast', 'print(forecast("Paris"))', '```',
    'Then the manifest, requirements.txt:', '```python', 'import os', '```',
  ].join('\n');
  const blocks = extractBlocks(answer);
  assert.deepEqual(blocks.map((b) => [b.file, b.manifest]), [['requirements.txt', true], [null, false], [null, false]]);
  assert.deepEqual(wantedPackages(blocks).map((w) => w.name), ['requests']);
});

test('a package on no registry is a hallucinated, broken dependency', () => {
  const blocks = extractBlocks('```json\n{"dependencies": {"@modelcontextprotocol/server-linear": "^1.0.0"}}\n```');
  const cache: Cache = { 'npm:@modelcontextprotocol/server-linear': { exists: false, readAt: '2026-10-24' } };
  const [f] = dependencyFindings(blocks, cache);
  assert.equal(f.verdict, 'broken');
});

test('an A2A client that speaks no A2A is broken', () => {
  const g = gradeAnswer(taskById('a2a-client-ts'), '```ts\nawait fetch(card.endpoints.message, { method: "POST", body: JSON.stringify({ text }) });\n```');
  assert.equal(g.verdict, 'broken');
});

test('shell blocks that run the program are not graded as code', () => {
  const { code } = readAnswer('```python\nmodel = "gpt-5.4"\n```\n```sh\npython app.py --model gpt-4\n```');
  assert.doesNotMatch(code, /gpt-4\b/);
});
