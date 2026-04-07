# Tiers

## Tier Reference

### `short_term`

- Purpose: immediate conversational context
- Typical content: transient details, near-term intent, short-lived context
- Lifecycle: expires quickly unless reinforced by access patterns

### `episodic`

- Purpose: session/project-level events and decisions
- Typical content: milestones, incidents, meeting outcomes
- Lifecycle: can be distilled into semantic facts or archived

### `semantic`

- Purpose: stable durable knowledge
- Typical content: long-lived facts, preferences, canonical decisions
- Lifecycle: treated as permanent in current lifecycle defaults

## When to Use Each

- Use `short_term` when information is likely to become stale soon.
- Use `episodic` for meaningful events that may later distill.
- Use `semantic` for durable facts you want recalled across long time spans.

## Automatic Promotion and Decay

```text
raw input
  |
  v
[short_term] --(access_count >= 2)--> [episodic]
  |                                       |
  |--(24h unaccessed)--> expired          |--(importance/access + age)--> distilled -> [semantic]
                                          |
                                          |--(30d + low access)--> archived
```

## Lifecycle Configuration

Default rules in the server:

- `short_term.expireAfterMs = 24h`
- `short_term.promoteIfAccessCount = 2`
- `episodic.distillAfterMs = 7d`
- `episodic.archiveAfterMs = 30d`

See [Lifecycle API](/api/lifecycle) for run controls (`dryRun`, `triggeredBy`).
