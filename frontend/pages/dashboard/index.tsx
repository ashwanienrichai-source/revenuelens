// @ts-nocheck
/**
 * frontend/pages/dashboard/index.tsx
 * Uses inline styles with hardcoded tokens — no CSS var dependency risk.
 * Max-width container, grid layout, skeleton loading state.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import {
  TrendingUp, Users, DollarSign, Upload, ArrowRight,
  BarChart3, Layers, Zap, ChevronRight
} from 'lucide-react'
import DashboardLayout, { PageSkeleton } from '../../components/dashboard/DashboardLayout'
import { supabase, canDownload } from '../../lib/supabase'

/* ── Design tokens (hardcoded so nothing can go wrong) ──────────────────── */
const C = {
  bg:       '#F9FAFB',
  white:    '#FFFFFF',
  border:   '#E5E7EB',
  text:     '#111827',
  text2:    '#6B7280',
  text3:    '#9CA3AF',
  accent:   '#003A8F',
  asoft:    '#EFF6FF',
  aborder:  '#BFDBFE',
  green:    '#16A34A',
  gsoft:    '#F0FDF4',
  gborder:  '#BBF7D0',
  shadow:   '0 1px 3px rgba(0,0,0,0.06)',
  font:     "'Inter', system-ui, sans-serif",
  mono:     "'JetBrains Mono', monospace",
}

/* ── KPI card ───────────────────────────────────────────────────────────── */
function KpiCard({ label, value, hint, accentTop = false }) {
  return (
    <div style={{
      background:   C.white,
      border:       `1px solid ${C.border}`,
      borderTop:    accentTop ? `3px solid ${C.accent}` : `1px solid ${C.border}`,
      borderRadius: 8,
      padding:      '16px 20px',
      boxShadow:    C.shadow,
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.text2, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: C.mono, fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value}
      </div>
      {hint && (
        <div style={{ marginTop: 6, fontSize: 11, color: C.text3 }}>{hint}</div>
      )}
    </div>
  )
}

/* ── Module card ────────────────────────────────────────────────────────── */
function ModuleCard({ icon: Icon, title, desc, href, color, badge, live }) {
  const [hover, setHover] = useState(false)
  if (!live) return (
    <div style={{
      background: C.white, border: `1px solid ${C.border}`, borderRadius: 8,
      padding: 20, opacity: 0.5, cursor: 'not-allowed',
    }}>
      <Icon size={16} color={C.text3} strokeWidth={1.75} style={{ marginBottom: 10 }}/>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>{title}</div>
      <p style={{ margin: 0, fontSize: 12, color: C.text2, lineHeight: 1.55 }}>{desc}</p>
      <div style={{ marginTop: 10, fontSize: 10, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Coming soon
      </div>
    </div>
  )

  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          background:   C.white,
          border:       `1px solid ${hover ? '#D1D5DB' : C.border}`,
          borderRadius: 8,
          padding:      20,
          boxShadow:    hover ? '0 4px 12px rgba(0,0,0,0.08)' : C.shadow,
          transform:    hover ? 'translateY(-1px)' : 'none',
          transition:   'all 150ms ease',
          cursor:       'pointer',
          height:       '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 7,
            background: `${color}14`, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={15} color={color} strokeWidth={1.75}/>
          </div>
          {badge && (
            <span style={{
              fontSize: 9, fontWeight: 700, background: C.accent,
              color: '#fff', padding: '2px 6px', borderRadius: 20,
              letterSpacing: '0.05em',
            }}>
              {badge}
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 5, letterSpacing: '-0.005em' }}>
          {title}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: C.text2, lineHeight: 1.6 }}>{desc}</p>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: C.accent, fontWeight: 500 }}>
          Open <ChevronRight size={13}/>
        </div>
      </div>
    </Link>
  )
}

/* ── Skeleton for loading ───────────────────────────────────────────────── */
function Skeleton({ w = '100%', h = 14, r = 4 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)',
      backgroundSize: '400px 100%',
      animation: 'shimmer 1.4s ease infinite',
    }}/>
  )
}

const MODULES = [
  {
    icon: Zap, title: 'Command Center',
    desc: 'MRR/ARR bridge, retention, NRR/GRR, top movers. Full analysis in one view.',
    href: '/app/command-center', color: '#003A8F', badge: 'Live', live: true,
  },
  {
    icon: Layers, title: 'Cohort Analytics',
    desc: 'Size, percentile, and revenue cohort segmentation with retention heatmaps.',
    href: '/app/cohort', color: '#16A34A', badge: 'Live', live: true,
  },
  {
    icon: Users, title: 'Customer Analytics',
    desc: 'ARR bridge, vintage analysis, top customer rankings by dimension.',
    href: '/app/customer', color: '#6B7280', live: false,
  },
  {
    icon: TrendingUp, title: 'Revenue Bridge',
    desc: 'New Logo, Upsell, Churn — 1M/3M/12M lookback. PE-grade waterfall.',
    href: '/app/bridge', color: '#6B7280', live: false,
  },
]

/* ── Page ───────────────────────────────────────────────────────────────── */
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

  if (loading) {
    return (
      <DashboardLayout profile={null} loading={true}>
        <div/>
      </DashboardLayout>
    )
  }

  const isAdmin   = canDownload(profile)
  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const dateStr   = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <DashboardLayout profile={profile} title="Dashboard">
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 32px', fontFamily: C.font }}>

        {/* ── Greeting ──────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ margin: 0, fontSize: '1.375rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
            Good morning, {firstName} 👋
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.text2 }}>{dateStr}</p>
        </div>

        {/* ── Upgrade banner ────────────────────────────────────── */}
        {!isAdmin && (
          <div style={{
            marginBottom: 28, padding: '14px 18px',
            background: C.asoft, border: `1px solid ${C.aborder}`,
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 16,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>You are on the free plan</div>
              <div style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>
                Upgrade to download analytics output and export reports.
              </div>
            </div>
            <Link href="/dashboard/upgrade" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', background: C.accent, color: '#fff',
              borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: 'none',
              flexShrink: 0, transition: 'background 150ms',
            }}>
              Upgrade <ArrowRight size={13}/>
            </Link>
          </div>
        )}

        {/* ── KPI strip ─────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
          <KpiCard label="Total ARR"     value="—"  hint="Upload a dataset"   accentTop />
          <KpiCard label="Customers"     value="—"  hint="Run analytics"      />
          <KpiCard label="Net Retention" value="—"  hint="Run revenue bridge" />
          <KpiCard label="Datasets"      value="0"  hint="Upload your first"  />
        </div>

        {/* ── Upload CTA ────────────────────────────────────────── */}
        <div style={{
          marginBottom: 32, padding: '20px 24px',
          background: C.white, border: `1px solid ${C.border}`,
          borderRadius: 8, boxShadow: C.shadow,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, letterSpacing: '-0.01em', marginBottom: 4 }}>
              Start your first analysis
            </div>
            <p style={{ margin: 0, fontSize: 13, color: C.text2, lineHeight: 1.6, maxWidth: 480 }}>
              Upload a CSV or Excel file. We walk you through field mapping and run the full analytics suite in seconds.
            </p>
          </div>
          <Link href="/dashboard/upload" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', background: C.accent, color: '#fff',
            borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: 'none',
            flexShrink: 0, whiteSpace: 'nowrap', transition: 'background 150ms',
          }}>
            <Upload size={14}/> Upload Dataset
          </Link>
        </div>

        {/* ── Module grid ───────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: C.text, letterSpacing: '-0.005em' }}>
              Analytics Modules
            </h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {MODULES.map(m => <ModuleCard key={m.href} {...m}/>)}
          </div>
        </div>

      </div>

      <style>{`@keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }`}</style>
    </DashboardLayout>
  )
}
