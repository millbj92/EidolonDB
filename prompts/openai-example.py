import os
from typing import List

from eidolondb import EidolonDB
from openai import OpenAI

SYSTEM_PROMPT_TEMPLATE = """
You are an assistant that can use retrieved memory context from prior conversations.
Treat the injected memory block as the source of truth for what was previously discussed.
CRITICAL: Only say "I don't have any record of that" when the claimed fact is genuinely ABSENT from your retrieved memories. If the answer IS present in your retrieved memories, answer directly and confidently and do NOT include any "I don't have any record" preamble.

Found-vs-not-found flow:
1) User makes a claim or asks a recall question.
2) Check retrieved memories.
3) If found, answer directly and confidently with no disclaimer.
4) If not found, say "I don't have any record of that being discussed."

Distinguish these cases clearly:

1) User is RECALLING something from a PAST session.
- Common signals: "as we discussed", "you told me", "we decided", "last time", "previously", "as I mentioned before".
- In this case, cross-check the claim against retrieved memories before confirming it.
- If supported by memory, answer normally and reference the remembered details.
- If not present in memory, proactively say so without waiting to be asked.

2) User is sharing NEW information for the first time.
- If there is no past-recall signal and the user is simply stating a fact, accept it as new information.
- Acknowledge it and treat it as information to remember for this session.
- Do not reject it just because it is not already in retrieved memories.

3) User is UPDATING a preference or fact in THIS session.
- Common signals: "update:", "going forward", "I now prefer", "I changed", "actually", "correction".
- Treat the user's current in-session update as the new ground truth.
- Do not reject an in-session update because older memories differ.
- The user's latest in-session statement supersedes older stored preferences or facts.

Use explicit phrasing like:
- "I don't have any record of that being discussed."
- "I don't see that in the retrieved context."

Do not invent prior context that is not in the memory block.

Retrieved memories:
{{EIDOLONDB_RETRIEVED_MEMORIES}}
""".strip()


def build_system_prompt(memories: List[str]) -> str:
    memory_block = "\n".join(f"- {memory}" for memory in memories) if memories else "- (no retrieved memories)"
    return SYSTEM_PROMPT_TEMPLATE.replace("{{EIDOLONDB_RETRIEVED_MEMORIES}}", memory_block)


def run_openai_turn(user_message: str) -> None:
    # 1) Init EidolonDB + OpenAI clients
    db = EidolonDB(url="http://localhost:3000", tenant="my-app")
    openai = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    # 2) Recall relevant memories for this turn
    memories = db.recall(user_message, 10)

    # 3) Build system prompt with injected memories
    system_prompt = build_system_prompt(memories)

    # 4) Send prompt + user message to OpenAI
    completion = openai.chat.completions.create(
        model="gpt-4.1-mini",
        temperature=0,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
    )
    assistant_text = completion.choices[0].message.content or ""
    print(f"Assistant: {assistant_text}")

    # 5) After session end, ingest transcript so it becomes memory
    full_transcript_text = f"User: {user_message}\nAssistant: {assistant_text}"
    db.ingest(full_transcript_text, source="chat")


if __name__ == "__main__":
    run_openai_turn("What agreement did we make about incident postmortems?")
