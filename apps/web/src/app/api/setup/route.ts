// One-time tenant setup route for users who signed up before the webhook was working.
// DELETE THIS FILE after launch.
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { apiKeys, tenants, users } from '@/db/schema';
import { generateApiKey, sanitizeSlug } from '@/lib/api-keys';
import { ensureTenantSlugIsUnique } from '@/lib/db-utils';

export async function POST(): Promise<Response> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!db) {
    return Response.json({ error: 'DB not configured' }, { status: 503 });
  }

  const userRows = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  const user = userRows[0];
  if (!user) {
    return Response.json({ error: 'User not found in DB' }, { status: 404 });
  }

  const existing = await db.select().from(tenants).where(eq(tenants.userId, user.id)).limit(1);
  if (existing[0]) {
    return Response.json({ ok: true, message: 'Tenant already exists', slug: existing[0].slug });
  }

  const baseSlug = sanitizeSlug(user.email?.split('@')[0] ?? 'tenant');
  const slug = await ensureTenantSlugIsUnique(baseSlug);

  const tenantInsert = await db.insert(tenants).values({ userId: user.id, slug }).returning({ id: tenants.id, slug: tenants.slug });
  const tenant = tenantInsert[0];
  if (!tenant) {
    return Response.json({ error: 'Failed to create tenant' }, { status: 500 });
  }

  const key = await generateApiKey();
  await db.insert(apiKeys).values({ tenantId: tenant.id, keyHash: key.keyHash, keyPrefix: key.keyPrefix, label: 'Default key' });

  return Response.json({ ok: true, slug: tenant.slug, apiKey: key.fullKey, message: 'Save your API key — shown once only.' });
}
