import { after } from 'next/server';
import { flushAfterResponse } from 'dripmetric/server';
import { dripmetric } from '@/lib/dripmetric';

/**
 * Checkout. In a real app this is where the Stripe session is created, and you pass
 * the user id to Stripe as `client_reference_id` so billing events can be joined
 * back to the person (brief section 12).
 */
export async function POST(request: Request) {
  const { userId } = (await request.json()) as { userId: string };

  dripmetric.track(userId, 'Checkout Started', {
    plan: 'pro',
    amount: 2900,
    currency: 'usd',
    // 'trial' here would mean a card-up-front trial, which earns no intent points
    // and is never a last-moment drop (brief section 8.3).
    type: 'purchase',
  });

  flushAfterResponse(dripmetric, after);
  return Response.json({ sent: ['Checkout Started'] });
}
