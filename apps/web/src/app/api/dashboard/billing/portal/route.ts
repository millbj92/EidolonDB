import { getTenantContextFromAuth } from '@/lib/db-utils';
import { stripe } from '@/lib/stripe';
import { db } from '@/db/client';
import { tenants } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: Request): Promise<Response> {
  const tenant = await getTenantContextFromAuth();
  if (!tenant || !db || !stripe) {
    return Response.redirect(new URL('/billing?error=not_configured', request.url));
  }

  const rows = await db
    .select({ stripeCustomerId: tenants.stripeCustomerId })
    .from(tenants)
    .where(eq(tenants.id, tenant.tenantId))
    .limit(1);

  const customerId = rows[0]?.stripeCustomerId;
  if (!customerId) {
    return Response.redirect(new URL('/billing?error=no_customer', request.url));
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: new URL('/billing', request.url).toString(),
  });

  return Response.redirect(session.url, 303);
}
