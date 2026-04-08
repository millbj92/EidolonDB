import OpenAI from "openai";
import { EidolonDB } from "@eidolondb/client";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

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

async function runOpenAITurn(userMessage: string): Promise<void> {
  // 1) Init EidolonDB + OpenAI clients
  const db = new EidolonDB({ url: "http://localhost:3000", tenant: "my-app" });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // 2) Recall relevant memories for this turn
  const memories = await db.recall(userMessage, 10);

  // 3) Build system prompt with injected memories
  const systemPrompt = buildSystemPrompt(memories);

  // 4) Send prompt + user message to OpenAI
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0,
    messages,
  });

  const assistantText = completion.choices[0]?.message?.content ?? "";
  console.log("Assistant:", assistantText);

  // 5) After session end, ingest transcript so it becomes memory
  const fullTranscriptText = [
    `User: ${userMessage}`,
    `Assistant: ${assistantText}`,
  ].join("\n");

  await db.ingest(fullTranscriptText, { source: "chat" });
}

void runOpenAITurn("Can you remind me what project name we settled on?").catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export { buildSystemPrompt, runOpenAITurn };
