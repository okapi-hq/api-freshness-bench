import type { Task } from '../types.ts';
import { current, deprecated, invalid } from '../kb/facts.ts';
import { required, rule } from '../kb/rule.ts';

const MCP_SPEC = 'https://modelcontextprotocol.io/specification/2026-07-28/changelog';
const MCP_PY_V2 = 'https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/main/docs/migration.md';
const LINEAR_MCP = 'https://linear.app/docs/mcp';
const A2A_V1 = 'https://a2a-protocol.org/latest/whats-new-v1/';
const A2A_JS = 'https://raw.githubusercontent.com/a2aproject/a2a-js/main/docs/migration-guide.md';

const sseTransport = deprecated('2025-03-26', MCP_SPEC, {
  quote: 'Reclassify the HTTP+SSE transport (deprecated since protocol version',
  note: 'Connect over Streamable HTTP at the endpoint the server documents (usually /mcp).',
});

const mcpV2 = (quote: string) =>
  invalid(MCP_PY_V2, { origin: 'changelog', quote, announced: '2026-07-28', note: 'mcp 2.0.0 was released on 2026-07-28; pin mcp<2 or follow the migration guide.' });

export const PROTOCOL_TASKS: Task[] = [
  {
    id: 'mcp-client-ts',
    title: 'MCP client in TypeScript for a remote server',
    category: 'protocol',
    provider: 'Model Context Protocol',
    language: 'typescript',
    style: 'mcp',
    prompt:
      'Write a TypeScript script that connects to the remote MCP server at https://tools.example.com, lists its tools, and calls the `search` tool with a query.',
    evidence: "The MCP specification of 2025-03-26 deprecated the HTTP+SSE transport for Streamable HTTP, and Okapi still finds SSE clients in the repositories it monitors.",
    slots: [
      required('transport', 'MCP transport', [
        rule('sse', 'SSEClientTransport (HTTP+SSE)', 'SSEClientTransport', sseTransport),
        rule('streamable-http', 'StreamableHTTPClientTransport', 'StreamableHTTPClientTransport', current(MCP_SPEC)),
        rule(
          'invented-http-transport',
          'HttpClientTransport (no such class in the MCP SDK)',
          '(?<![\\w])HttpClientTransport|sdk/client/http\\.js',
          invalid('https://github.com/modelcontextprotocol/typescript-sdk', { origin: 'provider', note: 'The SDK has StreamableHTTPClientTransport (client/streamableHttp.js) and SSEClientTransport; the import fails.' }),
        ),
      ]),
    ],
  },
  {
    id: 'mcp-client-py',
    title: 'MCP client in Python for a remote server',
    category: 'protocol',
    provider: 'Model Context Protocol',
    language: 'python',
    style: 'mcp',
    prompt:
      'Write a Python script with the official MCP SDK that connects to the remote MCP server at https://tools.example.com, lists its tools and calls the `search` tool.',
    evidence: "The MCP Python SDK 2.0 (2026-07-28) removed streamablehttp_client, and the HTTP+SSE transport is deprecated.",
    slots: [
      required('transport', 'MCP transport', [
        rule('sse-client', 'sse_client (HTTP+SSE)', '(?<![\\w])sse_client\\b', sseTransport),
        rule(
          'streamablehttp-client',
          'streamablehttp_client (removed in mcp 2.0)',
          '(?<![\\w])streamablehttp_client\\b',
          mcpV2('streamablehttp_client removed'),
          { sdk: { pkg: 'mcp', breaksFrom: 2, pinned: current(MCP_PY_V2) } },
        ),
        rule('streamable-http-client', 'streamable_http_client', '(?<![\\w])streamable_http_client\\b', current(MCP_PY_V2)),
        rule(
          'invented-python-client',
          'SSEClientTransport / HttpClientTransport / AsyncClientSession (not in the Python SDK)',
          '(?<![\\w])(?:SSEClientTransport|HttpClientTransport|AsyncClientSession)(?![\\w])',
          invalid(MCP_PY_V2, { origin: 'provider', note: 'The Python SDK connects with sse_client or streamable_http_client and ClientSession; these names do not exist, the import fails.' }),
        ),
        rule('client-class', 'mcp Client (2.x)', 'from mcp import Client|from mcp\\.client import Client', current(MCP_PY_V2)),
      ]),
    ],
  },
  {
    id: 'mcp-server-py',
    title: 'MCP server in Python',
    category: 'protocol',
    provider: 'Model Context Protocol',
    language: 'python',
    style: 'mcp',
    prompt: 'Write an MCP server in Python that exposes a `get_forecast(city)` tool (use a placeholder forecast) and runs over stdio, with its requirements.',
    evidence: "The MCP Python SDK 2.0 (2026-07-28) renamed FastMCP to MCPServer: importing mcp.server.fastmcp raises ModuleNotFoundError.",
    slots: [
      required('server', 'Server class', [
        rule(
          'fastmcp-v1',
          'from mcp.server.fastmcp import FastMCP (removed in mcp 2.0)',
          'mcp\\.server\\.fastmcp',
          mcpV2('Importing mcp.server.fastmcp, or anything below it, raises ModuleNotFoundError'),
          { sdk: { pkg: 'mcp', breaksFrom: 2, pinned: current(MCP_PY_V2) } },
        ),
        rule('mcpserver-v2', 'from mcp.server.mcpserver import MCPServer', 'mcp\\.server\\.mcpserver|MCPServer\\s*\\(', current(MCP_PY_V2)),
        rule('fastmcp-standalone', 'fastmcp (standalone package)', 'from fastmcp import|import fastmcp', current('https://github.com/PrefectHQ/fastmcp')),
        rule('lowlevel-server', 'mcp.server.lowlevel Server', 'mcp\\.server\\.lowlevel|from mcp\\.server import Server', current(MCP_PY_V2)),
      ]),
    ],
  },
  {
    id: 'mcp-linear-config',
    title: "Connect a coding agent to Linear's MCP server",
    category: 'protocol',
    provider: 'Linear MCP',
    language: 'json',
    style: 'mcp',
    prompt: "Give me the MCP configuration (mcp.json) to connect Cursor to Linear's official remote MCP server.",
    evidence: "Linear serves MCP at https://mcp.linear.app/mcp; its /sse endpoint is a deprecated fallback.",
    slots: [
      required('url', 'Server URL', [
        rule('linear-sse', 'https://mcp.linear.app/sse', 'mcp\\.linear\\.app/sse', deprecated(undefined, LINEAR_MCP, {
          quote: 'The SSE endpoint at https://mcp.linear.app/sse is a deprecated fallback for clients that do not support Streamable HTTP.',
          announced: '2025-03-26',
          note: 'The MCP specification of 2025-03-26 replaced the HTTP+SSE transport with Streamable HTTP.',
        })),
        rule('linear-mcp', 'https://mcp.linear.app/mcp', 'mcp\\.linear\\.app/mcp', current(LINEAR_MCP)),
        rule(
          'linear-b',
          '@linear-b/mcp (no such package; LinearB is another company)',
          '@linear-b/mcp',
          invalid('https://www.npmjs.com/package/@linear-b/mcp', { origin: 'registry', note: 'npm answers 404 for this name.' }),
        ),
        rule(
          'hallucinated-server-linear',
          '@modelcontextprotocol/server-linear (no such package)',
          '@modelcontextprotocol/server-linear',
          invalid('https://www.npmjs.com/package/@modelcontextprotocol/server-linear', {
            origin: 'registry',
            note: 'npm answers 404 for this name: npx fails, and anyone could publish it.',
          }),
        ),
      ]),
    ],
  },
  {
    id: 'a2a-client-ts',
    title: 'Send a task to a remote A2A agent',
    category: 'protocol',
    provider: 'Agent2Agent Protocol',
    language: 'typescript',
    style: 'a2a',
    prompt:
      'Write a TypeScript client that sends a text message to a remote A2A (Agent2Agent protocol) agent whose agent card is at https://agent.example.com/.well-known/agent-card.json, and prints the reply.',
    evidence: "A2A 1.0 renamed the v0.3 methods (message/send), and @a2a-js/sdk 1.0 removed A2AClient.fromCardUrl (2026-07-22).",
    slots: [
      required('client', 'A2A client and methods', [
        rule(
          'a2a-client-legacy',
          'A2AClient / fromCardUrl (removed in @a2a-js/sdk 1.0)',
          'A2AClient\\.fromCardUrl|new\\s+A2AClient\\s*\\(',
          invalid(A2A_JS, { origin: 'changelog', quote: '`A2AClient` was deprecated in v0.3 in favor of `ClientFactory` and `Client`', announced: '2026-07-22' }),
          { sdk: { pkg: '@a2a-js/sdk', breaksFrom: 1, pinned: deprecated('2025-08-01', A2A_JS, { origin: 'changelog' }) } },
        ),
        rule('message-send-v03', "v0.3 method names (message/send)", "['\"]message/(?:send|stream)['\"]|['\"]tasks/(?:get|cancel)['\"]", deprecated('2026-03-12', A2A_V1, {
          quote: 'RENAMED: Operation now SendMessage',
          note: 'A2A 1.0 renamed the v0.3 methods.',
        })),
        rule('client-factory', 'ClientFactory (1.0)', 'ClientFactory', current(A2A_JS)),
        rule('send-message-v1', 'SendMessage (1.0 names)', "['\"]SendMessage['\"]", current(A2A_V1)),
      ], { absent: 'broken', absentNote: 'speaks no A2A: neither an A2A SDK nor an A2A JSON-RPC method' }),
    ],
  },
];
