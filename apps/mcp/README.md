# @eidolondb/mcp

`@eidolondb/mcp` is a stdio Model Context Protocol (MCP) server that exposes EidolonDB memory operations to MCP-compatible clients. It lets tools like Cursor, Claude Code, and Windsurf store, query, ingest, and format memory context through a single MCP endpoint.

## Installation

Run directly with `npx`:

```bash
npx @eidolondb/mcp
```

Or install globally:

```bash
npm install -g @eidolondb/mcp
eidolondb-mcp
```

## Configuration

Set environment variables before launching the MCP server:

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `EIDOLONDB_URL` | No | `http://localhost:3000` | Base URL of your EidolonDB API |
| `EIDOLONDB_API_KEY` | No | _(empty)_ | API key sent as `Authorization: Bearer ...` |
| `EIDOLONDB_TENANT` | No | `default` | Tenant ID sent as `x-tenant-id` |

Copy `apps/mcp/.env.example` as needed.

## MCP Client Setup

### Cursor (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "eidolondb": {
      "command": "npx",
      "args": ["-y", "@eidolondb/mcp"],
      "env": {
        "EIDOLONDB_URL": "http://localhost:3000",
        "EIDOLONDB_TENANT": "default",
        "EIDOLONDB_API_KEY": ""
      }
    }
  }
}
```

### Claude Code (`~/.claude/mcp.json`)

```json
{
  "mcpServers": {
    "eidolondb": {
      "command": "npx",
      "args": ["-y", "@eidolondb/mcp"],
      "env": {
        "EIDOLONDB_URL": "http://localhost:3000",
        "EIDOLONDB_TENANT": "default",
        "EIDOLONDB_API_KEY": ""
      }
    }
  }
}
```

### Generic stdio config

```json
{
  "name": "eidolondb",
  "transport": "stdio",
  "command": "eidolondb-mcp",
  "args": [],
  "env": {
    "EIDOLONDB_URL": "http://localhost:3000",
    "EIDOLONDB_TENANT": "default",
    "EIDOLONDB_API_KEY": ""
  }
}
```

## Available Tools

| Tool | Description | Key Params |
| --- | --- | --- |
| `remember` | Store a memory in EidolonDB | `content`, `tier`, `importance`, `tags` |
| `recall` | Search memories by semantic query | `query`, `k`, `tier` |
| `ingest` | Ingest raw text for automatic extraction/classification | `text`, `source` |
| `forget` | Delete one memory by ID | `id` |
| `list_memories` | List recent memories with optional filters | `tier`, `tag`, `limit` |
| `get_context` | Build LLM-ready context from memory | `input`, `max_tokens` |

## Self-Hosted vs Cloud

For self-hosted use, point `EIDOLONDB_URL` to your local or private deployment. For cloud usage, point it to your hosted EidolonDB API endpoint and provide the appropriate tenant and API key.
