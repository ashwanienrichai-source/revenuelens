// @ts-nocheck
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Zap, Upload } from 'lucide-react'
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
          <button onClick={() => router.push('/app/command-center')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <Upload size={13}/> Open Command Center
          </button>
        </div>

        {/* Analytics Modules — Command Center only */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 16 }}>Analytics Modules</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16, maxWidth: 580 }}>
            <div
              onClick={() => router.push('/app/command-center')}
              style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '20px 22px', cursor: 'pointer', position: 'relative', transition: 'border-color 150ms' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#2563EB'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}>
              <span style={{ position: 'absolute', top: 14, right: 14, fontSize: 9, fontWeight: 700, background: '#2563EB', color: '#fff', padding: '2px 8px', borderRadius: 20, letterSpacing: '0.06em' }}>Live</span>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Zap size={15} color="#2563EB"/>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Command Center</div>
              <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5, marginBottom: 12 }}>MRR/ARR bridge, retention, NRR/GRR, top movers. Full analysis in one view.</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#2563EB' }}>Open →</div>
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}
