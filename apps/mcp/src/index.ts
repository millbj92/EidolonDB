#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

type ApiEnvelope<T> = {
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
};

type Config = {
  url: string;
  apiKey?: string;
  tenant: string;
};

const config: Config = {
  url: process.env['EIDOLONDB_URL'] ?? 'http://localhost:3000',
  apiKey: process.env['EIDOLONDB_API_KEY'],
  tenant: process.env['EIDOLONDB_TENANT'] ?? 'default',
};

const server = new McpServer({
  name: '@eidolondb/mcp',
  version: '0.1.0',
});

function getHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-tenant-id': config.tenant,
    ...(extra ?? {}),
  };

  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  return headers;
}

function textResult(text: string) {
  return {
    content: [{ type: 'text' as const, text }],
  };
}

function normalizeImportance(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toFixed(2);
  }
  return 'N/A';
}

function memoryLine(memory: unknown): string {
  if (!memory || typeof memory !== 'object') {
    return '- [unknown] (importance: N/A) Invalid memory payload';
  }

  const item = memory as Record<string, unknown>;
  const tier = typeof item['tier'] === 'string' ? item['tier'] : 'unknown';
  const content = typeof item['content'] === 'string' ? item['content'] : '[no content]';
  const importance = normalizeImportance(item['importanceScore']);
  return `- [${tier}] (importance: ${importance}) ${content}`;
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const maybeError = (payload as { error?: { message?: unknown } }).error;
    if (maybeError && typeof maybeError.message === 'string') {
      return maybeError.message;
    }
  }
  return fallback;
}

function isReachabilityError(error: unknown): boolean {
  return error instanceof TypeError;
}

async function requestEidolonDB<T>(
  path: string,
  init: RequestInit,
  unreachableHint = true
): Promise<T> {
  const url = `${config.url.replace(/\/+$/, '')}${path}`;

  try {
    const response = await fetch(url, init);
    const raw = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;

    if (!response.ok) {
      const message = extractErrorMessage(raw, `Request failed with status ${response.status}`);
      throw new Error(message);
    }

    if (raw && 'data' in raw && raw.data !== undefined) {
      return raw.data;
    }

    return raw as unknown as T;
  } catch (error) {
    if (unreachableHint && isReachabilityError(error)) {
      throw new Error(`EidolonDB is not reachable at ${config.url}. Check your EIDOLONDB_URL environment variable.`);
    }
    throw error;
  }
}

const tierSchema = z.enum(['short_term', 'episodic', 'semantic']);
const sourceSchema = z.enum(['chat', 'note', 'event', 'document', 'system']);

server.tool(
  'remember',
  'Store a memory in EidolonDB. Use this to persist important facts, decisions, or context across sessions.',
  {
    content: z.string().min(1).describe('The memory content to store'),
    tier: tierSchema.default('episodic').describe('Memory tier'),
    importance: z.number().min(0).max(1).default(0.7).describe('Importance score'),
    tags: z.array(z.string()).optional().describe('Tags for categorization'),
  },
  async ({ content, tier, importance, tags }) => {
    try {
      const data = await requestEidolonDB<{ id?: string }>(
        '/memories',
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            content,
            tier,
            importanceScore: importance,
            tags,
          }),
        }
      );

      const id = data && typeof data === 'object' && 'id' in data ? (data.id as string | undefined) : undefined;
      return textResult(id ? `Memory stored successfully (id: ${id}).` : 'Memory stored successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to store memory.';
      return textResult(`Unable to store memory: ${message}`);
    }
  }
);

server.tool(
  'recall',
  'Search for relevant memories in EidolonDB. Use this to retrieve context from past sessions.',
  {
    query: z.string().min(1).describe('What to search for'),
    k: z.number().int().min(1).max(100).default(5).describe('Number of results to return'),
    tier: tierSchema.optional().describe('Filter by tier'),
  },
  async ({ query, k, tier }) => {
    try {
      const data = await requestEidolonDB<{ results?: Array<{ memory?: unknown } | unknown> }>(
        '/memories/query',
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            text: query,
            k,
            ...(tier ? { filters: { tier }, tiers: [tier] } : {}),
          }),
        }
      );

      const results = Array.isArray(data?.results) ? data.results : [];
      if (results.length === 0) {
        return textResult('No relevant memories found.');
      }

      const lines = results.map((result) => {
        if (result && typeof result === 'object' && 'memory' in (result as Record<string, unknown>)) {
          return memoryLine((result as { memory?: unknown }).memory);
        }
        return memoryLine(result);
      });

      return textResult(lines.join('\n'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to search memories.';
      return textResult(`Unable to recall memories: ${message}`);
    }
  }
);

server.tool(
  'ingest',
  'Feed raw text to EidolonDB for automatic memory extraction. EidolonDB will extract, classify, and deduplicate memories automatically.',
  {
    text: z.string().min(1).describe('Raw text to ingest (conversation, notes, decisions, etc.)'),
    source: sourceSchema.default('chat').describe('Input source type'),
  },
  async ({ text, source }) => {
    try {
      const data = await requestEidolonDB<{
        summary?: { candidates?: number; accepted?: number; rejected?: number };
        acceptedMemories?: unknown[];
        warnings?: string[];
      }>(
        '/ingest',
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ text, content: text, source }),
        }
      );

      const candidates = data?.summary?.candidates ?? 0;
      const accepted = data?.summary?.accepted ?? (Array.isArray(data?.acceptedMemories) ? data.acceptedMemories.length : 0);
      const rejected = data?.summary?.rejected ?? 0;
      const warningText = Array.isArray(data?.warnings) && data.warnings.length > 0
        ? `\nWarnings: ${data.warnings.join('; ')}`
        : '';

      return textResult(`Ingest complete. candidates=${candidates}, accepted=${accepted}, rejected=${rejected}.${warningText}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to ingest text.';
      return textResult(`Unable to ingest text: ${message}`);
    }
  }
);

server.tool(
  'forget',
  'Delete a specific memory by ID.',
  {
    id: z.string().min(1).describe('Memory ID to delete'),
  },
  async ({ id }) => {
    try {
      await requestEidolonDB<{ deleted?: boolean }>(
        `/memories/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          headers: getHeaders(),
        }
      );

      return textResult(`Memory ${id} deleted.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete memory.';
      return textResult(`Unable to delete memory: ${message}`);
    }
  }
);

server.tool(
  'list_memories',
  'List recent memories, optionally filtered by tier or tag.',
  {
    tier: tierSchema.optional().describe('Filter by tier'),
    tag: z.string().min(1).optional().describe('Filter by tag'),
    limit: z.number().int().min(1).max(100).default(20).describe('Number of memories to return (max 100)'),
  },
  async ({ tier, tag, limit }) => {
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('sortBy', 'createdAt');
      params.set('sortOrder', 'desc');
      if (tier) params.set('tier', tier);
      if (tag) params.set('tag', tag);

      const data = await requestEidolonDB<{ memories?: unknown[] }>(
        `/memories?${params.toString()}`,
        {
          method: 'GET',
          headers: getHeaders({ Accept: 'application/json' }),
        }
      );

      const memories = Array.isArray(data?.memories) ? data.memories : [];
      if (memories.length === 0) {
        return textResult('No memories found.');
      }

      const lines = memories.map((memory) => memoryLine(memory));
      return textResult(lines.join('\n'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list memories.';
      return textResult(`Unable to list memories: ${message}`);
    }
  }
);

server.tool(
  'get_context',
  'Build a rich memory context for the current conversation. Returns the most relevant memories formatted for use as LLM context.',
  {
    input: z.string().min(1).describe('Current user message or topic'),
    max_tokens: z.number().int().min(100).max(128000).default(2000),
  },
  async ({ input, max_tokens }) => {
    try {
      const data = await requestEidolonDB<
        { messages?: Array<{ role?: string; content?: string }>; context?: string } | string
      >(
        '/context/build',
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ currentInput: input, maxTokens: max_tokens }),
        }
      );

      if (typeof data === 'string' && data.trim().length > 0) {
        return textResult(data);
      }

      if (data && typeof data === 'object' && typeof data.context === 'string' && data.context.trim().length > 0) {
        return textResult(data.context);
      }

      const messages =
        data && typeof data === 'object' && Array.isArray(data.messages)
          ? data.messages
          : [];
      if (messages.length === 0) {
        return textResult('No context generated.');
      }

      const formatted = messages
        .map((message) => {
          const role = message.role ?? 'unknown';
          const content = message.content ?? '';
          return `[${role}] ${content}`;
        })
        .join('\n\n');

      return textResult(formatted);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to build context.';
      return textResult(`Unable to build context: ${message}`);
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown startup failure';
  process.stderr.write(`Failed to start MCP server: ${message}\n`);
  process.exit(1);
});
