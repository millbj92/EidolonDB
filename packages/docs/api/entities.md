# Entities API

Entities model actors and objects (users, agents, teams, projects, etc.).

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/entities` | Create entity |
| GET | `/entities/:id` | Get entity |

## SDK Surface

The JavaScript SDK also exposes:

- `db.entities.list(options?)`
- `db.entities.update(id, input)`
- `db.entities.delete(id)`

If your deployed server version does not yet expose those routes, use current available endpoints above.

## Example: Create entity

```bash
curl -X POST http://localhost:3000/entities \
  -H 'x-tenant-id: my-app' \
  -H 'content-type: application/json' \
  -d '{
    "type":"user",
    "name":"Alice",
    "properties":{"role":"PM"},
    "tags":["team"]
  }'
```
