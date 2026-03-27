// @ts-nocheck
frontend/pages/dashboard/index.tsx
// CHANGE: White cards → dark cards, bg-ink-50 → var(--bg-page)
//         Uses the new dark DashboardLayout
// ═══════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { TrendingUp, Users, DollarSign, Upload, ArrowRight, BarChart3, Layers, Zap } from 'lucide-react'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import { supabase, canDownload } from '../../lib/supabase'

// KPI card — dark token-based version
function KpiCard({ icon: Icon, label, value, sub, accentColor = 'var(--accent)' }) {
  return (
    <div style={{
      background:    'var(--bg-card)',
      border:        '1px solid var(--border)',
      borderRadius:  16,
      padding:       20,
      transition:    'border-color 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor='var(--border-hover)'}
    onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}
    >
      <div style={{ width:34, height:34, borderRadius:10, background:`${accentColor}18`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12 }}>
        <Icon size={16} color={accentColor}/>
      </div>
      <div style={{ fontSize:22, fontWeight:900, color:'var(--text-primary)', fontFamily:'var(--font-mono)', lineHeight:1, marginBottom:3 }}>{value}</div>
      <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:500 }}>{label}</div>
      {sub && <div style={{ fontSize:10, color:'var(--text-ghost)', marginTop:2 }}>{sub}</div>}
    </div>
  )
}

// Module card — dark token-based version
function ModuleCard({ icon: Icon, title, desc, href, accentColor, badge }) {
  return (
    <Link href={href} style={{
      display:        'block',
      textDecoration: 'none',
      background:     'var(--bg-card)',
      border:         '1px solid var(--border)',
      borderRadius:   16,
      padding:        20,
      transition:     'all 0.15s',
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor='var(--border-hover)'; e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 4px 20px rgba(0,0,0,0.4)' }}
    onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='' }}
    >
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ width:34, height:34, borderRadius:10, background:`${accentColor}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={16} color={accentColor}/>
        </div>
        {badge && <span style={{ fontSize:8, background:'var(--accent)', color:'var(--bg-page)', padding:'2px 7px', borderRadius:20, fontWeight:700, letterSpacing:'0.05em' }}>{badge}</span>}
      </div>
      <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', fontFamily:'var(--font-display)', marginBottom:4 }}>{title}</div>
      <p style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.6, margin:0 }}>{desc}</p>
    </Link>
  )
}

export function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }
      supabase.from('profiles').select('*').eq('id', session.user.id).single()
        .then(({ data }) => { if (data) setProfile(data); setLoading(false) })
    })
  }, [router])

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-page)' }}>
      <div style={{ fontSize:13, color:'var(--text-muted)' }}>Loading…</div>
    </div>
  )

  const isAdmin   = canDownload(profile)
  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  const MODULES = [
    { icon:Zap,       title:'Command Center',     desc:'MRR/ARR bridge, retention, NRR/GRR, top movers.',         href:'/app/command-center', accentColor:'#00E5A0', badge:'Live' },
    { icon:Layers,    title:'Cohort Analytics',   desc:'SG, PC, RC cohort segmentation. Retention heatmaps.',     href:'/app/cohort',         accentColor:'#00B4D8', badge:'Live' },
    { icon:Users,     title:'Customer Analytics', desc:'ARR bridge, vintage analysis, top customers.',             href:'/app/customer',       accentColor:'#7B61FF' },
    { icon:TrendingUp,title:'Revenue Bridge',     desc:'New Logo, Upsell, Churn with 1M/3M/12M lookback.',        href:'/app/bridge',         accentColor:'#F4A261' },
  ]

  return (
    <DashboardLayout profile={profile} title="Dashboard">
      <div style={{ padding:24, maxWidth:1200, margin:'0 auto' }}>

        {/* Greeting */}
        <div style={{ marginBottom:28 }}>
          <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)', fontFamily:'var(--font-display)', margin:0 }}>
            Good morning, {firstName} 👋
          </h2>
          <p style={{ fontSize:13, color:'var(--text-muted)', marginTop:4 }}>
            {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
          </p>
        </div>

        {/* Upgrade banner */}
        {!isAdmin && (
          <div style={{ marginBottom:24, padding:'16px 20px', background:'rgba(0,229,160,0.06)', border:'1px solid rgba(0,229,160,0.2)', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>You are on the free plan</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Upgrade to download analytics output and export reports.</div>
            </div>
            <Link href="/dashboard/upgrade" className="btn-primary" style={{ fontSize:12, padding:'8px 16px', flexShrink:0, marginLeft:20 }}>
              Upgrade <ArrowRight size={12}/>
            </Link>
          </div>
        )}

        {/* KPI strip */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:28 }}>
          <KpiCard icon={DollarSign}  label="Total ARR"       value="—"  sub="Upload a dataset"    accentColor="var(--accent)"/>
          <KpiCard icon={Users}       label="Customers"       value="—"  sub="Run analytics"       accentColor="var(--violet)"/>
          <KpiCard icon={TrendingUp}  label="Net Retention"   value="—"  sub="Run revenue bridge"  accentColor="#00B4D8"/>
          <KpiCard icon={BarChart3}   label="Datasets"        value="0"  sub="Upload your first"   accentColor="var(--warning)"/>
        </div>

        {/* CTA banner */}
        <div style={{
          marginBottom: 28,
          borderRadius: 16,
          padding:      '24px 28px',
          background:   'linear-gradient(135deg,rgba(0,229,160,0.12),rgba(0,180,216,0.06))',
          border:       '1px solid rgba(0,229,160,0.2)',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', fontFamily:'var(--font-display)', marginBottom:4 }}>Start your first analysis</div>
            <p style={{ fontSize:13, color:'var(--text-muted)', maxWidth:480, margin:0, lineHeight:1.6 }}>Upload a CSV or Excel file. We will walk you through field mapping and run the full analytics suite.</p>
          </div>
          <Link href="/dashboard/upload" className="btn-primary" style={{ flexShrink:0, marginLeft:24 }}>
            <Upload size={14}/> Upload Dataset
          </Link>
        </div>

        {/* Module grid */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <h3 style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', fontFamily:'var(--font-display)', margin:0 }}>Analytics Modules</h3>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
            {MODULES.map(m => <ModuleCard key={m.href} {...m}/>)}
          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}

export default DashboardPage