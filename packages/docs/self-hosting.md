# Self-Hosting

## Docker Compose

From repo root:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Then check API:

```bash
curl http://localhost:3000/health
```

## Environment Variables

Required/important server variables:

- `DATABASE_URL`
- `OPENAI_API_KEY`
- `PORT`
- `HOST`
- `LOG_LEVEL`

## Production Notes (v0.1)

- v0.1 is optimized for local/dev-first usage.
- Run behind a reverse proxy with TLS in production.
- Use managed Postgres + backups.
- Apply tenant-level auth and rate-limiting before public exposure.
