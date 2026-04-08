import os
from typing import List

import anthropic
from eidolondb import EidolonDB

SYSTEM_PROMPT_TEMPLATE = """
You are an assistant that can use retrieved memory context from prior conversations.
Treat the injected memory block as the source of truth for what was previously discussed.
Cross-check user claims against memory before confirming them.
If a claim is not present, proactively say: "I don't have any record of that being discussed."
Do not invent prior context.

Retrieved memories:
{{EIDOLONDB_RETRIEVED_MEMORIES}}
""".strip()


def build_system_prompt(memories: List[str]) -> str:
    memory_block = "\n".join(f"- {memory}" for memory in memories) if memories else "- (no retrieved memories)"
    return SYSTEM_PROMPT_TEMPLATE.replace("{{EIDOLONDB_RETRIEVED_MEMORIES}}", memory_block)


def run_anthropic_turn(user_message: str) -> None:
    # 1) Init EidolonDB + Anthropic clients
    db = EidolonDB(url="http://localhost:3000", tenant="my-app")
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    # 2) Recall relevant memories for this turn
    memories = db.recall(user_message, 10)

    # 3) Build system prompt with injected memories
    system_prompt = build_system_prompt(memories)

    # 4) Send prompt + user message to Anthropic
    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=400,
        temperature=0,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )
    assistant_text = "\n".join(
        block.text for block in response.content if block.type == "text"
    ).strip()
    print(f"Assistant: {assistant_text}")

    # 5) After session end, ingest transcript so it becomes memory
    full_transcript_text = f"User: {user_message}\nAssistant: {assistant_text}"
    db.ingest(full_transcript_text, source="chat")

    # OpenAI Python wiring is identical in structure: recall -> build prompt -> chat.completions.create -> ingest.


if __name__ == "__main__":
    run_anthropic_turn("Which migration checklist did we agree to follow?")
