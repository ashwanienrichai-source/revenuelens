// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// acv-center.tsx — RevenueLens ACV / Contract Analytics Center
// ─────────────────────────────────────────────────────────────────────────────
// ISOLATED: Zero imports from command-center.tsx
// ENGINE:   ../lib/acvEngine (acvEngine.ts)
// ROUTE:    /app/acv-center
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/router'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
  ComposedChart, ReferenceLine
} from 'recharts'
import {
  TrendingUp, TrendingDown, FileText, AlertCircle, CheckCircle,
  Download, RefreshCw, ChevronDown, ChevronUp, ArrowUp, ArrowDown,
  Calendar, Shield, Zap, Layers, Target, DollarSign, Clock, Users
} from 'lucide-react'
import axios from 'axios'
import { supabase } from '../../lib/supabase'
import { dataCubeStore } from '../../lib/dataCubeStore'
const API = process.env.NEXT_PUBLIC_API_URL || 'https://revenuelens-api.onrender.com'

import {
  runACVEngine, calcACVKPIs, buildACVWaterfall, buildExpiryPool,
  buildRenewalRateTrend, ACV_WATERFALL_ORDER, ACV_BRIDGE_COLORS
} from '../../lib/acvEngine'

// ─── THEMES (identical token system as command-center) ────────────────────────
const THEMES = {
  dark: {
    bgPage:'#F6F4FB', bgSurface:'#FFFFFF', bgRaised:'#F9F8FD',
    bgElevated:'#FFFFFF', bgMuted:'#F3F0F9',
    textPrimary:'#111827', textSecondary:'#4B5563',
    textTertiary:'#6B7280', textMuted:'#9CA3AF', textInverse:'#FFFFFF',
    borderSubtle:'#EEF2F7', borderDefault:'#E5E7EB', borderStrong:'#D1D5DB',
    growth:'#10B981', decline:'#EF4444', neutral:'#6B7280',
    insight:'#7C3AED', warning:'#F59E0B', info:'#3B82F6',
    success:'#10B981', risk:'#EF4444',
    chartBaseline:'#7C3AED', chartExpansion:'#10B981',
    chartContraction:'#EF4444', chartNeutral:'#94A3B8',
    chartGrid:'#F3F4F6', chartAxis:'#9CA3AF',
    brandPrimary:'#7C3AED', brandSoft:'#F3E8FF', brandBorder:'#DDD6FE',
    accentPrimary:'#7C3AED', accentPrimaryHover:'#6D28D9',
    focusRing:'rgba(124,58,237,0.20)', selectionBg:'#F3E8FF',
    mono:"'JetBrains Mono',monospace",
  },
  light: {
    bgPage:'#f8f9ff', bgSurface:'#ffffff', bgRaised:'#eff4ff',
    bgElevated:'#ffffff', bgMuted:'#f1f5f9',
    textPrimary:'#0b1c30', textSecondary:'#4a4455',
    textTertiary:'#64748b', textMuted:'#94a3b8', textInverse:'#ffffff',
    borderSubtle:'rgba(11,28,48,0.06)', borderDefault:'rgba(11,28,48,0.10)',
    borderStrong:'rgba(99,14,212,0.20)',
    growth:'#630ed4', decline:'#ba1a1a', neutral:'#64748b',
    insight:'#7c3aed', warning:'#d97706', info:'#2563eb',
    success:'#059669', risk:'#ba1a1a',
    chartBaseline:'#94a3b8', chartExpansion:'#630ed4',
    chartContraction:'#ba1a1a', chartNeutral:'#64748b',
    chartGrid:'rgba(11,28,48,0.07)', chartAxis:'#94a3b8',
    brandPrimary:'#630ed4', brandSoft:'rgba(99,14,212,0.10)',
    brandBorder:'rgba(99,14,212,0.28)',
    accentPrimary:'#0b1c30', accentPrimaryHover:'#1e293b',
    focusRing:'rgba(99,14,212,0.35)', selectionBg:'rgba(99,14,212,0.08)',
    mono:"'JetBrains Mono',monospace",
  },
  colorBlind: {
    bgPage:'#0b1326', bgSurface:'#131b2e', bgRaised:'#171f33',
    bgElevated:'#1c253a', bgMuted:'#0f1828',
    textPrimary:'#e6edf3', textSecondary:'#94a3b8',
    textTertiary:'#64748b', textMuted:'#4a5568', textInverse:'#0b1326',
    borderSubtle:'rgba(230,237,243,0.06)', borderDefault:'#1e2d45',
    borderStrong:'#253550',
    growth:'#60a5fa', decline:'#fb923c', neutral:'#64748b',
    insight:'#a78bfa', warning:'#fcd34d', info:'#38bdf8',
    success:'#34d399', risk:'#fb923c',
    chartBaseline:'#3d5068', chartExpansion:'#60a5fa',
    chartContraction:'#fb923c', chartNeutral:'#4a5568',
    chartGrid:'#1e2d45', chartAxis:'#4a5568',
    brandPrimary:'#60a5fa', brandSoft:'rgba(96,165,250,0.10)',
    brandBorder:'rgba(96,165,250,0.28)',
    accentPrimary:'#e6edf3', accentPrimaryHover:'#ffffff',
    focusRing:'rgba(96,165,250,0.45)', selectionBg:'rgba(96,165,250,0.10)',
    mono:"'JetBrains Mono',monospace",
  },
  highContrast: {
    bgPage:'#000000', bgSurface:'#0a0a0a', bgRaised:'#141414',
    bgElevated:'#1a1a1a', bgMuted:'#050505',
    textPrimary:'#ffffff', textSecondary:'#e5e5e5',
    textTertiary:'#cccccc', textMuted:'#aaaaaa', textInverse:'#000000',
    borderSubtle:'rgba(255,255,255,0.15)', borderDefault:'rgba(255,255,255,0.25)',
    borderStrong:'rgba(255,255,255,0.40)',
    growth:'#00ff94', decline:'#ff4444', neutral:'#aaaaaa',
    insight:'#cc99ff', warning:'#ffb800', info:'#66aaff',
    success:'#00ff94', risk:'#ff4444',
    chartBaseline:'#666666', chartExpansion:'#00ff94',
    chartContraction:'#ff4444', chartNeutral:'#888888',
    chartGrid:'rgba(255,255,255,0.12)', chartAxis:'#888888',
    brandPrimary:'#00ff94', brandSoft:'rgba(0,255,148,0.12)',
    brandBorder:'rgba(0,255,148,0.40)',
    accentPrimary:'#ffffff', accentPrimaryHover:'#e5e5e5',
    focusRing:'rgba(255,255,255,0.6)', selectionBg:'rgba(255,255,255,0.12)',
    mono:"'JetBrains Mono',monospace",
  },
}

// ACV Bridge color map — theme-aware
const getACVBridgeColor = (T) => ({
  'Prior ACV':     T.chartBaseline,
  'Ending ACV':    T.chartBaseline,
  'Expiry Pool':   T.chartNeutral,
  'RoB':           T.chartNeutral,
  'New Logo':      T.chartExpansion,
  'Cross-sell':    T.chartExpansion,
  'Upsell':        T.chartExpansion,
  'Add-on':        T.chartExpansion,
  'Returning':     T.chartExpansion,
  'Other In':      T.chartNeutral,
  'Churn':         T.chartContraction,
  'Churn-Partial': T.chartContraction,
  'Downsell':      T.chartContraction,
  'Lapsed':        T.chartContraction,
  'Other Out':     T.chartNeutral,
  'Price Impact':  T.insight,
  'Volume Impact': T.info,
  'Price on Volume': T.warning,
})

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = v => {
  if (v == null) return '—'
  const a = Math.abs(v)
  if (a >= 1e9) return `$${(v/1e9).toFixed(1)}B`
  if (a >= 1e6) return `$${(v/1e6).toFixed(1)}M`
  if (a >= 1e3) return `$${(v/1e3).toFixed(0)}K`
  return `$${Math.round(v).toLocaleString()}`
}
const fmtPct = v => v != null ? `${(v*100).toFixed(1)}%` : '—'
const fmtNum = v => v != null ? Math.round(v).toLocaleString() : '—'

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, subGood, accent, T }) {
  const subColor = subGood === true ? T.growth : subGood === false ? T.decline : T.textTertiary
  return (
    <div style={{
      background: T.bgSurface,
      border: `1px solid ${T.borderDefault}`,
      borderTop: accent ? `2px solid ${T.brandPrimary}` : `1px solid ${T.borderDefault}`,
      borderRadius: 8, padding: '14px 16px',
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.textMuted, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 20, fontWeight: 700, color: T.textPrimary, letterSpacing: '-0.02em', lineHeight: 1 }}>
        {value}
      </div>
      {sub != null && (
        <div style={{ marginTop: 5, fontSize: 10, fontWeight: 500, color: subColor }}>
          {subGood === true ? '↑ ' : subGood === false ? '↓ ' : ''}{sub}
        </div>
      )}
    </div>
  )
}

// ─── QC Banner ────────────────────────────────────────────────────────────────
function QCBanner({ qc, T }) {
  const allPass = qc.qc1Pass && qc.qc2Pass && qc.qc3Pass && qc.qc4Pass
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 8, marginBottom: 16,
      background: allPass ? `${T.growth}0F` : `${T.decline}0F`,
      border: `1px solid ${allPass ? T.growth : T.decline}33`,
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      {allPass
        ? <CheckCircle size={14} color={T.growth} style={{ flexShrink: 0, marginTop: 2 }} />
        : <AlertCircle size={14} color={T.decline} style={{ flexShrink: 0, marginTop: 2 }} />}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: allPass ? T.growth : T.decline }}>
          {allPass ? 'QC PASSED — All 4 checks reconcile' : 'QC WARNING — Reconciliation issue detected'}
        </div>
        {!allPass && (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[['QC1', qc.qc1Pass, qc.qc1Detail],['QC2', qc.qc2Pass, qc.qc2Detail],
              ['QC3', qc.qc3Pass, qc.qc3Detail],['QC4', qc.qc4Pass, qc.qc4Detail]].map(([k, pass, detail]) => (
              <div key={k} style={{ fontSize: 10, color: pass ? T.growth : T.decline }}>
                {pass ? '✓' : '✗'} {k}: {detail}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ACV Waterfall Bar Chart ──────────────────────────────────────────────────
function ACVWaterfall({ bridgeTable, lb, period, T }) {
  const BC = getACVBridgeColor(T)
  const data = useMemo(() => {
    if (!bridgeTable.length || !period) return []
    const dateStr = period // "YYYY-MM"
    const rows = bridgeTable.filter(r =>
      r.monthLookback === lb &&
      `${r.date.getFullYear()}-${String(r.date.getMonth()+1).padStart(2,'0')}` === dateStr
    )
    const totals = {}
    for (const r of rows) totals[r.bridgeClassification] = (totals[r.bridgeClassification] || 0) + r.bridgeValue

    let running = 0
    const wf = []
    for (const name of ACV_WATERFALL_ORDER) {
      const val = totals[name] || 0
      if (val === 0) continue
      const isAnchor = name === 'Prior ACV' || name === 'Ending ACV'
      const base = isAnchor ? 0 : running
      wf.push({ name, base, value: isAnchor ? val : Math.abs(val), fill: BC[name] || T.chartNeutral, isNeg: !isAnchor && val < 0, rawVal: val })
      if (!isAnchor) running += val
    }
    return wf
  }, [bridgeTable, lb, period, T])

  if (!data.length) return <div style={{ padding: 40, textAlign: 'center', color: T.textMuted, fontSize: 12 }}>No data for this period</div>

  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 60, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={T.chartGrid} vertical={false} />
        <XAxis dataKey="name" tick={{ fill: T.chartAxis, fontSize: 9 }} angle={-40} textAnchor="end" interval={0} />
        <YAxis tick={{ fill: T.chartAxis, fontSize: 10 }} tickFormatter={v => fmt(v)} />
        <Tooltip
          formatter={(v, n, p) => [fmt(p.payload.rawVal), p.payload.name]}
          contentStyle={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 8, fontSize: 11, color: T.textPrimary }}
        />
        <Bar dataKey="base" stackId="a" fill="transparent" />
        <Bar dataKey="value" stackId="a" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ─── Expiry Pool Timeline Chart ───────────────────────────────────────────────
function ExpiryTimeline({ bridgeTable, selPeriod, T }) {
  const data = useMemo(() => {
    if (!bridgeTable.length) return []
    const rows = bridgeTable.filter(r =>
      r.monthLookback === 12 &&
      r.bridgeClassification === 'Expiry Pool'
    )
    const byPeriod = {}
    for (const r of rows) {
      const k = `${r.date.getFullYear()}-${String(r.date.getMonth()+1).padStart(2,'0')}`
      byPeriod[k] = (byPeriod[k] || 0) + r.bridgeValue
    }
    return Object.entries(byPeriod)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([period, value]) => ({
        period: period.slice(0,7),
        value,
        label: new Date(period + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      }))
  }, [bridgeTable])

  if (!data.length) return <div style={{ padding: 40, textAlign: 'center', color: T.textMuted, fontSize: 12 }}>No expiry pool data</div>

  const totalExpiry = data.reduce((s, r) => s + r.value, 0)
  const next6 = data.slice(0, 6).reduce((s, r) => s + r.value, 0)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total Expiry Pool', value: fmt(totalExpiry), sub: 'All periods' },
          { label: 'Next 6 Months', value: fmt(next6), sub: `${totalExpiry > 0 ? ((next6/totalExpiry)*100).toFixed(0) : 0}% of total`, subGood: false },
          { label: 'Periods with Renewals', value: data.length, sub: 'Months tracked' },
        ].map(k => <KpiCard key={k.label} {...k} T={T} />)}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 10, right: 20, bottom: 40, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.chartGrid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: T.chartAxis, fontSize: 9 }} angle={-35} textAnchor="end" />
          <YAxis tick={{ fill: T.chartAxis, fontSize: 10 }} tickFormatter={v => fmt(v)} />
          <Tooltip
            formatter={v => [fmt(v), 'Expiry Pool']}
            contentStyle={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 8, fontSize: 11, color: T.textPrimary }}
          />
          <Bar dataKey="value" fill={T.chartNeutral} radius={[3,3,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Renewal Rate Trend Chart ─────────────────────────────────────────────────
function RenewalRateTrend({ bridgeTable, lb, T }) {
  const data = useMemo(() => buildRenewalRateTrend(bridgeTable, lb), [bridgeTable, lb])

  if (!data.length) return <div style={{ padding: 40, textAlign: 'center', color: T.textMuted, fontSize: 12 }}>Insufficient data for renewal rate trend</div>

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 20, bottom: 40, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={T.chartGrid} />
        <XAxis dataKey="date" tick={{ fill: T.chartAxis, fontSize: 9 }} angle={-35} textAnchor="end" />
        <YAxis tick={{ fill: T.chartAxis, fontSize: 10 }} tickFormatter={v => `${(v*100).toFixed(0)}%`} domain={['auto','auto']} />
        <Tooltip
          formatter={v => [`${(v*100).toFixed(1)}%`]}
          contentStyle={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 8, fontSize: 11, color: T.textPrimary }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: T.textSecondary }} />
        <ReferenceLine y={1} stroke={T.borderDefault} strokeDasharray="4 2" />
        <Line type="monotone" dataKey="grossRenewal" name="Gross Renewal" stroke={T.warning} strokeWidth={2} dot={{ r: 3, fill: T.warning }} />
        <Line type="monotone" dataKey="netRenewal" name="Net Renewal" stroke={T.growth} strokeWidth={2} dot={{ r: 3, fill: T.growth }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── Bookings Walk Table ──────────────────────────────────────────────────────
function BookingsWalk({ bookingsTable, bridgeTable, lb, period, T }) {
  const inScope  = bookingsTable.filter(r => r.inScope)
  const outScope = bookingsTable.filter(r => !r.inScope)

  const totalTCV      = bookingsTable.reduce((s, r) => s + r.tcv, 0)
  const outOfScopeTCV = outScope.reduce((s, r) => s + r.tcv, 0)
  const adjustedTCV   = inScope.reduce((s, r) => s + r.tcv, 0)
  const totalACV      = inScope.reduce((s, r) => s + r.acv, 0)
  const annualisationAdj = totalACV - adjustedTCV

  const rows = bridgeTable.filter(r => r.monthLookback === lb && period &&
    `${r.date.getFullYear()}-${String(r.date.getMonth()+1).padStart(2,'0')}` === period)
  const endingACV  = rows.filter(r => r.bridgeClassification === 'Ending ACV').reduce((s,r) => s+r.bridgeValue, 0)
  const newLogo    = rows.filter(r => r.bridgeClassification === 'New Logo').reduce((s,r) => s+r.bridgeValue, 0)
  const priorACV   = rows.filter(r => r.bridgeClassification === 'Prior ACV').reduce((s,r) => s+r.bridgeValue, 0)

  const walkRows = [
    { label: '1. Source Reported Bookings (TCV)',           value: totalTCV,      highlight: false },
    { label: '2. Remove Out of Scope',                      value: -outOfScopeTCV, highlight: false },
    { label: '3. Adjusted Bookings',                        value: adjustedTCV,   highlight: true  },
    { label: '4. Annualisation Adjustment (TCV → ACV)',     value: annualisationAdj, highlight: false },
    { label: '5. Recurring Bookings (ACV Basis)',           value: totalACV,      highlight: true  },
    { label: '6. Contracts Rolling In (Prior ACV)',         value: priorACV,      highlight: false },
    { label: '7. New Logo ACV (from Bridge)',               value: newLogo,       highlight: false },
    { label: '8. Ending ACV (from Bridge)',                 value: endingACV,     highlight: true  },
  ]

  return (
    <div>
      <div style={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 10, overflow: 'hidden' }}>
        {walkRows.map((r, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 18px',
            background: r.highlight ? T.brandSoft : 'transparent',
            borderBottom: i < walkRows.length - 1 ? `1px solid ${T.borderSubtle}` : 'none',
          }}>
            <span style={{ fontSize: 12, color: r.highlight ? T.brandPrimary : T.textSecondary, fontWeight: r.highlight ? 700 : 400 }}>{r.label}</span>
            <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: r.value >= 0 ? T.textPrimary : T.decline }}>
              {r.value >= 0 ? '' : '('}{fmt(Math.abs(r.value))}{r.value < 0 ? ')' : ''}
            </span>
          </div>
        ))}
      </div>
      {outScope.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 8 }}>OUT OF SCOPE CONTRACTS ({outScope.length})</div>
          <div style={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 8, overflow: 'hidden' }}>
            {outScope.slice(0, 10).map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: `1px solid ${T.borderSubtle}`, fontSize: 11 }}>
                <span style={{ color: T.textSecondary }}>{r.customer} — {r.outOfScopeReason}</span>
                <span style={{ fontFamily: T.mono, color: T.decline }}>{fmt(r.tcv)}</span>
              </div>
            ))}
            {outScope.length > 10 && <div style={{ padding: '8px 14px', fontSize: 11, color: T.textMuted }}>+{outScope.length - 10} more</div>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Top Movers (ACV) ─────────────────────────────────────────────────────────
function ACVTopMovers({ bridgeTable, lb, period, T }) {
  const [view, setView] = useState('Churn')
  const VIEWS = ['New Logo', 'Upsell', 'Add-on', 'Churn', 'Downsell', 'Lapsed']
  const isNeg = ['Churn', 'Downsell', 'Lapsed'].includes(view)

  const movers = useMemo(() => {
    if (!bridgeTable.length || !period) return []
    return bridgeTable
      .filter(r => r.monthLookback === lb &&
        `${r.date.getFullYear()}-${String(r.date.getMonth()+1).padStart(2,'0')}` === period &&
        r.bridgeClassification === view)
      .sort((a, b) => Math.abs(b.bridgeValue) - Math.abs(a.bridgeValue))
      .slice(0, 15)
  }, [bridgeTable, lb, period, view])

  const BC = getACVBridgeColor(T)

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {VIEWS.map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: '5px 12px', borderRadius: 20, border: `1px solid ${view === v ? BC[v] || T.brandPrimary : T.borderDefault}`,
            background: view === v ? `${BC[v] || T.brandPrimary}15` : 'transparent',
            color: view === v ? BC[v] || T.brandPrimary : T.textTertiary,
            fontSize: 11, fontWeight: view === v ? 700 : 400, cursor: 'pointer',
          }}>{v}</button>
        ))}
      </div>
      {movers.length === 0
        ? <div style={{ padding: 32, textAlign: 'center', color: T.textMuted, fontSize: 12 }}>No {view} movements in this period</div>
        : movers.map((r, i) => {
          const abs = Math.abs(r.bridgeValue)
          const letter = String(r.customer || '?')[0].toUpperCase()
          const color = isNeg ? T.decline : T.growth
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 8, marginBottom: 6,
              background: T.bgSurface, border: `1px solid ${color}20`,
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color, flexShrink: 0 }}>{letter}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: T.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.customer}</div>
                <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 2 }}>{r.product !== 'N/A' ? r.product : ''} {r.region !== 'N/A' ? `· ${r.region}` : ''}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color }}>{isNeg ? '▼' : '▲'} {fmt(abs)}</div>
                <div style={{ fontSize: 9, color: T.textMuted, marginTop: 2 }}>#{i+1}</div>
              </div>
            </div>
          )
        })
      }
    </div>
  )
}

// ─── Historical ACV Trend ─────────────────────────────────────────────────────
function HistoricalACV({ bridgeTable, T }) {
  const data = useMemo(() => {
    const periods = [...new Set(bridgeTable.filter(r => r.monthLookback === 12).map(r =>
      `${r.date.getFullYear()}-${String(r.date.getMonth()+1).padStart(2,'0')}`)
    )].sort()

    return periods.map(period => {
      const rows = bridgeTable.filter(r => r.monthLookback === 12 &&
        `${r.date.getFullYear()}-${String(r.date.getMonth()+1).padStart(2,'0')}` === period)
      const sum = cls => rows.filter(r => r.bridgeClassification === cls).reduce((s,r) => s+r.bridgeValue, 0)
      return {
        period,
        label: new Date(period + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        endingACV:  sum('Ending ACV'),
        priorACV:   sum('Prior ACV'),
        expiryPool: sum('Expiry Pool'),
        newLogo:    sum('New Logo'),
        upsell:     sum('Upsell'),
        churn:      Math.abs(sum('Churn')),
        addOn:      sum('Add-on'),
      }
    })
  }, [bridgeTable])

  if (data.length < 2) return <div style={{ padding: 40, textAlign: 'center', color: T.textMuted, fontSize: 12 }}>Need multiple periods for historical view</div>

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, marginBottom: 12 }}>Ending ACV Trend</div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 40, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.chartGrid} />
          <XAxis dataKey="label" tick={{ fill: T.chartAxis, fontSize: 9 }} angle={-35} textAnchor="end" />
          <YAxis tick={{ fill: T.chartAxis, fontSize: 10 }} tickFormatter={v => fmt(v)} />
          <Tooltip formatter={v => [fmt(v)]} contentStyle={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 8, fontSize: 11, color: T.textPrimary }} />
          <Line type="monotone" dataKey="endingACV"  name="Ending ACV"  stroke={T.chartBaseline}    strokeWidth={2.5} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="expiryPool" name="Expiry Pool" stroke={T.chartNeutral}     strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 2" />
          <Line type="monotone" dataKey="newLogo"    name="New Logo"    stroke={T.chartExpansion}   strokeWidth={1.5} dot={{ r: 2 }} />
          <Line type="monotone" dataKey="churn"      name="Churn"       stroke={T.chartContraction} strokeWidth={1.5} dot={{ r: 2 }} />
          <Legend wrapperStyle={{ fontSize: 10, color: T.textSecondary }} />
        </LineChart>
      </ResponsiveContainer>

      <div style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, margin: '24px 0 12px' }}>Movement Mix (lb=12)</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 10, right: 20, bottom: 40, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.chartGrid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: T.chartAxis, fontSize: 9 }} angle={-35} textAnchor="end" />
          <YAxis tick={{ fill: T.chartAxis, fontSize: 10 }} tickFormatter={v => fmt(v)} />
          <Tooltip formatter={v => [fmt(v)]} contentStyle={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 8, fontSize: 11, color: T.textPrimary }} />
          <Bar dataKey="newLogo" name="New Logo" stackId="pos" fill={T.chartExpansion} />
          <Bar dataKey="upsell"  name="Upsell"   stackId="pos" fill={`${T.chartExpansion}88`} />
          <Bar dataKey="addOn"   name="Add-on"   stackId="pos" fill={`${T.chartExpansion}55`} />
          <Bar dataKey="churn"   name="Churn"    stackId="neg" fill={T.chartContraction} />
          <Legend wrapperStyle={{ fontSize: 10, color: T.textSecondary }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Account 360 (ACV) ────────────────────────────────────────────────────────
function Account360({ bridgeTable, bookingsTable, T }) {
  const customers = useMemo(() =>
    [...new Set(bridgeTable.map(r => r.customer))].sort(), [bridgeTable])
  const [sel, setSel] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => { if (customers.length && !sel) setSel(customers[0]) }, [customers])

  const contracts = useMemo(() =>
    bookingsTable.filter(r => r.customer === sel && r.inScope)
      .sort((a,b) => a.contractStart - b.contractStart)
  , [bookingsTable, sel])

  const history = useMemo(() =>
    bridgeTable.filter(r => r.customer === sel && r.monthLookback === 12)
      .sort((a,b) => a.date - b.date)
  , [bridgeTable, sel])

  const latestACV = useMemo(() => {
    const ending = history.filter(r => r.bridgeClassification === 'Ending ACV')
    return ending.length ? ending[ending.length - 1].bridgeValue : 0
  }, [history])

  const totalChurn = history.filter(r => r.bridgeClassification === 'Churn').reduce((s,r) => s+r.bridgeValue, 0)
  const totalUpsell = history.filter(r => r.bridgeClassification === 'Upsell').reduce((s,r) => s+r.bridgeValue, 0)
  const isExpiring = contracts.some(c => {
    const msTillExpiry = c.contractEnd - new Date()
    return msTillExpiry > 0 && msTillExpiry < 90 * 24 * 60 * 60 * 1000
  })

  return (
    <div>
      {/* Customer selector */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <button onClick={() => setOpen(o => !o)} style={{
          width: '100%', padding: '10px 14px', borderRadius: 8,
          border: `1px solid ${T.borderDefault}`, background: T.bgSurface,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.textPrimary,
        }}>
          {sel || 'Select customer'}
          {open ? <ChevronUp size={14} color={T.textTertiary} /> : <ChevronDown size={14} color={T.textTertiary} />}
        </button>
        {open && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 99,
            background: T.bgSurface, border: `1px solid ${T.borderDefault}`,
            borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            maxHeight: 240, overflowY: 'auto', marginTop: 4,
          }}>
            {customers.map(c => (
              <div key={c} onClick={() => { setSel(c); setOpen(false) }} style={{
                padding: '9px 14px', fontSize: 12, cursor: 'pointer',
                color: c === sel ? T.brandPrimary : T.textSecondary,
                background: c === sel ? T.brandSoft : 'transparent',
                fontWeight: c === sel ? 700 : 400,
              }}
              onMouseEnter={e => e.currentTarget.style.background = T.bgRaised}
              onMouseLeave={e => e.currentTarget.style.background = c === sel ? T.brandSoft : 'transparent'}>
                {c}
              </div>
            ))}
          </div>
        )}
      </div>

      {sel && (
        <>
          {/* KPI strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
            <KpiCard label="Current ACV" value={fmt(latestACV)} T={T} accent />
            <KpiCard label="Total Contracts" value={contracts.length} T={T} />
            <KpiCard label="Lifetime Upsell" value={fmt(totalUpsell)} subGood={true} sub={totalUpsell > 0 ? 'expansion' : null} T={T} />
            <KpiCard label="Expiring Soon" value={isExpiring ? 'YES' : 'No'} subGood={!isExpiring} sub={isExpiring ? '< 90 days' : 'All clear'} T={T} />
          </div>

          {/* Contract timeline */}
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Contract Timeline</div>
          <div style={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '8px 14px', borderBottom: `1px solid ${T.borderSubtle}`, background: T.bgRaised }}>
              {['Product','Start','End','ACV','TCV'].map(h => (
                <div key={h} style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
              ))}
            </div>
            {contracts.map((c, i) => {
              const daysLeft = Math.round((c.contractEnd - new Date()) / (1000 * 60 * 60 * 24))
              const expiring = daysLeft >= 0 && daysLeft < 90
              return (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                  padding: '10px 14px', borderBottom: `1px solid ${T.borderSubtle}`,
                  background: expiring ? `${T.warning}0A` : 'transparent',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary }}>{c.product !== 'N/A' ? c.product : '—'}</div>
                  <div style={{ fontSize: 11, fontFamily: T.mono, color: T.textSecondary }}>{c.contractStart.toLocaleDateString('en-US',{month:'short',year:'numeric'})}</div>
                  <div style={{ fontSize: 11, fontFamily: T.mono, color: expiring ? T.warning : T.textSecondary }}>
                    {c.contractEnd.toLocaleDateString('en-US',{month:'short',year:'numeric'})}
                    {expiring && <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 700, color: T.warning }}>⚠ {daysLeft}d</span>}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: T.mono, fontWeight: 700, color: T.textPrimary }}>{fmt(c.acv)}</div>
                  <div style={{ fontSize: 11, fontFamily: T.mono, color: T.textTertiary }}>{fmt(c.tcv)}</div>
                </div>
              )
            })}
          </div>

          {/* Movement history */}
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Bridge History (lb=12)</div>
          <div style={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 10, overflow: 'hidden' }}>
            {history.filter(r => !['Prior ACV','Ending ACV','Expiry Pool'].includes(r.bridgeClassification)).slice(0, 20).map((r, i) => {
              const BC = getACVBridgeColor(T)
              const color = BC[r.bridgeClassification] || T.textTertiary
              const period = `${r.date.getFullYear()}-${String(r.date.getMonth()+1).padStart(2,'0')}`
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderBottom: `1px solid ${T.borderSubtle}` }}>
                  <div style={{ fontSize: 11, fontFamily: T.mono, color: T.textMuted, width: 60 }}>{period}</div>
                  <div style={{ flex: 1, marginLeft: 12 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}15`, padding: '2px 7px', borderRadius: 10 }}>
                      {r.bridgeClassification}
                    </span>
                  </div>
                  <div style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: r.bridgeValue >= 0 ? T.growth : T.decline }}>
                    {r.bridgeValue >= 0 ? '+' : ''}{fmt(r.bridgeValue)}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'summary',     label: 'Summary',       icon: Zap },
  { id: 'bridge',      label: 'ACV Bridge',    icon: TrendingUp },
  { id: 'expiry',      label: 'Expiry Pool',   icon: Clock },
  { id: 'renewal',     label: 'Renewal Rates', icon: Shield },
  { id: 'bookings',    label: 'Bookings Walk', icon: FileText },
  { id: 'movers',      label: 'Top Movers',    icon: Target },
  { id: 'historical',  label: 'Historical',    icon: Layers },
  { id: 'account360',  label: 'Account 360',   icon: Users },
]

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ACVCenter() {
  const router = useRouter()

  // Theme
  const [themeMode, setThemeMode] = useState('dark')
  const T = THEMES[themeMode] || THEMES.dark

  // Auth
  const [profile, setProfile] = useState(null)

  // Engine state
  const [engineOutput, setEngineOutput] = useState(null)
  const [running, setRunning]           = useState(false)
  const [error, setError]               = useState('')

  // UI state
  const [tab, setTab]       = useState('summary')
  const [lb, setLb]         = useState(12)
  const [selPeriod, setSelPeriod] = useState('')
  const [revenueUnit, setRevenueUnit] = useState('TCV')
  const [apiResults,  setApiResults]  = useState(null)
  const [hasStoredData, setHasStoredData] = useState(true) // optimistic — assume data exists until proven otherwise

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }
      supabase.from('profiles').select('*').eq('id', session.user.id).single()
        .then(({ data }) => setProfile(data))
    })
  }, [])

  // Load pre-computed context from upload wizard → call FastAPI → render
  useEffect(() => {
    // ── Try rl_acv_ready first (set by launchAnalytics in upload wizard) ──────
    const ready = (() => { try { const r = sessionStorage.getItem('rl_acv_ready'); return r ? JSON.parse(r) : null } catch { return null } })()
    const cube  = dataCubeStore.load()

    if (!ready && !cube?.csvText) { setHasStoredData(false); return }  // nothing loaded — show empty state

    const mapping              = ready?.mapping      || cube?.meta?.mapping      || {}
    const revenueUnitFromStore = ready?.revenueUnit  || cube?.meta?.revenueUnit  || 'TCV'
    const analysisType         = ready?.analysisType || cube?.meta?.analysisType || ''
    setRevenueUnit(revenueUnitFromStore)

    if (analysisType && analysisType !== 'acv_tcv') {
      setError('This dataset was uploaded as MRR/ARR. Please re-upload with ACV / Contract Analysis selected.')
      return
    }

    if (cube?.csvText) {
      callFastAPI(cube, mapping, revenueUnitFromStore)
    } else if (ready?.mapped?.length) {
      // No csvText but we have pre-mapped rows — run browser engine directly
      setRunning(true)
      setTimeout(() => {
        try {
          const output = runACVEngine(ready.mapped.map(r => ({ ...r, revenueUnit: revenueUnitFromStore })))
          setEngineOutput(output)
          const allPeriods = [...new Set(
            output.bridgeTable.filter(r => r.monthLookback === 12)
              .map(r => `${r.date.getFullYear()}-${String(r.date.getMonth()+1).padStart(2,'0')}`)
          )].sort()
          if (allPeriods.length) setSelPeriod(allPeriods[allPeriods.length - 1])
        } catch(e) { setError(`Engine error: ${e.message}`) }
        setRunning(false)
      }, 50)
    }
  }, [])

  async function callFastAPI(cube, mapping, unit) {
    setRunning(true)
    setError('')
    try {
      const blob = new Blob([cube.csvText], { type: 'text/csv' })
      const file = new File([blob], cube.meta?.fileName || 'data.csv', { type: 'text/csv' })
      const fd = new FormData()
      fd.append('file',           file)
      fd.append('customer_col',   mapping.customer      || '')
      fd.append('order_date_col', mapping.date          || '')
      fd.append('start_col',      mapping.contractStart || '')
      fd.append('end_col',        mapping.contractEnd   || '')
      fd.append('tcv_col',        mapping.tcv           || '')
      fd.append('revenue_unit',   unit)
      fd.append('lookbacks',      JSON.stringify([1, 3, 12]))
      fd.append('n_movers',       '30')
      if (mapping.product)  fd.append('product_col',  mapping.product)
      if (mapping.channel)  fd.append('channel_col',  mapping.channel)
      if (mapping.region)   fd.append('region_col',   mapping.region)
      if (mapping.quantity) fd.append('quantity_col', mapping.quantity)

      const { data } = await axios.post(`${API}/api/acv/analyze`, fd, { timeout: 120000 })
      setApiResults(data)
      setRunning(false)
      // Browser engine only if API succeeded — deferred so UI renders first
      setTimeout(() => runBrowserEngine(cube.csvText, mapping, unit), 100)
    } catch(e) {
      console.warn('FastAPI ACV failed, running browser engine:', e.message)
      // Defer browser engine so loading spinner renders first
      setTimeout(() => runBrowserEngine(cube.csvText, mapping, unit), 50)
    }
  }

  function runBrowserEngine(csvText, mapping, unit) {
    try {
      const splitLine = (line) => {
        const vals = []; let cur = '', inQ = false
        for (let i = 0; i < line.length; i++) {
          const ch = line[i]
          if (ch === '"') { inQ = !inQ }
          else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = '' }
          else { cur += ch }
        }
        vals.push(cur.trim())
        return vals.map(v => v.replace(/^["']|["']$/g, ''))
      }
      const lines   = csvText.split('\n').filter(l => l.trim())
      const headers = splitLine(lines[0])

      // Only process first 5000 rows in browser — full dataset handled by FastAPI
      const MAX_ROWS = 5000
      const rawRows = lines.slice(1, MAX_ROWS + 1).map(line => {
        const vals = splitLine(line); const row = {}
        headers.forEach((h, i) => { row[h] = vals[i] || '' }); return row
      })

      const mapped = rawRows.map(r => ({
        customer:      String(r[mapping.customer]      || ''),
        product:       String(r[mapping.product]       || 'N/A'),
        channel:       String(r[mapping.channel]       || 'N/A'),
        region:        String(r[mapping.region]        || 'N/A'),
        contractStart: String(r[mapping.contractStart] || ''),
        contractEnd:   String(r[mapping.contractEnd]   || ''),
        tcv:           parseFloat(String(r[mapping.tcv] || 0).replace(/[,$]/g,'')) || 0,
        quantity:      parseFloat(String(r[mapping.quantity] || 1)) || 1,
        revenueUnit:   unit,
      })).filter(r => r.customer && r.contractStart && r.contractEnd && r.tcv > 0)

      if (!mapped.length) {
        setError('No valid contract rows found. Check Customer, Contract Start, Contract End and TCV are mapped correctly.')
        setRunning(false)
        return
      }
      const output = runACVEngine(mapped)
      setEngineOutput(output)
      const allPeriods = [...new Set(
        output.bridgeTable.filter(r => r.monthLookback === 12)
          .map(r => `${r.date.getFullYear()}-${String(r.date.getMonth()+1).padStart(2,'0')}`)
      )].sort()
      if (allPeriods.length) setSelPeriod(allPeriods[allPeriods.length - 1])
    } catch(e) {
      setError(`Engine error: ${e.message}`)
    }
    setRunning(false)
  }

  // KPIs for selected period
  const kpis = useMemo(() => {
    if (!engineOutput) return null
    return calcACVKPIs(engineOutput.bridgeTable, lb, selPeriod)
  }, [engineOutput, lb, selPeriod])

  // All available periods
  const periods = useMemo(() => {
    if (!engineOutput) return []
    return [...new Set(
      engineOutput.bridgeTable
        .filter(r => r.monthLookback === lb)
        .map(r => `${r.date.getFullYear()}-${String(r.date.getMonth()+1).padStart(2,'0')}`)
    )].sort()
  }, [engineOutput, lb])

  // Format period label
  const fmtPeriod = p => {
    if (!p) return '—'
    const [yr, mo] = p.split('-').map(Number)
    return new Date(yr, mo-1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: T.bgPage, fontFamily: "'Inter','Helvetica Neue',sans-serif" }}>

      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: T.bgSurface, borderBottom: `1px solid ${T.borderDefault}`,
        padding: '0 24px', height: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: T.brandPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={14} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, lineHeight: 1 }}>ACV / Contract Analytics</div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>RevenueLens</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Theme toggle */}
          <div style={{ display: 'flex', gap: 3, background: T.bgRaised, padding: 3, borderRadius: 8 }}>
            {Object.keys(THEMES).map(t => (
              <button key={t} onClick={() => setThemeMode(t)} style={{
                width: 22, height: 22, borderRadius: 5, border: 'none',
                background: themeMode === t ? T.brandPrimary : 'transparent',
                cursor: 'pointer', fontSize: 9, fontWeight: 700,
                color: themeMode === t ? '#fff' : T.textMuted,
              }}>{t[0].toUpperCase()}</button>
            ))}
          </div>

          {/* Lookback selector */}
          <div style={{ display: 'flex', gap: 3, background: T.bgRaised, padding: 3, borderRadius: 8 }}>
            {[1, 3, 12].map(l => (
              <button key={l} onClick={() => setLb(l)} style={{
                padding: '3px 10px', borderRadius: 5, border: 'none',
                background: lb === l ? T.brandPrimary : 'transparent',
                color: lb === l ? '#fff' : T.textMuted,
                fontSize: 11, fontWeight: lb === l ? 700 : 400, cursor: 'pointer',
              }}>{l}M</button>
            ))}
          </div>

          {/* Period selector */}
          {periods.length > 0 && (
            <select value={selPeriod} onChange={e => setSelPeriod(e.target.value)} style={{
              padding: '4px 10px', borderRadius: 7, border: `1px solid ${T.borderDefault}`,
              background: T.bgSurface, color: T.textPrimary, fontSize: 11,
              fontFamily: T.mono, cursor: 'pointer', outline: 'none',
            }}>
              {periods.map(p => <option key={p} value={p}>{fmtPeriod(p)}</option>)}
            </select>
          )}

          {/* Back to dashboard */}
          <button onClick={() => router.push('/dashboard')} style={{
            padding: '5px 12px', borderRadius: 7, border: `1px solid ${T.borderDefault}`,
            background: 'transparent', color: T.textSecondary, fontSize: 11, cursor: 'pointer',
          }}>← Dashboard</button>
        </div>
      </div>

      {/* ── Main layout ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 24px' }}>

        {/* Empty state — only when no data in store AND no pre-computed context */}
        {!engineOutput && !running && !error && !apiResults && !hasStoredData && (
          <div style={{ textAlign: 'center', padding: '80px 24px' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: T.brandSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <FileText size={24} color={T.brandPrimary} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary, marginBottom: 8 }}>No contract data loaded</div>
            <div style={{ fontSize: 13, color: T.textTertiary, marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
              Upload a contract dataset (with start date, end date, and TCV) through the Analytics Engine.
            </div>
            <button onClick={() => router.push('/dashboard/upload')} style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: T.brandPrimary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>Upload Contract Data</button>
          </div>
        )}

        {/* Loading */}
        {running && (
          <div style={{ textAlign: 'center', padding: '80px 24px' }}>
            <RefreshCw size={32} color={T.brandPrimary} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ fontSize: 14, color: T.textSecondary }}>Running ACV classification engine…</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: '16px 20px', borderRadius: 10, background: `${T.decline}0F`, border: `1px solid ${T.decline}33`, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <AlertCircle size={16} color={T.decline} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.decline, marginBottom: 4 }}>Engine Error</div>
              <div style={{ fontSize: 11, color: T.textSecondary }}>{error}</div>
            </div>
          </div>
        )}

        {/* ── Results ──────────────────────────────────────────────────────── */}
        {engineOutput && !running && (
          <>
            {/* QC Banner */}
            <QCBanner qc={engineOutput.qc} T={T} />

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 2, overflowX: 'auto', borderBottom: `1px solid ${T.borderDefault}`, marginBottom: 24, scrollbarWidth: 'none' }}>
              {TABS.map(t => {
                const Icon = t.icon
                return (
                  <button key={t.id} onClick={() => setTab(t.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '10px 16px', border: 'none', background: 'transparent',
                    borderBottom: tab === t.id ? `2px solid ${T.brandPrimary}` : '2px solid transparent',
                    marginBottom: -1, cursor: 'pointer', whiteSpace: 'nowrap',
                    color: tab === t.id ? T.brandPrimary : T.textTertiary,
                    fontSize: 12, fontWeight: tab === t.id ? 700 : 400,
                  }}>
                    <Icon size={12} />
                    {t.label}
                  </button>
                )
              })}
            </div>

            {/* ── SUMMARY TAB ─────────────────────────────────────────────── */}
            {tab === 'summary' && kpis && (
              <div>
                {/* KPI strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 24 }}>
                  <KpiCard label="Prior ACV"      value={fmt(kpis.priorACV)}   T={T} accent />
                  <KpiCard label="Ending ACV"     value={fmt(kpis.endingACV)}
                    sub={kpis.priorACV > 0 ? `${kpis.netChange >= 0 ? '+' : ''}${fmt(kpis.netChange)} (${((kpis.netChange/kpis.priorACV)*100).toFixed(1)}%)` : null}
                    subGood={kpis.netChange >= 0} T={T} accent />
                  <KpiCard label="Gross Renewal"  value={fmtPct(kpis.grossRenewal)} subGood={kpis.grossRenewal != null && kpis.grossRenewal >= 0.85} sub={kpis.grossRenewal != null ? (kpis.grossRenewal >= 0.85 ? 'Healthy' : 'Needs attention') : null} T={T} />
                  <KpiCard label="Net Renewal"    value={fmtPct(kpis.netRenewal)}   subGood={kpis.netRenewal  != null && kpis.netRenewal  >= 1.00} sub={kpis.netRenewal  != null ? (kpis.netRenewal  >= 1.00 ? 'Expanding' : 'Contracting') : null} T={T} />
                  <KpiCard label="Expiry Pool"    value={fmt(kpis.expiryPool)} sub="Due to renew" T={T} />
                  <KpiCard label="New Bookings"   value={fmt(kpis.newLogo + kpis.crossSell)} sub="New Logo + Cross-sell" subGood={kpis.newLogo + kpis.crossSell > 0} T={T} />
                </div>

                {/* Second KPI row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 24 }}>
                  <KpiCard label="Upsell"      value={fmt(kpis.upsell)}    subGood={kpis.upsell > 0}    sub={kpis.upsell > 0 ? 'Expansion' : null} T={T} />
                  <KpiCard label="Add-on"      value={fmt(kpis.addOn)}     subGood={kpis.addOn > 0}     sub="Mid-term" T={T} />
                  <KpiCard label="Churn"       value={fmt(kpis.churn)}     subGood={kpis.churn === 0}   sub={kpis.churn < 0 ? 'Revenue lost' : null} T={T} />
                  <KpiCard label="Downsell"    value={fmt(kpis.downsell)}  subGood={kpis.downsell >= 0} T={T} />
                  <KpiCard label="Lapsed"      value={fmt(kpis.lapsed)}    subGood={kpis.lapsed === 0}  T={T} />
                </div>

                {/* AI narrative */}
                {kpis && (
                  <div style={{ padding: '14px 18px', borderRadius: 10, background: T.brandSoft, border: `1px solid ${T.brandBorder}`, marginBottom: 24 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.brandPrimary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>✦ RevenueLens AI — Contract Summary</div>
                    <div style={{ fontSize: 13, color: T.textPrimary, lineHeight: 1.7 }}>
                      {(() => {
                        const gr = kpis.grossRenewal, nr = kpis.netRenewal
                        let s = `ACV moved from ${fmt(kpis.priorACV)} to ${fmt(kpis.endingACV)} (${kpis.netChange >= 0 ? '+' : ''}${fmt(kpis.netChange)}).`
                        if (gr != null) s += ` Gross renewal rate of ${fmtPct(gr)} — ${gr >= 0.9 ? 'strong retention' : gr >= 0.8 ? 'moderate retention' : 'retention needs attention'}.`
                        if (nr != null) s += ` Net renewal rate of ${fmtPct(nr)} — ${nr >= 1 ? 'expansion outpacing churn' : 'net contraction'}.`
                        if (kpis.expiryPool > 0) s += ` Expiry pool of ${fmt(kpis.expiryPool)} due for renewal.`
                        if (kpis.addOn > 0) s += ` ${fmt(kpis.addOn)} in Add-on ACV from mid-term expansions.`
                        if (kpis.churn < 0) s += ` Churn of ${fmt(Math.abs(kpis.churn))} — ${Math.abs(kpis.churn) / kpis.expiryPool > 0.1 ? 'above 10% threshold, investigate' : 'controlled'}.`
                        return s
                      })()}
                    </div>
                  </div>
                )}

                {/* Mini waterfall preview */}
                <div style={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 10, padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 16 }}>
                    ACV Bridge — {fmtPeriod(selPeriod)} · {lb}M Lookback
                  </div>
                  <ACVWaterfall bridgeTable={engineOutput.bridgeTable} lb={lb} period={selPeriod} T={T} />
                </div>
              </div>
            )}

            {/* ── ACV BRIDGE TAB ──────────────────────────────────────────── */}
            {tab === 'bridge' && (
              <div style={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>ACV Bridge Waterfall</div>
                <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 20 }}>
                  {fmtPeriod(selPeriod)} · {lb}-Month Lookback · {revenueUnit} basis → ACV normalised
                </div>
                <ACVWaterfall bridgeTable={engineOutput.bridgeTable} lb={lb} period={selPeriod} T={T} />

                {/* Bridge detail table */}
                <div style={{ marginTop: 24, background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '8px 14px', background: T.bgRaised, borderBottom: `1px solid ${T.borderSubtle}` }}>
                    {['Classification','Customer','Product','ACV','Bridge Value'].map(h => (
                      <div key={h} style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                    ))}
                  </div>
                  {engineOutput.bridgeTable
                    .filter(r => r.monthLookback === lb && selPeriod &&
                      `${r.date.getFullYear()}-${String(r.date.getMonth()+1).padStart(2,'0')}` === selPeriod &&
                      !['Prior ACV','Ending ACV','Expiry Pool','RoB'].includes(r.bridgeClassification))
                    .sort((a,b) => Math.abs(b.bridgeValue) - Math.abs(a.bridgeValue))
                    .slice(0, 30)
                    .map((r, i) => {
                      const BC = getACVBridgeColor(T)
                      const color = BC[r.bridgeClassification] || T.textTertiary
                      return (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '9px 14px', borderBottom: `1px solid ${T.borderSubtle}` }}>
                          <div><span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}15`, padding: '2px 7px', borderRadius: 10 }}>{r.bridgeClassification}</span></div>
                          <div style={{ fontSize: 11, color: T.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.customer}</div>
                          <div style={{ fontSize: 11, color: T.textTertiary }}>{r.product !== 'N/A' ? r.product : '—'}</div>
                          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textSecondary }}>{fmt(r.acvNew)}</div>
                          <div style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, color: r.bridgeValue >= 0 ? T.growth : T.decline }}>
                            {r.bridgeValue >= 0 ? '+' : ''}{fmt(r.bridgeValue)}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {/* ── EXPIRY POOL TAB ─────────────────────────────────────────── */}
            {tab === 'expiry' && (
              <div style={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>Expiry Pool Analysis</div>
                <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 20 }}>Contracts due for renewal by month — forward-looking view</div>
                <ExpiryTimeline bridgeTable={engineOutput.bridgeTable} selPeriod={selPeriod} T={T} />
              </div>
            )}

            {/* ── RENEWAL RATES TAB ───────────────────────────────────────── */}
            {tab === 'renewal' && (
              <div style={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>Renewal Rate Intelligence</div>
                <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 20 }}>Gross Renewal = (Expiry Pool − Churn − Churn-Partial) / Expiry Pool · Net Renewal adds Upsell − Downsell</div>
                <RenewalRateTrend bridgeTable={engineOutput.bridgeTable} lb={lb} T={T} />
              </div>
            )}

            {/* ── BOOKINGS WALK TAB ───────────────────────────────────────── */}
            {tab === 'bookings' && (
              <div style={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>Bookings-to-ACV Walk</div>
                <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 20 }}>PE-grade reconciliation from source TCV bookings to recognised Ending ACV</div>
                <BookingsWalk bookingsTable={engineOutput.bookingsTable} bridgeTable={engineOutput.bridgeTable} lb={lb} period={selPeriod} T={T} />
              </div>
            )}

            {/* ── TOP MOVERS TAB ──────────────────────────────────────────── */}
            {tab === 'movers' && (
              <div style={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>Top Movers</div>
                <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 20 }}>Largest movements by classification for {fmtPeriod(selPeriod)}</div>
                <ACVTopMovers bridgeTable={engineOutput.bridgeTable} lb={lb} period={selPeriod} T={T} />
              </div>
            )}

            {/* ── HISTORICAL TAB ──────────────────────────────────────────── */}
            {tab === 'historical' && (
              <div style={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>Historical ACV Performance</div>
                <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 20 }}>Multi-period ACV trend — lb=12 basis</div>
                <HistoricalACV bridgeTable={engineOutput.bridgeTable} T={T} />
              </div>
            )}

            {/* ── ACCOUNT 360 TAB ─────────────────────────────────────────── */}
            {tab === 'account360' && (
              <div style={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>Account 360</div>
                <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 20 }}>Full contract timeline, renewal history and bridge movements per customer</div>
                <Account360 bridgeTable={engineOutput.bridgeTable} bookingsTable={engineOutput.bookingsTable} T={T} />
              </div>
            )}

          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box }
        ::-webkit-scrollbar { display: none }
      `}</style>
    </div>
  )
}
