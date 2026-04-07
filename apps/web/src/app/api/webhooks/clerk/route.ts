import { Webhook } from 'svix';
import { eq, sql } from 'drizzle-orm';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { db } from '@/db/client';
import { apiKeys, tenants, users } from '@/db/schema';
import { generateApiKey, sanitizeSlug } from '@/lib/api-keys';
import { ensureTenantSlugIsUnique } from '@/lib/db-utils';

function getPrimaryEmail(event: WebhookEvent): string | null {
  if (event.type !== 'user.created') {
    return null;
  }

  const email = event.data.email_addresses.find(
    (addr) => addr.id === event.data.primary_email_address_id
  )?.email_address;

  return email ?? event.data.email_addresses[0]?.email_address ?? null;
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env['CLERK_WEBHOOK_SECRET'];
  if (!secret) {
    return Response.json({ message: 'CLERK_WEBHOOK_SECRET is missing.' }, { status: 500 });
  }

  if (!db) {
    return Response.json(
      { message: 'DATABASE_URL is not configured. Add it before processing webhooks.' },
      { status: 503 }
    );
  }

  // Clerk setup:
  // 1) Clerk Dashboard → Webhooks → Add endpoint
  // 2) URL: https://eidolondb.com/api/webhooks/clerk
  // 3) Events: user.created
  // 4) Add CLERK_WEBHOOK_SECRET to app env
  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json({ message: 'Missing Svix headers.' }, { status: 400 });
  }

  const payload = await request.text();
  const webhook = new Webhook(secret);

  let event: WebhookEvent;
  try {
    event = webhook.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent;
  } catch {
    return Response.json({ message: 'Invalid webhook signature.' }, { status: 400 });
  }

  if (event.type !== 'user.created') {
    return Response.json({ ok: true });
  }

  try {
    return await handleUserCreated(event);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('Webhook handler threw:', message, stack);
    return Response.json({ message: `Webhook handler error: ${message}` }, { status: 500 });
  }
}

async function handleUserCreated(event: WebhookEvent): Promise<Response> {
  if (!db) return Response.json({ message: 'DB not configured' }, { status: 503 });

  const email = getPrimaryEmail(event);
  if (!email) {
    return Response.json({ message: 'No email available on user.created event.' }, { status: 400 });
  }

  // Insert or ignore if already exists, then fetch the row
  // Upsert on clerk_id — never overwrite clerk_id based on email match
  await db.execute(
    sql`INSERT INTO users (clerk_id, email) VALUES (${event.data.id}, ${email!})
        ON CONFLICT (clerk_id) DO UPDATE SET email = EXCLUDED.email`
  );

  const userRows = await db.execute(
    sql`SELECT id, clerk_id, email, created_at FROM users WHERE clerk_id = ${event.data.id} LIMIT 1`
  );
  const rawUser = userRows.rows[0] as { id: string; clerk_id: string; email: string; created_at: string } | undefined;
  const userRecord = rawUser;
  if (!userRecord) {
    return Response.json({ message: 'Failed to locate user record after insert.' }, { status: 500 });
  }

  const existingTenant = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.userId, userRecord.id))
    .limit(1);

  if (existingTenant[0]) {
    return Response.json({ ok: true });
  }

  const baseSlug = sanitizeSlug(email.split('@')[0] ?? 'tenant');
  const slug = await ensureTenantSlugIsUnique(baseSlug);
  const tenantInsert = await db
    .insert(tenants)
    .values({
      userId: userRecord.id,
      slug,
    })
    .returning({ id: tenants.id });

  const tenantRecord = tenantInsert[0];
  if (!tenantRecord) {
    return Response.json({ message: 'Failed to create tenant record.' }, { status: 500 });
  }

  const firstKey = await generateApiKey();
  await db.insert(apiKeys).values({
    tenantId: tenantRecord.id,
    keyHash: firstKey.keyHash,
    keyPrefix: firstKey.keyPrefix,
    label: 'Default key',
  });

  return Response.json({ ok: true });
}
