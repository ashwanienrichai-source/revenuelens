// @ts-nocheck
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Upload } from 'lucide-react'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import { supabase, canDownload } from '../../lib/supabase'

export default function Dashboard() {
  const router  = useRouter()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }
      supabase.from('profiles').select('*').eq('id', session.user.id).single()
        .then(({ data }) => { if (data) setProfile(data) })
      setLoading(false)
    })
  }, [])

  const isAdmin = canDownload(profile)

  const greeting = () => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  }

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  })

  return (
    <DashboardLayout profile={profile} title="Dashboard" loading={loading}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 40px' }}>

        {/* Greeting */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4, letterSpacing: '-0.02em' }}>
            {greeting()}, {profile?.full_name?.split(' ')[0] || 'there'} 👋
          </div>
          <div style={{ fontSize: 13, color: '#6B7280' }}>{dateStr}</div>
        </div>

        {/* Upgrade banner */}
        {!isAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 2 }}>You are on the free plan</div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>Upgrade to download analytics output and export reports.</div>
            </div>
            <button onClick={() => router.push('/dashboard/upgrade')}
              style={{ padding: '8px 20px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Upgrade →
            </button>
          </div>
        )}

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'TOTAL ARR',     note: 'Upload a dataset' },
            { label: 'CUSTOMERS',     note: 'Run analytics' },
            { label: 'NET RETENTION', note: 'Run revenue bridge' },
            { label: 'DATASETS',      note: 'Upload your first', value: '0' },
          ].map(k => (
            <div key={k.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9CA3AF', marginBottom: 8 }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{k.value || '—'}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>{k.note}</div>
            </div>
          ))}
        </div>

        {/* Start analysis CTA */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, marginBottom: 32 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Start your first analysis</div>
            <div style={{ fontSize: 12, color: '#6B7280', maxWidth: 500, lineHeight: 1.6 }}>
              Upload a CSV or Excel file. We walk you through field mapping and run the full analytics suite in seconds.
            </div>
          </div>
          <button onClick={() => router.push('/dashboard/upload')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <Upload size={13}/> Analytics Engine
          </button>
        </div>

        {/* Analytics Modules */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Analytics Modules</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>Live revenue intelligence — upload a dataset and run in seconds.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {[
              {
                icon: '⚡',
                live: true,
                title: 'Command Center',
                desc: 'ARR & MRR bridge analysis with full movement classification — New Logo, Upsell, Downsell, Churn, Lapsed, Returning. NRR, GRR, waterfall charts, top movers, and historical performance across any lookback period.',
                tags: ['ARR Bridge', 'MRR Bridge', 'NRR / GRR', 'Waterfall', 'Top Movers'],
                href: '/app/command-center',
              },
              {
                icon: '👥',
                live: false,
                title: 'Customer Analytics',
                desc: 'Subscription analytics at the customer level — lifetime value, expansion and contraction trends, churn propensity scoring, and vintage cohort performance by acquisition period.',
                tags: ['LTV', 'Expansion', 'Churn Score', 'Vintage Analysis'],
              },
              {
                icon: '📊',
                live: false,
                title: 'ARR & MRR Intelligence',
                desc: 'ARR is Annual Recurring Revenue — the annualised value of active subscriptions. MRR is the monthly equivalent. This module provides deep-dive decomposition, seasonality detection, and forward-looking ARR projections.',
                tags: ['ARR', 'MRR', 'Decomposition', 'Projections'],
              },
            ].map(card => (
              <div key={card.title}
                onClick={card.href ? () => router.push(card.href) : undefined}
                style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '20px 22px', position: 'relative', cursor: card.href ? 'pointer' : 'default', transition: 'border-color 150ms' }}
                onMouseEnter={card.href ? e => e.currentTarget.style.borderColor='#2563EB' : undefined}
                onMouseLeave={card.href ? e => e.currentTarget.style.borderColor='#E5E7EB' : undefined}>
                <span style={{ position: 'absolute', top: 14, right: 14, fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, letterSpacing: '0.06em', textTransform: 'uppercase',
                  background: card.live ? '#2563EB' : '#F3F4F6',
                  color: card.live ? '#fff' : '#6B7280',
                  border: card.live ? 'none' : '1px solid #E5E7EB',
                }}>{card.live ? 'Live' : 'Coming Soon'}</span>
                <div style={{ fontSize: 24, marginBottom: 10 }}>{card.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 6 }}>{card.title}</div>
                <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, marginBottom: 14 }}>{card.desc}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {card.tags.map(tag => (
                    <span key={tag} style={{ fontSize: 10, fontWeight: 500, color: '#374151', background: '#F9FAFB', border: '1px solid #E5E7EB', padding: '2px 8px', borderRadius: 20 }}>{tag}</span>
                  ))}
                </div>
                {card.live && <div style={{ fontSize: 12, fontWeight: 600, color: '#2563EB', marginTop: 14 }}>Open →</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Data Modules */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Data Modules</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>Data quality, preparation and enrichment — before analysis.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {[
              {
                icon: '🗂️',
                title: 'Data Type Intelligence',
                desc: 'Detect and classify dataset types — Revenue, Billing, Bookings, ACV — with schema validation and automatic field inference.',
                tags: ['Revenue', 'Billing', 'Bookings', 'ACV / TCV'],
              },
              {
                icon: '🔍',
                title: 'Data Sanity Checks',
                desc: 'Automated validation — duplicate records, missing values, date gaps, negative ARR, period overlaps, and statistical outlier flagging.',
                tags: ['Duplicates', 'Nulls', 'Date Gaps', 'Outliers'],
              },
              {
                icon: '⚙️',
                title: 'Data Preparation',
                desc: 'Revenue smoothing, fuzzy customer name matching, currency normalization, and cohort-ready data structuring.',
                tags: ['Smoothing', 'Fuzzy Match', 'Normalization', 'Structuring'],
              },
            ].map(card => (
              <div key={card.title} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '20px 22px', position: 'relative' }}>
                <span style={{ position: 'absolute', top: 14, right: 14, fontSize: 9, fontWeight: 700, color: '#6B7280', background: '#F3F4F6', border: '1px solid #E5E7EB', padding: '2px 8px', borderRadius: 20, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Coming Soon</span>
                <div style={{ fontSize: 24, marginBottom: 10 }}>{card.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 6 }}>{card.title}</div>
                <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, marginBottom: 14 }}>{card.desc}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {card.tags.map(tag => (
                    <span key={tag} style={{ fontSize: 10, fontWeight: 500, color: '#374151', background: '#F9FAFB', border: '1px solid #E5E7EB', padding: '2px 8px', borderRadius: 20 }}>{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}
