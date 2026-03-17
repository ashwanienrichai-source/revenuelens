import { useState, useEffect, useRef } from 'react'
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
  ArrowDown, Minus, Package, FileText, Eye, X, Plus, AlertTriangle
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

// ── Module definitions ────────────────────────────────────────────────
const MODULES = [
  { id: 'bridge',       label: 'Revenue Bridge', icon: TrendingUp, desc: 'Waterfall bridge with classifications' },
  { id: 'top_movers',   label: 'Top Movers',      icon: Target,     desc: 'Biggest churners, new logos, upsells' },
  { id: 'top_customers',label: 'Top Customers',   icon: Users,      desc: 'Top N customers by ending ARR' },
  { id: 'kpi_matrix',   label: 'KPI Matrix',      icon: BarChart3,  desc: 'NRR, GRR, and rate metrics' },
  { id: 'output',       label: 'Output Table',    icon: FileText,   desc: 'Full bridge output export' },
]

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

// ── Retention pill ────────────────────────────────────────────────────
function RetentionCard({ label, value, good, sub }: any) {
  return (
    <div className={`p-4 rounded-xl border ${good ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
      <div className="text-[9px] font-700 uppercase tracking-widest mb-1 text-ink-500">{label}</div>
      <div className={`font-display text-2xl font-800 ${good ? 'text-green-700' : 'text-red-600'}`}>{value}</div>
      {sub && <div className="text-[10px] text-ink-400 mt-1">{sub}</div>}
    </div>
  )
}

// ── Bridge waterfall chart ─────────────────────────────────────────────
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
  const [file, setFile]         = useState<File | null>(null)
  const [columns, setColumns]   = useState<string[]>([])
  const [rowCount, setRowCount] = useState(0)
  const [isBridgeOutput, setIsBridgeOutput] = useState(false)
  const [isACV, setIsACV]       = useState(false)
  const [loadingCols, setLoadingCols] = useState(false)
  const [apiWaking, setApiWaking]     = useState(false)

  // Config state
  const [toolType, setToolType]     = useState<'MRR' | 'ACV'>('MRR')
  const [revenueUnit, setRevenueUnit] = useState('raw')
  const [selectedModules, setSelectedModules] = useState<string[]>(['bridge', 'top_movers', 'top_customers', 'kpi_matrix'])
  const [lookbacks, setLookbacks]   = useState<number[]>([1, 3, 12])
  const [dimensions, setDimensions] = useState<string[]>([])
  const [customerCol, setCustomerCol] = useState('Customer_ID')
  const [nMovers, setNMovers]       = useState(30)
  const [nCustomers, setNCustomers] = useState(10)
  const [periodType, setPeriodType] = useState('Annual')

  // Results state
  const [results, setResults]     = useState<any>(null)
  const [running, setRunning]     = useState(false)
  const [error, setError]         = useState('')

  // Filter state
  const [selectedLookback, setSelectedLookback] = useState(12)
  const [yearFilter, setYearFilter] = useState('All')
  const [activeTab, setActiveTab] = useState('summary')
  const [activeMoverCat, setActiveMoverCat] = useState('')

  const isAdmin = canDownload(profile)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }
      supabase.from('profiles').select('*').eq('id', session.user.id).single()
        .then(({ data }) => { if (data) setProfile(data) })
    })
    fetch(`${API}/health`).catch(() => {})
  }, [router])

  async function readColumns(f: File) {
    setFile(f); setLoadingCols(true); setApiWaking(false); setError(''); setColumns([])
    const wakeTimer = setTimeout(() => setApiWaking(true), 5000)
    try {
      const fd = new FormData(); fd.append('file', f)
      const { data } = await axios.post(`${API}/api/columns`, fd, { timeout: 60000 })
      clearTimeout(wakeTimer); setApiWaking(false)
      setColumns(data.columns); setRowCount(data.row_count)
      setIsBridgeOutput(data.is_bridge_output)
      setIsACV(data.is_acv)
      if (data.is_acv) setToolType('ACV')

      // Auto-detect customer column
      const cols = data.columns.map((c: string) => c.toLowerCase())
      const find = (kw: string[]) => data.columns.find((_: string, i: number) => kw.some(k => cols[i].includes(k))) || ''
      const cust = find(['customer_id', 'customer id', 'customer', 'client'])
      if (cust) setCustomerCol(cust)

      // Auto-detect dimensions
      const dimCandidates = data.columns.filter((c: string) => {
        const cl = c.toLowerCase()
        return ['product', 'region', 'channel', 'vertical', 'vintage', 'segment'].some(k => cl.includes(k))
      })
      setDimensions(dimCandidates.slice(0, 3))

    } catch (e: any) {
      clearTimeout(wakeTimer); setApiWaking(false)
      setError(e.code === 'ECONNABORTED' ? 'API is starting — please try again in 10 seconds.' : `Could not read file: ${e?.response?.data?.detail || e.message}`)
    }
    setLoadingCols(false)
  }

  async function runAnalysis() {
    if (!file) { setError('Please upload a file first.'); return }
    setRunning(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('tool_type',      toolType)
      fd.append('revenue_unit',   revenueUnit)
      fd.append('lookbacks',      JSON.stringify(lookbacks))
      fd.append('dimension_cols', JSON.stringify(dimensions))
      fd.append('modules',        JSON.stringify([...selectedModules, 'output']))
      fd.append('year_filter',    yearFilter !== 'All' ? yearFilter : '')
      fd.append('period_type',    periodType)
      fd.append('customer_col',   customerCol)
      fd.append('n_movers',       String(nMovers))
      fd.append('n_customers',    String(nCustomers))

      const { data } = await axios.post(`${API}/api/bridge/analyze`, fd, { timeout: 120000 })
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
    a.download = `revenuelens_bridge_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  // Derived data
  const lb_str = String(selectedLookback)
  const bridgeData   = results?.bridge?.[lb_str]
  const retention    = bridgeData?.retention
  const waterfall    = bridgeData?.waterfall || []
  const fiscalYears  = results?.metadata?.fiscal_years || []
  const kpiRows      = results?.kpi_matrix || []
  const topMovers    = results?.top_movers || {}
  const topCustomers = results?.top_customers || []
  const fySummary    = results?.fy_summary || []

  const filteredFY = yearFilter === 'All' ? fySummary : fySummary.filter((r: any) => String(r.fiscal_year) === yearFilter)

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

        {/* Logo */}
        <div className="h-14 flex items-center gap-2.5 px-5 border-b border-ink-100">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
            <BarChart3 size={14} className="text-white"/>
          </div>
          <div>
            <div className="font-display font-800 text-ink-900 text-[13px] leading-none">RevenueLens</div>
            <div className="text-[9px] text-ink-400 font-600 uppercase tracking-wider mt-0.5">Command Center</div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">

          {/* Upload section */}
          <div className="p-4 border-b border-ink-100">
            <div className="text-[9px] font-700 text-ink-400 uppercase tracking-widest mb-3">1. Upload & Map Data</div>
            <div className="text-[10px] text-ink-500 mb-2">Ingest bridge output from Alteryx or cohort engine.</div>

            {error && (
              <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-[11px] flex items-start gap-1.5">
                <AlertCircle size={11} className="flex-shrink-0 mt-0.5"/> {error}
              </div>
            )}

            {/* Drop zone */}
            <div className={`rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-all ${
              file && columns.length > 0 ? 'border-green-400 bg-green-50' : 'border-ink-200 hover:border-brand-300 bg-ink-50/30'
            }`} onClick={() => fileRef.current?.click()}>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) readColumns(f) }}/>
              {loadingCols ? (
                <div>
                  <Loader2 size={20} className="text-brand-500 animate-spin mx-auto mb-1.5"/>
                  <div className="text-[11px] text-ink-600 font-600">{apiWaking ? 'API waking up...' : 'Reading file...'}</div>
                </div>
              ) : file && columns.length > 0 ? (
                <div>
                  <CheckCircle size={20} className="text-green-500 mx-auto mb-1.5"/>
                  <div className="text-[11px] font-700 text-ink-900 truncate">{file.name}</div>
                  <div className="text-[10px] text-ink-400">{rowCount.toLocaleString()} rows · {columns.length} cols</div>
                </div>
              ) : (
                <div>
                  <Upload size={20} className="text-ink-300 mx-auto mb-1.5"/>
                  <div className="text-[11px] text-ink-600 font-600">Drag CSV or Excel, or click</div>
                </div>
              )}
            </div>

            {/* Dataset type chips */}
            {columns.length > 0 && (
              <div className="flex gap-1.5 mt-2">
                {(['MRR', 'ACV'] as const).map(t => (
                  <button key={t} onClick={() => setToolType(t)}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-700 border transition-all ${
                      toolType === t ? 'bg-brand-600 text-white border-brand-600' : 'border-ink-200 text-ink-500 hover:border-ink-300'
                    }`}>{t}</button>
                ))}
              </div>
            )}
          </div>

          {/* Select data section */}
          {columns.length > 0 && (
            <div className="p-4 border-b border-ink-100">
              <div className="text-[9px] font-700 text-ink-400 uppercase tracking-widest mb-3">2. Select Data</div>

              {/* Dimensions */}
              <div className="mb-3">
                <div className="text-[10px] font-600 text-ink-600 mb-1.5">Dimensions (optional)</div>
                {columns.filter(c => {
                  const cl = c.toLowerCase()
                  return ['product','region','channel','vertical','vintage','segment','geo'].some(k => cl.includes(k))
                }).map(col => (
                  <label key={col} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input type="checkbox" checked={dimensions.includes(col)} className="accent-brand-600"
                      onChange={e => setDimensions(prev => e.target.checked ? [...prev, col] : prev.filter(d => d !== col))}/>
                    <span className="text-[11px] text-ink-700">{col}</span>
                  </label>
                ))}
              </div>

              {/* Revenue units */}
              <div className="mb-3">
                <div className="text-[10px] font-600 text-ink-600 mb-1.5">Revenue Units</div>
                <div className="grid grid-cols-3 gap-1">
                  {[['raw', 'As-is'], ['thousands', '÷ 1K'], ['millions', '÷ 1M']].map(([val, lbl]) => (
                    <button key={val} onClick={() => setRevenueUnit(val)}
                      className={`py-1 rounded text-[10px] font-600 border transition-all ${
                        revenueUnit === val ? 'bg-brand-600 text-white border-brand-600' : 'border-ink-200 text-ink-500'
                      }`}>{lbl}</button>
                  ))}
                </div>
              </div>

              {/* Lookbacks */}
              <div>
                <div className="text-[10px] font-600 text-ink-600 mb-1.5">Lookback Windows</div>
                <div className="flex gap-1">
                  {[1, 3, 6, 12].map(lb => (
                    <button key={lb} onClick={() => setLookbacks(prev => prev.includes(lb) ? prev.filter(x => x !== lb) : [...prev, lb])}
                      className={`flex-1 py-1.5 rounded text-[10px] font-700 border transition-all ${
                        lookbacks.includes(lb) ? 'bg-brand-600 text-white border-brand-600' : 'border-ink-200 text-ink-500'
                      }`}>{lb}M</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Map columns / Modules */}
          {columns.length > 0 && (
            <div className="p-4 border-b border-ink-100">
              <div className="text-[9px] font-700 text-ink-400 uppercase tracking-widest mb-3">3. Map Columns</div>

              {/* Provided data table */}
              <div className="rounded-xl border border-ink-200 overflow-hidden mb-3">
                <div className="px-3 py-2 bg-ink-50 border-b border-ink-200">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-[9px] font-700 text-ink-400 uppercase tracking-widest">Uploaded Columns</div>
                    <div className="text-[9px] font-700 text-ink-400 uppercase tracking-widest">Map To</div>
                  </div>
                </div>
                {[
                  { src: 'customer', dst: 'Customer ID', setter: setCustomerCol, val: customerCol },
                ].map(f => (
                  <div key={f.src} className="grid grid-cols-2 gap-2 px-3 py-1.5 border-b border-ink-50">
                    <div className="text-[10px] text-ink-600 flex items-center">{f.val || '—'}</div>
                    <select value={f.val} onChange={e => f.setter(e.target.value)}
                      className="text-[10px] border border-ink-200 rounded px-1.5 py-1 bg-white text-ink-700 outline-none">
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {/* Period type */}
              <div className="flex gap-1">
                {['Annual', 'Quarter'].map(p => (
                  <button key={p} onClick={() => setPeriodType(p)}
                    className={`flex-1 py-1.5 rounded text-[10px] font-700 border transition-all ${
                      periodType === p ? 'bg-brand-600 text-white border-brand-600' : 'border-ink-200 text-ink-500'
                    }`}>{p}</button>
                ))}
              </div>
            </div>
          )}

          {/* Module selection */}
          {columns.length > 0 && (
            <div className="p-4">
              <div className="text-[9px] font-700 text-ink-400 uppercase tracking-widest mb-3">4. Analyse Metrics</div>
              <div className="space-y-1">
                {MODULES.map(m => (
                  <label key={m.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                    selectedModules.includes(m.id) ? 'border-brand-300 bg-brand-50' : 'border-ink-200 hover:border-ink-300'
                  }`}>
                    <input type="checkbox" checked={selectedModules.includes(m.id)} className="accent-brand-600"
                      onChange={e => setSelectedModules(prev => e.target.checked ? [...prev, m.id] : prev.filter(x => x !== m.id))}/>
                    <m.icon size={12} className={selectedModules.includes(m.id) ? 'text-brand-600' : 'text-ink-400'}/>
                    <span className="text-[11px] font-600 text-ink-900">{m.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Analyze button */}
        {columns.length > 0 && (
          <div className="p-4 border-t border-ink-100">
            <button onClick={runAnalysis} disabled={running || selectedModules.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white font-700 text-sm py-3 rounded-xl hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              {running ? <Loader2 size={15} className="animate-spin"/> : <Play size={15}/>}
              {running ? 'Analysing...' : 'Analyze Metrics'}
            </button>
            {running && <div className="text-[10px] text-ink-400 text-center mt-1.5">First run may take 30-60s (API waking up)</div>}
          </div>
        )}

        {!columns.length && (
          <div className="p-4 mt-auto border-t border-ink-100">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2">
              <AlertTriangle size={12} className="text-blue-500 mt-0.5 flex-shrink-0"/>
              <div className="text-[10px] text-blue-700">
                <strong>First upload may take 30-60s.</strong> The analytics engine wakes up on first use.
              </div>
            </div>
          </div>
        )}
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
