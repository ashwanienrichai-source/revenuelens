// @ts-nocheck
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase, canDownload } from '../../lib/supabase'

export default function Dashboard() {
  const router = useRouter()
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

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8f9fc', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ color: '#6b7280', fontSize: 13 }}>Loading…</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: "'Inter', system-ui, sans-serif", background: '#f8f9fc', color: '#111827' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: 176, flexShrink: 0, background: '#ffffff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>

        {/* Logo */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', letterSpacing: '-0.01em' }}>RevenueLens</div>
              <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af', marginTop: 1 }}>Analytics</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
          <div style={{ padding: '4px 16px 6px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af' }}>Analytics</div>

          {/* Dashboard — active */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', background: '#eff6ff', borderRight: '2px solid #2563eb', cursor: 'default' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#2563eb' }}>Dashboard</span>
          </div>

          {/* Command Center */}
          <div onClick={() => router.push('/app/command-center')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <span style={{ fontSize: 13, color: '#374151', flex: 1 }}>Command Center</span>
            <span style={{ fontSize: 9, fontWeight: 700, background: '#2563eb', color: '#fff', padding: '1px 5px', borderRadius: 4, letterSpacing: '0.04em' }}>New</span>
          </div>

          {/* Workspace */}
          <div style={{ padding: '14px 16px 6px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginTop: 4 }}>Workspace</div>

          {[
            { label: 'Upload Dataset', href: '/dashboard/upload', icon: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12' },
            { label: 'Reports',        href: '/dashboard/reports', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6' },
            { label: 'Settings',       href: '/dashboard/settings', icon: 'M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z' },
          ].map(item => (
            <div key={item.label} onClick={() => router.push(item.href)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><path d={item.icon}/></svg>
              <span style={{ fontSize: 13, color: '#374151' }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* User */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#6b7280', flexShrink: 0 }}>U</div>
          <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>User</span>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Dashboard</h1>

        {/* Greeting */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{greeting()}, {profile?.user_metadata?.name?.split(' ')[0] || 'there'} 👋</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>{dateStr}</div>
        </div>

        {/* Upgrade banner */}
        {!isAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 2 }}>You are on the free plan</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Upgrade to download analytics output and export reports.</div>
            </div>
            <button onClick={() => router.push('/dashboard/upgrade')}
              style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
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
            <div key={k.label} style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 8 }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{k.value || '—'}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{k.note}</div>
            </div>
          ))}
        </div>

        {/* Start analysis CTA */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Start your first analysis</div>
            <div style={{ fontSize: 12, color: '#6b7280', maxWidth: 480, lineHeight: 1.6 }}>Upload a CSV or Excel file. We walk you through field mapping and run the full analytics suite in seconds.</div>
          </div>
          <button onClick={() => router.push('/app/command-center')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            Open Command Center
          </button>
        </div>

        {/* Analytics Modules — Command Center only */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 16 }}>Analytics Modules</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16, maxWidth: 640 }}>
            <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '20px 22px', cursor: 'pointer', position: 'relative' }}
              onClick={() => router.push('/app/command-center')}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#2563eb'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
              <span style={{ position: 'absolute', top: 14, right: 14, fontSize: 9, fontWeight: 700, background: '#2563eb', color: '#fff', padding: '2px 7px', borderRadius: 20, letterSpacing: '0.06em' }}>LIVE</span>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Command Center</div>
              <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, marginBottom: 12 }}>MRR/ARR bridge, retention, NRR/GRR, top movers. Full analysis in one view.</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#2563eb' }}>Open →</div>
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}
