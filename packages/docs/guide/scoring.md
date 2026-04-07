# Scoring

Hybrid retrieval ranks memories using a weighted score:

`final = semantic * w_semantic + recency * w_recency + importance * w_importance`

Default weights (if unspecified):

- `semantic`: `0.7`
- `recency`: `0.2`
- `importance`: `0.1`

## Importance Score

`importanceScore` is a `0..1` value on each memory. Higher values boost ranking and influence lifecycle behavior (for example distillation decisions in episodic memory).

## Recency Score

Recency decays over time. A common interpretation is exponential decay with a 7-day half-life:

`recency(t) = 0.5 ^ (age_days / 7)`

This preserves recent relevance without discarding older high-signal memory.

## Semantic Score

Semantic relevance is computed from embedding similarity (cosine-style similarity from nearest-neighbor vector search).

## Hybrid Ranking in Practice

When you query `POST /memories/query` or `db.memories.search(...)`:

- semantic match finds related content
- recency favors newer events
- importance keeps high-value memory ranked

Tune weights per use case with `weights` in query options.
