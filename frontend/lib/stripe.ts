// frontend/lib/stripe.ts
import Stripe from 'stripe'
import { loadStripe } from '@stripe/stripe-js'

// ── Server-side Stripe client ────────────────────────────────────────
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
})

// ── Browser-side Stripe promise ──────────────────────────────────────
let stripePromise: ReturnType<typeof loadStripe>
export function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
  }
  return stripePromise
}

// ── Plan definitions — single Pro plan at $299/month ─────────────────
export const PLANS = {
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 299,
    interval: 'month',
    priceId: process.env.STRIPE_PRO_PRICE_ID!,
    highlighted: true,
    features: [
      'Unlimited revenue bridge analysis',
      'Export CSV (unlimited)',
      'AI revenue advisor chat',
      'NRR / GRR waterfall',
      'Top movers intelligence',
      'Historical performance tab',
      'Cohort retention heatmaps',
      'ACV / contract analytics',
      'Email support',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: null,
    interval: 'month',
    priceId: null,
    highlighted: false,
    features: [
      'Everything in Pro',
      'Multi-portfolio dashboard',
      'Custom data connectors',
      'White-label reports',
      'Dedicated CSM',
      'SLA 99.9% uptime',
      'Custom contract',
    ],
  },
} as const

export type PlanId = keyof typeof PLANS
