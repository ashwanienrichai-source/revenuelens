import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart, Legend
} from 'recharts'
import {
  Upload, Play, Download, Loader2, CheckCircle, AlertCircle,
  BarChart3, TrendingUp, Users, DollarSign, Layers, Target,
  ChevronRight, Filter, RefreshCw, Lock, Settings, ArrowUp,
  ArrowDown, Minus, Package, FileText, Eye, X, Plus, AlertTriangle,
  Home, ChevronDown, ChevronUp, Zap, Clock
} from 'lucide-react'
import { supabase, UserProfile, canDownload } from '../../lib/supabase'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://revenuelens-api.onrender.com'

// ── Bridge colors ─────────────────────────────────────────────────────
const BRIDGE_COLORS: Record<string, string> = {
  'New Logo':       '#10B981',
  'Cross-sell':     '#3B82F6',
  'Other In':       '#22C55E',
  'Returning':      '#F59E0B',
  'Upsell':         '#6366F1',
  'Downsell':       '#F97316',
  'Add on':         '#8B5CF6',
  'Add-on':         '#8B5CF6',
  'Churn':          '#EF4444',
  'Churn Partial':  '#FCA5A5',
  'Churn-Partial':  '#FCA5A5',
  'Other Out':      '#94A3B8',
  'Lapsed':         '#CBD5E1',
  'Beginning MRR':  '#1E293B',
  'Ending MRR':     '#1E293B',
  'Prior ACV':      '#1E293B',
  'Ending ACV':     '#1E293B',
  'RoB':            '#A78BFA',
  'Expiry Pool':    '#374151',
}

const CHART_COLORS = ['#1A3CF5','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316']

const fmt = (v?: number | null) => {
  if (v == null) return '—'
  if (Math.abs(v) >= 1_000_000) return `$${(v/1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000)     return `$${(v/1_000).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}
const fmtPct = (v?: number | null) => v != null ? `${v.toFixed(1)}%` : '—'
const fmtK   = (v?: number | null) => v != null ? v.toLocaleString() : '—'

// ── Engine config — drives dynamic field mapping ───────────────────────
const ENGINE_CONFIG = {
  mrr: {
    id:    'mrr',
    label: 'MRR / ARR Analytics',
    desc:  'Bridge waterfall from Alteryx MRR output',
    icon:  TrendingUp,
    required: [
      { key: 'customer', label: 'Customer / Account',    kw: ['customer_id','customer','client','account'] },
      { key: 'date',     label: 'Activity Date',         kw: ['date','activity_date','period','month'] },
      { key: 'metric',   label: 'Bridge Value / MRR',    kw: ['bridge value','amount','mrr','arr','revenue'] },
      { key: 'lookback', label: 'Month Lookback',        kw: ['month lookback','month_lookback','lookback'] },
      { key: 'classify', label: 'Bridge Classification', kw: ['classification','bridge classification','bridge_classification'] },
    ],
    optional: [
      { key: 'product',  label: 'Product',   kw: ['product','sku','service'] },
      { key: 'region',   label: 'Region',    kw: ['region','geo','geography','country'] },
      { key: 'channel',  label: 'Channel',   kw: ['channel','segment'] },
      { key: 'vintage',  label: 'Vintage',   kw: ['vintage','cohort'] },
    ],
    kpiLens: [
      { key: 'industry', label: 'Industry',  kw: ['industry','sector','vertical'] },
      { key: 'market',   label: 'Market',    kw: ['market','territory'] },
      { key: 'country',  label: 'Country',   kw: ['country','nation'] },
      { key: 'state',    label: 'State',     kw: ['state','province'] },
    ],
    toolType: 'MRR',
  },
  acv: {
    id:    'acv',
    label: 'ACV / Contract Analytics',
    desc:  'Contract-based bridge with renewal rates',
    icon:  FileText,
    required: [
      { key: 'customer',      label: 'Customer / Account',  kw: ['customer_id','customer','client','account'] },
      { key: 'contractStart', label: 'Contract Start Date', kw: ['contract_start','start_date','start date'] },
      { key: 'contractEnd',   label: 'Contract End Date',   kw: ['contract_end','end_date','end date','expiry'] },
      { key: 'acv',           label: 'ACV / TCV',          kw: ['acv','tcv','annual contract','contract value'] },
    ],
    optional: [
      { key: 'product',  label: 'Product',        kw: ['product','sku'] },
      { key: 'region',   label: 'Region',         kw: ['region','geo','country'] },
      { key: 'channel',  label: 'Channel',        kw: ['channel','segment'] },
      { key: 'quantity', label: 'Quantity / Seats',kw: ['qty','quantity','units','seats'] },
    ],
    kpiLens: [
      { key: 'industry', label: 'Industry', kw: ['industry','sector','vertical'] },
      { key: 'market',   label: 'Market',   kw: ['market','territory'] },
      { key: 'country',  label: 'Country',  kw: ['country','nation'] },
      { key: 'state',    label: 'State',    kw: ['state','province'] },
    ],
    toolType: 'ACV',
  },
  cohort: {
    id:    'cohort',
    label: 'Cohort Analytics',
    desc:  'Size, Percentile & Revenue cohorts',
    icon:  Layers,
    required: [
      { key: 'customer', label: 'Customer / Account', kw: ['customer_id','customer','client','account'] },
      { key: 'date',     label: 'Date / Period',      kw: ['date','activity_date','period','month'] },
      { key: 'revenue',  label: 'Revenue / MRR',      kw: ['mrr','arr','revenue','amount','value'] },
    ],
    optional: [
      { key: 'fiscal',  label: 'Fiscal Year', kw: ['fiscal','fy','fiscal_year'] },
      { key: 'product', label: 'Product',     kw: ['product','sku'] },
      { key: 'region',  label: 'Region',      kw: ['region','geo'] },
    ],
    kpiLens: [
      { key: 'industry', label: 'Industry', kw: ['industry','sector'] },
      { key: 'market',   label: 'Market',   kw: ['market','territory'] },
      { key: 'country',  label: 'Country',  kw: ['country','nation'] },
      { key: 'state',    label: 'State',    kw: ['state','province'] },
    ],
    toolType: 'MRR',
  },
} as const

type EngineId = keyof typeof ENGINE_CONFIG

// ── Auto-detect column helper ─────────────────────────────────────────
function autoDetect(columns: string[], keywords: readonly string[]): string {
  const cols = columns.map(c => c.toLowerCase().replace(/[^a-z0-9]/g, ''))
  const kws  = keywords.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''))
  // Exact match first
  const exact = columns.find((_, i) => kws.includes(cols[i]))
  if (exact) return exact
  // Partial match
  const partial = columns.find((_, i) => kws.some(k => cols[i].includes(k) || k.includes(cols[i])))
  return partial || ''
}

// ── Module definitions ────────────────────────────────────────────────
const MODULES = [
  { id: 'bridge',        label: 'Revenue Bridge', icon: TrendingUp, desc: 'Waterfall bridge' },
  { id: 'top_movers',    label: 'Top Movers',      icon: Target,     desc: 'Biggest movers' },
  { id: 'top_customers', label: 'Top Customers',   icon: Users,      desc: 'Top N by ARR' },
  { id: 'kpi_matrix',    label: 'KPI Matrix',      icon: BarChart3,  desc: 'NRR, GRR, rates' },
  { id: 'output',        label: 'Output Table',    icon: FileText,   desc: 'Export output' },
]

// ── Upload timer component ────────────────────────────────────────────
function UploadTimer({ active }: { active: boolean }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!active) { setElapsed(0); return }
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [active])
  if (!active) return null
  const pct = Math.min((elapsed / 90) * 100, 99)
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-ink-500">{elapsed < 10 ? 'Connecting...' : elapsed < 30 ? 'API waking up...' : elapsed < 60 ? 'Processing file...' : 'Almost ready...'}</span>
        <span className="text-[10px] font-700 text-brand-600">{elapsed}s</span>
      </div>
      <div className="h-1 bg-ink-200 rounded-full overflow-hidden">
        <div className="h-full bg-brand-500 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }}/>
      </div>
      {elapsed > 5 && elapsed < 90 && (
        <div className="text-[9px] text-ink-400 mt-1">
          {elapsed < 30 ? '⏳ Engine waking from sleep — happens once per session' :
           elapsed < 60 ? '🔄 Reading and processing your dataset...' :
           '⚡ Almost done — large files take up to 90s'}
        </div>
      )}
    </div>
  )
}

// ── Step indicator ────────────────────────────────────────────────────
function StepBadge({ n, label, done, active }: { n: number; label: string; done: boolean; active: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
      active ? 'bg-brand-50 border border-brand-200' : done ? 'opacity-60' : 'opacity-30'
    }`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-700 flex-shrink-0 ${
        done ? 'bg-green-500 text-white' : active ? 'bg-brand-600 text-white' : 'bg-ink-200 text-ink-500'
      }`}>
        {done ? '✓' : n}
      </div>
      <span className={`text-[11px] font-600 ${active ? 'text-brand-700' : done ? 'text-ink-600' : 'text-ink-400'}`}>{label}</span>
    </div>
  )
}

// ── Field map row ─────────────────────────────────────────────────────
function FieldRow({ label, required, value, columns, onChange, error }: any) {
  return (
    <div className="grid grid-cols-2 gap-2 px-3 py-2 border-b border-ink-50 last:border-0">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-ink-700 font-500 leading-tight">{label}</span>
        {required && <span className="text-red-400 text-[10px] font-700">*</span>}
      </div>
      <div>
        <select value={value} onChange={e => onChange(e.target.value)}
          className={`w-full text-[10px] border rounded px-1.5 py-1 bg-white text-ink-700 outline-none transition-colors ${
            error ? 'border-red-300 bg-red-50' : value ? 'border-green-300 bg-green-50/30' : 'border-ink-200'
          }`}>
          <option value="">— Select —</option>
          {columns.map((c: string) => <option key={c} value={c}>{c}</option>)}
        </select>
        {error && <div className="text-[9px] text-red-500 mt-0.5">{error}</div>}
      </div>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, delta, good, icon: Icon, accent }: any) {
  const isPos = delta != null && delta > 0
  const isNeg = delta != null && delta < 0
  return (
    <div className={`bg-white rounded-xl border p-4 ${accent ? 'border-t-2 border-t-brand-600' : 'border-ink-200'}`}>
      <div className="flex items-center justify-between mb-3">
        {Icon && <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          good === true ? 'bg-green-50' : good === false ? 'bg-red-50' : 'bg-brand-50'
        }`}><Icon size={15} className={good === true ? 'text-green-600' : good === false ? 'text-red-500' : 'text-brand-600'}/></div>}
        {delta != null && (
          <span className={`flex items-center gap-0.5 text-[10px] font-700 ${isPos ? 'text-green-600' : isNeg ? 'text-red-500' : 'text-ink-400'}`}>
            {isPos ? <ArrowUp size={9}/> : isNeg ? <ArrowDown size={9}/> : <Minus size={9}/>}
            {Math.abs(delta).toFixed(1)}% YOY
          </span>
        )}
      </div>
      <div className="text-[9px] font-700 text-ink-400 uppercase tracking-widest mb-1">{label}</div>
      <div className={`font-display text-xl font-800 leading-none ${accent ? 'text-brand-600' : 'text-ink-900'}`}>{value}</div>
      {sub && <div className="text-[10px] text-ink-400 mt-1">{sub}</div>}
    </div>
  )
}

// ── Retention card ────────────────────────────────────────────────────
function RetentionCard({ label, value, good, sub }: any) {
  return (
    <div className={`p-4 rounded-xl border ${good ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
      <div className="text-[9px] font-700 uppercase tracking-widest mb-1 text-ink-500">{label}</div>
      <div className={`font-display text-2xl font-800 ${good ? 'text-green-700' : 'text-red-600'}`}>{value}</div>
      {sub && <div className="text-[10px] text-ink-400 mt-1">{sub}</div>}
    </div>
  )
}

// ── Bridge waterfall ──────────────────────────────────────────────────
function WaterfallChart({ data }: { data: any[] }) {
  if (!data?.length) return <div className="h-56 flex items-center justify-center text-ink-400 text-sm">No bridge data</div>
  const sorted = [...data].filter(d => d.category !== 'Beginning MRR' && d.category !== 'Ending MRR' && d.category !== 'Prior ACV' && d.category !== 'Ending ACV')
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} margin={{ top: 5, right: 5, bottom: 50, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F8" vertical={false}/>
          <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#8C95A6' }} angle={-35} textAnchor="end" interval={0}/>
          <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 10, fill: '#8C95A6' }} width={50}/>
          <Tooltip formatter={(v: any, _: any, p: any) => [fmt(Number(v)), p.payload.category]} contentStyle={{ fontSize: 12 }}/>
          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
            {sorted.map((entry: any, i: number) => (
              <Cell key={i} fill={BRIDGE_COLORS[entry.category] || '#CBD5E1'}/>
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function CommandCenter() {
  const router = useRouter()
  const [profile, setProfile]   = useState<UserProfile | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Upload state
  const [file, setFile]           = useState<File | null>(null)
  const [columns, setColumns]     = useState<string[]>([])
  const [rowCount, setRowCount]   = useState(0)
  const [loadingCols, setLoadingCols] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // Engine selection
  const [selectedEngine, setSelectedEngine] = useState<EngineId | null>(null)
  const [showOptional, setShowOptional]     = useState(false)
  const [showKpiLens, setShowKpiLens]       = useState(false)

  // Field mapping — keyed by field.key
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({})

  // Config state (preserved from original)
  const [revenueUnit, setRevenueUnit]     = useState('raw')
  const [selectedModules, setSelectedModules] = useState<string[]>(['bridge', 'top_movers', 'top_customers', 'kpi_matrix'])
  const [lookbacks, setLookbacks]         = useState<number[]>([1, 3, 12])
  const [dimensions, setDimensions]       = useState<string[]>([])
  const [nMovers, setNMovers]             = useState(30)
  const [nCustomers, setNCustomers]       = useState(10)
  const [periodType, setPeriodType]       = useState('Annual')

  // Results state (preserved)
  const [results, setResults]     = useState<any>(null)
  const [running, setRunning]     = useState(false)
  const [error, setError]         = useState('')

  // Filter state (preserved)
  const [selectedLookback, setSelectedLookback] = useState(12)
  const [yearFilter, setYearFilter]   = useState('All')
  const [activeTab, setActiveTab]     = useState('summary')
  const [activeMoverCat, setActiveMoverCat] = useState('')

  const isAdmin = canDownload(profile)

  // ── Derived state ──────────────────────────────────────────────────
  const engineCfg = selectedEngine ? ENGINE_CONFIG[selectedEngine] : null

  // Step completion flags
  const step1Done = columns.length > 0
  const step2Done = step1Done && selectedEngine !== null
  const step3Done = step2Done && engineCfg?.required.every(f => !!fieldMap[f.key])

  // Validate required fields
  const fieldErrors = useMemo(() => {
    if (!engineCfg) return {}
    const errs: Record<string, string> = {}
    engineCfg.required.forEach(f => {
      if (!fieldMap[f.key]) errs[f.key] = 'Required'
    })
    return errs
  }, [engineCfg, fieldMap])

  const canAnalyze = step3Done && selectedModules.length > 0 && !running

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }
      supabase.from('profiles').select('*').eq('id', session.user.id).single()
        .then(({ data }) => { if (data) setProfile(data) })
    })
    fetch(`${API}/health`).catch(() => {})
  }, [router])

  // Auto-detect fields when engine or columns change
  useEffect(() => {
    if (!engineCfg || !columns.length) return
    const detected: Record<string, string> = {}
    const allFields = [...engineCfg.required, ...engineCfg.optional, ...engineCfg.kpiLens]
    allFields.forEach(f => {
      const found = autoDetect(columns, f.kw)
      if (found) detected[f.key] = found
    })
    setFieldMap(detected)

    // Set dimensions from optional fields
    const dims = engineCfg.optional
      .map(f => detected[f.key])
      .filter(Boolean) as string[]
    setDimensions([...new Set(dims)])
  }, [selectedEngine, columns])

  async function readColumns(f: File) {
    setFile(f); setLoadingCols(true); setUploadError(''); setColumns([])
    try {
      const fd = new FormData(); fd.append('file', f)
      const { data } = await axios.post(`${API}/api/columns`, fd, { timeout: 90000 })
      setColumns(data.columns); setRowCount(data.row_count)
      // Auto-suggest engine
      if (data.is_acv) setSelectedEngine('acv')
      else if (data.is_bridge_output) setSelectedEngine('mrr')
    } catch (e: any) {
      setUploadError(e.code === 'ECONNABORTED'
        ? 'Request timed out. Please try again — the engine may still be waking up.'
        : `Could not read file: ${e?.response?.data?.detail || e.message}`)
    }
    setLoadingCols(false)
  }

  async function runAnalysis() {
    if (!file || !engineCfg) return
    setRunning(true); setError('')

    try {
      let endpoint = `${API}/api/bridge/analyze`
      const fd = new FormData()
      fd.append('file', file)

      if (selectedEngine === 'cohort') {
        endpoint = `${API}/api/cohort/analyze`
        fd.append('metric',       fieldMap.revenue || fieldMap.metric || '')
        fd.append('customer_col', fieldMap.customer || '')
        fd.append('date_col',     fieldMap.date || '')
        fd.append('fiscal_col',   fieldMap.fiscal || 'None')
        fd.append('cohort_types', JSON.stringify(['SG', 'PC', 'RC']))
        fd.append('individual_cols', JSON.stringify(dimensions.filter(Boolean)))
        fd.append('hierarchies',  JSON.stringify([]))
        fd.append('period_filter','all')
        fd.append('selected_fiscal_year', '')
      } else {
        fd.append('tool_type',      engineCfg.toolType)
        fd.append('revenue_unit',   revenueUnit)
        fd.append('lookbacks',      JSON.stringify(lookbacks))
        fd.append('dimension_cols', JSON.stringify(dimensions.filter(Boolean)))
        fd.append('modules',        JSON.stringify([...selectedModules, 'output']))
        fd.append('year_filter',    yearFilter !== 'All' ? yearFilter : '')
        fd.append('period_type',    periodType)
        fd.append('customer_col',   fieldMap.customer || 'Customer_ID')
        fd.append('n_movers',       String(nMovers))
        fd.append('n_customers',    String(nCustomers))
      }

      const { data } = await axios.post(endpoint, fd, { timeout: 120000 })
      setResults(data)
      setActiveTab('summary')
      if (lookbacks.length) setSelectedLookback(lookbacks[lookbacks.length - 1])
      const cats = Object.keys(data.top_movers || {})
      if (cats.length) setActiveMoverCat(cats[0])
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Analysis failed. Please try again.')
    }
    setRunning(false)
  }

  function downloadCSV() {
    if (!results?.output?.length) return
    const keys = Object.keys(results.output[0])
    const csv  = [keys.join(','), ...results.output.map((r: any) => keys.map((k: string) => `"${r[k] ?? ''}"`).join(','))].join('\n')
    const a    = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `revenuelens_${selectedEngine}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  // Derived result data (preserved)
  const lb_str       = String(selectedLookback)
  const bridgeData   = results?.bridge?.[lb_str]
  const retention    = bridgeData?.retention
  const waterfall    = bridgeData?.waterfall || []
  const fiscalYears  = results?.metadata?.fiscal_years || []
  const kpiRows      = results?.kpi_matrix || []
  const topMovers    = results?.top_movers || {}
  const topCustomers = results?.top_customers || []
  const fySummary    = results?.fy_summary || []
  const filteredFY   = yearFilter === 'All' ? fySummary : fySummary.filter((r: any) => String(r.fiscal_year) === yearFilter)

  const TABS = [
    { id: 'summary',       label: 'Summary' },
    { id: 'bridge',        label: 'Revenue Bridge' },
    { id: 'retention',     label: 'Retention Trends' },
    { id: 'top_movers',    label: 'Top Movers' },
    { id: 'top_customers', label: 'Top Customers' },
    { id: 'kpi_matrix',    label: 'KPI Matrix' },
    { id: 'output',        label: 'Output Table' },
  ]

  return (
    <div className="flex h-screen bg-[#F6F7F9] overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Left sidebar ── */}
      <aside className="w-72 bg-white border-r border-ink-200 flex flex-col overflow-hidden flex-shrink-0">

        {/* Logo + Home */}
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-ink-100">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
            <BarChart3 size={14} className="text-white"/>
          </div>
          <div className="flex-1">
            <div className="font-display font-800 text-ink-900 text-[13px] leading-none">RevenueLens</div>
            <div className="text-[9px] text-ink-400 font-600 uppercase tracking-wider mt-0.5">Command Center</div>
          </div>
          <button onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1 text-[10px] text-ink-400 hover:text-ink-700 px-2 py-1 rounded-lg hover:bg-ink-50 transition-all">
            <Home size={11}/> Home
          </button>
        </div>

        {/* Step progress */}
        <div className="px-3 py-2.5 border-b border-ink-100 bg-ink-50/50">
          <div className="space-y-0.5">
            <StepBadge n={1} label="Upload Data"     done={step1Done} active={!step1Done}/>
            <StepBadge n={2} label="Select Engine"   done={step2Done} active={step1Done && !step2Done}/>
            <StepBadge n={3} label="Map Fields"      done={step3Done} active={step2Done && !step3Done}/>
            <StepBadge n={4} label="Analyze Metrics" done={!!results} active={step3Done && !results}/>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── STEP 1: Upload ── */}
          <div className="p-4 border-b border-ink-100">
            <div className="text-[9px] font-700 text-ink-400 uppercase tracking-widest mb-2">1. Upload Data</div>

            {uploadError && (
              <div className="mb-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-[11px] flex items-start gap-1.5">
                <AlertCircle size={11} className="flex-shrink-0 mt-0.5"/>
                <div>
                  {uploadError}
                  {uploadError.includes('timed out') && (
                    <button onClick={() => file && readColumns(file)}
                      className="block mt-1 text-red-600 font-700 underline text-[10px]">
                      Retry upload →
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className={`rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-all ${
              file && columns.length > 0 ? 'border-green-400 bg-green-50' :
              loadingCols ? 'border-brand-300 bg-brand-50/30' :
              'border-ink-200 hover:border-brand-300 bg-ink-50/30'
            }`} onClick={() => !loadingCols && fileRef.current?.click()}>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) readColumns(f) }}/>
              {loadingCols ? (
                <div>
                  <Loader2 size={18} className="text-brand-500 animate-spin mx-auto mb-1"/>
                  <div className="text-[11px] text-brand-700 font-600">Reading file...</div>
                </div>
              ) : file && columns.length > 0 ? (
                <div>
                  <CheckCircle size={18} className="text-green-500 mx-auto mb-1"/>
                  <div className="text-[11px] font-700 text-ink-900 truncate">{file.name}</div>
                  <div className="text-[10px] text-ink-500">{rowCount.toLocaleString()} rows · {columns.length} cols detected</div>
                </div>
              ) : (
                <div>
                  <Upload size={18} className="text-ink-300 mx-auto mb-1"/>
                  <div className="text-[11px] text-ink-600 font-600">Click or drag CSV / Excel</div>
                  <div className="text-[10px] text-ink-400 mt-0.5">Alteryx output or raw revenue data</div>
                </div>
              )}
            </div>
            <UploadTimer active={loadingCols}/>
          </div>

          {/* ── STEP 2: Select Engine ── */}
          {step1Done && (
            <div className="p-4 border-b border-ink-100">
              <div className="text-[9px] font-700 text-ink-400 uppercase tracking-widest mb-2">2. Select Engine</div>
              <div className="space-y-1.5">
                {(Object.values(ENGINE_CONFIG) as typeof ENGINE_CONFIG[EngineId][]).map(eng => {
                  const Icon = eng.icon
                  const active = selectedEngine === eng.id
                  return (
                    <button key={eng.id} onClick={() => setSelectedEngine(eng.id as EngineId)}
                      className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                        active ? 'border-brand-400 bg-brand-50' : 'border-ink-200 hover:border-ink-300 bg-white'
                      }`}>
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${active ? 'bg-brand-600' : 'bg-ink-100'}`}>
                        <Icon size={12} className={active ? 'text-white' : 'text-ink-500'}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[12px] font-700 ${active ? 'text-brand-700' : 'text-ink-900'}`}>{eng.label}</div>
                        <div className="text-[10px] text-ink-400 mt-0.5">{eng.desc}</div>
                      </div>
                      {active && <div className="w-4 h-4 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0 mt-1">
                        <CheckCircle size={10} className="text-white"/>
                      </div>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── STEP 3: Dynamic Field Mapping ── */}
          {step2Done && engineCfg && (
            <div className="p-4 border-b border-ink-100">
              <div className="text-[9px] font-700 text-ink-400 uppercase tracking-widest mb-2">3. Map Fields</div>

              {/* Required fields */}
              <div className="rounded-xl border border-ink-200 overflow-hidden mb-2">
                <div className="px-3 py-1.5 bg-ink-50 border-b border-ink-100 flex items-center justify-between">
                  <span className="text-[9px] font-700 text-ink-400 uppercase tracking-widest">Required</span>
                  <span className="text-[9px] text-ink-400">{engineCfg.required.filter(f => !!fieldMap[f.key]).length}/{engineCfg.required.length} mapped</span>
                </div>
                {engineCfg.required.map(f => (
                  <FieldRow key={f.key} label={f.label} required
                    value={fieldMap[f.key] || ''} columns={columns}
                    onChange={(v: string) => setFieldMap(m => ({ ...m, [f.key]: v }))}
                    error={!fieldMap[f.key] && step2Done ? fieldErrors[f.key] : undefined}
                  />
                ))}
              </div>

              {/* Optional fields — collapsible */}
              <div className="rounded-xl border border-ink-200 overflow-hidden mb-2">
                <button onClick={() => setShowOptional(v => !v)}
                  className="w-full px-3 py-1.5 bg-ink-50 border-b border-ink-100 flex items-center justify-between hover:bg-ink-100 transition-colors">
                  <span className="text-[9px] font-700 text-ink-400 uppercase tracking-widest">Optional Fields</span>
                  {showOptional ? <ChevronUp size={12} className="text-ink-400"/> : <ChevronDown size={12} className="text-ink-400"/>}
                </button>
                {showOptional && engineCfg.optional.map(f => (
                  <FieldRow key={f.key} label={f.label}
                    value={fieldMap[f.key] || ''} columns={columns}
                    onChange={(v: string) => {
                      setFieldMap(m => ({ ...m, [f.key]: v }))
                      if (v) setDimensions(prev => prev.includes(v) ? prev : [...prev, v])
                      else setDimensions(prev => prev.filter(d => d !== fieldMap[f.key]))
                    }}
                  />
                ))}
              </div>

              {/* KPI Lens — collapsible advanced */}
              <div className="rounded-xl border border-ink-200 overflow-hidden">
                <button onClick={() => setShowKpiLens(v => !v)}
                  className="w-full px-3 py-1.5 bg-ink-50 border-b border-ink-100 flex items-center justify-between hover:bg-ink-100 transition-colors">
                  <span className="text-[9px] font-700 text-ink-400 uppercase tracking-widest">KPI Lens (Advanced)</span>
                  {showKpiLens ? <ChevronUp size={12} className="text-ink-400"/> : <ChevronDown size={12} className="text-ink-400"/>}
                </button>
                {showKpiLens && engineCfg.kpiLens.map(f => (
                  <FieldRow key={f.key} label={f.label}
                    value={fieldMap[f.key] || ''} columns={columns}
                    onChange={(v: string) => setFieldMap(m => ({ ...m, [f.key]: v }))}
                  />
                ))}
              </div>

              {/* Validation summary */}
              {Object.keys(fieldErrors).length > 0 && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="text-[10px] text-amber-700 font-600">
                    {Object.keys(fieldErrors).length} required field{Object.keys(fieldErrors).length > 1 ? 's' : ''} not mapped
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 4: Modules + Config ── */}
          {step3Done && (
            <div className="p-4">
              <div className="text-[9px] font-700 text-ink-400 uppercase tracking-widest mb-2">4. Analyse Metrics</div>

              {/* Lookback windows */}
              {selectedEngine !== 'cohort' && (
                <div className="mb-3">
                  <div className="text-[10px] font-600 text-ink-600 mb-1.5">Lookback Windows</div>
                  <div className="flex gap-1">
                    {[1, 3, 6, 12].map(lb => (
                      <button key={lb} onClick={() => setLookbacks(prev => prev.includes(lb) ? prev.filter(x => x !== lb) : [...prev, lb])}
                        className={`flex-1 py-1 rounded text-[10px] font-700 border transition-all ${
                          lookbacks.includes(lb) ? 'bg-brand-600 text-white border-brand-600' : 'border-ink-200 text-ink-500'
                        }`}>{lb}M</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Revenue units */}
              {selectedEngine !== 'cohort' && (
                <div className="mb-3">
                  <div className="text-[10px] font-600 text-ink-600 mb-1.5">Revenue Units</div>
                  <div className="grid grid-cols-3 gap-1">
                    {[['raw','As-is'],['thousands','÷ 1K'],['millions','÷ 1M']].map(([val,lbl]) => (
                      <button key={val} onClick={() => setRevenueUnit(val)}
                        className={`py-1 rounded text-[10px] font-600 border transition-all ${
                          revenueUnit === val ? 'bg-brand-600 text-white border-brand-600' : 'border-ink-200 text-ink-500'
                        }`}>{lbl}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Module checkboxes — only for bridge/mrr/acv engines */}
              {selectedEngine !== 'cohort' && (
                <div className="mb-2">
                  <div className="text-[10px] font-600 text-ink-600 mb-1.5">Output Modules</div>
                  <div className="space-y-1">
                    {MODULES.map(m => (
                      <label key={m.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                        selectedModules.includes(m.id) ? 'border-brand-300 bg-brand-50' : 'border-ink-200 hover:border-ink-300'
                      }`}>
                        <input type="checkbox" checked={selectedModules.includes(m.id)} className="accent-brand-600"
                          onChange={e => setSelectedModules(prev => e.target.checked ? [...prev, m.id] : prev.filter(x => x !== m.id))}/>
                        <m.icon size={11} className={selectedModules.includes(m.id) ? 'text-brand-600' : 'text-ink-400'}/>
                        <span className="text-[11px] font-600 text-ink-900">{m.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Period type */}
              <div className="flex gap-1">
                {['Annual', 'Quarter'].map(p => (
                  <button key={p} onClick={() => setPeriodType(p)}
                    className={`flex-1 py-1 rounded text-[10px] font-700 border transition-all ${
                      periodType === p ? 'bg-brand-600 text-white border-brand-600' : 'border-ink-200 text-ink-500'
                    }`}>{p}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Analyze button */}
        <div className="p-4 border-t border-ink-100">
          {error && (
            <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-[10px] flex items-start gap-1.5">
              <AlertCircle size={10} className="flex-shrink-0 mt-0.5"/> {error}
            </div>
          )}

          <button onClick={runAnalysis} disabled={!canAnalyze}
            title={!step1Done ? 'Upload a file first' : !step2Done ? 'Select an engine' : !step3Done ? 'Map all required fields' : ''}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white font-700 text-sm py-3 rounded-xl hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            {running ? <Loader2 size={15} className="animate-spin"/> : <Play size={15}/>}
            {running ? 'Analysing...' : 'Analyze Metrics'}
          </button>

          {running && <UploadTimer active={running}/>}

          {/* Premium export placeholder */}
          <button disabled title="Premium Feature — Upgrade to export"
            className="w-full mt-2 flex items-center justify-center gap-2 border border-ink-200 text-ink-400 font-600 text-[11px] py-2 rounded-xl cursor-not-allowed opacity-60 hover:opacity-80 transition-all">
            <Lock size={12}/> Download / Export
            <span className="ml-auto text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-700">Premium</span>
          </button>

          {!step1Done && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-1.5">
              <AlertTriangle size={10} className="text-blue-500 mt-0.5 flex-shrink-0"/>
              <div className="text-[9px] text-blue-700">
                <strong>First upload takes 30-90s</strong> — engine wakes on first use
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-hidden flex flex-col">

        {/* Top bar */}
        <header className="h-14 bg-white border-b border-ink-200 flex items-center px-6 gap-4 flex-shrink-0">
          <div>
            <div className="text-sm font-700 text-ink-900">Subscription Analytics</div>
            <div className="text-[10px] text-ink-400">Real-time retention and revenue analytics</div>
          </div>

          <div className="flex-1"/>

          {/* Filters */}
          {results && (
            <div className="flex items-center gap-3">
              {/* Period type */}
              <div className="flex items-center gap-1 p-0.5 bg-ink-100 rounded-lg">
                {['Annual', 'Quarter'].map(p => (
                  <button key={p} onClick={() => setPeriodType(p)}
                    className={`px-3 py-1 rounded-md text-[11px] font-600 transition-all ${
                      periodType === p ? 'bg-white shadow-sm text-ink-900' : 'text-ink-500'
                    }`}>{p === 'Annual' ? 'Year Over Year' : 'Quarter'}</button>
                ))}
              </div>

              {/* Year filter */}
              {fiscalYears.length > 0 && (
                <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
                  className="text-[11px] border border-ink-200 rounded-lg px-2 py-1.5 bg-white text-ink-700 outline-none">
                  <option value="All">All Years</option>
                  {fiscalYears.map((fy: any) => <option key={String(fy)} value={String(fy)}>{String(fy)}</option>)}
                </select>
              )}

              {/* Lookback filter */}
              <div className="flex items-center gap-1 p-0.5 bg-ink-100 rounded-lg">
                {lookbacks.map(lb => (
                  <button key={lb} onClick={() => setSelectedLookback(lb)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-600 transition-all flex items-center gap-1 ${
                      selectedLookback === lb ? 'bg-white shadow-sm text-ink-900' : 'text-ink-500'
                    }`}>
                    <TrendingUp size={10}/> {lb}M
                  </button>
                ))}
              </div>

              {/* Actions */}
              <button onClick={() => { setResults(null); setFile(null); setColumns([]) }}
                className="p-1.5 text-ink-400 hover:text-ink-700 rounded-lg hover:bg-ink-100 transition-all">
                <RefreshCw size={14}/>
              </button>

              {isAdmin
                ? <button onClick={downloadCSV} className="flex items-center gap-1.5 bg-brand-600 text-white text-[11px] font-700 px-3 py-1.5 rounded-lg hover:bg-brand-700 transition-all">
                    <Download size={11}/> Export
                  </button>
                : <button onClick={() => router.push('/dashboard/upgrade')}
                    className="flex items-center gap-1.5 text-[11px] font-600 text-ink-500 border border-ink-200 px-3 py-1.5 rounded-lg hover:bg-ink-50 transition-all">
                    <Lock size={11}/> Upgrade
                  </button>
              }
            </div>
          )}
        </header>

        {!results ? (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-lg">
              <div className="w-20 h-20 rounded-2xl bg-white border-2 border-ink-200 flex items-center justify-center mx-auto mb-5 shadow-sm">
                <BarChart3 size={32} className="text-brand-400"/>
              </div>
              <h2 className="font-display text-2xl font-800 text-ink-900 mb-2">Subscription Analytics</h2>
              <p className="text-ink-500 text-sm mb-6 leading-relaxed">
                Upload your Alteryx bridge output or revenue CSV on the left panel, select your modules, and click Analyze Metrics to see your full revenue intelligence dashboard.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {MODULES.slice(0, 3).map(m => (
                  <div key={m.id} className="bg-white rounded-xl border border-ink-200 p-4 text-left shadow-sm">
                    <m.icon size={16} className="text-brand-500 mb-2"/>
                    <div className="text-xs font-700 text-ink-900 mb-1">{m.label}</div>
                    <div className="text-[10px] text-ink-400">{m.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Results */
          <div className="flex-1 overflow-hidden flex flex-col">

            {/* KPI row */}
            <div className="px-6 py-4 border-b border-ink-200 bg-white">
              <div className="grid grid-cols-6 gap-3">
                <KpiCard label="Total ARR" value={fmt(retention?.ending)} accent icon={DollarSign}/>
                <KpiCard label="New ARR" value={fmt(retention?.new_arr)} good icon={ArrowUp}/>
                <KpiCard label="Lost ARR" value={fmt(Math.abs(retention?.lost_arr || 0))} good={false} icon={ArrowDown}/>
                <KpiCard label="Net Retention" value={fmtPct(retention?.nrr)} good={(retention?.nrr || 0) >= 100} icon={TrendingUp}/>
                <KpiCard label="Gross Retention" value={fmtPct(retention?.grr)} good={(retention?.grr || 0) >= 80} icon={Target}/>
                <KpiCard label="Customers" value={fmtK(results.metadata?.row_count)} icon={Users}/>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-6 border-b border-ink-200 bg-white flex gap-0 flex-shrink-0">
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-[12px] font-600 border-b-2 transition-all -mb-px ${
                    activeTab === tab.id ? 'border-brand-600 text-brand-600' : 'border-transparent text-ink-500 hover:text-ink-700'
                  }`}>{tab.label}</button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-auto p-6">

              {/* ── Summary ── */}
              {activeTab === 'summary' && (
                <div className="grid grid-cols-3 gap-5">

                  {/* Bridge chart */}
                  <div className="col-span-2 bg-white rounded-xl border border-ink-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-[10px] font-700 text-ink-400 uppercase tracking-widest">Revenue Bridge</div>
                        <div className="text-sm font-700 text-ink-900">{selectedLookback}M Lookback — {yearFilter === 'All' ? 'All Periods' : yearFilter}</div>
                      </div>
                    </div>
                    <WaterfallChart data={waterfall}/>
                  </div>

                  {/* Right column */}
                  <div className="space-y-4">
                    {/* Retention metrics */}
                    <div className="bg-white rounded-xl border border-ink-200 p-4">
                      <div className="text-[10px] font-700 text-ink-400 uppercase tracking-widest mb-3">Retention Metrics</div>
                      <div className="space-y-2">
                        <RetentionCard label="Gross Retention" value={fmtPct(retention?.grr)} good={(retention?.grr || 0) >= 80}/>
                        <RetentionCard label="Net Retention" value={fmtPct(retention?.nrr)} good={(retention?.nrr || 0) >= 100}/>
                      </div>
                    </div>

                    {/* FY breakdown */}
                    {filteredFY?.length > 0 && (
                      <div className="bg-white rounded-xl border border-ink-200 p-4">
                        <div className="text-[10px] font-700 text-ink-400 uppercase tracking-widest mb-3">By Fiscal Year</div>
                        <div className="space-y-2.5">
                          {filteredFY.slice(0, 5).map((row: any, i: number) => (
                            <div key={i} className="flex items-center justify-between">
                              <div className="text-[11px] font-600 text-ink-700">{row.fiscal_year}</div>
                              <div className="text-right">
                                <div className="text-[12px] font-700 text-ink-900">{fmt(row.revenue)}</div>
                                <div className="text-[9px] text-ink-400">{row.customers} customers · {fmt(row.rev_per_customer)}/cust</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Bridge ── */}
              {activeTab === 'bridge' && (
                <div className="space-y-5">
                  {/* Per period bridge chart */}
                  {bridgeData?.by_period?.length > 0 && (
                    <div className="bg-white rounded-xl border border-ink-200 p-5">
                      <div className="text-[10px] font-700 text-ink-400 uppercase tracking-widest mb-4">Bridge Trend — {periodType}</div>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={bridgeData.by_period} margin={{ left: 10, right: 10, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F8" vertical={false}/>
                            <XAxis dataKey="_period" tick={{ fontSize: 10, fill: '#8C95A6' }}/>
                            <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 10, fill: '#8C95A6' }} width={50}/>
                            <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ fontSize: 11 }}/>
                            <Legend/>
                            {['New Logo', 'Upsell', 'Cross-sell', 'Returning', 'Downsell', 'Churn', 'Churn Partial'].map((cat, i) => (
                              <Bar key={cat} dataKey={cat} stackId="a" fill={BRIDGE_COLORS[cat] || CHART_COLORS[i]} name={cat}/>
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Bridge table */}
                  <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-ink-100 bg-ink-50/50">
                      <div className="text-[10px] font-700 text-ink-400 uppercase tracking-widest">Waterfall Summary</div>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-ink-100">
                          <th className="text-left px-5 py-3 font-700 text-ink-500 text-xs uppercase">Classification</th>
                          <th className="text-right px-5 py-3 font-700 text-ink-500 text-xs uppercase">Value</th>
                          <th className="text-right px-5 py-3 font-700 text-ink-500 text-xs uppercase">% of Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {waterfall.sort((a: any, b: any) => Math.abs(b.value) - Math.abs(a.value)).map((row: any, i: number) => {
                          const total = waterfall.reduce((s: number, r: any) => s + Math.abs(r.value), 0)
                          const pct   = total > 0 ? (Math.abs(row.value) / total * 100).toFixed(1) : '0.0'
                          return (
                            <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                              <td className="px-5 py-2.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: row.color || '#CBD5E1' }}/>
                                  <span className="font-600 text-ink-900">{row.category}</span>
                                </div>
                              </td>
                              <td className={`px-5 py-2.5 text-right font-700 ${row.value > 0 ? 'text-green-700' : 'text-red-600'}`}>
                                {row.value > 0 ? '+' : ''}{fmt(row.value)}
                              </td>
                              <td className="px-5 py-2.5 text-right text-ink-400 text-xs">{pct}%</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Retention Trends ── */}
              {activeTab === 'retention' && (
                <div className="space-y-5">
                  {kpiRows.length > 0 && (
                    <div className="bg-white rounded-xl border border-ink-200 p-5">
                      <div className="text-[10px] font-700 text-ink-400 uppercase tracking-widest mb-4">Retention Trends by Period</div>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={kpiRows} margin={{ left: 10, right: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F8" vertical={false}/>
                            <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#8C95A6' }}/>
                            <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: '#8C95A6' }} domain={[0, 120]} width={40}/>
                            <Tooltip formatter={(v: any) => `${Number(v).toFixed(1)}%`} contentStyle={{ fontSize: 11 }}/>
                            <Legend/>
                            <Line type="monotone" dataKey="nrr" stroke="#1A3CF5" strokeWidth={2} dot={{ r: 3 }} name="NRR"/>
                            <Line type="monotone" dataKey="grr" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} name="GRR"/>
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Retention table */}
                  <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-ink-100 bg-ink-50">
                          {['Period', 'Beginning', 'Ending', 'Upsell', 'Downsell', 'Churn', 'GRR', 'NRR'].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left font-700 text-ink-500 text-xs uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {kpiRows.map((row: any, i: number) => (
                          <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                            <td className="px-4 py-2.5 font-700 text-ink-900">{row.period}</td>
                            <td className="px-4 py-2.5 text-ink-700">{fmt(row.beginning)}</td>
                            <td className="px-4 py-2.5 text-ink-700">{fmt(row.ending)}</td>
                            <td className="px-4 py-2.5 text-green-700 font-600">{row.upsell ? `+${fmt(row.upsell)}` : '—'}</td>
                            <td className="px-4 py-2.5 text-orange-600 font-600">{row.downsell ? fmt(row.downsell) : '—'}</td>
                            <td className="px-4 py-2.5 text-red-600 font-600">{row.churn ? fmt(row.churn) : '—'}</td>
                            <td className={`px-4 py-2.5 font-700 ${(row.grr || 0) >= 80 ? 'text-green-700' : 'text-red-600'}`}>{fmtPct(row.grr)}</td>
                            <td className={`px-4 py-2.5 font-700 ${(row.nrr || 0) >= 100 ? 'text-green-700' : 'text-amber-600'}`}>{fmtPct(row.nrr)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Top Movers ── */}
              {activeTab === 'top_movers' && (
                <div className="space-y-4">
                  {/* Category tabs */}
                  <div className="flex gap-1 flex-wrap">
                    {Object.keys(topMovers).map(cat => (
                      <button key={cat} onClick={() => setActiveMoverCat(cat)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-600 border transition-all ${
                          activeMoverCat === cat ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-500 hover:border-ink-300'
                        }`}>
                        <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ background: BRIDGE_COLORS[cat] || '#CBD5E1' }}/>
                        {cat} ({(topMovers[cat] || []).length})
                      </button>
                    ))}
                  </div>

                  {activeMoverCat && topMovers[activeMoverCat]?.length > 0 && (
                    <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
                      <div className="px-5 py-3 border-b border-ink-100 bg-ink-50/50 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: BRIDGE_COLORS[activeMoverCat] || '#CBD5E1' }}/>
                        <div className="text-[10px] font-700 text-ink-500 uppercase tracking-widest">Top {activeMoverCat}</div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-ink-100">
                              {Object.keys(topMovers[activeMoverCat][0]).filter(k => k !== 'value' && k !== 'period').map(k => (
                                <th key={k} className="px-4 py-2.5 text-left font-700 text-ink-500 text-xs uppercase">{k}</th>
                              ))}
                              <th className="px-4 py-2.5 text-right font-700 text-ink-500 text-xs uppercase">Period</th>
                              <th className="px-4 py-2.5 text-right font-700 text-ink-500 text-xs uppercase">Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {topMovers[activeMoverCat].slice(0, 30).map((row: any, i: number) => (
                              <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                                {Object.keys(row).filter(k => k !== 'value' && k !== 'period').map(k => (
                                  <td key={k} className="px-4 py-2 text-ink-700 text-xs">{row[k] ?? '—'}</td>
                                ))}
                                <td className="px-4 py-2 text-right text-ink-500 text-xs">{row.period || '—'}</td>
                                <td className={`px-4 py-2 text-right font-700 text-sm ${row.value > 0 ? 'text-green-700' : 'text-red-600'}`}>
                                  {row.value > 0 ? '+' : ''}{fmt(row.value)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Top Customers ── */}
              {activeTab === 'top_customers' && (
                <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-ink-100 bg-ink-50/50">
                    <div className="text-[10px] font-700 text-ink-400 uppercase tracking-widest">
                      Top {nCustomers} Customers by Ending ARR
                    </div>
                  </div>
                  {topCustomers.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-ink-100">
                          <th className="px-5 py-2.5 text-left font-700 text-ink-500 text-xs uppercase">#</th>
                          {Object.keys(topCustomers[0]).map(k => (
                            <th key={k} className="px-5 py-2.5 text-left font-700 text-ink-500 text-xs uppercase">{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {topCustomers.map((row: any, i: number) => (
                          <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                            <td className="px-5 py-2.5 text-ink-400 font-600 text-xs">#{i + 1}</td>
                            {Object.values(row).map((val: any, j: number) => (
                              <td key={j} className="px-5 py-2.5 text-ink-700">
                                {typeof val === 'number' ? <span className="font-700 text-ink-900">{fmt(val)}</span> : val ?? '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-10 text-center text-ink-400 text-sm">No customer data available.</div>
                  )}
                </div>
              )}

              {/* ── KPI Matrix ── */}
              {activeTab === 'kpi_matrix' && (
                <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-ink-100 bg-ink-50/50">
                    <div className="text-[10px] font-700 text-ink-400 uppercase tracking-widest">KPI Matrix — {periodType}</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-ink-100">
                          {['Period', 'Beginning', 'Ending', 'New Logo', 'Upsell', 'Downsell', 'Churn', 'Cross-sell', 'GRR', 'NRR',
                            'Beg Custs', 'End Custs', 'Churn Custs', 'New Custs'
                          ].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left font-700 text-ink-500 text-[10px] uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {kpiRows.map((row: any, i: number) => (
                          <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                            <td className="px-4 py-2 font-700 text-ink-900 whitespace-nowrap">{row.period}</td>
                            <td className="px-4 py-2 text-ink-700 whitespace-nowrap">{fmt(row.beginning)}</td>
                            <td className="px-4 py-2 text-ink-700 whitespace-nowrap">{fmt(row.ending)}</td>
                            <td className="px-4 py-2 text-green-700 font-600 whitespace-nowrap">{row.new_logo ? `+${fmt(row.new_logo)}` : '—'}</td>
                            <td className="px-4 py-2 text-indigo-600 font-600 whitespace-nowrap">{row.upsell ? `+${fmt(row.upsell)}` : '—'}</td>
                            <td className="px-4 py-2 text-orange-600 font-600 whitespace-nowrap">{row.downsell ? fmt(row.downsell) : '—'}</td>
                            <td className="px-4 py-2 text-red-600 font-600 whitespace-nowrap">{row.churn ? fmt(row.churn) : '—'}</td>
                            <td className="px-4 py-2 text-blue-600 font-600 whitespace-nowrap">{row.cross_sell ? `+${fmt(row.cross_sell)}` : '—'}</td>
                            <td className={`px-4 py-2 font-700 whitespace-nowrap ${(row.grr || 0) >= 80 ? 'text-green-700' : 'text-red-600'}`}>{fmtPct(row.grr)}</td>
                            <td className={`px-4 py-2 font-700 whitespace-nowrap ${(row.nrr || 0) >= 100 ? 'text-green-700' : 'text-amber-600'}`}>{fmtPct(row.nrr)}</td>
                            <td className="px-4 py-2 text-ink-600 whitespace-nowrap">{row.beg_customers || '—'}</td>
                            <td className="px-4 py-2 text-ink-600 whitespace-nowrap">{row.end_customers || '—'}</td>
                            <td className="px-4 py-2 text-red-500 whitespace-nowrap">{row.churn_customers || '—'}</td>
                            <td className="px-4 py-2 text-green-600 whitespace-nowrap">{row.new_customers || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Output Table ── */}
              {activeTab === 'output' && (
                <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100 bg-ink-50/50">
                    <div className="text-[10px] font-700 text-ink-400 uppercase tracking-widest">
                      Output — {results.output?.length?.toLocaleString()} rows (preview)
                    </div>
                    {isAdmin
                      ? <button onClick={downloadCSV} className="flex items-center gap-1.5 bg-brand-600 text-white text-[11px] font-700 px-3 py-1.5 rounded-lg">
                          <Download size={11}/> Export CSV
                        </button>
                      : <button onClick={() => router.push('/dashboard/upgrade')}
                          className="flex items-center gap-1.5 text-[11px] font-600 text-ink-500 bg-ink-100 px-3 py-1.5 rounded-lg hover:bg-ink-200">
                          <Lock size={11}/> Upgrade to Export
                        </button>
                    }
                  </div>
                  {results.output?.length > 0 ? (
                    <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-white border-b border-ink-100">
                          <tr>
                            {Object.keys(results.output[0]).map((col: string) => (
                              <th key={col} className="px-4 py-2.5 text-left font-700 text-ink-500 whitespace-nowrap bg-ink-50">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {results.output.slice(0, 200).map((row: any, i: number) => (
                            <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                              {Object.values(row).map((val: any, j: number) => (
                                <td key={j} className="px-4 py-1.5 text-ink-700 whitespace-nowrap">{val ?? '—'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-10 text-center text-ink-400 text-sm">No output data available.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
