import Anthropic from "@anthropic-ai/sdk";
import { EidolonDB } from "@eidolondb/client";

const SYSTEM_PROMPT_TEMPLATE = `
You are an assistant that can use retrieved memory context from prior conversations.
Treat the injected memory block as the source of truth for what was previously discussed.
Cross-check user claims against memory before confirming them.
If a claim is not present, proactively say: "I don't have any record of that being discussed."
Do not invent prior context.

Retrieved memories:
{{EIDOLONDB_RETRIEVED_MEMORIES}}
`.trim();

function buildSystemPrompt(memories: string[]): string {
  const memoryBlock =
    memories.length > 0
      ? memories.map((memory) => `- ${memory}`).join("\n")
      : "- (no retrieved memories)";

  return SYSTEM_PROMPT_TEMPLATE.replace("{{EIDOLONDB_RETRIEVED_MEMORIES}}", memoryBlock);
}

async function runAnthropicTurn(userMessage: string): Promise<void> {
  // 1) Init EidolonDB + Anthropic clients
  const db = new EidolonDB({ url: "http://localhost:3000", tenant: "my-app" });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // 2) Recall relevant memories for this turn
  const memories = await db.recall(userMessage, 10);

  // 3) Build system prompt with injected memories
  const systemPrompt = buildSystemPrompt(memories);

  // 4) Send prompt + user message to Anthropic
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 400,
    temperature: 0,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const assistantText = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  console.log("Assistant:", assistantText);

  // 5) After session end, ingest transcript so it becomes memory
  const fullTranscriptText = [
    `User: ${userMessage}`,
    `Assistant: ${assistantText}`,
  ].join("\n");

  await db.ingest(fullTranscriptText, { source: "chat" });
}

void runAnthropicTurn("What did we decide about the deployment window?").catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export { buildSystemPrompt, runAnthropicTurn };
