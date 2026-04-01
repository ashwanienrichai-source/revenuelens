// @ts-nocheck
import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  Legend, ReferenceLine
} from 'recharts'
import {
  Upload, Play, Download, Loader2, CheckCircle, AlertCircle, BarChart3,
  TrendingUp, TrendingDown, Users, DollarSign, Layers, Target, RefreshCw,
  Lock, ArrowUp, ArrowDown, FileText, Home, ChevronDown, ChevronUp,
  Zap, Activity, Shield, Sparkles, Info
} from 'lucide-react'
import { supabase, canDownload } from '../../lib/supabase'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://revenuelens-api.onrender.com'

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  bg:           '#0d1117',
  surface:      '#141a22',
  surface2:     '#19212c',
  surface3:     '#202938',
  border:       'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  text:         '#e7ebf2',
  textMuted:    '#96a0af',
  textFaint:    '#6d7887',
  accent:       '#3b6ef8',
  accentSoft:   'rgba(59,110,248,0.12)',
  positive:     '#3d9e6b',
  positiveSoft: 'rgba(61,158,107,0.12)',
  negative:     '#c0434b',
  negativeSoft: 'rgba(192,67,75,0.12)',
  warning:      '#c28a2f',
  warningSoft:  'rgba(194,138,47,0.12)',
  neutral:      '#4a5168',
  mono:         "'JetBrains Mono', monospace",
  sans:         "'Inter', system-ui, sans-serif",
}

// ─── Bridge Colors — semantic, muted financial palette ────────────────────────
const BRIDGE_COLORS = {
  baseline:    T.accent,     // #3b6ef8 — beginning/ending
  expansion:   T.positive,   // #3d9e6b — growth
  contraction: T.negative,   // #c0434b — loss
  neutral:     T.neutral,    // #4a5168 — pass-through
}

const BC: Record<string, string> = {
  'New Logo':       BRIDGE_COLORS.expansion,
  'Upsell':         BRIDGE_COLORS.expansion,
  'Cross-sell':     BRIDGE_COLORS.expansion,
  'Returning':      BRIDGE_COLORS.expansion,
  'Add on':         BRIDGE_COLORS.expansion,
  'Add-on':         BRIDGE_COLORS.expansion,
  'Other In':       BRIDGE_COLORS.neutral,
  'Downsell':       BRIDGE_COLORS.contraction,
  'Churn Partial':  BRIDGE_COLORS.contraction,
  'Churn-Partial':  BRIDGE_COLORS.contraction,
  'Churn':          BRIDGE_COLORS.contraction,
  'Lapsed':         BRIDGE_COLORS.contraction,
  'Other Out':      BRIDGE_COLORS.neutral,
  'Beginning MRR':  BRIDGE_COLORS.baseline,
  'Ending MRR':     BRIDGE_COLORS.baseline,
  'Beginning ARR':  BRIDGE_COLORS.baseline,
  'Ending ARR':     BRIDGE_COLORS.baseline,
  'Prior ACV':      BRIDGE_COLORS.baseline,
  'Ending ACV':     BRIDGE_COLORS.baseline,
  'RoB':            BRIDGE_COLORS.neutral,
  'Expiry Pool':    BRIDGE_COLORS.neutral,
}

// ─── Shared style helpers ─────────────────────────────────────────────────────
const S = {
  card:  { background: T.surface,  border: `1px solid ${T.border}`, borderRadius: 6, padding: 20 },
  cardF: { background: T.surface,  border: `1px solid ${T.border}`, borderRadius: 6, padding: 0, overflow: 'hidden' },
  label: { fontSize: 9, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: T.textFaint },
  th:    { fontSize: 9, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: T.textFaint, padding: '9px 14px', background: T.surface2, borderBottom: `1px solid ${T.border}`, textAlign: 'left' as const, whiteSpace: 'nowrap' as const },
  td:    { padding: '9px 14px', color: T.textMuted, fontSize: 12, borderBottom: `1px solid ${T.border}` },
  mono:  { fontFamily: T.mono, fontFeatureSettings: "'tnum'" },
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (v: number | null | undefined) => {
  if (v == null) return '—'
  const a = Math.abs(v)
  if (a >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}
const fmtPct = (v: number | null | undefined) => v != null ? `${v.toFixed(1)}%` : '—'

function makeToARR(revenueType: string) {
  return (v: number | null | undefined) => revenueType === 'MRR' ? (v == null ? null : v * 12) : v
}

// ─── Engine config ────────────────────────────────────────────────────────────
const ENGINE_CONFIG = {
  mrr: {
    label: 'MRR / ARR Analytics', desc: 'Revenue bridge, retention, NRR/GRR, top movers', icon: TrendingUp,
    required: [
      { key: 'customer', label: 'Customer / Account ID', kw: ['customer', 'customer_id', 'customerid', 'client', 'account', 'company'] },
      { key: 'date',     label: 'Date / Period (Monthly)', kw: ['date', 'activity_date', 'period', 'month', 'activity date'] },
      { key: 'revenue',  label: 'MRR / ARR / Revenue', kw: ['mrr', 'arr', 'revenue', 'amount', 'value', 'mrr or arr', 'mrrvalue', 'arrvalue'] },
    ],
    optional: [
      { key: 'product',  label: 'Product',          kw: ['product', 'sku', 'service', 'product name'] },
      { key: 'channel',  label: 'Channel',           kw: ['channel', 'segment', 'sales channel'] },
      { key: 'region',   label: 'Region',            kw: ['region', 'geo', 'geography', 'country'] },
      { key: 'quantity', label: 'Quantity / Units',  kw: ['quantity', 'qty', 'units', 'seats', 'licenses'] },
    ],
  },
  acv: {
    label: 'ACV / Contract Analytics', desc: 'Contract bridge, renewal rates, expiry pool', icon: FileText,
    required: [
      { key: 'customer',      label: 'Customer / Account ID',   kw: ['customer', 'customer_id', 'customerid', 'client', 'account'] },
      { key: 'date',          label: 'Activity / Signing Date', kw: ['date', 'activity_date', 'signing_date', 'order_date', 'period'] },
      { key: 'contractStart', label: 'Contract Start Date',     kw: ['contract_start', 'start_date', 'startdate', 'contract_begin', 'start'] },
      { key: 'contractEnd',   label: 'Contract End Date',       kw: ['contract_end', 'end_date', 'enddate', 'expiry', 'expiration', 'end'] },
      { key: 'tcv',           label: 'TCV / ACV Amount',        kw: ['tcv', 'acv', 'total_contract', 'contract_value', 'amount', 'revenue'] },
    ],
    optional: [
      { key: 'product',  label: 'Product',  kw: ['product', 'sku'] },
      { key: 'channel',  label: 'Channel',  kw: ['channel', 'segment'] },
      { key: 'region',   label: 'Region',   kw: ['region', 'geo', 'country'] },
      { key: 'quantity', label: 'Quantity', kw: ['quantity', 'qty', 'units', 'seats'] },
    ],
  },
  cohort: {
    label: 'Cohort Analytics', desc: 'Retention heatmap, size/percentile/revenue cohorts', icon: Layers,
    required: [
      { key: 'customer', label: 'Customer / Account ID', kw: ['customer', 'customer_id', 'customerid', 'client', 'account'] },
      { key: 'date',     label: 'Date / Period',         kw: ['date', 'activity_date', 'period', 'month'] },
      { key: 'fiscal',   label: 'Fiscal Year',           kw: ['fiscal', 'fy', 'fiscal_year', 'year'] },
      { key: 'revenue',  label: 'Revenue / MRR',         kw: ['mrr', 'arr', 'revenue', 'amount', 'value'] },
    ],
    optional: [
      { key: 'product', label: 'Product', kw: ['product', 'sku'] },
      { key: 'region',  label: 'Region',  kw: ['region', 'geo'] },
      { key: 'channel', label: 'Channel', kw: ['channel', 'segment'] },
    ],
  },
}

const COHORT_TYPES_CFG = [
  { id: 'SG', label: 'Size Cohorts',       desc: 'Tier 1 / Tier 2 / Tier 3 / Long Tail' },
  { id: 'PC', label: 'Percentile Cohorts', desc: 'Top 5% / 10% / 20% / 50%' },
  { id: 'RC', label: 'Revenue Cohorts',    desc: 'Revenue Leaders / Growth / Tail' },
]
const SYSTEM_COMPUTED = new Set(['lookback', 'classify', 'bridge_classification', 'month_lookback'])

function autoDetect(cols: string[], kws: string[]) {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const nk = kws.map(n)
  return cols.find(c => nk.includes(n(c))) || cols.find(c => nk.some(k => n(c).includes(k) || k.includes(n(c)))) || ''
}
function buildAutoMap(eng: string, cols: string[]) {
  if (!eng || !cols.length) return {}
  const map: Record<string, string> = {}
  ;[...ENGINE_CONFIG[eng].required, ...(ENGINE_CONFIG[eng].optional || [])].forEach(f => {
    if (SYSTEM_COMPUTED.has(f.key)) return
    const v = autoDetect(cols, f.kw); if (v) map[f.key] = v
  })
  return map
}

// ─── AI Narrative ─────────────────────────────────────────────────────────────
function genNarrative(ret: any, movers: any) {
  if (!ret || (!ret.beginning && !ret.ending)) return null
  const { beginning: beg, ending: end, nrr, new_arr, churn, upsell } = ret
  const delta = end - beg
  const pct = beg > 0 ? ((delta / beg) * 100).toFixed(1) : 0
  const trend = delta >= 0 ? 'grew' : 'contracted'
  let s = `ARR ${trend} from ${fmt(beg)} to ${fmt(end)} (${delta >= 0 ? '+' : ''}${pct}%).`
  if (nrr >= 100) s += ` Net retention of ${fmtPct(nrr)} — expansion outpacing churn.`
  else if (nrr > 0) s += ` Net retention at ${fmtPct(nrr)} — needs attention.`
  if (new_arr > 0) s += ` New logos contributed ${fmt(new_arr)}.`
  if (churn < 0)   s += ` Churn impact: ${fmt(Math.abs(churn))}.`
  const exp = movers?.['Upsell']?.[0] || movers?.['New Logo']?.[0]
  const chr = movers?.['Churn']?.[0]
  if (exp) s += ` Top expansion: ${exp.customer} (+${fmt(exp.value)}).`
  if (chr) s += ` Largest churn: ${chr.customer} (${fmt(Math.abs(chr.value))}).`
  return s
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL PRESENTATIONAL COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── UploadTimer ──────────────────────────────────────────────────────────────
function UploadTimer({ active }: { active: boolean }) {
  const [s, setS] = useState(0)
  useEffect(() => {
    if (!active) { setS(0); return }
    const t = setInterval(() => setS(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [active])
  if (!active) return null
  const pct = Math.min((s / 90) * 100, 98)
  const msg = s < 8 ? 'Connecting…' : s < 25 ? 'Waking API…' : s < 55 ? 'Crunching numbers…' : 'Almost there…'
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: T.textFaint }}>{msg}</span>
        <span style={{ fontSize: 10, fontFamily: T.mono, color: T.accent }}>{s}s</span>
      </div>
      <div style={{ height: 2, borderRadius: 2, overflow: 'hidden', background: T.surface3 }}>
        <div style={{ height: '100%', borderRadius: 2, transition: 'width 1s', width: `${pct}%`, background: T.accent }} />
      </div>
      {s > 6 && <p style={{ fontSize: 9, marginTop: 6, color: T.textFaint }}>First run each session takes 30–90s</p>}
    </div>
  )
}

// ─── FilterPill ───────────────────────────────────────────────────────────────
// Unified control pill — used for all toggle groups in the header
function FilterPill({
  label, active, onClick, disabled = false
}: { label: string; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '0 11px',
        height: 28,
        fontSize: 11,
        fontWeight: active ? 500 : 400,
        border: 'none',
        borderRadius: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: active ? T.surface3 : 'transparent',
        color: active ? T.text : disabled ? T.surface3 : T.textFaint,
        transition: 'all 0.12s',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
        fontFamily: T.sans,
      }}
    >
      {label}
    </button>
  )
}

// ─── PillGroup ────────────────────────────────────────────────────────────────
// Wraps FilterPills in a consistent bordered group
function PillGroup({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      background: T.bg,
      borderRadius: 5,
      border: `1px solid ${T.border}`,
      overflow: 'hidden',
      height: 28,
    }}>
      {children}
    </div>
  )
}

// ─── TabSwitch ────────────────────────────────────────────────────────────────
function TabSwitch({
  tabs, active, onChange
}: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div style={{
      display: 'flex',
      borderTop: `1px solid ${T.border}`,
      paddingLeft: 28,
      background: T.surface,
      overflowX: 'auto',
    }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            padding: '0 16px',
            height: 38,
            fontSize: 12,
            fontWeight: active === tab.id ? 500 : 400,
            border: 'none',
            borderBottom: `2px solid ${active === tab.id ? T.accent : 'transparent'}`,
            background: 'transparent',
            cursor: 'pointer',
            color: active === tab.id ? T.text : T.textFaint,
            transition: 'color 0.12s',
            whiteSpace: 'nowrap',
            fontFamily: T.sans,
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// ─── KpiBlock ─────────────────────────────────────────────────────────────────
// Premium financial KPI card — calm, dense, monospaced values
function KpiBlock({
  label, value, delta, deltaGood, sub
}: { label: string; value: string; delta?: string | null; deltaGood?: boolean | null; sub?: string | null }) {
  const deltaColor = deltaGood === true ? T.positive : deltaGood === false ? T.negative : T.textMuted
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 6,
      padding: '14px 16px',
    }}>
      <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.textFaint, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 20, fontWeight: 600, lineHeight: 1, color: T.text, letterSpacing: '-0.02em' }}>
        {value}
      </div>
      {(delta || sub) && (
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          {delta && (
            <span style={{ fontSize: 11, fontFamily: T.mono, color: deltaColor, fontWeight: 500 }}>
              {deltaGood === true ? '↑ ' : deltaGood === false ? '↓ ' : ''}{delta}
            </span>
          )}
          {sub && (
            <span style={{ fontSize: 10, color: deltaColor, fontWeight: 400 }}>{sub}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── NarrativeBar ─────────────────────────────────────────────────────────────
function NarrativeBar({ text }: { text: string }) {
  return (
    <div style={{
      padding: '11px 16px',
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${T.accent}`,
      borderRadius: 6,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
    }}>
      <Info size={13} color={T.accent} style={{ flexShrink: 0, marginTop: 1 }} />
      <p style={{ margin: 0, fontSize: 12, color: T.textMuted, lineHeight: 1.6 }}>{text}</p>
    </div>
  )
}

// ─── WarningBar ───────────────────────────────────────────────────────────────
function WarningBar({ text, error = false }: { text: string; error?: boolean }) {
  const color = error ? T.negative : T.warning
  const bg    = error ? T.negativeSoft : T.warningSoft
  const Icon  = error ? AlertCircle : AlertCircle
  return (
    <div style={{
      padding: '10px 14px',
      background: bg,
      border: `1px solid ${color}30`,
      borderRadius: 6,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
    }}>
      <Icon size={13} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 11, color, lineHeight: 1.5 }}>{text}</span>
    </div>
  )
}

// ─── MoverCard ────────────────────────────────────────────────────────────────
function MoverCard({ customer, value, period, isRisk, rank, arr, health, segment }: any) {
  const abs    = Math.abs(value || 0)
  const barPct = Math.min((abs / 300000) * 100, 100)
  const letter = String(customer || '?')[0].toUpperCase()
  const h      = health != null ? health : isRisk ? Math.max(10, Math.min(45, 40)) : Math.max(72, Math.min(98, 85))
  const hColor = h >= 80 ? T.positive : h >= 55 ? T.warning : T.negative

  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 6,
      background: T.surface,
      border: `1px solid ${T.border}`,
      marginBottom: 6,
      transition: 'border-color 0.15s',
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderStrong }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        {/* Avatar */}
        <div style={{
          width: 32, height: 32, borderRadius: 6,
          background: isRisk ? T.negativeSoft : T.accentSoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13,
          color: isRisk ? T.negative : T.accent,
          flexShrink: 0,
          fontFamily: T.mono,
        }}>
          {letter}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {customer || 'Unknown'}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 600, color: T.text }}>{fmt(arr || abs * 5)}</div>
              <div style={{ fontFamily: T.mono, fontSize: 11, color: isRisk ? T.negative : T.positive, marginTop: 1 }}>
                {isRisk ? '↓ −' : '↑ +'}{fmt(abs)}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
            {segment && (
              <span style={{ fontSize: 10, color: T.textMuted, background: T.surface2, border: `1px solid ${T.border}`, padding: '1px 7px', borderRadius: 20 }}>
                {segment}
              </span>
            )}
            <span style={{ fontSize: 10, color: hColor, background: `${hColor}15`, border: `1px solid ${hColor}30`, padding: '1px 7px', borderRadius: 20 }}>
              Health {h}%
            </span>
            {period && <span style={{ fontSize: 10, color: T.textFaint, fontFamily: T.mono }}>{period}</span>}
          </div>
        </div>
      </div>
      <div style={{ height: 2, background: T.surface3, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 2, background: isRisk ? T.negative : T.positive, width: `${barPct}%`, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

// ─── WaterfallBridge ──────────────────────────────────────────────────────────
function WaterfallBridge({ data, showBoundary = false }: { data: any[]; showBoundary?: boolean }) {
  if (!data?.length) return (
    <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textFaint, fontSize: 13 }}>
      No bridge data
    </div>
  )
  const BOUNDARY = new Set(['Beginning ARR', 'Ending ARR', 'Beginning MRR', 'Ending MRR', 'Prior ACV', 'Ending ACV'])
  const ORDER = ['Beginning ARR', 'Beginning MRR', 'New Logo', 'Upsell', 'Cross-sell', 'Returning', 'Other In', 'Downsell', 'Churn Partial', 'Churn', 'Lapsed', 'Other Out', 'Ending ARR', 'Ending MRR']
  const rows = showBoundary
    ? [...data].sort((a, b) => { const ai = ORDER.indexOf(a.category); const bi = ORDER.indexOf(b.category); return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) })
    : data.filter(d => !BOUNDARY.has(d.category) && d.value !== 0)

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    const isBound = BOUNDARY.has(d.category)
    return (
      <div style={{ background: T.surface2, border: `1px solid ${T.borderStrong}`, borderRadius: 6, padding: '8px 12px' }}>
        <div style={{ fontSize: 10, fontWeight: 500, color: T.textMuted, marginBottom: 3 }}>{d.category}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: isBound ? T.textMuted : d.value >= 0 ? T.positive : T.negative, fontFamily: T.mono }}>
          {isBound ? '' : d.value >= 0 ? '+' : ''}{fmt(d.value)}
        </div>
      </div>
    )
  }

  const getColor = (cat: string, val: number) => {
    if (BOUNDARY.has(cat)) return BRIDGE_COLORS.baseline
    return BC[cat] || (val >= 0 ? BRIDGE_COLORS.expansion : BRIDGE_COLORS.contraction)
  }

  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 48, left: 8 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={T.surface3} vertical={false} />
          <XAxis dataKey="category" tick={{ fontSize: 9, fill: T.textFaint }} angle={-35} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 9, fill: T.textFaint }} width={48} axisLine={false} tickLine={false} />
          <ReferenceLine y={0} stroke={T.border} strokeDasharray="3 3" />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
          <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={36}>
            {rows.map((e, i) => <Cell key={i} fill={getColor(e.category, e.value)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── BridgePivotTable ─────────────────────────────────────────────────────────
function BridgePivotTable({ pivot, title, lookbackLabel, showPct }: any) {
  if (!pivot?.periods?.length || !pivot?.rows?.length) return (
    <div style={{ color: T.textFaint, textAlign: 'center', padding: '32px', fontSize: 13 }}>No bridge data</div>
  )
  const { periods, rows, retention } = pivot
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ ...S.label }}>{title}</span>
        {lookbackLabel && (
          <span style={{ fontSize: 9, background: T.surface2, color: T.textFaint, border: `1px solid ${T.border}`, padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>
            {lookbackLabel}
          </span>
        )}
      </div>
      <table style={{ borderCollapse: 'collapse', minWidth: Math.max(periods.length * 100 + 220, 420), width: '100%', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border}` }}>
            <th style={{ ...S.th, width: 160, position: 'sticky', left: 0 }}>Bridge</th>
            {periods.map((p: string) => (
              <th key={p} style={{ textAlign: 'right', padding: '8px 12px', fontSize: 9, fontWeight: 600, color: T.textFaint, whiteSpace: 'nowrap' }}>{p}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any, ri: number) => {
            const isB = row.is_beginning || row.is_ending
            return (
              <tr key={ri} style={{ borderBottom: `1px solid ${T.border}`, background: isB ? T.surface2 : T.surface }}>
                <td style={{ padding: '8px 12px', position: 'sticky', left: 0, background: isB ? T.surface2 : T.surface, color: isB ? T.text : T.textMuted, fontWeight: isB ? 600 : 400, fontSize: 11, whiteSpace: 'nowrap' }}>
                  {!isB && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: BC[row.classification] || T.neutral, marginRight: 8, verticalAlign: 'middle' }} />}
                  {row.classification}
                </td>
                {periods.map((p: string) => {
                  const v = row.values?.[p]
                  const pos = v > 0
                  return (
                    <td key={p} style={{ textAlign: 'right', padding: '8px 12px', whiteSpace: 'nowrap', fontFamily: T.mono, fontSize: 11, fontWeight: isB ? 600 : 400, color: isB ? T.text : pos ? T.positive : v < 0 ? T.negative : T.neutral }}>
                      {v == null || v === 0 ? '—' : (pos && !isB ? '+' : '') + fmt(v)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
          {retention && Object.keys(retention).length > 0 && [['Gross Retention', 'grr', 80], ['Net Retention', 'nrr', 100]].map(([lbl, key, thr]) => (
            <tr key={key as string} style={{ borderTop: `1px solid ${T.border}`, background: T.surface2 }}>
              <td style={{ ...S.label, padding: '8px 12px', position: 'sticky', left: 0, background: T.surface, whiteSpace: 'nowrap' }}>{lbl}</td>
              {periods.map((p: string) => {
                const v = (retention[p] as any)?.[key as string]
                return (
                  <td key={p} style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 700, fontSize: 11, fontFamily: T.mono, color: (v as number) >= (thr as number) ? T.positive : T.negative }}>
                    {v != null ? `${(v as number).toFixed(1)}%` : '—'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── CustomerCountPivot ───────────────────────────────────────────────────────
function CustomerCountPivot({ pivot }: any) {
  if (!pivot?.periods?.length || !pivot?.rows?.length) return null
  const { periods, rows, logo_retention } = pivot
  return (
    <div style={{ overflowX: 'auto', marginTop: 24, paddingTop: 24, borderTop: `1px solid ${T.border}` }}>
      <div style={{ ...S.label, marginBottom: 10 }}>Customer Count Rollforward</div>
      <table style={{ borderCollapse: 'collapse', minWidth: Math.max(periods.length * 90 + 200, 400), width: '100%', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border}` }}>
            <th style={{ ...S.th, width: 160, position: 'sticky', left: 0, background: T.surface }} />
            {periods.map((p: string) => (
              <th key={p} style={{ textAlign: 'right', padding: '6px 12px', fontSize: 9, fontWeight: 600, color: T.textFaint, whiteSpace: 'nowrap' }}>{p}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any, ri: number) => {
            const isB = row.is_beginning || row.is_ending
            return (
              <tr key={ri} style={{ borderBottom: `1px solid ${T.border}`, background: isB ? T.surface2 : T.surface }}>
                <td style={{ padding: '6px 12px', position: 'sticky', left: 0, background: isB ? T.surface2 : T.surface, color: isB ? T.text : T.textMuted, fontWeight: isB ? 600 : 400, fontSize: 11, whiteSpace: 'nowrap' }}>
                  {row.classification}
                </td>
                {periods.map((p: string) => {
                  const v = row.values?.[p] || 0
                  return (
                    <td key={p} style={{ textAlign: 'right', padding: '6px 12px', fontFamily: T.mono, fontSize: 11, fontWeight: 500, color: v > 0 && !isB ? T.positive : v < 0 ? T.negative : T.neutral }}>
                      {v === 0 ? '—' : (v > 0 && !isB ? '+' : '') + v.toLocaleString()}
                    </td>
                  )
                })}
              </tr>
            )
          })}
          {logo_retention && (
            <tr style={{ borderTop: `1px solid ${T.border}`, background: T.surface2 }}>
              <td style={{ ...S.label, padding: '6px 12px', position: 'sticky', left: 0, background: T.surface, whiteSpace: 'nowrap' }}>Logo Retention</td>
              {periods.map((p: string) => {
                const lr = (logo_retention[p] as any)?.logo_retention
                return (
                  <td key={p} style={{ textAlign: 'right', padding: '6px 12px', fontWeight: 700, fontSize: 11, fontFamily: T.mono, color: lr >= 80 ? T.positive : lr >= 60 ? T.neutral : T.negative }}>
                    {lr != null ? `${lr.toFixed(1)}%` : '—'}
                  </td>
                )
              })}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── KpiSummaryTable ──────────────────────────────────────────────────────────
function KpiSummaryTable({ rows }: any) {
  if (!rows?.length) return null
  const fV = (v: any) => { if (v == null || v === 0) return '—'; const a = Math.abs(v); if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`; if (a >= 1e3) return `$${(v / 1e3).toFixed(0)}K`; return `$${v.toFixed(0)}` }
  const fP = (v: any) => v == null ? '—' : `${v.toFixed(1)}%`
  const pc  = (v: any, g = 80, gr = 100) => v == null ? T.neutral : v >= gr ? T.positive : v >= g ? T.neutral : T.negative
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border}` }}>
            {['Period', 'Beg ARR', 'New Logo', 'Upsell', 'Downsell', 'Churn', 'End ARR', 'GRR', 'NRR'].map(h => (
              <th key={h} style={{ ...S.th }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any, i: number) => (
            <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td style={{ ...S.td, ...S.mono, color: T.text, fontWeight: 600 }}>{r.period}</td>
              <td style={{ ...S.td, ...S.mono }}>{fV(r.beginning_arr)}</td>
              <td style={{ ...S.td, ...S.mono, color: T.positive, fontWeight: 600 }}>{r.new_logo > 0 ? `+${fV(r.new_logo)}` : '—'}</td>
              <td style={{ ...S.td, ...S.mono, color: T.positive }}>{r.upsell > 0 ? `+${fV(r.upsell)}` : '—'}</td>
              <td style={{ ...S.td, ...S.mono }}>{fV(r.downsell)}</td>
              <td style={{ ...S.td, ...S.mono, color: T.negative, fontWeight: 600 }}>{fV(r.churn)}</td>
              <td style={{ ...S.td, ...S.mono, color: T.text, fontWeight: 600 }}>{fV(r.ending_arr)}</td>
              <td style={{ ...S.td, ...S.mono, fontWeight: 700, color: pc(r.gross_retention) }}>{fP(r.gross_retention)}</td>
              <td style={{ ...S.td, ...S.mono, fontWeight: 700, color: pc(r.net_retention, 100, 110) }}>{fP(r.net_retention)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── CohortHeatmap ────────────────────────────────────────────────────────────
function CohortHeatmap({ data, title, isPercent }: any) {
  if (!data?.length) return <div style={{ color: T.textFaint, textAlign: 'center', padding: 24, fontSize: 13 }}>No data</div>
  const allKeys = Array.from(new Set(data.flatMap((r: any) => Object.keys(r).filter(k => k !== 'cohort')))).sort((a, b) => Number(a) - Number(b))
  const allVals = data.flatMap((r: any) => (allKeys as string[]).map(k => r[k] || 0)).filter((v: number) => v > 0)
  const maxVal  = Math.max(...allVals, 1)

  const color = (v: number) => {
    if (!v) return 'transparent'
    if (!isPercent) return `rgba(59,110,248,${0.1 + (v / maxVal) * 0.6})`
    if (v >= 90) return T.positive
    if (v >= 70) return '#2a7a52'
    if (v >= 50) return '#1e5a3c'
    if (v >= 30) return T.neutral
    return T.negative
  }
  const tc = (v: number) => { if (!v) return 'transparent'; if (isPercent && v >= 50) return '#fff'; return T.textFaint }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ ...S.label }}>{title}</span>
        <span style={{ fontSize: 9, color: T.textFaint }}>{(allKeys as string[]).length} periods · {data.length} cohorts</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ fontSize: 11, minWidth: (allKeys as string[]).length * 36 + 120 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '4px 12px 4px 0', fontSize: 9, fontWeight: 600, color: T.textFaint, position: 'sticky', left: 0, background: T.surface, whiteSpace: 'nowrap' }}>Cohort</th>
              {(allKeys as string[]).map(k => <th key={k} style={{ padding: '0 2px', textAlign: 'center', fontSize: 9, color: T.textFaint, fontWeight: 600, whiteSpace: 'nowrap' }}>M{k}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((row: any, ri: number) => (
              <tr key={ri}>
                <td style={{ padding: '2px 12px 2px 0', fontSize: 10, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: T.surface }}>{row.cohort}</td>
                {(allKeys as string[]).map(k => {
                  const v = row[k]
                  return (
                    <td key={k} style={{ padding: '2px' }}>
                      <div style={{ width: 32, height: 22, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, background: color(v), color: tc(v) }}>
                        {v ? (isPercent ? `${v}%` : fmt(v)) : ''}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── FieldRow ─────────────────────────────────────────────────────────────────
function FieldRow({ label, value, columns, onChange, showError }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderBottom: `1px solid ${T.border}` }}>
      <div style={{ flex: 1, fontSize: 11, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          fontSize: 10,
          border: `1px solid ${showError && !value ? `${T.negative}60` : value ? `${T.accent}40` : T.border}`,
          borderRadius: 5,
          padding: '4px 8px',
          background: T.surface2,
          color: showError && !value ? T.negative : value ? T.text : T.textMuted,
          outline: 'none',
          width: 140,
          flexShrink: 0,
          fontFamily: T.sans,
        }}
      >
        <option value="">— Select —</option>
        {columns.map((c: string) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  )
}

// ─── SectionHeader ────────────────────────────────────────────────────────────
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.border}` }}>
      <div style={{ ...S.label }}>{children}</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function CommandCenter() {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<any>(null)

  // File state
  const [file, setFile]             = useState<File | null>(null)
  const [columns, setColumns]       = useState<string[]>([])
  const [rowCount, setRowCount]     = useState(0)
  const [uploading, setUploading]   = useState(false)
  const [uploadErr, setUploadErr]   = useState('')
  const [isBridgeOutput, setIsBridgeOutput] = useState(false)

  // Engine
  const [engine, setEngine] = useState<string | null>(null)

  // Field mapping
  const [fieldMap, setFieldMap]   = useState<Record<string, string>>({})
  const [showOpt, setShowOpt]     = useState(false)
  const [validated, setValidated] = useState(false)

  // Cohort config
  const [cohortTypes, setCohortTypes]       = useState(['SG', 'PC', 'RC'])
  const [periodFilter, setPeriodFilter]     = useState('all')
  const [selectedFY, setSelectedFY]         = useState('')
  const [useSingle, setUseSingle]           = useState(true)
  const [useMulti, setUseMulti]             = useState(false)
  const [individualCols, setIndividualCols] = useState([''])
  const [hierarchies, setHierarchies]       = useState([['']])

  // MRR/ACV config
  const [lookbacks, setLookbacks]   = useState([1, 3, 12])
  const [revenueUnit, setRevUnit]   = useState('raw')
  const [periodType, setPeriod]     = useState('Annual')
  const [revenueType, setRevenueType] = useState('ARR')

  // Results
  const [results, setResults]       = useState<any>(null)
  const [running, setRunning]       = useState(false)
  const [runErr, setRunErr]         = useState('')
  const [selLb, setSelLb]           = useState(12)
  const [yearFilter, setYearFilter] = useState('All')
  const [activeTab, setActiveTab]   = useState('summary')
  const [moverCat, setMoverCat]     = useState('')
  const [cohortResults, setCohortResults] = useState<any>(null)
  const [cohortRunning, setCohortRunning] = useState(false)
  const [cohortErr, setCohortErr]         = useState('')

  // Header filter state
  const [selDims, setSelDims]     = useState('customer')
  const [selPeriod, setSelPeriod] = useState('')
  const [rerunning, setRerunning] = useState(false)

  const isAdmin  = canDownload(profile)
  const cfg      = engine ? ENGINE_CONFIG[engine] : null
  const isCohort = results?._engine === 'cohort'

  const errors = useMemo(() => {
    const e: Record<string, string> = {}
    if (!engine) return e
    ENGINE_CONFIG[engine].required.forEach(f => { if (!fieldMap[f.key]) e[f.key] = 'Required' })
    return e
  }, [engine, fieldMap])

  const step1  = columns.length > 0
  const step2  = step1 && !!engine
  const step3  = step2 && Object.keys(errors).length === 0
  const canRun = step3 && !running

  const toARR = makeToARR(revenueType)

  // Derived data
  const lb       = String(selLb)
  const bdg      = results?.bridge?.[lb]
  const ret      = bdg?.retention
  const wfall    = bdg?.waterfall || []
  const kpiRows  = results?.kpi_matrix || []
  const movers   = results?.top_movers || {}
  const topCusts = results?.top_customers || []

  function getMoverCustomer(row: any) {
    if (!row) return '?'
    if (row.customer) return row.customer
    if (row.Customer) return row.Customer
    const custKey = fieldMap.customer
    if (custKey && row[custKey] != null) return String(row[custKey])
    const key = Object.keys(row).find(k =>
      k !== 'Period' && !k.includes('Value') && !k.includes('period') && typeof row[k] === 'string'
    )
    return key ? String(row[key]) : '?'
  }

  function getMoverValue(row: any, cat: string) {
    if (!row) return 0
    if (row.value != null) return row.value
    if (row[`${cat} Value`] != null) return row[`${cat} Value`]
    if (row['Bridge_Value'] != null) return row['Bridge_Value']
    if (row['Bridge Value'] != null) return row['Bridge Value']
    const key = Object.keys(row).find(k => k.includes('Value') && typeof row[k] === 'number')
    return key ? row[key] : 0
  }

  function getMoverPeriod(row: any) {
    return row?.Period || row?.period || ''
  }

  // Available periods
  const availablePeriods = useMemo(() => {
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const raw = new Set<string>()
    if (results?.bridge) {
      Object.values(results.bridge).forEach((b: any) => {
        if (b?.by_period) b.by_period.forEach((r: any) => { if (r._period) raw.add(r._period) })
      })
    }
    if (raw.size === 0) return []
    const parse = (s: string) => {
      const [mon, yr] = (s || '').split('-')
      const mi = MONTHS.indexOf(mon)
      if (mi < 0) return 0
      const yrNum = parseInt(yr, 10)
      const fullYr = yrNum < 50 ? 2000 + yrNum : 1900 + yrNum
      return fullYr * 100 + mi
    }
    const sorted = Array.from(raw).sort((a, b) => parse(a) - parse(b))
    if (sorted.length === 0) return []
    const minN = parse(sorted[0])
    const maxN = parse(sorted[sorted.length - 1])
    const result: string[] = []
    let cur = minN
    while (cur <= maxN) {
      const yr = Math.floor(cur / 100)
      const mi = cur % 100
      const yy = String(yr).slice(-2)
      result.push(`${MONTHS[mi]}-${yy}`)
      if (mi === 11) cur = (yr + 1) * 100
      else cur++
    }
    return result
  }, [results])

  const filteredByPeriod = useMemo(() => {
    if (!bdg?.by_period?.length) return []
    if (!selPeriod) return bdg.by_period
    return bdg.by_period.filter((r: any) => r._period === selPeriod)
  }, [bdg, selPeriod])

  const HIDDEN_AT_CUSTOMER = new Set(['Cross-sell', 'Churn Partial', 'Churn-Partial', 'Returning', 'Other In', 'Other Out'])
  const HIDDEN_AT_REGION   = new Set(['Cross-sell', 'Churn Partial', 'Churn-Partial'])

  function filterByDimension(wfallData: any[]) {
    if (!wfallData?.length) return wfallData
    if (selDims === 'customer') return wfallData.filter(r => !HIDDEN_AT_CUSTOMER.has(r.category))
    if (selDims === 'region')   return wfallData.filter(r => !HIDDEN_AT_REGION.has(r.category))
    return wfallData
  }

  function validateBridge(wfallData: any[], beg: number, end: number) {
    const BOUNDARY = new Set(['Beginning ARR', 'Ending ARR', 'Beginning MRR', 'Ending MRR'])
    const movements = (wfallData || []).filter(r => !BOUNDARY.has(r.category))
    const total    = movements.reduce((s, r) => s + (r.value || 0), 0)
    const expected = (end || 0) - (beg || 0)
    const diff     = Math.abs(total - expected)
    const tol      = Math.max(Math.abs(expected) * 0.005, 1)
    return { valid: diff <= tol, diff, total, expected }
  }

  const selectedWfall = useMemo(() => {
    let base = wfall
    if (selPeriod && bdg?.by_period?.length) {
      const row = bdg.by_period.find((r: any) => r._period === selPeriod)
      if (row) {
        const cats = ['New Logo', 'Upsell', 'Cross-sell', 'Returning', 'Other In', 'Downsell', 'Churn Partial', 'Churn', 'Lapsed', 'Other Out']
        base = cats.map(cat => ({ category: cat, value: row[cat] || 0 })).filter(r => r.value !== 0)
      }
    }
    return filterByDimension(base)
  }, [selPeriod, bdg, wfall, selDims])

  const retForPeriod = useMemo(() => {
    if (!selPeriod || !bdg?.by_period?.length) return ret
    const row = bdg.by_period.find((r: any) => r._period === selPeriod)
    if (!row) return ret
    const posCats = ['New Logo', 'Upsell', 'Cross-sell', 'Returning', 'Other In']
    const negCats = ['Churn', 'Churn Partial', 'Churn-Partial', 'Downsell', 'Lapsed', 'Other Out']
    const newArr  = posCats.reduce((s, c) => s + (row[c] || 0), 0)
    const lostArr = negCats.reduce((s, c) => s + (row[c] || 0), 0)
    const beg     = ret?.beginning || 0
    const end     = beg + newArr + lostArr
    return {
      beginning: beg,
      ending:    end > 0 ? end : ret?.ending,
      new_arr:   newArr,
      lost_arr:  lostArr,
      nrr:       beg > 0 ? ((end - newArr) / beg) * 100 : ret?.nrr,
      grr:       beg > 0 ? ((end - newArr + lostArr) / beg) * 100 : ret?.grr,
    }
  }, [selPeriod, bdg, ret])

  const bridgeOk = useMemo(() => {
    const r = retForPeriod || ret
    if (!r?.beginning && !r?.ending) return null
    return validateBridge(selectedWfall, r?.beginning, r?.ending)
  }, [selectedWfall, retForPeriod, ret])

  const customerArrMap = useMemo(() => {
    const map: Record<string, any> = {}
    if (!topCusts?.length) return map
    topCusts.forEach((row: any) => {
      const custKey = Object.keys(row).find(k => /customer|account|name/i.test(k))
      const endKey  = Object.keys(row).find(k => /ending|end_arr/i.test(k))
      const begKey  = Object.keys(row).find(k => /beginning|beg_arr/i.test(k))
      if (custKey && endKey) {
        map[String(row[custKey])] = { endingArr: row[endKey] ?? null, beginningArr: begKey ? (row[begKey] ?? null) : null }
      }
    })
    return map
  }, [topCusts])

  useEffect(() => {
    if (availablePeriods.length > 0 && !selPeriod) {
      setSelPeriod(availablePeriods[availablePeriods.length - 1])
    }
  }, [availablePeriods])

  const narrative = useMemo(() => genNarrative(retForPeriod || ret, movers), [retForPeriod, ret, movers])

  const expansionList = useMemo(() => {
    const posCats = ['New Logo', 'Upsell', 'Cross-sell', 'Returning', 'Other In']
    for (const cat of posCats) {
      if (movers[cat]?.length) return movers[cat].map((r: any) => ({ ...r, _cat: cat })).slice(0, 20)
    }
    return []
  }, [movers])

  const churnList = useMemo(() => {
    const negCats = ['Churn', 'Churn-Partial', 'Churn Partial', 'Lapsed', 'Downsell', 'Other Out']
    for (const cat of negCats) {
      if (movers[cat]?.length) return movers[cat].map((r: any) => ({ ...r, _cat: cat })).slice(0, 20)
    }
    return []
  }, [movers])

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }
      supabase.from('profiles').select('*').eq('id', session.user.id).single().then(({ data }) => { if (data) setProfile(data) })
    })
    fetch(`${API}/health`).catch(() => {})
  }, [router])

  useEffect(() => {
    if (!engine || !columns.length) return
    setFieldMap(buildAutoMap(engine, columns))
    setShowOpt(false); setValidated(false)
  }, [engine, columns])

  // ── API actions ────────────────────────────────────────────────────────────
  async function uploadFile(f: File) {
    setFile(f); setUploading(true); setUploadErr(''); setColumns([]); setEngine(null); setFieldMap({}); setResults(null); setIsBridgeOutput(false)
    try {
      const fd = new FormData(); fd.append('file', f)
      const { data } = await axios.post(`${API}/api/columns`, fd, { timeout: 90000 })
      setColumns(data.columns); setRowCount(data.row_count)
      setIsBridgeOutput(data.is_bridge_output || false)
      if (data.is_acv) setEngine('acv')
      else if (data.is_bridge_output) setEngine('mrr')
    } catch (e: any) {
      setUploadErr(e.code === 'ECONNABORTED' ? 'Timed out — retry in 10s.' : `Could not read file: ${e?.response?.data?.detail || e.message}`)
    }
    setUploading(false)
  }

  async function runAnalysis() {
    setValidated(true)
    if (!canRun) return
    setRunning(true); setRunErr('')
    try {
      const fd = new FormData(); fd.append('file', file!)
      if (engine === 'cohort') {
        fd.append('metric',              fieldMap.revenue || '')
        fd.append('customer_col',        fieldMap.customer || '')
        fd.append('date_col',            fieldMap.date || '')
        fd.append('fiscal_col',          fieldMap.fiscal || 'None')
        fd.append('cohort_types',        JSON.stringify(cohortTypes))
        fd.append('period_filter',       periodFilter)
        fd.append('selected_fiscal_year', selectedFY)
        fd.append('individual_cols',     JSON.stringify(useSingle ? individualCols.filter(c => c && c !== 'None') : []))
        fd.append('hierarchies',         JSON.stringify(useMulti ? hierarchies.filter(h => h.some(c => c && c !== 'None')) : []))
        const { data } = await axios.post(`${API}/api/cohort/analyze`, fd, { timeout: 120000 })
        setResults({ ...data, _engine: 'cohort' }); setActiveTab('heatmap')
      } else {
        const dims = ['product', 'channel', 'region'].map(k => fieldMap[k]).filter(Boolean)
        fd.append('revenue_unit',   revenueUnit)
        fd.append('revenue_type',  revenueType)
        fd.append('lookbacks',      JSON.stringify(lookbacks))
        fd.append('dimension_cols', JSON.stringify(dims))
        fd.append('year_filter',    yearFilter !== 'All' ? yearFilter : '')
        fd.append('period_type',    periodType)
        fd.append('n_movers',       '30')
        fd.append('n_customers',    '10')
        let endpoint = `${API}/api/bridge/analyze`
        if (isBridgeOutput) {
          fd.append('tool_type',    engine === 'acv' ? 'ACV' : 'MRR')
          fd.append('customer_col', fieldMap.customer || 'Customer_ID')
          fd.append('modules',      JSON.stringify(['bridge', 'top_movers', 'top_customers', 'kpi_matrix', 'output']))
        } else if (engine === 'acv') {
          endpoint = `${API}/api/acv/analyze`
          fd.append('customer_col',   fieldMap.customer || '')
          fd.append('order_date_col', fieldMap.date || '')
          fd.append('start_col',      fieldMap.contractStart || '')
          fd.append('end_col',        fieldMap.contractEnd || '')
          fd.append('tcv_col',        fieldMap.tcv || '')
          if (fieldMap.product)  fd.append('product_col',  fieldMap.product)
          if (fieldMap.channel)  fd.append('channel_col',  fieldMap.channel)
          if (fieldMap.region)   fd.append('region_col',   fieldMap.region)
          if (fieldMap.quantity) fd.append('quantity_col', fieldMap.quantity)
        } else {
          endpoint = `${API}/api/mrr/analyze`
          fd.append('tool_type',    'MRR')
          fd.append('customer_col', fieldMap.customer || '')
          fd.append('date_col',     fieldMap.date || '')
          fd.append('revenue_col',  fieldMap.revenue || '')
          if (fieldMap.product)  fd.append('product_col',  fieldMap.product)
          if (fieldMap.channel)  fd.append('channel_col',  fieldMap.channel)
          if (fieldMap.region)   fd.append('region_col',   fieldMap.region)
          if (fieldMap.quantity) fd.append('quantity_col', fieldMap.quantity)
        }
        const { data } = await axios.post(endpoint, fd, { timeout: 120000 })
        setResults({ ...data, _engine: engine }); setActiveTab('summary')
        if (lookbacks.length) setSelLb(lookbacks[lookbacks.length - 1])
        const allCats = Object.keys(data.top_movers || {})
        const churnCat = allCats.find(c => ['Churn', 'Churn-Partial', 'Lapsed', 'Downsell'].includes(c))
        if (churnCat) setMoverCat(churnCat)
        else if (allCats.length) setMoverCat(allCats[0])
      }
    } catch (e: any) { setRunErr(e?.response?.data?.detail || 'Analysis failed. Please try again.') }
    setRunning(false)
  }

  async function applyDimFilter(dimKey: string) {
    if (!file || !results || running || rerunning) return
    setSelDims(dimKey); setRerunning(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const dims = []
      if (dimKey === 'product' && fieldMap.product) dims.push(fieldMap.product)
      if (dimKey === 'region'  && fieldMap.region)  dims.push(fieldMap.region)
      fd.append('revenue_unit',   revenueUnit)
      fd.append('revenue_type',  revenueType)
      fd.append('lookbacks',      JSON.stringify(lookbacks))
      fd.append('dimension_cols', JSON.stringify(dims))
      fd.append('year_filter',    '')
      fd.append('period_type',    periodType)
      fd.append('n_movers',       '30')
      fd.append('n_customers',    '10')
      let endpoint = `${API}/api/mrr/analyze`
      if (isBridgeOutput) {
        endpoint = `${API}/api/bridge/analyze`
        fd.append('tool_type',    engine === 'acv' ? 'ACV' : 'MRR')
        fd.append('customer_col', fieldMap.customer || 'Customer_ID')
        fd.append('modules',      JSON.stringify(['bridge', 'top_movers', 'top_customers', 'kpi_matrix', 'output']))
      } else {
        fd.append('tool_type',    'MRR')
        fd.append('customer_col', fieldMap.customer || '')
        fd.append('date_col',     fieldMap.date || '')
        fd.append('revenue_col',  fieldMap.revenue || '')
        if (fieldMap.product)  fd.append('product_col',  fieldMap.product)
        if (fieldMap.channel)  fd.append('channel_col',  fieldMap.channel)
        if (fieldMap.region)   fd.append('region_col',   fieldMap.region)
        if (fieldMap.quantity) fd.append('quantity_col', fieldMap.quantity)
      }
      const { data } = await axios.post(endpoint, fd, { timeout: 120000 })
      setResults({ ...data, _engine: engine })
      if (lookbacks.length) setSelLb(lookbacks[lookbacks.length - 1])
      const c2 = Object.keys(data.top_movers || {}); if (c2.length) setMoverCat(c2[0])
    } catch (e) { console.error('Re-run failed:', e) }
    setRerunning(false)
  }

  async function applyPeriodType(newPeriodType: string) {
    setPeriod(newPeriodType)
    if (!file || !results) return
    setRerunning(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const dims = []
      if (selDims === 'product' && fieldMap.product) dims.push(fieldMap.product)
      if (selDims === 'region'  && fieldMap.region)  dims.push(fieldMap.region)
      fd.append('revenue_unit',   revenueUnit)
      fd.append('revenue_type',  revenueType)
      fd.append('lookbacks',      JSON.stringify(lookbacks))
      fd.append('dimension_cols', JSON.stringify(dims))
      fd.append('year_filter',    '')
      fd.append('period_type',    newPeriodType)
      fd.append('n_movers',       '30')
      fd.append('n_customers',    '10')
      let endpoint = `${API}/api/mrr/analyze`
      if (isBridgeOutput) {
        endpoint = `${API}/api/bridge/analyze`
        fd.append('tool_type',    engine === 'acv' ? 'ACV' : 'MRR')
        fd.append('customer_col', fieldMap.customer || 'Customer_ID')
        fd.append('modules',      JSON.stringify(['bridge', 'top_movers', 'top_customers', 'kpi_matrix', 'output']))
      } else {
        fd.append('tool_type',    'MRR')
        fd.append('customer_col', fieldMap.customer || '')
        fd.append('date_col',     fieldMap.date || '')
        fd.append('revenue_col',  fieldMap.revenue || '')
        if (fieldMap.product)  fd.append('product_col',  fieldMap.product)
        if (fieldMap.channel)  fd.append('channel_col',  fieldMap.channel)
        if (fieldMap.region)   fd.append('region_col',   fieldMap.region)
        if (fieldMap.quantity) fd.append('quantity_col', fieldMap.quantity)
      }
      const { data } = await axios.post(endpoint, fd, { timeout: 120000 })
      setResults({ ...data, _engine: engine })
      if (lookbacks.length) setSelLb(lookbacks[lookbacks.length - 1])
    } catch (e) { console.error('Period type re-run failed:', e) }
    setRerunning(false)
  }

  function downloadCSV() {
    const out = results?.output || []; if (!out.length) return
    const keys = Object.keys(out[0])
    const csv  = [keys.join(','), ...out.map((r: any) => keys.map(k => `"${r[k] ?? ''}"`).join(','))].join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `revenuelens_${engine}_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  }

  async function runInlineCohort() {
    if (!file || cohortRunning) return
    setCohortRunning(true); setCohortErr('')
    try {
      const fd = new FormData(); fd.append('file', file)
      fd.append('metric',              fieldMap.revenue || '')
      fd.append('customer_col',        fieldMap.customer || '')
      fd.append('date_col',            fieldMap.date || '')
      fd.append('fiscal_col',          'None')
      fd.append('cohort_types',        JSON.stringify(['SG']))
      fd.append('period_filter',       'all')
      fd.append('selected_fiscal_year', '')
      fd.append('individual_cols',     JSON.stringify([]))
      fd.append('hierarchies',         JSON.stringify([]))
      const { data } = await axios.post(`${API}/api/cohort/analyze`, fd, { timeout: 120000 })
      setCohortResults(data)
    } catch (e: any) { setCohortErr(e?.response?.data?.detail || 'Cohort analysis failed.') }
    setCohortRunning(false)
  }

  // Tabs
  const TABS = isCohort ? [
    { id: 'heatmap', label: 'Retention' },
    { id: 'revenue_heatmap', label: 'Revenue' },
    { id: 'segmentation', label: 'Segments' },
    { id: 'summary', label: 'Summary' },
    { id: 'output', label: 'Output' },
  ] : [
    { id: 'summary', label: 'Summary' },
    { id: 'retention_trend', label: 'Detailed Bridge' },
    { id: 'cohort_heatmap', label: 'Cohorts' },
    { id: 'top_movers', label: 'Top Movers' },
    { id: 'top_customers', label: 'Customers' },
    { id: 'kpi_matrix', label: 'KPI Matrix' },
    { id: 'output', label: 'Output' },
  ]

  const retD = retForPeriod || ret

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: T.bg, fontFamily: T.sans, color: T.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box }
        body { font-family: ${T.sans}; background: ${T.bg}; color: ${T.text}; }
        ::-webkit-scrollbar { width: 4px; height: 4px }
        ::-webkit-scrollbar-track { background: transparent }
        ::-webkit-scrollbar-thumb { background: ${T.surface3}; border-radius: 4px }
        ::-webkit-scrollbar-thumb:hover { background: ${T.neutral} }
        @keyframes spin { to { transform: rotate(360deg) } }
        .spin { animation: spin 1s linear infinite }
        select option { background: ${T.surface2}; color: ${T.text}; }
      `}</style>

      {/* ══ LEFT SIDEBAR ═══════════════════════════════════════════════════ */}
      <aside style={{
        width: 252,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        borderRight: `1px solid ${T.border}`,
        background: T.surface,
        overflow: 'hidden',
      }}>

        {/* Logo */}
        <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: T.surface2, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BarChart3 size={12} color={T.textMuted} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, letterSpacing: '-0.01em', lineHeight: 1 }}>RevenueLens</div>
            <div style={{ fontSize: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.textFaint, marginTop: 2 }}>Analytics</div>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            title="Home"
            style={{ padding: 5, borderRadius: 5, background: 'transparent', border: 'none', cursor: 'pointer', color: T.textFaint, display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.textMuted }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.textFaint }}
          >
            <Home size={12} />
          </button>
        </div>

        {/* Progress steps */}
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          {([[1, 'Upload Data', step1, !step1], [2, 'Select Engine', step2, step1 && !step2], [3, 'Map Fields', step3, step2 && !step3]] as const).map(([n, lbl, done, active]) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, background: active ? T.surface2 : 'transparent', marginBottom: 1 }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8, fontWeight: 700, flexShrink: 0,
                background: done ? T.positiveSoft : active ? T.surface3 : T.surface2,
                color: done ? T.positive : active ? T.text : T.textFaint,
              }}>
                {done ? '✓' : n}
              </div>
              <span style={{ fontSize: 11, fontWeight: active ? 500 : 400, color: active ? T.text : done ? T.textFaint : T.textFaint }}>{lbl}</span>
            </div>
          ))}
        </div>

        {/* Scrollable sidebar content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* STEP 1: Upload */}
          <div style={{ padding: 14, borderBottom: `1px solid ${T.border}` }}>
            <div style={{ ...S.label, marginBottom: 10 }}>1. Upload Data</div>
            {uploadErr && <WarningBar text={uploadErr} error />}
            <div
              onClick={() => !uploading && fileRef.current?.click()}
              style={{
                marginTop: uploadErr ? 8 : 0,
                borderRadius: 8,
                border: `1px dashed ${file && columns.length ? `${T.positive}50` : uploading ? T.border : T.borderStrong}`,
                padding: 14,
                textAlign: 'center',
                cursor: 'pointer',
                background: file && columns.length ? T.positiveSoft : T.surface2,
                transition: 'all 0.15s',
              }}
            >
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f) }} />
              {uploading ? (
                <div>
                  <Loader2 size={16} color={T.textMuted} className="spin" style={{ margin: '0 auto 4px' }} />
                  <div style={{ fontSize: 11, color: T.textMuted }}>Reading file…</div>
                </div>
              ) : file && columns.length ? (
                <div>
                  <CheckCircle size={16} color={T.positive} style={{ margin: '0 auto 4px' }} />
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                  <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{rowCount.toLocaleString()} rows · {columns.length} cols</div>
                  <button onClick={e => { e.stopPropagation(); fileRef.current?.click() }} style={{ fontSize: 9, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}>
                    Change file
                  </button>
                </div>
              ) : (
                <div>
                  <Upload size={16} color={T.textFaint} style={{ margin: '0 auto 6px' }} />
                  <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>Click or drag file</div>
                  <div style={{ fontSize: 10, color: T.textFaint, marginTop: 2 }}>CSV or Excel</div>
                </div>
              )}
            </div>
            <UploadTimer active={uploading} />
          </div>

          {/* STEP 2: Engine */}
          {step1 && (
            <div style={{ padding: 14, borderBottom: `1px solid ${T.border}` }}>
              <div style={{ ...S.label, marginBottom: 10 }}>2. Select Engine</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {Object.entries(ENGINE_CONFIG).map(([id, ec]) => {
                  const Icon   = ec.icon
                  const active = engine === id
                  return (
                    <button key={id} onClick={() => setEngine(id)} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 6,
                      border: `1px solid ${active ? `${T.accent}50` : T.border}`,
                      background: active ? T.accentSoft : T.surface2,
                      cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s',
                    }}>
                      <div style={{ width: 26, height: 26, borderRadius: 6, background: active ? T.accentSoft : T.surface3, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={11} color={active ? T.accent : T.textFaint} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: active ? T.text : T.textMuted, lineHeight: 1.2 }}>{ec.label}</div>
                        <div style={{ fontSize: 9, color: T.textFaint, marginTop: 2 }}>{ec.desc}</div>
                      </div>
                      {active && <CheckCircle size={11} color={T.accent} />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Map Fields */}
          {step2 && cfg && (
            <div style={{ padding: 14, borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ ...S.label }}>3. Map Fields</div>
                <span style={{ fontSize: 9, fontWeight: 600, color: Object.keys(errors).length === 0 ? T.positive : T.textFaint }}>
                  {cfg.required.filter(f => !!fieldMap[f.key]).length}/{cfg.required.length} mapped
                </span>
              </div>
              <div style={{ borderRadius: 6, border: `1px solid ${T.border}`, overflow: 'hidden', marginBottom: 8, background: T.surface }}>
                <div style={{ padding: '5px 12px', borderBottom: `1px solid ${T.border}`, fontSize: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.textFaint }}>Required</div>
                {cfg.required.map(f => (
                  <FieldRow key={f.key} label={f.label} required value={fieldMap[f.key] || ''} columns={columns} onChange={(v: string) => setFieldMap(m => ({ ...m, [f.key]: v }))} showError={validated} />
                ))}
              </div>
              <div style={{ borderRadius: 6, border: `1px solid ${T.border}`, overflow: 'hidden', background: T.surface }}>
                <button onClick={() => setShowOpt(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 12px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <span style={{ fontSize: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.textFaint }}>Optional Fields</span>
                  {showOpt ? <ChevronUp size={10} color={T.textFaint} /> : <ChevronDown size={10} color={T.textFaint} />}
                </button>
                {showOpt && cfg.optional.map(f => (
                  <FieldRow key={f.key} label={f.label} value={fieldMap[f.key] || ''} columns={columns} onChange={(v: string) => setFieldMap(m => ({ ...m, [f.key]: v }))} showError={false} />
                ))}
              </div>
              {validated && Object.keys(errors).length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <WarningBar error text={`Map required fields: ${cfg.required.filter(f => errors[f.key]).map(f => f.label).join(', ')}`} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Run button */}
        <div style={{ padding: 14, borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
          {runErr && <div style={{ marginBottom: 8 }}><WarningBar text={runErr} error /></div>}
          <button onClick={runAnalysis} disabled={!step1 || !step2 || running} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontWeight: 600, fontSize: 13, padding: '11px 0', borderRadius: 6, border: 'none',
            cursor: canRun ? 'pointer' : 'not-allowed',
            background: canRun ? T.accentSoft : T.surface2,
            color: canRun ? T.accent : T.textFaint,
            transition: 'all 0.15s',
          }}>
            {running
              ? <Loader2 size={13} color={canRun ? T.accent : T.textFaint} className="spin" />
              : <Zap size={13} />}
            {running ? 'Analyzing…' : 'Run Analysis'}
          </button>
          {running && <UploadTimer active={running} />}
          {results && !running && (
            isAdmin ? (
              <button onClick={downloadCSV} style={{ width: '100%', marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: `1px solid ${T.border}`, color: T.textMuted, fontWeight: 500, fontSize: 11, padding: '7px 0', borderRadius: 6, background: 'transparent', cursor: 'pointer' }}>
                <Download size={11} /> Export CSV
              </button>
            ) : (
              <button onClick={() => router.push('/dashboard/upgrade')} style={{ width: '100%', marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: `1px solid ${T.border}`, color: T.textFaint, fontWeight: 500, fontSize: 11, padding: '7px 0', borderRadius: 6, background: 'transparent', cursor: 'pointer' }}>
                <Lock size={11} /> Export
                <span style={{ marginLeft: 'auto', fontSize: 9, background: T.warningSoft, color: T.warning, border: `1px solid ${T.warning}30`, padding: '1px 6px', borderRadius: 10 }}>PRO</span>
              </button>
            )
          )}
          {!results && !running && (
            <button disabled style={{ width: '100%', marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: `1px solid ${T.border}`, color: T.textFaint, fontWeight: 500, fontSize: 11, padding: '7px 0', borderRadius: 6, background: 'transparent', cursor: 'not-allowed', opacity: 0.5 }}>
              <Lock size={11} /> Export
              <span style={{ marginLeft: 'auto', fontSize: 9, background: T.surface3, color: T.textFaint, padding: '1px 6px', borderRadius: 10 }}>PRO</span>
            </button>
          )}
        </div>
      </aside>

      {/* ══ RIGHT PANEL ═══════════════════════════════════════════════════ */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: T.bg }}>

        {/* ── PAGE HEADER ─────────────────────────────────────────────── */}
        <header style={{ flexShrink: 0, borderBottom: `1px solid ${T.border}`, background: T.surface }}>

          {/* Row 1: Title + controls */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px', height: 48, gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text, letterSpacing: '-0.01em', flexShrink: 0 }}>
              Customer Analytics
            </div>
            <div style={{ flex: 1 }} />

            {/* MRR/ACV controls */}
            {results && !isCohort && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>

                {/* Period selector — pill strip if available */}
                {availablePeriods.length > 0 && availablePeriods.length <= 24 ? (
                  <div style={{ display: 'flex', background: T.bg, borderRadius: 5, border: `1px solid ${T.border}`, overflow: 'hidden', height: 28, maxWidth: 320, overflowX: 'auto' }}>
                    <FilterPill label="All" active={!selPeriod} onClick={() => setSelPeriod('')} />
                    {availablePeriods.slice(-12).map(p => (
                      <FilterPill key={p} label={p} active={selPeriod === p} onClick={() => setSelPeriod(p)} />
                    ))}
                  </div>
                ) : availablePeriods.length > 24 ? (
                  <select
                    value={selPeriod}
                    onChange={e => setSelPeriod(e.target.value)}
                    style={{ height: 28, fontSize: 11, border: `1px solid ${T.border}`, borderRadius: 5, padding: '0 8px', background: T.bg, color: T.textMuted, outline: 'none', cursor: 'pointer', fontFamily: T.sans }}
                  >
                    <option value="">All periods</option>
                    {availablePeriods.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                ) : null}

                <div style={{ width: 1, height: 16, background: T.border }} />

                {/* YoY / QoQ */}
                <PillGroup>
                  {[['Annual', 'YoY'], ['Quarter', 'QoQ']].map(([val, lbl]) => (
                    <FilterPill key={val} label={lbl} active={periodType === val} onClick={() => applyPeriodType(val)} disabled={rerunning} />
                  ))}
                </PillGroup>

                <div style={{ width: 1, height: 16, background: T.border }} />

                {/* Lookback */}
                <PillGroup>
                  {lookbacks.map(l => (
                    <FilterPill key={l} label={`${l}M`} active={selLb === l} onClick={() => setSelLb(l)} />
                  ))}
                </PillGroup>

                <div style={{ width: 1, height: 16, background: T.border }} />

                {/* Dimension */}
                <PillGroup>
                  {[
                    { key: 'customer', label: 'Customer' },
                    { key: 'product',  label: '× Product', available: !!fieldMap.product },
                    { key: 'region',   label: '× Region',  available: !!fieldMap.region },
                  ].map(opt => (
                    <FilterPill
                      key={opt.key}
                      label={opt.label}
                      active={selDims === opt.key}
                      onClick={() => opt.available !== false && !rerunning && applyDimFilter(opt.key)}
                      disabled={opt.available === false || rerunning}
                    />
                  ))}
                </PillGroup>

                {rerunning && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: T.textFaint }}>
                    <Loader2 size={11} className="spin" /> Updating…
                  </div>
                )}

                <div style={{ width: 1, height: 16, background: T.border }} />

                {/* Reset */}
                <button
                  onClick={() => { setResults(null); setFile(null); setColumns([]); setEngine(null); setFieldMap({}); setSelDims('customer'); setSelPeriod('') }}
                  title="Reset"
                  style={{ height: 28, width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, border: `1px solid ${T.border}`, background: 'transparent', cursor: 'pointer', color: T.textFaint }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.text }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.textFaint }}
                >
                  <RefreshCw size={11} />
                </button>

                {/* Export */}
                {isAdmin ? (
                  <button onClick={downloadCSV} style={{ height: 28, display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500, padding: '0 12px', borderRadius: 5, border: `1px solid ${T.border}`, cursor: 'pointer', background: T.surface2, color: T.textMuted }}>
                    <Download size={11} /> Export
                  </button>
                ) : (
                  <button onClick={() => router.push('/dashboard/upgrade')} style={{ height: 28, display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 400, color: T.textFaint, border: `1px solid ${T.border}`, padding: '0 12px', borderRadius: 5, background: 'transparent', cursor: 'pointer' }}>
                    <Lock size={11} /> Upgrade
                  </button>
                )}
              </div>
            )}

            {/* Cohort controls */}
            {results && isCohort && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => { setResults(null); setFile(null); setColumns([]); setEngine(null); setFieldMap({}) }}
                  title="Reset"
                  style={{ height: 28, width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, border: `1px solid ${T.border}`, background: 'transparent', cursor: 'pointer', color: T.textFaint }}
                >
                  <RefreshCw size={11} />
                </button>
                {isAdmin && (
                  <button onClick={downloadCSV} style={{ height: 28, display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500, padding: '0 12px', borderRadius: 5, border: `1px solid ${T.border}`, cursor: 'pointer', background: T.surface2, color: T.textMuted }}>
                    <Download size={11} /> Export
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Row 2: Tab navigation */}
          {results && (
            <TabSwitch
              tabs={TABS}
              active={activeTab}
              onChange={id => {
                setActiveTab(id)
                if (id === 'cohort_heatmap' && !cohortResults && !cohortRunning && file && fieldMap.customer && fieldMap.date && fieldMap.revenue) {
                  runInlineCohort()
                }
              }}
            />
          )}
        </header>

        {/* ── EMPTY STATE ───────────────────────────────────────────────── */}
        {!results && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <div style={{ textAlign: 'center', maxWidth: 480 }}>
              <div style={{ width: 72, height: 72, borderRadius: 18, border: `1px solid ${T.border}`, background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <BarChart3 size={26} color={T.textFaint} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                {engine ? ENGINE_CONFIG[engine].label : 'Revenue Analytics'}
              </h2>
              <p style={{ color: T.textMuted, fontSize: 13, marginBottom: 32, lineHeight: 1.7 }}>
                {engine === 'cohort'
                  ? 'Upload data, map fields, then run to see retention heatmaps.'
                  : engine
                    ? 'Upload data, map fields, and run the analysis.'
                    : 'Upload subscription data, select an engine, and get instant insights.'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {(engine === 'cohort' ? [
                  { icon: Layers,     label: 'Retention Heatmap', desc: '% retention by cohort' },
                  { icon: DollarSign, label: 'Revenue Heatmap',   desc: 'Revenue by cohort period' },
                  { icon: Users,      label: 'Segmentation',      desc: 'Size / Percentile / Revenue' },
                ] : [
                  { icon: TrendingUp, label: 'Revenue Bridge',    desc: 'Waterfall with all drivers' },
                  { icon: Target,     label: 'Top Movers',        desc: 'Expansion & churn accounts' },
                  { icon: Activity,   label: 'Retention Trends',  desc: 'NRR, GRR over time' },
                ]).map((m, i) => (
                  <div key={i} style={{ padding: 14, borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, textAlign: 'left' }}>
                    <m.icon size={14} color={T.textFaint} style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 3 }}>{m.label}</div>
                    <div style={{ fontSize: 10, color: T.textFaint }}>{m.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── RESULTS ──────────────────────────────────────────────────── */}
        {results && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            {/* KPI Strip */}
            <div style={{ padding: '12px 24px', borderBottom: `1px solid ${T.border}`, background: T.bg, flexShrink: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
                {isCohort ? (<>
                  <KpiBlock label="Total Revenue"  value={fmt(results.summary?.total_revenue)} />
                  <KpiBlock label="Customers"      value={(results.summary?.n_customers || 0).toLocaleString()} />
                  <KpiBlock label="Rev / Customer" value={fmt(results.summary?.rev_per_customer)} />
                  <KpiBlock label="Rows Analyzed"  value={(results.summary?.rows_analyzed || 0).toLocaleString()} />
                  <KpiBlock label="Cohort Columns" value={(results.summary?.cohort_cols?.length || 0).toString()} />
                  <KpiBlock label="Fiscal Years"   value={(results.fiscal_years?.length || 0).toString()} />
                </>) : (<>
                  <KpiBlock label="Starting ARR"
                    value={fmt(toARR(retD?.beginning))}
                  />
                  <KpiBlock label="Ending ARR"
                    value={fmt(toARR(retD?.ending))}
                    delta={retD?.beginning > 0 ? `${((((retD?.ending || 0) - (retD?.beginning || 0)) / (retD?.beginning || 1)) * 100).toFixed(1)}%` : null}
                    deltaGood={(retD?.ending || 0) >= (retD?.beginning || 0)}
                  />
                  <KpiBlock label="New ARR"
                    value={fmt(toARR(retD?.new_arr))}
                    delta={retD?.new_arr > 0 ? `+${fmt(retD?.new_arr)}` : null}
                    deltaGood={true}
                  />
                  <KpiBlock label="Lost ARR"
                    value={fmt(Math.abs(toARR(retD?.lost_arr) || 0))}
                    delta={retD?.lost_arr < 0 ? fmt(retD?.lost_arr) : null}
                    deltaGood={false}
                  />
                  <KpiBlock label="Net Retention"
                    value={fmtPct(retD?.nrr)}
                    sub={(retD?.nrr || 0) >= 100 ? 'Healthy' : 'At Risk'}
                    deltaGood={(retD?.nrr || 0) >= 100}
                  />
                  <KpiBlock label="Gross Retention"
                    value={fmtPct(retD?.grr)}
                    sub={(retD?.grr || 0) >= 80 ? 'Strong' : 'Alert'}
                    deltaGood={(retD?.grr || 0) >= 80}
                  />
                </>)}
              </div>
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: T.bg }}>

              {/* ── COHORT: Heatmap ────────────────────────────────────── */}
              {isCohort && activeTab === 'heatmap' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ ...S.card }}><CohortHeatmap data={results.retention} title="Retention Rate % by Cohort" isPercent={true} /></div>
                  {results.heatmap?.length > 0 && <div style={{ ...S.card }}><CohortHeatmap data={results.heatmap} title="Customer Count by Cohort" isPercent={false} /></div>}
                </div>
              )}

              {/* ── COHORT: Revenue ────────────────────────────────────── */}
              {isCohort && activeTab === 'revenue_heatmap' && (
                <div>
                  {results.fy_summary?.length > 0 ? (
                    <div style={{ ...S.card }}>
                      <div style={{ ...S.label, marginBottom: 20 }}>Revenue by Fiscal Year</div>
                      <div style={{ height: 220, marginBottom: 24 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={results.fy_summary}>
                            <CartesianGrid strokeDasharray="2 4" stroke={T.surface3} vertical={false} />
                            <XAxis dataKey={Object.keys(results.fy_summary[0])[0]} tick={{ fontSize: 10, fill: T.textFaint }} axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: T.textFaint }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, color: T.text }} />
                            <Bar dataKey="revenue" fill={T.positive} radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                        <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{['FY', 'Revenue', 'Customers', 'Rev/Customer'].map(h => <th key={h} style={{ ...S.th }}>{h}</th>)}</tr></thead>
                        <tbody>{results.fy_summary.map((row: any, i: number) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                            <td style={{ ...S.td, color: T.text, fontWeight: 600 }}>{String(Object.values(row)[0])}</td>
                            <td style={{ ...S.td, ...S.mono, color: T.positive, fontWeight: 600 }}>{fmt(row.revenue)}</td>
                            <td style={{ ...S.td, ...S.mono }}>{row.customers?.toLocaleString()}</td>
                            <td style={{ ...S.td, ...S.mono }}>{fmt(row.rev_per_customer)}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  ) : <div style={{ ...S.card, textAlign: 'center', color: T.textFaint, fontSize: 13, padding: 40 }}>No fiscal year data. Ensure Fiscal Year column is mapped.</div>}
                </div>
              )}

              {/* ── COHORT: Segmentation ───────────────────────────────── */}
              {isCohort && activeTab === 'segmentation' && results.segmentation?.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ ...S.card }}>
                    <div style={{ ...S.label, marginBottom: 16 }}>Revenue Segmentation</div>
                    <div style={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={results.segmentation} dataKey={Object.keys(results.segmentation[0]).find((k: string) => k !== 'segment') || ''} nameKey="segment" cx="50%" cy="50%" outerRadius={80} innerRadius={36}>
                            {results.segmentation.map((_: any, i: number) => <Cell key={i} fill={[T.accent, T.positive, T.neutral, T.negative, T.warning, T.textMuted][i % 6]} />)}
                          </Pie>
                          <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 6 }} />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: T.textMuted }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* ── COHORT: Summary ────────────────────────────────────── */}
              {isCohort && activeTab === 'summary' && results.fy_summary?.length > 0 && (
                <div style={{ ...S.card }}>
                  <div style={{ ...S.label, marginBottom: 16 }}>Summary by Fiscal Year</div>
                  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                    <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{['FY', 'Revenue', 'Customers', 'Rev/Customer'].map(h => <th key={h} style={{ ...S.th }}>{h}</th>)}</tr></thead>
                    <tbody>{results.fy_summary.map((row: any, i: number) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                        <td style={{ ...S.td, color: T.text, fontWeight: 600 }}>{String(Object.values(row)[0])}</td>
                        <td style={{ ...S.td, ...S.mono, color: T.positive, fontWeight: 600 }}>{fmt(row.revenue)}</td>
                        <td style={{ ...S.td, ...S.mono }}>{row.customers?.toLocaleString()}</td>
                        <td style={{ ...S.td, ...S.mono }}>{fmt(row.rev_per_customer)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}

              {/* ── MRR: SUMMARY ──────────────────────────────────────── */}
              {!isCohort && activeTab === 'summary' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Narrative */}
                  {narrative && <NarrativeBar text={narrative} />}

                  {/* Metadata chip */}
                  {results?.metadata && (
                    <div style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.surface, display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}>
                      <span style={{ fontSize: 11, color: T.text, fontWeight: 500 }}>
                        {results.metadata.dimensions?.length > 0 ? `Customer × ${results.metadata.dimensions.join(' × ')}` : 'Customer level'}
                      </span>
                      <span style={{ color: T.border }}>·</span>
                      <span style={{ fontSize: 11, color: T.textMuted }}>{results.metadata.row_count?.toLocaleString()} rows</span>
                    </div>
                  )}

                  {/* Reconciliation warning */}
                  {bridgeOk && !bridgeOk.valid && (
                    <WarningBar text={`Reconciliation gap: movements sum ${fmt(bridgeOk.total)}, expected ${fmt(bridgeOk.expected)} (Δ ${fmt(Math.abs(bridgeOk.diff))})`} />
                  )}

                  {/* Bridge chart */}
                  <div style={{ ...S.cardF }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${T.border}` }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, letterSpacing: '-0.01em' }}>
                          ARR Bridge: {periodType === 'Annual' ? 'YoY' : 'QoQ'} · {selLb}M{selPeriod ? ` · ${selPeriod}` : ''}
                        </div>
                        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>Movement from beginning to ending ARR</div>
                      </div>
                      {/* Legend */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10, color: T.textFaint }}>
                        {[['Expansion', T.positive], ['Contraction', T.negative], ['Baseline', T.accent]].map(([lbl, col]) => (
                          <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: col, display: 'inline-block' }} />
                            {lbl}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ padding: '16px 20px 8px' }}>
                      {(() => {
                        const movements = selectedWfall.filter(r => !['Beginning MRR', 'Ending MRR', 'Beginning ARR', 'Ending ARR'].includes(r.category))
                        const beginning = { category: 'Beginning ARR', value: toARR(retD?.beginning) || 0 }
                        const ending    = { category: 'Ending ARR',    value: toARR(retD?.ending) || 0 }
                        const fullData  = [beginning, ...movements, ending]
                        return <WaterfallBridge data={fullData} showBoundary={true} />
                      })()}
                    </div>
                  </div>

                  {/* Movement Breakdown table */}
                  <div style={{ ...S.cardF }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Movement Breakdown</div>
                      {isAdmin && (
                        <button onClick={downloadCSV} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: T.textMuted, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
                          <Download size={11} /> Export
                        </button>
                      )}
                    </div>
                    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: T.surface2 }}>
                          {['Category', 'Count', 'ARR Impact', '% of Total'].map((h, i) => (
                            <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '9px 20px', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textFaint, borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedWfall
                          .filter(r => !['Beginning ARR', 'Ending ARR', 'Beginning MRR', 'Ending MRR'].includes(r.category))
                          .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
                          .map((row, i) => {
                            const total  = selectedWfall.filter(r => !['Beginning ARR', 'Ending ARR', 'Beginning MRR', 'Ending MRR'].includes(r.category)).reduce((s, r) => s + Math.abs(r.value), 0)
                            const isPos  = row.value >= 0
                            return (
                              <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.surface2 }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                                <td style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: BC[row.category] || T.neutral, flexShrink: 0 }} />
                                  <span style={{ fontWeight: 500, color: T.text, fontSize: 12 }}>{row.category}</span>
                                </td>
                                <td style={{ textAlign: 'right', padding: '10px 20px', ...S.mono, fontSize: 12, color: T.textMuted }}>
                                  {row.count != null ? row.count.toLocaleString() : '—'}
                                </td>
                                <td style={{ textAlign: 'right', padding: '10px 20px', fontWeight: 600, fontSize: 12, ...S.mono, color: isPos ? T.positive : T.negative }}>
                                  {isPos ? '+' : ''}{fmt(row.value)}
                                </td>
                                <td style={{ textAlign: 'right', padding: '10px 20px', fontSize: 12, ...S.mono, color: T.textMuted }}>
                                  {total > 0 ? `${isPos ? '+' : ''}${((row.value / total) * 100).toFixed(1)}%` : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        {/* Total row */}
                        {selectedWfall.length > 0 && (() => {
                          const mvts        = selectedWfall.filter(r => !['Beginning ARR', 'Ending ARR', 'Beginning MRR', 'Ending MRR'].includes(r.category))
                          const totalImpact = mvts.reduce((s, r) => s + r.value, 0)
                          const totalCount  = mvts.reduce((s, r) => s + (r.count || 0), 0)
                          const totalAbs    = mvts.reduce((s, r) => s + Math.abs(r.value), 0)
                          return (
                            <tr style={{ background: T.surface2, borderTop: `1px solid ${T.borderStrong}` }}>
                              <td style={{ padding: '10px 20px', fontWeight: 600, color: T.text, fontSize: 12 }}>Total Bridge Impact</td>
                              <td style={{ textAlign: 'right', padding: '10px 20px', ...S.mono, fontSize: 12, fontWeight: 600, color: T.text }}>{totalCount > 0 ? totalCount.toLocaleString() : '—'}</td>
                              <td style={{ textAlign: 'right', padding: '10px 20px', fontWeight: 700, fontSize: 12, ...S.mono, color: totalImpact >= 0 ? T.positive : T.negative }}>
                                {totalImpact >= 0 ? '+' : ''}{fmt(totalImpact)}
                              </td>
                              <td style={{ textAlign: 'right', padding: '10px 20px', fontSize: 12, ...S.mono, fontWeight: 600, color: T.textMuted }}>
                                {totalAbs > 0 ? `${((totalImpact / totalAbs) * 100).toFixed(1)}%` : '—'}
                              </td>
                            </tr>
                          )
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* Pivot tables */}
                  {results?.pivot?.[String(selLb)]?.bridge_pivot && (
                    <div style={{ ...S.card }}>
                      <BridgePivotTable pivot={results.pivot[String(selLb)].bridge_pivot} title="ARR Waterfall" lookbackLabel={`${selLb}M Lookback`} showPct={false} />
                      <CustomerCountPivot pivot={results.pivot[String(selLb)].customer_pivot} />
                    </div>
                  )}
                  {results?.pivot?.['12']?.bridge_pivot && selLb !== 12 && (
                    <div style={{ ...S.card }}>
                      <BridgePivotTable pivot={results.pivot['12'].bridge_pivot} title="ARR Waterfall" lookbackLabel="YoY (12M)" showPct={true} />
                      <CustomerCountPivot pivot={results.pivot['12'].customer_pivot} />
                    </div>
                  )}

                  {/* Bridge trend chart */}
                  {bdg?.by_period?.length > 0 && (
                    <div style={{ ...S.card }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ ...S.label }}>Bridge Trend Over Time</div>
                        <span style={{ fontSize: 10, color: T.textFaint }}>{periodType} · {selLb}M lookback</span>
                      </div>
                      <div style={{ height: 240 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={bdg.by_period} margin={{ left: 8, right: 8, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="2 4" stroke={T.surface3} vertical={false} />
                            <XAxis dataKey="_period" tick={{ fontSize: 10, fill: T.textFaint }} axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: T.textFaint }} width={48} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 11, color: T.text }} />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: 10, color: T.textMuted }} />
                            {['New Logo', 'Upsell', 'Cross-sell', 'Returning', 'Downsell', 'Churn', 'Churn Partial'].map(cat => (
                              <Bar key={cat} dataKey={cat} stackId="a" fill={BC[cat] || T.neutral} name={cat} />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── MRR: DETAILED BRIDGE / RETENTION ──────────────────── */}
              {!isCohort && activeTab === 'retention_trend' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {kpiRows.length > 0 && (
                    <div style={{ ...S.card }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ ...S.label }}>Retention Trends</div>
                        <div style={{ display: 'flex', gap: 14, fontSize: 10, color: T.textFaint }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 14, height: 2, background: T.accent, display: 'inline-block' }} />NRR</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 14, height: 2, background: T.positive, display: 'inline-block' }} />GRR</span>
                        </div>
                      </div>
                      <div style={{ height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={kpiRows} margin={{ left: 8, right: 8 }}>
                            <defs>
                              <linearGradient id="nG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.accent} stopOpacity={0.2} /><stop offset="95%" stopColor={T.accent} stopOpacity={0} /></linearGradient>
                              <linearGradient id="gG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.positive} stopOpacity={0.15} /><stop offset="95%" stopColor={T.positive} stopOpacity={0} /></linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="2 4" stroke={T.surface3} vertical={false} />
                            <XAxis dataKey="period" tick={{ fontSize: 10, fill: T.textFaint }} axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: T.textFaint }} domain={[0, 130]} width={40} axisLine={false} tickLine={false} />
                            <ReferenceLine y={100} stroke={T.border} strokeDasharray="4 4" />
                            <Tooltip formatter={(v: any) => `${Number(v).toFixed(1)}%`} contentStyle={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 11, color: T.text }} />
                            <Area type="monotone" dataKey="nrr" stroke={T.accent} strokeWidth={1.5} fill="url(#nG)" dot={{ r: 2, fill: T.accent }} name="NRR" />
                            <Area type="monotone" dataKey="grr" stroke={T.positive} strokeWidth={1.5} fill="url(#gG)" dot={{ r: 2, fill: T.positive }} name="GRR" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  {kpiRows.length > 0 && (
                    <div style={{ ...S.cardF }}>
                      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                        <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
                          {['Period', 'Beginning ARR', 'Ending ARR', 'New Logo', 'Upsell', 'Downsell', 'Churn', 'GRR', 'NRR'].map(h => (
                            <th key={h} style={{ ...S.th }}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>{kpiRows.map((row: any, i: number) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                            <td style={{ ...S.td, ...S.mono, color: T.text, fontWeight: 600 }}>{row.period}</td>
                            <td style={{ ...S.td, ...S.mono }}>{fmt(row.beginning)}</td>
                            <td style={{ ...S.td, ...S.mono }}>{fmt(row.ending)}</td>
                            <td style={{ ...S.td, ...S.mono, color: T.positive, fontWeight: 500 }}>{row.new_logo ? `+${fmt(row.new_logo)}` : '—'}</td>
                            <td style={{ ...S.td, ...S.mono, color: T.positive }}>{row.upsell ? `+${fmt(row.upsell)}` : '—'}</td>
                            <td style={{ ...S.td, ...S.mono }}>{row.downsell ? fmt(row.downsell) : '—'}</td>
                            <td style={{ ...S.td, ...S.mono, color: T.negative, fontWeight: 500 }}>{row.churn ? fmt(row.churn) : '—'}</td>
                            <td style={{ ...S.td, ...S.mono, fontWeight: 700, color: (row.grr || 0) >= 80 ? T.positive : T.negative }}>{fmtPct(row.grr)}</td>
                            <td style={{ ...S.td, ...S.mono, fontWeight: 700, color: (row.nrr || 0) >= 100 ? T.positive : T.neutral }}>{fmtPct(row.nrr)}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── COHORT HEATMAP (inline in MRR) ─────────────────────── */}
              {!isCohort && activeTab === 'cohort_heatmap' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <NarrativeBar text="Shows customer retention by acquisition cohort. Uses your already-mapped Customer, Date and Revenue columns." />
                  {cohortRunning && (
                    <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 10, padding: '20px 24px' }}>
                      <Loader2 size={14} color={T.accent} className="spin" />
                      <span style={{ fontSize: 12, color: T.textMuted }}>Running cohort analysis…</span>
                    </div>
                  )}
                  {cohortErr && <WarningBar text={cohortErr} error />}
                  {!cohortResults && !cohortRunning && !cohortErr && (
                    <div style={{ ...S.card, textAlign: 'center', padding: 40 }}>
                      <button
                        onClick={runInlineCohort}
                        style={{ padding: '10px 20px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.surface2, color: T.text, fontSize: 12, cursor: 'pointer', fontFamily: T.sans }}
                      >
                        Run Cohort Analysis
                      </button>
                    </div>
                  )}
                  {cohortResults && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {cohortResults.retention?.length > 0 && (
                        <div style={{ ...S.card }}><CohortHeatmap data={cohortResults.retention} title="Retention Rate % by Cohort" isPercent={true} /></div>
                      )}
                      {cohortResults.heatmap?.length > 0 && (
                        <div style={{ ...S.card }}><CohortHeatmap data={cohortResults.heatmap} title="Customer Count by Cohort" isPercent={false} /></div>
                      )}
                      {cohortResults.fy_summary?.length > 0 && (
                        <div style={{ ...S.card }}>
                          <div style={{ ...S.label, marginBottom: 16 }}>Summary by Period</div>
                          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                            <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
                              {['Period', 'Revenue', 'Customers', 'Rev/Customer'].map(h => (
                                <th key={h} style={{ ...S.th }}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>{cohortResults.fy_summary.map((row: any, i: number) => (
                              <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                                <td style={{ ...S.td, color: T.text, fontWeight: 500 }}>{String(Object.values(row)[0])}</td>
                                <td style={{ ...S.td, ...S.mono, color: T.positive }}>{fmt(toARR(row.revenue))}</td>
                                <td style={{ ...S.td, ...S.mono }}>{row.customers?.toLocaleString()}</td>
                                <td style={{ ...S.td, ...S.mono }}>{fmt(toARR(row.rev_per_customer))}</td>
                              </tr>
                            ))}</tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── MRR: TOP MOVERS ───────────────────────────────────── */}
              {!isCohort && activeTab === 'top_movers' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Aggregate stats */}
                  {(expansionList.length > 0 || churnList.length > 0) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      <div style={{ ...S.card }}>
                        <div style={{ ...S.label, marginBottom: 8 }}>Aggregate Expansion</div>
                        <div style={{ fontFamily: T.mono, fontSize: 22, fontWeight: 600, color: T.positive, letterSpacing: '-0.02em' }}>
                          {fmt(expansionList.reduce((s, r) => s + Math.abs(getMoverValue(r, r._cat || moverCat) || 0), 0))}
                        </div>
                        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 4 }}>{expansionList.length} expansion accounts</div>
                      </div>
                      <div style={{ ...S.card }}>
                        <div style={{ ...S.label, marginBottom: 8 }}>Net Churn Velocity</div>
                        <div style={{ fontFamily: T.mono, fontSize: 22, fontWeight: 600, color: T.negative, letterSpacing: '-0.02em' }}>
                          {fmt(churnList.reduce((s, r) => s + Math.abs(getMoverValue(r, r._cat || moverCat) || 0), 0))}
                        </div>
                        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 4 }}>{churnList.length} at-risk accounts</div>
                      </div>
                      <div style={{ ...S.card }}>
                        <div style={{ ...S.label, marginBottom: 8 }}>Analysis Period</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginTop: 4 }}>{periodType === 'Annual' ? 'YoY' : 'QoQ'} · {selLb}M</div>
                        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 4 }}>{selPeriod || 'All periods'}</div>
                      </div>
                    </div>
                  )}

                  {/* Two-column mover panels */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

                    {/* Expansion */}
                    <div style={{ ...S.cardF }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: `1px solid ${T.border}`, background: T.surface2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: 6, background: T.positiveSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <TrendingUp size={12} color={T.positive} />
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: T.positive }}>Expansion</div>
                            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textFaint }}>High upsell potential</div>
                          </div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 600, background: T.positiveSoft, color: T.positive, border: `1px solid ${T.positive}30`, padding: '2px 9px', borderRadius: 20 }}>
                          {expansionList.length}
                        </span>
                      </div>
                      <div style={{ padding: 10, maxHeight: 520, overflowY: 'auto' }}>
                        {expansionList.length
                          ? expansionList.map((row, i) => {
                              const cat  = row._cat || moverCat
                              const val  = getMoverValue(row, cat)
                              const cust = getMoverCustomer(row)
                              const per  = getMoverPeriod(row)
                              return (
                                <MoverCard key={i} customer={cust} value={val} period={per} isRisk={false} rank={i}
                                  arr={row.arr || row.ending_arr || Math.abs(val) * 6}
                                  health={row.health}
                                  segment={row.segment || row.channel || row.product || row.Region || row.Channel}
                                />
                              )
                            })
                          : <div style={{ textAlign: 'center', color: T.textFaint, fontSize: 12, padding: 28 }}>No expansion data for selected lookback</div>
                        }
                      </div>
                      {expansionList.length > 0 && (
                        <div style={{ padding: '8px 14px', borderTop: `1px solid ${T.border}`, textAlign: 'center' }}>
                          <span style={{ fontSize: 11, color: T.textMuted, cursor: 'pointer' }}>View all {expansionList.length} opportunities →</span>
                        </div>
                      )}
                    </div>

                    {/* Churn Risk */}
                    <div style={{ ...S.cardF }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: `1px solid ${T.border}`, background: T.surface2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: 6, background: T.negativeSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <TrendingDown size={12} color={T.negative} />
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: T.negative }}>Churn Risk</div>
                            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textFaint }}>Priority interventions</div>
                          </div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 600, background: T.negativeSoft, color: T.negative, border: `1px solid ${T.negative}30`, padding: '2px 9px', borderRadius: 20 }}>
                          {churnList.length}
                        </span>
                      </div>
                      <div style={{ padding: 10, maxHeight: 520, overflowY: 'auto' }}>
                        {churnList.length
                          ? churnList.map((row, i) => {
                              const cat  = row._cat || moverCat
                              const val  = getMoverValue(row, cat)
                              const cust = getMoverCustomer(row)
                              const per  = getMoverPeriod(row)
                              return (
                                <MoverCard key={i} customer={cust} value={val} period={per} isRisk={true} rank={i}
                                  arr={row.arr || row.ending_arr || Math.abs(val) * 6}
                                  health={row.health}
                                  segment={row.segment || row.channel || row.product || row.Region || row.Channel}
                                />
                              )
                            })
                          : <div style={{ textAlign: 'center', color: T.textFaint, fontSize: 12, padding: 28 }}>No churn data for selected lookback</div>
                        }
                      </div>
                      {churnList.length > 0 && (
                        <div style={{ padding: '8px 14px', borderTop: `1px solid ${T.border}`, textAlign: 'center' }}>
                          <span style={{ fontSize: 11, color: T.textMuted, cursor: 'pointer' }}>View all {churnList.length} at-risk accounts →</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* All movers by category */}
                  {Object.keys(movers).length > 0 && (
                    <div style={{ ...S.cardF }}>
                      {/* Category filter tabs */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 14px', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap', background: T.surface2 }}>
                        <span style={{ ...S.label, marginRight: 6 }}>Filter</span>
                        {Object.keys(movers).map(cat => (
                          <button key={cat} onClick={() => setMoverCat(cat)} style={{
                            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                            border: `1px solid ${moverCat === cat ? `${T.accent}40` : T.border}`,
                            background: moverCat === cat ? T.accentSoft : 'transparent',
                            color: moverCat === cat ? T.accent : T.textMuted, cursor: 'pointer', transition: 'all 0.12s',
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: BC[cat] || T.neutral, flexShrink: 0 }} />
                            {cat}
                            <span style={{ fontSize: 9, background: T.surface3, color: T.textFaint, padding: '1px 5px', borderRadius: 10 }}>{(movers[cat] || []).length}</span>
                          </button>
                        ))}
                      </div>
                      {/* Table */}
                      {moverCat && movers[moverCat]?.length > 0 && (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                                {Object.keys(movers[moverCat][0]).filter(k => k !== 'value' && k !== 'period' && k !== 'health' && k !== 'segment').map(k => (
                                  <th key={k} style={{ ...S.th }}>{k}</th>
                                ))}
                                <th style={{ ...S.th, textAlign: 'right' }}>Period</th>
                                <th style={{ ...S.th, textAlign: 'right' }}>ARR Impact</th>
                              </tr>
                            </thead>
                            <tbody>
                              {movers[moverCat].slice(0, 30).map((row: any, i: number) => (
                                <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.surface2 }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                                  {Object.keys(row).filter(k => k !== 'value' && k !== 'period' && k !== 'health' && k !== 'segment').map(k => (
                                    <td key={k} style={{ ...S.td, color: T.text }}>{row[k] ?? '—'}</td>
                                  ))}
                                  <td style={{ textAlign: 'right', ...S.td, ...S.mono, color: T.textFaint }}>{row.period || '—'}</td>
                                  <td style={{ textAlign: 'right', ...S.td, ...S.mono, fontWeight: 600, color: getMoverValue(row, moverCat) >= 0 ? T.positive : T.negative }}>
                                    {getMoverValue(row, moverCat) >= 0 ? '+' : ''}{fmt(getMoverValue(row, moverCat))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── MRR: TOP CUSTOMERS ─────────────────────────────────── */}
              {!isCohort && activeTab === 'top_customers' && (
                <div style={{ ...S.cardF }}>
                  <SectionHeader>Top Customers by Ending ARR</SectionHeader>
                  {topCusts.length > 0 ? (
                    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                      <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
                        <th style={{ ...S.th }}>#</th>
                        {Object.keys(topCusts[0]).map(k => <th key={k} style={{ ...S.th }}>{k}</th>)}
                      </tr></thead>
                      <tbody>{topCusts.map((row: any, i: number) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.surface2 }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                          <td style={{ ...S.td, color: T.textFaint, fontWeight: 600, fontFamily: T.mono }}>#{i + 1}</td>
                          {Object.values(row).map((val: any, j) => (
                            <td key={j} style={{ ...S.td, color: typeof val === 'number' ? T.text : T.textMuted, fontWeight: typeof val === 'number' ? 600 : 400, fontFamily: typeof val === 'number' ? T.mono : T.sans }}>
                              {typeof val === 'number' ? fmt(val) : val ?? '—'}
                            </td>
                          ))}
                        </tr>
                      ))}</tbody>
                    </table>
                  ) : <div style={{ padding: 40, textAlign: 'center', color: T.textFaint, fontSize: 13 }}>No customer data available.</div>}
                </div>
              )}

              {/* ── MRR: KPI MATRIX ────────────────────────────────────── */}
              {!isCohort && activeTab === 'kpi_matrix' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {lookbacks.map(lb => {
                    const kpiData = results?.pivot?.[String(lb)]?.kpi_table
                    if (!kpiData?.length) return null
                    return (
                      <div key={lb} style={{ ...S.card }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                          <div style={{ ...S.label }}>KPI Summary</div>
                          <span style={{ fontSize: 9, background: T.surface2, color: T.textFaint, border: `1px solid ${T.border}`, padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>{lb}M Lookback</span>
                        </div>
                        <KpiSummaryTable rows={kpiData} />
                      </div>
                    )
                  })}
                  {!results?.pivot && kpiRows.length > 0 && (
                    <div style={{ ...S.cardF }}>
                      <SectionHeader>KPI Matrix — {periodType}</SectionHeader>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                          <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
                            {['Period', 'Beginning ARR', 'Ending ARR', 'New Logo', 'Upsell', 'Downsell', 'Churn', 'GRR', 'NRR'].map(h => (
                              <th key={h} style={{ ...S.th }}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>{kpiRows.map((row: any, i: number) => (
                            <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                              <td style={{ ...S.td, ...S.mono, color: T.text, fontWeight: 600 }}>{row.period}</td>
                              <td style={{ ...S.td, ...S.mono }}>{fmt(row.beginning)}</td>
                              <td style={{ ...S.td, ...S.mono }}>{fmt(row.ending)}</td>
                              <td style={{ ...S.td, ...S.mono, color: T.positive, fontWeight: 500 }}>{row.new_logo ? `+${fmt(row.new_logo)}` : '—'}</td>
                              <td style={{ ...S.td, ...S.mono, color: T.positive }}>{row.upsell ? `+${fmt(row.upsell)}` : '—'}</td>
                              <td style={{ ...S.td, ...S.mono }}>{row.downsell ? fmt(row.downsell) : '—'}</td>
                              <td style={{ ...S.td, ...S.mono, color: T.negative, fontWeight: 500 }}>{row.churn ? fmt(row.churn) : '—'}</td>
                              <td style={{ ...S.td, ...S.mono, fontWeight: 700, color: (row.grr || 0) >= 80 ? T.positive : T.negative }}>{fmtPct(row.grr)}</td>
                              <td style={{ ...S.td, ...S.mono, fontWeight: 700, color: (row.nrr || 0) >= 100 ? T.positive : T.neutral }}>{fmtPct(row.nrr)}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── OUTPUT TABLE ─────────────────────────────────────────── */}
              {activeTab === 'output' && (
                <div style={{ ...S.cardF }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: `1px solid ${T.border}` }}>
                    <div style={{ ...S.label }}>Output — {results.output?.length?.toLocaleString()} rows</div>
                    {isAdmin ? (
                      <button onClick={downloadCSV} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500, padding: '5px 12px', borderRadius: 5, border: `1px solid ${T.border}`, cursor: 'pointer', background: T.surface2, color: T.textMuted }}>
                        <Download size={11} /> Export CSV
                      </button>
                    ) : (
                      <button onClick={() => router.push('/dashboard/upgrade')} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 400, color: T.textFaint, background: T.surface2, border: `1px solid ${T.border}`, padding: '5px 12px', borderRadius: 5, cursor: 'pointer' }}>
                        <Lock size={11} /> Upgrade to Export
                      </button>
                    )}
                  </div>
                  {results.output?.length > 0 ? (
                    <div style={{ overflowX: 'auto', maxHeight: 500, overflowY: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
                        <thead style={{ position: 'sticky', top: 0, background: T.surface2, zIndex: 1 }}>
                          <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                            {Object.keys(results.output[0]).map(col => (
                              <th key={col} style={{ ...S.th }}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>{results.output.slice(0, 200).map((row: any, i: number) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.surface2 }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                            {Object.values(row).map((val: any, j) => (
                              <td key={j} style={{ ...S.td, whiteSpace: 'nowrap', fontFamily: typeof val === 'number' ? T.mono : T.sans }}>{val ?? '—'}</td>
                            ))}
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  ) : <div style={{ padding: 40, textAlign: 'center', color: T.textFaint, fontSize: 13 }}>No output data available.</div>}
                </div>
              )}

            </div>{/* end tab content */}
          </div>
        )}
      </main>
    </div>
  )
}
