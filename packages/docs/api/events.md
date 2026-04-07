# Events API

Events capture timestamped occurrences with optional actor linkage.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/events` | Create event |
| GET | `/events` | List events |
| GET | `/events/:id` | Get event |
| GET | `/events/timeline` | Daily timeline aggregation |

## Example: Create event

```bash
curl -X POST http://localhost:3000/events \
  -H 'x-tenant-id: my-app' \
  -H 'content-type: application/json' \
  -d '{
    "actorEntityId":"11111111-1111-1111-1111-111111111111",
    "eventType":"deployment",
    "payload":{"service":"api","version":"0.1.0"},
    "tags":["release"]
  }'
```

## Timeline Example

```bash
curl 'http://localhost:3000/events/timeline?days=14&eventType=deployment' \
  -H 'x-tenant-id: my-app'
```
