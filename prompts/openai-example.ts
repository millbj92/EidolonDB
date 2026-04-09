import OpenAI from "openai";
import { EidolonDB } from "@eidolondb/client";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

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
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const transcript: string[] = [];

  for (const { user } of turns) {
    const memories =
      activeSessionNumber > 1
        ? await db.recall(user, 10, activeSessionNumber)
        : [];
    const systemPrompt = buildSystemPrompt(memories);

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: user },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      messages,
    });

    const assistantText = completion.choices[0]?.message?.content ?? "";
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
