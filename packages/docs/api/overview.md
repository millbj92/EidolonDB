# API Overview

Base URL (default local): `http://localhost:3000`

All endpoints require:

- Header: `x-tenant-id: <tenant>`
- Header: `content-type: application/json`

## Response Envelope Notes

Most REST endpoints return `{ data: ... }`.

Exceptions used in the current server:

- `POST /lifecycle/run` returns the object directly (no `data` wrapper)
- `GET /lifecycle/runs` returns `{ runs: [...] }`

The JS SDK normalizes this so methods return typed payloads directly.

## Endpoint Groups

- [Memories](/api/memories)
- [Ingest](/api/ingest)
- [Lifecycle](/api/lifecycle)
- [Relations](/api/relations)
- [Events](/api/events)
- [Entities](/api/entities)
- [Context](/api/context)
