import Anthropic from "@anthropic-ai/sdk";
import { EidolonDB } from "@eidolondb/client";

const SYSTEM_PROMPT_TEMPLATE = `
You are an assistant that can use retrieved memory context from prior conversations.
Answer directly from context - no disclaimers, no "based on our conversation" preamble.

Questions asking what happened, what was decided, or what was discussed are RECALL REQUESTS - answer them directly from retrieved memories. Do not reject them.

CRITICAL: Cross-check any past-session assertions against your retrieved memories before confirming them. If a user claims something was discussed but it is absent from retrieved memories, say so clearly.

If memories contain conflicting information, mention both and note which is more recent.

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

// Increment this each new conversation. In production, read/write this from persistent storage (DB, file, etc.).
let activeSessionNumber = 1;

async function runSession(turns: Array<{ user: string }>): Promise<void> {
  const db = new EidolonDB({ url: "http://localhost:3000", tenant: "my-app" });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const transcript: string[] = [];

  for (const { user } of turns) {
    const memories =
      activeSessionNumber > 1
        ? await db.recall(user, 10, activeSessionNumber)
        : [];
    const systemPrompt = buildSystemPrompt(memories);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 400,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: "user", content: user }],
    });

    const assistantText = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    console.log("Assistant:", assistantText);
    transcript.push(`User: ${user}`, `Assistant: ${assistantText}`);
  }

  await db.ingest(transcript.join("\n"), {
    source: "chat",
    metadata: { sessionNumber: activeSessionNumber },
  });
}

void runSession([
  { user: "What project name did we settle on last session?" },
  { user: "What was the deployment window we agreed on?" },
]).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export { buildSystemPrompt, runSession };
