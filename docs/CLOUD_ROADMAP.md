# EidolonDB Cloud Roadmap
**Last updated:** 2026-04-07

---

## Phase 3: Cloud Launch (estimated 4-6 weeks)

### 3A — `apps/web/` Next.js App

**What:** Single Next.js app serving both the marketing site and cloud dashboard.

**Structure:**
```
apps/web/
  app/
    (marketing)/          ← public pages
      page.tsx            ← landing page
      pricing/page.tsx
      blog/page.tsx
    (auth)/               ← auth pages
      sign-in/page.tsx
      sign-up/page.tsx
    (dashboard)/          ← protected cloud dashboard
      dashboard/page.tsx  ← usage overview
      memories/page.tsx   ← memory explorer (Mission Control lite)
      api-keys/page.tsx   ← generate/revoke keys
      billing/page.tsx    ← Stripe customer portal embed
      settings/page.tsx
  components/
  lib/
    auth.ts               ← Clerk helpers
    db.ts                 ← users/billing DB client (Neon)
    stripe.ts             ← Stripe client
    eidolondb.ts          ← EidolonDB admin client
```

**Tech:**
- Auth: Clerk (`@clerk/nextjs`)
- DB: Neon (separate from EidolonDB DB — stores users, tenants, API keys, usage)
- Billing: Stripe
- Deploy: Vercel

---

### 3B — Auth Gateway

**What:** Thin Fastify proxy that sits between the public internet and EidolonDB.

**Lives at:** `apps/gateway/` in the monorepo

**Does:**
1. Accepts `Authorization: Bearer <api_key>` on every request
2. Looks up `api_key → tenantId` in the users DB
3. Checks rate limits and plan quotas
4. Injects `x-tenant-id: <tenantId>` header
5. Proxies request to EidolonDB server (internal network only)
6. Increments usage counters (fire-and-forget)

**Routes:** Proxies all `/memories/*`, `/ingest`, `/lifecycle/*`, `/feedback/*`, `/relations/*`, `/events/*`, `/entities/*`, `/context/*`

**Security:**
- EidolonDB server bound to `127.0.0.1` or internal network only — never public
- Gateway is the only public entry point
- Rate limiting: 100 req/min free tier, 1000 req/min paid
- API key format: `eid_live_<32 random chars>` (live) / `eid_test_<32 random chars>` (test)

---

### 3C — Users & Billing DB Schema

New Neon database (separate from EidolonDB's memory DB):

```sql
-- Users (synced from Clerk webhooks)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenants (one per user for now, multiple later for teams)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  slug TEXT UNIQUE NOT NULL,       -- used as x-tenant-id
  plan TEXT DEFAULT 'free',        -- free | pro | team | enterprise
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Keys
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  key_hash TEXT UNIQUE NOT NULL,   -- bcrypt hash of the actual key
  key_prefix TEXT NOT NULL,        -- first 12 chars for display (eid_live_abc1...)
  label TEXT,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

-- Usage (rolling monthly counters)
CREATE TABLE usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  month TEXT NOT NULL,             -- YYYY-MM
  memories_created INT DEFAULT 0,
  queries INT DEFAULT 0,
  ingest_calls INT DEFAULT 0,
  lifecycle_runs INT DEFAULT 0,
  UNIQUE(tenant_id, month)
);
```

---

### 3D — Stripe Integration

**Plans:**

| Plan | Price | Limits |
|------|-------|--------|
| Free | $0 | 10k memories, 1k queries/mo, 1 API key |
| Pro | $29/mo | 500k memories, 100k queries/mo, 10 API keys |
| Team | $99/mo | Unlimited memories, 1M queries/mo, 50 API keys |
| Enterprise | Custom | Custom everything |

**Implementation:**
- Stripe Products/Prices created in Stripe dashboard
- `stripe.webhooks` handler in `apps/web/app/api/webhooks/stripe/route.ts`
- Events to handle: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- Customer portal: embed via `stripe.billingPortal.sessions.create`

---

### 3E — GitHub Actions: Deploy to Production

**`deploy-api.yml`** — deploys `apps/server/` to Railway on push to `main`
**`deploy-gateway.yml`** — deploys `apps/gateway/` to Railway on push to `main`
**`deploy-web.yml`** — Vercel handles this automatically via GitHub integration

---

## Phase 4: Growth Features (post-launch)

| Feature | Description | Priority |
|---------|-------------|----------|
| Multi-agent sharing | Visibility scopes + permissions between agents | P2 |
| Conflict resolution | Full LLM-powered dedup/merge | P2 |
| Team workspaces | Multiple users per tenant, roles | P2 |
| Usage analytics | Per-tenant memory quality scores, retrieval patterns | P3 |
| Webhook notifications | Notify on lifecycle events (distillation, expiry) | P3 |
| MCP integration | Model Context Protocol server for direct IDE/agent use | P1 |
| LangChain / LlamaIndex adapters | Drop-in memory provider | P1 |

---

## Pre-Launch Checklist

### Accounts to create
- [ ] Railway account — https://railway.app
- [ ] Neon account — https://neon.tech (Postgres + pgvector, Scale plan ~$19/mo)
- [ ] Clerk account — https://clerk.com (free up to 10k MAU)
- [ ] Stripe account — https://stripe.com (enable test mode first)
- [ ] Vercel account — https://vercel.com (free tier sufficient)
- [ ] GitHub org for `eidolondb` — for the public repo
- [ ] Domain: eidolondb.com (check availability — if taken, eidolondb.dev or useeidolon.com)

### DNS setup (once domain acquired)
- `eidolondb.com` → Vercel (landing + dashboard)
- `docs.eidolondb.com` → GitHub Pages or Vercel (VitePress docs)
- `api.eidolondb.com` → Railway (auth gateway — NOT the raw EidolonDB server)

### Before going public
- [ ] Auth gateway built and deployed
- [ ] Rate limiting enabled
- [ ] EidolonDB server NOT publicly accessible (internal Railway network only)
- [ ] Stripe test mode fully working (signup → paid → usage)
- [ ] README polished with eval results
- [ ] Docs site live at docs.eidolondb.com
- [ ] Landing page live at eidolondb.com
- [ ] At least one public GitHub release (v0.1.0)

### HN launch readiness
- [ ] Self-host guide works in under 5 minutes (test it fresh)
- [ ] Cloud signup flow works end-to-end
- [ ] Eval results prominently featured in README
- [ ] Response prepared for "how does this compare to Mem0/Zep?"
