import type { AgentType, ScenarioDefinition, SessionDefinition, TranscriptMessage } from "./scenario.js";

export interface RuntimeConfig {
  openAiApiKey: string;
  eidolonDbUrl: string;
  model: string;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface EvalAgent {
  readonly agentType: AgentType;
  buildSessionSystemMessages(session: SessionDefinition): Promise<LlmMessage[]>;
  enrichMessages?(messages: LlmMessage[]): Promise<LlmMessage[]>;
  respond(messages: LlmMessage[]): Promise<string>;
  persistSession(
    session: SessionDefinition,
    transcript: TranscriptMessage[],
    scenario: ScenarioDefinition
  ): Promise<void>;
}

const EVAL_TENANT_ID = "openclaw-eval";
const RBAC_AGENT_A_ID = "00000000-0000-0000-0000-000000000001";
const RBAC_AGENT_B_ID = "00000000-0000-0000-0000-000000000002";
let rbacAgentAEntityId = RBAC_AGENT_A_ID;
let rbacAgentBEntityId = RBAC_AGENT_B_ID;

type MemoryTier = "short_term" | "episodic" | "semantic";

interface MemoryQueryResult {
  memory?: {
    id?: string;
    content?: string;
  };
  score?: number;
}

type TemporalIntent =
  | {
      mode: "session-relative";
      sessionOffset: number;
    }
  | {
      mode: "calendar-relative";
      start: string;
      end: string;
    };

type TemporalQueryFilter =
  | {
      mode: "session-relative";
      sessionNumber: number;
    }
  | {
      mode: "calendar-relative";
      start: string;
      end: string;
    };

interface ListMemoriesResponse {
  data?: {
    memories?: Array<{ id: string; content?: string; createdAt?: string; metadata?: Record<string, unknown> }>;
    total?: number;
  };
}

interface MemoryQueryResponse {
  data?: {
    results?: MemoryQueryResult[];
  };
}

interface ListGrantsResponse {
  data?: {
    grants?: Array<{ id: string }>;
    total?: number;
    limit?: number;
    offset?: number;
  };
}

interface CreateGrantResponse {
  data?: {
    id?: string;
  };
}

interface EntityResponse {
  data?: {
    id?: string;
  };
}

interface OpenAiChatResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

async function openAiChatCompletion(config: RuntimeConfig, messages: LlmMessage[]): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      messages,
    }),
  });

  if (response.ok === false) {
    const text = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${text}`);
  }

  const json = (await response.json()) as OpenAiChatResponse;
  const content = json.choices?.[0]?.message?.content;

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("OpenAI API returned an empty response");
  }

  return content;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function detectTemporalIntent(text: string): TemporalIntent | null {
  if (
    /last session/i.test(text) ||
    /previous session/i.test(text) ||
    /last time (we|i|you)/i.test(text) ||
    /our last conversation/i.test(text)
  ) {
    return { mode: "session-relative", sessionOffset: -1 };
  }

  const sessionsAgoMatch = text.match(/(\d+) sessions? ago/i);
  if (sessionsAgoMatch) {
    const count = Number.parseInt(sessionsAgoMatch[1] ?? "", 10);
    if (Number.isInteger(count) && count > 0) {
      return { mode: "session-relative", sessionOffset: -count };
    }
  }

  const daysAgoMatch = text.match(/(\d+) days? ago/i);
  if (daysAgoMatch) {
    const count = Number.parseInt(daysAgoMatch[1] ?? "", 10);
    if (Number.isInteger(count) && count > 0) {
      const todayStart = startOfUtcDay(new Date());
      const targetStart = new Date(todayStart.getTime() - count * 24 * 60 * 60 * 1000);
      const targetEnd = new Date(targetStart.getTime() + 24 * 60 * 60 * 1000);
      return {
        mode: "calendar-relative",
        start: targetStart.toISOString(),
        end: targetEnd.toISOString(),
      };
    }
  }

  if (/yesterday/i.test(text)) {
    const todayStart = startOfUtcDay(new Date());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    return {
      mode: "calendar-relative",
      start: yesterdayStart.toISOString(),
      end: todayStart.toISOString(),
    };
  }

  if (/last week/i.test(text)) {
    const todayStart = startOfUtcDay(new Date());
    const utcWeekday = todayStart.getUTCDay();
    const daysSinceMonday = (utcWeekday + 6) % 7;
    const thisWeekMondayStart = new Date(todayStart.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
    const lastWeekMondayStart = new Date(thisWeekMondayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      mode: "calendar-relative",
      start: lastWeekMondayStart.toISOString(),
      end: thisWeekMondayStart.toISOString(),
    };
  }

  return null;
}

async function queryRelevantMemories(
  config: RuntimeConfig,
  queryText: string,
  temporal?: TemporalQueryFilter
): Promise<string[]> {
  const results = await queryRelevantMemoriesRaw(config, queryText, 5, temporal);
  return results.map((item) => item.content).slice(0, 5);
}

interface RawMemoryQueryResult {
  id: string;
  content: string;
  score: number;
}

async function queryRelevantMemoriesRaw(
  config: RuntimeConfig,
  queryText: string,
  k = 5,
  temporal?: TemporalQueryFilter,
  options?: {
    includeShared?: boolean;
    requestingEntityId?: string;
    ownerEntityId?: string;
  }
): Promise<RawMemoryQueryResult[]> {
  const response = await fetch(`${config.eidolonDbUrl}/memories/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-id": EVAL_TENANT_ID,
    },
    body: JSON.stringify({
      text: queryText,
      k,
      temporal,
      includeShared: options?.includeShared ?? false,
      requestingEntityId: options?.requestingEntityId,
      ownerEntityId: options?.ownerEntityId,
    }),
  });

  if (response.ok === false) {
    if (temporal && response.status >= 500) {
      console.warn(`Temporal query failed (${response.status}), retrying without temporal filter`);
      return queryRelevantMemoriesRaw(config, queryText, k, undefined, options);
    }
    const body = await response.text();
    throw new Error(`Memory query failed (${response.status}): ${body}`);
  }

  const json = (await response.json()) as MemoryQueryResponse;
  const memories = json.data?.results ?? [];

  return memories
    .map((item) => {
      const id = item.memory?.id;
      const content = item.memory?.content;
      const score = item.score;
      if (typeof id !== "string" || id.trim().length === 0) {
        return undefined;
      }
      if (typeof content !== "string" || content.trim().length === 0) {
        return undefined;
      }
      if (typeof score !== "number" || Number.isFinite(score) === false) {
        return undefined;
      }
      return {
        id,
        content,
        score,
      };
    })
    .filter((value): value is RawMemoryQueryResult => value !== undefined);
}

async function ingestSessionTranscript(
  config: RuntimeConfig,
  sessionNumber: number,
  transcript: TranscriptMessage[],
  scenarioName: string,
  ownerEntityId?: string
): Promise<void> {
  const transcriptText = transcript
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n");

  const response = await fetch(`${config.eidolonDbUrl}/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-id": EVAL_TENANT_ID,
    },
    body: JSON.stringify({
      source: "chat",
      autoStore: true,
      content: transcriptText,
      ownerEntityId,
      metadata: {
        evalScenario: scenarioName,
        sessionNumber,
      },
    }),
  });

  if (response.ok === false) {
    const body = await response.text();
    throw new Error(`Ingest failed (${response.status}): ${body}`);
  }

  const json = (await response.json()) as {
    summary?: { accepted?: number };
    data?: { summary?: { accepted?: number } };
  };
  const accepted = json.summary?.accepted ?? json.data?.summary?.accepted ?? 0;
  console.log(`[eval-debug] ingest session=${sessionNumber} scenario=${scenarioName} accepted=${accepted}`);
}

export async function cleanupEvalTenantMemories(config: RuntimeConfig): Promise<number> {
  let deleted = 0;

  for (;;) {
    const listResponse = await fetch(`${config.eidolonDbUrl}/memories?limit=100&offset=0`, {
      method: "GET",
      headers: {
        "x-tenant-id": EVAL_TENANT_ID,
      },
    });

    if (listResponse.ok === false) {
      const text = await listResponse.text();
      throw new Error(`Failed to list eval tenant memories (${listResponse.status}): ${text}`);
    }

    const listJson = (await listResponse.json()) as ListMemoriesResponse;
    const memories = listJson.data?.memories ?? [];

    if (memories.length === 0) {
      break;
    }

    for (const memory of memories) {
      const deleteResponse = await fetch(`${config.eidolonDbUrl}/memories/${memory.id}`, {
        method: "DELETE",
        headers: {
          "x-tenant-id": EVAL_TENANT_ID,
        },
      });

      if (deleteResponse.ok) {
        deleted += 1;
        continue;
      }

      if (deleteResponse.status === 404) {
        continue;
      }

      const text = await deleteResponse.text();
      throw new Error(`Failed to delete memory ${memory.id} (${deleteResponse.status}): ${text}`);
    }
  }

  return deleted;
}

export async function cleanupEvalTenantGrants(config: RuntimeConfig): Promise<number> {
  let deleted = 0;
  const limit = 100;

  for (;;) {
    const listResponse = await fetch(`${config.eidolonDbUrl}/grants?limit=${limit}&offset=0`, {
      method: "GET",
      headers: {
        "x-tenant-id": EVAL_TENANT_ID,
      },
    });

    if (listResponse.ok === false) {
      const text = await listResponse.text();
      throw new Error(`Failed to list eval tenant grants (${listResponse.status}): ${text}`);
    }

    const listJson = (await listResponse.json()) as ListGrantsResponse;
    const grants = listJson.data?.grants ?? [];

    if (grants.length === 0) {
      break;
    }

    for (const grant of grants) {
      const deleteResponse = await fetch(`${config.eidolonDbUrl}/grants/${grant.id}`, {
        method: "DELETE",
        headers: {
          "x-tenant-id": EVAL_TENANT_ID,
        },
      });

      if (deleteResponse.ok) {
        deleted += 1;
        continue;
      }

      if (deleteResponse.status === 404) {
        continue;
      }

      const text = await deleteResponse.text();
      throw new Error(`Failed to delete grant ${grant.id} (${deleteResponse.status}): ${text}`);
    }

  }

  return deleted;
}

function getRbacEntityId(agent: "a" | "b"): string {
  return agent === "a" ? rbacAgentAEntityId : rbacAgentBEntityId;
}

async function ensureEntityExists(
  config: RuntimeConfig,
  entityId: string,
  name: string
): Promise<string> {
  const getResponse = await fetch(`${config.eidolonDbUrl}/entities/${entityId}`, {
    method: "GET",
    headers: {
      "x-tenant-id": EVAL_TENANT_ID,
    },
  });

  if (getResponse.ok) {
    return entityId;
  }

  if (getResponse.status !== 404) {
    const text = await getResponse.text();
    throw new Error(`Failed to fetch entity ${entityId} (${getResponse.status}): ${text}`);
  }

  const createResponse = await fetch(`${config.eidolonDbUrl}/entities`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-id": EVAL_TENANT_ID,
    },
    body: JSON.stringify({
      id: entityId,
      type: "agent",
      name,
      properties: {
        eval: true,
      },
      tags: ["eval", "rbac"],
    }),
  });

  if (createResponse.ok === false) {
    const text = await createResponse.text();
    throw new Error(`Failed to create entity ${entityId} (${createResponse.status}): ${text}`);
  }

  const json = (await createResponse.json()) as EntityResponse;
  const createdId = json.data?.id;
  if (typeof createdId !== "string" || createdId.length === 0) {
    throw new Error(`Entity create response missing id for requested id ${entityId}`);
  }

  if (createdId !== entityId) {
    console.warn(
      `[eval-rbac] requested fixed entity id ${entityId} but server created ${createdId}; using created id`
    );
  }

  return createdId;
}

export async function ensureRbacEvalEntities(config: RuntimeConfig): Promise<void> {
  rbacAgentAEntityId = await ensureEntityExists(config, RBAC_AGENT_A_ID, "Eval RBAC Agent A");
  rbacAgentBEntityId = await ensureEntityExists(config, RBAC_AGENT_B_ID, "Eval RBAC Agent B");
}

async function createOwnedMemory(
  config: RuntimeConfig,
  ownerEntityId: string,
  content: string,
  scenarioName: string,
  sessionNumber: number,
  tier: MemoryTier
): Promise<void> {
  const response = await fetch(`${config.eidolonDbUrl}/memories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-id": EVAL_TENANT_ID,
    },
    body: JSON.stringify({
      ownerEntityId,
      tier,
      content,
      tags: ["eval", scenarioName, "rbac"],
      metadata: {
        evalScenario: scenarioName,
        sessionNumber,
      },
    }),
  });

  if (response.ok === false) {
    const text = await response.text();
    throw new Error(`Failed to create memory (${response.status}): ${text}`);
  }
}

async function createGrant(
  config: RuntimeConfig,
  input: {
    ownerEntityId: string;
    granteeEntityId?: string | null;
    permission?: "read" | "read-write";
    scopeTier?: MemoryTier;
    scopeTag?: string;
  }
): Promise<string> {
  const response = await fetch(`${config.eidolonDbUrl}/grants`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-id": EVAL_TENANT_ID,
    },
    body: JSON.stringify({
      ownerEntityId: input.ownerEntityId,
      granteeEntityId: input.granteeEntityId ?? null,
      permission: input.permission ?? "read",
      scopeTier: input.scopeTier,
      scopeTag: input.scopeTag,
    }),
  });

  if (response.ok === false) {
    const text = await response.text();
    throw new Error(`Failed to create grant (${response.status}): ${text}`);
  }

  const json = (await response.json()) as CreateGrantResponse;
  const grantId = json.data?.id;
  if (typeof grantId !== "string" || grantId.length === 0) {
    throw new Error("Grant create response missing id");
  }
  return grantId;
}

async function deleteGrantById(config: RuntimeConfig, grantId: string): Promise<void> {
  const response = await fetch(`${config.eidolonDbUrl}/grants/${grantId}`, {
    method: "DELETE",
    headers: {
      "x-tenant-id": EVAL_TENANT_ID,
    },
  });

  if (response.ok || response.status === 404) {
    return;
  }

  const text = await response.text();
  throw new Error(`Failed to delete grant ${grantId} (${response.status}): ${text}`);
}

async function getMostRecentMemorySummary(config: RuntimeConfig): Promise<string | null> {
  const listResponse = await fetch(`${config.eidolonDbUrl}/memories?limit=1&offset=0`, {
    method: "GET",
    headers: {
      "x-tenant-id": EVAL_TENANT_ID,
    },
  });

  if (listResponse.ok === false) {
    return null;
  }

  const listJson = (await listResponse.json()) as ListMemoriesResponse;
  const latest = listJson.data?.memories?.[0];
  if (!latest) {
    return null;
  }

  const metadata = latest.metadata ?? {};
  const sessionNumberValue = metadata["sessionNumber"];
  const sessionDescriptor =
    typeof sessionNumberValue === "number" && Number.isInteger(sessionNumberValue)
      ? `session ${sessionNumberValue}`
      : null;
  const dateDescriptor = typeof latest.createdAt === "string" ? latest.createdAt : null;
  const basis = sessionDescriptor ?? dateDescriptor;

  if (!basis) {
    return null;
  }

  return `The most recent activity I have is from ${basis}.`;
}

export function createBaselineAgent(config: RuntimeConfig): EvalAgent {
  return {
    agentType: "baseline",
    async buildSessionSystemMessages() {
      return [];
    },
    async enrichMessages(messages: LlmMessage[]): Promise<LlmMessage[]> {
      return messages;
    },
    async respond(messages: LlmMessage[]): Promise<string> {
      return openAiChatCompletion(config, messages);
    },
    async persistSession() {
      return;
    },
  };
}

interface SparseVector {
  [token: string]: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function termFrequency(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function cosineSimilarity(a: SparseVector, b: SparseVector): number {
  const aEntries = Object.entries(a);
  const bEntries = Object.entries(b);

  const [smaller, larger] = aEntries.length <= bEntries.length ? [aEntries, b] : [bEntries, a];

  let dot = 0;
  for (const [token, value] of smaller) {
    const other = larger[token];
    if (typeof other === "number") {
      dot += value * other;
    }
  }

  const norm = (vector: SparseVector): number => {
    let sum = 0;
    for (const value of Object.values(vector)) {
      sum += value * value;
    }
    return Math.sqrt(sum);
  };

  const aNorm = norm(a);
  const bNorm = norm(b);
  if (aNorm === 0 || bNorm === 0) {
    return 0;
  }

  return dot / (aNorm * bNorm);
}

function buildTfIdfVector(
  tokens: string[],
  documentCount: number,
  docFrequency: Map<string, number>,
  fallbackIdf: number
): SparseVector {
  const frequencies = termFrequency(tokens);
  const totalTerms = tokens.length;
  if (totalTerms === 0) {
    return {};
  }

  const vector: SparseVector = {};
  for (const [token, count] of frequencies) {
    const tf = count / totalTerms;
    const df = docFrequency.get(token) ?? 0;
    const idf = df > 0 ? Math.log((documentCount + 1) / (df + 1)) + 1 : fallbackIdf;
    vector[token] = tf * idf;
  }
  return vector;
}

function retrieveTopUtterances(queryText: string, utterances: string[], k = 3): string[] {
  const documents = utterances.filter((item) => item.trim().length > 0);
  if (documents.length === 0) {
    return [];
  }

  const docFrequency = new Map<string, number>();
  const tokenizedDocuments = documents.map((document) => {
    const tokens = tokenize(document);
    const uniqueTokens = new Set(tokens);
    for (const token of uniqueTokens) {
      docFrequency.set(token, (docFrequency.get(token) ?? 0) + 1);
    }
    return tokens;
  });

  const documentCount = documents.length;
  const fallbackIdf = Math.log(documentCount + 1) + 1;
  const docVectors = tokenizedDocuments.map((tokens) =>
    buildTfIdfVector(tokens, documentCount, docFrequency, fallbackIdf)
  );

  const queryTokens = tokenize(queryText);
  const queryVector = buildTfIdfVector(queryTokens, documentCount, docFrequency, fallbackIdf);

  const scored = documents.map((document, index) => ({
    text: document,
    score: cosineSimilarity(queryVector, docVectors[index] ?? {}),
  }));

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((item) => item.text);
}

function buildMemorySystemPrompt(
  contextBlock: string,
  sourceDescription: string,
  fallbackMessage?: string
): string {
  const block = contextBlock.trim().length > 0 ? contextBlock : "(no retrieved context)";
  return [
    "You are an assistant with access to retrieved context from previous sessions.",
    "",
    sourceDescription,
    block,
    "",
    "Answer the user's questions using the retrieved context above. If the context contains the answer, respond directly and confidently. Do not add disclaimers or hedge when the answer is present in context.",
    "",
    'Questions asking what happened (e.g. "what did we do", "what was decided", "can you recap", "what did we discuss") are recall requests — answer them from retrieved context, do not reject them.',
    "",
    'CRITICAL: When the user asserts something happened in the past (phrases like "as I mentioned", "as we discussed", "you told me", "we decided", "I mentioned before"), cross-check against the retrieved context. If the claim is absent from context or contradicted by it, say "I don\'t have any record of that being discussed." Do not confirm or agree with unverified past claims.',
    "",
    "If retrieved context contains conflicting information about the same topic, mention both and note which appears to be more recent. Do not silently discard either version.",
    "",
    "When the user shares new information or updates a preference, accept it. Do not reject new info because it is not in retrieved context.",
    "",
    "The user's most recent statement in this session supersedes older retrieved context.",
  ].join("\n");
}

export function createRagBaselineAgent(config: RuntimeConfig): EvalAgent {
  const sessionTranscripts: string[][] = [];
  let activeSessionNumber = 1;

  return {
    agentType: "rag_baseline",
    async buildSessionSystemMessages(session: SessionDefinition) {
      activeSessionNumber = session.sessionNumber;
      return [];
    },
    async enrichMessages(messages: LlmMessage[]): Promise<LlmMessage[]> {
      if (activeSessionNumber < 2) {
        return messages;
      }

      const lastUserIndex = (() => {
        for (let index = messages.length - 1; index >= 0; index -= 1) {
          if (messages[index]?.role === "user") {
            return index;
          }
        }
        return -1;
      })();

      if (lastUserIndex === -1) {
        return messages;
      }

      const userMessage = messages[lastUserIndex];
      const temporalIntent = detectTemporalIntent(userMessage.content);
      const allPastUtterances =
        temporalIntent?.mode === "session-relative"
          ? (() => {
              const targetSessionNumber = activeSessionNumber + temporalIntent.sessionOffset;
              const targetSessionIndex = targetSessionNumber - 1;
              if (targetSessionIndex < 0 || targetSessionIndex >= sessionTranscripts.length) {
                return [];
              }
              return sessionTranscripts[targetSessionIndex] ?? [];
            })()
          : sessionTranscripts.flat();
      // Calendar-relative filtering is intentionally skipped in this baseline model.
      let snippets: string[];
      if (temporalIntent) {
        const strippedQuery = userMessage.content
          .replace(/last session|previous session|last time (we|I|you)|our last conversation/gi, " ")
          .trim();

        const meaningfulWordCount = strippedQuery
          .split(/\s+/)
          .map((word) => word.replace(/[^a-z0-9]/gi, ""))
          .filter((word) => word.length > 3).length;

        const isTooVague = meaningfulWordCount < 4;
        snippets = isTooVague
          ? allPastUtterances.slice(0, 3)
          : retrieveTopUtterances(strippedQuery, allPastUtterances, 3);
      } else {
        snippets = retrieveTopUtterances(userMessage.content, allPastUtterances, 3);
      }

      // Always inject system prompt for session 2+, even with empty snippets.
      // The false-premise rejection instructions must always be present.

      const snippetLines = snippets.map((snippet) => `- ${snippet}`).join("\n");
      const systemMessage: LlmMessage = {
        role: "system",
        content: buildMemorySystemPrompt(
          snippetLines,
          "The following context was retrieved from previous sessions using keyword search (TF-IDF) over raw transcripts:"
        ),
      };

      return [...messages.slice(0, lastUserIndex), systemMessage, ...messages.slice(lastUserIndex)];
    },
    async respond(messages: LlmMessage[]): Promise<string> {
      return openAiChatCompletion(config, messages);
    },
    async persistSession(_session: SessionDefinition, transcript: TranscriptMessage[]): Promise<void> {
      const serializedTranscript = transcript.map(
        (message) => `${message.role.toUpperCase()}: ${message.content}`
      );
      sessionTranscripts.push(serializedTranscript);
    },
  };
}

export function createEidolonDbAgent(config: RuntimeConfig): EvalAgent {
  let activeSessionNumber = 1;

  return {
    agentType: "eidolondb",
    async buildSessionSystemMessages(session: SessionDefinition): Promise<LlmMessage[]> {
      activeSessionNumber = session.sessionNumber;
      return [];
    },
    async enrichMessages(messages: LlmMessage[]): Promise<LlmMessage[]> {
      if (activeSessionNumber < 2) {
        return messages;
      }

      const lastUserIndex = (() => {
        for (let index = messages.length - 1; index >= 0; index -= 1) {
          if (messages[index]?.role === "user") {
            return index;
          }
        }
        return -1;
      })();

      if (lastUserIndex === -1) {
        return messages;
      }

      const userMessage = messages[lastUserIndex];
      const temporalIntent = detectTemporalIntent(userMessage.content);
      const temporalFilter: TemporalQueryFilter | undefined =
        temporalIntent?.mode === "session-relative"
          ? {
              mode: "session-relative",
              sessionNumber: activeSessionNumber + temporalIntent.sessionOffset,
            }
          : temporalIntent ?? undefined;
      const memories = await queryRelevantMemories(config, userMessage.content, temporalFilter);
      console.log(
        `[eval-debug] scenario session=${activeSessionNumber} query="${userMessage.content.slice(0, 60)}" temporal=${JSON.stringify(temporalFilter)} memories=${memories.length}`
      );

      // Always inject system prompt for session 2+, even with empty memories.
      // The false-premise rejection instructions must always be present.

      const fallbackSummary =
        temporalIntent !== null && memories.length === 0
          ? await getMostRecentMemorySummary(config)
          : undefined;

      const memoryLines = memories.map((memory) => `- ${memory}`).join("\n");
      const systemMessage: LlmMessage = {
        role: "system",
        content: buildMemorySystemPrompt(
          memoryLines,
          "The following facts were retrieved from previous sessions using EidolonDB (LLM-extracted, semantically indexed):",
          temporalIntent !== null ? fallbackSummary ?? undefined : undefined
        ),
      };

      return [...messages.slice(0, lastUserIndex), systemMessage, ...messages.slice(lastUserIndex)];
    },
    async respond(messages: LlmMessage[]): Promise<string> {
      return openAiChatCompletion(config, messages);
    },
    async persistSession(
      session: SessionDefinition,
      transcript: TranscriptMessage[],
      scenario: ScenarioDefinition
    ): Promise<void> {
      await ingestSessionTranscript(config, session.sessionNumber, transcript, scenario.name);
    },
  };
}

type RbacAgentId = "a" | "b";

function isSetupSession(session: SessionDefinition): boolean {
  return session.userMessages.some((message) => message.content.trim().startsWith("[SETUP]"));
}

function chooseRbacTier(content: string): MemoryTier {
  if (/meeting at 3pm today/i.test(content)) {
    return "short_term";
  }
  if (/we use postgresql/i.test(content)) {
    return "semantic";
  }
  return "semantic";
}

class EidolonDbRbacAgent implements EvalAgent {
  readonly agentType: AgentType = "eidolondb_rbac";
  private activeSessionNumber = 1;

  constructor(
    private readonly config: RuntimeConfig,
    private readonly agentId: RbacAgentId
  ) {}

  async buildSessionSystemMessages(session: SessionDefinition): Promise<LlmMessage[]> {
    this.activeSessionNumber = session.sessionNumber;
    return [];
  }

  async enrichMessages(messages: LlmMessage[]): Promise<LlmMessage[]> {
    if (this.activeSessionNumber < 2) {
      return messages;
    }

    const lastUserIndex = (() => {
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index]?.role === "user") {
          return index;
        }
      }
      return -1;
    })();

    if (lastUserIndex === -1) {
      return messages;
    }

    const userMessage = messages[lastUserIndex];
    if (userMessage.content.trim().startsWith("[SETUP]")) {
      return messages;
    }

    const temporalIntent = detectTemporalIntent(userMessage.content);
    const temporalFilter: TemporalQueryFilter | undefined =
      temporalIntent?.mode === "session-relative"
        ? {
            mode: "session-relative",
            sessionNumber: this.activeSessionNumber + temporalIntent.sessionOffset,
          }
        : temporalIntent ?? undefined;
    const queryOptions =
      this.agentId === "b"
        ? {
            includeShared: true,
            requestingEntityId: getRbacEntityId("b"),
          }
        : {
            ownerEntityId: getRbacEntityId("a"),
          };
    const memories = await queryRelevantMemoriesRaw(
      this.config,
      userMessage.content,
      5,
      temporalFilter,
      queryOptions
    );

    const memoryLines = memories.map((memory) => `- ${memory.content}`).join("\n");
    const systemMessage: LlmMessage = {
      role: "system",
      content: buildMemorySystemPrompt(
        memoryLines,
        "The following facts were retrieved from previous sessions using EidolonDB (LLM-extracted, semantically indexed):"
      ),
    };

    return [...messages.slice(0, lastUserIndex), systemMessage, ...messages.slice(lastUserIndex)];
  }

  async respond(messages: LlmMessage[]): Promise<string> {
    const lastUser = (() => {
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index]?.role === "user") {
          return messages[index];
        }
      }
      return null;
    })();

    if (lastUser && lastUser.content.trim().startsWith("[SETUP]")) {
      await this.runSetupInstruction(lastUser.content);
      return "Setup complete.";
    }

    return openAiChatCompletion(this.config, messages);
  }

  async persistSession(
    session: SessionDefinition,
    transcript: TranscriptMessage[],
    scenario: ScenarioDefinition
  ): Promise<void> {
    if (isSetupSession(session)) {
      return;
    }

    if (this.agentId !== "a") {
      return;
    }

    for (const message of transcript) {
      if (message.role !== "user") {
        continue;
      }
      await createOwnedMemory(
        this.config,
        getRbacEntityId("a"),
        message.content,
        scenario.name,
        session.sessionNumber,
        chooseRbacTier(message.content)
      );
    }
  }

  private async runSetupInstruction(raw: string): Promise<void> {
    const instruction = raw.replace(/^\[SETUP\]\s*/i, "").trim().toLowerCase();
    if (instruction === "no grant") {
      return;
    }

    if (instruction === "grant read from a to b") {
      await createGrant(this.config, {
        ownerEntityId: getRbacEntityId("a"),
        granteeEntityId: getRbacEntityId("b"),
        permission: "read",
      });
      return;
    }

    if (instruction === "grant read from a to b tier=semantic") {
      await createGrant(this.config, {
        ownerEntityId: getRbacEntityId("a"),
        granteeEntityId: getRbacEntityId("b"),
        permission: "read",
        scopeTier: "semantic",
      });
      return;
    }

    if (instruction === "grant read from a to all") {
      await createGrant(this.config, {
        ownerEntityId: getRbacEntityId("a"),
        granteeEntityId: null,
        permission: "read",
      });
      return;
    }

    if (instruction === "grant read from a to b then revoke") {
      const grantId = await createGrant(this.config, {
        ownerEntityId: getRbacEntityId("a"),
        granteeEntityId: getRbacEntityId("b"),
        permission: "read",
      });
      await deleteGrantById(this.config, grantId);
      return;
    }

    throw new Error(`Unsupported setup instruction: ${raw}`);
  }
}

export function createEidolonDbRbacAgent(config: RuntimeConfig, agentId: RbacAgentId): EvalAgent {
  return new EidolonDbRbacAgent(config, agentId);
}

export { EVAL_TENANT_ID, RBAC_AGENT_A_ID, RBAC_AGENT_B_ID };
