# Relations API

Create and traverse graph edges between `entity`, `artifact`, and `memory` nodes.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/relations` | Create a relation |
| GET | `/relations` | List relations |
| GET | `/relations/:id` | Get relation |
| DELETE | `/relations/:id` | Delete relation |
| GET | `/relations/traverse` | Graph traversal |

## Example: Create relation

```bash
curl -X POST http://localhost:3000/relations \
  -H 'x-tenant-id: my-app' \
  -H 'content-type: application/json' \
  -d '{
    "type":"describes",
    "fromType":"entity",
    "fromId":"11111111-1111-1111-1111-111111111111",
    "toType":"memory",
    "toId":"22222222-2222-2222-2222-222222222222",
    "weight":0.9
  }'
```

## Traverse Example

```bash
curl 'http://localhost:3000/relations/traverse?startType=entity&startId=11111111-1111-1111-1111-111111111111&depth=2&direction=both' \
  -H 'x-tenant-id: my-app'
```
