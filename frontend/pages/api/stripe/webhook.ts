import type { NextApiRequest, NextApiResponse } from 'next'
import { buffer } from 'micro'
import Stripe from 'stripe'
import { stripe } from '../../../lib/stripe'
import { createClient } from '@supabase/supabase-js'

export const config = { api: { bodyParser: false } }

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type SubscriptionStatus = 'free' | 'starter' | 'pro' | 'enterprise'

function planFromPriceId(priceId: string): SubscriptionStatus {
  if (priceId === process.env.STRIPE_STARTER_PRICE_ID) return 'starter'
  if (priceId === process.env.STRIPE_PRO_PRICE_ID)     return 'pro'
  return 'starter'
}

async function updateUserSubscription(
  customerId: string,
  status: SubscriptionStatus,
  subscriptionId?: string
) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!profile) {
    console.error('[Webhook] No profile found for customer', customerId)
    return
  }

  await supabaseAdmin
    .from('profiles')
    .update({
      subscription_status: status,
      subscription_id: subscriptionId || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id)

  console.log(`[Webhook] Updated user ${profile.id} → ${status}`)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const buf = await buffer(req)
  const sig = req.headers['stripe-signature']!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('[Webhook] Signature verification failed:', err.message)
    return res.status(400).json({ error: `Webhook Error: ${err.message}` })
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
        const priceId = subscription.items.data[0]?.price?.id
        const plan = planFromPriceId(priceId)

        await updateUserSubscription(
          session.customer as string,
          plan,
          subscription.id
        )
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const priceId = subscription.items.data[0]?.price?.id
        const plan = subscription.status === 'active'
          ? planFromPriceId(priceId)
          : 'free'

        await updateUserSubscription(
          subscription.customer as string,
          plan,
          subscription.id
        )
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await updateUserSubscription(
          subscription.customer as string,
          'free'
        )
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        console.warn('[Webhook] Payment failed for customer', invoice.customer)
        // Could send email notification here
        break
      }

      default:
        console.log(`[Webhook] Unhandled event: ${event.type}`)
    }
  } catch (err: any) {
    console.error('[Webhook] Handler error:', err)
    return res.status(500).json({ error: 'Webhook handler failed' })
  }

  return res.status(200).json({ received: true })
}
