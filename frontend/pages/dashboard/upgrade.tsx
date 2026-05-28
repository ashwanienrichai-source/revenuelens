// frontend/pages/dashboard/upgrade.tsx
// @ts-nocheck
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import { CheckCircle, Loader2, Crown, ArrowRight, Sparkles } from 'lucide-react'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import { supabase } from '../../lib/supabase'
import { PLANS } from '../../lib/stripe'

export default function UpgradePage() {
  const router = useRouter()
  const { upgraded, cancelled } = router.query
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }
      supabase.from('profiles').select('*').eq('id', session.user.id).single()
        .then(({ data }) => { if (data) setProfile(data) })
    })
  }, [router])

  async function handleSubscribe(planId: string) {
    const plan = PLANS[planId as keyof typeof PLANS]

    // Enterprise → mailto
    if (!plan?.priceId) {
      window.location.href = 'mailto:ashwani.enrichai@gmail.com?subject=RevenueLens Enterprise Enquiry'
      return
    }

    setLoading(planId)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data } = await axios.post('/api/stripe/create-checkout', {
        priceId: plan.priceId,
        userId:  session?.user.id,
        email:   session?.user.email,
      })
      window.location.href = data.url
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Payment failed. Please try again.')
      setLoading(null)
    }
  }

  const current = profile?.subscription_status || 'free'
  const isPro   = current === 'pro' || current === 'starter'

  return (
    <DashboardLayout profile={profile} title="Upgrade Plan">
      <div style={{ padding: '32px 24px', maxWidth: 900, margin: '0 auto' }}>

        {/* Success banner */}
        {upgraded === 'true' && (
          <div style={{ marginBottom: 28, padding: '14px 20px', background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <CheckCircle size={18} color="#10B981" />
            <div>
              <div style={{ fontWeight: 700, color: '#065F46', fontSize: 14 }}>Payment successful! You now have full access.</div>
              <div style={{ fontSize: 12, color: '#047857', marginTop: 2 }}>All features are unlocked. Go run your first analysis.</div>
            </div>
            <button onClick={() => router.push('/app/command-center')} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: '#10B981', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              Open Analytics <ArrowRight size={13} />
            </button>
          </div>
        )}

        {/* Cancelled banner */}
        {cancelled === 'true' && (
          <div style={{ marginBottom: 28, padding: '12px 18px', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 10, fontSize: 13, color: '#92400E' }}>
            Payment cancelled — no charge was made.
          </div>
        )}

        {/* Already pro */}
        {isPro && (
          <div style={{ marginBottom: 28, padding: '14px 20px', background: '#F3E8FF', border: '1px solid #DDD6FE', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={16} color="#7C3AED" />
            <span style={{ fontWeight: 600, color: '#5B21B6', fontSize: 14 }}>You're on Pro — all features unlocked.</span>
            <button onClick={() => router.push('/app/command-center')} style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 8, background: '#7C3AED', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              Go to Analytics →
            </button>
          </div>
        )}

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: '#FEF3C7', border: '1px solid #FCD34D', fontSize: 11, fontWeight: 700, color: '#92400E', marginBottom: 14 }}>
            <Crown size={10} color="#F59E0B" /> Upgrade your plan
          </div>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', marginBottom: 10 }}>Unlock the full platform</h2>
          <p style={{ color: '#6B7280', fontSize: 14, maxWidth: 460, margin: '0 auto' }}>
            Free users can run any analysis. Paid users can download output and export reports.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginBottom: 20, padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* Plans */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, maxWidth: 720, margin: '0 auto' }}>
          {Object.values(PLANS).map(plan => {
            const isCurrent = isPro && plan.id === 'pro'
            const isHot = plan.highlighted

            return (
              <div key={plan.id} style={{
                position: 'relative',
                borderRadius: 20,
                border: isHot ? '2px solid #6366F1' : '1px solid #E5E7EB',
                padding: '28px 24px',
                display: 'flex',
                flexDirection: 'column',
                background: isHot ? '#4F46E5' : '#FFFFFF',
                boxShadow: isHot ? '0 8px 32px rgba(79,70,229,0.25)' : '0 1px 4px rgba(0,0,0,0.04)',
              }}>
                {isHot && (
                  <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: '#F59E0B', color: '#111827', fontSize: 10, fontWeight: 700, padding: '3px 12px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                    Most Popular
                  </div>
                )}
                {isCurrent && (
                  <div style={{ position: 'absolute', top: -13, right: 16, background: '#10B981', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase' }}>
                    Current
                  </div>
                )}

                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: isHot ? '#A5B4FC' : '#6B7280', marginBottom: 8 }}>
                  {plan.name}
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 6 }}>
                  <span style={{ fontSize: 38, fontWeight: 800, color: isHot ? '#fff' : '#111827', letterSpacing: '-0.03em' }}>
                    {plan.price != null ? `$${plan.price}` : 'Custom'}
                  </span>
                  {plan.price != null && (
                    <span style={{ fontSize: 13, color: isHot ? '#A5B4FC' : '#9CA3AF' }}>/{plan.interval}</span>
                  )}
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 24px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
                      <CheckCircle size={13} color={isHot ? '#A5B4FC' : '#6366F1'} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span style={{ color: isHot ? '#C7D2FE' : '#4B5563' }}>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => !isCurrent && handleSubscribe(plan.id)}
                  disabled={isCurrent || !!loading}
                  style={{
                    width: '100%',
                    padding: '12px 0',
                    borderRadius: 12,
                    border: 'none',
                    cursor: isCurrent || loading ? 'not-allowed' : 'pointer',
                    background: isCurrent ? '#D1FAE5' : isHot ? '#fff' : '#4F46E5',
                    color: isCurrent ? '#065F46' : isHot ? '#4F46E5' : '#fff',
                    fontSize: 14,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    opacity: loading && loading !== plan.id ? 0.5 : 1,
                    transition: 'all 0.15s',
                  }}>
                  {loading === plan.id && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                  {isCurrent ? '✓ Current plan' : plan.price != null ? 'Subscribe' : 'Contact us'}
                  {!isCurrent && loading !== plan.id && <ArrowRight size={13} />}
                </button>
              </div>
            )
          })}
        </div>

        {/* Trust footer */}
        <div style={{ textAlign: 'center', marginTop: 36, fontSize: 12, color: '#9CA3AF', lineHeight: 1.8 }}>
          Secure payments powered by Stripe · Cancel anytime via email · Test card: 4242 4242 4242 4242
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </DashboardLayout>
  )
}
