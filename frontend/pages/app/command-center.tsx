// @ts-nocheck
import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { Upload, Play, Download, Loader2, CheckCircle, AlertCircle, BarChart3, TrendingUp, Users, DollarSign, Layers, Target, RefreshCw, Lock, ArrowUp, ArrowDown, FileText, Home, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase, canDownload } from '../../lib/supabase'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://revenuelens-api.onrender.com'

const BRIDGE_COLORS = { 'New Logo':'#10B981','Cross-sell':'#3B82F6','Other In':'#22C55E','Returning':'#F59E0B','Upsell':'#6366F1','Downsell':'#F97316','Add on':'#8B5CF6','Add-on':'#8B5CF6','Churn':'#EF4444','Churn Partial':'#FCA5A5','Churn-Partial':'#FCA5A5','Other Out':'#94A3B8','Lapsed':'#CBD5E1','Beginning MRR':'#1E293B','Ending MRR':'#1E293B','Prior ACV':'#1E293B','Ending ACV':'#1E293B','RoB':'#A78BFA','Expiry Pool':'#374151' }
const CHART_COLORS = ['#1A3CF5','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316']
const fmt = (v) => { if(v==null)return'—'; if(Math.abs(v)>=1e6)return`$${(v/1e6).toFixed(1)}M`; if(Math.abs(v)>=1e3)return`$${(v/1e3).toFixed(0)}K`; return`$${v.toFixed(0)}` }
const fmtPct = (v) => v!=null?`${v.toFixed(1)}%`:'—'

// ─────────────────────────────────────────────────────────────────────
// ENGINE CONFIG — exact required/optional fields per engine
// Based on Alteryx workflow analysis:
//   MRR: Customer + Date + MRR/ARR required
//   ACV: Customer + Contract Start + Contract End + TCV/ACV required
//   Cohort: Customer + Date + Fiscal Year + Revenue required
// ─────────────────────────────────────────────────────────────────────
const ENGINE_CONFIG = {
  mrr: {
    label: 'MRR / ARR Analytics',
    desc:  'Revenue bridge, retention, NRR/GRR, top movers',
    icon:  TrendingUp,
    required: [
      { key:'customer', label:'Customer / Account ID', kw:['customer','customer_id','customerid','client','account'] },
      { key:'date',     label:'Date / Period',          kw:['date','activity_date','period','month'] },
      { key:'revenue',  label:'MRR / ARR',              kw:['mrr','arr','revenue','amount','value','bridge value','bridge_value'] },
    ],
    optional: [
      { key:'product',  label:'Product',         kw:['product','sku','service'] },
      { key:'channel',  label:'Channel',         kw:['channel','segment'] },
      { key:'region',   label:'Region',          kw:['region','geo','geography'] },
      { key:'quantity', label:'Quantity / Units', kw:['quantity','qty','units','seats'] },
      { key:'lookback', label:'Month Lookback',   kw:['month_lookback','month lookback','lookback'] },
      { key:'classify', label:'Bridge Classification', kw:['bridge classification','bridge_classification','classification'] },
    ],
  },
  acv: {
    label: 'ACV / Contract Analytics',
    desc:  'Contract bridge, renewal rates, expiry pool',
    icon:  FileText,
    required: [
      { key:'customer',      label:'Customer / Account ID',  kw:['customer','customer_id','customerid','client','account'] },
      { key:'date',          label:'Activity / Signing Date', kw:['date','activity_date','signing_date','order_date','period'] },
      { key:'contractStart', label:'Contract Start Date',    kw:['contract_start','start_date','startdate','contract_begin','start'] },
      { key:'contractEnd',   label:'Contract End Date',      kw:['contract_end','end_date','enddate','expiry','expiration','end'] },
      { key:'tcv',           label:'TCV / ACV Amount',       kw:['tcv','acv','total_contract','contract_value','amount','revenue'] },
    ],
    optional: [
      { key:'product',  label:'Product',          kw:['product','sku'] },
      { key:'channel',  label:'Channel',          kw:['channel','segment'] },
      { key:'region',   label:'Region',           kw:['region','geo','country'] },
      { key:'quantity', label:'Quantity / Seats', kw:['quantity','qty','units','seats'] },
    ],
  },
  cohort: {
    label: 'Cohort Analytics',
    desc:  'Retention heatmap, size/percentile/revenue cohorts',
    icon:  Layers,
    required: [
      { key:'customer', label:'Customer / Account ID', kw:['customer','customer_id','customerid','client','account'] },
      { key:'date',     label:'Date / Period',          kw:['date','activity_date','period','month'] },
      { key:'fiscal',   label:'Fiscal Year',            kw:['fiscal','fy','fiscal_year','year'] },
      { key:'revenue',  label:'Revenue / MRR',          kw:['mrr','arr','revenue','amount','value'] },
    ],
    optional: [
      { key:'product',  label:'Product',  kw:['product','sku'] },
      { key:'region',   label:'Region',   kw:['region','geo'] },
      { key:'channel',  label:'Channel',  kw:['channel','segment'] },
    ],
  },
}

const COHORT_TYPES_CFG = [
  { id:'SG', label:'Size Cohorts',        desc:'Tier 1 / Tier 2 / Tier 3 / Long Tail' },
  { id:'PC', label:'Percentile Cohorts',  desc:'Top 5% / 10% / 20% / 50%' },
  { id:'RC', label:'Revenue Cohorts',     desc:'Revenue Leaders / Growth / Tail' },
]

// ── Auto-detect columns ───────────────────────────────────────────────
function autoDetect(cols, kws) {
  const n = s => s.toLowerCase().replace(/[^a-z0-9]/g,'')
  const nkws = kws.map(n)
  return cols.find(c => nkws.includes(n(c)))
      || cols.find(c => nkws.some(k => n(c).includes(k) || k.includes(n(c))))
      || ''
}

function buildAutoMap(eng, cols) {
  if(!eng || !cols.length) return {}
  const cfg = ENGINE_CONFIG[eng]
  const map = {}
  ;[...cfg.required, ...cfg.optional].forEach(f => {
    const v = autoDetect(cols, f.kw)
    if(v) map[f.key] = v
  })
  return map
}

// ── Upload timer ──────────────────────────────────────────────────────
function UploadTimer({active}) {
  const [s,setS] = useState(0)
  useEffect(() => {
    if(!active){setS(0);return}
    const t = setInterval(() => setS(n=>n+1), 1000)
    return () => clearInterval(t)
  },[active])
  if(!active) return null
  const pct = Math.min((s/90)*100, 98)
  const msg = s<8?'Connecting...': s<25?'API waking up...': s<55?'Processing file...':'Almost ready...'
  return (
    <div className="mt-2 px-1">
      <div className="flex justify-between mb-1">
        <span className="text-[10px] text-ink-500">{msg}</span>
        <span className="text-[10px] font-700 text-brand-600">{s}s</span>
      </div>
      <div className="h-1 bg-ink-200 rounded-full overflow-hidden">
        <div className="h-full bg-brand-500 rounded-full transition-all duration-1000" style={{width:`${pct}%`}}/>
      </div>
      {s > 6 && <div className="text-[9px] text-ink-400 mt-1">⏳ First use each session takes 30-90s</div>}
    </div>
  )
}

// ── Step badge ────────────────────────────────────────────────────────
function Step({n, label, done, active}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${active?'bg-brand-50 border border-brand-200':''}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-700 flex-shrink-0 ${done?'bg-green-500 text-white':active?'bg-brand-600 text-white':'bg-ink-200 text-ink-500'}`}>
        {done?'✓':n}
      </div>
      <span className={`text-[11px] font-600 ${active?'text-brand-700':done?'text-ink-600':'text-ink-400'}`}>{label}</span>
    </div>
  )
}

// ── Field mapping row ─────────────────────────────────────────────────
function FieldRow({label, required, value, columns, onChange, showError}) {
  const hasVal = !!value
  return (
    <div className="grid grid-cols-2 gap-2 px-3 py-2 border-b border-ink-50 last:border-0">
      <div className="flex items-center gap-1 min-w-0">
        <span className="text-[11px] text-ink-700 truncate">{label}</span>
        {required && <span className="text-red-400 text-[10px] flex-shrink-0">*</span>}
      </div>
      <select value={value} onChange={e=>onChange(e.target.value)}
        className={`text-[10px] border rounded px-1.5 py-1 bg-white text-ink-800 outline-none w-full transition-colors ${
          showError && !hasVal ? 'border-red-300 bg-red-50' : hasVal ? 'border-green-300 bg-green-50/20' : 'border-ink-200'
        }`}>
        <option value="">— Select column —</option>
        {columns.map(c=><option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  )
}

// ── Charts ────────────────────────────────────────────────────────────
function KpiCard({label, value, good, icon:Icon, accent}) {
  return (
    <div className={`bg-white rounded-xl border p-4 ${accent?'border-t-2 border-t-brand-600':'border-ink-200'}`}>
      {Icon && <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${good===true?'bg-green-50':good===false?'bg-red-50':'bg-brand-50'}`}>
        <Icon size={15} className={good===true?'text-green-600':good===false?'text-red-500':'text-brand-600'}/>
      </div>}
      <div className="text-[9px] font-700 text-ink-400 uppercase tracking-widest mb-1">{label}</div>
      <div className={`font-display text-xl font-800 ${accent?'text-brand-600':'text-ink-900'}`}>{value}</div>
    </div>
  )
}
function RetentionCard({label, value, good}) {
  return (
    <div className={`p-4 rounded-xl border ${good?'bg-green-50 border-green-200':'bg-red-50 border-red-200'}`}>
      <div className="text-[9px] font-700 uppercase tracking-widest mb-1 text-ink-500">{label}</div>
      <div className={`font-display text-2xl font-800 ${good?'text-green-700':'text-red-600'}`}>{value}</div>
    </div>
  )
}
function WaterfallChart({data}) {
  if(!data?.length) return <div className="h-56 flex items-center justify-center text-ink-400 text-sm">No bridge data</div>
  const sorted = [...data].filter(d=>!['Beginning MRR','Ending MRR','Prior ACV','Ending ACV'].includes(d.category)).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value))
  return (
    <div className="h-56"><ResponsiveContainer width="100%" height="100%">
      <BarChart data={sorted} margin={{top:5,right:5,bottom:50,left:10}}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F8" vertical={false}/>
        <XAxis dataKey="category" tick={{fontSize:10,fill:'#8C95A6'}} angle={-35} textAnchor="end" interval={0}/>
        <YAxis tickFormatter={fmt} tick={{fontSize:10,fill:'#8C95A6'}} width={50}/>
        <Tooltip formatter={(v,_,p)=>[fmt(Number(v)),p.payload.category]} contentStyle={{fontSize:12}}/>
        <Bar dataKey="value" radius={[3,3,0,0]}>
          {sorted.map((e,i)=><Cell key={i} fill={BRIDGE_COLORS[e.category]||'#CBD5E1'}/>)}
        </Bar>
      </BarChart>
    </ResponsiveContainer></div>
  )
}
function CohortHeatmap({data, title, isPercent}) {
  if(!data?.length) return <div className="text-center text-ink-400 text-sm py-6">No data available</div>
  const allKeys = Array.from(new Set(data.flatMap(r=>Object.keys(r).filter(k=>k!=='cohort')))).sort((a,b)=>Number(a)-Number(b))
  const allVals = data.flatMap(r=>allKeys.map(k=>r[k]||0)).filter(v=>v>0)
  const maxVal = Math.max(...allVals, 1)
  const color = (v) => {
    if(v==null||v===0) return '#F8F9FB'
    if(!isPercent) return `rgba(26,60,245,${0.1+(v/maxVal)*0.8})`
    if(v>=90)return'#1A3CF5'; if(v>=70)return'#3D5EFF'; if(v>=50)return'#6285FF'
    if(v>=30)return'#BACBFF'; if(v>=10)return'#D9E4FF'; return '#EEF3FF'
  }
  const textCol = (v) => {
    if(!v||v===0) return 'transparent'
    if(isPercent && v>=50) return 'white'
    return '#374151'
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-700 text-ink-500 uppercase tracking-widest">{title}</div>
        <div className="text-[9px] text-ink-400">{allKeys.length} periods · {data.length} cohorts</div>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs" style={{minWidth: allKeys.length*40+120}}>
          <thead><tr>
            <th className="text-left py-1.5 pr-3 font-600 text-ink-500 sticky left-0 bg-white whitespace-nowrap">Cohort</th>
            {allKeys.map(k=><th key={k} className="px-0.5 text-center font-600 text-ink-400 whitespace-nowrap">M{k}</th>)}
          </tr></thead>
          <tbody>
            {data.map((row,ri)=>(
              <tr key={ri}>
                <td className="py-0.5 pr-3 font-600 text-ink-700 whitespace-nowrap sticky left-0 bg-white">{row.cohort}</td>
                {allKeys.map(k=>{
                  const v=row[k]
                  const empty=v==null||v===0
                  return (
                    <td key={k} className="px-0.5 py-0.5">
                      <div className="w-9 h-6 rounded flex items-center justify-center text-[9px] font-600"
                        style={{background:color(v), color:textCol(v)}}>
                        {empty?'': isPercent?`${v}%`:fmt(v)}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[9px] text-ink-400">Low</span>
        {[10,30,50,70,90].map(v=><div key={v} className="w-4 h-2.5 rounded" style={{background:isPercent?color(v):`rgba(26,60,245,${0.1+(v/100)*0.8})`}}/>)}
        <span className="text-[9px] text-ink-400">High</span>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════
export default function CommandCenter() {
  const router = useRouter()
  const fileRef = useRef(null)
  const [profile, setProfile] = useState(null)

  // Step 1 — Upload
  const [file, setFile]         = useState(null)
  const [columns, setColumns]   = useState([])
  const [rowCount, setRowCount] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')

  // Step 2 — Engine
  const [engine, setEngine] = useState(null)

  // Step 3 — Field mapping
  const [fieldMap, setFieldMap]   = useState({})
  const [showOpt, setShowOpt]     = useState(false)
  const [validated, setValidated] = useState(false)

  // Step 4 — Cohort config
  const [cohortTypes, setCohortTypes]     = useState(['SG','PC','RC'])
  const [periodFilter, setPeriodFilter]   = useState('all')
  const [selectedFY, setSelectedFY]       = useState('')
  const [cohortGroupBy, setCohortGroupBy] = useState([])

  // Step 4 — MRR/ACV config
  const [lookbacks, setLookbacks]   = useState([1,3,12])
  const [revenueUnit, setRevUnit]   = useState('raw')
  const [periodType, setPeriod]     = useState('Annual')

  // Results
  const [results, setResults]   = useState(null)
  const [running, setRunning]   = useState(false)
  const [runErr, setRunErr]     = useState('')
  const [selLb, setSelLb]       = useState(12)
  const [yearFilter, setYearFilter] = useState('All')
  const [activeTab, setActiveTab]   = useState('summary')
  const [moverCat, setMoverCat]     = useState('')

  const isAdmin = canDownload(profile)
  const cfg = engine ? ENGINE_CONFIG[engine] : null

  // Validation — check all required fields are mapped
  const errors = useMemo(() => {
    const e = {}
    if(!engine) return e
    ENGINE_CONFIG[engine].required.forEach(f => {
      if(!fieldMap[f.key]) e[f.key] = 'Required'
    })
    return e
  }, [engine, fieldMap])

  const step1  = columns.length > 0
  const step2  = step1 && !!engine
  const step3  = step2 && Object.keys(errors).length === 0
  const canRun = step3 && !running

  useEffect(() => {
    supabase.auth.getSession().then(({data:{session}}) => {
      if(!session){router.push('/auth/login');return}
      supabase.from('profiles').select('*').eq('id',session.user.id).single().then(({data})=>{if(data)setProfile(data)})
    })
    fetch(`${API}/health`).catch(()=>{})
  },[router])

  // Auto-detect fields on engine or file change
  useEffect(() => {
    if(!engine || !columns.length) return
    setFieldMap(buildAutoMap(engine, columns))
    setShowOpt(false)
    setValidated(false)
  },[engine, columns])

  async function uploadFile(f) {
    setFile(f); setUploading(true); setUploadErr(''); setColumns([]); setEngine(null); setFieldMap({}); setResults(null)
    try {
      const fd = new FormData(); fd.append('file', f)
      const {data} = await axios.post(`${API}/api/columns`, fd, {timeout:90000})
      setColumns(data.columns); setRowCount(data.row_count)
      // Auto-suggest engine
      if(data.is_acv) setEngine('acv')
      else if(data.is_bridge_output) setEngine('mrr')
    } catch(e) {
      setUploadErr(e.code==='ECONNABORTED' ? 'Timed out — try again in 10s.' : `Could not read file: ${e?.response?.data?.detail||e.message}`)
    }
    setUploading(false)
  }

  async function runAnalysis() {
    setValidated(true)
    if(!canRun) return
    setRunning(true); setRunErr('')
    try {
      const fd = new FormData(); fd.append('file', file)

      if(engine === 'cohort') {
        fd.append('metric',       fieldMap.revenue||'')
        fd.append('customer_col', fieldMap.customer||'')
        fd.append('date_col',     fieldMap.date||'')
        fd.append('fiscal_col',   fieldMap.fiscal||'None')
        fd.append('cohort_types', JSON.stringify(cohortTypes))
        fd.append('period_filter', periodFilter)
        fd.append('selected_fiscal_year', selectedFY)
        const dims = ['product','region','channel'].map(k=>fieldMap[k]).filter(Boolean)
        fd.append('individual_cols', JSON.stringify(dims))
        fd.append('hierarchies', JSON.stringify([]))
        const {data} = await axios.post(`${API}/api/cohort/analyze`, fd, {timeout:120000})
        setResults({...data, _engine:'cohort'})
        setActiveTab('heatmap')
      } else {
        fd.append('tool_type',    engine==='acv'?'ACV':'MRR')
        fd.append('revenue_unit', revenueUnit)
        fd.append('lookbacks',    JSON.stringify(lookbacks))
        const dims = ['product','channel','region'].map(k=>fieldMap[k]).filter(Boolean)
        fd.append('dimension_cols', JSON.stringify(dims))
        fd.append('modules', JSON.stringify(['bridge','top_movers','top_customers','kpi_matrix','output']))
        fd.append('year_filter',  yearFilter!=='All'?yearFilter:'')
        fd.append('period_type',  periodType)
        fd.append('customer_col', fieldMap.customer||'Customer_ID')
        fd.append('n_movers',     '30')
        fd.append('n_customers',  '10')
        const {data} = await axios.post(`${API}/api/bridge/analyze`, fd, {timeout:120000})
        setResults({...data, _engine:engine})
        setActiveTab('summary')
        if(lookbacks.length) setSelLb(lookbacks[lookbacks.length-1])
        const cats = Object.keys(data.top_movers||{}); if(cats.length) setMoverCat(cats[0])
      }
    } catch(e) { setRunErr(e?.response?.data?.detail||'Analysis failed. Please try again.') }
    setRunning(false)
  }

  function downloadCSV() {
    const out = results?.output||[]
    if(!out.length) return
    const keys = Object.keys(out[0])
    const csv = [keys.join(','),...out.map(r=>keys.map(k=>`"${r[k]??''}"`).join(','))].join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
    a.download = `revenuelens_${engine}_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  }

  // Derived
  const lb       = String(selLb)
  const bdg      = results?.bridge?.[lb]
  const ret      = bdg?.retention
  const wfall    = bdg?.waterfall||[]
  const fyYears  = results?.metadata?.fiscal_years||results?.fiscal_years||[]
  const kpiRows  = results?.kpi_matrix||[]
  const movers   = results?.top_movers||{}
  const topCusts = results?.top_customers||[]
  const fySumm   = results?.fy_summary||[]
  const filtFY   = yearFilter==='All'?fySumm:fySumm.filter(r=>String(r.fiscal_year)===yearFilter)
  const isCohort = results?._engine==='cohort'

  const TABS = isCohort ? [
    {id:'heatmap',        label:'Retention Heatmap'},
    {id:'revenue_heatmap',label:'Revenue Heatmap'},
    {id:'segmentation',   label:'Segmentation'},
    {id:'summary',        label:'Summary'},
    {id:'output',         label:'Output Table'},
  ] : [
    {id:'summary',       label:'Summary'},
    {id:'bridge',        label:'Revenue Bridge'},
    {id:'retention',     label:'Retention'},
    {id:'top_movers',    label:'Top Movers'},
    {id:'top_customers', label:'Top Customers'},
    {id:'kpi_matrix',    label:'KPI Matrix'},
    {id:'output',        label:'Output Table'},
  ]

  return (
    <div className="flex h-screen bg-[#F6F7F9] overflow-hidden" style={{fontFamily:"'DM Sans',sans-serif"}}>

      {/* LEFT SIDEBAR */}
      <aside className="w-72 bg-white border-r border-ink-200 flex flex-col overflow-hidden flex-shrink-0">

        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-ink-100 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0"><BarChart3 size={14} className="text-white"/></div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-800 text-ink-900 text-[13px] leading-none">RevenueLens</div>
            <div className="text-[9px] text-ink-400 font-600 uppercase tracking-wider mt-0.5">Command Center</div>
          </div>
          <button onClick={()=>router.push('/dashboard')} className="flex items-center gap-1 text-[10px] text-ink-400 hover:text-ink-800 px-2 py-1 rounded-lg hover:bg-ink-50 transition-all flex-shrink-0">
            <Home size={11}/> Home
          </button>
        </div>

        {/* Steps */}
        <div className="px-3 py-2 border-b border-ink-100 bg-ink-50/50 flex-shrink-0">
          <div className="space-y-0.5">
            <Step n={1} label="Upload Data"     done={step1}     active={!step1}/>
            <Step n={2} label="Select Engine"   done={step2}     active={step1&&!step2}/>
            <Step n={3} label="Map Fields"      done={step3}     active={step2&&!step3}/>
            <Step n={4} label="Configure & Run" done={!!results} active={step3&&!results}/>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* STEP 1: Upload */}
          <div className="p-4 border-b border-ink-100">
            <div className="text-[9px] font-700 text-ink-400 uppercase tracking-widest mb-2">1. Upload Data</div>
            {uploadErr && (
              <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-[10px] flex gap-1.5">
                <AlertCircle size={11} className="mt-0.5 flex-shrink-0"/><span>{uploadErr}</span>
              </div>
            )}
            <div onClick={()=>!uploading&&fileRef.current?.click()}
              className={`rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-all ${
                file&&columns.length?'border-green-400 bg-green-50':uploading?'border-brand-300 bg-brand-50/30':'border-ink-200 hover:border-brand-300 bg-ink-50/30'
              }`}>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)uploadFile(f)}}/>
              {uploading ? (
                <div><Loader2 size={18} className="text-brand-500 animate-spin mx-auto mb-1"/><div className="text-[11px] text-brand-700 font-600">Reading file...</div></div>
              ) : file&&columns.length ? (
                <div>
                  <CheckCircle size={18} className="text-green-500 mx-auto mb-1"/>
                  <div className="text-[11px] font-700 text-ink-900 truncate">{file.name}</div>
                  <div className="text-[10px] text-ink-500">{rowCount.toLocaleString()} rows · {columns.length} cols</div>
                  <button onClick={e=>{e.stopPropagation();fileRef.current?.click()}} className="text-[9px] text-brand-600 hover:underline mt-1 font-600">Change file</button>
                </div>
              ) : (
                <div>
                  <Upload size={18} className="text-ink-300 mx-auto mb-1"/>
                  <div className="text-[11px] text-ink-600 font-600">Click or drag CSV / Excel</div>
                  <div className="text-[10px] text-ink-400 mt-0.5">Raw data or Alteryx output</div>
                </div>
              )}
            </div>
            <UploadTimer active={uploading}/>
          </div>

          {/* STEP 2: Select Engine */}
          {step1 && (
            <div className="p-4 border-b border-ink-100">
              <div className="text-[9px] font-700 text-ink-400 uppercase tracking-widest mb-2">2. Select Engine</div>
              <div className="space-y-1.5">
                {Object.entries(ENGINE_CONFIG).map(([id,ec]) => {
                  const Icon = ec.icon; const active = engine===id
                  return (
                    <button key={id} onClick={()=>setEngine(id)}
                      className={`w-full flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${active?'border-brand-400 bg-brand-50 shadow-sm':'border-ink-200 hover:border-ink-300 bg-white'}`}>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${active?'bg-brand-600':'bg-ink-100'}`}>
                        <Icon size={13} className={active?'text-white':'text-ink-500'}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[12px] font-700 leading-tight ${active?'text-brand-700':'text-ink-900'}`}>{ec.label}</div>
                        <div className="text-[10px] text-ink-400 mt-0.5 leading-snug">{ec.desc}</div>
                      </div>
                      {active && <CheckCircle size={14} className="text-brand-600 flex-shrink-0 mt-0.5"/>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Map Fields — dynamic per engine */}
          {step2 && cfg && (
            <div className="p-4 border-b border-ink-100">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[9px] font-700 text-ink-400 uppercase tracking-widest">3. Map Fields</div>
                <span className={`text-[9px] font-600 ${Object.keys(errors).length===0?'text-green-600':'text-amber-600'}`}>
                  {cfg.required.filter(f=>!!fieldMap[f.key]).length}/{cfg.required.length} required mapped
                </span>
              </div>

              {/* Required fields */}
              <div className="rounded-xl border border-ink-200 overflow-hidden mb-2">
                <div className="px-3 py-1.5 bg-ink-50 border-b border-ink-100 flex items-center justify-between">
                  <span className="text-[9px] font-700 text-ink-500 uppercase tracking-widest">Required</span>
                  <span className="text-[9px] text-ink-400">{cfg.required.length} fields</span>
                </div>
                {cfg.required.map(f => (
                  <FieldRow key={f.key} label={f.label} required
                    value={fieldMap[f.key]||''} columns={columns}
                    onChange={v=>setFieldMap(m=>({...m,[f.key]:v}))}
                    showError={validated}
                  />
                ))}
              </div>

              {/* Optional fields */}
              <div className="rounded-xl border border-ink-200 overflow-hidden">
                <button onClick={()=>setShowOpt(v=>!v)}
                  className="w-full px-3 py-1.5 bg-ink-50 flex items-center justify-between hover:bg-ink-100 transition-colors">
                  <span className="text-[9px] font-700 text-ink-500 uppercase tracking-widest">Optional Fields</span>
                  {showOpt?<ChevronUp size={11} className="text-ink-400"/>:<ChevronDown size={11} className="text-ink-400"/>}
                </button>
                {showOpt && cfg.optional.map(f => (
                  <FieldRow key={f.key} label={f.label}
                    value={fieldMap[f.key]||''} columns={columns}
                    onChange={v=>setFieldMap(m=>({...m,[f.key]:v}))}
                    showError={false}
                  />
                ))}
              </div>

              {/* Validation errors */}
              {validated && Object.keys(errors).length > 0 && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-[10px] font-600 text-red-700 mb-1">Map these required fields:</div>
                  {cfg.required.filter(f=>errors[f.key]).map(f => (
                    <div key={f.key} className="text-[9px] text-red-500">• {f.label}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Configure */}
          {step3 && (
            <div className="p-4">
              <div className="text-[9px] font-700 text-ink-400 uppercase tracking-widest mb-3">4. Configure & Run</div>

              {engine === 'cohort' && (
                <div className="space-y-3">
                  <div>
                    <div className="text-[10px] font-600 text-ink-600 mb-1.5">Cohort Types</div>
                    <div className="space-y-1">
                      {COHORT_TYPES_CFG.map(ct => (
                        <label key={ct.id} className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all ${cohortTypes.includes(ct.id)?'border-brand-300 bg-brand-50':'border-ink-200 hover:border-ink-300'}`}>
                          <input type="checkbox" checked={cohortTypes.includes(ct.id)} className="mt-0.5 accent-brand-600 flex-shrink-0"
                            onChange={e=>setCohortTypes(p=>e.target.checked?[...p,ct.id]:p.filter(x=>x!==ct.id))}/>
                          <div>
                            <div className="text-[11px] font-700 text-ink-900">{ct.label}</div>
                            <div className="text-[9px] text-ink-400">{ct.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-600 text-ink-600 mb-1.5">Period Filter</div>
                    <div className="flex gap-1 mb-1.5">
                      {[['all','All Time'],['latest','Latest'],['fiscal_year','By FY']].map(([v,l]) => (
                        <button key={v} onClick={()=>setPeriodFilter(v)}
                          className={`flex-1 py-1 rounded text-[10px] font-600 border transition-all ${periodFilter===v?'bg-brand-600 text-white border-brand-600':'border-ink-200 text-ink-500'}`}>{l}</button>
                      ))}
                    </div>
                    {periodFilter==='fiscal_year' && (
                      <input value={selectedFY} onChange={e=>setSelectedFY(e.target.value)}
                        placeholder="e.g. FY2024"
                        className="w-full text-[11px] border border-ink-200 rounded-lg px-2 py-1.5 outline-none focus:border-brand-400"/>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] font-600 text-ink-600 mb-1.5">Cohort Grouping</div>
                    <div className="flex flex-wrap gap-1">
                      {['Product','Region','Channel','Industry','Country'].map(g => (
                        <button key={g} onClick={()=>setCohortGroupBy(p=>p.includes(g)?p.filter(x=>x!==g):[...p,g])}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-600 border transition-all ${cohortGroupBy.includes(g)?'bg-brand-600 text-white border-brand-600':'border-ink-200 text-ink-500'}`}>{g}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {engine !== 'cohort' && (
                <div className="space-y-3">
                  <div>
                    <div className="text-[10px] font-600 text-ink-600 mb-1">Lookback Windows</div>
                    <div className="flex gap-1">
                      {[1,3,6,12].map(lb => (
                        <button key={lb} onClick={()=>setLookbacks(p=>p.includes(lb)?p.filter(x=>x!==lb):[...p,lb])}
                          className={`flex-1 py-1 rounded text-[10px] font-700 border transition-all ${lookbacks.includes(lb)?'bg-brand-600 text-white border-brand-600':'border-ink-200 text-ink-500'}`}>{lb}M</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-600 text-ink-600 mb-1">Revenue Units</div>
                    <div className="grid grid-cols-3 gap-1">
                      {[['raw','As-is'],['thousands','÷ 1K'],['millions','÷ 1M']].map(([v,l]) => (
                        <button key={v} onClick={()=>setRevUnit(v)}
                          className={`py-1 rounded text-[10px] font-600 border transition-all ${revenueUnit===v?'bg-brand-600 text-white border-brand-600':'border-ink-200 text-ink-500'}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {['Annual','Quarter'].map(p => (
                      <button key={p} onClick={()=>setPeriod(p)}
                        className={`flex-1 py-1 rounded text-[10px] font-700 border transition-all ${periodType===p?'bg-brand-600 text-white border-brand-600':'border-ink-200 text-ink-500'}`}>{p}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom */}
        <div className="p-4 border-t border-ink-100 flex-shrink-0">
          {runErr && (
            <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-[10px] flex gap-1.5">
              <AlertCircle size={10} className="mt-0.5 flex-shrink-0"/>{runErr}
            </div>
          )}
          <button onClick={runAnalysis} disabled={!step1||!step2||running}
            title={!step1?'Upload a file first':!step2?'Select an engine':!step3?'Map all required fields':''}
            className={`w-full flex items-center justify-center gap-2 font-700 text-sm py-3 rounded-xl transition-all ${
              canRun?'bg-brand-600 text-white hover:bg-brand-700':
              step3?'bg-brand-400 text-white cursor-not-allowed':
              'bg-ink-200 text-ink-400 cursor-not-allowed'
            }`}>
            {running?<Loader2 size={15} className="animate-spin"/>:<Play size={15}/>}
            {running?'Running analysis...':'Analyze Metrics'}
          </button>
          {running && <UploadTimer active={running}/>}

          {results&&!running && (isAdmin ? (
            <button onClick={downloadCSV} className="w-full mt-2 flex items-center justify-center gap-2 border border-brand-300 text-brand-700 font-600 text-[11px] py-2 rounded-xl hover:bg-brand-50 transition-all">
              <Download size={12}/> Download Output CSV
            </button>
          ) : (
            <button disabled className="w-full mt-2 flex items-center justify-center gap-2 border border-ink-200 text-ink-400 font-600 text-[11px] py-2 rounded-xl cursor-not-allowed">
              <Lock size={12}/> Download / Export
              <span className="ml-auto text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-700">Premium</span>
            </button>
          ))}
          {!results&&!running && (
            <button disabled className="w-full mt-2 flex items-center justify-center gap-2 border border-ink-100 text-ink-300 font-600 text-[11px] py-2 rounded-xl cursor-not-allowed">
              <Lock size={12}/> Download / Export
              <span className="ml-auto text-[9px] bg-ink-100 text-ink-400 px-1.5 py-0.5 rounded-full font-700">Premium</span>
            </button>
          )}
        </div>
      </aside>

      {/* RIGHT PANEL */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <header className="h-14 bg-white border-b border-ink-200 flex items-center px-6 gap-4 flex-shrink-0">
          <div>
            <div className="text-sm font-700 text-ink-900">{isCohort?'Cohort Analytics':'Subscription Analytics'}</div>
            <div className="text-[10px] text-ink-400">{isCohort?'Retention heatmap · Revenue cohorts · Segmentation':'Real-time retention and revenue analytics'}</div>
          </div>
          <div className="flex-1"/>
          {results && (
            <div className="flex items-center gap-3">
              {!isCohort && (
                <>
                  <div className="flex items-center gap-1 p-0.5 bg-ink-100 rounded-lg">
                    {['Annual','Quarter'].map(p=><button key={p} onClick={()=>setPeriod(p)} className={`px-3 py-1 rounded-md text-[11px] font-600 transition-all ${periodType===p?'bg-white shadow-sm text-ink-900':'text-ink-500'}`}>{p==='Annual'?'Year Over Year':'Quarter'}</button>)}
                  </div>
                  {fyYears.length>0&&<select value={yearFilter} onChange={e=>setYearFilter(e.target.value)} className="text-[11px] border border-ink-200 rounded-lg px-2 py-1.5 bg-white text-ink-700 outline-none">
                    <option value="All">All Years</option>
                    {fyYears.map(fy=><option key={String(fy)} value={String(fy)}>{String(fy)}</option>)}
                  </select>}
                  <div className="flex items-center gap-1 p-0.5 bg-ink-100 rounded-lg">
                    {lookbacks.map(lb=><button key={lb} onClick={()=>setSelLb(lb)} className={`px-2.5 py-1 rounded-md text-[11px] font-600 transition-all ${selLb===lb?'bg-white shadow-sm text-ink-900':'text-ink-500'}`}>{lb}M</button>)}
                  </div>
                </>
              )}
              {isCohort&&fyYears.length>0&&(
                <select value={yearFilter} onChange={e=>setYearFilter(e.target.value)} className="text-[11px] border border-ink-200 rounded-lg px-2 py-1.5 bg-white text-ink-700 outline-none">
                  <option value="All">All Years</option>
                  {fyYears.map(fy=><option key={String(fy)} value={String(fy)}>{String(fy)}</option>)}
                </select>
              )}
              <button onClick={()=>{setResults(null);setFile(null);setColumns([]);setEngine(null);setFieldMap({})}} className="p-1.5 text-ink-400 hover:text-ink-700 rounded-lg hover:bg-ink-100"><RefreshCw size={14}/></button>
              {isAdmin?<button onClick={downloadCSV} className="flex items-center gap-1.5 bg-brand-600 text-white text-[11px] font-700 px-3 py-1.5 rounded-lg hover:bg-brand-700"><Download size={11}/> Export</button>
              :<button onClick={()=>router.push('/dashboard/upgrade')} className="flex items-center gap-1.5 text-[11px] font-600 text-ink-500 border border-ink-200 px-3 py-1.5 rounded-lg hover:bg-ink-50"><Lock size={11}/> Upgrade</button>}
            </div>
          )}
        </header>

        {/* Empty state */}
        {!results && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-lg">
              <div className="w-20 h-20 rounded-2xl bg-white border-2 border-ink-200 flex items-center justify-center mx-auto mb-5 shadow-sm">
                <BarChart3 size={32} className="text-brand-400"/>
              </div>
              <h2 className="font-display text-2xl font-800 text-ink-900 mb-2">
                {engine?ENGINE_CONFIG[engine].label:'Subscription Analytics'}
              </h2>
              <p className="text-ink-500 text-sm mb-6 leading-relaxed">
                {engine==='cohort'?'Upload data, map your fields, then click Analyze to see retention heatmaps and cohort insights.'
                :engine?'Upload data, map your fields, configure lookbacks, then click Analyze Metrics.'
                :'Upload your revenue data on the left, select an analytics engine, map your fields, and click Analyze Metrics.'}
              </p>
              <div className="grid grid-cols-3 gap-3">
                {(engine==='cohort'?[
                  {icon:Layers,   label:'Retention Heatmap',desc:'% retention across periods'},
                  {icon:DollarSign,label:'Revenue Heatmap', desc:'Absolute revenue by cohort'},
                  {icon:Users,    label:'Segmentation',     desc:'Size, Percentile, Revenue cohorts'},
                ]:[
                  {icon:TrendingUp,label:'Revenue Bridge',  desc:'Waterfall bridge with classifications'},
                  {icon:Target,   label:'Top Movers',       desc:'Biggest churners, new logos, upsells'},
                  {icon:Users,    label:'Top Customers',    desc:'Top N customers by ending ARR'},
                ]).map((m,i)=>(
                  <div key={i} className="bg-white rounded-xl border border-ink-200 p-4 text-left shadow-sm">
                    <m.icon size={16} className="text-brand-500 mb-2"/>
                    <div className="text-xs font-700 text-ink-900 mb-1">{m.label}</div>
                    <div className="text-[10px] text-ink-400">{m.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-ink-200 bg-white">
              <div className="grid grid-cols-6 gap-3">
                {isCohort ? (
                  <>
                    <KpiCard label="Total Revenue"  value={fmt(results.summary?.total_revenue)} accent icon={DollarSign}/>
                    <KpiCard label="Customers"       value={(results.summary?.n_customers||0).toLocaleString()} icon={Users}/>
                    <KpiCard label="Rev / Customer"  value={fmt(results.summary?.rev_per_customer)} icon={TrendingUp}/>
                    <KpiCard label="Rows Analyzed"   value={(results.summary?.rows_analyzed||0).toLocaleString()} icon={BarChart3}/>
                    <KpiCard label="Cohort Cols"     value={(results.summary?.cohort_cols?.length||0).toString()} icon={Layers}/>
                    <KpiCard label="Fiscal Years"    value={(results.fiscal_years?.length||0).toString()} icon={Target}/>
                  </>
                ) : (
                  <>
                    <KpiCard label="Total ARR"       value={fmt(ret?.ending)} accent icon={DollarSign}/>
                    <KpiCard label="New ARR"         value={fmt(ret?.new_arr)} good icon={ArrowUp}/>
                    <KpiCard label="Lost ARR"        value={fmt(Math.abs(ret?.lost_arr||0))} good={false} icon={ArrowDown}/>
                    <KpiCard label="Net Retention"   value={fmtPct(ret?.nrr)} good={(ret?.nrr||0)>=100} icon={TrendingUp}/>
                    <KpiCard label="Gross Retention" value={fmtPct(ret?.grr)} good={(ret?.grr||0)>=80} icon={Target}/>
                    <KpiCard label="Rows Analyzed"   value={(results.metadata?.row_count||0).toLocaleString()} icon={Users}/>
                  </>
                )}
              </div>
            </div>

            <div className="px-6 border-b border-ink-200 bg-white flex flex-shrink-0">
              {TABS.map(tab=>(
                <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
                  className={`px-4 py-3 text-[12px] font-600 border-b-2 transition-all -mb-px ${activeTab===tab.id?'border-brand-600 text-brand-600':'border-transparent text-ink-500 hover:text-ink-700'}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto p-6">

              {/* COHORT TABS */}
              {isCohort&&activeTab==='heatmap'&&(
                <div className="space-y-6">
                  <div className="bg-white rounded-xl border border-ink-200 p-5">
                    <CohortHeatmap data={results.retention} title="Retention Rate % by Cohort" isPercent={true}/>
                  </div>
                  {results.heatmap?.length>0&&(
                    <div className="bg-white rounded-xl border border-ink-200 p-5">
                      <CohortHeatmap data={results.heatmap} title="Customer Count by Cohort" isPercent={false}/>
                    </div>
                  )}
                </div>
              )}

              {isCohort&&activeTab==='revenue_heatmap'&&(
                <div className="space-y-5">
                  {results.fy_summary?.length>0 ? (
                    <div className="bg-white rounded-xl border border-ink-200 p-5">
                      <div className="text-[10px] font-700 text-ink-400 uppercase tracking-widest mb-4">Revenue by Fiscal Year</div>
                      <table className="w-full text-sm mb-6">
                        <thead><tr className="border-b border-ink-100">{['Fiscal Year','Revenue','Customers','Rev / Customer'].map(h=><th key={h} className="text-left py-2.5 pr-6 font-600 text-ink-500 text-xs uppercase">{h}</th>)}</tr></thead>
                        <tbody>{results.fy_summary.map((row,i)=>(
                          <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                            <td className="py-3 pr-6 font-700 text-ink-900">{String(Object.values(row)[0])}</td>
                            <td className="py-3 pr-6 text-ink-700">{fmt(row.revenue)}</td>
                            <td className="py-3 pr-6 text-ink-700">{row.customers?.toLocaleString()}</td>
                            <td className="py-3 pr-6 text-ink-700">{fmt(row.rev_per_customer)}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                      <div className="h-56"><ResponsiveContainer width="100%" height="100%">
                        <BarChart data={results.fy_summary}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F8" vertical={false}/>
                          <XAxis dataKey={Object.keys(results.fy_summary[0])[0]} tick={{fontSize:11,fill:'#8C95A6'}}/>
                          <YAxis tickFormatter={fmt} tick={{fontSize:11,fill:'#8C95A6'}}/>
                          <Tooltip formatter={v=>fmt(v)}/><Bar dataKey="revenue" fill="#1A3CF5" radius={[4,4,0,0]} name="Revenue"/>
                        </BarChart>
                      </ResponsiveContainer></div>
                    </div>
                  ):<div className="bg-white rounded-xl border border-ink-200 p-10 text-center text-ink-400 text-sm">No fiscal year data. Ensure Fiscal Year column is mapped.</div>}
                </div>
              )}

              {isCohort&&activeTab==='segmentation'&&results.segmentation?.length>0&&(
                <div className="grid lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-ink-200 p-5">
                    <div className="text-[10px] font-700 text-ink-400 uppercase tracking-widest mb-4">Revenue Segmentation</div>
                    <div className="h-56"><ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={results.segmentation} dataKey={Object.keys(results.segmentation[0]).find(k=>k!=='segment')||''} nameKey="segment" cx="50%" cy="50%" outerRadius={80} label={({segment,percent})=>`${segment} ${(percent*100).toFixed(0)}%`}>
                          {results.segmentation.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
                        </Pie>
                        <Tooltip formatter={v=>fmt(v)}/>
                      </PieChart>
                    </ResponsiveContainer></div>
                    <div className="mt-3 space-y-2">
                      {results.segmentation.map((r,i)=>{
                        const vk=Object.keys(r).find(k=>k!=='segment')||''
                        const total=results.segmentation.reduce((s,x)=>s+x[vk],0)
                        return (<div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{background:CHART_COLORS[i%CHART_COLORS.length]}}/><span className="text-sm text-ink-700">{r.segment}</span></div>
                          <div className="flex items-center gap-3"><span className="text-sm font-700 text-ink-900">{fmt(r[vk])}</span><span className="text-xs text-ink-400 w-12 text-right">{total>0?`${((r[vk]/total)*100).toFixed(1)}%`:'—'}</span></div>
                        </div>)
                      })}
                    </div>
                  </div>
                </div>
              )}

              {isCohort&&activeTab==='summary'&&(
                <div className="space-y-5">
                  {results.fy_summary?.length>0&&(
                    <div className="bg-white rounded-xl border border-ink-200 p-5">
                      <div className="text-[10px] font-700 text-ink-400 uppercase tracking-widest mb-4">Summary by Fiscal Year</div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead><tr className="border-b border-ink-100">{['Fiscal Year','Revenue','Customers','Rev / Customer'].map(h=><th key={h} className="text-left py-2.5 pr-6 font-600 text-ink-500 text-xs uppercase">{h}</th>)}</tr></thead>
                          <tbody>{results.fy_summary.map((row,i)=>(
                            <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                              <td className="py-3 pr-6 font-700 text-ink-900">{String(Object.values(row)[0])}</td>
                              <td className="py-3 pr-6 text-ink-700">{fmt(row.revenue)}</td>
                              <td className="py-3 pr-6 text-ink-700">{row.customers?.toLocaleString()}</td>
                              <td className="py-3 pr-6 text-ink-700">{fmt(row.rev_per_customer)}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MRR/ACV TABS */}
              {!isCohort&&activeTab==='summary'&&(
                <div className="grid grid-cols-3 gap-5">
                  <div className="col-span-2 bg-white rounded-xl border border-ink-200 p-5">
                    <div className="text-[10px] font-700 text-ink-400 uppercase tracking-widest mb-1">Revenue Bridge</div>
                    <div className="text-sm font-700 text-ink-900 mb-4">{selLb}M Lookback — {yearFilter==='All'?'All Periods':yearFilter}</div>
                    <WaterfallChart data={wfall}/>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-ink-200 p-4">
                      <div className="text-[10px] font-700 text-ink-400 uppercase tracking-widest mb-3">Retention Metrics</div>
                      <div className="space-y-2">
                        <RetentionCard label="Gross Retention" value={fmtPct(ret?.grr)} good={(ret?.grr||0)>=80}/>
                        <RetentionCard label="Net Retention"   value={fmtPct(ret?.nrr)} good={(ret?.nrr||0)>=100}/>
                      </div>
                    </div>
                    {filtFY?.length>0&&(
                      <div className="bg-white rounded-xl border border-ink-200 p-4">
                        <div className="text-[10px] font-700 text-ink-400 uppercase tracking-widest mb-3">By Fiscal Year</div>
                        <div className="space-y-2.5">
                          {filtFY.slice(0,5).map((row,i)=>(
                            <div key={i} className="flex items-center justify-between">
                              <span className="text-[11px] font-600 text-ink-700">{row.fiscal_year}</span>
                              <div className="text-right"><div className="text-[12px] font-700 text-ink-900">{fmt(row.revenue)}</div><div className="text-[9px] text-ink-400">{row.customers} customers</div></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!isCohort&&activeTab==='bridge'&&(
                <div className="space-y-5">
                  {bdg?.by_period?.length>0&&(
                    <div className="bg-white rounded-xl border border-ink-200 p-5">
                      <div className="text-[10px] font-700 text-ink-400 uppercase tracking-widest mb-4">Bridge Trend — {periodType}</div>
                      <div className="h-64"><ResponsiveContainer width="100%" height="100%">
                        <BarChart data={bdg.by_period} margin={{left:10,right:10,bottom:10}}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F8" vertical={false}/>
                          <XAxis dataKey="_period" tick={{fontSize:10,fill:'#8C95A6'}}/>
                          <YAxis tickFormatter={fmt} tick={{fontSize:10,fill:'#8C95A6'}} width={50}/>
                          <Tooltip formatter={v=>fmt(Number(v))} contentStyle={{fontSize:11}}/><Legend/>
                          {['New Logo','Upsell','Cross-sell','Returning','Downsell','Churn','Churn Partial'].map((cat,i)=><Bar key={cat} dataKey={cat} stackId="a" fill={BRIDGE_COLORS[cat]||CHART_COLORS[i]} name={cat}/>)}
                        </BarChart>
                      </ResponsiveContainer></div>
                    </div>
                  )}
                  <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-ink-100 bg-ink-50/50"><div className="text-[10px] font-700 text-ink-400 uppercase tracking-widest">Waterfall Summary</div></div>
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-ink-100"><th className="text-left px-5 py-3 font-700 text-ink-500 text-xs uppercase">Classification</th><th className="text-right px-5 py-3 font-700 text-ink-500 text-xs uppercase">Value</th><th className="text-right px-5 py-3 font-700 text-ink-500 text-xs uppercase">% of Total</th></tr></thead>
                      <tbody>{wfall.sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)).map((row,i)=>{
                        const total=wfall.reduce((s,r)=>s+Math.abs(r.value),0)
                        return (<tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                          <td className="px-5 py-2.5"><div className="flex items-center gap-2.5"><div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:row.color||'#CBD5E1'}}/><span className="font-600 text-ink-900">{row.category}</span></div></td>
                          <td className={`px-5 py-2.5 text-right font-700 ${row.value>0?'text-green-700':'text-red-600'}`}>{row.value>0?'+':''}{fmt(row.value)}</td>
                          <td className="px-5 py-2.5 text-right text-ink-400 text-xs">{total>0?((Math.abs(row.value)/total)*100).toFixed(1):0}%</td>
                        </tr>)
                      })}</tbody>
                    </table>
                  </div>
                </div>
              )}

              {!isCohort&&activeTab==='retention'&&(
                <div className="space-y-5">
                  {kpiRows.length>0&&(
                    <div className="bg-white rounded-xl border border-ink-200 p-5">
                      <div className="text-[10px] font-700 text-ink-400 uppercase tracking-widest mb-4">Retention Trends</div>
                      <div className="h-64"><ResponsiveContainer width="100%" height="100%">
                        <LineChart data={kpiRows} margin={{left:10,right:10}}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F8" vertical={false}/>
                          <XAxis dataKey="period" tick={{fontSize:10,fill:'#8C95A6'}}/>
                          <YAxis tickFormatter={v=>`${v}%`} tick={{fontSize:10,fill:'#8C95A6'}} domain={[0,120]} width={40}/>
                          <Tooltip formatter={v=>`${Number(v).toFixed(1)}%`} contentStyle={{fontSize:11}}/><Legend/>
                          <Line type="monotone" dataKey="nrr" stroke="#1A3CF5" strokeWidth={2} dot={{r:3}} name="NRR"/>
                          <Line type="monotone" dataKey="grr" stroke="#10B981" strokeWidth={2} dot={{r:3}} name="GRR"/>
                        </LineChart>
                      </ResponsiveContainer></div>
                    </div>
                  )}
                  <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-ink-100 bg-ink-50">{['Period','Beginning','Ending','New Logo','Upsell','Downsell','Churn','GRR','NRR'].map(h=><th key={h} className="px-4 py-2.5 text-left font-700 text-ink-500 text-xs uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
                      <tbody>{kpiRows.map((row,i)=>(
                        <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                          <td className="px-4 py-2 font-700 text-ink-900">{row.period}</td>
                          <td className="px-4 py-2 text-ink-700">{fmt(row.beginning)}</td>
                          <td className="px-4 py-2 text-ink-700">{fmt(row.ending)}</td>
                          <td className="px-4 py-2 text-green-700 font-600">{row.new_logo?`+${fmt(row.new_logo)}`:'—'}</td>
                          <td className="px-4 py-2 text-indigo-600 font-600">{row.upsell?`+${fmt(row.upsell)}`:'—'}</td>
                          <td className="px-4 py-2 text-orange-600 font-600">{row.downsell?fmt(row.downsell):'—'}</td>
                          <td className="px-4 py-2 text-red-600 font-600">{row.churn?fmt(row.churn):'—'}</td>
                          <td className={`px-4 py-2 font-700 ${(row.grr||0)>=80?'text-green-700':'text-red-600'}`}>{fmtPct(row.grr)}</td>
                          <td className={`px-4 py-2 font-700 ${(row.nrr||0)>=100?'text-green-700':'text-amber-600'}`}>{fmtPct(row.nrr)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}

              {!isCohort&&activeTab==='top_movers'&&(
                <div className="space-y-4">
                  <div className="flex gap-1 flex-wrap">
                    {Object.keys(movers).map(cat=><button key={cat} onClick={()=>setMoverCat(cat)} className={`px-3 py-1.5 rounded-lg text-[11px] font-600 border transition-all ${moverCat===cat?'border-brand-400 bg-brand-50 text-brand-700':'border-ink-200 text-ink-500 hover:border-ink-300'}`}><span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{background:BRIDGE_COLORS[cat]||'#CBD5E1'}}/>{cat} ({(movers[cat]||[]).length})</button>)}
                  </div>
                  {moverCat&&movers[moverCat]?.length>0&&(
                    <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
                      <div className="px-5 py-3 border-b border-ink-100 bg-ink-50/50 flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{background:BRIDGE_COLORS[moverCat]||'#CBD5E1'}}/><div className="text-[10px] font-700 text-ink-500 uppercase tracking-widest">Top {moverCat}</div></div>
                      <div className="overflow-x-auto"><table className="w-full text-sm">
                        <thead><tr className="border-b border-ink-100">{Object.keys(movers[moverCat][0]).filter(k=>k!=='value'&&k!=='period').map(k=><th key={k} className="px-4 py-2.5 text-left font-700 text-ink-500 text-xs uppercase">{k}</th>)}<th className="px-4 py-2.5 text-right font-700 text-ink-500 text-xs uppercase">Period</th><th className="px-4 py-2.5 text-right font-700 text-ink-500 text-xs uppercase">Value</th></tr></thead>
                        <tbody>{movers[moverCat].slice(0,30).map((row,i)=>(
                          <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                            {Object.keys(row).filter(k=>k!=='value'&&k!=='period').map(k=><td key={k} className="px-4 py-2 text-ink-700 text-xs">{row[k]??'—'}</td>)}
                            <td className="px-4 py-2 text-right text-ink-500 text-xs">{row.period||'—'}</td>
                            <td className={`px-4 py-2 text-right font-700 ${row.value>0?'text-green-700':'text-red-600'}`}>{row.value>0?'+':''}{fmt(row.value)}</td>
                          </tr>
                        ))}</tbody>
                      </table></div>
                    </div>
                  )}
                </div>
              )}

              {!isCohort&&activeTab==='top_customers'&&(
                <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-ink-100 bg-ink-50/50"><div className="text-[10px] font-700 text-ink-400 uppercase tracking-widest">Top 10 Customers by Ending ARR</div></div>
                  {topCusts.length>0?(
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-ink-100"><th className="px-5 py-2.5 text-left font-700 text-ink-500 text-xs uppercase">#</th>{Object.keys(topCusts[0]).map(k=><th key={k} className="px-5 py-2.5 text-left font-700 text-ink-500 text-xs uppercase">{k}</th>)}</tr></thead>
                      <tbody>{topCusts.map((row,i)=>(
                        <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                          <td className="px-5 py-2.5 text-ink-400 font-600 text-xs">#{i+1}</td>
                          {Object.values(row).map((val,j)=><td key={j} className="px-5 py-2.5 text-ink-700">{typeof val==='number'?<span className="font-700 text-ink-900">{fmt(val)}</span>:val??'—'}</td>)}
                        </tr>
                      ))}</tbody>
                    </table>
                  ):<div className="p-10 text-center text-ink-400 text-sm">No customer data available.</div>}
                </div>
              )}

              {!isCohort&&activeTab==='kpi_matrix'&&(
                <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-ink-100 bg-ink-50/50"><div className="text-[10px] font-700 text-ink-400 uppercase tracking-widest">KPI Matrix — {periodType}</div></div>
                  <div className="overflow-x-auto"><table className="w-full text-sm">
                    <thead><tr className="border-b border-ink-100">{['Period','Beginning','Ending','New Logo','Upsell','Downsell','Churn','Cross-sell','GRR','NRR'].map(h=><th key={h} className="px-4 py-2.5 text-left font-700 text-ink-500 text-[10px] uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
                    <tbody>{kpiRows.map((row,i)=>(
                      <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                        <td className="px-4 py-2 font-700 text-ink-900">{row.period}</td>
                        <td className="px-4 py-2 text-ink-700">{fmt(row.beginning)}</td>
                        <td className="px-4 py-2 text-ink-700">{fmt(row.ending)}</td>
                        <td className="px-4 py-2 text-green-700 font-600">{row.new_logo?`+${fmt(row.new_logo)}`:'—'}</td>
                        <td className="px-4 py-2 text-indigo-600 font-600">{row.upsell?`+${fmt(row.upsell)}`:'—'}</td>
                        <td className="px-4 py-2 text-orange-600 font-600">{row.downsell?fmt(row.downsell):'—'}</td>
                        <td className="px-4 py-2 text-red-600 font-600">{row.churn?fmt(row.churn):'—'}</td>
                        <td className="px-4 py-2 text-blue-600 font-600">{row.cross_sell?`+${fmt(row.cross_sell)}`:'—'}</td>
                        <td className={`px-4 py-2 font-700 ${(row.grr||0)>=80?'text-green-700':'text-red-600'}`}>{fmtPct(row.grr)}</td>
                        <td className={`px-4 py-2 font-700 ${(row.nrr||0)>=100?'text-green-700':'text-amber-600'}`}>{fmtPct(row.nrr)}</td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                </div>
              )}

              {activeTab==='output'&&(
                <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100 bg-ink-50/50">
                    <div className="text-[10px] font-700 text-ink-400 uppercase tracking-widest">Output — {results.output?.length?.toLocaleString()} rows</div>
                    {isAdmin?<button onClick={downloadCSV} className="flex items-center gap-1.5 bg-brand-600 text-white text-[11px] font-700 px-3 py-1.5 rounded-lg"><Download size={11}/> Export CSV</button>
                    :<button onClick={()=>router.push('/dashboard/upgrade')} className="flex items-center gap-1.5 text-[11px] font-600 text-ink-500 bg-ink-100 px-3 py-1.5 rounded-lg hover:bg-ink-200"><Lock size={11}/> Upgrade to Export</button>}
                  </div>
                  {results.output?.length>0?(
                    <div className="overflow-x-auto max-h-[500px] overflow-y-auto"><table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white border-b border-ink-100"><tr>{Object.keys(results.output[0]).map(col=><th key={col} className="px-4 py-2.5 text-left font-700 text-ink-500 whitespace-nowrap bg-ink-50">{col}</th>)}</tr></thead>
                      <tbody>{results.output.slice(0,200).map((row,i)=>(
                        <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">{Object.values(row).map((val,j)=><td key={j} className="px-4 py-1.5 text-ink-700 whitespace-nowrap">{val??'—'}</td>)}</tr>
                      ))}</tbody>
                    </table></div>
                  ):<div className="p-10 text-center text-ink-400 text-sm">No output data available.</div>}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
