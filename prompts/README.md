# Prompts

This directory contains starter prompt templates and wiring examples for integrating EidolonDB memory context into LLM agents.

## Files

- `system-prompt.md`: Canonical framework-agnostic system prompt template.
- `openai-example.ts`: Minimal OpenAI chat completions example with memory injection.
- `anthropic-example.ts`: Minimal Anthropic messages example with memory injection.

## Usage

1. Retrieve relevant EidolonDB memories for the current user message.
2. Inject those memories into the system prompt template.
3. Send the resulting system prompt with the user message to your model.
4. Ensure your agent proactively rejects unsupported claims not found in retrieved memory.
