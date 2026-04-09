import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { tenants } from '@/db/schema';
import { stripe } from '@/lib/stripe';

function planFromPriceId(priceId: string | null | undefined): 'free' | 'developer' | 'growth' {
  if (priceId && priceId === process.env['STRIPE_GROWTH_PRICE_ID']) {
    return 'growth';
  }
  if (priceId && priceId === process.env['STRIPE_DEVELOPER_PRICE_ID']) {
    return 'developer';
  }
  return 'free';
}

async function updateTenantFromCustomer(
  customerId: string | null,
  update: { plan?: string; stripeSubscriptionId?: string | null }
) {
  if (!db || !customerId) return;

  await db
    .update(tenants)
    .set({
      ...(update.plan ? { plan: update.plan } : {}),
      ...(update.stripeSubscriptionId !== undefined
        ? { stripeSubscriptionId: update.stripeSubscriptionId }
        : {}),
    })
    .where(eq(tenants.stripeCustomerId, customerId));
}

export async function POST(request: Request): Promise<Response> {
  if (!db) {
    return Response.json(
      { message: 'USERS_DATABASE_URL is not configured. Add it before processing webhooks.' },
      { status: 503 }
    );
  }

  if (!stripe) {
    return Response.json({ message: 'STRIPE_SECRET_KEY is missing.' }, { status: 500 });
  }

  const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];
  if (!webhookSecret) {
    return Response.json({ message: 'STRIPE_WEBHOOK_SECRET is missing.' }, { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return Response.json({ message: 'Missing Stripe signature header.' }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return Response.json({ message: 'Invalid Stripe signature.' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerId = typeof session.customer === 'string' ? session.customer : null;
    const tenantId =
      typeof session.metadata?.['tenantId'] === 'string' ? session.metadata['tenantId'] : null;
    // metadata.plan is already the plan name (e.g. 'developer'), not a price ID
    const rawPlan = session.metadata?.['plan'];
    const plan: 'free' | 'developer' | 'growth' =
      rawPlan === 'growth' ? 'growth' : rawPlan === 'developer' ? 'developer' : 'free';

    if (tenantId) {
      await db
        .update(tenants)
        .set({ plan, stripeCustomerId: customerId ?? undefined })
        .where(eq(tenants.id, tenantId));
    } else {
      await updateTenantFromCustomer(customerId, { plan });
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId =
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    const firstItem = subscription.items.data[0];
    const plan = planFromPriceId(firstItem?.price.id);
    await updateTenantFromCustomer(customerId, {
      plan,
      stripeSubscriptionId: subscription.id,
    });
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId =
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    await updateTenantFromCustomer(customerId, {
      plan: 'free',
      stripeSubscriptionId: null,
    });
  }

  return Response.json({ ok: true });
}
