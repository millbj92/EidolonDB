# Context API

Build LLM-ready message context from current input + retrieved memory.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/context/build` | Build prompt/context package |

## Request body

```json
{
  "agentEntityId": "optional-uuid",
  "userEntityId": "optional-uuid",
  "goal": "Answer accurately and concisely",
  "currentInput": "How should I respond to this user?",
  "maxTokens": 4000,
  "strategy": {
    "tiers": ["semantic", "episodic"],
    "perTierCaps": { "semantic": 20, "episodic": 10, "short_term": 10 },
    "weights": { "semantic": 0.7, "recency": 0.2, "importance": 0.1 },
    "tags": ["support"],
    "topics": ["billing"],
    "includeSystemPrompt": true
  }
}
```

## Response shape

```json
{
  "data": {
    "messages": [
      { "role": "system", "content": "...", "metadata": { "source": "system_prompt" } },
      { "role": "system", "content": "Relevant context from memory:\n...", "metadata": { "source": "memory", "memoryIds": ["uuid"] } },
      { "role": "user", "content": "How should I respond to this user?", "metadata": { "source": "current_input" } }
    ],
    "rawMemories": [
      {
        "memory": { "id": "uuid", "content": "...", "tier": "semantic" },
        "score": 0.82,
        "tier": "semantic"
      }
    ],
    "metadata": {
      "totalTokensEstimated": 742,
      "memoriesIncluded": 6,
      "memoriesQueried": 23,
      "tiersQueried": ["semantic", "episodic"]
    }
  }
}
```

## Curl example

```bash
curl -X POST http://localhost:3000/context/build \
  -H 'x-tenant-id: my-app' \
  -H 'content-type: application/json' \
  -d '{"currentInput":"Summarize project decisions.","maxTokens":2000}'
```
