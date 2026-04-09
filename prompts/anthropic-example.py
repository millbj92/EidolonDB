import os
from typing import Dict, List

import anthropic
from eidolondb import EidolonDB

SYSTEM_PROMPT_TEMPLATE = """
You are an assistant that can use retrieved memory context from prior conversations.
Answer directly from context - no disclaimers, no "based on our conversation" preamble.

Questions asking what happened, what was decided, or what was discussed are RECALL REQUESTS - answer them directly from retrieved memories. Do not reject them.

CRITICAL: Cross-check any past-session assertions against your retrieved memories before confirming them. If a user claims something was discussed but it is absent from retrieved memories, say so clearly.

If memories contain conflicting information, mention both and note which is more recent.

Retrieved memories:
{{EIDOLONDB_RETRIEVED_MEMORIES}}
""".strip()


def build_system_prompt(memories: List[str]) -> str:
    memory_block = "\n".join(f"- {memory}" for memory in memories) if memories else "- (no retrieved memories)"
    return SYSTEM_PROMPT_TEMPLATE.replace("{{EIDOLONDB_RETRIEVED_MEMORIES}}", memory_block)


# Increment this each new conversation. In production, read/write this from persistent storage (DB, file, etc.).
active_session_number = 1


def run_session(turns: List[Dict[str, str]]) -> None:
    db = EidolonDB(url="http://localhost:3000", tenant="my-app")
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    transcript: List[str] = []

    for turn in turns:
        user_message = turn["user"]
        memories = db.recall(user_message, 10, active_session_number) if active_session_number > 1 else []
        system_prompt = build_system_prompt(memories)

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
        transcript.extend([f"User: {user_message}", f"Assistant: {assistant_text}"])

    db.ingest(
        "\n".join(transcript),
        source="chat",
        metadata={"sessionNumber": active_session_number},
    )


if __name__ == "__main__":
    run_session(
        [
            {"user": "What agreement did we make about incident postmortems?"},
            {"user": "What decisions did we make in our last session?"},
        ]
    )
