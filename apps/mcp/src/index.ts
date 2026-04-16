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
  version: '0.2.0',
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
const permissionSchema = z.enum(['read', 'read-write']);
const conflictStrategySchema = z.enum(['newer-wins', 'higher-importance', 'merge', 'manual']);
const conflictStatusSchema = z.enum(['none', 'flagged', 'resolved']);

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
    conflictStatus: conflictStatusSchema.optional().describe('Filter by conflict status'),
    limit: z.number().int().min(1).max(100).default(20).describe('Number of memories to return (max 100)'),
  },
  async ({ tier, tag, conflictStatus, limit }) => {
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('sortBy', 'createdAt');
      params.set('sortOrder', 'desc');
      if (tier) params.set('tier', tier);
      if (tag) params.set('tag', tag);
      if (conflictStatus) params.set('conflictStatus', conflictStatus);

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
  'create_grant',
  'Grant another agent access to your memories. Use this to share memories with other agents in your tenant.',
  {
    ownerEntityId: z.string().min(1).describe('Entity ID of the agent sharing memories'),
    granteeEntityId: z.string().min(1).optional().describe('Entity ID of the agent to grant access to. Omit for broadcast (all agents)'),
    permission: permissionSchema.default('read').describe('Grant permission'),
    scopeTier: tierSchema.optional().describe('Limit grant to a specific memory tier'),
    scopeTag: z.string().min(1).optional().describe('Limit grant to memories with a specific tag'),
  },
  async ({ ownerEntityId, granteeEntityId, permission, scopeTier, scopeTag }) => {
    try {
      const data = await requestEidolonDB<{ id?: string }>(
        '/grants',
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            ownerEntityId,
            granteeEntityId,
            permission,
            scopeTier,
            scopeTag,
          }),
        }
      );

      const id = data && typeof data === 'object' && 'id' in data ? (data.id as string | undefined) : undefined;
      const grantee = granteeEntityId ?? 'all agents';
      return textResult(
        `Grant created${id ? ` (id: ${id})` : ''}. Agent ${grantee} can now ${permission} memories from ${ownerEntityId}.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create grant.';
      return textResult(`Unable to create grant: ${message}`);
    }
  }
);

server.tool(
  'list_grants',
  'List memory sharing grants for your tenant.',
  {
    ownerEntityId: z.string().min(1).optional().describe('Filter by owner agent'),
    granteeEntityId: z.string().min(1).optional().describe('Filter by grantee agent'),
    limit: z.number().int().min(1).max(100).default(20).describe('Number of grants to return (max 100)'),
  },
  async ({ ownerEntityId, granteeEntityId, limit }) => {
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (ownerEntityId) params.set('ownerEntityId', ownerEntityId);
      if (granteeEntityId) params.set('granteeEntityId', granteeEntityId);

      const data = await requestEidolonDB<{ grants?: unknown[] } | unknown[]>(
        `/grants?${params.toString()}`,
        {
          method: 'GET',
          headers: getHeaders({ Accept: 'application/json' }),
        }
      );

      const grants = Array.isArray(data)
        ? data
        : data && typeof data === 'object' && Array.isArray((data as { grants?: unknown[] }).grants)
          ? (data as { grants: unknown[] }).grants
          : [];

      if (grants.length === 0) {
        return textResult('No grants found.');
      }

      const lines = grants.map((grant) => {
        if (!grant || typeof grant !== 'object') {
          return '- [unknown] Invalid grant payload';
        }

        const item = grant as Record<string, unknown>;
        const id = typeof item['id'] === 'string' ? item['id'] : 'unknown';
        const owner = typeof item['ownerEntityId'] === 'string' ? item['ownerEntityId'] : 'unknown';
        const grantee = typeof item['granteeEntityId'] === 'string' ? item['granteeEntityId'] : 'all agents';
        const permission = typeof item['permission'] === 'string' ? item['permission'] : 'read';
        const tier = typeof item['scopeTier'] === 'string' ? item['scopeTier'] : 'any tier';
        const tag = typeof item['scopeTag'] === 'string' ? item['scopeTag'] : 'any tag';
        return `- ${id}: ${owner} -> ${grantee} (${permission}; tier=${tier}; tag=${tag})`;
      });

      return textResult(lines.join('\n'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list grants.';
      return textResult(`Unable to list grants: ${message}`);
    }
  }
);

server.tool(
  'delete_grant',
  'Revoke a memory sharing grant.',
  {
    id: z.string().min(1).describe('Grant ID to revoke'),
  },
  async ({ id }) => {
    try {
      await requestEidolonDB<{ deleted?: boolean }>(
        `/grants/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          headers: getHeaders(),
        }
      );

      return textResult(`Grant ${id} revoked successfully.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete grant.';
      return textResult(`Unable to revoke grant: ${message}`);
    }
  }
);

server.tool(
  'detect_conflicts',
  'Scan memories for contradictions and optionally resolve them automatically.',
  {
    autoResolve: z.boolean().default(false).describe('Automatically resolve found conflicts'),
    strategy: conflictStrategySchema
      .default('newer-wins')
      .describe('Resolution strategy when autoResolve is true'),
    limit: z.number().int().min(1).max(1000).default(50).describe('Max memories to scan'),
  },
  async ({ autoResolve, strategy, limit }) => {
    try {
      const data = await requestEidolonDB<{
        scanned?: number;
        conflictsFound?: number;
        autoResolved?: number;
        conflicts?: unknown[];
      }>(
        '/conflicts/detect',
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ autoResolve, strategy, limit }),
        }
      );

      const scanned = data?.scanned ?? 0;
      const conflictsFound = data?.conflictsFound ?? 0;
      const autoResolved = data?.autoResolved ?? 0;
      const conflicts = Array.isArray(data?.conflicts) ? data.conflicts : [];

      const summary = `Scanned ${scanned} memories. Found ${conflictsFound} conflicts, auto-resolved ${autoResolved}.`;
      if (conflicts.length === 0) {
        return textResult(summary);
      }

      const lines = conflicts.map((conflict) => {
        if (!conflict || typeof conflict !== 'object') {
          return '- conflict: [invalid payload]';
        }

        const item = conflict as Record<string, unknown>;
        const id = typeof item['id'] === 'string' ? item['id'] : 'unknown';
        const memoryIdA = typeof item['memoryIdA'] === 'string' ? item['memoryIdA'] : 'unknown';
        const memoryIdB = typeof item['memoryIdB'] === 'string' ? item['memoryIdB'] : 'unknown';
        const explanation = typeof item['explanation'] === 'string' ? item['explanation'] : 'No explanation provided';
        return `- ${id}: ${memoryIdA} vs ${memoryIdB} - ${explanation}`;
      });

      return textResult(`${summary}\n${lines.join('\n')}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to detect conflicts.';
      return textResult(`Unable to detect conflicts: ${message}`);
    }
  }
);

server.tool(
  'resolve_conflict',
  'Manually resolve a specific contradiction between two memories.',
  {
    memoryIdA: z.string().min(1).describe('First memory ID'),
    memoryIdB: z.string().min(1).describe('Second memory ID'),
    strategy: conflictStrategySchema.describe('Resolution strategy'),
  },
  async ({ memoryIdA, memoryIdB, strategy }) => {
    try {
      await requestEidolonDB<{ resolved?: boolean }>(
        '/conflicts/resolve',
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ memoryIdA, memoryIdB, strategy }),
        }
      );

      return textResult(`Conflict resolved using ${strategy} strategy.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resolve conflict.';
      return textResult(`Unable to resolve conflict: ${message}`);
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
