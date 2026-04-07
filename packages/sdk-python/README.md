# eidolondb

Official Python client for EidolonDB.

## Install

```bash
pip install eidolondb
```

## Quick start

```python
from eidolondb import EidolonDB

db = EidolonDB(url="http://localhost:3000", tenant="my-app")

# Store a memory
db.remember("User prefers dark mode", importance=0.9, tags=["preference"])

# Recall
context = db.recall("user preferences")

# Auto-extract from raw text
result = db.ingest("Today we decided on FastAPI for the backend. Port 8000.")

# Full search
results = db.memories.search("project decisions", k=5)
```

## API reference

### `memories`

```python
db.memories.create(tier, content, **kwargs)
db.memories.get(memory_id)
db.memories.list(...)
db.memories.update(memory_id, **kwargs)
db.memories.delete(memory_id)
db.memories.search(text, **kwargs)
db.memories.record_access(memory_id)
db.memories.stats()
```

### `entities`

```python
db.entities.create(**kwargs)
db.entities.get(entity_id)
db.entities.list(...)
db.entities.update(entity_id, **kwargs)
db.entities.delete(entity_id)
```

### `artifacts`

```python
db.artifacts.create(**kwargs)
db.artifacts.get(artifact_id)
db.artifacts.delete(artifact_id)
```

### `relations`

```python
db.relations.create(**kwargs)
db.relations.list(...)
db.relations.get(relation_id)
db.relations.delete(relation_id)
db.relations.traverse(...)
```

### `events`

```python
db.events.create(**kwargs)
db.events.list(...)
db.events.get(event_id)
db.events.timeline(...)
```

### `context`

```python
db.context.build(current_input, **kwargs)
```

### `lifecycle`

```python
db.lifecycle.run(dry_run=False, triggered_by="manual")
db.lifecycle.list_runs(limit=20)
```

### `ingest` + convenience helpers

```python
db.ingest(content, source="chat", **kwargs)
db.search(query, **kwargs)
db.remember(content, importance=0.8, tags=None, tier="semantic")
db.recall(query, k=10)
```

### `feedback`

```python
db.feedback.mark_used(memory_id, query=None, retrieval_score=None, relevance=None, metadata=None)
db.feedback.retrieval_stats()
```

## Error handling

All API failures raise `EidolonDBError`.

```python
from eidolondb import EidolonDB, EidolonDBError

db = EidolonDB(url="http://localhost:3000", tenant="my-app")

try:
    db.memories.get("missing-id")
except EidolonDBError as error:
    print(error.status, error.message, error.body)
```

## Python version

Requires Python `>=3.9`.
