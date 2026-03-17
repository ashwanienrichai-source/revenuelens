import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import {
  Upload, Play, Download, ChevronRight, Loader2, CheckCircle,
  AlertCircle, BarChart3, Lock, RefreshCw, X, Plus, Trash2,
  AlertTriangle, Filter
} from 'lucide-react'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import { supabase, UserProfile, canDownload } from '../../lib/supabase'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://revenuelens-api.onrender.com'
const COHORT_TYPES = [
  { id: 'SG', label: 'Size Cohorts',       desc: 'Tier 1 / Tier 2 / Tier 3 / Long Tail' },
  { id: 'PC', label: 'Percentile Cohorts', desc: 'Top 5% / 10% / 20% / 50%' },
  { id: 'RC', label: 'Revenue Cohorts',    desc: 'Revenue Leaders / Growth / Tail' },
]
const COLORS = ['#1A3CF5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']
const fmt = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `$${(v/1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000)     return `$${(v/1_000).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

function Steps({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1 mb-8">
      {['Upload','Configure','Results'].map((s,i) => (
        <div key={s} className="flex items-center">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-600 ${i+1===step?'bg-brand-600 text-white':i+1<step?'bg-brand-50 text-brand-600':'text-ink-400'}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-700 ${i+1<step?'bg-brand-200 text-brand-700':i+1===step?'bg-white/25 text-white':'bg-ink-200 text-ink-500'}`}>{i+1}</div>
            {s}
          </div>
          {i<2 && <ChevronRight size={14} className="text-ink-300 mx-1"/>}
        </div>
      ))}
    </div>
  )
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`card p-5 ${accent?'border-t-2 border-t-brand-500':''}`}>
      <div className="text-[10px] font-700 text-ink-400 uppercase tracking-widest mb-2">{label}</div>
      <div className={`font-display text-2xl font-800 ${accent?'text-brand-600':'text-ink-900'}`}>{value}</div>
    </div>
  )
}

function Heatmap({ data, title }: { data: any[]; title: string }) {
  if (!data?.length) return null
  // FIX: show ALL months from data, not limited to 12
  const allKeys = Array.from(new Set(data.flatMap(r => Object.keys(r).filter(k => k !== 'cohort'))))
  const indices = allKeys.sort((a,b) => Number(a)-Number(b))
  const color = (v: number|null) => {
    if(v===null) return '#F6F7F9'
    if(v>=90) return '#1A3CF5'; if(v>=70) return '#3D5EFF'; if(v>=50) return '#6285FF'
    if(v>=30) return '#BACBFF'; if(v>=10) return '#D9E4FF'; return '#EEF3FF'
  }
  return (
    <div>
      <div className="text-xs font-700 text-ink-500 uppercase tracking-widest mb-3">{title}</div>
      <div className="text-xs text-ink-400 mb-2">{indices.length} months · {data.length} cohorts</div>
      <div className="overflow-x-auto">
        <table className="text-xs" style={{minWidth: indices.length * 44 + 120}}>
          <thead><tr>
            <th className="text-left py-1.5 pr-3 font-600 text-ink-500 sticky left-0 bg-white">Cohort</th>
            {indices.map(i => <th key={i} className="px-0.5 text-center font-600 text-ink-400 whitespace-nowrap">M{i}</th>)}
          </tr></thead>
          <tbody>
            {data.map((row,ri) => (
              <tr key={ri}>
                <td className="py-0.5 pr-3 font-600 text-ink-700 whitespace-nowrap sticky left-0 bg-white">{row.cohort}</td>
                {indices.map(i => {
                  const v = row[i]
                  return <td key={i} className="px-0.5 py-0.5">
                    <div className="w-9 h-6 rounded flex items-center justify-center text-[9px] font-600"
                      style={{background:color(v), color:v!==null&&v>=50?'white':'#4D5870', minWidth:36}}>
                      {v!==null ? `${v}%` : ''}
                    </div>
                  </td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[10px] text-ink-400">Low</span>
        {[10,30,50,70,90].map(v => <div key={v} className="w-5 h-3 rounded" style={{background:color(v)}}/>)}
        <span className="text-[10px] text-ink-400">High</span>
      </div>
    </div>
  )
}

export default function CohortPage() {
  const router = useRouter()
  const [profile, setProfile]   = useState<UserProfile|null>(null)
  const [step, setStep]         = useState(1)
  const [file, setFile]         = useState<File|null>(null)
  const [columns, setColumns]   = useState<string[]>([])
  const [rowCount, setRowCount] = useState(0)
  const [loadingCols, setLoadingCols] = useState(false)
  const [apiWaking, setApiWaking]     = useState(false)

  // Config
  const [metric, setMetric]           = useState('')
  const [customerCol, setCustomerCol] = useState('')
  const [dateCol, setDateCol]         = useState('')
  const [fiscalCol, setFiscalCol]     = useState('None')
  const [periodFilter, setPeriodFilter] = useState('all')
  const [selectedFY, setSelectedFY]   = useState('')
  const [cohortTypes, setCohortTypes] = useState<string[]>(['SG'])
  // FIX: separate single and multi — both run together (AND logic)
  const [individualCols, setIndividualCols] = useState<string[]>([''])
  const [hierarchies, setHierarchies]       = useState<string[][]>([['']])
  const [useSingle, setUseSingle]   = useState(true)
  const [useMulti, setUseMulti]     = useState(false)

  // Results
  const [results, setResults]     = useState<any>(null)
  const [running, setRunning]     = useState(false)
  const [error, setError]         = useState('')
  const [activeTab, setActiveTab] = useState('summary')
  // FIX: year filter on results
  const [resultYearFilter, setResultYearFilter] = useState('All')

  const isAdmin = canDownload(profile)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }
      supabase.from('profiles').select('*').eq('id', session.user.id).single()
        .then(({ data }) => { if (data) setProfile(data) })
    })
    fetch(`${API}/health`).catch(() => {})
  }, [router])

  async function readFileColumns(f: File) {
    setFile(f); setLoadingCols(true); setApiWaking(false); setError(''); setColumns([])
    const wakeTimer = setTimeout(() => setApiWaking(true), 5000)
    try {
      const fd = new FormData(); fd.append('file', f)
      const { data } = await axios.post(`${API}/api/cohort/columns`, fd, { timeout: 60000 })
      clearTimeout(wakeTimer); setApiWaking(false)
      setColumns(data.columns); setRowCount(data.row_count)
      const cols = data.columns.map((c:string) => c.toLowerCase())
      const find = (kw:string[]) => data.columns.find((_:string,i:number) => kw.some(k => cols[i].includes(k))) || ''
      setMetric(find(['mrr','arr','revenue','amount','value','mrr_or_arr']))
      setCustomerCol(find(['customer','client','account','company']))
      setDateCol(find(['date','period','month']))
      setFiscalCol(data.columns.find((_:string,i:number) => cols[i].includes('fiscal')||cols[i]==='fy') || 'None')
    } catch(e:any) {
      clearTimeout(wakeTimer); setApiWaking(false)
      setError(e.code==='ECONNABORTED'||e.message?.includes('timeout')
        ? 'API is starting up — please try again in 10 seconds.'
        : `Could not read file: ${e?.response?.data?.detail || e.message}`)
    }
    setLoadingCols(false)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (f) readFileColumns(f)
  }

  async function runAnalysis() {
    if (!file||!metric||!customerCol||!dateCol) { setError('Please map all required fields.'); return }
    setRunning(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('metric', metric)
      fd.append('customer_col', customerCol)
      fd.append('date_col', dateCol)
      fd.append('fiscal_col', fiscalCol)
      fd.append('cohort_types', JSON.stringify(cohortTypes))
      fd.append('period_filter', periodFilter)
      fd.append('selected_fiscal_year', selectedFY)
      // FIX: send both individual AND hierarchy (AND logic)
      fd.append('individual_cols', JSON.stringify(useSingle ? individualCols.filter(c=>c&&c!=='None') : []))
      fd.append('hierarchies',     JSON.stringify(useMulti  ? hierarchies.filter(h=>h.some(c=>c&&c!=='None')) : []))
      const { data } = await axios.post(`${API}/api/cohort/analyze`, fd, { timeout: 120000 })
      setResults(data)
      setStep(3)
      setActiveTab('summary')
      setResultYearFilter('All')
    } catch(e:any) { setError(e?.response?.data?.detail || 'Analysis failed. Please try again.') }
    setRunning(false)
  }

  function downloadCSV() {
    if (!results?.output?.length) return
    const keys = Object.keys(results.output[0])
    const csv = [keys.join(','), ...results.output.map((r:any) => keys.map((k:string) => r[k]??'').join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
    a.download = 'cohort_output.csv'; a.click()
  }

  // FIX: filter summary/segmentation by selected year
  const fyKey = results?.fy_summary?.[0] ? Object.keys(results.fy_summary[0])[0] : null
  const filteredFYSummary = resultYearFilter === 'All'
    ? results?.fy_summary
    : results?.fy_summary?.filter((r:any) => String(r[fyKey!]) === resultYearFilter)

  const filteredSegByFY = resultYearFilter === 'All'
    ? results?.segmentation_by_fy
    : results?.segmentation_by_fy?.filter((r:any) => fyKey && String(r[fyKey]) === resultYearFilter)

  return (
    <DashboardLayout profile={profile} title="Cohort Analytics">
      <div className="p-6 max-w-7xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                <BarChart3 size={18} className="text-brand-600"/>
              </div>
              <h1 className="font-display text-xl font-800 text-ink-900">Cohort Analytics</h1>
            </div>
            <p className="text-ink-400 text-sm ml-12">Size Cohorts · Percentile Cohorts · Revenue Cohorts · Retention Heatmap</p>
          </div>
          {results && (
            <div className="flex items-center gap-3">
              <button onClick={()=>{setStep(1);setResults(null);setFile(null);setColumns([])}} className="btn-ghost text-sm">
                <RefreshCw size={13}/> New Analysis
              </button>
              {isAdmin
                ? <button onClick={downloadCSV} className="btn-primary text-sm"><Download size={13}/> Download CSV</button>
                : <button onClick={()=>router.push('/dashboard/upgrade')} className="btn-secondary text-sm"><Lock size={13}/> Upgrade</button>
              }
            </div>
          )}
        </div>

        <Steps step={step}/>

        {/* ── STEP 1: Upload ── */}
        {step===1 && (
          <div className="max-w-2xl">
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-800">
              <AlertTriangle size={14} className="text-blue-500 flex-shrink-0 mt-0.5"/>
              <span><strong>First upload may take 30-60 seconds</strong> — the analytics engine wakes up on first use. Subsequent uploads will be instant.</span>
            </div>

            <div className="rounded-2xl border-2 border-dashed p-12 text-center transition-all mb-4 cursor-pointer border-ink-200 hover:border-brand-300 bg-ink-50/50"
              onClick={()=>document.getElementById('file-input')?.click()}>
              <input id="file-input" type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileInput}/>
              {loadingCols ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={32} className="text-brand-500 animate-spin"/>
                  <div className="text-ink-700 text-sm font-600">{apiWaking?'⏳ API is waking up — please wait 30-60 seconds...':'Reading your file...'}</div>
                  {apiWaking && <div className="text-ink-400 text-xs">This only happens on first use each day</div>}
                </div>
              ) : file && columns.length>0 ? (
                <div>
                  <CheckCircle size={32} className="text-green-500 mx-auto mb-3"/>
                  <div className="font-700 text-ink-900 text-sm mb-1">{file.name}</div>
                  <div className="text-ink-400 text-xs">{rowCount.toLocaleString()} rows · {columns.length} columns detected</div>
                </div>
              ) : (
                <div>
                  <Upload size={32} className="text-ink-300 mx-auto mb-3"/>
                  <div className="font-600 text-ink-700 text-sm mb-1">Drag & drop your dataset, or click to browse</div>
                  <div className="text-ink-400 text-xs">CSV or Excel (.xlsx) · Max 200MB</div>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
                <AlertCircle size={14}/> {error}
                {error.includes('try again') && (
                  <button onClick={()=>file&&readFileColumns(file)} className="ml-auto text-xs font-600 underline">Retry</button>
                )}
              </div>
            )}

            {columns.length>0 && (
              <>
                <div className="card p-4 mb-4">
                  <div className="text-xs font-700 text-ink-400 uppercase tracking-widest mb-3">Detected columns ({columns.length})</div>
                  <div className="flex flex-wrap gap-1.5">
                    {columns.map(c=><span key={c} className="px-2.5 py-1 bg-ink-50 border border-ink-200 rounded-lg text-xs text-ink-600 font-500">{c}</span>)}
                  </div>
                </div>
                <button onClick={()=>setStep(2)} className="btn-primary">Configure Analysis <ChevronRight size={14}/></button>
              </>
            )}
          </div>
        )}

        {/* ── STEP 2: Configure ── */}
        {step===2 && (
          <div className="grid lg:grid-cols-2 gap-6">

            {/* Column mapping */}
            <div className="card p-6">
              <div className="text-xs font-700 text-ink-400 uppercase tracking-widest mb-4">Column Mapping</div>
              <div className="space-y-3">
                {[
                  {label:'Revenue / ARR Column',val:metric,      set:setMetric,      req:true},
                  {label:'Customer Column',      val:customerCol, set:setCustomerCol, req:true},
                  {label:'Date Column',          val:dateCol,     set:setDateCol,     req:true},
                  {label:'Fiscal Year Column',   val:fiscalCol,   set:setFiscalCol,   req:false},
                ].map(f=>(
                  <div key={f.label}>
                    <div className="flex items-center gap-2 mb-1">
                      <label className="text-sm font-600 text-ink-700">{f.label}</label>
                      {f.req && <span className="badge badge-blue text-[9px]">Required</span>}
                    </div>
                    <select value={f.val} onChange={e=>f.set(e.target.value)} className="input-field text-sm py-2">
                      <option value="None">— Select column —</option>
                      {columns.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {/* Cohort types */}
              <div className="card p-5">
                <div className="text-xs font-700 text-ink-400 uppercase tracking-widest mb-3">Cohort Types</div>
                <div className="space-y-2">
                  {COHORT_TYPES.map(ct=>(
                    <label key={ct.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${cohortTypes.includes(ct.id)?'border-brand-400 bg-brand-50':'border-ink-200 hover:border-ink-300'}`}>
                      <input type="checkbox" checked={cohortTypes.includes(ct.id)} className="mt-0.5 accent-brand-600"
                        onChange={e=>setCohortTypes(prev=>e.target.checked?[...prev,ct.id]:prev.filter(x=>x!==ct.id))}/>
                      <div>
                        <div className="text-sm font-700 text-ink-900">{ct.label}</div>
                        <div className="text-xs text-ink-400 mt-0.5">{ct.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Period filter — FIX: show actual FY values as dropdown */}
              <div className="card p-5">
                <div className="text-xs font-700 text-ink-400 uppercase tracking-widest mb-3">Period Filter</div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[{id:'all',label:'All Time'},{id:'latest',label:'Latest Period'},{id:'fiscal_year',label:'By Fiscal Year'}].map(pf=>(
                    <button key={pf.id} onClick={()=>setPeriodFilter(pf.id)}
                      className={`py-2 rounded-lg text-xs font-600 border transition-all ${periodFilter===pf.id?'bg-brand-600 text-white border-brand-600':'border-ink-200 text-ink-600 hover:border-ink-300'}`}>
                      {pf.label}
                    </button>
                  ))}
                </div>
                {periodFilter==='fiscal_year' && (
                  fiscalCol !== 'None' ? (
                    <div>
                      <div className="text-xs text-ink-500 mb-1.5">Select fiscal year from your data:</div>
                      <select value={selectedFY} onChange={e=>setSelectedFY(e.target.value)} className="input-field text-sm py-2">
                        <option value="">— Select fiscal year —</option>
                        {/* We'll show a text input as fallback since FY values come from API after analysis */}
                        <option value="FY2024">FY2024</option>
                        <option value="FY2023">FY2023</option>
                        <option value="FY2022">FY2022</option>
                        <option value="2024">2024</option>
                        <option value="2023">2023</option>
                        <option value="2022">2022</option>
                      </select>
                      <input className="input-field text-sm mt-2" placeholder="Or type custom value e.g. FY2024"
                        value={selectedFY} onChange={e=>setSelectedFY(e.target.value)}/>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                      Map a Fiscal Year column above to use this filter.
                    </div>
                  )
                )}
              </div>

              {/* FIX: Dimension mode — both can be selected at same time (AND logic) */}
              <div className="card p-5">
                <div className="text-xs font-700 text-ink-400 uppercase tracking-widest mb-3">Dimension Mode</div>
                <div className="text-xs text-ink-500 mb-3">Select one or both — results are combined</div>

                {/* Single dimension toggle */}
                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer mb-3 transition-all ${useSingle?'border-brand-400 bg-brand-50':'border-ink-200 hover:border-ink-300'}`}>
                  <input type="checkbox" checked={useSingle} className="accent-brand-600"
                    onChange={e=>setUseSingle(e.target.checked)}/>
                  <div>
                    <div className="text-sm font-700 text-ink-900">Single Dimension</div>
                    <div className="text-xs text-ink-400">Cohort by individual columns</div>
                  </div>
                </label>

                {useSingle && (
                  <div className="ml-6 mb-4 space-y-2">
                    {individualCols.map((col,i)=>(
                      <div key={i} className="flex gap-2">
                        <select value={col} onChange={e=>{const n=[...individualCols];n[i]=e.target.value;setIndividualCols(n)}}
                          className="input-field text-sm py-1.5 flex-1">
                          <option value="">— Select column —</option>
                          {columns.map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                        <button onClick={()=>setIndividualCols(prev=>prev.filter((_,j)=>j!==i))}
                          className="p-1.5 text-ink-400 hover:text-red-500 rounded"><X size={14}/></button>
                      </div>
                    ))}
                    <button onClick={()=>setIndividualCols(prev=>[...prev,''])}
                      className="text-xs text-brand-600 font-600 hover:underline flex items-center gap-1">
                      <Plus size={12}/> Add column
                    </button>
                  </div>
                )}

                {/* Multi dimension toggle */}
                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${useMulti?'border-brand-400 bg-brand-50':'border-ink-200 hover:border-ink-300'}`}>
                  <input type="checkbox" checked={useMulti} className="accent-brand-600"
                    onChange={e=>setUseMulti(e.target.checked)}/>
                  <div>
                    <div className="text-sm font-700 text-ink-900">Multi Dimension</div>
                    <div className="text-xs text-ink-400">Cohort by column combinations (hierarchies)</div>
                  </div>
                </label>

                {useMulti && (
                  <div className="ml-6 mt-3 space-y-3">
                    {hierarchies.map((hier,hi)=>(
                      <div key={hi} className="p-3 bg-ink-50 rounded-xl border border-ink-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-600 text-ink-600">Hierarchy {hi+1}</span>
                          <button onClick={()=>setHierarchies(prev=>prev.filter((_,j)=>j!==hi))}
                            className="text-ink-400 hover:text-red-500"><Trash2 size={12}/></button>
                        </div>
                        {hier.map((col,ci)=>(
                          <div key={ci} className="flex gap-2 mb-1.5">
                            <select value={col} onChange={e=>{
                              const n=hierarchies.map((h,j)=>j===hi?h.map((c,k)=>k===ci?e.target.value:c):h)
                              setHierarchies(n)}} className="input-field text-sm py-1.5 flex-1">
                              <option value="">— Select —</option>
                              {columns.map(c=><option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        ))}
                        <button onClick={()=>setHierarchies(prev=>prev.map((h,j)=>j===hi?[...h,'']:h))}
                          className="text-xs text-brand-600 font-600 flex items-center gap-1"><Plus size={11}/> Add level</button>
                      </div>
                    ))}
                    <button onClick={()=>setHierarchies(prev=>[...prev,['']])}
                      className="text-xs text-brand-600 font-600 flex items-center gap-1"><Plus size={12}/> Add hierarchy</button>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="lg:col-span-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-3">
                <AlertCircle size={15}/> {error}
              </div>
            )}

            <div className="lg:col-span-2 flex items-center gap-4">
              <button onClick={()=>setStep(1)} className="btn-secondary">← Back</button>
              <button onClick={runAnalysis} disabled={running||!metric||!customerCol||!dateCol}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
                {running?<Loader2 size={14} className="animate-spin"/>:<Play size={14}/>}
                {running?'Running analysis...':'Run Cohort Analysis'}
              </button>
              {running && <div className="text-ink-400 text-xs">This may take 30-60 seconds on first run</div>}
            </div>
          </div>
        )}

        {/* ── STEP 3: Results ── */}
        {step===3 && results && (
          <div>
            {/* FIX: Year filter on results */}
            <div className="flex items-center justify-between mb-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-1 mr-6">
                <KpiCard label="Total Revenue"    value={fmt(results.summary.total_revenue)} accent/>
                <KpiCard label="Customers"        value={results.summary.n_customers.toLocaleString()}/>
                <KpiCard label="Rev / Customer"   value={fmt(results.summary.rev_per_customer)}/>
                <KpiCard label="Rows Analyzed"    value={results.summary.rows_analyzed.toLocaleString()}/>
              </div>
              {results.fiscal_years?.length>0 && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Filter size={14} className="text-ink-400"/>
                  <select value={resultYearFilter} onChange={e=>setResultYearFilter(e.target.value)}
                    className="input-field text-sm py-2 w-36">
                    <option value="All">All Years</option>
                    {results.fiscal_years.map((fy:any) => (
                      <option key={String(fy)} value={String(fy)}>{String(fy)}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-ink-200 mb-6">
              {[{id:'summary',label:'Summary'},{id:'heatmap',label:'Retention Heatmap'},{id:'segments',label:'Segmentation'},{id:'output',label:'Output Table'}]
                .map(tab=>(
                  <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
                    className={`px-5 py-2.5 text-sm font-600 border-b-2 -mb-px transition-all ${activeTab===tab.id?'border-brand-600 text-brand-600':'border-transparent text-ink-500 hover:text-ink-700'}`}>
                    {tab.label}
                  </button>
                ))}
            </div>

            {/* Summary tab */}
            {activeTab==='summary' && (
              <div className="space-y-6">
                {filteredFYSummary?.length>0 ? (
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-xs font-700 text-ink-400 uppercase tracking-widest">
                        {resultYearFilter==='All' ? 'Summary by Fiscal Year' : `Summary — ${resultYearFilter}`}
                      </div>
                    </div>
                    <div className="overflow-x-auto mb-6">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-ink-100">
                          {['Fiscal Year','Revenue','Customers','Rev / Customer'].map(h=>(
                            <th key={h} className="text-left py-2.5 pr-6 font-600 text-ink-500 text-xs uppercase">{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {filteredFYSummary.map((row:any,i:number)=>(
                            <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                              <td className="py-3 pr-6 font-700 text-ink-900">{String(Object.values(row)[0])}</td>
                              <td className="py-3 pr-6 text-ink-700">{fmt(row.revenue)}</td>
                              <td className="py-3 pr-6 text-ink-700">{row.customers?.toLocaleString()}</td>
                              <td className="py-3 pr-6 text-ink-700">{fmt(row.rev_per_customer)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={filteredFYSummary}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F8"/>
                          <XAxis dataKey={Object.keys(filteredFYSummary[0])[0]} tick={{fontSize:11,fill:'#8C95A6'}}/>
                          <YAxis tickFormatter={(v:any)=>fmt(v)} tick={{fontSize:11,fill:'#8C95A6'}}/>
                          <Tooltip formatter={(v:any)=>fmt(v)}/>
                          <Bar dataKey="revenue" fill="#1A3CF5" radius={[4,4,0,0]} name="Revenue"/>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="card p-8 text-center text-ink-400 text-sm">
                    No fiscal year data. Map a Fiscal Year column to see this breakdown.
                  </div>
                )}
              </div>
            )}

            {/* Heatmap tab */}
            {activeTab==='heatmap' && (
              <div className="space-y-6">
                {results.heatmap?.length>0
                  ? <div className="card p-6"><Heatmap data={results.heatmap} title="Customer Count — Cohort Heatmap"/></div>
                  : <div className="card p-10 text-center text-ink-400 text-sm">No heatmap data. Check your Date column.</div>
                }
                {results.retention?.length>0 && (
                  <div className="card p-6"><Heatmap data={results.retention} title="Retention Rate % by Cohort"/></div>
                )}
              </div>
            )}

            {/* Segmentation tab */}
            {activeTab==='segments' && (
              <div className="space-y-6">
                {/* Overall segmentation */}
                {results.segmentation?.length>0 && (
                  <div className="grid lg:grid-cols-2 gap-6">
                    <div className="card p-5">
                      <div className="text-xs font-700 text-ink-400 uppercase tracking-widest mb-4">
                        Overall Revenue Segmentation
                      </div>
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={results.segmentation}
                              dataKey={Object.keys(results.segmentation[0]).find(k=>k!=='segment')||''} nameKey="segment"
                              cx="50%" cy="50%" outerRadius={80}
                              label={({segment,percent}:any)=>`${segment} ${(percent*100).toFixed(0)}%`}>
                              {results.segmentation.map((_:any,i:number)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                            </Pie>
                            <Tooltip formatter={(v:any)=>fmt(v)}/>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-3 space-y-2">
                        {results.segmentation.map((r:any,i:number)=>{
                          const vk=Object.keys(r).find(k=>k!=='segment')||''
                          const total=results.segmentation.reduce((s:number,x:any)=>s+x[vk],0)
                          return (
                            <div key={i} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{background:COLORS[i%COLORS.length]}}/>
                                <span className="text-sm text-ink-700">{r.segment}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-700 text-ink-900">{fmt(r[vk])}</span>
                                <span className="text-xs text-ink-400 w-12 text-right">{total>0?`${((r[vk]/total)*100).toFixed(1)}%`:'—'}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Segmentation by FY with year filter */}
                    {filteredSegByFY?.length>0 && (
                      <div className="card p-5">
                        <div className="text-xs font-700 text-ink-400 uppercase tracking-widest mb-4">
                          Segmentation {resultYearFilter!=='All' ? `— ${resultYearFilter}` : 'by Fiscal Year'}
                        </div>
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={
                              (() => {
                                const grouped: Record<string,any> = {}
                                const fk = fyKey || Object.keys(filteredSegByFY[0])[0]
                                filteredSegByFY.forEach((r:any) => {
                                  const fy = String(r[fk])
                                  if (!grouped[fy]) grouped[fy] = {fy}
                                  const vk = Object.keys(r).find(k => k!==fk && k!=='segment') || ''
                                  grouped[fy][r.segment] = r[vk]
                                })
                                return Object.values(grouped)
                              })()
                            }>
                              <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F8"/>
                              <XAxis dataKey="fy" tick={{fontSize:11,fill:'#8C95A6'}}/>
                              <YAxis tickFormatter={(v:any)=>fmt(v)} tick={{fontSize:11,fill:'#8C95A6'}}/>
                              <Tooltip formatter={(v:any)=>fmt(v)}/>
                              {['Top 5%','Top 10%','Top 20%','Long Tail'].map((seg,i)=>(
                                <Bar key={seg} dataKey={seg} stackId="a" fill={COLORS[i]} name={seg}/>
                              ))}
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Output table */}
            {activeTab==='output' && (
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100 bg-ink-50/50">
                  <div className="text-xs font-700 text-ink-400 uppercase tracking-widest">
                    Output — {results.output?.length?.toLocaleString()} rows (preview)
                  </div>
                  {isAdmin
                    ? <button onClick={downloadCSV} className="btn-primary text-xs py-1.5 px-3"><Download size={11}/> Download CSV</button>
                    : <button onClick={()=>router.push('/dashboard/upgrade')} className="flex items-center gap-1.5 text-xs font-600 text-ink-500 bg-ink-100 px-3 py-1.5 rounded-lg hover:bg-ink-200"><Lock size={11}/> Upgrade to Download</button>
                  }
                </div>
                {results.output?.length>0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-ink-100 bg-ink-50">
                        {Object.keys(results.output[0]).map((col:string)=>(
                          <th key={col} className="px-4 py-2.5 text-left font-700 text-ink-500 whitespace-nowrap">{col}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {results.output.slice(0,100).map((row:any,i:number)=>(
                          <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                            {Object.values(row).map((val:any,j:number)=>(
                              <td key={j} className="px-4 py-2 text-ink-700 whitespace-nowrap">{val??'—'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-10 text-center text-ink-400 text-sm">
                    No output data. Select cohort columns to analyze.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
