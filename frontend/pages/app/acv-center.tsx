// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// acv-center.tsx — RevenueLens ACV / Contract Analytics Center
// ─────────────────────────────────────────────────────────────────────────────
// ISOLATED: Zero imports from command-center.tsx
// ENGINE:   ../lib/acvEngine (acvEngine.ts)
// ROUTE:    /app/acv-center
// ─────────────────────────────────────────────────────────────────────────────
//
// FIX LOG (this version):
//   - callFastAPI(): QC object from the backend uses keys qc1/qc2/qc3/qc4 and
//     qc1_detail/qc2_detail/qc3_detail/qc4_detail. This was being passed
//     straight through as `data.qc`, but QCBanner (and the rest of the UI)
//     expects qc1Pass/qc1Detail/qc2Pass/... (camelCase, "Pass" suffix).
//     Since data.qc always exists, the old `data.qc || {...camelCase fallback}`
//     never actually used the fallback's correct key names — it silently
//     passed through the mismatched raw object, so qc.qc1Pass was always
//     undefined (falsy), making the QC banner show "WARNING" on every load
//     even when all four checks genuinely passed on the backend.
//     Fixed by explicitly mapping rawQc -> the camelCase shape everywhere else.
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
  Calendar, Shield, Zap, Layers, Target, DollarSign, Clock, Users, Sparkles
} from 'lucide-react'
import axios from 'axios'
import { supabase } from '../../lib/supabase'
import { dataCubeStore } from '../../lib/dataCubeStore'
const API = process.env.NEXT_PUBLIC_API_URL || 'https://revenuelens-api.onrender.com'

import {
  calcACVKPIs, buildACVWaterfall, buildExpiryPool,
  buildRenewalRateTrend, buildCohortGrid, calcCustomerKPIs,
  ACV_WATERFALL_ORDER, ACV_BRIDGE_COLORS
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
  'Prior ACV':          T.chartBaseline,
  'Ending ACV':         T.chartBaseline,
  'Expiry Pool':        T.chartNeutral,
  'RoB':           '#94A3B8',   // Not Up for Renewal
  'New Logo':      T.chartExpansion,
  'Cross-sell':    T.chartExpansion,
  'Upsell':        T.chartExpansion,
  'Add on':        T.chartExpansion,
  'Returning':     T.chartExpansion,
  'Other In':      T.chartNeutral,
  'Churn':         T.chartContraction,
  'Churn Partial': T.chartContraction,
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
    const dateStr = period
    const rows = bridgeTable.filter(r =>
      r.monthLookback === lb &&
      `${r.date.getFullYear()}-${String(r.date.getMonth()+1).padStart(2,'0')}` === dateStr
    )
    const totals = {}
    for (const r of rows) totals[r.bridgeClassification] = (totals[r.bridgeClassification] || 0) + r.bridgeValue

    // Display name mapping: RoB → 'Not Up for Renewal' for bar labels
    const DISPLAY = { 'RoB': 'Not Up for Renewal' }

    let running = 0
    const wf = []
    for (const name of ACV_WATERFALL_ORDER) {
      const val = totals[name] || 0
      if (val === 0) continue
      const isAnchor  = name === 'Prior ACV' || name === 'Ending ACV'
      const isInfoBar = name === 'Expiry Pool' || name === 'RoB'
      const base = (isAnchor || isInfoBar) ? 0 : running
      wf.push({
        name:   DISPLAY[name] || name,
        base,
        value:  Math.abs(val),
        fill:   BC[name] || T.chartNeutral,
        isNeg:  !isAnchor && !isInfoBar && val < 0,
        rawVal: val,
        isInfo: isInfoBar,
      })
      if (!isAnchor && !isInfoBar) running += val
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
function ExpiryTimeline({ bridgeTable, selPeriod, T, rangeStart='', rangeEnd='' }) {
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
      .filter(([k]) => (!rangeStart || k >= rangeStart) && (!rangeEnd || k <= rangeEnd))
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
function RenewalRateTrend({ bridgeTable, lb, T, rangeStart='', rangeEnd='' }) {
  const data = useMemo(() => {
    const all = buildRenewalRateTrend(bridgeTable, lb)
    return all.filter(r =>
      (!rangeStart || r.date >= rangeStart) && (!rangeEnd || r.date <= rangeEnd) && r.expiryPool > 0
    )
  }, [bridgeTable, lb, rangeStart, rangeEnd])

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

// ─── Top Movers (ACV) — Risk & Opportunity ────────────────────────────────────
// Visual layout matches MRR/ARR's Top Movers tab (summary bar, Movement
// Intelligence banner, two-column Expansion/Churn Risk cards) — but every
// number here comes from the deterministic composite scoring engine
// (risk_opportunity.py) computed on the FULL customer set server-side, not
// MRR's raw single-classification "biggest movers" logic, and not capped
// to the top-200-by-movement customer_bridge subset used elsewhere.
//
// Each RiskScore/ExpansionScore decomposes into named, traceable reasons
// (riskReasons/expansionReasons) already computed server-side — shown
// directly on the card, no black box.

function RiskOpportunityCard({ row, isRisk, rank, T }) {
  const score  = isRisk ? row.riskScore : row.expansionScore
  const label  = isRisk ? row.riskLabel : row.expansionLabel
  const reasons = isRisk ? row.riskReasons : row.expansionReasons
  const color  = isRisk ? T.decline : T.growth
  const letter = String(row.customer || '?')[0].toUpperCase()

  return (
    <div style={{
      padding: '12px 14px', borderRadius: 6,
      background: T.bgSurface,
      border: `1px solid ${isRisk ? `${T.decline}20` : `${T.growth}1A`}`,
      marginBottom: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 5, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color, flexShrink: 0, marginTop: 1 }}>
          {letter}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: T.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>{row.customer}</div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, color }}>{score.toFixed(0)} · {label}</div>
              <div style={{ fontSize: 9, color: T.textMuted, marginTop: 1 }}>Ending ACV {fmt(row.endingACV)}</div>
            </div>
          </div>
          {reasons && reasons.length > 0 && (
            <div style={{ fontSize: 10, color: T.textTertiary, lineHeight: 1.5 }}>
              {reasons[0]}
            </div>
          )}
          <div style={{ height: 2, background: T.borderDefault, borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 2, background: color, width: `${Math.min(score,100)}%`, transition: 'width 0.5s ease' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Classification Browser — restored from the original per-category
// customer-movement view (New Logo / Upsell / Churn / etc.), sourced
// directly from bridgeTable/customer_bridge, unchanged logic from before.
// Sits alongside (not instead of) the Risk & Opportunity composite cards:
// composite = "who needs attention and why, scored"; this browser =
// "show me everyone who moved in category X this period", raw and literal.
function ACVClassificationBrowser({ bridgeTable, lb, period, T }) {
  const [view, setView] = useState('Churn')
  const VIEWS = ['New Logo', 'Upsell', 'Add on', 'Churn', 'Downsell', 'Lapsed']
  const isNeg = ['Churn', 'Downsell', 'Lapsed'].includes(view)

  const movers = useMemo(() => {
    if (!bridgeTable.length || !period) return []
    return bridgeTable
      .filter(r => r.customer &&   // exclude period-level total rows (customer === '')
        r.monthLookback === lb &&
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

function ACVTopMovers({ riskOpportunitySummary, riskOpportunityDetail, bridgeTable, lb, period, T }) {
  const summaryRow = useMemo(() =>
    (riskOpportunitySummary || []).find(r => r.period === period) || null
  , [riskOpportunitySummary, period])

  const detailRows = useMemo(() =>
    (riskOpportunityDetail || []).filter(r => r.period === period)
  , [riskOpportunityDetail, period])

  const riskList = useMemo(() =>
    detailRows.filter(r => ['Elevated', 'Critical'].includes(r.riskLabel))
      .sort((a, b) => b.riskScore - a.riskScore)
  , [detailRows])

  const expansionList = useMemo(() =>
    detailRows.filter(r => ['Good', 'High'].includes(r.expansionLabel))
      .sort((a, b) => b.expansionScore - a.expansionScore)
  , [detailRows])

  // Header stats come from the FULL-population summary (never capped),
  // not from the capped detail list — so these numbers stay accurate even
  // though only the top N customers are shown as cards below.
  const riskCount = summaryRow?.riskCount ?? riskList.length
  const expCount  = summaryRow?.expansionCount ?? expansionList.length
  const riskACV   = summaryRow?.riskACV ?? riskList.reduce((s, r) => s + (r.endingACV || 0), 0)
  const expACV    = summaryRow?.expansionACV ?? expansionList.reduce((s, r) => s + (r.endingACV || 0), 0)

  const ratio = riskCount > 0 ? (expCount / riskCount) : (expCount > 0 ? Infinity : 0)
  const ratioLabel = ratio === Infinity ? '∞' : ratio.toFixed(1)
  const ratioWinning = ratio >= 1

  const hasAnyData = (riskOpportunitySummary && riskOpportunitySummary.length > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {!hasAnyData ? (
        <div style={{ padding: 40, textAlign: 'center', color: T.textMuted, fontSize: 12 }}>
          No risk/opportunity data available for this dataset
        </div>
      ) : (
        <>
          {/* ── Summary bar — full population counts, not capped ──────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '10px 16px', background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div>
              <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textMuted }}>Expansion Opportunity</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.growth, fontFamily: T.mono, marginLeft: 8 }}>{fmt(expACV)}</span>
              <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 4 }}>({expCount} accounts)</span>
            </div>
            <div style={{ width: 1, height: 16, background: T.borderStrong }} />
            <div>
              <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textMuted }}>Churn Risk</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.decline, fontFamily: T.mono, marginLeft: 8 }}>{fmt(riskACV)}</span>
              <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 4 }}>({riskCount} accounts)</span>
            </div>
            {detailRows.length < (riskCount + expCount) && (
              <div style={{ marginLeft: 'auto', fontSize: 10, color: T.textMuted }}>
                Showing top {Math.min(riskList.length, 50)} risk · top {Math.min(expansionList.length, 50)} opportunity
              </div>
            )}
          </div>

          {/* ── Movement Intelligence banner — deterministic ───────────── */}
          <div style={{ background: T.bgSurface, border: `1px solid ${ratioWinning ? T.growth : T.decline}30`, borderLeft: `3px solid ${ratioWinning ? T.growth : T.decline}`, borderRadius: 6, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={11} color={ratioWinning ? T.growth : T.decline} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: ratioWinning ? T.growth : T.decline, flexShrink: 0 }}>Movement Intelligence</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary }}>
              Opportunity-to-Risk ratio: {ratioLabel}x — {ratioWinning ? 'expansion winning' : 'risk dominating'}
            </span>
          </div>

          {/* ── Two-column: Expansion | Churn Risk ─────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${T.borderDefault}`, background: T.bgRaised }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: `${T.growth}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUp size={13} color={T.growth} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.growth }}>Expansion Opportunities</div>
                    <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textSecondary }}>High upsell potential</div>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, background: `${T.growth}14`, color: T.growth, border: `1px solid ${T.borderDefault}`, padding: '3px 10px', borderRadius: 20 }}>
                  {expCount} accounts
                </span>
              </div>
              <div style={{ padding: 12, maxHeight: 520, overflowY: 'auto' }}>
                {expansionList.length
                  ? expansionList.map((row, i) => <RiskOpportunityCard key={i} row={row} isRisk={false} rank={i} T={T} />)
                  : <div style={{ textAlign: 'center', color: T.textSecondary, fontSize: 13, padding: 32 }}>No expansion opportunities detected for {period || 'this period'}</div>
                }
              </div>
            </div>

            <div style={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${T.borderDefault}`, background: T.bgRaised }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: `${T.decline}0F`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingDown size={13} color={T.decline} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.decline }}>Churn Risk</div>
                    <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textSecondary }}>Priority interventions</div>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, background: `${T.decline}0F`, color: T.decline, border: `1px solid ${T.borderDefault}`, padding: '3px 10px', borderRadius: 20 }}>
                  {riskCount} accounts
                </span>
              </div>
              <div style={{ padding: 12, maxHeight: 520, overflowY: 'auto' }}>
                {riskList.length
                  ? riskList.map((row, i) => <RiskOpportunityCard key={i} row={row} isRisk={true} rank={i} T={T} />)
                  : <div style={{ textAlign: 'center', color: T.textSecondary, fontSize: 13, padding: 32 }}>No accounts at elevated risk for {period || 'this period'}</div>
                }
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Classification Browser — restored, sits below the composite
           cards. Uses raw bridge classifications for this period, exactly
           as it worked before the Risk & Opportunity rebuild. ──────────── */}
      <div style={{ borderTop: `1px solid ${T.borderDefault}`, paddingTop: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>All Movements by Classification</div>
        <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 16 }}>Raw bridge movements for {period || 'this period'} — largest first</div>
        <ACVClassificationBrowser bridgeTable={bridgeTable} lb={lb} period={period} T={T} />
      </div>
    </div>
  )
}

// ─── Historical Performance (ACV) ─────────────────────────────────────────────
// ─── Historical Performance (ACV) ─────────────────────────────────────────────
// Visual design matches MRR/ARR's "Historical Revenue Performance" tab exactly
// (KPI strip, Retention Dynamics chart, Predictive Insight + Seasonality panel,
// Monthly Growth Audit table) — but every number here is computed from ACV's
// own bridge classifications (Prior/Ending ACV, Expiry Pool, Churn, Upsell,
// etc.), not ported from MRR's data model.
//
// 4th KPI card: "Renewal Exposure %" (Expiry Pool / Ending ACV) replaces MRR's
// "LTV Proxy" — chosen because it's a real, already-computed ACV-native number
// (no new math invented) and more meaningful for contract-based revenue than
// forcing MRR's NRR/Churn-Rate formula onto ACV.
//
// Predictive Insight and Seasonality panels are DETERMINISTIC template
// sentences built from real trend numbers — same as MRR's — not an LLM call.

function ACVHistoricalPerformance({ bridgeTable, T, rangeStart='', rangeEnd='', selPeriod='' }) {
  const [chartWindow, setChartWindow] = useState(12)

  // ── Per-period metrics from the real bridge table (lb=12 basis) ───────────
  const { periods, byPeriod } = useMemo(() => {
    const all = [...new Set(
      bridgeTable.filter(r => r.monthLookback === 12)
        .map(r => `${r.date.getFullYear()}-${String(r.date.getMonth()+1).padStart(2,'0')}`)
    )].sort().filter(p => (!rangeStart || p >= rangeStart) && (!rangeEnd || p <= rangeEnd))

    const byPeriod = {}
    for (const p of all) {
      const rows = bridgeTable.filter(r => r.monthLookback === 12 &&
        `${r.date.getFullYear()}-${String(r.date.getMonth()+1).padStart(2,'0')}` === p)
      const sum = cls => rows.filter(r => r.bridgeClassification === cls).reduce((s,r) => s+r.bridgeValue, 0)

      const ep      = sum('Expiry Pool')
      const ch      = sum('Churn')
      const cp      = sum('Churn Partial')
      const dn      = sum('Downsell')
      const up      = sum('Upsell')
      const prior   = sum('Prior ACV')
      const ending  = sum('Ending ACV')
      const addOn   = sum('Add on')
      const crossS  = sum('Cross-sell')
      const newLogo = sum('New Logo')
      const lapsed  = sum('Lapsed')
      const returning = sum('Returning')
      const otherIn  = sum('Other In')
      const otherOut = sum('Other Out')

      const expansion   = newLogo + crossS + up + addOn + returning + Math.max(otherIn, 0)
      const contraction = ch + cp + dn + lapsed + Math.min(otherOut, 0)

      byPeriod[p] = {
        priorACV: prior, endingACV: ending, expiryPool: ep,
        churn: ch, churnPartial: cp, downsell: dn, upsell: up,
        addOn, crossSell: crossS, newLogo, lapsed, returning,
        expansion, contraction,
        netExpansion: expansion + contraction,
        // GRR = (EP - Churn - ChurnP - Downsell) / EP
        grr: ep > 0 ? (ep + ch + cp + dn) / ep : null,
        // NRR = (EP - Churn - ChurnP - Downsell + Upsell) / EP
        nrr: ep > 0 ? (ep + ch + cp + dn + up) / ep : null,
        // Renewal Exposure % = Expiry Pool / Ending ACV
        renewalExposure: ending > 0 ? ep / ending : null,
      }
    }
    return { periods: all, byPeriod }
  }, [bridgeTable, rangeStart, rangeEnd])

  // ── Selected-period metrics ─────────────────────────────────────────────
  const selData = byPeriod[selPeriod] || null
  const nrr = selData?.nrr != null ? selData.nrr * 100 : 0
  const grr = selData?.grr != null ? selData.grr * 100 : 0
  const renewalExp = selData?.renewalExposure != null ? selData.renewalExposure * 100 : null
  const netExpansion = selData?.netExpansion || 0
  const priorACV = selData?.priorACV || 0
  const nrrGrowth = nrr - 100

  // ── Time series, sorted chronologically ────────────────────────────────
  const allSorted = periods

  // ── Chart window: last N periods up to selPeriod (or all) ─────────────
  const selIdx = selPeriod ? allSorted.indexOf(selPeriod) : allSorted.length - 1
  const anchor = selIdx >= 0 ? selIdx : allSorted.length - 1
  const windows = [{label:'3M',n:3},{label:'6M',n:6},{label:'12M',n:12},{label:'24M',n:24}]
  const windowStart = Math.max(0, anchor - chartWindow + 1)
  const chartData = allSorted.slice(windowStart, anchor + 1).map(p => {
    const m = byPeriod[p]
    if (!m) return null
    return {
      period: p,
      nrr:    m.nrr != null ? parseFloat((m.nrr*100).toFixed(1)) : null,
      grr:    m.grr != null ? parseFloat((m.grr*100).toFixed(1)) : null,
      churnPct: m.priorACV > 0 ? parseFloat((Math.abs(m.churn + m.churnPartial)/m.priorACV*100).toFixed(1)) : null,
      expansionPct: m.priorACV > 0 ? parseFloat((m.expansion/m.priorACV*100).toFixed(1)) : null,
    }
  }).filter(Boolean)

  // ── Monthly Growth Audit: all periods up to selPeriod, most recent first ──
  const auditRows = allSorted.slice(0, anchor + 1).reverse().map(p => ({ period: p, ...byPeriod[p] }))

  // ── Seasonality: best and worst month by expansion% ────────────────────
  const byMonth = {}
  allSorted.forEach(p => {
    const mon = p.split('-')[1]
    const m = byPeriod[p]
    if (!mon || !m || !m.priorACV) return
    if (!byMonth[mon]) byMonth[mon] = []
    byMonth[mon].push(m.expansion / m.priorACV * 100)
  })
  const MONTH_NAMES = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const monthAvg = Object.entries(byMonth).map(([mon,vals]) => ({
    mon: MONTH_NAMES[parseInt(mon,10)] || mon,
    avg: vals.reduce((s,v) => s+v, 0) / vals.length,
  }))
  monthAvg.sort((a,b) => b.avg - a.avg)
  const bestMon = monthAvg[0]
  const worstMon = monthAvg[monthAvg.length - 1]

  const fmtPctSigned = v => v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(1) + '%'

  if (!periods.length) return (
    <div style={{ padding: 40, textAlign: 'center', color: T.textMuted, fontSize: 12 }}>
      No data in selected range
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: T.textPrimary, letterSpacing: '-0.02em' }}>Historical Revenue Performance</div>
        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>Longitudinal view of net retention and growth indicators · {selPeriod || '—'}</div>
      </div>

      {/* ── KPI Strip ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'NRR', value: nrr.toFixed(1)+'%', sub: fmtPctSigned(nrrGrowth)+' vs 100%', subGood: nrrGrowth >= 0, accent: nrr >= 100 ? T.growth : T.decline },
          { label: 'GRR', value: grr.toFixed(1)+'%', sub: grr >= 80 ? 'Stable' : 'At Risk', subGood: grr >= 80, accent: grr >= 80 ? T.growth : T.decline },
          { label: 'Net Expansion', value: fmt(netExpansion), sub: priorACV > 0 ? fmtPctSigned(netExpansion/priorACV*100) : null, subGood: netExpansion >= 0, accent: T.brandPrimary },
          { label: 'Renewal Exposure', value: renewalExp != null ? renewalExp.toFixed(1)+'%' : '—', sub: 'Expiry Pool / Ending ACV', subGood: renewalExp != null && renewalExp < 50, accent: T.brandPrimary },
        ].map(k => (
          <div key={k.label} style={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderTop: `2px solid ${k.accent}`, borderRadius: 6, padding: '14px 16px' }}>
            <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.textMuted, marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontFamily: T.mono, fontSize: 22, fontWeight: 700, color: k.accent, letterSpacing: '-0.02em' }}>{k.value}</div>
            {k.sub && <div style={{ marginTop: 4, fontSize: 10, color: k.subGood ? T.growth : T.decline }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Main content: Chart + Seasonality ────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>

        {/* Retention Dynamics chart */}
        <div style={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>Retention Dynamics</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>NRR, GRR, Churn %, Expansion % over time</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {windows.map(w => (
                <button key={w.label} onClick={() => setChartWindow(w.n)} style={{
                  padding: '3px 10px', fontSize: 10, fontWeight: chartWindow === w.n ? 700 : 400, borderRadius: 4,
                  border: `1px solid ${chartWindow === w.n ? T.brandPrimary : T.borderDefault}`,
                  background: chartWindow === w.n ? T.bgRaised : 'transparent',
                  color: chartWindow === w.n ? T.brandPrimary : T.textMuted, cursor: 'pointer',
                }}>{w.label}</button>
              ))}
            </div>
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ left: 0, right: 8, bottom: 4, top: 4 }}>
                <XAxis dataKey="period" tick={{ fontSize: 9, fill: T.textTertiary }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 9, fill: T.textTertiary }} width={42} axisLine={false} tickLine={false} domain={['dataMin - 5','dataMax + 5']} />
                <ReferenceLine y={100} stroke={T.borderStrong} strokeDasharray="4 3" />
                <Tooltip
                  contentStyle={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 4, fontSize: 11 }}
                  labelStyle={{ color: T.textTertiary, fontSize: 10, marginBottom: 4 }}
                  formatter={(v,n) => [v != null ? `${v.toFixed(1)}%` : '—', n]} />
                <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 10, color: T.textSecondary, paddingTop: 8 }} />
                <Line type="monotone" dataKey="nrr" stroke={T.growth} strokeWidth={2} dot={false} activeDot={{ r: 3 }} name="NRR" connectNulls />
                <Line type="monotone" dataKey="grr" stroke={T.textSecondary} strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} name="GRR" connectNulls strokeDasharray="4 2" />
                <Line type="monotone" dataKey="churnPct" stroke={T.decline} strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} name="Churn %" connectNulls />
                <Line type="monotone" dataKey="expansionPct" stroke={T.chartExpansion} strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} name="Expansion %" connectNulls strokeDasharray="2 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Seasonality + Predictive Insight panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Predictive Insight — deterministic, built from real trend numbers, NOT an LLM call */}
          <div style={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 6, padding: '14px 16px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Sparkles size={11} color={T.textTertiary} />
              <span style={{ fontSize: 11, fontWeight: 600, color: T.brandPrimary }}>Predictive Insight</span>
            </div>
            {chartData.length >= 3 ? (() => {
              const recent = chartData.slice(-3).map(d => d.nrr || 0)
              const trend  = recent[2] - recent[0]
              const dir    = trend > 0 ? 'improved' : 'declined'
              const proj   = (recent[2] || 0) + trend * 2
              return (
                <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.7 }}>
                  NRR has {dir} <strong style={{ color: trend > 0 ? T.growth : T.decline }}>{Math.abs(trend).toFixed(1)} pts</strong> over {chartData.length} periods.
                  {trend > 0 && proj > 100 && <> At this rate, projected NRR: <strong style={{ color: T.growth }}>{proj.toFixed(0)}%</strong>.</>}
                  {trend <= 0 && <> Focus on expansion to reverse contraction trend.</>}
                </div>
              )
            })() : <div style={{ fontSize: 12, color: T.textMuted }}>Need more periods for trend analysis.</div>}
          </div>

          {/* Seasonality */}
          <div style={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.brandPrimary, marginBottom: 12 }}>Seasonality Impact</div>
            {bestMon && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: T.textSecondary }}>{bestMon.mon} Expansion</span>
                  <span style={{ color: T.growth, fontWeight: 600 }}>+{bestMon.avg.toFixed(1)}%</span>
                </div>
                <div style={{ height: 4, background: T.borderDefault, borderRadius: 2 }}>
                  <div style={{ height: '100%', background: T.growth, borderRadius: 2, width: `${Math.min(bestMon.avg*4,100)}%` }} />
                </div>
              </div>
            )}
            {worstMon && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: T.textSecondary }}>{worstMon.mon} Risk</span>
                  <span style={{ color: T.decline, fontWeight: 600 }}>{worstMon.avg.toFixed(1)}%</span>
                </div>
                <div style={{ height: 4, background: T.borderDefault, borderRadius: 2 }}>
                  <div style={{ height: '100%', background: T.decline, borderRadius: 2, width: `${Math.min(Math.abs(worstMon.avg)*4,100)}%` }} />
                </div>
                <div style={{ fontSize: 10, color: T.chartBaseline, marginTop: 6, lineHeight: 1.5 }}>
                  {worstMon.mon} historically shows lowest expansion. Plan renewal campaigns accordingly.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Monthly Growth Audit ────────────────────────────────────────── */}
      <div style={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${T.borderDefault}` }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>Monthly Growth Audit</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Expansion = New Logo + Cross-sell + Upsell + Add-on + Returning · Contraction = Churn + Churn Partial + Downsell + Lapsed · All figures from bridge classification</div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.bgRaised, borderBottom: `1px solid ${T.borderDefault}` }}>
                {['Fiscal Month','Net Retention','Gross Retention','Expansion ACV','Contraction ACV','Momentum'].map((h,i) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: i === 0 ? 'left' : 'right', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textMuted, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditRows.slice(0, 24).map((row, i) => {
                const isSel = row.period === selPeriod
                const nrrPct = row.nrr != null ? row.nrr * 100 : null
                const grrPct = row.grr != null ? row.grr * 100 : null
                const momScore = nrrPct != null ? (nrrPct >= 110 ? 3 : nrrPct >= 100 ? 2 : 1) : 0
                const momColor = momScore === 3 ? T.growth : momScore === 2 ? T.brandPrimary : T.decline
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.borderDefault}`, background: isSel ? T.bgRaised : 'transparent' }}>
                    <td style={{ padding: '11px 16px', fontWeight: isSel ? 700 : 500, color: isSel ? T.textPrimary : T.textSecondary, fontFamily: T.mono }}>{row.period}</td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: T.mono, fontWeight: 700, color: nrrPct >= 100 ? T.growth : nrrPct >= 80 ? T.warning : T.decline }}>{nrrPct != null ? nrrPct.toFixed(1)+'%' : '—'}</td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: T.mono, fontWeight: 600, color: grrPct >= 80 ? T.growth : T.decline }}>{grrPct != null ? grrPct.toFixed(1)+'%' : '—'}</td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: T.mono, fontWeight: 600, color: T.growth }}>{row.expansion > 0 ? '+'+fmt(row.expansion) : '—'}</td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: T.mono, fontWeight: 600, color: T.decline }}>{row.contraction < 0 ? fmt(row.contraction) : '—'}</td>
                    <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                      <span style={{ display: 'inline-flex', gap: 2 }}>
                        {[1,2,3].map(n => <span key={n} style={{ width: 5, height: 14, borderRadius: 1, background: n <= momScore ? momColor : T.borderDefault, display: 'inline-block' }} />)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}



// ─── Cohort Analysis ─────────────────────────────────────────────────────────
function CohortAnalysis({ bridgeTable, T }) {
  const [cohortGrain, setCohortGrain] = useState('yearly')    // 'yearly'|'quarterly'
  const [cohortMetric, setCohortMetric] = useState('acv')     // 'acv'|'count'|'acvPerCust'
  const [showRetention, setShowRetention] = useState(false)
  const [filterProduct,  setFilterProduct]  = useState('')
  const [filterChannel,  setFilterChannel]  = useState('')
  const [filterRegion,   setFilterRegion]   = useState('')

  // Dimension options
  const products = useMemo(() => ['', ...new Set(bridgeTable.map(r => r.product).filter(Boolean))].sort(), [bridgeTable])
  const channels = useMemo(() => ['', ...new Set(bridgeTable.map(r => r.channel).filter(Boolean))].sort(), [bridgeTable])
  const regions  = useMemo(() => ['', ...new Set(bridgeTable.map(r => r.region).filter(Boolean))].sort(), [bridgeTable])

  // Exclude period-level total rows (customer === '') before cohort grouping.
  // Those rows also carry Bridge Classification === 'Ending ACV' (what
  // buildCohortGrid filters on) but their `vintage` is set equal to their own
  // `date`, so without this filter every period total would show up as its
  // own fake single-month cohort, corrupting the grid.
  const customerBridgeOnly = useMemo(() => bridgeTable.filter(r => r.customer), [bridgeTable])

  const rows = useMemo(() => buildCohortGrid(customerBridgeOnly, cohortGrain, {
    product: filterProduct || undefined,
    channel: filterChannel || undefined,
    region:  filterRegion  || undefined,
  }), [customerBridgeOnly, cohortGrain, filterProduct, filterChannel, filterRegion])

  // All column offsets (months since vintage), sorted
  const offsets = useMemo(() => {
    const s = new Set()
    rows.forEach(r => Object.keys(r.values).forEach(k => s.add(Number(k))))
    return [...s].sort((a,b) => a - b)
  }, [rows])

  if (!rows.length) return (
    <div style={{ padding: 40, textAlign: 'center', color: T.textMuted, fontSize: 12 }}>
      No cohort data available
    </div>
  )

  const getCellVal = (row, offset) => {
    switch (cohortMetric) {
      case 'acv':        return row.values[offset]  || 0
      case 'count':      return row.custCnt[offset] || 0
      case 'acvPerCust': {
        const a = row.values[offset]  || 0
        const custCount = row.custCnt[offset] || 0
        return custCount > 0 ? a / custCount : 0
      }
    }
  }

  // Retention = value at offset / value at offset=0
  const getCellRetention = (row, offset) => {
    const base = getCellVal(row, 0)
    if (!base) return null
    return getCellVal(row, offset) / base
  }

  // Color scale for retention heatmap
  const heatColor = (pct) => {
    if (pct === null || pct === undefined) return 'transparent'
    if (pct >= 1.0)  return 'rgba(16,185,129,0.18)'   // growth green
    if (pct >= 0.85) return 'rgba(16,185,129,0.09)'
    if (pct >= 0.70) return 'rgba(245,158,11,0.15)'   // warning amber
    if (pct >= 0.50) return 'rgba(245,158,11,0.28)'
    return 'rgba(239,68,68,0.18)'                      // decline red
  }

  const fmtCell = (row, offset) => {
    if (showRetention) {
      const r = getCellRetention(row, offset)
      return r !== null ? `${(r * 100).toFixed(1)}%` : '—'
    }
    const v = getCellVal(row, offset)
    if (cohortMetric === 'acv')        return v ? fmt(v) : '—'
    if (cohortMetric === 'count')      return v ? v.toFixed(0) : '—'
    if (cohortMetric === 'acvPerCust') return v ? `$${(v/1000).toFixed(1)}K` : '—'
    return '—'
  }

  const thS = { padding: '6px 10px', fontSize: 10, fontWeight: 700, color: T.textMuted,
    textAlign: 'right', background: T.bgRaised, borderBottom: `2px solid ${T.borderDefault}`,
    whiteSpace: 'nowrap', fontFamily: T.mono, letterSpacing: '0.04em' }
  const tdS = (bg='transparent') => ({
    padding: '5px 10px', fontSize: 11, textAlign: 'right',
    borderBottom: `1px solid ${T.borderSubtle}`, fontFamily: T.mono,
    background: bg, color: T.textPrimary, whiteSpace: 'nowrap', letterSpacing: '-0.01em',
  })

  return (
    <div>
      {/* Controls row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Grain */}
        <div style={{ display: 'flex', gap: 3, background: T.bgRaised, padding: 3, borderRadius: 8, border: `1px solid ${T.borderSubtle}` }}>
          {[['yearly','Yearly'],['quarterly','Quarterly']].map(([v,l]) => (
            <button key={v} onClick={() => setCohortGrain(v)} style={{
              padding: '4px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11,
              background: cohortGrain === v ? T.brandPrimary : 'transparent',
              color: cohortGrain === v ? '#fff' : T.textMuted,
              fontWeight: cohortGrain === v ? 700 : 400, transition: 'all 0.15s',
            }}>{l}</button>
          ))}
        </div>
        {/* Metric */}
        <div style={{ display: 'flex', gap: 3, background: T.bgRaised, padding: 3, borderRadius: 8, border: `1px solid ${T.borderSubtle}` }}>
          {[['acv','ACV $'],['count','Customers'],['acvPerCust','ACV / Cust']].map(([v,l]) => (
            <button key={v} onClick={() => setCohortMetric(v)} style={{
              padding: '4px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11,
              background: cohortMetric === v ? T.brandPrimary : 'transparent',
              color: cohortMetric === v ? '#fff' : T.textMuted,
              fontWeight: cohortMetric === v ? 700 : 400, transition: 'all 0.15s',
            }}>{l}</button>
          ))}
        </div>
        {/* Retention toggle */}
        <button onClick={() => setShowRetention(r => !r)} style={{
          padding: '4px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 11, transition: 'all 0.15s',
          border: `1px solid ${showRetention ? T.brandPrimary : T.borderDefault}`,
          background: showRetention ? T.brandSoft : 'transparent',
          color: showRetention ? T.brandPrimary : T.textSecondary,
          fontWeight: showRetention ? 700 : 400,
        }}>% Retention</button>

        <div style={{ width: 1, height: 20, background: T.borderDefault }} />

        {/* Filters */}
        {products.length > 2 && (
          <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)} style={{
            padding: '4px 10px', borderRadius: 7, border: `1px solid ${T.borderDefault}`,
            background: T.bgSurface, color: T.textPrimary, fontSize: 11,
            fontFamily: T.mono, cursor: 'pointer', outline: 'none',
          }}>
            <option value=''>All Products</option>
            {products.filter(Boolean).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        {channels.length > 2 && (
          <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)} style={{
            padding: '4px 10px', borderRadius: 7, border: `1px solid ${T.borderDefault}`,
            background: T.bgSurface, color: T.textPrimary, fontSize: 11,
            fontFamily: T.mono, cursor: 'pointer', outline: 'none',
          }}>
            <option value=''>All Channels</option>
            {channels.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {regions.length > 2 && (
          <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} style={{
            padding: '4px 10px', borderRadius: 7, border: `1px solid ${T.borderDefault}`,
            background: T.bgSurface, color: T.textPrimary, fontSize: 11,
            fontFamily: T.mono, cursor: 'pointer', outline: 'none',
          }}>
            <option value=''>All Regions</option>
            {regions.filter(Boolean).map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
      </div>

      {/* Cohort Grid */}
      <div style={{ overflowX: 'auto', borderRadius: 10, border: `1px solid ${T.borderDefault}`, boxShadow: `0 1px 4px rgba(0,0,0,0.04)` }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...thS, textAlign: 'left', minWidth: 80 }}>
                {cohortGrain === 'yearly' ? 'Vintage Year' : 'Vintage Quarter'}
              </th>
              {offsets.map(o => (
                <th key={o} style={thS}>
                  {o === 0 ? 'Start' : `+${o}M`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={row.label}>
                <td style={{
                  padding: '5px 14px', fontSize: 11, fontWeight: 700,
                  color: T.textPrimary, borderBottom: `1px solid ${T.borderSubtle}`,
                  borderLeft: `3px solid ${T.brandPrimary}`,
                  background: ri % 2 === 0 ? 'transparent' : T.bgRaised,
                }}>
                  {row.label}
                </td>
                {offsets.map(o => {
                  const hasVal = (row.values[o] || row.custCnt[o])
                  const bg = showRetention ? heatColor(getCellRetention(row, o)) : (ri % 2 === 0 ? 'transparent' : T.bgRaised)
                  return (
                    <td key={o} style={tdS(bg)}>
                      {hasVal ? fmtCell(row, o) : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
            {/* Grand Total row */}
            <tr style={{ background: T.brandSoft }}>
              <td style={{
                padding: '5px 14px', fontSize: 11, fontWeight: 700,
                color: T.brandPrimary, borderTop: `2px solid ${T.borderDefault}`,
                borderLeft: `3px solid ${T.brandPrimary}`,
              }}>
                Grand Total
              </td>
              {offsets.map(o => {
                const total = rows.reduce((s, r) => s + (getCellVal(r, o) || 0), 0)
                return (
                  <td key={o} style={{ ...tdS(), borderTop: `2px solid ${T.borderDefault}`, fontWeight: 700 }}>
                    {total > 0 ? (cohortMetric === 'count' ? total.toFixed(0) : fmt(total)) : '—'}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Retention legend */}
      {showRetention && (
        <div style={{ display: 'flex', gap: 12, marginTop: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: T.textMuted }}>Retention:</span>
          {[['≥100%','rgba(16,185,129,0.18)'],['85–100%','rgba(16,185,129,0.09)'],['70–85%','rgba(245,158,11,0.15)'],['50–70%','rgba(245,158,11,0.28)'],['<50%','rgba(239,68,68,0.18)']].map(([l,c]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: c }} />
              <span style={{ fontSize: 10, color: T.textMuted }}>{l}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Account 360 (ACV) ────────────────────────────────────────────────────────
function Account360({ bridgeTable, bookingsTable, T }) {
  const customers = useMemo(() =>
    [...new Set(bridgeTable.map(r => r.customer).filter(Boolean))].sort(), [bridgeTable])
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
  { id: 'summary',     label: 'Summary',         icon: Zap },
  { id: 'bridge',      label: 'ACV Bridge',      icon: TrendingUp },
  { id: 'expiry',      label: 'Expiry Pool',     icon: Clock },
  { id: 'renewal',     label: 'Renewal Rates',   icon: Shield },
  { id: 'bookings',    label: 'Bookings Walk',   icon: FileText },
  { id: 'movers',      label: 'Top Movers',      icon: Target },
  { id: 'historical',  label: 'Historical',      icon: Layers },
  { id: 'cohort',      label: 'Cohort Analysis', icon: Users },
  { id: 'account360',  label: 'Account 360',     icon: Users },
]

// ─── Main Component ───────────────────────────────────────────────────────────
// ─── Executive Sidebar (ACV) ──────────────────────────────────────────────────
// Pure UI/UX layout addition — no new calculations, no API changes. Every
// number displayed here is read from `kpis` (calcACVKPIs, already computed
// elsewhere in this file) or `riskOpportunitySummary` (already computed
// server-side). This section only adds presentation, not logic.

// Narrative text — EXTRACTED from the Summary tab's existing AI-narrative
// block (not new logic, not an LLM call — same deterministic template-string
// construction that already existed inline in the Summary tab). Moved here
// so it can live in the sidebar per the executive-layout brief, and kept as
// a standalone function so both the sidebar and (if ever needed) other
// tabs can call it without duplicating the string-building logic.
function buildContractNarrative(kpis) {
  if (!kpis) return ''
  const gr = kpis.grossRenewal, nr = kpis.netRenewal
  let s = `ACV moved from ${fmt(kpis.priorACV)} to ${fmt(kpis.endingACV)} (${kpis.netChange >= 0 ? '+' : ''}${fmt(kpis.netChange)}).`
  if (gr != null) s += ` Gross renewal rate of ${fmtPct(gr)} — ${gr >= 0.9 ? 'strong retention' : gr >= 0.8 ? 'moderate retention' : 'retention needs attention'}.`
  if (nr != null) s += ` Net renewal rate of ${fmtPct(nr)} — ${nr >= 1 ? 'expansion outpacing churn' : 'net contraction'}.`
  if (kpis.expiryPool > 0) s += ` Expiry pool of ${fmt(kpis.expiryPool)} due for renewal.`
  if (kpis.addOn > 0) s += ` ${fmt(kpis.addOn)} in Add-on ACV from mid-term expansions.`
  if (kpis.churn < 0) s += ` Churn of ${fmt(Math.abs(kpis.churn))} — ${Math.abs(kpis.churn) / kpis.expiryPool > 0.1 ? 'above 10% threshold, investigate' : 'controlled'}.`
  return s
}

// Portfolio Health Score — deterministic average of GRR + NRR, both of
// which already exist in `kpis`. Bands chosen to match language already
// used elsewhere in this file (KpiCard's "Healthy"/"Needs attention" for
// Gross Retention). No new calculation invented, just a simple average of
// two numbers already trusted and shown elsewhere on this page.
function computeHealthScore(kpis) {
  if (!kpis || kpis.grossRetention == null || kpis.netRetention == null) return null
  const score = ((kpis.grossRetention + kpis.netRetention) / 2) * 100
  let band, color
  if (score >= 100)      { band = 'Excellent';       }
  else if (score >= 85)  { band = 'Good';            }
  else                   { band = 'Needs Attention'; }
  return { score: Math.max(0, Math.min(140, score)), band }
}

function HealthScoreRing({ kpis, T }) {
  const h = computeHealthScore(kpis)
  if (!h) return null

  const size = 108, stroke = 9, r = (size - stroke) / 2, c = 2 * Math.PI * r
  // Normalize display: 100 = full ring, values above just show as full+badge
  const pct = Math.min(h.score / 100, 1)
  const dash = c * pct
  const color = h.band === 'Excellent' ? T.growth : h.band === 'Good' ? T.warning : T.decline

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.borderDefault} strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${c - dash}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: T.mono, fontSize: 22, fontWeight: 700, color: T.textPrimary, lineHeight: 1 }}>{h.score.toFixed(0)}</div>
          <div style={{ fontSize: 8, color: T.textMuted, marginTop: 2 }}>/ 100</div>
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color, padding: '3px 10px', borderRadius: 20, background: `${color}15` }}>
        {h.band}
      </div>
    </div>
  )
}

// Key Alerts — deterministic threshold rules on numbers already computed
// (kpis for GRR/NRR/Renewal Exposure, riskOpportunitySummary for full-
// population risk/expansion counts). No new backend logic — pure UI read
// of existing values against fixed thresholds.
function KeyAlerts({ kpis, riskSummaryRow, T }) {
  if (!kpis) return null

  const alerts = []
  if (riskSummaryRow && riskSummaryRow.riskCount > 0) {
    alerts.push({ label: 'High Churn Risk', detail: `${riskSummaryRow.riskCount} account(s) at elevated/critical risk`, color: T.decline, icon: AlertCircle })
  }
  if (kpis.grossRetention != null && kpis.grossRetention < 0.80) {
    alerts.push({ label: 'Low Retention', detail: `Gross retention at ${fmtPct(kpis.grossRetention)}`, color: T.decline, icon: TrendingDown })
  }
  const renewalExposure = kpis.endingACV > 0 ? kpis.expiryPool / kpis.endingACV : null
  if (renewalExposure != null && renewalExposure >= 0.30) {
    alerts.push({ label: 'Upcoming Renewals', detail: `${fmtPct(renewalExposure)} of Ending ACV due for renewal`, color: T.warning, icon: Clock })
  }
  if (riskSummaryRow && riskSummaryRow.expansionCount > 0) {
    alerts.push({ label: 'Pipeline Opportunity', detail: `${riskSummaryRow.expansionCount} account(s) showing expansion signal`, color: T.growth, icon: TrendingUp })
  }

  if (!alerts.length) return (
    <div style={{ fontSize: 11, color: T.textMuted, padding: '10px 0' }}>No active alerts for this period</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {alerts.map((a, i) => {
        const Icon = a.icon
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 8, background: `${a.color}0C`, border: `1px solid ${a.color}25` }}>
            <Icon size={12} color={a.color} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: a.color }}>{a.label}</div>
              <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 1 }}>{a.detail}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Executive KPI Summary — compact list rendering of the same 11 KPIs
// already shown as cards in the Summary tab. Same values, same
// calculations, different (denser) presentation for the sidebar.
const EXEC_KPI_ROWS = [
  { key: 'priorACV',   label: 'Prior ACV',        icon: DollarSign },
  { key: 'endingACV',  label: 'Ending ACV',       icon: DollarSign },
  { key: 'grossRetention', label: 'Gross Retention', icon: Shield, pct: true },
  { key: 'netRetention',   label: 'Net Retention',   icon: Shield, pct: true },
  { key: 'expiryPool', label: 'Renewal Pool',     icon: Clock },
  { key: 'newLogo',    label: 'New Logo',         icon: TrendingUp },
  { key: 'upsell',     label: 'Upsell',           icon: TrendingUp },
  { key: 'downsell',   label: 'Downsell',         icon: TrendingDown },
  { key: 'churn',      label: 'Churn',            icon: TrendingDown },
  { key: 'lapsed',     label: 'Lapsed',           icon: TrendingDown },
  { key: 'addOn',      label: 'Bookings (Add-on)', icon: DollarSign },
]

function ExecutiveKpiList({ kpis, T }) {
  if (!kpis) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {EXEC_KPI_ROWS.map(row => {
        const val = kpis[row.key]
        const Icon = row.icon
        const isNeg = ['downsell', 'churn', 'lapsed'].includes(row.key)
        const display = row.pct ? fmtPct(val) : fmt(val)
        const valColor = val == null ? T.textMuted
          : isNeg ? (val === 0 ? T.textSecondary : T.decline)
          : row.pct ? (val >= (row.key === 'netRetention' ? 1.0 : 0.85) ? T.growth : T.decline)
          : T.textPrimary
        return (
          <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 2px', borderBottom: `1px solid ${T.borderSubtle}` }}>
            <Icon size={12} color={T.textMuted} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 11, color: T.textSecondary }}>{row.label}</div>
            <div style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: valColor }}>{display}</div>
          </div>
        )
      })}
    </div>
  )
}

// Quick Navigation — since ACV Center is tab-based (not a single
// scrollable page), "scroll to section" is adapted to "switch tab",
// which is the natural equivalent in this UI. Same destinations as the
// brief's requested nav items, mapped onto existing tabs.
const QUICK_NAV_ITEMS = [
  { tab: 'bridge',     label: 'Bridge',       icon: TrendingUp },
  { tab: 'expiry',     label: 'Expiry Pool',  icon: Clock },
  { tab: 'movers',     label: 'Customers',    icon: Users },
  { tab: 'renewal',    label: 'Renewal Rates', icon: Shield },
  { tab: 'historical', label: 'Historical',   icon: Layers },
  { tab: 'cohort',     label: 'Cohorts',      icon: Users },
  { tab: 'account360', label: 'Account 360',  icon: Users },
]

function QuickNav({ activeTab, setTab, T }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {QUICK_NAV_ITEMS.map(item => {
        const Icon = item.icon
        const active = activeTab === item.tab
        return (
          <button key={item.tab} onClick={() => setTab(item.tab)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6,
            border: 'none', background: active ? T.brandSoft : 'transparent',
            color: active ? T.brandPrimary : T.textSecondary,
            fontSize: 11, fontWeight: active ? 700 : 500, cursor: 'pointer', textAlign: 'left',
          }}>
            <Icon size={12} />
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

function SidebarSection({ title, children, T }) {
  return (
    <div style={{ padding: '16px 18px', borderBottom: `1px solid ${T.borderDefault}` }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.textMuted, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}

function ExecutiveSidebar({ kpis, riskOpportunitySummary, selPeriod, activeTab, setTab, T }) {
  const riskSummaryRow = useMemo(() =>
    (riskOpportunitySummary || []).find(r => r.period === selPeriod) || null
  , [riskOpportunitySummary, selPeriod])

  const narrative = useMemo(() => buildContractNarrative(kpis), [kpis])

  if (!kpis) return null

  return (
    <aside style={{
      width: 340, flexShrink: 0, alignSelf: 'flex-start',
      position: 'sticky', top: 76, maxHeight: 'calc(100vh - 92px)', overflowY: 'auto',
      background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 12,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <SidebarSection title="Executive KPI Summary" T={T}>
        <ExecutiveKpiList kpis={kpis} T={T} />
      </SidebarSection>

      <SidebarSection title="RevenueLens AI — Executive Summary" T={T}>
        <div style={{ fontSize: 12, color: T.textPrimary, lineHeight: 1.65 }}>{narrative}</div>
      </SidebarSection>

      <SidebarSection title="Portfolio Health" T={T}>
        <HealthScoreRing kpis={kpis} T={T} />
      </SidebarSection>

      <SidebarSection title="Key Alerts" T={T}>
        <KeyAlerts kpis={kpis} riskSummaryRow={riskSummaryRow} T={T} />
      </SidebarSection>

      <div style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.textMuted, marginBottom: 12 }}>Quick Navigation</div>
        <QuickNav activeTab={activeTab} setTab={setTab} T={T} />
      </div>
    </aside>
  )
}

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
  const [rangeStart, setRangeStart] = useState('')  // 'YYYY-MM' or ''=auto
  const [rangeEnd,   setRangeEnd]   = useState('')  // 'YYYY-MM' or ''=all
  const [revenueUnit, setRevenueUnit] = useState('TCV')
  const [apiResults,  setApiResults]  = useState(null)
  const [qtyResolutionInfo, setQtyResolutionInfo] = useState<{ resolution: string | null, count: number }>({ resolution: null, count: 0 })
  const [hasStoredData, setHasStoredData] = useState(true)

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
    let ready = null
    try { const raw = sessionStorage.getItem('rl_acv_ready'); ready = raw ? JSON.parse(raw) : null } catch { ready = null }
    const cube  = dataCubeStore.load()

    if (!ready && !cube?.csvText) { setHasStoredData(false); return }  // nothing loaded — show empty state

    const mapping              = ready?.mapping      || cube?.meta?.mapping      || {}
    const revenueUnitFromStore = ready?.revenueUnit  || cube?.meta?.revenueUnit  || 'TCV'
    const analysisType         = ready?.analysisType || cube?.meta?.analysisType || ''
    const qtyResolutionLoaded  = ready?.qtyResolution  || null
    const zeroQtyCountLoaded   = ready?.zeroQtyCount   || 0
    setQtyResolutionInfo({ resolution: qtyResolutionLoaded, count: zeroQtyCountLoaded })
    setRevenueUnit(revenueUnitFromStore)

    if (analysisType && analysisType !== 'acv_tcv') {
      setError('This dataset was uploaded as MRR/ARR. Please re-upload with ACV / Contract Analysis selected.')
      return
    }

    if (cube?.csvText) {
      callFastAPI(cube, mapping, revenueUnitFromStore)
    } else if (ready?.mapped?.length) {
      // Pre-mapped rows available — reconstruct csvText and send to FastAPI
      // Browser engine removed: all computation runs server-side
      const csvLines = [
        ['customer','contractStart','contractEnd','tcv','product','channel','region','quantity'].join(','),
        ...ready.mapped.map(row => [
          row.customer, row.contractStart, row.contractEnd, row.tcv,
          row.product, row.channel, row.region, row.quantity
        ].map(v => JSON.stringify(String(v||''))).join(','))
      ]
      const syntheticCube = {
        csvText: csvLines.join('\n'),
        meta: { fileName: ready.fileName || 'data.csv', mapping: ready.mapping || {}, revenueUnit: revenueUnitFromStore }
      }
      const syntheticMapping = {
        customer: 'customer', contractStart: 'contractStart', contractEnd: 'contractEnd',
        tcv: 'tcv', product: 'product', channel: 'channel', region: 'region',
        // Only pass quantity if the original upload mapped a quantity column
        // This preserves the Alteryx scope rule: condition 3 only fires when qty is provided
        ...(ready?.mapping?.quantity ? { quantity: 'quantity' } : {})
      }
      callFastAPI(syntheticCube, syntheticMapping, revenueUnitFromStore)
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
      fd.append('lookbacks',      JSON.stringify([12]))  // lb=1,3 computed on demand to reduce memory
      fd.append('n_movers',       '30')
      if (mapping.product)  fd.append('product_col',  mapping.product)
      if (mapping.channel)  fd.append('channel_col',  mapping.channel)
      if (mapping.region)   fd.append('region_col',   mapping.region)
      if (mapping.quantity) fd.append('quantity_col', mapping.quantity)

      const { data } = await axios.post(`${API}/api/acv/analyze`, fd, { timeout: 120000 })
      setApiResults(data)

      // ── Convert pre-aggregated FastAPI response → ACVEngineOutput ─────────────
      // FastAPI now returns period_summary (aggregated) + customer_bridge
      // Period summary: {Date, Month Lookback, Bridge Classification, Bridge Value}
      // This avoids 783K raw rows (786MB) → returns 1,516 aggregated rows (0.1MB)
      if (data?.bridge?.length > 0) {
        // Build period-level bridge table from aggregated summary
        const periodBridge = data.bridge.map((apiRow: any) => ({
          customer:             '',
          product:              'N/A',
          channel:              'N/A',
          region:               'N/A',
          vintage:              new Date(apiRow.Date || apiRow.date),
          date:                 new Date(apiRow.Date || apiRow.date),
          acvNew:               0,
          quantity:             0,
          monthLookback:        parseInt(apiRow['Month Lookback'] || apiRow.month_lookback || 12),
          dteNew:               0,
          bridgeClassification: String(apiRow['Bridge Classification'] || apiRow.bridge_classification || ''),
          bridgeValue:          parseFloat(apiRow['Bridge Value'] || apiRow.bridge_value || 0),
        })).filter((r: any) => !isNaN(r.date.getTime()) && r.bridgeClassification)

        // Build customer-level bridge for Top Movers + Account 360
        const customerBridge = (data.customer_bridge || []).map((apiRow: any) => ({
          customer:             String(apiRow.Customer || apiRow.customer || ''),
          product:              String(apiRow.Product  || apiRow.product  || 'N/A'),
          channel:              String(apiRow.Channel  || apiRow.channel  || 'N/A'),
          region:               String(apiRow.Region   || apiRow.region   || 'N/A'),
          vintage:              new Date(apiRow.Vintage || apiRow.vintage || apiRow.Date),
          date:                 new Date(apiRow.Date || apiRow.date),
          acvNew:               0,
          quantity:             0,
          monthLookback:        12,
          dteNew:               0,
          bridgeClassification: String(apiRow['Bridge Classification'] || apiRow.bridge_classification || ''),
          bridgeValue:          parseFloat(apiRow['Bridge Value'] || apiRow.bridge_value || 0),
        })).filter((r: any) => r.customer && !isNaN(r.date.getTime()))

        // Combine: period bridge + customer bridge = full bridgeTable
        // Period bridge handles: Summary, Historical, Renewal, Expiry, Bookings
        // Customer bridge handles: Top Movers, Account 360, Cohort
        const bridgeTable = [...periodBridge, ...customerBridge]

        if (bridgeTable.length > 0) {
          // ── Build QC from API response ─────────────────────────────────────
          // FIX: the backend engine returns qc1/qc2/qc3/qc4 + qc1_detail/... —
          // NOT qc1Pass/qc1Detail/... which is what QCBanner (and this whole
          // file) expects. Because `data.qc` always exists, the previous
          // `data.qc || {...camelCase fallback}` never actually used the
          // correctly-named fallback object — it silently passed through the
          // mismatched raw shape, so qc.qc1Pass was always undefined (falsy),
          // making the QC banner show "WARNING" even when every check
          // genuinely passed on the backend. This explicit mapping fixes that.
          const rawQc = data.qc || {}
          const qc = {
            qc1Pass: rawQc.qc1 ?? true, qc1Detail: rawQc.qc1_detail || 'Computed by FastAPI',
            qc2Pass: rawQc.qc2 ?? true, qc2Detail: rawQc.qc2_detail || 'Computed by FastAPI',
            qc3Pass: rawQc.qc3 ?? true, qc3Detail: rawQc.qc3_detail || 'Computed by FastAPI',
            qc4Pass: rawQc.qc4 ?? true, qc4Detail: rawQc.qc4_detail || 'No unclassified rows',
          }
          // FIX: backend returns bookings rows with Title-Case keys
          // (Customer, Start, End, TCV, ACV, InScope) but BookingsWalk and
          // Account360 read camelCase (customer, contractStart, contractEnd,
          // tcv, acv, inScope). Previously passed straight through, so every
          // field read by those two tabs was undefined.
          const bookingsTable = (data.bookings || []).map((row: any) => ({
            customer:         String(row.Customer || row.customer || ''),
            product:          String(row.Product  || row.product  || 'N/A'),
            channel:          String(row.Channel  || row.channel  || 'N/A'),
            region:           String(row.Region   || row.region   || 'N/A'),
            contractStart:    new Date(row.Start || row.contractStart),
            contractEnd:      new Date(row.End   || row.contractEnd),
            tcv:              parseFloat(row.TCV || row.tcv || 0),
            acv:              parseFloat(row.ACV || row.acv || 0),
            quantity:         parseFloat(row.Quantity || row.quantity || 0),
            inScope:          Boolean(row.InScope ?? row.inScope),
            outOfScopeReason: row.OutOfScopeReason || row.outOfScopeReason || '',
          }))

          // Risk & Opportunity — deterministic composite scores, now
          // computed for EVERY period (not one auto-picked snapshot).
          // Backend returns TWO arrays:
          //   risk_opportunity_summary — FULL population counts/ACV per
          //     period, never capped — used for the header stats bar so
          //     those numbers stay honest even though the detail list below
          //     is capped to top-N per period.
          //   risk_opportunity_detail  — top-N customers per period per
          //     side (capped, same principle as customer_bridge's own cap),
          //     with full traceable RiskReasons/ExpansionReasons.
          // Both are keyed by `period` ('YYYY-MM') matching the same
          // convention bridgeTable/customer_bridge already use, so the
          // existing Period selector filters this the same way as every
          // other tab.
          const periodKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`

          const riskOpportunitySummary = (data.risk_opportunity_summary || []).map((row: any) => {
            const d = new Date(row.Date || row.date)
            return {
              period:          periodKey(d),
              riskCount:       parseInt(row.RiskCount ?? row.risk_count ?? 0),
              riskACV:         parseFloat(row.RiskACV ?? row.risk_acv ?? 0),
              expansionCount:  parseInt(row.ExpansionCount ?? row.expansion_count ?? 0),
              expansionACV:    parseFloat(row.ExpansionACV ?? row.expansion_acv ?? 0),
            }
          }).filter((r: any) => !isNaN(new Date(r.period + '-01').getTime()) && r.period !== 'NaN-NaN')

          const riskOpportunityDetail = (data.risk_opportunity_detail || []).map((row: any) => {
            const d = new Date(row.Date || row.date)
            return {
              customer:          String(row.Customer || row.customer || ''),
              period:            periodKey(d),
              priorACV:          parseFloat(row.PriorACV || row.prior_acv || 0),
              endingACV:         parseFloat(row.EndingACV || row.ending_acv || 0),
              riskScore:         parseFloat(row.RiskScore || row.risk_score || 0),
              riskLabel:         String(row.RiskLabel || row.risk_label || 'Low'),
              riskReasons:       Array.isArray(row.RiskReasons || row.risk_reasons) ? (row.RiskReasons || row.risk_reasons) : [],
              expansionScore:    parseFloat(row.ExpansionScore || row.expansion_score || 0),
              expansionLabel:    String(row.ExpansionLabel || row.expansion_label || 'Low'),
              expansionReasons:  Array.isArray(row.ExpansionReasons || row.expansion_reasons) ? (row.ExpansionReasons || row.expansion_reasons) : [],
            }
          }).filter((r: any) => r.customer)

          const apiOutput = {
            bridgeTable,
            acvTable:      data.acv_table || [],
            bookingsTable,
            riskOpportunitySummary,
            riskOpportunityDetail,
            qc,
            mode:          unit,
            periodsCount:  new Set(bridgeTable.filter(pcRow => pcRow.monthLookback === 12 && pcRow.bridgeClassification === 'Prior ACV').map(pcRow => `${pcRow.date.getFullYear()}-${pcRow.date.getMonth()}`)).size,
          }
          setEngineOutput(apiOutput)
          const allPeriods = [...new Set(
            bridgeTable
              .filter(btRow => btRow.monthLookback === 12)
              .map(btRow => `${btRow.date.getFullYear()}-${String(btRow.date.getMonth()+1).padStart(2,'0')}`)
          )].sort()
          if (allPeriods.length) setSelPeriod(allPeriods[allPeriods.length - 1])
          setRunning(false)
          return  // ← FastAPI succeeded + engineOutput set → skip browser fallback
        }
      }

      setRunning(false)
      setError('Analysis server returned no data. Please try again.')
    } catch(apiErr: any) {
      console.warn('FastAPI ACV failed:', apiErr?.message)
      setRunning(false)
      // Show countdown — server is warming up on Render free tier
      // runBrowserEngine handles the 45s countdown then auto-retries ONCE
      runBrowserEngine(cube?.csvText || '', mapping, unit)
    }
  }

  // ── FastAPI Retry with countdown UX ────────────────────────────────────────
  // The browser engine was removed permanently. Reason:
  // acvEngine.ts (968 lines) cannot be safely compiled by Next.js bundler —
  // SWC minifies variables to single letters causing TDZ crashes,
  // and Babel (.babelrc) is not reliably applied in all deploy scenarios.
  //
  // Architecture decision: ALL computation runs on FastAPI.
  // Render keep-alive cron prevents cold starts.
  // When cold start occurs: show countdown, auto-retry until server responds.

  function runBrowserEngine(_csv: string, _mapping: any, _unit: string) {
    // Renamed to show user a countdown retry instead of error
    let secondsLeft = 45
    setError(`⏳ Analysis server warming up — retrying in ${secondsLeft}s`)
    const tick = setInterval(() => {
      secondsLeft -= 1
      if (secondsLeft <= 0) {
        clearInterval(tick)
        setError('')
        // Re-trigger the main load effect by re-reading from sessionStorage
        const readyRaw = sessionStorage.getItem('rl_acv_ready')
        if (_csv) {
          // Retry once — server should be warm after 45s
          // Use promise chain (not await) since setInterval callback is not async
          setRunning(true)
          setError('Retrying analysis...')
          import('axios').then(mod => {
            const axiosRetry = mod.default
            const fd = new FormData()
            fd.append('file', new Blob([_csv], { type: 'text/csv' }), 'data.csv')
            fd.append('customer_col',   _mapping.customer      || '')
            fd.append('start_col',      _mapping.contractStart || '')
            fd.append('end_col',        _mapping.contractEnd   || '')
            fd.append('tcv_col',        _mapping.tcv           || '')
            fd.append('revenue_unit',   _unit)
            fd.append('lookbacks',      JSON.stringify([12]))
            if (_mapping.product)  fd.append('product_col',  _mapping.product)
            if (_mapping.channel)  fd.append('channel_col',  _mapping.channel)
            if (_mapping.region)   fd.append('region_col',   _mapping.region)
            if (_mapping.quantity) fd.append('quantity_col', _mapping.quantity)
            axiosRetry.post(`${API}/api/acv/analyze`, fd, { timeout: 120000 })
              .then(resp => {
                if (resp.data?.bridge?.length > 0) {
                  window.location.reload()
                } else {
                  setError('Analysis server returned no data. Please re-upload your file.')
                  setRunning(false)
                }
              })
              .catch(() => {
                setError('Analysis server unavailable. Upgrade Render to Starter ($7/mo) for always-on service, or try again later.')
                setRunning(false)
              })
          }).catch(() => {
            setError('Failed to load retry module. Please refresh the page.')
            setRunning(false)
          })
        } else {
          setError('Session expired. Please re-upload your file.')
          setRunning(false)
        }
      } else {
        setError(`⏳ Analysis server warming up — retrying in ${secondsLeft}s`)
      }
    }, 1000)
  }


  // KPIs for selected period
  const kpis = useMemo(() => {
    if (!engineOutput?.bridgeTable?.length) return null
    return calcACVKPIs(engineOutput.bridgeTable, lb, selPeriod)
  }, [engineOutput, lb, selPeriod])

  // All available periods (full)
  const periods = useMemo(() => {
    if (!engineOutput?.bridgeTable?.length) return []
    return [...new Set(
      engineOutput.bridgeTable
        .filter(r => r.monthLookback === lb)
        .map(r => `${r.date.getFullYear()}-${String(r.date.getMonth()+1).padStart(2,'0')}`)
    )].sort()
  }, [engineOutput, lb])

  // Auto-detect material start: first period where Ending ACV > 1% of peak
  const materialStart = useMemo(() => {
    if (!engineOutput?.bridgeTable?.length) return ''
    const lb12 = engineOutput.bridgeTable.filter(r => r.monthLookback === 12 && r.bridgeClassification === 'Ending ACV')
    if (!lb12.length) return ''
    const peak = lb12.reduce((m, r) => r.bridgeValue > m ? r.bridgeValue : m, 0)
    const threshold = peak * 0.01
    const sorted = lb12.slice().sort((matA, matB) => matA.date - matB.date)
    const first = sorted.find(matRow => matRow.bridgeValue >= threshold)
    if (!first) return ''
    return `${first.date.getFullYear()}-${String(first.date.getMonth()+1).padStart(2,'0')}`
  }, [engineOutput])

  // Effective range (auto or user-set)
  const effectiveStart = rangeStart || materialStart
  const effectiveEnd   = rangeEnd   || (periods.length ? periods[periods.length - 1] : '')

  // Periods filtered to selected range
  const rangePeriods = useMemo(() =>
    periods.filter(p => (!effectiveStart || p >= effectiveStart) && (!effectiveEnd || p <= effectiveEnd))
  , [periods, effectiveStart, effectiveEnd])

  // Clamp selPeriod within rangePeriods when range changes
  useEffect(() => {
    if (!rangePeriods.length) return
    if (!selPeriod || !rangePeriods.includes(selPeriod)) {
      setSelPeriod(rangePeriods[rangePeriods.length - 1])
    }
  }, [rangePeriods])

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

          {/* ── Date Range Control ─────────────────────────────── */}
          {periods.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Range start */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: T.textMuted, fontFamily: T.mono }}>From</span>
                <select value={rangeStart} onChange={e => setRangeStart(e.target.value)} style={{
                  padding: '3px 8px', borderRadius: 6, border: `1px solid ${T.borderDefault}`,
                  background: T.bgSurface, color: T.textPrimary, fontSize: 10,
                  fontFamily: T.mono, cursor: 'pointer', outline: 'none',
                }}>
                  <option value=''>Auto</option>
                  {periods.map(p => <option key={p} value={p}>{fmtPeriod(p)}</option>)}
                </select>
              </div>
              <span style={{ fontSize: 10, color: T.textMuted }}>→</span>
              {/* Range end */}
              <select value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} style={{
                padding: '3px 8px', borderRadius: 6, border: `1px solid ${T.borderDefault}`,
                background: T.bgSurface, color: T.textPrimary, fontSize: 10,
                fontFamily: T.mono, cursor: 'pointer', outline: 'none',
              }}>
                <option value=''>Latest</option>
                {periods.map(p => <option key={p} value={p}>{fmtPeriod(p)}</option>)}
              </select>
              {/* Auto badge when using auto-detect */}
              {!rangeStart && materialStart && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                  background: T.brandSoft, color: T.brandPrimary, letterSpacing: '0.05em',
                }}>AUTO</span>
              )}
              {/* Reset range */}
              {(rangeStart || rangeEnd) && (
                <button onClick={() => { setRangeStart(''); setRangeEnd('') }} style={{
                  fontSize: 9, padding: '2px 6px', borderRadius: 4, border: `1px solid ${T.borderDefault}`,
                  background: 'transparent', color: T.textMuted, cursor: 'pointer',
                }}>✕</button>
              )}
              {/* Separator */}
              <div style={{ width: 1, height: 16, background: T.borderDefault }} />
              {/* Period selector — constrained to range */}
              <select value={selPeriod} onChange={e => setSelPeriod(e.target.value)} style={{
                padding: '3px 10px', borderRadius: 6, border: `1px solid ${T.brandBorder}`,
                background: T.brandSoft, color: T.brandPrimary, fontSize: 11,
                fontFamily: T.mono, cursor: 'pointer', outline: 'none', fontWeight: 700,
              }}>
                {rangePeriods.map(p => <option key={p} value={p}>{fmtPeriod(p)}</option>)}
              </select>
            </div>
          )}

          {/* Back to dashboard */}
          <button onClick={() => router.push('/dashboard')} style={{
            padding: '5px 12px', borderRadius: 7, border: `1px solid ${T.borderDefault}`,
            background: 'transparent', color: T.textSecondary, fontSize: 11, cursor: 'pointer',
          }}>← Dashboard</button>
        </div>
      </div>

      {/* ── Main layout — two-column executive layout: sticky sidebar +
           existing content, unchanged. Sidebar only renders once real
           data/KPIs exist. ─────────────────────────────────────────── */}
      <div style={{ maxWidth: 1660, margin: '0 auto', padding: '24px 24px', display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {engineOutput && kpis && (
          <ExecutiveSidebar
            kpis={kpis}
            riskOpportunitySummary={engineOutput.riskOpportunitySummary}
            selPeriod={selPeriod}
            activeTab={tab}
            setTab={setTab}
            T={T}
          />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>

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
              <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 8 }}>{error}</div>
              <button onClick={() => window.location.reload()} style={{
                padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: T.brandPrimary, color: '#fff', fontSize: 11, fontWeight: 600
              }}>Try Again</button>
            </div>
          </div>
        )}

        {/* ── Results ──────────────────────────────────────────────────────── */}
        {engineOutput && !running && (
          <>
            {/* QC Banner */}
            <QCBanner qc={engineOutput.qc} T={T} />

            {/* ── Quantity Resolution Banners ──────────────────────── */}
            {qtyResolutionInfo.resolution === 'assume_one' && qtyResolutionInfo.count > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginTop: 8,
                padding: '10px 16px', borderRadius: 8,
                background: '#FFFBEB', border: '1px solid #FDE68A',
              }}>
                <span style={{ fontSize: 14 }}>⚠️</span>
                <span style={{ fontSize: 12, color: '#92400E' }}>
                  <strong>{qtyResolutionInfo.count.toLocaleString()} contracts</strong> had
                  no quantity value — quantity assumed = 1 for Price × Volume analysis.
                  ACV bridge is unaffected.
                </span>
              </div>
            )}
            {qtyResolutionInfo.resolution === 'exclude' && qtyResolutionInfo.count > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginTop: 8,
                padding: '10px 16px', borderRadius: 8,
                background: `${T.growth}12`, border: `1px solid ${T.growth}33`,
              }}>
                <span style={{ fontSize: 14 }}>✅</span>
                <span style={{ fontSize: 12, color: T.growth }}>
                  <strong>{qtyResolutionInfo.count.toLocaleString()} contracts</strong> excluded
                  — zero quantity, matching Alteryx scope filter exactly.
                </span>
              </div>
            )}

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
                  <KpiCard label="Gross Retention" value={fmtPct(kpis.grossRetention)} subGood={kpis.grossRetention != null && kpis.grossRetention >= 0.85} sub={kpis.grossRetention != null ? (kpis.grossRetention >= 0.85 ? 'Healthy' : 'Needs attention') : null} T={T} />
                  <KpiCard label="Net Retention"   value={fmtPct(kpis.netRetention)}   subGood={kpis.netRetention   != null && kpis.netRetention   >= 1.00} sub={kpis.netRetention   != null ? (kpis.netRetention   >= 1.00 ? 'Expanding' : 'Contracting') : null} T={T} />
                  <KpiCard label="Expiry Pool"    value={fmt(kpis.expiryPool)} sub="Due to renew" T={T} />
                  <KpiCard label="New Bookings"   value={fmt(kpis.newLogo + kpis.crossSell)} sub="New Logo + Cross-sell" subGood={kpis.newLogo + kpis.crossSell > 0} T={T} />
                </div>

                {/* Second KPI row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 24 }}>
                  <KpiCard label="Upsell"      value={fmt(kpis.upsell)}    subGood={kpis.upsell > 0}    sub={kpis.upsell > 0 ? 'Expansion' : null} T={T} />
                  <KpiCard label="Add on"      value={fmt(kpis.addOn)}     subGood={kpis.addOn > 0}     sub="Mid-term" T={T} />
                  <KpiCard label="Churn"       value={fmt(kpis.churn)}     subGood={kpis.churn === 0}   sub={kpis.churn < 0 ? 'Revenue lost' : null} T={T} />
                  <KpiCard label="Downsell"    value={fmt(kpis.downsell)}  subGood={kpis.downsell >= 0} T={T} />
                  <KpiCard label="Lapsed"      value={fmt(kpis.lapsed)}    subGood={kpis.lapsed === 0}  T={T} />
                </div>

                {/* AI narrative — relocated to the Executive Sidebar's
                    "RevenueLens AI — Executive Summary" section, using the
                    same buildContractNarrative() logic, not duplicated here. */}

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
                <ExpiryTimeline bridgeTable={engineOutput.bridgeTable} selPeriod={selPeriod} T={T} rangeStart={effectiveStart} rangeEnd={effectiveEnd} />
              </div>
            )}

            {/* ── RENEWAL RATES TAB ───────────────────────────────────────── */}
            {tab === 'renewal' && (
              <div style={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>Renewal Rate Intelligence</div>
                <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 20 }}>Gross Renewal = (Expiry Pool − Churn − Churn-Partial) / Expiry Pool · Net Renewal adds Upsell − Downsell</div>
                <RenewalRateTrend bridgeTable={engineOutput.bridgeTable} lb={lb} T={T} rangeStart={effectiveStart} rangeEnd={effectiveEnd} />
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
                <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>Top Movers — Risk &amp; Opportunity</div>
                <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 20 }}>Deterministic composite scoring for {fmtPeriod(selPeriod)} — every score decomposes into named, traceable reasons. Change the period above to see how risk and opportunity shift over time.</div>
                <ACVTopMovers
                  riskOpportunitySummary={engineOutput.riskOpportunitySummary}
                  riskOpportunityDetail={engineOutput.riskOpportunityDetail}
                  bridgeTable={engineOutput.bridgeTable}
                  lb={lb}
                  period={selPeriod}
                  T={T}
                />
              </div>
            )}

            {/* ── HISTORICAL TAB ──────────────────────────────────────────── */}
            {tab === 'historical' && (
              <div style={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>Historical ACV Performance</div>
                <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 20 }}>Multi-period ACV trend — lb=12 basis</div>
                <ACVHistoricalPerformance bridgeTable={engineOutput.bridgeTable} T={T} rangeStart={effectiveStart} rangeEnd={effectiveEnd} selPeriod={selPeriod} />
              </div>
            )}

            {/* ── COHORT ANALYSIS TAB ─────────────────────────────────── */}
            {tab === 'cohort' && (
              <div style={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>Cohort Analysis</div>
                <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 20 }}>
                  Retention by vintage cohort — how ACV evolves from each customer's first contract date
                </div>
                <CohortAnalysis bridgeTable={engineOutput.bridgeTable} T={T} />
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
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box }
        ::-webkit-scrollbar { display: none }
      `}</style>
    </div>
  )
}
