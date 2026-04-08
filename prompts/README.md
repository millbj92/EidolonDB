# Prompts

This directory contains starter prompt templates and wiring examples for integrating EidolonDB memory context into LLM agents.

## Files

- `system-prompt.md`: Canonical framework-agnostic system prompt template.
- `openai-example.ts`: TypeScript example using `@eidolondb/client` + OpenAI SDK.
- `anthropic-example.ts`: TypeScript example using `@eidolondb/client` + Anthropic SDK.
- `openai-example.py`: Python example using `eidolondb` + OpenAI SDK.
- `anthropic-example.py`: Python example using `eidolondb` + Anthropic SDK.
- `README.md`: This guide.

## Which method should I use?

- `recall()`: Query relevant memories before each LLM turn.
- `ingest()`: Store a raw conversation/transcript at the end of a session; EidolonDB will extract + classify automatically.
- `remember()`: Store one explicit fact you already know, without extraction.

`ingest()` is the recommended end-of-session storage method.

## Usage Pattern

1. Retrieve relevant EidolonDB memories for the current user message.
2. Inject those memories into the system prompt template.
3. Send the resulting system prompt with the user message to your model.
4. Store the session transcript with `ingest()` when the session ends.
