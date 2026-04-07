import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { tenants } from '@/db/schema';
import { getTenantContextFromAuth } from '@/lib/db-utils';
import { stripe } from '@/lib/stripe';

export async function GET(request: Request): Promise<Response> {
  const tenant = await getTenantContextFromAuth();
  if (!tenant) {
    return Response.redirect(new URL('/dashboard?error=tenant_not_found', request.url));
  }

  if (!db || !stripe) {
    return Response.redirect(new URL('/billing?error=stripe_not_configured', request.url));
  }

  const row = await db
    .select({ stripeCustomerId: tenants.stripeCustomerId })
    .from(tenants)
    .where(eq(tenants.id, tenant.tenantId))
    .limit(1);

  const customerId = row[0]?.stripeCustomerId;
  if (!customerId) {
    return Response.redirect(new URL('/billing?error=no_customer', request.url));
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: new URL('/billing', request.url).toString(),
  });

  return Response.redirect(portal.url, 303);
}
