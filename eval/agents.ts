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
  respond(messages: LlmMessage[]): Promise<string>;
  persistSession(
    session: SessionDefinition,
    transcript: TranscriptMessage[],
    scenario: ScenarioDefinition
  ): Promise<void>;
}

const EVAL_TENANT_ID = "openclaw-eval";

interface MemoryQueryResult {
  memory?: {
    content?: string;
  };
}

interface ListMemoriesResponse {
  data?: {
    memories?: Array<{ id: string }>;
    total?: number;
  };
}

interface MemoryQueryResponse {
  data?: {
    results?: MemoryQueryResult[];
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

async function queryRelevantMemories(config: RuntimeConfig, openingMessage: string): Promise<string[]> {
  const response = await fetch(`${config.eidolonDbUrl}/memories/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-id": EVAL_TENANT_ID,
    },
    body: JSON.stringify({
      text: openingMessage,
      k: 10,
    }),
  });

  if (response.ok === false) {
    const body = await response.text();
    throw new Error(`Memory query failed (${response.status}): ${body}`);
  }

  const json = (await response.json()) as MemoryQueryResponse;
  const memories = json.data?.results ?? [];

  return memories
    .map((item) => item.memory?.content)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .slice(0, 10);
}

async function ingestSessionTranscript(
  config: RuntimeConfig,
  sessionNumber: number,
  transcript: TranscriptMessage[],
  scenarioName: string
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

export function createBaselineAgent(config: RuntimeConfig): EvalAgent {
  return {
    agentType: "baseline",
    async buildSessionSystemMessages() {
      return [];
    },
    async respond(messages: LlmMessage[]): Promise<string> {
      return openAiChatCompletion(config, messages);
    },
    async persistSession() {
      return;
    },
  };
}

function buildEidolonMemorySystemPrompt(memories: string[]): string {
  const memoryBlock =
    memories.length > 0 ? memories.map((memory) => `- ${memory}`).join("\n") : "- (no retrieved memories)";

  return [
    "You are an assistant using EidolonDB memory context.",
    "Treat the retrieved memory block below as the ground truth for prior discussions.",
    "Cross-check user claims against that memory before accepting them as facts.",
    "If the user references prior decisions or events that are not in retrieved memory, proactively say so clearly (for example: \"I don't have any record of that being discussed\") and avoid confirming the claim.",
    "When memory does support a claim, answer normally and cite the remembered details concisely.",
    "",
    "Retrieved memory context:",
    memoryBlock,
  ].join("\n");
}

export function createEidolonDbAgent(config: RuntimeConfig): EvalAgent {
  return {
    agentType: "eidolondb",
    async buildSessionSystemMessages(session: SessionDefinition): Promise<LlmMessage[]> {
      if (session.sessionNumber < 2) {
        return [];
      }

      const openingMessage = session.userMessages[0]?.content;
      if (openingMessage === undefined) {
        return [];
      }

      const memories = await queryRelevantMemories(config, openingMessage);
      return [
        {
          role: "system",
          content: buildEidolonMemorySystemPrompt(memories),
        },
      ];
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

export { EVAL_TENANT_ID };
