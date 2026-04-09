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

  const plan = new URL(request.url).searchParams.get('plan');
  const normalizedPlan = plan === 'growth' ? 'growth' : 'developer';
  const priceId =
    normalizedPlan === 'growth'
      ? process.env['STRIPE_GROWTH_PRICE_ID']
      : process.env['STRIPE_DEVELOPER_PRICE_ID'];
  if (!priceId) {
    return Response.redirect(new URL('/billing?error=missing_price_id', request.url));
  }

  const existing = await db
    .select({ stripeCustomerId: tenants.stripeCustomerId })
    .from(tenants)
    .where(eq(tenants.id, tenant.tenantId))
    .limit(1);
  const customerId = existing[0]?.stripeCustomerId ?? null;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId ?? undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: new URL('/billing?success=1', request.url).toString(),
    cancel_url: new URL('/billing?canceled=1', request.url).toString(),
    metadata: {
      tenantId: tenant.tenantId,
      plan: normalizedPlan,
    },
  });

  return Response.redirect(session.url ?? new URL('/billing?error=checkout_session', request.url), 303);
}
