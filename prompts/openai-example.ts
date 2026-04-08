import OpenAI from "openai";

const SYSTEM_PROMPT_TEMPLATE = `
You are an assistant that can use retrieved memory context from prior conversations.
Treat the injected memory block as the source of truth for what was previously discussed.
Cross-check user claims against memory before confirming them.
If a claim is not present, proactively say: "I don't have any record of that being discussed."
Do not invent prior context.

Retrieved memories:
{{EIDOLONDB_RETRIEVED_MEMORIES}}
`.trim();

function buildSystemPrompt(retrievedMemories: string[]): string {
  const memoryText =
    retrievedMemories.length > 0
      ? retrievedMemories.map((memory) => `- ${memory}`).join("\n")
      : "- (no retrieved memories)";

  return SYSTEM_PROMPT_TEMPLATE.replace("{{EIDOLONDB_RETRIEVED_MEMORIES}}", memoryText);
}

async function respondWithMemoryContext(params: {
  apiKey: string;
  model: string;
  userMessage: string;
  retrievedMemories: string[];
}): Promise<string> {
  const client = new OpenAI({ apiKey: params.apiKey });

  const completion = await client.chat.completions.create({
    model: params.model,
    temperature: 0,
    messages: [
      { role: "system", content: buildSystemPrompt(params.retrievedMemories) },
      { role: "user", content: params.userMessage },
    ],
  });

  return completion.choices[0]?.message?.content ?? "";
}

export { respondWithMemoryContext, buildSystemPrompt };
