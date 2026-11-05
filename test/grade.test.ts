import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gradeAnswer } from '../src/grader/grade.ts';
import { maxMajor } from '../src/grader/manifest.ts';
import { knowable, statusOf, statusOn } from '../src/grader/status.ts';
import { taskById, validateTasks } from '../src/tasks/index.ts';

const py = (code: string, reqs = '') =>
  `Here you go.\n\n**main.py**\n\`\`\`python\n${code}\n\`\`\`\n${reqs ? `\n**requirements.txt**\n\`\`\`\n${reqs}\n\`\`\`\n` : ''}`;

test('the task set is valid', () => {
  assert.deepEqual(validateTasks(), []);
});

test('version ranges give their highest major', () => {
  assert.equal(maxMajor('^4.2.0'), 4);
  assert.equal(maxMajor('>=1.0,<2'), 1);
  assert.equal(maxMajor('==0.28.1'), 0);
  assert.equal(maxMajor('>=1.40.0'), Infinity);
  assert.equal(maxMajor(''), Infinity);
  assert.equal(maxMajor('~=1.2'), 1);
});

test('a dated retirement is broken past its day, at risk within six months, ok beyond', () => {
  const f = { outcome: 'fails' as const, source: 'x', origin: 'okapi' as const };
  assert.equal(statusOf({ ...f, effective: '2026-10-23' }), 'broken');
  assert.equal(statusOf({ ...f, effective: '2027-01-14' }), 'at_risk');
  assert.equal(statusOf({ ...f, effective: '2028-05-14' }), 'ok');
  assert.equal(statusOf({ ...f }), 'deprecated');
});

test('a change is knowable only when announced before the cutoff month', () => {
  const f = { outcome: 'fails' as const, source: 'x', origin: 'okapi' as const, announced: '2026-04-22' };
  assert.equal(knowable(f, '2026-05'), true);
  assert.equal(knowable(f, '2026-04'), false);
});

test('on a release day, a change counts only once it was public', () => {
  const f = { outcome: 'fails' as const, source: 'x', origin: 'okapi' as const, announced: '2026-10-14', effective: '2027-01-14' };
  assert.equal(statusOn(f, '2026-09-22'), 'ok');
  assert.equal(statusOn(f, '2026-10-20'), 'at_risk');
  assert.equal(statusOn({ ...f, announced: '2026-04-22', effective: '2026-10-23' }, '2026-09-22'), 'at_risk');
  assert.equal(statusOn({ ...f, announced: '2026-04-22', effective: '2026-07-24' }, '2026-09-22'), 'broken');
});

test('gpt-4o-mini is at risk, gpt-4 broken, gpt-5.5 fine', () => {
  const task = taskById('openai-summarize-py');
  const g = gradeAnswer(task, py('from openai import OpenAI\nclient = OpenAI()\nr = client.chat.completions.create(model="gpt-4o-mini", messages=[])'));
  assert.equal(g.verdict, 'at_risk');
  assert.equal(gradeAnswer(task, py('client.chat.completions.create(model="gpt-4", messages=[])')).verdict, 'broken');
  assert.equal(gradeAnswer(task, py('client = OpenAI()\nclient.responses.create(model="gpt-5.5", input="x")')).verdict, 'ok');
});

test('a model named only in a comment is not graded', () => {
  const task = taskById('openai-summarize-py');
  const g = gradeAnswer(task, py('# you could also use "gpt-4"\nclient.chat.completions.create(model="gpt-5.4", messages=[])'));
  assert.equal(g.verdict, 'ok');
});

test('temperature on gpt-5-mini is refused', () => {
  const task = taskById('openai-summarize-py');
  const g = gradeAnswer(task, py('client.chat.completions.create(model="gpt-5-mini", temperature=0.2, messages=[])'));
  assert.equal(g.verdict, 'broken');
  assert.ok(g.findings.some((f) => f.rule === 'temperature-reasoning'));
});

test('openai.ChatCompletion breaks on the current SDK but not when pinned below 1', () => {
  const task = taskById('openai-summarize-py');
  const code = 'import openai\nopenai.ChatCompletion.create(model="gpt-5.4", messages=[])';
  assert.equal(gradeAnswer(task, py(code)).verdict, 'broken');
  assert.equal(gradeAnswer(task, py(code, 'openai==0.28.1')).verdict, 'deprecated');
});

test('anthropic temperature breaks with the current Python SDK, works pinned below 1', () => {
  const task = taskById('anthropic-extract-py');
  const code = 'import anthropic\nclient = anthropic.Anthropic()\nclient.messages.create(model="claude-sonnet-4-6", max_tokens=500, temperature=0, messages=[])';
  assert.equal(gradeAnswer(task, py(code, 'anthropic>=0.40.0')).verdict, 'broken');
  assert.equal(gradeAnswer(task, py(code, 'anthropic==0.40.0')).verdict, 'ok');
});

test('an unknown model id is reported for review', () => {
  const task = taskById('openai-summarize-py');
  const g = gradeAnswer(task, py('client.chat.completions.create(model="gpt-7-turbo", messages=[])'));
  assert.equal(g.verdict, 'unknown');
  assert.equal(g.findings[0].label, 'gpt-7-turbo');
});

test('an answer that never names a model leaves the slot missing', () => {
  const g = gradeAnswer(taskById('openai-summarize-py'), py('print("hello")'));
  assert.equal(g.verdict, 'missing');
  assert.deepEqual(g.missing, ['model']);
});

test('Graph API versions: v18 redirected (at risk), v24 fine', () => {
  const task = taskById('facebook-page-post-node');
  const js = (url: string) => `\`\`\`javascript\nfetch("${url}")\n\`\`\``;
  assert.equal(gradeAnswer(task, js('https://graph.facebook.com/v18.0/me/feed')).verdict, 'at_risk');
  assert.equal(gradeAnswer(task, js('https://graph.facebook.com/v24.0/me/feed')).verdict, 'ok');
});

test('slack files_upload_v2 is fine and files_upload is broken', () => {
  const task = taskById('slack-upload-py');
  assert.equal(gradeAnswer(task, py('client.files_upload_v2(channel=c, file="r.csv")')).verdict, 'ok');
  assert.equal(gradeAnswer(task, py('client.files_upload(channels=c, file="r.csv")')).verdict, 'broken');
});

test('FastMCP from mcp.server.fastmcp breaks unless mcp is pinned below 2', () => {
  const task = taskById('mcp-server-py');
  const code = 'from mcp.server.fastmcp import FastMCP\nmcp = FastMCP("weather")';
  assert.equal(gradeAnswer(task, py(code, 'mcp[cli]>=1.2.0')).verdict, 'broken');
  assert.equal(gradeAnswer(task, py(code, 'mcp[cli]>=1.2.0,<2')).verdict, 'ok');
});

test('OpenWeather: q=<city> is deprecated on /data/2.5, fine on the Geocoding API', () => {
  const task = taskById('openweather-forecast-py');
  const geo = 'GEO = "https://api.openweathermap.org/geo/1.0/direct"\nW = "https://api.openweathermap.org/data/2.5/weather"\nrequests.get(GEO,\n    params={"q": city, "limit": 1})\nrequests.get(W, params={"lat": lat, "lon": lon})';
  assert.equal(gradeAnswer(task, py(geo)).verdict, 'ok');
  const direct = 'W = "https://api.openweathermap.org/data/2.5/weather"\nrequests.get(W,\n    params={"q": city, "appid": key})';
  assert.equal(gradeAnswer(task, py(direct)).verdict, 'deprecated');
});

test('Etherscan: a base URL and a request path still name the API version', () => {
  const task = taskById('etherscan-balance-php');
  const php = (path: string) => `\`\`\`php\n$client = new Client(['base_uri' => 'https://api.etherscan.io']);\n$r = $client->get('${path}', ['query' => $params]);\n\`\`\``;
  assert.equal(gradeAnswer(task, php('/api')).verdict, 'broken');
  const slash = "```php\n$client = new Client(['base_uri' => 'https://api.etherscan.io/']);\n$r = $client->get('api', ['query' => $q]);\n```";
  assert.equal(gradeAnswer(task, slash).verdict, 'broken');
  assert.equal(gradeAnswer(task, php('/v2/api')).verdict, 'ok');
});

test('Shopify LATEST_API_VERSION: 2025-07 under @shopify/shopify-api 11, gone from 12', () => {
  const task = taskById('shopify-products-node');
  const answer = (range: string) => `**package.json**\n\`\`\`json\n{"dependencies": {"@shopify/shopify-api": "${range}"}}\n\`\`\`\n\`\`\`js\nimport { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';\nconst shopify = shopifyApi({ apiVersion: LATEST_API_VERSION });\n\`\`\``;
  assert.equal(gradeAnswer(task, answer('^11.5.0')).verdict, 'at_risk');
  assert.equal(gradeAnswer(task, answer('^12.0.0')).verdict, 'broken');
});

test('OpenRouter: a free slug it no longer lists is not served; its free router is fine', () => {
  const task = taskById('openrouter-free-py');
  const py1 = (m: string) => py(`headers = {"Content-Type": "application/json"}\nMODEL = "${m}"`);
  assert.equal(gradeAnswer(task, py1('meta-llama/llama-3.1-8b-instruct:free')).verdict, 'broken');
  assert.equal(gradeAnswer(task, py1('openrouter/free')).verdict, 'ok');
});
