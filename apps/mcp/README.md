# @eidolondb/mcp

`@eidolondb/mcp` is a stdio Model Context Protocol (MCP) server that exposes EidolonDB memory operations to MCP-compatible clients. It lets tools like Cursor, Claude Code, and Windsurf store, query, ingest, and format memory context through a single MCP endpoint.

## Installation

Run directly with `npx` (no install needed):

```bash
npx @eidolondb/mcp
```

Or install globally:

```bash
npm install -g @eidolondb/mcp
```

## Self-hosted vs Cloud

### Self-hosted

Point `EIDOLONDB_URL` at your local EidolonDB instance. No API key needed — just set your tenant ID.

```json
{
  "EIDOLONDB_URL": "http://localhost:3000",
  "EIDOLONDB_TENANT": "my-tenant"
}
```

### Cloud (eidolondb.com)

Sign up at [eidolondb.com](https://eidolondb.com), create an API key from the dashboard, then use the cloud URL:

```json
{
  "EIDOLONDB_URL": "https://api.eidolondb.com",
  "EIDOLONDB_API_KEY": "eid_live_...",
  "EIDOLONDB_TENANT": "your-tenant-slug"
}
```

Your tenant slug and API key are both visible in the EidolonDB dashboard under **API Keys**.

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `EIDOLONDB_URL` | No | `http://localhost:3000` | Base URL of your EidolonDB API |
| `EIDOLONDB_API_KEY` | Cloud only | _(empty)_ | API key from your dashboard |
| `EIDOLONDB_TENANT` | No | `default` | Your tenant slug |

## MCP Client Setup

### Claude Code

```bash
claude mcp add eidolondb \
  --env EIDOLONDB_URL=https://api.eidolondb.com \
  --env EIDOLONDB_API_KEY=eid_live_... \
  --env EIDOLONDB_TENANT=your-tenant-slug \
  -- npx -y @eidolondb/mcp
```

Or add manually to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "eidolondb": {
      "command": "npx",
      "args": ["-y", "@eidolondb/mcp"],
      "env": {
        "EIDOLONDB_URL": "https://api.eidolondb.com",
        "EIDOLONDB_API_KEY": "eid_live_...",
        "EIDOLONDB_TENANT": "your-tenant-slug"
      }
    }
  }
}
```

### Cursor (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "eidolondb": {
      "command": "npx",
      "args": ["-y", "@eidolondb/mcp"],
      "env": {
        "EIDOLONDB_URL": "https://api.eidolondb.com",
        "EIDOLONDB_API_KEY": "eid_live_...",
        "EIDOLONDB_TENANT": "your-tenant-slug"
      }
    }
  }
}
```

### Windsurf / Generic stdio

```json
{
  "name": "eidolondb",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@eidolondb/mcp"],
  "env": {
    "EIDOLONDB_URL": "https://api.eidolondb.com",
    "EIDOLONDB_API_KEY": "eid_live_...",
    "EIDOLONDB_TENANT": "your-tenant-slug"
  }
}
```

## Available Tools

| Tool | Description | Key Params |
|---|---|---|
| `remember` | Store a memory | `content`, `tier`, `importance`, `tags` |
| `recall` | Semantic search across memories | `query`, `k`, `tier` |
| `ingest` | Feed raw text for auto-extraction | `text`, `source` |
| `forget` | Delete a memory by ID | `id` |
| `list_memories` | List recent memories with filters | `tier`, `tag`, `limit` |
| `get_context` | Build LLM-ready context from memory | `input`, `max_tokens` |
