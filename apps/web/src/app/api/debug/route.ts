// DELETE THIS FILE after debugging
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/db/client';
import { getTenantContextFromAuth } from '@/lib/db-utils';
import { sql } from 'drizzle-orm';

export async function GET(): Promise<Response> {
  const { userId } = await auth();
  const user = await currentUser();
  const tenant = await getTenantContextFromAuth();

  const dbUsers = db ? await db.execute(sql`SELECT id, email, clerk_id FROM users LIMIT 5`) : null;

  return Response.json({
    clerkUserId: userId,
    clerkEmail: user?.primaryEmailAddress?.emailAddress,
    tenantFound: !!tenant,
    tenant,
    dbUsers: dbUsers?.rows ?? null,
    dbConfigured: !!db,
  });
}
