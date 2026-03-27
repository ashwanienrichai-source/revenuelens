// @ts-nocheck
/**
 * frontend/pages/dashboard/index.tsx — REFACTORED
 *
 * CHANGES from old version:
 *   - REMOVE: bg-ink-50, card (white), raw hex bg colors (#EEF3FF etc.)
 *   - REMOVE: DashboardLayout → replaced with AppLayout
 *   - ADD: AppLayout + PageContainer
 *   - ADD: KPIBlock for metric cards (consulting-grade)
 *   - ADD: Card component for module cards
 *   - KEEP: all data fetching, routing, profile logic, module list
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { TrendingUp, Users, DollarSign, Upload, ArrowRight, BarChart3, Layers, Zap } from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import { PageContainer } from '../../components/ui/PageContainer'
import { Card } from '../../components/ui/Card'
import { KPIBlock, KPIStrip } from '../../components/ui/KPIBlock'
import { supabase, canDownload } from '../../lib/supabase'

const MODULES = [
  { icon:Zap,        title:'Command Center',     desc:'MRR/ARR bridge, retention, NRR/GRR, top movers.',       href:'/app/command-center', color:'var(--color-accent)',    badge:'Live' },
  { icon:Layers,     title:'Cohort Analytics',   desc:'SG, PC, RC segmentation. Retention heatmaps.',          href:'/app/cohort',         color:'var(--color-positive)', badge:'Live' },
  { icon:Users,      title:'Customer Analytics', desc:'ARR bridge, vintage analysis, top customers.',           href:'/app/customer',       color:'var(--color-text-secondary)' },
  { icon:TrendingUp, title:'Revenue Bridge',     desc:'New Logo, Upsell, Churn — 1M/3M/12M lookback.',        href:'/app/bridge',         color:'var(--color-text-secondary)' },
]

export default function DashboardPage() {
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
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--color-background)' }}>
      <div style={{ fontSize:13, color:'var(--color-text-secondary)' }}>Loading…</div>
    </div>
  )

  const isAdmin   = canDownload(profile)
  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  return (
    <AppLayout profile={profile}>
      <PageContainer>

        {/* Greeting */}
        <div style={{ marginBottom:24 }}>
          <h2 style={{ margin:0, fontSize:'1.375rem', fontWeight:600, color:'var(--color-text-primary)', letterSpacing:'-0.015em' }}>
            Good morning, {firstName} 👋
          </h2>
          <p style={{ margin:'4px 0 0', fontSize:'13px', color:'var(--color-text-secondary)' }}>
            {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
          </p>
        </div>

        {/* Upgrade notice */}
        {!isAdmin && (
          <div style={{ marginBottom:24, padding:'14px 18px', background:'var(--color-accent-dim)', border:'1px solid var(--color-accent-border)', borderRadius:'var(--radius-card)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--color-text-primary)' }}>You are on the free plan</div>
              <div style={{ fontSize:12, color:'var(--color-text-secondary)', marginTop:2 }}>Upgrade to download analytics output and export reports.</div>
            </div>
            <Link href="/dashboard/upgrade" className="btn-primary" style={{ fontSize:12, padding:'7px 14px', flexShrink:0, marginLeft:16 }}>
              Upgrade <ArrowRight size={12}/>
            </Link>
          </div>
        )}

        {/* KPI strip — consulting grade */}
        <div style={{ marginBottom:28 }}>
          <KPIStrip cols={4}>
            <KPIBlock label="Total ARR"     value="—"  hint="Upload a dataset"/>
            <KPIBlock label="Customers"     value="—"  hint="Run analytics"/>
            <KPIBlock label="Net Retention" value="—"  hint="Run revenue bridge"/>
            <KPIBlock label="Datasets"      value="0"  hint="Upload your first"/>
          </KPIStrip>
        </div>

        {/* CTA banner */}
        <div style={{ marginBottom:28, padding:'20px 24px', background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-card)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:15, fontWeight:600, color:'var(--color-text-primary)', letterSpacing:'-0.01em', marginBottom:4 }}>Start your first analysis</div>
            <p style={{ fontSize:13, color:'var(--color-text-secondary)', maxWidth:480, margin:0, lineHeight:1.6 }}>
              Upload a CSV or Excel file. We will walk you through field mapping and run the full analytics suite.
            </p>
          </div>
          <Link href="/dashboard/upload" className="btn-primary" style={{ flexShrink:0, marginLeft:24 }}>
            <Upload size={13}/> Upload Dataset
          </Link>
        </div>

        {/* Modules */}
        <div>
          <h3 style={{ margin:'0 0 14px', fontSize:'0.9375rem', fontWeight:600, color:'var(--color-text-primary)' }}>
            Analytics Modules
          </h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12 }}>
            {MODULES.map(m => (
              <Link key={m.href} href={m.href} style={{ textDecoration:'none' }}>
                <Card onClick={() => {}} style={{ height:'100%' }}>
                  <div style={{ marginBottom:12 }}>
                    <m.icon size={16} color={m.color}/>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:'var(--color-text-primary)' }}>{m.title}</span>
                    {m.badge && <span className="badge badge-blue" style={{ fontSize:9 }}>{m.badge}</span>}
                  </div>
                  <p style={{ margin:0, fontSize:'0.8125rem', color:'var(--color-text-secondary)', lineHeight:1.55 }}>{m.desc}</p>
                </Card>
              </Link>
            ))}
          </div>
        </div>

      </PageContainer>
    </AppLayout>
  )
}
