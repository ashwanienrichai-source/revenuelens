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

// ─── Colors ──────────────────────────────────────────────────────────────────
const BC = {
  // Financial-grade palette — green gradient = growth magnitude, red gradient = loss severity
  'New Logo':      '#16A34A',   // forest green — net new revenue
  'Upsell':        '#22C55E',   // mid green — expansion
  'Cross-sell':    '#4ADE80',   // light green — cross-sell
  'Returning':     '#86EFAC',   // pale green — returning
  'Other In':      '#64748B',   // slate — neutral in
  'Downsell':      '#FCA5A5',   // pale red — contraction
  'Churn Partial': '#F87171',   // mid red — partial loss
  'Churn-Partial': '#F87171',
  'Churn':         '#DC2626',   // deep red — full loss
  'Lapsed':        '#CA8A04',   // muted amber — lapsed
  'Other Out':     '#64748B',   // slate — neutral out
  'Add on':        '#4ADE80',
  'Add-on':        '#4ADE80',
  'Beginning MRR': '#3D5068',   // steel — neutral baseline
  'Ending MRR':    '#475569',   // slate — ending (not neon)
  'Beginning ARR': '#3D5068',
  'Ending ARR':    '#475569',
  'Prior ACV':     '#3D5068',
  'Ending ACV':    '#475569',
  'RoB':           '#7C9DBC',   // muted blue
  'Expiry Pool':   '#4A5568',   // dark slate
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = v => {
  if (v == null) return '—'
  const a = Math.abs(v)
  if (a >= 1e9) return `$${(v/1e9).toFixed(1)}B`
  if (a >= 1e6) return `$${(v/1e6).toFixed(1)}M`
  if (a >= 1e3) return `$${(v/1e3).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}
const fmtPct = v => v != null ? `${v.toFixed(1)}%` : '—'

// toARR: convert raw value to ARR based on revenue type
// Used for all monetary display — if MRR, ×12; if ARR, passthrough
// Called with the revenueType state variable via closure in component
// ─── Period normalizer — handles every real-world date format ────────────────
// Input: any date string. Output: always Mon-YYYY (e.g. Dec-2025) or '' if unparseable.
// Handles: Mon-YY, Mon-YYYY, Month YYYY, YYYY-MM-DD, YYYY/MM/DD,
//          MM/DD/YYYY, MM/DD/YY, DD/MM/YYYY, DD-MM-YYYY,
//          MM-YYYY, MM/YYYY, YYYYMM, Q4 2025, 2025Q4
function normalizePeriod(s) {
  if (!s || typeof s !== 'string' || !s.trim()) return ''
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const MFULL  = ['january','february','march','april','may','june','july','august','september','october','november','december']
  const str = s.trim()
  let m

  // 1. Mon-YY or Mon-YYYY  →  Dec-25, Dec-2025
  m = str.match(/^([A-Za-z]{3})-(\d{2,4})$/)
  if (m) { let y=parseInt(m[2]); if(y<100) y=y<50?2000+y:1900+y; return m[1]+'-'+y }

  // 2. Month YYYY or Mon YYYY  →  December 2025, Dec 2025
  m = str.match(/^([A-Za-z]+)\s+(\d{4})$/)
  if (m) {
    const name=m[1].toLowerCase(), yr=parseInt(m[2])
    const fi=MFULL.indexOf(name)
    if (fi>=0) return MONTHS[fi]+'-'+yr
    const si=MONTHS.map(x=>x.toLowerCase()).indexOf(name)
    if (si>=0) return MONTHS[si]+'-'+yr
  }

  // 3. YYYY-MM-DD  →  2025-12-31
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) { const mi=parseInt(m[2])-1; if(mi>=0&&mi<12) return MONTHS[mi]+'-'+m[1] }

  // 4. YYYY/MM/DD  →  2025/12/31
  m = str.match(/^(\d{4})\/(\d{2})\/(\d{2})$/)
  if (m) { const mi=parseInt(m[2])-1; if(mi>=0&&mi<12) return MONTHS[mi]+'-'+m[1] }

  // 5. MM/DD/YYYY or M/D/YYYY  →  12/31/2025
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) { const mi=parseInt(m[1])-1,yr=parseInt(m[3]); if(mi>=0&&mi<12) return MONTHS[mi]+'-'+yr }

  // 6. MM/DD/YY  →  12/31/25
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
  if (m) { const mi=parseInt(m[1])-1; let yr=parseInt(m[3]); if(yr<100)yr=yr<50?2000+yr:1900+yr; if(mi>=0&&mi<12)return MONTHS[mi]+'-'+yr }

  // 7. DD-MM-YYYY or DD/MM/YYYY — first number > 12 means it's a day
  m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m) {
    const a=parseInt(m[1]),b=parseInt(m[2]),yr=parseInt(m[3])
    if (a>12&&b>=1&&b<=12) return MONTHS[b-1]+'-'+yr  // DD/MM/YYYY
    if (b>12&&a>=1&&a<=12) return MONTHS[a-1]+'-'+yr  // MM/DD/YYYY
    if (a>=1&&a<=12)       return MONTHS[a-1]+'-'+yr  // assume MM first
  }

  // 8. MM-YYYY or MM/YYYY  →  12-2025, 12/2025
  m = str.match(/^(\d{1,2})[\/\-](\d{4})$/)
  if (m) { const mi=parseInt(m[1])-1; if(mi>=0&&mi<12) return MONTHS[mi]+'-'+m[2] }

  // 9. YYYYMM  →  202512
  m = str.match(/^(\d{4})(\d{2})$/)
  if (m) { const mi=parseInt(m[2])-1,yr=parseInt(m[1]); if(mi>=0&&mi<12) return MONTHS[mi]+'-'+yr }

  // 10. Quarter: Q4 2025 or 2025Q4  →  quarter-end month
  const QM = {'1':2,'2':5,'3':8,'4':11}
  m = str.match(/^[Qq]([1-4])\s*(\d{4})$/)
  if (m) return MONTHS[QM[m[1]]]+'-'+m[2]
  m = str.match(/^(\d{4})\s*[Qq]([1-4])$/)
  if (m) return MONTHS[QM[m[2]]]+'-'+m[1]

  return str  // return as-is — caller decides what to do
}

function makeToARR(revenueType) {
  return (v) => revenueType === 'MRR' ? (v == null ? null : v * 12) : v
}

// ─── Engine config ────────────────────────────────────────────────────────────
const ENGINE_CONFIG = {
  mrr: {
    label:'MRR / ARR Analytics', desc:'Revenue bridge, retention, NRR/GRR, top movers', icon:TrendingUp,
    required:[
      {key:'customer',label:'Customer / Account ID',kw:['customer','customer_id','customerid','client','account','company']},
      {key:'date',    label:'Date / Period (Monthly)',kw:['date','activity_date','period','month','activity date']},
      {key:'revenue', label:'MRR / ARR / Revenue',kw:['mrr','arr','revenue','amount','value','mrr or arr','mrrvalue','arrvalue']},
    ],
    optional:[
      {key:'product', label:'Product',kw:['product','sku','service','product name']},
      {key:'channel', label:'Channel',kw:['channel','segment','sales channel']},
      {key:'region',  label:'Region', kw:['region','geo','geography','country']},
      {key:'quantity',label:'Quantity / Units',kw:['quantity','qty','units','seats','licenses']},
    ],
  },
  acv: {
    label:'ACV / Contract Analytics', desc:'Contract bridge, renewal rates, expiry pool', icon:FileText,
    required:[
      {key:'customer',     label:'Customer / Account ID', kw:['customer','customer_id','customerid','client','account']},
      {key:'date',         label:'Activity / Signing Date',kw:['date','activity_date','signing_date','order_date','period']},
      {key:'contractStart',label:'Contract Start Date',   kw:['contract_start','start_date','startdate','contract_begin','start']},
      {key:'contractEnd',  label:'Contract End Date',     kw:['contract_end','end_date','enddate','expiry','expiration','end']},
      {key:'tcv',          label:'TCV / ACV Amount',      kw:['tcv','acv','total_contract','contract_value','amount','revenue']},
    ],
    optional:[
      {key:'product', label:'Product', kw:['product','sku']},
      {key:'channel', label:'Channel', kw:['channel','segment']},
      {key:'region',  label:'Region',  kw:['region','geo','country']},
      {key:'quantity',label:'Quantity',kw:['quantity','qty','units','seats']},
    ],
  },
  cohort: {
    label:'Cohort Analytics', desc:'Retention heatmap, size/percentile/revenue cohorts', icon:Layers,
    required:[
      {key:'customer',label:'Customer / Account ID',kw:['customer','customer_id','customerid','client','account']},
      {key:'date',    label:'Date / Period',         kw:['date','activity_date','period','month']},
      {key:'fiscal',  label:'Fiscal Year',           kw:['fiscal','fy','fiscal_year','year']},
      {key:'revenue', label:'Revenue / MRR',         kw:['mrr','arr','revenue','amount','value']},
    ],
    optional:[
      {key:'product',label:'Product',kw:['product','sku']},
      {key:'region', label:'Region', kw:['region','geo']},
      {key:'channel',label:'Channel',kw:['channel','segment']},
    ],
  },
}

const COHORT_TYPES_CFG = [
  {id:'SG',label:'Size Cohorts',       desc:'Tier 1 / Tier 2 / Tier 3 / Long Tail'},
  {id:'PC',label:'Percentile Cohorts', desc:'Top 5% / 10% / 20% / 50%'},
  {id:'RC',label:'Revenue Cohorts',    desc:'Revenue Leaders / Growth / Tail'},
]
const SYSTEM_COMPUTED = new Set(['lookback','classify','bridge_classification','month_lookback'])

function autoDetect(cols, kws) {
  const n = s => s.toLowerCase().replace(/[^a-z0-9]/g,'')
  const nk = kws.map(n)
  return cols.find(c=>nk.includes(n(c))) || cols.find(c=>nk.some(k=>n(c).includes(k)||k.includes(n(c)))) || ''
}
function buildAutoMap(eng, cols) {
  if (!eng||!cols.length) return {}
  const map = {}
  ;[...ENGINE_CONFIG[eng].required,...(ENGINE_CONFIG[eng].optional||[])].forEach(f=>{
    if (SYSTEM_COMPUTED.has(f.key)) return
    const v = autoDetect(cols,f.kw); if(v) map[f.key]=v
  })
  return map
}

// ─── AI Narrative ─────────────────────────────────────────────────────────────
function genNarrative(ret, movers) {
  if (!ret||(!ret.beginning&&!ret.ending)) return null
  const {beginning:beg,ending:end,nrr,new_arr,churn,upsell} = ret
  const delta = end-beg, pct = beg>0?((delta/beg)*100).toFixed(1):0
  const trend = delta>=0?'grew':'contracted'
  let s = `ARR ${trend} from ${fmt(beg)} to ${fmt(end)} (${delta>=0?'+':''}${pct}%).`
  if (nrr>=100) s += ` Net retention of ${fmtPct(nrr)} — expansion is outpacing churn.`
  else if (nrr>0) s += ` Net retention at ${fmtPct(nrr)} — needs attention.`
  const returning = ret?.returning || 0
  const lapsed    = ret?.lapsed    || 0
  if (new_arr>0)    s += ` New logos contributed ${fmt(new_arr)}.`
  if (returning>0)  s += ` Returning customers added ${fmt(returning)}.`
  if (lapsed<0)     s += ` Lapsed: ${fmt(Math.abs(lapsed))}.`
  if (churn<0)   s += ` Churn impact: ${fmt(Math.abs(churn))}.`
  const exp = movers?.['Upsell']?.[0]||movers?.['New Logo']?.[0]
  const chr = movers?.['Churn']?.[0]
  if (exp) s += ` Top expansion: ${exp.customer} (+${fmt(exp.value)}).`
  if (chr) s += ` Largest churn: ${chr.customer} (${fmt(Math.abs(chr.value))}).`
  return s
}

// ─── Upload Timer ─────────────────────────────────────────────────────────────
function UploadTimer({active}) {
  const [s,setS]=useState(0)
  useEffect(()=>{ if(!active){setS(0);return}; const t=setInterval(()=>setS(n=>n+1),1000); return()=>clearInterval(t) },[active])
  if(!active) return null
  const pct=Math.min((s/90)*100,98)
  const msg=s<8?'Connecting…':s<25?'Waking API…':s<55?'Crunching numbers…':'Almost there…'
  return (
    <div className="mt-3">
      <div className="flex justify-between mb-1"><span className="text-[10px] text-[#4A5A7A]">{msg}</span><span className="text-[10px] font-bold" style={{color:'#4ADE80'}}>{s}s</span></div>
      <div className="h-1 rounded-full overflow-hidden" style={{background:'#E5E7EB'}}>
        <div className="h-full rounded-full transition-all duration-1000" style={{width:`${pct}%`,background:'#1A3A2A'}}/>
      </div>
      {s>6&&<p className="text-[9px] mt-1" style={{color:'#7B8EA8'}}>⚡ First run each session takes 30–90s</p>}
    </div>
  )
}

// ─── KPI Chip ─────────────────────────────────────────────────────────────────
function KpiChip({label,value,sub,subGood,accent}) {
  const subColor = subGood===true?'#4ADE80':subGood===false?'#F87171':'#64748B'
  const valColor = subGood===true&&(String(sub||'').includes('Healthy')||String(label||'').includes('Net'))?'#4ADE80'
    :subGood===false&&(String(sub||'').includes('Risk')||String(sub||'').includes('Alert'))?'#F87171':'#E2E8F0'
  return (
    <div style={{
      background:  '#0F1A2E',
      border:      '1px solid #1E2D45',
      borderTop:   accent ? '2px solid #253550' : '1px solid #1E2D45',
      borderRadius:6,
      padding:     '12px 14px',
    }}>
      <div style={{fontSize:9,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.1em',color:'#4A5A6E',marginBottom:7}}>
        {label}
      </div>
      <div style={{fontFamily:"'JetBrains Mono',monospace",fontFeatureSettings:"'tnum'",fontSize:19,fontWeight:700,lineHeight:1,color:valColor,letterSpacing:'-0.02em'}}>
        {value}
      </div>
      {sub!=null&&(
        <div style={{marginTop:4,fontSize:10,fontWeight:500,color:subColor}}>
          {subGood===true?'↑ ':subGood===false?'↓ ':''}{sub}
        </div>
      )}
    </div>
  )
}
// ─── Mover Card — enriched PE-grade analytics view ─────────────────────────
function MoverCard({customer,value,period,isRisk,rank,arr,health,segment,endingArr,beginningArr,region,product}) {
  const abs   = Math.abs(value||0)
  const letter = String(customer||'?')[0].toUpperCase()
  const avatarColors = [
    {bg:'rgba(74,222,128,0.1)', text:'#4ADE80'},
    {bg:'rgba(148,163,184,0.1)',text:'#94A3B8'},
    {bg:'rgba(251,191,36,0.1)', text:'#FCD34D'},
    {bg:'rgba(248,113,113,0.1)',text:'#F87171'},
    {bg:'rgba(167,139,250,0.1)',text:'#A78BFA'},
  ]
  const av = avatarColors[rank % avatarColors.length]

  // Health score = ending_arr / beginning_arr * 100
  const healthScore = (()=>{
    if (endingArr != null && beginningArr != null && beginningArr > 0)
      return Math.round((endingArr / beginningArr) * 100)
    if (health != null) return Math.round(health)
    return null
  })()
  const healthColor = healthScore==null?'#64748B':healthScore>=100?'#4ADE80':healthScore>=80?'#FCD34D':'#F87171'

  const flag = isRisk
    ? (healthScore!=null&&healthScore<50?'HIGH RISK':'AT RISK')
    : (healthScore!=null&&healthScore>=110?'EXPANDING':'OPPORTUNITY')
  const flagColor = isRisk ? '#F87171' : '#4ADE80'

  const arrDisplay = arr||endingArr||(abs*5)
  const changeBarPct = arrDisplay>0 ? Math.min((abs/arrDisplay)*100, 100) : Math.min(abs/50000*100,100)

  return (
    <div style={{
      padding:'12px 14px',borderRadius:6,
      background:'#0D1A2E',
      border:`1px solid ${isRisk?'rgba(248,113,113,0.12)':'rgba(74,222,128,0.1)'}`,
      marginBottom:6,transition:'border-color 0.12s',cursor:'default',
    }}
    onMouseEnter={e=>e.currentTarget.style.borderColor=isRisk?'rgba(248,113,113,0.28)':'rgba(74,222,128,0.22)'}
    onMouseLeave={e=>e.currentTarget.style.borderColor=isRisk?'rgba(248,113,113,0.12)':'rgba(74,222,128,0.1)'}>

      <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
        {/* Avatar */}
        <div style={{width:32,height:32,borderRadius:5,background:av.bg,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:12,color:av.text,flexShrink:0,marginTop:1}}>
          {letter}
        </div>
        <div style={{flex:1,minWidth:0}}>
          {/* Row 1: Name + ARR numbers */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,marginBottom:6}}>
            <div style={{fontWeight:600,fontSize:13,color:'#E2E8F0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'55%'}}>{customer||'Unknown'}</div>
            <div style={{textAlign:'right',flexShrink:0}}>
              {arrDisplay>0&&<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:'#94A3B8'}}>{fmt(arrDisplay)}</div>}
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:600,color:isRisk?'#F87171':'#4ADE80'}}>
                {isRisk?'▼':'+▲'} {fmt(abs)}
              </div>
            </div>
          </div>
          {/* Row 2: Chips */}
          <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
            <span style={{fontSize:9,fontWeight:700,letterSpacing:'0.05em',color:flagColor,background:`${flagColor}12`,border:`1px solid ${flagColor}22`,padding:'2px 6px',borderRadius:3}}>
              {flag}
            </span>
            {healthScore!=null&&(
              <span style={{fontSize:9,fontWeight:600,color:healthColor,background:`${healthColor}12`,border:`1px solid ${healthColor}22`,padding:'2px 6px',borderRadius:3,fontFamily:"'JetBrains Mono',monospace"}}>
                {healthScore}% health
              </span>
            )}
            {region&&<span style={{fontSize:9,color:'#4A5A6E',background:'#162035',border:'1px solid #1E2D45',padding:'2px 6px',borderRadius:3}}>{region}</span>}
            {product&&<span style={{fontSize:9,color:'#4A5A6E',background:'#162035',border:'1px solid #1E2D45',padding:'2px 6px',borderRadius:3}}>{product}</span>}
            {segment&&segment!==region&&segment!==product&&<span style={{fontSize:9,color:'#4A5A6E',background:'#162035',border:'1px solid #1E2D45',padding:'2px 6px',borderRadius:3}}>{segment}</span>}
            {period&&<span style={{fontSize:9,color:'#3D5068',marginLeft:'auto'}}>{period}</span>}
          </div>
          {/* Change bar */}
          <div style={{height:2,background:'#1E2D45',borderRadius:2,marginTop:8,overflow:'hidden'}}>
            <div style={{height:'100%',borderRadius:2,background:isRisk?'#F87171':'#4ADE80',width:`${changeBarPct}%`,transition:'width 0.5s ease'}}/>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Waterfall Bridge ─────────────────────────────────────────────────────────
// ─── Cumulative Waterfall Engine ─────────────────────────────────────────────
// Builds a true floating-bar waterfall where movement bars start from their
// cumulative running total — not from zero. Works at all aggregation levels.
// Input: data = [{category, value}] with Beginning ARR first and Ending ARR last.
// The engine computes start/end for each bar automatically.
function buildWaterfallSteps(data) {
  if (!data?.length) return []
  const BOUNDARY = new Set(['Beginning ARR','Ending ARR','Beginning MRR','Ending MRR','Prior ACV','Ending ACV'])
  const steps = []
  let running = 0

  data.forEach(item => {
    const { category, value } = item
    if (category === 'Beginning ARR' || category === 'Beginning MRR') {
      running = value
      steps.push({ type:'start', category, value, barStart:0, barEnd:value, delta:value })
    } else if (BOUNDARY.has(category)) {
      // Ending bar: full bar from 0, value = running total (reconciliation check)
      steps.push({ type:'end', category, value:running, barStart:0, barEnd:running, delta:0 })
    } else if (value !== 0) {
      const start = running
      const end   = running + value
      running     = end
      steps.push({ type:'movement', category, value, barStart:Math.min(start,end), barEnd:Math.max(start,end), delta:value, runStart:start, runEnd:end })
    }
  })
  return steps
}

function WaterfallBridge({data, showBoundary=false, height=280}) {
  if(!data?.length) return <div style={{height:180,display:'flex',alignItems:'center',justifyContent:'center',color:'#7B8EA8',fontSize:13}}>No bridge data</div>

  const BOUNDARY = new Set(['Beginning ARR','Ending ARR','Beginning MRR','Ending MRR','Prior ACV','Ending ACV'])
  const ORDER=['Beginning ARR','Beginning MRR','Churn','Churn-Partial','Churn_Partial','Churn Partial','Downsell','Upsell','Cross-sell','Cross_sell','New Logo','Lapsed','Returning','Other In','Other Out','Add on','Add-on','Ending ARR','Ending MRR']

  // Sort and filter input
  const sorted = [...data].sort((a,b)=>{
    const ai=ORDER.indexOf(a.category), bi=ORDER.indexOf(b.category)
    return (ai<0?99:ai)-(bi<0?99:bi)
  })
  const filtered = showBoundary ? sorted : sorted.filter(d => !BOUNDARY.has(d.category) && d.value!==0)

  // Reconstruct with boundary for step building
  const beg = data.find(d=>BOUNDARY.has(d.category)&&d.value>0)
  const end = data.find(d=>d.category==='Ending ARR'||d.category==='Ending MRR')
  const movements = filtered.filter(d=>!BOUNDARY.has(d.category))
  const fullForSteps = [
    ...(beg?[beg]:[]),
    ...movements,
    ...(end?[end]:[]),
  ]
  const steps = buildWaterfallSteps(fullForSteps)
  if(!steps.length) return null

  // Chart needs two Bar series: transparent spacer + visible bar
  const chartData = steps.map(s=>({
    category:  s.category,
    spacer:    s.type==='start'||s.type==='end' ? 0 : s.barStart,
    bar:       s.barEnd - s.barStart,
    value:     s.value,
    delta:     s.delta,
    type:      s.type,
    runStart:  s.runStart,
    runEnd:    s.runEnd,
  }))

  const getBarColor = (entry) => {
    if (entry.type==='start'||entry.type==='end') return '#3D5068'
    return entry.delta>=0 ? (BC[entry.category]||'#22C55E') : (BC[entry.category]||'#EF4444')
  }

  const CustomTooltip=({active,payload,label})=>{
    if(!active||!payload?.length) return null
    const d = payload.find(p=>p.dataKey==='bar')?.payload
    if (!d) return null
    const isBound = d.type==='start'||d.type==='end'
    const displayVal = isBound ? d.value : d.delta
    return (
      <div style={{background:'#0F1A2E',border:'1px solid #1E2D45',borderRadius:6,padding:'8px 12px',boxShadow:'0 4px 12px rgba(0,0,0,0.4)'}}>
        <div style={{fontSize:10,fontWeight:600,color:'#7B8EA8',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>{d.category}</div>
        <div style={{fontSize:15,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:isBound?'#E2E8F0':displayVal>=0?'#4ADE80':'#F87171'}}>
          {isBound?'':displayVal>=0?'+':''}{fmt(displayVal)}
        </div>
        {!isBound&&d.runStart!=null&&(
          <div style={{fontSize:10,color:'#4A5A6E',marginTop:3}}>
            {fmt(d.runStart)} → {fmt(d.runEnd)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{height}}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{top:8,right:8,bottom:52,left:8}} barCategoryGap="25%">
          <XAxis dataKey="category" tick={{fontSize:9,fill:'#9CA3AF'}} angle={-38} textAnchor="end" interval={0} axisLine={false} tickLine={false} height={56}/>
          <YAxis tickFormatter={fmt} tick={{fontSize:9,fill:'#9CA3AF'}} width={52} axisLine={false} tickLine={false}/>
          <ReferenceLine y={0} stroke='#1A2840' strokeDasharray='3 3'/>
          <Tooltip content={<CustomTooltip/>} cursor={{fill:'rgba(255,255,255,0.02)'}}/>
          {/* Invisible spacer — lifts the visible bar to correct vertical position */}
          <Bar dataKey="spacer" stackId="wf" fill="transparent" radius={0} maxBarSize={48}/>
          {/* Visible bar — colored by movement type */}
          <Bar dataKey="bar" stackId="wf" radius={[3,3,0,0]} maxBarSize={48}>
            {chartData.map((e,i)=><Cell key={i} fill={getBarColor(e)}/>)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
// ─── Bridge Pivot Table ───────────────────────────────────────────────────────
function BridgePivotTable({pivot,title,lookbackLabel,showPct}) {
  if(!pivot?.periods?.length||!pivot?.rows?.length) return <div style={{color:'#7B8EA8',textAlign:'center',padding:'32px',fontSize:13}}>No bridge data</div>
  const {periods,rows,retention}=pivot
  return (
    <div style={{overflowX:'auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
        <span style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em',color:'#7B8EA8'}}>{title}</span>
        {lookbackLabel&&<span style={{fontSize:9,background:'transparent',color:'#3D5068',border:'none',padding:'2px 0',fontWeight:400}}>{lookbackLabel}</span>}
      </div>
      <table style={{borderCollapse:'collapse',minWidth:Math.max(periods.length*100+220,420),width:'100%',fontSize:12}}>
        <thead>
          <tr style={{borderBottom:'1px solid #1E2D45'}}>
            <th style={{textAlign:'left',padding:'8px 12px',fontSize:9,fontWeight:700,textTransform:'uppercase',color:'#7B8EA8',width:160,position:'sticky',left:0,background:'#0F1A2E'}}>Bridge</th>
            {periods.map(p=><th key={p} style={{textAlign:'right',padding:'8px 12px',fontSize:9,fontWeight:700,color:'#7B8EA8',whiteSpace:'nowrap'}}>{p}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row,ri)=>{
            const isB=row.is_beginning||row.is_ending
            return (
              <tr key={ri} style={{borderBottom:`1px solid ${isB?'#E5E7EB':'#E5E7EB'}`,background:isB?'#162035':'#0F1A2E'}}>
                <td style={{padding:'8px 12px',position:'sticky',left:0,background:isB?'#162035':'#0F1A2E',color:isB?'#111827':'#374151',fontWeight:isB?700:500,fontSize:11,whiteSpace:'nowrap'}}>
                  {!isB&&<span style={{display:'inline-block',width:6,height:6,borderRadius:'50%',background:BC[row.classification]||'#6B7280',marginRight:8,verticalAlign:'middle'}}/>}
                  {row.classification}
                </td>
                {periods.map(p=>{
                  const v=row.values?.[p]
                  const pos=v>0
                  return (
                    <td key={p} style={{textAlign:'right',padding:'8px 12px',whiteSpace:'nowrap',fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:isB?700:500,color:isB?'#E2E8F0':pos?'#4ADE80':v<0?'#F87171':'#64748B'}}>
                      {v==null||v===0?'—':(pos&&!isB?'+':'')+fmt(v)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
          {retention&&Object.keys(retention).length>0&&[['Gross Retention','grr',80],['Net Retention','nrr',100]].map(([lbl,key,thr])=>(
            <tr key={key} style={{borderTop:'1px solid #253550',background:'#162035'}}>
              <td style={{padding:'8px 12px',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'#7B8EA8',position:'sticky',left:0,background:'#0F1A2E',whiteSpace:'nowrap'}}>{lbl}</td>
              {periods.map(p=>{const v=retention[p]?.[key];return(
                <td key={p} style={{textAlign:'right',padding:'8px 12px',fontWeight:900,fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:v>=thr?'#4ADE80':'#F87171'}}>{v!=null?`${v.toFixed(1)}%`:'—'}</td>
              )})}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Customer Count Pivot ─────────────────────────────────────────────────────
function CustomerCountPivot({pivot}) {
  if(!pivot?.periods?.length||!pivot?.rows?.length) return null
  const {periods,rows,logo_retention}=pivot
  return (
    <div style={{overflowX:'auto',marginTop:24,paddingTop:24,borderTop:'1px solid #253550'}}>
      <div style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em',color:'#7B8EA8',marginBottom:10}}>Customer Count Rollforward</div>
      <table style={{borderCollapse:'collapse',minWidth:Math.max(periods.length*90+200,400),width:'100%',fontSize:12}}>
        <thead>
          <tr style={{borderBottom:'1px solid #1E2D45'}}>
            <th style={{textAlign:'left',padding:'6px 12px',fontSize:9,fontWeight:700,color:'#7B8EA8',width:160,position:'sticky',left:0,background:'#0F1A2E'}}/>
            {periods.map(p=><th key={p} style={{textAlign:'right',padding:'6px 12px',fontSize:9,fontWeight:700,color:'#7B8EA8',whiteSpace:'nowrap'}}>{p}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row,ri)=>{
            const isB=row.is_beginning||row.is_ending
            return (
              <tr key={ri} style={{borderBottom:'1px solid #1E2D45',background:isB?'#162035':'#0F1A2E'}}>
                <td style={{padding:'6px 12px',position:'sticky',left:0,background:isB?'#162035':'#0F1A2E',color:isB?'#111827':'#374151',fontWeight:isB?700:400,fontSize:11,whiteSpace:'nowrap'}}>{row.classification}</td>
                {periods.map(p=>{const v=row.values?.[p]||0;return(
                  <td key={p} style={{textAlign:'right',padding:'6px 12px',fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:500,color:v>0&&!isB?'#4ADE80':v<0?'#F87171':'#64748B'}}>{v===0?'—':(v>0&&!isB?'+':'')+v.toLocaleString()}</td>
                )})}
              </tr>
            )
          })}
          {logo_retention&&(
            <tr style={{borderTop:'1px solid #253550',background:'#162035'}}>
              <td style={{padding:'6px 12px',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'#7B8EA8',position:'sticky',left:0,background:'#0F1A2E',whiteSpace:'nowrap'}}>Logo Retention</td>
              {periods.map(p=>{const lr=logo_retention[p]?.logo_retention;return(
                <td key={p} style={{textAlign:'right',padding:'6px 12px',fontWeight:900,fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:lr>=80?'#4ADE80':lr>=60?'#64748B':'#F87171'}}>{lr!=null?`${lr.toFixed(1)}%`:'—'}</td>
              )})}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── KPI Summary Table ────────────────────────────────────────────────────────
function KpiSummaryTable({rows}) {
  if(!rows?.length) return null
  const fV=v=>{if(v==null||v===0)return'—';const a=Math.abs(v);if(a>=1e6)return`$${(v/1e6).toFixed(1)}M`;if(a>=1e3)return`$${(v/1e3).toFixed(0)}K`;return`$${v.toFixed(0)}`}
  const fP=v=>v==null?'—':`${v.toFixed(1)}%`
  const pc=(v,g=80,gr=100)=>v==null?'#6B7280':v>=gr?'#2563EB':v>=g?'#6B7280':'#DC2626'
  return (
    <div style={{overflowX:'auto'}}>
      <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
        <thead>
          <tr style={{borderBottom:'1px solid #1E2D45'}}>
            {['Period','Beg ARR','New Logo','Upsell','Downsell','Churn','End ARR','GRR','NRR'].map(h=>(
              <th key={h} style={{textAlign:'left',padding:'10px 12px',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'#7B8EA8',whiteSpace:'nowrap'}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r,i)=>(
            <tr key={i} style={{borderBottom:'1px solid #1E2D45'}}>
              <td style={{padding:'8px 12px',fontWeight:700,color:'#FFFFFF',fontFamily:"'JetBrains Mono',monospace"}}>{r.period}</td>
              <td style={{padding:'8px 12px',color:'#7B8EA8',fontFamily:"'JetBrains Mono',monospace"}}>{fV(r.beginning_arr)}</td>
              <td style={{padding:'8px 12px',color:'#4ADE80',fontWeight:600,fontFamily:"'JetBrains Mono',monospace"}}>{r.new_logo>0?`+${fV(r.new_logo)}`:'—'}</td>
              <td style={{padding:'8px 12px',color:'#4ADE80',fontWeight:500,fontFamily:"'JetBrains Mono',monospace"}}>{r.upsell>0?`+${fV(r.upsell)}`:'—'}</td>
              <td style={{padding:'8px 12px',color:'#7B8EA8',fontWeight:600,fontFamily:"'JetBrains Mono',monospace"}}>{fV(r.downsell)}</td>
              <td style={{padding:'8px 12px',color:'#F87171',fontWeight:600,fontFamily:"'JetBrains Mono',monospace"}}>{fV(r.churn)}</td>
              <td style={{padding:'8px 12px',fontWeight:700,color:'#FFFFFF',fontFamily:"'JetBrains Mono',monospace"}}>{fV(r.ending_arr)}</td>
              <td style={{padding:'8px 12px',fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:pc(r.gross_retention)}}>{fP(r.gross_retention)}</td>
              <td style={{padding:'8px 12px',fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:pc(r.net_retention,100,110)}}>{fP(r.net_retention)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Cohort Heatmap ───────────────────────────────────────────────────────────
function CohortHeatmap({data,title,isPercent}) {
  if(!data?.length) return <div style={{color:'#7B8EA8',textAlign:'center',padding:24,fontSize:13}}>No data</div>
  const allKeys=Array.from(new Set(data.flatMap(r=>Object.keys(r).filter(k=>k!=='cohort')))).sort((a,b)=>Number(a)-Number(b))
  const allVals=data.flatMap(r=>allKeys.map(k=>r[k]||0)).filter(v=>v>0)
  const maxVal=Math.max(...allVals,1)
  const color=v=>{
    if(!v)return'transparent'
    if(!isPercent)return`rgba(79,219,200,${0.1+(v/maxVal)*0.7})`
    if(v>=90)return'#4FDBC8';if(v>=70)return'#2DB8A5';if(v>=50)return'#1A7A6E'
    if(v>=30)return'#6B7280';return'#DC2626'
  }
  const tc=v=>{if(!v)return'transparent';if(isPercent&&v>=50)return'#FFFFFF';return'#6B7280'}
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <span style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em',color:'#7B8EA8'}}>{title}</span>
        <span style={{fontSize:9,color:'#7B8EA8'}}>{allKeys.length} periods · {data.length} cohorts</span>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{fontSize:11,minWidth:allKeys.length*36+120}}>
          <thead><tr>
            <th style={{textAlign:'left',padding:'4px 12px 4px 0',fontSize:9,fontWeight:600,color:'#7B8EA8',position:'sticky',left:0,background:'#0F1A2E',whiteSpace:'nowrap'}}>Cohort</th>
            {allKeys.map(k=><th key={k} style={{padding:'0 2px',textAlign:'center',fontSize:9,color:'#7B8EA8',fontWeight:600,whiteSpace:'nowrap'}}>M{k}</th>)}
          </tr></thead>
          <tbody>
            {data.map((row,ri)=>(
              <tr key={ri}>
                <td style={{padding:'2px 12px 2px 0',fontSize:10,fontWeight:600,color:'#FFFFFF',whiteSpace:'nowrap',position:'sticky',left:0,background:'#0F1A2E'}}>{row.cohort}</td>
                {allKeys.map(k=>{const v=row[k];return(
                  <td key={k} style={{padding:'2px'}}>
                    <div style={{width:32,height:22,borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,background:color(v),color:tc(v)}}>
                      {v?(isPercent?`${v}%`:fmt(v)):''}
                    </div>
                  </td>
                )})}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Field Row ────────────────────────────────────────────────────────────────
function FieldRow({label,required,value,columns,onChange,showError}) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderBottom:'1px solid #1E2D45'}}>
      <div style={{flex:1,fontSize:11,color:'#7B8EA8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{label}</div>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{
        fontSize:10,border:`1px solid ${showError&&!value?'rgba(255,71,87,0.4)':value?'rgba(37,99,235,0.25)':'#E5E7EB'}`,
        borderRadius:8,padding:'5px 8px',background:'#162035',
        color:showError&&!value?'#FF6B6B':value?'#4FDBC8':'#7B8EA8',
        outline:'none',width:140,flexShrink:0,
      }}>
        <option value="">— Select —</option>
        {columns.map(c=><option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function CommandCenter() {
  const router = useRouter()
  const fileRef = useRef(null)
  const [profile, setProfile] = useState(null)

  // File
  const [file, setFile]       = useState(null)
  const [columns, setColumns] = useState([])
  const [rowCount, setRowCount] = useState(0)
  const [uploading, setUploading]       = useState(false)
  const [uploadErr, setUploadErr]       = useState('')
  const [isBridgeOutput, setIsBridgeOutput] = useState(false)

  // Engine
  const [engine, setEngine] = useState(null)

  // Field mapping
  const [fieldMap, setFieldMap]   = useState({})
  const [showOpt, setShowOpt]     = useState(false)
  const [validated, setValidated] = useState(false)

  // Cohort config
  const [cohortTypes, setCohortTypes]       = useState(['SG','PC','RC'])
  const [periodFilter, setPeriodFilter]     = useState('all')
  const [selectedFY, setSelectedFY]         = useState('')
  const [useSingle, setUseSingle]           = useState(true)
  const [useMulti, setUseMulti]             = useState(false)
  const [individualCols, setIndividualCols] = useState([''])
  const [hierarchies, setHierarchies]       = useState([['']])

  // MRR/ACV config
  const [lookbacks, setLookbacks] = useState([1,3,12])
  const [revenueUnit, setRevUnit] = useState('raw')
  const [periodType, setPeriod]   = useState('Annual')
  // MRR vs ARR toggle — if MRR, multiply ×12 to derive ARR everywhere
  const [revenueType, setRevenueType] = useState('ARR')  // 'MRR' | 'ARR'

  // Results
  const [results, setResults]     = useState(null)
  const [running, setRunning]     = useState(false)
  const [runErr, setRunErr]       = useState('')
  const [selLb, setSelLb]         = useState(12)
  const [yearFilter, setYearFilter] = useState('All')
  const [activeTab, setActiveTab]   = useState('summary')
  const [moverCat, setMoverCat]     = useState('')
  // Inline cohort results fetched when user clicks Cohort Heatmap tab
  const [cohortResults, setCohortResults] = useState(null)
  const [cohortRunning, setCohortRunning] = useState(false)
  const [cohortErr, setCohortErr]         = useState('')
  const [cohortView, setCohortView]       = useState('pct')   // 'pct' | 'arr' | 'per_cust'

  // Header filter state — these control UI; re-runs happen via applyFilters()
  const [selDims, setSelDims]       = useState('customer')   // 'customer'|'product'|'region'
  const [selPeriod, setSelPeriod]   = useState('')           // e.g. 'Jan-25' — empty = latest
  const [rerunning, setRerunning]   = useState(false)
  const [summarySubTab, setSummarySubTab] = useState('ARR Bridge') // sub-tabs inside summary
  const [histChartWindow, setHistChartWindow] = useState(24)  // Historical perf chart window

  const isAdmin  = canDownload(profile)
  const cfg      = engine ? ENGINE_CONFIG[engine] : null
  const isCohort = results?._engine === 'cohort'

  const errors = useMemo(() => {
    const e = {}
    if (!engine) return e
    ENGINE_CONFIG[engine].required.forEach(f => { if (!fieldMap[f.key]) e[f.key] = 'Required' })
    return e
  }, [engine, fieldMap])

  const step1  = columns.length > 0
  const step2  = step1 && !!engine
  const step3  = step2 && Object.keys(errors).length === 0
  const canRun = step3 && !running

  // ── ARR converter — ×12 if MRR input ──────────────────────────────────────
  const toARR = makeToARR(revenueType)

  // Derived
  const lb       = String(selLb)
  const bdg      = results?.bridge?.[lb]
  const ret      = bdg?.retention
  const wfall    = bdg?.waterfall || []
  const fyYears  = results?.metadata?.fiscal_years || results?.fiscal_years || []

  // ── Client-side bridge computation from raw MRR file ────────────────────────
  // The API returns only annual/fiscal-year aggregates. For monthly period filtering
  // we compute the bridge directly from the uploaded file in the browser.
  const [rawFileRows, setRawFileRows] = useState([])

  useEffect(() => {
    if (!file || !results) { setRawFileRows([]); return }
    console.log('[RL] FileReader: reading', file.name, file.size, 'bytes')
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target.result
        const lines = text.replace(/\r/g,'').split('\n')
        if (lines.length < 2) return
        const parseRow = (line) => {
          const result = []; let cur = '', inQ = false
          for (let i = 0; i < line.length; i++) {
            const c = line[i]
            if (c === '"') inQ = !inQ
            else if (c === ',' && !inQ) { result.push(cur.trim()); cur = '' }
            else cur += c
          }
          result.push(cur.trim()); return result
        }
        const headers = parseRow(lines[0])
        const rows = []
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue
          const vals = parseRow(lines[i])
          const row = {}
          headers.forEach((h, j) => { row[h] = vals[j] ?? '' })
          rows.push(row)
        }
        console.log('[RL] FileReader: parsed', rows.length, 'rows, headers=', headers)
        setRawFileRows(rows)
      } catch(err) { console.error('[RL] FileReader error:', err) }
    }
    reader.readAsText(file)
  }, [file, results])

  // ── Effective by_period ─────────────────────────────────────────────────────
  // Source priority (most → least reliable):
  //   1. results.output grouped by date+lb  — API bridge output rows, complete
  //   2. results.bridge[lb].by_period       — API pre-aggregated per period
  //   3. results.kpi_matrix                 — API annual summary (last resort)
  //   4. rawFileRows client bridge           — only when API has no monthly data
  const effectiveByPeriod = useMemo(() => {
    if (!results) return []

    const MONTHS_ARR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const pKey = (p) => { const m = p?.match(/^([A-Za-z]{3})-(\d{4})$/); return m ? parseInt(m[2])*100+MONTHS_ARR.indexOf(m[1]) : 0 }
    const isMonthPeriod = (p) => /^[A-Za-z]{3}-\d{4}$/.test(p||'')

    // ── SOURCE 1: results.output — raw bridge output rows grouped by date+lb ──
    if (results.output?.length > 0) {
      const firstRow = results.output[0]
      const cols = Object.keys(firstRow)
      const dateKey = cols.find(k => /^date$/i.test(k)) || cols.find(k => /activity.?date/i.test(k)) || cols.find(k => /^period$/i.test(k))
      const catKey  = cols.find(k => /^classification$/i.test(k)) || cols.find(k => /bridge.?class/i.test(k)) || cols.find(k => /^category$/i.test(k))
      const valKey  = cols.find(k => /^amount$/i.test(k)) || cols.find(k => /bridge.?value/i.test(k)) || cols.find(k => /^value$/i.test(k))
      const lbKey   = cols.find(k => /month.?lookback/i.test(k)) || cols.find(k => /^lookback$/i.test(k))
      if (dateKey && catKey && valKey) {
        const periodMap = new Map()
        results.output.forEach(row => {
          if (lbKey && parseInt(String(row[lbKey])) !== selLb) return
          const period = normalizePeriod(String(row[dateKey] || ''))
          if (!isMonthPeriod(period)) return
          if (!periodMap.has(period)) periodMap.set(period, { _period: period })
          const pRow = periodMap.get(period)
          const cat = String(row[catKey] || '').trim()
          const val = parseFloat(String(row[valKey])) || 0
          if (cat) pRow[cat] = (pRow[cat] || 0) + val
        })
        if (periodMap.size >= 12) {
          const arr = Array.from(periodMap.values()).sort((a,b) => pKey(a._period)-pKey(b._period))
          console.log('[RL] ebp source1 output:', arr.length, 'periods')
          return arr
        }
      }
    }

    // ── SOURCE 2: results.bridge[lb].by_period — API per-period aggregates ───
    const byPeriod = results.bridge?.[String(selLb)]?.by_period
    if (byPeriod?.length > 0) {
      const normalized = byPeriod
        .map(r => ({ ...r, _period: normalizePeriod(r._period || r.period || '') }))
        .filter(r => isMonthPeriod(r._period))
        .sort((a,b) => pKey(a._period)-pKey(b._period))
      if (normalized.length >= 2) {
        console.log('[RL] ebp source2 by_period:', normalized.length, 'periods')
        return normalized
      }
    }

    // ── SOURCE 3: kpi_matrix — API monthly KPI rows ───────────────────────────
    if (results.kpi_matrix?.length > 0) {
      const pick = (obj, ...keys) => { for (const k of keys) { if (obj[k] != null) return obj[k] } return undefined }
      const lbField = Object.keys(results.kpi_matrix[0]).find(k => /lookback/i.test(k))
      const src = lbField ? results.kpi_matrix.filter(r => parseInt(String(r[lbField])) === selLb) : results.kpi_matrix
      const rows = (src.length > 0 ? src : results.kpi_matrix).map(r => {
        const period = normalizePeriod(String(pick(r,'period','Period','month','date') || ''))
        if (!isMonthPeriod(period)) return null
        return {
          _period:         period,
          'Beginning ARR': pick(r,'beginning_arr','beginning','beg_arr') ?? 0,
          'Ending ARR':    pick(r,'ending_arr','ending','end_arr') ?? 0,
          'New Logo':      pick(r,'new_logo','new_arr') ?? 0,
          'Upsell':        pick(r,'upsell','expansion') ?? 0,
          'Downsell':      pick(r,'downsell','contraction') ?? 0,
          'Churn':         pick(r,'churn','churn_arr') ?? 0,
          'Returning':     pick(r,'returning') ?? 0,
          'Lapsed':        pick(r,'lapsed') ?? 0,
          _nrr:            pick(r,'nrr','net_retention') ?? null,
          _grr:            pick(r,'grr','gross_retention') ?? null,
        }
      }).filter(Boolean).sort((a,b) => pKey(a._period)-pKey(b._period))
      if (rows.length >= 2) {
        console.log('[RL] ebp source3 kpi_matrix:', rows.length, 'periods')
        return rows
      }
    }

    // ── SOURCE 4: client-side bridge from raw file (last resort) ─────────────
    // Two sub-paths:
    //   A) File has Bridge Classification column → group by date+lb+classification (exact, fast)
    //   B) Pure MRR file (no pre-classified data) → atomic-first ARR snapshot bridge
    if (rawFileRows.length > 0) {
      const cols = Object.keys(rawFileRows[0])

      // Common column detection
      const dateKey = cols.find(k => /^date$/i.test(k)) ||
                      cols.find(k => /activity.?date/i.test(k)) ||
                      cols.find(k => /^period$/i.test(k)) ||
                      fieldMap.date
      const lbKey   = cols.find(k => /month.?lookback/i.test(k)) ||
                      cols.find(k => /^lookback$/i.test(k))

      // Check if file has pre-classified bridge data
      const catKey  = cols.find(k => /^classification$/i.test(k)) ||
                      cols.find(k => /bridge.?class/i.test(k)) ||
                      cols.find(k => /^category$/i.test(k))
      const valKey  = cols.find(k => /^amount$/i.test(k)) ||
                      cols.find(k => /bridge.?value/i.test(k)) ||
                      cols.find(k => /^value$/i.test(k))

      // ── PATH A: pre-classified bridge output file ─────────────────────────
      if (dateKey && catKey && valKey) {
        console.log('[RL] ebp source4A: bridge output file, catKey=',catKey,'valKey=',valKey,'lbKey=',lbKey)
        const periodMap = new Map()
        rawFileRows.forEach(row => {
          if (lbKey) {
            const rowLb = parseInt(String(row[lbKey]))
            if (rowLb !== selLb) return
          }
          const period = normalizePeriod(String(row[dateKey] || ''))
          if (!period || !/^[A-Za-z]{3}-\d{4}$/.test(period)) return
          if (!periodMap.has(period)) periodMap.set(period, { _period: period })
          const pRow = periodMap.get(period)
          const cat = String(row[catKey] || '').trim()
          const val = parseFloat(String(row[valKey])) || 0
          if (cat) pRow[cat] = (pRow[cat] || 0) + val
        })
        if (periodMap.size >= 2) {
          const arr = Array.from(periodMap.values()).sort((a,b) => pKey(a._period)-pKey(b._period))
          console.log('[RL] ebp source4A result:', arr.length, 'periods, last=', arr[arr.length-1]?._period)
          return arr
        }
      }

      // ── PATH B: pure MRR file — atomic-first ARR snapshot bridge ──────────
      // Used when file has no pre-classified bridge data (raw subscription snapshots).
      // Classifies at atomic level (Cust+Prod+Chan+Reg), rolls up to selDims.
      const custKey    = cols.find(k => /customer.?name/i.test(k)) || cols.find(k => /^customer$/i.test(k)) || fieldMap.customer
      const arrKey     = cols.find(k => /^arr$/i.test(k)) || cols.find(k => /^mrr$/i.test(k)) || cols.find(k => /^revenue$/i.test(k)) || fieldMap.revenue
      const productKey = cols.find(k => /^product/i.test(k)) || fieldMap.product || null
      const channelKey = cols.find(k => /^channel/i.test(k)) || fieldMap.channel || null
      const regionKey  = cols.find(k => /^region/i.test(k))  || fieldMap.region  || null
      console.log('[RL] ebp source4B: MRR file, custKey=',custKey,'arrKey=',arrKey)

      if (custKey && dateKey && arrKey) {
        const snapshots = new Map()   // period → Map<atomicKey, {arr,cust}>
        const custSnaps = new Map()   // period → Map<cust, arr>
        const allPeriods = new Set()

        rawFileRows.forEach(row => {
          const period = normalizePeriod(String(row[dateKey] || ''))
          if (!period || !/^[A-Za-z]{3}-\d{4}$/.test(period)) return
          const cust = String(row[custKey] || '').trim()
          const prod = productKey ? String(row[productKey] || '').trim() : ''
          const chan = channelKey ? String(row[channelKey] || '').trim() : ''
          const reg  = regionKey  ? String(row[regionKey]  || '').trim() : ''
          const arr  = parseFloat(String(row[arrKey] || '0').replace(/,/g,'')) || 0
          if (!cust) return
          allPeriods.add(period)
          const atomicK = [cust,prod,chan,reg].filter(Boolean).join('|||')
          if (!snapshots.has(period)) snapshots.set(period, new Map())
          const snap = snapshots.get(period)
          const existing = snap.get(atomicK) || {arr:0, cust}
          snap.set(atomicK, {arr: existing.arr + arr, cust})
          if (!custSnaps.has(period)) custSnaps.set(period, new Map())
          custSnaps.get(period).set(cust, (custSnaps.get(period).get(cust)||0) + arr)
        })

        if (allPeriods.size >= 2) {
          const sortedPeriods = Array.from(allPeriods).sort((a,b) => pKey(a)-pKey(b))
          const periodMap = new Map()

          sortedPeriods.forEach(period => {
            const priorDate = new Date(Math.floor(pKey(period)/100), pKey(period)%100, 1)
            priorDate.setMonth(priorDate.getMonth() - selLb)
            const priorStr = MONTHS_ARR[priorDate.getMonth()] + '-' + priorDate.getFullYear()
            const priorK   = pKey(priorStr)
            const curAtomic  = snapshots.get(period)  || new Map()
            const prevAtomic = snapshots.get(priorStr) || new Map()
            const allAtomics = new Set([...curAtomic.keys(), ...prevAtomic.keys()])

            let beg=0,end=0,newLogo=0,crossSell=0,returning=0,upsell=0,downsell=0,churnPartial=0,churn=0,lapsed=0

            allAtomics.forEach(atomicKey => {
              const curE = curAtomic.get(atomicKey), prevE = prevAtomic.get(atomicKey)
              const cur = curE?.arr||0, prev = prevE?.arr||0
              const custId = (curE||prevE)?.cust||''
              beg += prev; end += cur

              if (prev===0 && cur>0) {
                const hasHist = sortedPeriods.some(p => pKey(p)<priorK && (snapshots.get(p)?.get(atomicKey)?.arr||0)>0)
                if (hasHist) { returning += cur }
                else {
                  const custPrev = custSnaps.get(priorStr)?.get(custId)||0
                  if (custPrev>0) crossSell += cur; else newLogo += cur
                }
              } else if (prev>0 && cur===0) {
                const custCur = custSnaps.get(period)?.get(custId)||0
                if (custCur>0) {
                  churnPartial += -prev
                } else {
                  const periodsBeforePrior = sortedPeriods.filter(p=>pKey(p)<priorK).sort((a,b)=>pKey(b)-pKey(a))
                  const pbp = periodsBeforePrior[0]
                  const wasAbsent = pbp ? (snapshots.get(pbp)?.get(atomicKey)?.arr||0)===0 : false
                  const hadHist   = sortedPeriods.some(p=>pKey(p)<priorK && (snapshots.get(p)?.get(atomicKey)?.arr||0)>0)
                  if (wasAbsent && hadHist) lapsed += -prev; else churn += -prev
                }
              } else if (cur>prev) { upsell += cur-prev
              } else if (cur<prev) { downsell += cur-prev }
            })

            const movements = selDims==='customer'
              ? { 'New Logo': newLogo+crossSell, 'Upsell': upsell,
                  'Downsell': downsell+churnPartial, 'Churn': churn,
                  'Returning': returning, 'Lapsed': lapsed }
              : { 'New Logo':newLogo, 'Cross-sell':crossSell, 'Returning':returning,
                  'Upsell':upsell, 'Downsell':downsell, 'Churn-Partial':churnPartial,
                  'Churn':churn, 'Lapsed':lapsed }

            periodMap.set(period, { _period:period, 'Beginning ARR':beg, 'Ending ARR':end, ...movements })
          })

          const result = Array.from(periodMap.values())
          if (result.length >= 2) {
            console.log('[RL] ebp source4B result:', result.length, 'periods')
            return result
          }
        }
      }
    }

    return []
  }, [results, selLb, rawFileRows, fieldMap])
  // ── Monthly trend data — fill gaps so trend is always continuous ──────────
  const kpiRows = useMemo(() => {
    const raw = results?.kpi_matrix || []
    if (raw.length < 2) return raw

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const parseP = (s) => {
      const [mon,yr] = (s||'').split('-')
      const mi = MONTHS.indexOf(mon)
      if (mi<0) return null
      const y = parseInt(yr,10); if(isNaN(y)||y<=0) return null
      return {yr:y<50?2000+y:1900+y, mi}
    }
    const fmtP = ({yr,mi}) => `${MONTHS[mi]}-${String(yr).slice(-2)}`
    const toKey = ({yr,mi}) => yr*100+mi
    const advance = ({yr,mi}) => mi===11?{yr:yr+1,mi:0}:{yr,mi:mi+1}

    // Map existing data by period key
    const byKey = {}
    raw.forEach(r => {
      const p = parseP(r.period)
      if (p) byKey[toKey(p)] = r
    })

    // Find min and max
    const parsed = raw.map(r=>parseP(r.period)).filter(Boolean)
    if (!parsed.length) return raw
    const minKey = Math.min(...parsed.map(toKey))
    const maxKey = Math.max(...parsed.map(toKey))

    // Generate full contiguous range
    const result = []
    let cur = parsed.find(p=>toKey(p)===minKey)
    while (toKey(cur) <= maxKey) {
      const key = toKey(cur)
      const label = fmtP(cur)
      if (byKey[key]) {
        result.push(byKey[key])
      } else {
        // Fill gap with null values so connectNulls works properly
        result.push({period: label, beginning:null, ending:null, nrr:null, grr:null, new_logo:null, upsell:null, downsell:null, churn:null})
      }
      cur = advance(cur)
    }
    return result
  }, [results])
  const movers   = results?.top_movers || {}
  const topCusts = results?.top_customers || []

  // ── Mover data helpers ────────────────────────────────────────────
  // API returns: { 'Customer Name': 'Acme', 'Period': '2025', 'Churn Value': -123 }
  // We need to find the right keys dynamically
  function getMoverCustomer(row) {
    if (!row) return '?'
    // Try common key names first
    if (row.customer) return row.customer
    if (row.Customer) return row.Customer
    // Use fieldMap.customer column name
    const custKey = fieldMap.customer
    if (custKey && row[custKey] != null) return String(row[custKey])
    // Fallback: first non-period, non-value string key
    const key = Object.keys(row).find(k =>
      k !== 'Period' && !k.includes('Value') && !k.includes('period') &&
      typeof row[k] === 'string'
    )
    return key ? String(row[key]) : '?'
  }

  function getMoverValue(row, cat) {
    if (!row) return 0
    if (row.value != null) return row.value
    // Try '{cat} Value' key
    if (row[`${cat} Value`] != null) return row[`${cat} Value`]
    // Try 'Bridge Value' or 'Bridge_Value'
    if (row['Bridge_Value'] != null) return row['Bridge_Value']
    if (row['Bridge Value'] != null) return row['Bridge Value']
    // Find any numeric value key
    const key = Object.keys(row).find(k => k.includes('Value') && typeof row[k] === 'number')
    return key ? row[key] : 0
  }

  function getMoverPeriod(row) {
    if (!row || typeof row !== 'object') return ''
    if (row.Period || row.period) return row.Period || row.period
    const key = Object.keys(row).find(k =>
      /^period$/i.test(k) || /^date$/i.test(k) || /month/i.test(k) || /activity.date/i.test(k)
    )
    return key ? row[key] : ''
  }

  function filterRowsBySelectedPeriod(rows) {
    if (!Array.isArray(rows) || !rows.length || !selPeriod) return rows || []
    const withPeriod = rows.filter(r => normalizePeriod(getMoverPeriod(r)))
    if (!withPeriod.length) return rows
    return rows.filter(r => normalizePeriod(getMoverPeriod(r)) === normalizePeriod(selPeriod))
  }

  const moversForPeriod = useMemo(() => {
    if (!movers || typeof movers !== 'object') return {}
    const out = {}
    Object.entries(movers).forEach(([cat, rows]) => {
      out[cat] = filterRowsBySelectedPeriod(rows || [])
    })
    return out
  }, [movers, selPeriod])

  const topCustsForPeriod = useMemo(() => {
    return filterRowsBySelectedPeriod(topCusts || [])
  }, [topCusts, selPeriod])

  // ── Available periods — actual data months only, chronological, no synthetic fill
  // Reads _period strings from ALL lookback buckets, validates format, sorts chronologically.
  // Format enforced: 'Mon-YY' e.g. 'Jan-22', 'Dec-25'. Invalid entries are discarded.
  const availablePeriods = useMemo(() => {
    if (!results) return []

    // Use normalizePeriod (module-level, handles ALL formats) for both parsing and display
    // Sort key: extract year*100+month from a normalized Mon-YYYY string
    const sortKey = (normalized) => {
      const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      const m = normalized.match(/^([A-Za-z]{3})-(\d{4})$/)
      if (!m) return 0
      return parseInt(m[2]) * 100 + MONTHS.indexOf(m[1])
    }

    const seen = new Map() // normalized Mon-YYYY → sort key

    const add = (s) => {
      if (!s || typeof s !== 'string' || !s.trim()) return
      const normalized = normalizePeriod(s.trim())
      // Only add if it resolved to Mon-YYYY format (meaning it was a real date)
      if (!normalized || !normalized.match(/^[A-Za-z]{3}-\d{4}$/)) return
      if (!seen.has(normalized)) seen.set(normalized, sortKey(normalized))
    }

    // Source 1: effectiveByPeriod _period keys (already normalized)
    ;(effectiveByPeriod || []).forEach(r => add(r?._period))

    // Source 2: kpi_matrix period field
    ;(results.kpi_matrix || []).forEach(r => add(r?.period))

    // Source 3: by_period from every lookback bucket
    if (results.bridge) {
      Object.values(results.bridge).forEach(b => {
        ;(b?.by_period || []).forEach(r => add(r?._period))
      })
    }

    // Source 4: output rows date column — handles MM/DD/YYYY and any format
    if (results.output?.length > 0) {
      const cols = Object.keys(results.output[0])
      const dateKey = cols.find(k => /^date$/i.test(k)) ||
                      cols.find(k => /activity.date/i.test(k)) ||
                      cols.find(k => /^dt$/i.test(k))
      // Note: deliberately NOT matching 'month' or 'period' to avoid picking lookback columns
      if (dateKey) {
        // Only sample unique values for performance
        const uniq = [...new Set(results.output.map(r => r?.[dateKey]).filter(Boolean))]
        uniq.forEach(v => add(String(v)))
      }
    }

    if (seen.size === 0) return []

    return Array.from(seen.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([display]) => display)
  }, [results, effectiveByPeriod])

  // Filtered by_period data based on selPeriod
  const filteredByPeriod = useMemo(() => {
    if (!effectiveByPeriod?.length) return []
    if (!selPeriod) return effectiveByPeriod
    return effectiveByPeriod.filter(r => normalizePeriod(r._period) === normalizePeriod(selPeriod))
  }, [bdg, selPeriod])

  // kpiRowsWindowed — trend charts show last selLb months ending at selPeriod
  // This ensures Lookback control drives trend chart window too
  const kpiRowsWindowed = useMemo(() => {
    if (!kpiRows.length) return kpiRows
    if (!selPeriod && !selLb) return kpiRows

    // Find anchor index (selPeriod position in kpiRows)
    const anchorIdx = selPeriod
      ? kpiRows.findIndex(r => normalizePeriod(r.period) === normalizePeriod(selPeriod))
      : kpiRows.length - 1
    const anchor = anchorIdx >= 0 ? anchorIdx : kpiRows.length - 1

    // Show selLb months ending at anchor
    const start = Math.max(0, anchor - selLb + 1)
    return kpiRows.slice(start, anchor + 1)
  }, [kpiRows, selPeriod, selLb])

  // ── Movement classification rules by granularity (PE-grade analytical logic)
  //
  // CUSTOMER LEVEL: aggregate view — no product context available
  //   Allowed: New Logo, Expansion (Upsell), Contraction (Downsell), Churn
  //   Excluded: Cross-sell (needs product dimension), Churn Partial (roll into Churn),
  //             Returning (roll into New Logo), Other In/Out (noise at customer level)
  //
  // CUSTOMER × PRODUCT (or deeper): full movement visibility
  //   Allowed: New Logo, Upsell, Cross-sell, Downsell, Churn Partial, Churn, Other In, Other Out
  //
  // CUSTOMER × REGION: intermediate view
  //   Excluded: Cross-sell (still needs product), Churn Partial → Churn
  //
  // Price/Volume: NEVER shown in bridge — belongs in diagnostics/pricing tab only

  const PRICE_VOLUME_CATS = new Set(['Price Impact','Volume Impact','Price on Volume','Price','Volume'])

  const CUSTOMER_LEVEL_CATS = new Set([
    // Customer level: aggregate view — Cross-sell/Churn-Partial/Other-In/Out not visible
    'New Logo', 'Returning', 'Upsell', 'Downsell', 'Churn', 'Lapsed'
  ])
  const PRODUCT_LEVEL_CATS = new Set([
    // Customer × Product level: Cross-sell and Churn-Partial visible, but not Other In/Out
    'New Logo', 'Cross-sell', 'Cross_sell', 'Returning', 'Upsell',
    'Downsell', 'Churn Partial', 'Churn-Partial', 'Churn_Partial', 'Churn', 'Lapsed',
    'Add on', 'Add-on'
  ])
  const REGION_LEVEL_CATS = new Set([
    'New Logo', 'Upsell', 'Downsell', 'Churn', 'Other In', 'Other Out'
  ])
  const ATOMIC_LEVEL_CATS = new Set([
    // Atomic level: all movements including Other In/Out (channel/region shifts)
    'New Logo', 'Cross-sell', 'Cross_sell', 'Returning', 'Upsell',
    'Downsell', 'Churn Partial', 'Churn-Partial', 'Churn_Partial', 'Churn', 'Lapsed',
    'Other In', 'Other Out', 'Add on', 'Add-on'
  ])

  // Canonical display order for waterfall — always enforced regardless of API order
  // Canonical waterfall order — matches spec for all aggregation levels
  // Customer: Beginning → New Logo → Returning → Upsell → Downsell → Churn → Lapsed → Ending
  // Cust×Prod: adds Cross-sell (after New Logo) and Churn-Partial (before Churn)
  // Atomic: adds Other In (positive) and Other Out (negative)
  const CANONICAL_ORDER = [
    'Beginning ARR', 'Beginning MRR',
    'Churn', 'Churn-Partial', 'Churn_Partial', 'Churn Partial',
    'Downsell',
    'Upsell',
    'Cross-sell', 'Cross_sell',
    'New Logo',
    'Lapsed',
    'Returning',
    'Other In',
    'Other Out',
    'Add on', 'Add-on',
    'Ending ARR', 'Ending MRR'
  ]

  function filterByDimension(wfallData) {
    if (!wfallData?.length) return []
    // Always strip price/volume — they never belong in the bridge
    const noPV = wfallData.filter(r => !PRICE_VOLUME_CATS.has(r.category))
    // Level-aware movement selection — matches aggregation level exactly
    if (selDims === 'customer') {
      return noPV.filter(r => CUSTOMER_LEVEL_CATS.has(r.category))
    }
    if (selDims === 'region') {
      // Atomic level: Customer × Product × Channel × Region — all movements
      return noPV.filter(r => ATOMIC_LEVEL_CATS.has(r.category))
    }
    // Customer × Product: Cross-sell and Churn-Partial visible
    return noPV.filter(r => PRODUCT_LEVEL_CATS.has(r.category))
  }

  function applyCanonicalOrder(items) {
    return [...items].sort((a, b) => {
      const ia = CANONICAL_ORDER.indexOf(a.category)
      const ib = CANONICAL_ORDER.indexOf(b.category)
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib)
    })
  }

  // ── Bridge reconciliation validator ──────────────────────────────────
  function validateBridge(wfallData, beg, end) {
    const BOUNDARY = new Set(['Beginning ARR','Ending ARR','Beginning MRR','Ending MRR'])
    const movements = (wfallData||[]).filter(r => !BOUNDARY.has(r.category))
    const total    = movements.reduce((s,r) => s + (r.value||0), 0)
    const expected = (end||0) - (beg||0)
    const diff     = Math.abs(total - expected)
    const tol      = Math.max(Math.abs(expected) * 0.005, 1)
    return { valid: diff <= tol, diff, total, expected }
  }

  // ── Waterfall with period + dimension filter + canonical ordering applied ──
  const selectedWfall = useMemo(() => {
    let base = wfall
    if (selPeriod && effectiveByPeriod?.length) {
      const row = effectiveByPeriod.find(r => normalizePeriod(r._period) === normalizePeriod(selPeriod))
      if (row) {
        const BOUNDARY_KEYS = new Set(['_period','Beginning ARR','Ending ARR','Beginning MRR','Ending MRR'])
        base = Object.keys(row)
          .filter(k => !BOUNDARY_KEYS.has(k))
          .map(k => ({
            // Normalize underscore category names e.g. Churn_Partial → Churn-Partial, Cross_sell → Cross-sell
            category: k.replace(/_/g, '-').replace('Churn-Partial','Churn-Partial').replace('Cross-sell','Cross-sell'),
            value: row[k] || 0
          }))
          .filter(r => r.value !== 0)
      }
    }
    const filtered = filterByDimension(base)
    return applyCanonicalOrder(filtered)
  }, [selPeriod, bdg, wfall, selDims, effectiveByPeriod])

  // ── Period-specific KPI values — respect selected granularity + period ──
  const retForPeriod = useMemo(() => {
    console.log('[RL] retForPeriod: selPeriod=', selPeriod, 'effectiveByPeriod.length=', effectiveByPeriod?.length, 'sample _periods=', effectiveByPeriod?.slice(0,3).map(r=>r._period))
    if (!selPeriod || !effectiveByPeriod?.length) { console.log('[RL] retForPeriod: early return - no selPeriod or empty effectiveByPeriod'); return ret }
    const row = effectiveByPeriod.find(r => normalizePeriod(r._period) === normalizePeriod(selPeriod))
    console.log('[RL] retForPeriod: row found=', !!row, row ? 'BegARR='+row['Beginning ARR'] : 'NO MATCH')
    if (!row) return ret

    const BOUNDARY_KEYS = new Set(['_period','Beginning ARR','Ending ARR','Beginning MRR','Ending MRR','beginning','ending'])

    // Read Beginning/Ending ARR directly from the row (most accurate)
    const rowBeg = row['Beginning ARR'] ?? row['Beginning MRR'] ?? row['beginning'] ?? ret?.beginning ?? 0
    const rowEnd = row['Ending ARR']   ?? row['Ending MRR']   ?? row['ending']   ?? null

    // Build movement items from row, apply same dimension filter as selectedWfall
    const rowItems = Object.keys(row)
      .filter(k => !BOUNDARY_KEYS.has(k))
      .map(k => ({ category: k, value: row[k] || 0 }))
    const filtered = filterByDimension(rowItems)

    const newArr  = filtered.filter(r => r.value > 0).reduce((s,r) => s + r.value, 0)
    const lostArr = filtered.filter(r => r.value < 0).reduce((s,r) => s + r.value, 0)

    const beg = rowBeg
    const end = rowEnd !== null ? rowEnd : beg + newArr + lostArr

    return {
      beginning: beg,
      ending:    end,
      new_arr:   newArr,
      lost_arr:  lostArr,
      // Use pre-computed nrr/grr from kpi_matrix if available (more accurate)
      nrr:       row._nrr ?? (beg > 0 ? (end / beg) * 100 : ret?.nrr),
      grr:       row._grr ?? (beg > 0 ? ((beg + lostArr) / beg) * 100 : ret?.grr),
    }
  }, [selPeriod, bdg, ret, selDims, effectiveByPeriod])

  // ── Bridge reconciliation status ──────────────────────────────────────
  const bridgeOk = useMemo(() => {
    const r = retForPeriod || ret
    if (!r?.beginning && !r?.ending) return null
    return validateBridge(selectedWfall, r?.beginning, r?.ending)
  }, [selectedWfall, retForPeriod, ret])

  // ── Customer ARR map: name → {endingArr, beginningArr} from top_customers ──
  const customerArrMap = useMemo(() => {
    const map = {}
    if (!topCusts?.length) return map
    topCusts.forEach(row => {
      const custKey = Object.keys(row).find(k => /customer|account|name/i.test(k))
      const endKey  = Object.keys(row).find(k => /ending|end_arr/i.test(k))
      const begKey  = Object.keys(row).find(k => /beginning|beg_arr/i.test(k))
      if (custKey && endKey) {
        map[String(row[custKey])] = {
          endingArr:    row[endKey]  ?? null,
          beginningArr: begKey ? (row[begKey] ?? null) : null,
        }
      }
    })
    return map
  }, [topCusts])

  // Auto-select latest period whenever results change or periods populate
  useEffect(() => {
    if (availablePeriods.length > 0) {
      const latest = availablePeriods[availablePeriods.length - 1]
      // Set to latest if nothing selected, or if current selection not in list
      if (!selPeriod || !availablePeriods.includes(selPeriod)) {
        setSelPeriod(latest)
      }
    }
  }, [availablePeriods])

  const narrative = useMemo(() => genNarrative(retForPeriod||ret, movers), [retForPeriod, ret, movers])

  // Expansion / churn lists for Top Movers tab
  // ── Top Movers — aggregate all categories, sort by ARR impact (highest first)
  const expansionList = useMemo(() => {
    const posCats = ['New Logo','Upsell','Cross-sell','Returning','Other In']
    const all = []
    for (const cat of posCats) {
      if (moversForPeriod[cat]?.length) moversForPeriod[cat].forEach(r => all.push({...r, _cat:cat}))
    }
    return all.sort((a,b) => Math.abs(b.value||0) - Math.abs(a.value||0)).slice(0, 25)
  }, [moversForPeriod])

  const churnList = useMemo(() => {
    const negCats = ['Churn','Churn-Partial','Churn Partial','Lapsed','Downsell','Other Out']
    const all = []
    for (const cat of negCats) {
      if (moversForPeriod[cat]?.length) moversForPeriod[cat].forEach(r => all.push({...r, _cat:cat}))
    }
    return all.sort((a,b) => Math.abs(b.value||0) - Math.abs(a.value||0)).slice(0, 25)
  }, [moversForPeriod])

  useEffect(() => {
    supabase.auth.getSession().then(({data:{session}}) => {
      if (!session) { router.push('/auth/login'); return }
      supabase.from('profiles').select('*').eq('id',session.user.id).single().then(({data})=>{ if(data) setProfile(data) })
    })
    fetch(`${API}/health`).catch(()=>{})
  }, [router])

  useEffect(() => {
    if (!engine||!columns.length) return
    setFieldMap(buildAutoMap(engine,columns))
    setShowOpt(false); setValidated(false)
  }, [engine, columns])

  async function uploadFile(f) {
    setFile(f); setUploading(true); setUploadErr(''); setColumns([]); setEngine(null); setFieldMap({}); setResults(null); setIsBridgeOutput(false)
    try {
      const fd = new FormData(); fd.append('file',f)
      const {data} = await axios.post(`${API}/api/columns`,fd,{timeout:90000})
      setColumns(data.columns); setRowCount(data.row_count)
      setIsBridgeOutput(data.is_bridge_output||false)
      if (data.is_acv) setEngine('acv')
      else if (data.is_bridge_output) setEngine('mrr')
    } catch(e) {
      setUploadErr(e.code==='ECONNABORTED'?'Timed out — retry in 10s.':`Could not read file: ${e?.response?.data?.detail||e.message}`)
    }
    setUploading(false)
  }

  async function runAnalysis() {
    setValidated(true)
    if (!canRun) return
    setRunning(true); setRunErr('')
    try {
      const fd = new FormData(); fd.append('file',file)
      if (engine==='cohort') {
        fd.append('metric',       fieldMap.revenue||'')
        fd.append('customer_col', fieldMap.customer||'')
        fd.append('date_col',     fieldMap.date||'')
        fd.append('fiscal_col',   fieldMap.fiscal||'None')
        fd.append('cohort_types', JSON.stringify(cohortTypes))
        fd.append('period_filter', periodFilter)
        fd.append('selected_fiscal_year', selectedFY)
        fd.append('individual_cols', JSON.stringify(useSingle?individualCols.filter(c=>c&&c!=='None'):[]))
        fd.append('hierarchies',     JSON.stringify(useMulti?hierarchies.filter(h=>h.some(c=>c&&c!=='None')):[]))
        const {data} = await axios.post(`${API}/api/cohort/analyze`,fd,{timeout:120000})
        setResults({...data,_engine:'cohort'}); setActiveTab('heatmap')
      } else {
        const dims=['product','channel','region'].map(k=>fieldMap[k]).filter(Boolean)
        fd.append('revenue_unit',   revenueUnit)
        fd.append('revenue_type',  revenueType)
        fd.append('lookbacks',      JSON.stringify(lookbacks))
        fd.append('dimension_cols', JSON.stringify(dims))
        fd.append('year_filter',    yearFilter!=='All'?yearFilter:'')
        fd.append('period_type',    periodType)
        fd.append('n_movers',       '30')
        fd.append('n_customers',    '10')
        let endpoint=`${API}/api/bridge/analyze`
        if (isBridgeOutput) {
          fd.append('tool_type',    engine==='acv'?'ACV':'MRR')
          fd.append('customer_col', fieldMap.customer||'Customer_ID')
          fd.append('modules',      JSON.stringify(['bridge','top_movers','top_customers','kpi_matrix','output']))
        } else if (engine==='acv') {
          endpoint=`${API}/api/acv/analyze`
          fd.append('customer_col',   fieldMap.customer||'')
          fd.append('order_date_col', fieldMap.date||'')
          fd.append('start_col',      fieldMap.contractStart||'')
          fd.append('end_col',        fieldMap.contractEnd||'')
          fd.append('tcv_col',        fieldMap.tcv||'')
          if(fieldMap.product)  fd.append('product_col',  fieldMap.product)
          if(fieldMap.channel)  fd.append('channel_col',  fieldMap.channel)
          if(fieldMap.region)   fd.append('region_col',   fieldMap.region)
          if(fieldMap.quantity) fd.append('quantity_col', fieldMap.quantity)
        } else {
          endpoint=`${API}/api/mrr/analyze`
          fd.append('tool_type',    'MRR')
          fd.append('customer_col', fieldMap.customer||'')
          fd.append('date_col',     fieldMap.date||'')
          fd.append('revenue_col',  fieldMap.revenue||'')
          if(fieldMap.product)  fd.append('product_col',  fieldMap.product)
          if(fieldMap.channel)  fd.append('channel_col',  fieldMap.channel)
          if(fieldMap.region)   fd.append('region_col',   fieldMap.region)
          if(fieldMap.quantity) fd.append('quantity_col', fieldMap.quantity)
        }
        const {data}=await axios.post(endpoint,fd,{timeout:120000})
        setResults({...data,_engine:engine}); setActiveTab('summary')
        if (lookbacks.length) setSelLb(lookbacks[lookbacks.length-1])
        const allCats=Object.keys(data.top_movers||{})
        // Set initial category to first churn cat for churn panel
        const churnCat=allCats.find(c=>['Churn','Churn-Partial','Lapsed','Downsell'].includes(c))
        if(churnCat) setMoverCat(churnCat)
        else if(allCats.length) setMoverCat(allCats[0])
      }
    } catch(e) { setRunErr(e?.response?.data?.detail||'Analysis failed. Please try again.') }
    setRunning(false)
  }

  // Re-run with different dimension filter (View by: customer/product/region)
  async function applyDimFilter(dimKey) {
    if (!file || !results || running || rerunning) return
    setSelDims(dimKey)
    setRerunning(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      // Build dimension_cols based on selected dim
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
        fd.append('tool_type',    engine==='acv'?'ACV':'MRR')
        fd.append('customer_col', fieldMap.customer||'Customer_ID')
        fd.append('modules',      JSON.stringify(['bridge','top_movers','top_customers','kpi_matrix','output']))
      } else {
        fd.append('tool_type',    'MRR')
        fd.append('customer_col', fieldMap.customer||'')
        fd.append('date_col',     fieldMap.date||'')
        fd.append('revenue_col',  fieldMap.revenue||'')
        if(fieldMap.product)  fd.append('product_col',  fieldMap.product)
        if(fieldMap.channel)  fd.append('channel_col',  fieldMap.channel)
        if(fieldMap.region)   fd.append('region_col',   fieldMap.region)
        if(fieldMap.quantity) fd.append('quantity_col', fieldMap.quantity)
      }
      const {data} = await axios.post(endpoint, fd, {timeout:120000})
      setResults({...data, _engine:engine})
      if (lookbacks.length) setSelLb(lookbacks[lookbacks.length-1])
      const c2=Object.keys(data.top_movers||{});if(c2.length)setMoverCat(c2[0])
    } catch(e) { console.error('Re-run failed:', e) }
    setRerunning(false)
  }

  // Re-run when periodType (YoY/QoQ) changes
  async function applyPeriodType(newPeriodType) {
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
        fd.append('tool_type',    engine==='acv'?'ACV':'MRR')
        fd.append('customer_col', fieldMap.customer||'Customer_ID')
        fd.append('modules',      JSON.stringify(['bridge','top_movers','top_customers','kpi_matrix','output']))
      } else {
        fd.append('tool_type',    'MRR')
        fd.append('customer_col', fieldMap.customer||'')
        fd.append('date_col',     fieldMap.date||'')
        fd.append('revenue_col',  fieldMap.revenue||'')
        if(fieldMap.product)  fd.append('product_col',  fieldMap.product)
        if(fieldMap.channel)  fd.append('channel_col',  fieldMap.channel)
        if(fieldMap.region)   fd.append('region_col',   fieldMap.region)
        if(fieldMap.quantity) fd.append('quantity_col', fieldMap.quantity)
      }
      const {data} = await axios.post(endpoint, fd, {timeout:120000})
      setResults({...data, _engine:engine})
      if (lookbacks.length) setSelLb(lookbacks[lookbacks.length-1])
    } catch(e) { console.error('Period type re-run failed:', e) }
    setRerunning(false)
  }

  function downloadCSV() {
    const out=results?.output||[]; if(!out.length) return
    const keys=Object.keys(out[0])
    const csv=[keys.join(','),...out.map(r=>keys.map(k=>`"${r[k]??''}"`).join(','))].join('\n')
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
    a.download=`revenuelens_${engine}_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  }

  // ── Inline cohort analysis for Cohort Heatmap tab ────────────────────────
  async function runInlineCohort() {
    if (!file || cohortRunning) return
    setCohortRunning(true); setCohortErr('')
    try {
      const fd = new FormData(); fd.append('file', file)
      // Use the same customer/date/revenue fields already mapped
      fd.append('metric',       fieldMap.revenue||'')
      fd.append('customer_col', fieldMap.customer||'')
      fd.append('date_col',     fieldMap.date||'')
      fd.append('fiscal_col',   'None')
      fd.append('cohort_types', JSON.stringify(['SG']))
      fd.append('period_filter','all')
      fd.append('selected_fiscal_year', '')
      fd.append('individual_cols', JSON.stringify([]))
      fd.append('hierarchies',     JSON.stringify([]))
      const {data} = await axios.post(`${API}/api/cohort/analyze`, fd, {timeout:120000})
      setCohortResults(data)
    } catch(e) {
      setCohortErr(e?.response?.data?.detail||'Cohort analysis failed.')
    }
    setCohortRunning(false)
  }

  const TABS = isCohort ? [
    {id:'heatmap',label:'Retention'},{id:'revenue_heatmap',label:'Revenue'},
    {id:'segmentation',label:'Segments'},{id:'summary',label:'Summary'},{id:'output',label:'Output'},
  ] : [
    {id:'summary',label:'Summary'},
    {id:'retention_trend',label:'Detailed Bridge'},
    {id:'historical_perf',label:'Historical Performance'},
    {id:'cohort_heatmap',label:'Cohorts'},
    {id:'top_movers',label:'Top Movers'},
    {id:'top_customers',label:'Customers'},
    {id:'kpi_matrix',label:'KPI Matrix'},
    {id:'output',label:'Output'},
  ]

  // ── Style helpers ──────────────────────────────────────────────────────────
  // ── Design tokens — single source of truth ──────────────────────────────
  const T = {
    bgPage:    '#0B1220',
    bgSurface: '#0F1A2E',
    bgRaised:  '#162035',
    border:    '#1E2D45',
    border2:   '#253550',
    text:      '#E2E8F0',
    text2:     '#94A3B8',
    text3:     '#4A5A6E',
    pos:       '#4ADE80',
    neg:       '#F87171',
    warn:      '#FCD34D',
    neutral:   '#64748B',
    mono:      "'JetBrains Mono',monospace",
  }
  const S = {
    card:  { background:T.bgSurface, border:`1px solid ${T.border}`, borderRadius:6, padding:20 },
    cardF: { background:T.bgSurface, border:`1px solid ${T.border}`, borderRadius:6, padding:0, overflow:'hidden' },
    label: { fontSize:9, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.1em', color:T.text3 },
    th:    { fontSize:9, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:T.text3, padding:'9px 14px', background:T.bgRaised, borderBottom:`1px solid ${T.border}`, textAlign:'left', whiteSpace:'nowrap' as const },
    td:    { padding:'9px 14px', color:T.text2, fontSize:12, borderBottom:`1px solid ${T.border}` },
    mono:  { fontFamily:T.mono, fontFeatureSettings:"'tnum'" },
  }


  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:'#0B1220',fontFamily:"'Inter',system-ui,sans-serif",color:'#FFFFFF'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        :root {
          --bg:          #0B1220;
          --surface:     #0F1A2E;
          --raised:      #162035;
          --border:      #1E2D45;
          --border2:     #253550;
          --text:        #E2E8F0;
          --text-2:      #94A3B8;
          --text-3:      #64748B;
          --text-4:      #4A5A6E;
          --pos:         #4ADE80;
          --neg:         #F87171;
          --warn:        #FCD34D;
          --neutral:     #3D5068;
          --accent:      #CBD5E1;
          --font:        'Inter', system-ui, sans-serif;
          --mono:        'JetBrains Mono', monospace;
        }
        *{box-sizing:border-box}
        body{font-family:'Inter',system-ui,sans-serif;background:#0B1220;color:#FFFFFF;}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#253550;border-radius:4px}
        ::-webkit-scrollbar-thumb:hover{background:#3D5068}
        @keyframes spin{to{transform:rotate(360deg)}}
        .animate-spin{animation:spin 1s linear infinite}
      `}</style>

      {/* ══ LEFT SIDEBAR ══════════════════════════════════════════════════ */}
      <aside style={{width:256,display:'flex',flexDirection:'column',flexShrink:0,borderRight:'1px solid #1E2D45',background:'#0F1A2E',overflow:'hidden'}}>

        {/* Logo */}
        <div style={{height:56,display:'flex',alignItems:'center',gap:12,padding:'0 20px',borderBottom:'1px solid #1E2D45',flexShrink:0}}>
          <div style={{width:28,height:28,borderRadius:6,background:'#162035',border:'1px solid #253550',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <BarChart3 size={13} color="#94A3B8"/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:900,color:'#FFFFFF',letterSpacing:'-0.01em',lineHeight:1}}>RevenueLens</div>
            <div style={{fontSize:8,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.12em',color:'#4A5A6E',marginTop:2}}>Analytics</div>
          </div>
          <button onClick={()=>router.push('/dashboard')} style={{padding:6,borderRadius:8,background:'transparent',border:'none',cursor:'pointer',color:'#5A7294'}} onMouseEnter={e=>e.target.style.color='#4FDBC8'} onMouseLeave={e=>e.target.style.color='#5A7294'}>
            <Home size={12}/>
          </button>
        </div>

        {/* Progress steps */}
        <div style={{padding:'12px 16px',borderBottom:'1px solid #1E2D45',flexShrink:0}}>
          {[[1,'Upload Data',step1,!step1],[2,'Select Engine',step2,step1&&!step2],[3,'Map Fields',step3,step2&&!step3]].map(([n,lbl,done,active])=>(
            <div key={n} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 8px',borderRadius:10,background:active?'#162035':'transparent',marginBottom:2}}>
              <div style={{width:20,height:20,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:900,flexShrink:0,background:done?'#1A3A2A':active?'#162035':'#1E2D45',color:done?'#4ADE80':active?'#CBD5E1':'#4A5A6E'}}>{done?'✓':n}</div>
              <span style={{fontSize:11,fontWeight:600,color:active?'#CBD5E1':done?'#4A5A6E':'#4A5A6E'}}>{lbl}</span>
            </div>
          ))}
        </div>

        {/* Scrollable sidebar content */}
        <div style={{flex:1,overflowY:'auto'}}>

          {/* STEP 1: Upload */}
          <div style={{padding:16,borderBottom:'1px solid #1E2D45'}}>
            <div style={{...S.label}}>1. Upload Data</div>
            {uploadErr&&<div style={{marginTop:8,padding:10,borderRadius:10,border:'1px solid #9CA3AF',background:'rgba(220,38,38,0.06)',color:'#DC2626',fontSize:10,display:'flex',gap:8}}><AlertCircle size={11} style={{flexShrink:0,marginTop:1}}/>{uploadErr}</div>}
            <div onClick={()=>!uploading&&fileRef.current?.click()} style={{
              marginTop:10,borderRadius:12,border:`2px dashed ${file&&columns.length?'rgba(74,222,128,0.35)':uploading?'rgba(74,222,128,0.2)':'#253550'}`,
              padding:16,textAlign:'center',cursor:'pointer',
              background:file&&columns.length?'rgba(74,222,128,0.04)':uploading?'rgba(74,222,128,0.03)':'rgba(22,32,53,0.8)',
            }}>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)uploadFile(f)}}/>
              {uploading?(<div><Loader2 size={18} color="#94A3B8" style={{margin:'0 auto 4px',animation:'spin 1s linear infinite'}}/><div style={{fontSize:11,color:'#94A3B8',fontWeight:500}}>Reading file…</div></div>)
              :file&&columns.length?(<div><CheckCircle size={18} color="#4ADE80" style={{margin:'0 auto 4px'}}/><div style={{fontSize:11,fontWeight:700,color:'#FFFFFF',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{file.name}</div><div style={{fontSize:10,color:'#7B8EA8'}}>{rowCount.toLocaleString()} rows · {columns.length} cols</div><button onClick={e=>{e.stopPropagation();fileRef.current?.click()}} style={{fontSize:9,color:'#4ADE80',background:'none',border:'none',cursor:'pointer',fontWeight:500,marginTop:4}}>Change file</button></div>)
              :(<div><Upload size={18} color="#5A7294" style={{margin:'0 auto 6px'}}/><div style={{fontSize:11,color:'#7B8EA8',fontWeight:600}}>Click or drag file</div><div style={{fontSize:10,color:'#5A7294',marginTop:2}}>CSV or Excel</div></div>)}
            </div>
            <UploadTimer active={uploading}/>
          </div>

          {/* STEP 2: Engine */}
          {step1&&(
            <div style={{padding:16,borderBottom:'1px solid #1E2D45'}}>
              <div style={{...S.label}}>2. Select Engine</div>
              <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:6}}>
                {Object.entries(ENGINE_CONFIG).map(([id,ec])=>{
                  const Icon=ec.icon; const active=engine===id
                  return (
                    <button key={id} onClick={()=>setEngine(id)} style={{
                      display:'flex',alignItems:'center',gap:12,padding:12,borderRadius:10,
                      border:`1px solid ${active?'rgba(79,219,200,0.5)':'#253550'}`,
                      background:active?'rgba(79,219,200,0.1)':'#162035',
                      cursor:'pointer',textAlign:'left',width:'100%',transition:'all 0.15s',
                    }}>
                      <div style={{width:28,height:28,borderRadius:8,background:active?'rgba(79,219,200,0.2)':'#1E2D45',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <Icon size={12} color={active?'#4FDBC8':'#7B8EA8'}/>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,fontWeight:700,color:active?'#4ADE80':'#E2E8F0',lineHeight:1.2}}>{ec.label}</div>
                        <div style={{fontSize:9,color:'#5A7294',marginTop:2}}>{ec.desc}</div>
                      </div>
                      {active&&<CheckCircle size={12} color="#4ADE80"/>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Map Fields */}
          {step2&&cfg&&(
            <div style={{padding:16,borderBottom:'1px solid #1E2D45'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <div style={{...S.label}}>3. Map Fields</div>
                <span style={{fontSize:9,fontWeight:700,color:Object.keys(errors).length===0?'#4FDBC8':'#7B8EA8'}}>
                  {cfg.required.filter(f=>!!fieldMap[f.key]).length}/{cfg.required.length} mapped
                </span>
              </div>
              <div style={{borderRadius:10,border:'1px solid #1E2D45',overflow:'hidden',marginBottom:8,background:'#0F1A2E'}}>
                <div style={{padding:'6px 12px',borderBottom:'1px solid #1E2D45',fontSize:8,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em',color:'#7B8EA8'}}>Required</div>
                {cfg.required.map(f=><FieldRow key={f.key} label={f.label} required value={fieldMap[f.key]||''} columns={columns} onChange={v=>setFieldMap(m=>({...m,[f.key]:v}))} showError={validated}/>)}
              </div>
              <div style={{borderRadius:10,border:'1px solid #1E2D45',overflow:'hidden',background:'#0F1A2E'}}>
                <button onClick={()=>setShowOpt(v=>!v)} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 12px',background:'transparent',border:'none',cursor:'pointer'}}>
                  <span style={{fontSize:8,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em',color:'#7B8EA8'}}>Optional Fields</span>
                  {showOpt?<ChevronUp size={10} color="#4A5A7A"/>:<ChevronDown size={10} color="#4A5A7A"/>}
                </button>
                {showOpt&&cfg.optional.map(f=><FieldRow key={f.key} label={f.label} value={fieldMap[f.key]||''} columns={columns} onChange={v=>setFieldMap(m=>({...m,[f.key]:v}))} showError={false}/>)}
              </div>
              {validated&&Object.keys(errors).length>0&&(
                <div style={{marginTop:8,padding:10,borderRadius:10,border:'1px solid rgba(255,71,87,0.2)',background:'rgba(255,71,87,0.05)'}}>
                  <div style={{fontSize:10,fontWeight:700,color:'#DC2626',marginBottom:4}}>Map required fields:</div>
                  {cfg.required.filter(f=>errors[f.key]).map(f=><div key={f.key} style={{fontSize:9,color:'#DC2626'}}>· {f.label}</div>)}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Run button */}
        <div style={{padding:16,borderTop:'1px solid #1E2D45',flexShrink:0}}>
          {runErr&&<div style={{marginBottom:10,padding:10,borderRadius:10,border:'1px solid #9CA3AF',background:'rgba(220,38,38,0.06)',color:'#DC2626',fontSize:10,display:'flex',gap:6}}><AlertCircle size={10} style={{flexShrink:0}}/>{runErr}</div>}
          <button onClick={runAnalysis} disabled={!step1||!step2||running} style={{
            width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8,
            fontWeight:700,fontSize:13,padding:'12px 0',borderRadius:14,border:'none',cursor:canRun?'pointer':'not-allowed',
            background:canRun?'#1A3A2A':'#162035',
            color:canRun?'#4ADE80':'#4A5A6E',transition:'opacity 0.15s',
          }}>
            {running?<Loader2 size={14} color={canRun?'#4ADE80':'#4A5A6E'} style={{animation:'spin 1s linear infinite'}}/>:<Zap size={14}/>}
            {running?'Analyzing…':'Run Analysis'}
          </button>
          {running&&<UploadTimer active={running}/>}
          {results&&!running&&(
            isAdmin?(
              <button onClick={downloadCSV} style={{width:'100%',marginTop:8,display:'flex',alignItems:'center',justifyContent:'center',gap:8,border:'1px solid #253550',color:'#7B8EA8',fontWeight:600,fontSize:11,padding:'8px 0',borderRadius:12,background:'transparent',cursor:'pointer'}}>
                <Download size={11}/> Export CSV
              </button>
            ):(
              <button onClick={()=>router.push('/dashboard/upgrade')} style={{width:'100%',marginTop:8,display:'flex',alignItems:'center',justifyContent:'center',gap:8,border:'1px solid #253550',color:'#7B8EA8',fontWeight:600,fontSize:11,padding:'8px 0',borderRadius:12,background:'transparent',cursor:'pointer'}}>
                <Lock size={11}/> Export <span style={{marginLeft:'auto',fontSize:9,background:'rgba(244,162,97,0.1)',color:'#7B8EA8',border:'1px solid rgba(244,162,97,0.2)',padding:'2px 6px',borderRadius:10,fontWeight:700}}>PRO</span>
              </button>
            )
          )}
          {!results&&!running&&<button disabled style={{width:'100%',marginTop:8,display:'flex',alignItems:'center',justifyContent:'center',gap:8,border:'1px solid #253550',color:'#5A7294',fontWeight:600,fontSize:11,padding:'8px 0',borderRadius:12,background:'transparent',cursor:'not-allowed'}}>
            <Lock size={11}/> Export <span style={{marginLeft:'auto',fontSize:9,background:'#253550',color:'#7B8EA8',padding:'2px 6px',borderRadius:10,fontWeight:700}}>PRO</span>
          </button>}
        </div>
      </aside>

      {/* ══ RIGHT PANEL ═══════════════════════════════════════════════════ */}
      <main style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column',background:'#0B1220'}}>

        {/* ── PAGE HEADER ───────────────────────────────────────────── */}
        <header style={{flexShrink:0,borderBottom:'1px solid #1E2D45',background:'#0F1A2E'}}>

          {/* Row 1: Title + all controls in ONE line */}
          <div style={{display:'flex',alignItems:'center',padding:'0 28px',height:52,gap:16}}>

            {/* Title */}
            <div style={{fontSize:15,fontWeight:700,color:'#E2E8F0',letterSpacing:'-0.01em',flexShrink:0}}>
              Customer Analytics
            </div>

            <div style={{flex:1}}/>

            {/* ── GLOBAL FILTER BAR — always visible across all tabs ─── */}
            {results&&(
              <div style={{display:'flex',alignItems:'center',gap:6}}>

                {/* Lookback pills: MoM 1M | QoQ 3M | YoY 12M — single unified control */}
                {!isCohort&&(
                  <div style={{display:'flex',alignItems:'center',background:'#0B1220',borderRadius:5,border:'1px solid #1E2D45',overflow:'hidden',height:30}}>
                    {[
                      {lb:1,  label:'MoM 1M',  pt:'Month'},
                      {lb:3,  label:'QoQ 3M',  pt:'Quarter'},
                      {lb:12, label:'YoY 12M', pt:'Annual'},
                    ].map(opt=>(
                      <button key={opt.lb}
                        onClick={()=>{setSelLb(opt.lb); if(opt.pt!==periodType) applyPeriodType(opt.pt)}}
                        disabled={rerunning}
                        style={{padding:'0 12px',height:30,fontSize:11,fontWeight:selLb===opt.lb?600:400,border:'none',borderBottom:`2px solid ${selLb===opt.lb?'#CBD5E1':'transparent'}`,cursor:rerunning?'not-allowed':'pointer',background:selLb===opt.lb?'#162035':'transparent',color:selLb===opt.lb?'#CBD5E1':'#4A5A6E',transition:'all 0.12s',opacity:rerunning?0.6:1,whiteSpace:'nowrap'}}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {!isCohort&&<div style={{width:1,height:18,background:'#1E2D45'}}/>}

                {/* Period dropdown — all real data months, latest selected by default */}
                {!isCohort&&(
                  <div style={{display:'flex',alignItems:'center',gap:6,height:30}}>
                    <span style={{fontSize:11,fontWeight:500,color:'#4A5A6E',whiteSpace:'nowrap'}}>Period</span>
                    <select
                      value={selPeriod}
                      onChange={e=>setSelPeriod(e.target.value)}
                      disabled={availablePeriods.length===0}
                      style={{height:30,fontSize:11,fontWeight:500,border:'1px solid #253550',borderRadius:5,padding:'0 28px 0 10px',background:'#162035',color:availablePeriods.length>0?'#CBD5E1':'#3D5068',outline:'none',cursor:availablePeriods.length>0?'pointer':'default',fontFamily:"'Inter',system-ui,sans-serif",appearance:'none',backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%234A5A6E' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,backgroundRepeat:'no-repeat',backgroundPosition:'right 8px center',minWidth:100}}>
                      {availablePeriods.length===0
                        ? <option value="">— run analysis —</option>
                        : availablePeriods.map(p=><option key={p} value={p}>{p}</option>)
                      }
                    </select>
                  </div>
                )}

                {!isCohort&&<div style={{width:1,height:18,background:'#1E2D45'}}/>}

                {/* Dimension — customer / product / region */}
                {!isCohort&&(
                  <div style={{display:'flex',alignItems:'center',background:'#0B1220',borderRadius:5,border:'1px solid #1E2D45',overflow:'hidden',height:30}}>
                    {[
                      {key:'customer',label:'Customer'},
                      {key:'product', label:'× Product',available:!!fieldMap.product},
                      {key:'region',  label:'× Region', available:!!fieldMap.region},
                    ].map(opt=>(
                      <button key={opt.key}
                        onClick={()=>opt.available!==false&&!rerunning&&applyDimFilter(opt.key)}
                        disabled={opt.available===false||rerunning}
                        style={{padding:'0 10px',height:30,fontSize:11,fontWeight:selDims===opt.key?500:400,border:'none',cursor:(opt.available===false||rerunning)?'not-allowed':'pointer',background:selDims===opt.key?'#162035':'transparent',color:selDims===opt.key?'#CBD5E1':opt.available===false?'#2A3040':'#4A5A6E',transition:'all 0.12s'}}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Rerunning indicator */}
                {rerunning&&(
                  <div style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'#4A5A6E'}}>
                    <Loader2 size={11} style={{animation:'spin 1s linear infinite'}}/> Updating…
                  </div>
                )}

                {/* Reset */}
                <button onClick={()=>{setResults(null);setFile(null);setColumns([]);setEngine(null);setFieldMap({});setSelDims('customer');setSelPeriod('');setCohortResults(null);setRawFileRows([])}}
                  style={{height:30,width:30,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:5,border:'1px solid #1E2D45',background:'transparent',cursor:'pointer',color:'#4A5A6E'}}
                  onMouseEnter={e=>{e.currentTarget.style.color='#CBD5E1';e.currentTarget.style.borderColor='#253550'}}
                  onMouseLeave={e=>{e.currentTarget.style.color='#4A5A6E';e.currentTarget.style.borderColor='#1E2D45'}}>
                  <RefreshCw size={12}/>
                </button>

                {/* Export */}
                {isAdmin?(
                  <button onClick={downloadCSV} style={{height:30,display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:600,padding:'0 12px',borderRadius:5,border:'1px solid #2D5A3D',cursor:'pointer',background:'#1A3A2A',color:'#4ADE80'}}>
                    <Download size={11}/> Export
                  </button>
                ):(
                  <button onClick={()=>router.push('/dashboard/upgrade')} style={{height:30,display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:500,color:'#4A5A6E',border:'1px solid #1E2D45',padding:'0 12px',borderRadius:5,background:'transparent',cursor:'pointer'}}>
                    <Lock size={11}/> Upgrade
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Row 2: Tab navigation — at top level */}
          {results&&(
            <div style={{display:'flex',borderTop:'1px solid #1E2D45',paddingLeft:28,background:'#0F1A2E',overflowX:'auto'}}>
              {TABS.map(tab=>(
                <button key={tab.id} onClick={()=>{
                  setActiveTab(tab.id)
                  if(tab.id==='cohort_heatmap'&&!cohortResults&&!cohortRunning&&file&&fieldMap.customer&&fieldMap.date&&fieldMap.revenue) {
                    runInlineCohort()
                  }
                }} style={{
                  padding:'0 16px',height:40,fontSize:12,fontWeight:activeTab===tab.id?500:400,
                  border:'none',borderBottom:`2px solid ${activeTab===tab.id?'#4A5A6E':'transparent'}`,
                  background:'transparent',cursor:'pointer',
                  color:activeTab===tab.id?'#CBD5E1':'#4A5A6E',
                  transition:'color 0.12s',whiteSpace:'nowrap',
                }}>{tab.label}</button>
              ))}
            </div>
          )}
        </header>

        {/* ── EMPTY STATE ─────────────────────────────────────────────── */}
        {!results&&(
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:32}}>
            <div style={{textAlign:'center',maxWidth:480}}>
              <div style={{width:80,height:80,borderRadius:24,border:'1px solid #1E2D45',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 24px'}}><BarChart3 size={28} color="#4A5A6E" style={{opacity:1}}/></div>
              <h2 style={{fontSize:24,fontWeight:900,color:'#FFFFFF',margin:'0 0 8px',letterSpacing:'-0.02em'}}>{engine?ENGINE_CONFIG[engine].label:'Revenue Analytics'}</h2>
              <p style={{color:'#7B8EA8',fontSize:14,marginBottom:32,lineHeight:1.6}}>
                {engine==='cohort'?'Upload data, map fields, then run to see retention heatmaps.'
                :engine?'Upload data, map fields, and run the analysis.'
                :'Upload subscription data, select an engine, and get instant insights.'}
              </p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                {(engine==='cohort'?[
                  {icon:Layers,     label:'Retention Heatmap',desc:'% retention by cohort'},
                  {icon:DollarSign, label:'Revenue Heatmap',  desc:'Revenue by cohort period'},
                  {icon:Users,      label:'Segmentation',     desc:'Size / Percentile / Revenue'},
                ]:[
                  {icon:TrendingUp, label:'Revenue Bridge',   desc:'Waterfall with all drivers'},
                  {icon:Target,     label:'Top Movers',       desc:'Expansion & churn accounts'},
                  {icon:Activity,   label:'Retention Trends', desc:'NRR, GRR over time'},
                ]).map((m,i)=>(
                  <div key={i} style={{padding:16,borderRadius:14,border:'1px solid #1E2D45',background:'#0F1A2E',textAlign:'left'}}>
                    <m.icon size={15} color="#4A5A6E" style={{opacity:1,marginBottom:8}}/>
                    <div style={{fontSize:12,fontWeight:700,color:'#FFFFFF',marginBottom:3}}>{m.label}</div>
                    <div style={{fontSize:10,color:'#7B8EA8'}}>{m.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── RESULTS ──────────────────────────────────────────────────── */}
        {results&&(
          <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>

            {/* KPI Section — only shown on Summary tab */}
            {(activeTab==='summary'||isCohort)&&(
            <div style={{padding:'14px 28px',borderBottom:'1px solid #1E2D45',background:'#0B1220',flexShrink:0}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:10}}>
                {isCohort?(<>
                  <KpiChip label="Total Revenue"  value={fmt(results.summary?.total_revenue)} accent/>
                  <KpiChip label="Customers"      value={(results.summary?.n_customers||0).toLocaleString()}/>
                  <KpiChip label="Rev / Customer" value={fmt(results.summary?.rev_per_customer)}/>
                  <KpiChip label="Rows"           value={(results.summary?.rows_analyzed||0).toLocaleString()}/>
                  <KpiChip label="Cohort Columns" value={(results.summary?.cohort_cols?.length||0).toString()}/>
                  <KpiChip label="Fiscal Years"   value={(results.fiscal_years?.length||0).toString()}/>
                </>):(<>
                  <KpiChip label="Starting ARR"    value={fmt(toARR((retForPeriod||ret)?.beginning))} accent/>
                  <KpiChip label="Ending ARR"      value={fmt(toARR((retForPeriod||ret)?.ending))} sub={(retForPeriod||ret)?.beginning>0?`${((((retForPeriod||ret)?.ending||0)-((retForPeriod||ret)?.beginning||0))/((retForPeriod||ret)?.beginning||1)*100).toFixed(1)}%`:null} subGood={((retForPeriod||ret)?.ending||0)>=((retForPeriod||ret)?.beginning||0)}/>
                  <KpiChip label="New ARR"         value={fmt(toARR((retForPeriod||ret)?.new_arr))} sub={(retForPeriod||ret)?.new_arr>0?`+${fmt((retForPeriod||ret)?.new_arr)}`:null} subGood={true}/>
                  <KpiChip label="Lost ARR"        value={fmt(Math.abs(toARR((retForPeriod||ret)?.lost_arr)||0))} sub={(retForPeriod||ret)?.lost_arr<0?fmt((retForPeriod||ret)?.lost_arr):null} subGood={false}/>
                  <KpiChip label="Net Retention"   value={fmtPct((retForPeriod||ret)?.nrr)} sub={((retForPeriod||ret)?.nrr||0)>=100?'Healthy':'At Risk'} subGood={((retForPeriod||ret)?.nrr||0)>=100}/>
                  <KpiChip label="Gross Retention" value={fmtPct((retForPeriod||ret)?.grr)} sub={((retForPeriod||ret)?.grr||0)>=80?'Strong':'Alert'} subGood={((retForPeriod||ret)?.grr||0)>=80}/>
                </>)}
              </div>
            </div>
            )}

            {/* Tab content */}
            <div style={{flex:1,overflowY:'auto',padding:'20px 28px',background:'#0B1220'}}>

              {/* COHORT: Heatmap */}
              {isCohort&&activeTab==='heatmap'&&(
                <div style={{display:'flex',flexDirection:'column',gap:20}}>
                  <div style={{...S.card}}><CohortHeatmap data={results.retention} title="Retention Rate % by Cohort" isPercent={true}/></div>
                  {results.heatmap?.length>0&&<div style={{...S.card}}><CohortHeatmap data={results.heatmap} title="Customer Count by Cohort" isPercent={false}/></div>}
                </div>
              )}

              {/* COHORT: Revenue */}
              {isCohort&&activeTab==='revenue_heatmap'&&(
                <div>
                  {results.fy_summary?.length>0?(
                    <div style={{...S.card}}>
                      <div style={{...S.label,marginBottom:20}}>Revenue by Fiscal Year</div>
                      <div style={{height:220,marginBottom:24}}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={results.fy_summary}>
                            <XAxis dataKey={Object.keys(results.fy_summary[0])[0]} tick={{fontSize:10,fill:'#6B7280'}} axisLine={false} tickLine={false}/>
                            <YAxis tickFormatter={fmt} tick={{fontSize:10,fill:'#6B7280'}} axisLine={false} tickLine={false}/>
                            <Tooltip formatter={v=>fmt(v)} contentStyle={{background:'#0F1A2E',border:'1px solid #1E2D45',borderRadius:12,fontSize:12}}/>
                            <Bar dataKey="revenue" fill="#22C55E" radius={[3,3,0,0]}/>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
                        <thead><tr style={{borderBottom:'1px solid #1E2D45'}}>{['FY','Revenue','Customers','Rev/Customer'].map(h=><th key={h} style={{textAlign:'left',padding:'8px 12px',fontSize:9,fontWeight:700,textTransform:'uppercase',color:'#7B8EA8'}}>{h}</th>)}</tr></thead>
                        <tbody>{results.fy_summary.map((row,i)=>(
                          <tr key={i} style={{borderBottom:'1px solid #1E2D45'}}>
                            <td style={{padding:'10px 12px',fontWeight:700,color:'#FFFFFF'}}>{String(Object.values(row)[0])}</td>
                            <td style={{padding:'10px 12px',color:'#16A34A',fontWeight:600,fontFamily:"'JetBrains Mono',monospace"}}>{fmt(row.revenue)}</td>
                            <td style={{padding:'10px 12px',color:'#7B8EA8',fontFamily:"'JetBrains Mono',monospace"}}>{row.customers?.toLocaleString()}</td>
                            <td style={{padding:'10px 12px',color:'#7B8EA8',fontFamily:"'JetBrains Mono',monospace"}}>{fmt(row.rev_per_customer)}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  ):<div style={{...S.card,textAlign:'center',color:'#7B8EA8',fontSize:13,padding:40}}>No fiscal year data. Ensure Fiscal Year column is mapped.</div>}
                </div>
              )}

              {/* COHORT: Segmentation */}
              {isCohort&&activeTab==='segmentation'&&results.segmentation?.length>0&&(
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
                  <div style={{...S.card}}>
                    <div style={{...S.label,marginBottom:16}}>Revenue Segmentation</div>
                    <div style={{height:200}}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={results.segmentation} dataKey={Object.keys(results.segmentation[0]).find(k=>k!=='segment')||''} nameKey="segment" cx="50%" cy="50%" outerRadius={80} innerRadius={36}>
                            {results.segmentation.map((_,i)=><Cell key={i} fill={['#2563EB','#2563EB','#2563EB','#6B7280','#DC2626','#DC2626'][i%6]}/>)}
                          </Pie>
                          <Tooltip formatter={v=>fmt(v)} contentStyle={{background:'#0F1A2E',border:'1px solid #1E2D45',borderRadius:12}}/>
                          <Legend iconType="circle" wrapperStyle={{fontSize:11}}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* COHORT: Summary */}
              {isCohort&&activeTab==='summary'&&results.fy_summary?.length>0&&(
                <div style={{...S.card}}>
                  <div style={{...S.label,marginBottom:16}}>Summary by Fiscal Year</div>
                  <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
                    <thead><tr style={{borderBottom:'1px solid #1E2D45'}}>{['FY','Revenue','Customers','Rev/Customer'].map(h=><th key={h} style={{textAlign:'left',padding:'8px 12px',fontSize:9,fontWeight:700,textTransform:'uppercase',color:'#7B8EA8'}}>{h}</th>)}</tr></thead>
                    <tbody>{results.fy_summary.map((row,i)=>(
                      <tr key={i} style={{borderBottom:'1px solid #1E2D45'}}>
                        <td style={{padding:'10px 12px',fontWeight:700,color:'#FFFFFF'}}>{String(Object.values(row)[0])}</td>
                        <td style={{padding:'10px 12px',color:'#16A34A',fontWeight:600,fontFamily:"'JetBrains Mono',monospace"}}>{fmt(row.revenue)}</td>
                        <td style={{padding:'10px 12px',color:'#7B8EA8',fontFamily:"'JetBrains Mono',monospace"}}>{row.customers?.toLocaleString()}</td>
                        <td style={{padding:'10px 12px',color:'#7B8EA8',fontFamily:"'JetBrains Mono',monospace"}}>{fmt(row.rev_per_customer)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}

              {/* MRR: SUMMARY + BRIDGE — consolidated tab matching screenshot */}
              {!isCohort&&activeTab==='summary'&&(
                <div style={{display:'flex',flexDirection:'column',gap:0}}>

                  {/* ── AI narrative insight bar ─────────────────────── */}
                  {narrative&&(
                    <div style={{padding:'12px 18px',background:'#0F1A2E',border:'1px solid #1E2D45',borderLeft:'3px solid #3D5068',borderRadius:6,display:'flex',alignItems:'center',gap:10,margin:'0 0 16px'}}>
                      <Info size={12} color="#64748B" style={{flexShrink:0}}/>
                      <p style={{margin:0,fontSize:13,color:'#FFFFFF',lineHeight:1.55,fontWeight:400}}>{narrative}</p>
                    </div>
                  )}

                  {/* ── Metadata chip ────────────────────────────────── */}
                  {results?.metadata&&(
                    <div style={{padding:'7px 14px',borderRadius:8,border:'1px solid #253550',background:'#162035',display:'inline-flex',alignItems:'center',gap:8,alignSelf:'flex-start',marginBottom:16}}>
                      <span style={{fontSize:11,color:'#FFFFFF',fontWeight:600}}>{results.metadata.dimensions?.length>0?`Customer × ${results.metadata.dimensions.join(' × ')}`:'Customer level'}</span>
                      <span style={{color:'#E5E7EB'}}>·</span>
                      <span style={{fontSize:11,color:'#7B8EA8'}}>{results.metadata.row_count?.toLocaleString()} rows</span>
                    </div>
                  )}

                  {/* ══ 4-TAB DASHBOARD ══════════════════════════════════ */}
                  {(()=>{
                    // ── inner tab state ──────────────────────────────────
                    // We use a module-level ref trick: store in a hidden div's dataset
                    // Actually we lift this as a useState at component level below via summarySubTab
                    const CORE_CATS = ['New Logo','Cross-sell','Returning','Upsell','Downsell','Churn','Churn-Partial','Churn Partial','Lapsed']
                    const PV_KEYS   = new Set(['Price Impact','Volume Impact','Price on Volume'])

                    // ── data helpers ─────────────────────────────────────
                    const r        = retForPeriod || ret
                    const beg      = r?.beginning || 0
                    const end      = r?.ending    || 0
                    const netChg   = end - beg
                    const grossRet = beg > 0 ? ((beg + (selectedWfall.filter(x=>x.value<0).reduce((s,x)=>s+x.value,0))) / beg * 100) : (r?.grr || 0)
                    const netRet   = beg > 0 ? (end / beg * 100) : (r?.nrr || 0)

                    // raw PV rows from full wfall (not filtered)
                    const pvSource = (()=>{
                      if (selPeriod && effectiveByPeriod?.length) {
                        const row = effectiveByPeriod.find(x => normalizePeriod(x._period) === normalizePeriod(selPeriod))
                        if (row) return Object.keys(row).filter(k=>PV_KEYS.has(k)).map(k=>({category:k,value:row[k]||0}))
                      }
                      return (wfall||[]).filter(x=>PV_KEYS.has(x.category))
                    })()

                    const sumPV = (cat, sign) => pvSource.filter(x=>x.category===cat&&(sign==='pos'?x.value>0:x.value<0)).reduce((s,x)=>s+x.value,0)
                    const upPrice  = sumPV('Price Impact','pos')
                    const upVol    = sumPV('Volume Impact','pos')
                    const upPov    = sumPV('Price on Volume','pos')
                    const dnPrice  = sumPV('Price Impact','neg')
                    const dnVol    = sumPV('Volume Impact','neg')
                    const dnPov    = sumPV('Price on Volume','neg')
                    const totPrice = pvSource.filter(x=>x.category==='Price Impact').reduce((s,x)=>s+x.value,0)
                    const totVol   = pvSource.filter(x=>x.category==='Volume Impact').reduce((s,x)=>s+x.value,0)
                    const totPov   = pvSource.filter(x=>x.category==='Price on Volume').reduce((s,x)=>s+x.value,0)
                    const netPV    = totPrice + totVol + totPov

                    const upsellNet   = selectedWfall.find(x=>x.category==='Upsell')?.value   || 0
                    const downsellNet = selectedWfall.find(x=>x.category==='Downsell')?.value || 0

                    // core movements sum (no PV)
                    const coreMovements = selectedWfall.filter(x=>!['Beginning ARR','Ending ARR','Beginning MRR','Ending MRR'].includes(x.category))
                    const coreSum  = coreMovements.reduce((s,x)=>s+x.value,0)
                    const pvSum    = pvSource.reduce((s,x)=>s+x.value,0)
                    const wrongSum = coreSum + pvSum
                    const reconGap = netChg - coreSum

                    // trend data
                    const trendData = (effectiveByPeriod||[]).filter(x=>x['Beginning ARR']>0||x['beginning']>0)

                    const fs  = v => v===0?'—':(v>0?'+':'')+fmt(v)
                    const fc  = v => v>0?'#4ADE80':v<0?'#F87171':'#64748B'
                    const fsp = v => v==null?'—':`${v.toFixed(1)}%`
                    const fcp = v => v>=100?'#4ADE80':v>=80?'#4ADE80':'#F87171'

                    const SUB_TABS = ['ARR Bridge','Price / Volume','Trends','Reconciliation']

                    return (
                      <div>
                        {/* ── Sub-tab bar ───────────────────────────────── */}
                        <div style={{display:'flex',borderBottom:'1px solid #1E2D45',marginBottom:20}}>
                          {SUB_TABS.map(t=>(
                            <button key={t} onClick={()=>setSummarySubTab(t)}
                              style={{padding:'10px 18px',fontSize:13,fontWeight:summarySubTab===t?600:400,border:'none',borderBottom:`2px solid ${summarySubTab===t?'#CBD5E1':'transparent'}`,background:'transparent',color:summarySubTab===t?'#CBD5E1':'#4A5A6E',cursor:'pointer',transition:'all 0.12s',whiteSpace:'nowrap'}}>
                              {t}
                            </button>
                          ))}
                        </div>

                        {/* ══ TAB: ARR Bridge ══════════════════════════════ */}
                        {summarySubTab==='ARR Bridge'&&(
                          <div style={{display:'flex',flexDirection:'column',gap:20}}>

                            {/* Reconciliation warning */}
                            {bridgeOk&&!bridgeOk.valid&&(
                              <div style={{padding:'10px 14px',background:'#1A1400',border:'1px solid #3A2E00',borderRadius:6,display:'flex',alignItems:'center',gap:8}}>
                                <AlertCircle size={11} color="#FCD34D"/>
                                <span style={{fontSize:11,color:'#FCD34D'}}>Reconciliation gap: movements sum {fmt(bridgeOk.total)}, expected {fmt(bridgeOk.expected)} (Δ {fmt(Math.abs(bridgeOk.diff))})</span>
                              </div>
                            )}

                            {/* Waterfall chart */}
                            <div style={{...S.cardF}}>
                              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid #1E2D45'}}>
                                <div>
                                  <div style={{fontSize:14,fontWeight:700,color:'#FFFFFF',letterSpacing:'-0.01em'}}>ARR Bridge: {periodType==='Annual'?'YoY':'QoQ'} · {selLb}M{selPeriod?` · ${selPeriod}`:''}</div>
                                  <div style={{fontSize:11,color:'#7B8EA8',marginTop:2}}>Movement from beginning to ending ARR</div>
                                </div>
                                <div style={{display:'flex',alignItems:'center',gap:14,fontSize:10,color:'#7B8EA8'}}>
                                  <span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:10,height:10,borderRadius:2,background:'#4ADE80',display:'inline-block'}}/> Expansion</span>
                                  <span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:10,height:10,borderRadius:2,background:'#F87171',display:'inline-block'}}/> Contraction</span>
                                  <span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:10,height:10,borderRadius:2,background:'#3D5068',display:'inline-block'}}/> Baseline</span>
                                </div>
                              </div>
                              <div style={{padding:'20px 20px 8px'}}>
                                {(()=>{
                                  const BOUNDARY_WFALL = new Set(['Beginning MRR','Ending MRR','Beginning ARR','Ending ARR'])
                                  // Normalize category names: underscore variants → hyphen (Cross_sell→Cross-sell etc)
                                  const normalize = cat => cat.replace(/_/g,'-')
                                  const movements = selectedWfall
                                    .filter(x => !BOUNDARY_WFALL.has(x.category))
                                    .map(x => ({...x, category: normalize(x.category)}))
                                  const fullData = [
                                    {category:'Beginning ARR', value:toARR(beg)||0},
                                    ...movements,
                                    {category:'Ending ARR',    value:toARR(end)||0},
                                  ]
                                  return <WaterfallBridge data={fullData} showBoundary={true} height={300}/>
                                })()}
                              </div>
                            </div>

                            {/* Movement breakdown table */}
                            <div style={{...S.cardF}}>
                              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',borderBottom:'1px solid #1E2D45'}}>
                                <div style={{fontSize:14,fontWeight:700,color:'#FFFFFF',letterSpacing:'-0.01em'}}>Movement Breakdown</div>
                                {isAdmin&&<button onClick={downloadCSV} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,fontWeight:600,color:'#4ADE80',background:'transparent',border:'none',cursor:'pointer'}}><Download size={12}/> Export</button>}
                              </div>
                              <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
                                <thead>
                                  <tr style={{background:'#162035'}}>
                                    {['Category','Amount','% of Beg ARR'].map((h,i)=>(
                                      <th key={h} style={{textAlign:i===0?'left':'right',padding:'10px 20px',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'#7B8EA8',borderBottom:'1px solid #1E2D45',whiteSpace:'nowrap'}}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {/* Beginning ARR row */}
                                  <tr style={{borderBottom:'1px solid #1E2D45',background:'#162035'}}>
                                    <td style={{padding:'10px 20px',fontWeight:700,color:'#FFFFFF',fontSize:13}}>Beginning ARR</td>
                                    <td style={{textAlign:'right',padding:'10px 20px',fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:700,color:'#FFFFFF'}}>{fmt(toARR(beg))}</td>
                                    <td style={{textAlign:'right',padding:'10px 20px',color:'#64748B',fontSize:12}}>—</td>
                                  </tr>
                                  {/* Core movement rows */}
                                  {coreMovements.sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)).map((row,i)=>(
                                    <tr key={i} style={{borderBottom:'1px solid #1E2D45'}}
                                      onMouseEnter={e=>e.currentTarget.style.background='#111827'}
                                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                      <td style={{padding:'10px 20px',display:'flex',alignItems:'center',gap:10}}>
                                        <span style={{width:8,height:8,borderRadius:'50%',background:BC[row.category]||'#6B7280',flexShrink:0}}/>
                                        <span style={{fontWeight:500,color:'#E2E8F0',fontSize:13}}>{row.category}</span>
                                      </td>
                                      <td style={{textAlign:'right',padding:'10px 20px',fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:600,color:row.value>=0?'#4ADE80':'#F87171'}}>
                                        {row.value===0?'—':(row.value>0?'+':'')+fmt(toARR(row.value))}
                                      </td>
                                      <td style={{textAlign:'right',padding:'10px 20px',fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:'#64748B'}}>
                                        {beg>0?`${Math.abs(row.value/beg*100).toFixed(1)}%`:'—'}
                                      </td>
                                    </tr>
                                  ))}
                                  {/* Ending ARR row */}
                                  <tr style={{borderTop:'1px solid #253550',background:'#162035'}}>
                                    <td style={{padding:'10px 20px',fontWeight:700,color:'#4ADE80',fontSize:13}}>Ending ARR</td>
                                    <td style={{textAlign:'right',padding:'10px 20px',fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:700,color:'#4ADE80'}}>{fmt(toARR(end))}</td>
                                    <td style={{textAlign:'right',padding:'10px 20px',fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:'#64748B'}}>{beg>0?`${(end/beg*100).toFixed(1)}%`:'—'}</td>
                                  </tr>
                                  {/* Reconciliation check */}
                                  <tr style={{background:'#0D1525'}}>
                                    <td style={{padding:'8px 20px',fontSize:11,color:'#4A5A6E'}}>Reconciliation check</td>
                                    <td colSpan={2} style={{textAlign:'right',padding:'8px 20px',fontSize:11}}>
                                      <span style={{color:Math.abs(reconGap)<1?'#4ADE80':'#F87171',fontWeight:600}}>
                                        {Math.abs(reconGap)<1?'✓ $0 gap — balanced':`⚠ Gap: ${fmt(reconGap)}`}
                                      </span>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            {/* ── Month-aligned ARR Waterfall — Jul-2022 / Jul-2023 / Jul-2024 etc ── */}
                            {(()=>{
                              if (!effectiveByPeriod?.length || !selPeriod) return null

                              // Extract selected month (e.g. 'Jul' from 'Jul-2024')
                              const selMonth = selPeriod.split('-')[0]
                              if (!selMonth || selMonth.length !== 3) return null

                              // Find all periods matching the selected month across all years
                              const monthCols = effectiveByPeriod
                                .filter(r => r._period?.startsWith(selMonth + '-'))
                                .map(r => r._period)
                                .sort((a,b) => {
                                  const ya = parseInt(a.split('-')[1]||'0')
                                  const yb = parseInt(b.split('-')[1]||'0')
                                  return ya - yb
                                })

                              if (monthCols.length < 1) return null

                              // Build lookup: period → row data
                              const lookup = {}
                              effectiveByPeriod.forEach(r => { if (r._period) lookup[r._period] = r })

                              // All movement categories across all month-columns
                              const BOUNDARY = new Set(['_period','Beginning ARR','Ending ARR','Beginning MRR','Ending MRR','_nrr','_grr'])
                              const catSet = new Set()
                              monthCols.forEach(p => {
                                const row = lookup[p] || {}
                                Object.keys(row).forEach(k => { if (!BOUNDARY.has(k)) catSet.add(k) })
                              })
                              const ORDER = ['Churn','Churn-Partial','Churn_Partial','Churn Partial','Downsell','Upsell','Cross-sell','Cross_sell','New Logo','Lapsed','Returning','Other In','Other Out']
                              const cats = [...catSet].sort((a,b) => {
                                const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b)
                                return (ia<0?99:ia) - (ib<0?99:ib)
                              })

                              const fmt2 = v => { if(!v||v===0)return'—'; const a=Math.abs(v); const s=v<0?'':'+'; if(a>=1e6)return`${s}$${(v/1e6).toFixed(1)}M`; if(a>=1e3)return`${s}$${(v/1e3).toFixed(0)}K`; return`${s}$${v.toFixed(0)}` }
                              const fmtAbs = v => fmt(v)

                              return (
                                <div style={{...S.card, padding:0, overflow:'hidden'}}>
                                  <div style={{padding:'14px 20px',borderBottom:'1px solid #1E2D45',display:'flex',alignItems:'center',gap:10}}>
                                    <span style={{fontSize:13,fontWeight:700,color:'#E2E8F0'}}>ARR Waterfall</span>
                                    <span style={{fontSize:10,color:'#4A5A6E'}}>{selMonth} across all years · {selLb}M Lookback</span>
                                  </div>
                                  <div style={{overflowX:'auto'}}>
                                    <table style={{borderCollapse:'collapse',width:'100%',fontSize:12,minWidth:Math.max(monthCols.length*110+200,480)}}>
                                      <thead>
                                        <tr style={{background:'#162035',borderBottom:'1px solid #1E2D45'}}>
                                          <th style={{textAlign:'left',padding:'9px 16px',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'#4A5A6E',position:'sticky',left:0,background:'#162035',minWidth:160}}>Bridge</th>
                                          {monthCols.map(p=>(
                                            <th key={p} style={{textAlign:'right',padding:'9px 14px',fontSize:10,fontWeight:p===selPeriod?700:500,color:p===selPeriod?'#CBD5E1':'#4A5A6E',whiteSpace:'nowrap',background:p===selPeriod?'#1A2840':'#162035'}}>
                                              {p}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {/* Beginning ARR */}
                                        <tr style={{background:'#162035',borderBottom:'1px solid #1E2D45'}}>
                                          <td style={{padding:'9px 16px',fontWeight:700,color:'#E2E8F0',position:'sticky',left:0,background:'#162035',fontSize:12}}>Beginning ARR</td>
                                          {monthCols.map(p=>{
                                            const v = lookup[p]?.['Beginning ARR']||0
                                            const isSel = p===selPeriod
                                            return <td key={p} style={{textAlign:'right',padding:'9px 14px',fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:'#E2E8F0',background:isSel?'rgba(26,40,64,0.8)':'#162035'}}>{fmtAbs(v)}</td>
                                          })}
                                        </tr>
                                        {/* Movement rows */}
                                        {cats.map((cat,ri)=>{
                                          const hasAny = monthCols.some(p => lookup[p]?.[cat] && lookup[p][cat]!==0)
                                          if (!hasAny) return null
                                          return (
                                            <tr key={cat} style={{borderBottom:'1px solid #1E2D45',background:ri%2===0?'transparent':'#0D1525'}}>
                                              <td style={{padding:'9px 16px',position:'sticky',left:0,background:ri%2===0?'#0F1A2E':'#0D1525',display:'flex',alignItems:'center',gap:8,whiteSpace:'nowrap'}}>
                                                <span style={{width:7,height:7,borderRadius:'50%',background:BC[cat]||BC[cat.replace(/-/g,'_')]||'#64748B',flexShrink:0}}/>
                                                <span style={{fontWeight:500,color:'#94A3B8',fontSize:12}}>{cat}</span>
                                              </td>
                                              {monthCols.map(p=>{
                                                const v = lookup[p]?.[cat]||0
                                                const isSel = p===selPeriod
                                                const beg = lookup[p]?.['Beginning ARR']||1
                                                return (
                                                  <td key={p} style={{textAlign:'right',padding:'9px 14px',fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:isSel?700:400,color:!v||v===0?'#2A3040':v>0?'#4ADE80':'#F87171',background:isSel?'rgba(26,40,64,0.6)':'transparent'}}>
                                                    {v===0?'—':fmt2(v)}
                                                  </td>
                                                )
                                              })}
                                            </tr>
                                          )
                                        })}
                                        {/* Ending ARR */}
                                        <tr style={{borderTop:'1px solid #253550',background:'#162035'}}>
                                          <td style={{padding:'9px 16px',fontWeight:700,color:'#4ADE80',position:'sticky',left:0,background:'#162035',fontSize:12}}>Ending ARR</td>
                                          {monthCols.map(p=>{
                                            const v = lookup[p]?.['Ending ARR']||0
                                            const isSel = p===selPeriod
                                            return <td key={p} style={{textAlign:'right',padding:'9px 14px',fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:'#4ADE80',background:isSel?'rgba(26,40,64,0.8)':'#162035'}}>{fmtAbs(v)}</td>
                                          })}
                                        </tr>
                                        {/* NRR row */}
                                        <tr style={{borderTop:'1px solid #1E2D45',background:'#0D1525'}}>
                                          <td style={{padding:'8px 16px',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'#4A5A6E',position:'sticky',left:0,background:'#0D1525'}}>Net Retention</td>
                                          {monthCols.map(p=>{
                                            const row = lookup[p]||{}
                                            const beg = row['Beginning ARR']||0
                                            const end = row['Ending ARR']||0
                                            const nrr = row._nrr ?? (beg>0?(end/beg*100):null)
                                            const isSel = p===selPeriod
                                            return <td key={p} style={{textAlign:'right',padding:'8px 14px',fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:900,color:nrr>=100?'#4ADE80':'#F87171',background:isSel?'rgba(26,40,64,0.5)':'transparent'}}>{nrr!=null?`${nrr.toFixed(1)}%`:'—'}</td>
                                          })}
                                        </tr>
                                        {/* GRR row */}
                                        <tr style={{borderTop:'1px solid #1E2D45',background:'#0D1525'}}>
                                          <td style={{padding:'8px 16px',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'#4A5A6E',position:'sticky',left:0,background:'#0D1525'}}>Gross Retention</td>
                                          {monthCols.map(p=>{
                                            const row = lookup[p]||{}
                                            const beg = row['Beginning ARR']||0
                                            const contractions = Object.keys(row).filter(k=>!BOUNDARY.has(k)&&(row[k]||0)<0).reduce((s,k)=>s+(row[k]||0),0)
                                            const grr = row._grr ?? (beg>0?((beg+contractions)/beg*100):null)
                                            const isSel = p===selPeriod
                                            return <td key={p} style={{textAlign:'right',padding:'8px 14px',fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:900,color:grr>=80?'#4ADE80':'#F87171',background:isSel?'rgba(26,40,64,0.5)':'transparent'}}>{grr!=null?`${grr.toFixed(1)}%`:'—'}</td>
                                          })}
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        )}

                        {/* ══ TAB: Price / Volume ══════════════════════════ */}
                        {summarySubTab==='Price / Volume'&&(
                          <div style={{display:'flex',flexDirection:'column',gap:20}}>

                            {/* Summary chips */}
                            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10}}>
                              {[
                                {label:'Total Price Effect', val:totPrice},
                                {label:'Total Volume Effect',val:totVol},
                                {label:'Net P×V Effect',     val:netPV},
                                {label:'Upsell net',         val:upsellNet},
                                {label:'Downsell net',       val:downsellNet},
                                {label:'Net Expansion',      val:upsellNet+downsellNet},
                              ].map(c=>(
                                <div key={c.label} style={{background:'#0F1A2E',border:'1px solid #1E2D45',borderRadius:6,padding:'12px 14px'}}>
                                  <div style={{fontSize:9,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.1em',color:'#4A5A6E',marginBottom:6}}>{c.label}</div>
                                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:17,fontWeight:700,color:fc(c.val)}}>{fs(c.val)}</div>
                                </div>
                              ))}
                            </div>

                            {/* Decomposition table */}
                            <div style={{...S.cardF}}>
                              <div style={{padding:'14px 20px',borderBottom:'1px solid #1E2D45'}}>
                                <div style={{fontSize:13,fontWeight:700,color:'#FFFFFF'}}>Upsell/Downsell decomposition</div>
                              </div>
                              <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
                                <thead>
                                  <tr style={{background:'#162035'}}>
                                    {['Component','Amount','% of Net'].map((h,i)=>(
                                      <th key={h} style={{textAlign:i===0?'left':'right',padding:'9px 20px',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'#7B8EA8',borderBottom:'1px solid #1E2D45'}}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {[
                                    {label:'Upsell (net)',        val:upsellNet,   indent:false, base:null},
                                    {label:'→ Price component',   val:upPrice,     indent:true,  base:Math.abs(upsellNet)},
                                    {label:'→ Volume component',  val:upVol,       indent:true,  base:Math.abs(upsellNet)},
                                    {label:'→ Price-on-Volume',   val:upPov,       indent:true,  base:Math.abs(upsellNet)},
                                    {label:'Downsell (net)',      val:downsellNet, indent:false, base:null},
                                    {label:'→ Price component',   val:dnPrice,     indent:true,  base:Math.abs(downsellNet)},
                                    {label:'→ Volume component',  val:dnVol,       indent:true,  base:Math.abs(downsellNet)},
                                    {label:'→ Price-on-Volume',   val:dnPov,       indent:true,  base:Math.abs(downsellNet)},
                                  ].map((row,i)=>(
                                    <tr key={i} style={{borderBottom:'1px solid #1E2D45'}}
                                      onMouseEnter={e=>e.currentTarget.style.background='#111827'}
                                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                      <td style={{padding:'10px 20px',paddingLeft:row.indent?36:20,color:row.indent?'#94A3B8':'#E2E8F0',fontWeight:row.indent?400:600,fontSize:13,display:'flex',alignItems:'center',gap:8}}>
                                        {!row.indent&&<span style={{width:8,height:8,borderRadius:'50%',background:row.val>=0?'#4ADE80':'#F87171',flexShrink:0}}/>}
                                        {row.indent&&<span style={{color:'#3D5068',fontSize:12}}>→</span>}
                                        {row.label.replace('→ ','')}
                                      </td>
                                      <td style={{textAlign:'right',padding:'10px 20px',fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:600,color:fc(row.val)}}>
                                        {row.val===0?'—':(row.val>0?'+':'')+fmt(row.val)}
                                      </td>
                                      <td style={{textAlign:'right',padding:'10px 20px',fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:'#64748B'}}>
                                        {row.base&&row.base>0?`${(Math.abs(row.val)/row.base*100).toFixed(1)}%`:'—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {/* Footer note */}
                              <div style={{padding:'12px 20px',background:'#0D1525',borderTop:'1px solid #1E2D45',display:'flex',alignItems:'flex-start',gap:8}}>
                                <Info size={11} color="#4A5A6E" style={{flexShrink:0,marginTop:2}}/>
                                <span style={{fontSize:11,color:'#4A5A6E',lineHeight:1.6}}>
                                  <strong style={{color:'#64748B'}}>Note on reconciliation:</strong> Price Impact, Volume Impact, and Price-on-Volume rows are sub-decompositions of Upsell/Downsell — they share the same units. Including them in the core bridge sum double-counts the Upsell/Downsell movement. Only the 8 core categories (New Logo, Cross-sell, Returning, Upsell, Downsell, Churn, Churn-Partial, Lapsed) are summed in the bridge reconciliation above.
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ══ TAB: Trends ══════════════════════════════════ */}
                        {summarySubTab==='Trends'&&(
                          <div style={{display:'flex',flexDirection:'column',gap:4}}>
                            <div style={{fontSize:11,color:'#4A5A6E',marginBottom:12}}>
                              All {trendData.length} periods with Beginning ARR &gt; 0 · selected period highlighted
                            </div>
                            {[
                              {key:'Upsell',        color:'#4ADE80'},
                              {key:'Downsell',      color:'#F87171'},
                              {key:'New Logo',      color:'#4ADE80'},
                              {key:'Churn',         color:'#DC2626'},
                              {key:'Churn-Partial', color:'#F87171'},
                              {key:'Lapsed',        color:'#CA8A04'},
                              {key:'Returning',     color:'#86EFAC'},
                              {key:'Cross-sell',    color:'#4ADE80'},
                            ].map(cfg=>{
                              const vals = trendData.map(r=>r[cfg.key]||0)
                              if (vals.every(v=>v===0)) return null
                              const maxAbs = Math.max(...vals.map(Math.abs),1)
                              const W=560,H=72,pad=8
                              const pts = vals.map((v,i)=>({
                                x: pad+(i/(Math.max(vals.length-1,1)))*(W-2*pad),
                                y: H/2-(v/maxAbs)*(H/2-pad)
                              }))
                              const path = pts.map((p,i)=>(i===0?`M${p.x.toFixed(1)},${p.y.toFixed(1)}`:`L${p.x.toFixed(1)},${p.y.toFixed(1)}`)).join(' ')
                              const selIdx = selPeriod ? trendData.findIndex(r=>normalizePeriod(r._period)===normalizePeriod(selPeriod)) : -1
                              return (
                                <div key={cfg.key} style={{marginBottom:12}}>
                                  <div style={{fontSize:11,color:'#64748B',marginBottom:2,fontWeight:500}}>{cfg.key}</div>
                                  <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{display:'block',overflow:'visible'}}>
                                    <line x1={pad} y1={H/2} x2={W-pad} y2={H/2} stroke="#1E2D45" strokeWidth={0.5}/>
                                    <path d={path} fill="none" stroke={cfg.color} strokeWidth={1.5} opacity={0.9}/>
                                    {pts.map((p,i)=>(
                                      <circle key={i} cx={p.x} cy={p.y} r={i===selIdx?4:2.5}
                                        fill={i===selIdx?'#FFFFFF':cfg.color}
                                        stroke={i===selIdx?cfg.color:'none'}
                                        strokeWidth={i===selIdx?1.5:0}/>
                                    ))}
                                  </svg>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* ══ TAB: Reconciliation ══════════════════════════ */}
                        {summarySubTab==='Reconciliation'&&(
                          <div style={{display:'flex',flexDirection:'column',gap:20}}>

                            {/* Checklist table */}
                            <div style={{...S.cardF}}>
                              <table style={{borderCollapse:'collapse',width:'100%',fontSize:13}}>
                                <tbody>
                                  {[
                                    {label:'Beginning ARR',               val:fmt(toARR(beg)),          pass:true},
                                    {label:'Ending ARR',                  val:fmt(toARR(end)),          pass:true},
                                    {label:'Expected delta (End − Beg)',  val:fs(netChg),               pass:true},
                                    {label:'Core 8 movements sum',        val:fs(coreSum),              pass:Math.abs(reconGap)<1},
                                    {label:'Reconciliation gap (core only)', val: Math.abs(reconGap)<1?'$0':fmt(reconGap), pass:Math.abs(reconGap)<1},
                                    {label:'If Price/Vol included (wrong)', val:fs(wrongSum),            pass:false},
                                    {label:'Gap if Price/Vol included',    val:fmt(netChg-wrongSum),     pass:false},
                                  ].map((row,i)=>(
                                    <tr key={i} style={{borderBottom:'1px solid #1E2D45'}}>
                                      <td style={{padding:'12px 20px',color:'#E2E8F0',fontSize:13}}>{row.label}</td>
                                      <td style={{padding:'12px 20px',textAlign:'right',fontFamily:"'JetBrains Mono',monospace",fontWeight:600,fontSize:13,color:'#FFFFFF'}}>{row.val}</td>
                                      <td style={{padding:'12px 20px',textAlign:'right',whiteSpace:'nowrap'}}>
                                        <span style={{fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:4,background:row.pass?'rgba(74,222,128,0.1)':'rgba(248,113,113,0.1)',color:row.pass?'#4ADE80':'#F87171',border:`1px solid ${row.pass?'rgba(74,222,128,0.2)':'rgba(248,113,113,0.2)'}`}}>
                                          {row.pass?'✓ pass':'✗ fail'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Fix cards */}
                            <div>
                              <div style={{fontSize:11,fontWeight:600,color:'#4A5A6E',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Changes needed in your Excel/Alteryx workflow</div>
                              {[
                                {sev:'HIGH', sevColor:'#F87171', sevBg:'rgba(248,113,113,0.08)', title:'Include Price/Volume in net sum',                  body:'Filter to 8 core categories only. Exclude Price Impact, Volume Impact, Price on Volume from movement total.'},
                                {sev:'HIGH', sevColor:'#F87171', sevBg:'rgba(248,113,113,0.08)', title:'Lapsed Bridge Value = 0 (reads current MRR)',       body:'Lapsed value = −BeginningARR (negative of Prior ARR). Current MRR is 0 for lapsed units — use the Beg ARR row, not current.'},
                                {sev:'MED',  sevColor:'#FCD34D', sevBg:'rgba(252,211,77,0.08)',  title:'Returning Bridge Value = delta instead of full current', body:'Returning BridgeValue = Current ARR in full. Prior=0 for returning units, so no Beginning ARR row exists. Bridge value = full current period ARR.'},
                                {sev:'MED',  sevColor:'#FCD34D', sevBg:'rgba(252,211,77,0.08)',  title:'Lapsed re-entry period misclassified as Returning', body:'If 12M lookback prior > 0 (unit existed 12M ago), re-entry is Downsell, not Returning. Returning only fires when prior = 0 (lookback window falls inside the zero-gap).'},
                                {sev:'LOW',  sevColor:'#64748B', sevBg:'rgba(100,116,139,0.08)', title:'Other In/Out absent despite Channel/Region data',   body:'Zero Other In/Out rows currently. Channel-shifted units fall into New Logo/Churn instead. Implement migration detection if needed.'},
                              ].map((c,i)=>(
                                <div key={i} style={{marginBottom:10,padding:'12px 16px',borderLeft:`3px solid ${c.sevColor}`,background:c.sevBg,borderRadius:'0 6px 6px 0'}}>
                                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                                    <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:3,background:c.sevBg,color:c.sevColor,border:`1px solid ${c.sevColor}22`,letterSpacing:'0.06em'}}>{c.sev}</span>
                                    <span style={{fontSize:12,fontWeight:600,color:'#E2E8F0'}}>{c.title}</span>
                                  </div>
                                  <div style={{fontSize:11,color:'#64748B',lineHeight:1.6}}>{c.body}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* MRR: DETAILED BRIDGE + RETENTION TRENDS */}
              {/* ══ HISTORICAL REVENUE PERFORMANCE ══════════════════════════ */}
              {!isCohort&&activeTab==='historical_perf'&&(()=>{
                // ── All data comes from effectiveByPeriod (same source as bridge) ──
                const MONTHS_LIST = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                const pKeyHP = (p) => { const m=(p||'').match(/^([A-Za-z]{3})-(\d{4})$/); return m?parseInt(m[2])*100+MONTHS_LIST.indexOf(m[1]):0 }
                const BOUNDARY = new Set(['_period','Beginning ARR','Ending ARR','Beginning MRR','Ending MRR','_nrr','_grr','beginning','ending'])
                const PV_CATS  = new Set(['Price Impact','Volume Impact','Price on Volume','Price','Volume'])

                // ── Helper: compute metrics from one effectiveByPeriod row ──────
                const metricsFromRow = (row) => {
                  if (!row) return null
                  const beg = row['Beginning ARR'] ?? row['beginning'] ?? 0
                  const end = row['Ending ARR']    ?? row['ending']    ?? 0
                  const movements = Object.keys(row)
                    .filter(k => !BOUNDARY.has(k) && !PV_CATS.has(k))
                    .map(k => ({ k, v: row[k]||0 }))
                  // Expansion = positive non-PV movements (New Logo, Upsell, Cross-sell, Returning)
                  const expansion   = movements.filter(x=>x.v>0).reduce((s,x)=>s+x.v,0)
                  // Contraction = negative non-PV movements (Downsell, Churn, Churn-Partial, Lapsed)
                  const contraction = movements.filter(x=>x.v<0).reduce((s,x)=>s+x.v,0)
                  const upsell      = (row['Upsell']||row['Upsell_arr']||0)
                  const crossSell   = (row['Cross-sell']||row['Cross_sell']||0)
                  const downsell    = (row['Downsell']||0)
                  const churn       = (row['Churn']||0) + (row['Churn-Partial']||row['Churn_Partial']||0) + (row['Lapsed']||0)
                  const nrr  = row._nrr ?? (beg>0?(end/beg)*100:null)
                  const grr  = row._grr ?? (beg>0?((beg+contraction)/beg)*100:null)
                  const netExp = upsell + crossSell + downsell
                  return { beg, end, expansion, contraction, upsell, crossSell, downsell, churn, nrr, grr, netExp }
                }

                // ── Selected period metrics (from retForPeriod — already computed) ──
                const r   = retForPeriod || ret
                const beg = r?.beginning || 0
                const end = r?.ending    || 0
                const nrr = r?.nrr  || 0
                const grr = r?.grr  || 0
                const selRow = effectiveByPeriod?.find(x => normalizePeriod(x._period)===normalizePeriod(selPeriod))
                const expansion   = selRow ? Object.keys(selRow).filter(k=>!BOUNDARY.has(k)&&!PV_CATS.has(k)&&(selRow[k]||0)>0).reduce((s,k)=>s+(selRow[k]||0),0) : 0
                const contraction = selRow ? Object.keys(selRow).filter(k=>!BOUNDARY.has(k)&&!PV_CATS.has(k)&&(selRow[k]||0)<0).reduce((s,k)=>s+(selRow[k]||0),0) : 0
                const netExpansion = expansion + contraction
                const nrrGrowth = nrr - 100

                // ── Time series: sorted effectiveByPeriod rows ────────────────
                const allSorted = [...(effectiveByPeriod||[])].sort((a,b)=>pKeyHP(a._period)-pKeyHP(b._period))

                // ── Chart window: last N months up to selPeriod (or all) ──────
                const selIdx = selPeriod ? allSorted.findIndex(r=>normalizePeriod(r._period)===normalizePeriod(selPeriod)) : allSorted.length-1
                const anchor = selIdx>=0?selIdx:allSorted.length-1

                // Time windows
                const windows = [{label:'3M',n:3},{label:'6M',n:6},{label:'12M',n:12},{label:'24M',n:24}]
                // Use selLb to determine default window
                const chartWindow = histChartWindow
                const setChartWindow = setHistChartWindow
                const windowStart = Math.max(0, anchor - chartWindow + 1)
                const chartData = allSorted.slice(windowStart, anchor+1).map(row => {
                  const m = metricsFromRow(row)
                  if (!m) return null
                  return {
                    period: row._period,
                    nrr:    m.nrr ? parseFloat(m.nrr.toFixed(1)) : null,
                    grr:    m.grr ? parseFloat(m.grr.toFixed(1)) : null,
                    churnPct: m.beg>0 ? parseFloat((Math.abs(m.churn)/m.beg*100).toFixed(1)) : null,
                    expansionPct: m.beg>0 ? parseFloat((m.expansion/m.beg*100).toFixed(1)) : null,
                  }
                }).filter(Boolean)

                // ── Monthly Growth Audit table: all periods up to selPeriod ──
                const auditRows = allSorted.slice(0, anchor+1).reverse().map(row => {
                  const m = metricsFromRow(row)
                  if (!m) return null
                  return { period: row._period, ...m }
                }).filter(Boolean)

                // ── Seasonality: best and worst month by expansion% ───────────
                const byMonth = {}
                allSorted.forEach(row => {
                  const mon = (row._period||'').split('-')[0]
                  const m   = metricsFromRow(row)
                  if (!mon || !m || !m.beg) return
                  if (!byMonth[mon]) byMonth[mon] = []
                  byMonth[mon].push(m.expansion/m.beg*100)
                })
                const monthAvg = Object.entries(byMonth).map(([mon,vals])=>({mon, avg:vals.reduce((s,v)=>s+v,0)/vals.length}))
                monthAvg.sort((a,b)=>b.avg-a.avg)
                const bestMon  = monthAvg[0]
                const worstMon = monthAvg[monthAvg.length-1]

                const fc = v => v>=0?'#4ADE80':'#F87171'
                const fs = v => v==null?'—':(v>=0?'+':'')+v.toFixed(1)+'%'

                return (
                  <div style={{display:'flex',flexDirection:'column',gap:20}}>

                    {/* ── Header ─────────────────────────────────────────── */}
                    <div>
                      <div style={{fontSize:20,fontWeight:800,color:'#E2E8F0',letterSpacing:'-0.02em'}}>Historical Revenue Performance</div>
                      <div style={{fontSize:12,color:'#4A5A6E',marginTop:3}}>Longitudinal view of net retention and growth indicators · {selPeriod||'—'}</div>
                    </div>

                    {/* ── KPI Strip ──────────────────────────────────────── */}
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
                      {[
                        {label:'NRR',        value:nrr?.toFixed(1)+'%',   sub:fs(nrrGrowth)+' vs 100%',         subGood:nrrGrowth>=0, accent:nrr>=100?'#4ADE80':'#F87171'},
                        {label:'GRR',        value:grr?.toFixed(1)+'%',   sub:grr>=80?'Stable':'At Risk',       subGood:grr>=80,      accent:grr>=80?'#4ADE80':'#F87171'},
                        {label:'Net Expansion', value:fmt(netExpansion),  sub:beg>0?fs(netExpansion/beg*100):null, subGood:netExpansion>=0, accent:'#CBD5E1'},
                        {label:'LTV Proxy',  value:beg>0?(nrr/(100-grr+0.01)).toFixed(1)+'x':'—', sub:'NRR / Churn Rate', subGood:true, accent:'#CBD5E1'},
                      ].map(k=>(
                        <div key={k.label} style={{background:'#0F1A2E',border:`1px solid #1E2D45`,borderTop:`2px solid ${k.accent}`,borderRadius:6,padding:'14px 16px'}}>
                          <div style={{fontSize:9,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.1em',color:'#4A5A6E',marginBottom:8}}>{k.label}</div>
                          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:22,fontWeight:700,color:k.accent,letterSpacing:'-0.02em'}}>{k.value}</div>
                          {k.sub&&<div style={{marginTop:4,fontSize:10,color:k.subGood?'#4ADE80':'#F87171'}}>{k.sub}</div>}
                        </div>
                      ))}
                    </div>

                    {/* ── Main content: Chart + Seasonality ──────────────── */}
                    <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:16}}>

                      {/* Retention Dynamics chart */}
                      <div style={{background:'#0F1A2E',border:'1px solid #1E2D45',borderRadius:6,padding:'18px 20px'}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                          <div>
                            <div style={{fontSize:14,fontWeight:700,color:'#E2E8F0'}}>Retention Dynamics</div>
                            <div style={{fontSize:11,color:'#4A5A6E',marginTop:2}}>NRR, GRR, Churn %, Expansion % over time</div>
                          </div>
                          <div style={{display:'flex',gap:4}}>
                            {windows.map(w=>(
                              <button key={w.label} onClick={()=>setChartWindow(w.n)}
                                style={{padding:'3px 10px',fontSize:10,fontWeight:chartWindow===w.n?700:400,borderRadius:4,border:`1px solid ${chartWindow===w.n?'#CBD5E1':'#1E2D45'}`,background:chartWindow===w.n?'#162035':'transparent',color:chartWindow===w.n?'#CBD5E1':'#4A5A6E',cursor:'pointer'}}>
                                {w.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div style={{height:240}}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{left:0,right:8,bottom:4,top:4}}>
                              <XAxis dataKey="period" tick={{fontSize:9,fill:'#6B7280'}} interval="preserveStartEnd" axisLine={false} tickLine={false}/>
                              <YAxis yAxisId="pct" tickFormatter={v=>`${v}%`} tick={{fontSize:9,fill:'#6B7280'}} width={42} axisLine={false} tickLine={false} domain={['dataMin - 5','dataMax + 5']}/>
                              <ReferenceLine yAxisId="pct" y={100} stroke="#253550" strokeDasharray="4 3"/>
                              <Tooltip
                                contentStyle={{background:'#0F1A2E',border:'1px solid #1E2D45',borderRadius:4,fontSize:11}}
                                labelStyle={{color:'#64748B',fontSize:10,marginBottom:4}}
                                formatter={(v,n)=>[v!=null?`${v.toFixed(1)}%`:'—',n]}/>
                              <Legend iconType="circle" iconSize={6} wrapperStyle={{fontSize:10,color:'#94A3B8',paddingTop:8}}/>
                              <Line yAxisId="pct" type="monotone" dataKey="nrr" stroke="#4ADE80" strokeWidth={2} dot={false} activeDot={{r:3}} name="NRR" connectNulls/>
                              <Line yAxisId="pct" type="monotone" dataKey="grr" stroke="#94A3B8" strokeWidth={1.5} dot={false} activeDot={{r:3}} name="GRR" connectNulls strokeDasharray="4 2"/>
                              <Line yAxisId="pct" type="monotone" dataKey="churnPct" stroke="#F87171" strokeWidth={1.5} dot={false} activeDot={{r:3}} name="Churn %" connectNulls/>
                              <Line yAxisId="pct" type="monotone" dataKey="expansionPct" stroke="#22C55E" strokeWidth={1.5} dot={false} activeDot={{r:3}} name="Expansion %" connectNulls strokeDasharray="2 2"/>
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        {/* Legend */}
                        <div style={{display:'flex',gap:16,justifyContent:'center',marginTop:8}}>
                          {[['NRR','#4ADE80'],['GRR','#94A3B8'],['Churn %','#F87171'],['Expansion %','#22C55E']].map(([lbl,col])=>(
                            <span key={lbl} style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:'#64748B'}}>
                              <span style={{width:14,height:2,background:col,borderRadius:2,display:'inline-block'}}/>
                              {lbl}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Seasonality + Insight panel */}
                      <div style={{display:'flex',flexDirection:'column',gap:12}}>
                        {/* Predictive insight */}
                        <div style={{background:'#0D1A2E',border:'1px solid #1E3A5A',borderRadius:6,padding:'14px 16px',flex:1}}>
                          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
                            <Sparkles size={11} color="#CBD5E1"/>
                            <span style={{fontSize:11,fontWeight:600,color:'#CBD5E1'}}>Predictive Insight</span>
                          </div>
                          {chartData.length>=3&&(()=>{
                            const recent = chartData.slice(-3).map(d=>d.nrr||0)
                            const trend  = recent[2]-recent[0]
                            const dir    = trend>0?'improved':'declined'
                            const proj   = (recent[2]||0) + trend*2
                            return (
                              <div style={{fontSize:12,color:'#94A3B8',lineHeight:1.7}}>
                                NRR has {dir} <strong style={{color:trend>0?'#4ADE80':'#F87171'}}>{Math.abs(trend).toFixed(1)} pts</strong> over {chartData.length} periods.
                                {trend>0&&proj>100&&<> At this rate, projected NRR: <strong style={{color:'#4ADE80'}}>{proj.toFixed(0)}%</strong>.</>}
                                {trend<=0&&<> Focus on expansion to reverse contraction trend.</>}
                              </div>
                            )
                          })()}
                          {chartData.length<3&&<div style={{fontSize:12,color:'#4A5A6E'}}>Need more periods for trend analysis.</div>}
                        </div>

                        {/* Seasonality */}
                        <div style={{background:'#0F1A2E',border:'1px solid #1E2D45',borderRadius:6,padding:'14px 16px'}}>
                          <div style={{fontSize:11,fontWeight:600,color:'#CBD5E1',marginBottom:12}}>Seasonality Impact</div>
                          {bestMon&&(
                            <div style={{marginBottom:10}}>
                              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:4}}>
                                <span style={{color:'#94A3B8'}}>{bestMon.mon} Expansion</span>
                                <span style={{color:'#4ADE80',fontWeight:600}}>+{bestMon.avg.toFixed(1)}%</span>
                              </div>
                              <div style={{height:4,background:'#1E2D45',borderRadius:2}}>
                                <div style={{height:'100%',background:'#4ADE80',borderRadius:2,width:`${Math.min(bestMon.avg*4,100)}%`}}/>
                              </div>
                            </div>
                          )}
                          {worstMon&&(
                            <div>
                              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:4}}>
                                <span style={{color:'#94A3B8'}}>{worstMon.mon} Risk</span>
                                <span style={{color:'#F87171',fontWeight:600}}>{worstMon.avg.toFixed(1)}%</span>
                              </div>
                              <div style={{height:4,background:'#1E2D45',borderRadius:2}}>
                                <div style={{height:'100%',background:'#F87171',borderRadius:2,width:`${Math.min(Math.abs(worstMon.avg)*4,100)}%`}}/>
                              </div>
                              <div style={{fontSize:10,color:'#3D5068',marginTop:6,lineHeight:1.5}}>
                                {worstMon.mon} historically shows lowest expansion. Plan campaigns accordingly.
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ── Monthly Growth Audit ────────────────────────────── */}
                    <div style={{background:'#0F1A2E',border:'1px solid #1E2D45',borderRadius:6,overflow:'hidden'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',borderBottom:'1px solid #1E2D45'}}>
                        <div>
                          <div style={{fontSize:14,fontWeight:700,color:'#E2E8F0'}}>Monthly Growth Audit</div>
                          <div style={{fontSize:11,color:'#4A5A6E',marginTop:2}}>Expansion = Upsell + Cross-sell · Contraction = Downsell + Churn · All figures from bridge classification</div>
                        </div>
                        {isAdmin&&<button onClick={downloadCSV} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,fontWeight:600,color:'#4ADE80',background:'transparent',border:'none',cursor:'pointer'}}><Download size={12}/> Export CSV</button>}
                      </div>
                      <div style={{overflowX:'auto'}}>
                        <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
                          <thead>
                            <tr style={{background:'#162035',borderBottom:'1px solid #1E2D45'}}>
                              {['Fiscal Month','Net Retention','Gross Retention','Expansion MRR','Contraction MRR','Momentum'].map((h,i)=>(
                                <th key={h} style={{padding:'10px 16px',textAlign:i===0?'left':'right',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'#4A5A6E',whiteSpace:'nowrap'}}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {auditRows.slice(0,24).map((row,i)=>{
                              const isSel = normalizePeriod(row.period)===normalizePeriod(selPeriod)
                              const momScore = row.nrr!=null?(row.nrr>=110?3:row.nrr>=100?2:1):0
                              const momColor = momScore===3?'#4ADE80':momScore===2?'#CBD5E1':'#F87171'
                              return (
                                <tr key={i} style={{borderBottom:'1px solid #1E2D45',background:isSel?'#162035':'transparent'}}
                                  onMouseEnter={e=>!isSel&&(e.currentTarget.style.background='#0D1525')}
                                  onMouseLeave={e=>!isSel&&(e.currentTarget.style.background='transparent')}>
                                  <td style={{padding:'11px 16px',fontWeight:isSel?700:500,color:isSel?'#E2E8F0':'#94A3B8',fontFamily:"'JetBrains Mono',monospace"}}>{row.period}</td>
                                  <td style={{padding:'11px 16px',textAlign:'right',fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:row.nrr>=100?'#4ADE80':row.nrr>=80?'#FCD34D':'#F87171'}}>{row.nrr!=null?row.nrr.toFixed(1)+'%':'—'}</td>
                                  <td style={{padding:'11px 16px',textAlign:'right',fontFamily:"'JetBrains Mono',monospace",fontWeight:600,color:row.grr>=80?'#4ADE80':'#F87171'}}>{row.grr!=null?row.grr.toFixed(1)+'%':'—'}</td>
                                  <td style={{padding:'11px 16px',textAlign:'right',fontFamily:"'JetBrains Mono',monospace",fontWeight:600,color:'#4ADE80'}}>{row.expansion>0?'+'+fmt(row.expansion):'—'}</td>
                                  <td style={{padding:'11px 16px',textAlign:'right',fontFamily:"'JetBrains Mono',monospace",fontWeight:600,color:'#F87171'}}>{row.contraction<0?fmt(row.contraction):'—'}</td>
                                  <td style={{padding:'11px 16px',textAlign:'right'}}>
                                    <span style={{display:'inline-flex',gap:2}}>
                                      {[1,2,3].map(n=><span key={n} style={{width:5,height:14,borderRadius:1,background:n<=momScore?momColor:'#1E2D45',display:'inline-block'}}/>)}
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
              })()}

              {!isCohort&&activeTab==='retention_trend'&&(
                <div style={{display:'flex',flexDirection:'column',gap:20}}>

                  {/* ── Monthly Bridge Table — columns = actual months ───── */}
                  {(()=>{
                    // Build monthly bridge matrix from by_period data
                    // Columns: last selLb months up to selPeriod (or latest)
                    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                    const allPeriods = effectiveByPeriod || []
                    if (!allPeriods.length) return null

                    // Parse 'Mon-YY' → sort key
                    const parseP = (s) => {
                      const [mon,yr] = (s||'').split('-')
                      const mi = MONTHS.indexOf(mon)
                      if (mi<0) return 0
                      const y = parseInt(yr,10); if(isNaN(y)||y<=0) return 0
                      return (y<50?2000+y:1900+y)*100+mi
                    }

                    // Sort all available periods chronologically
                    const sorted = [...allPeriods].sort((a,b)=>parseP(a._period)-parseP(b._period))

                    // Find index of selPeriod (or last)
                    const anchorIdx = selPeriod
                      ? sorted.findIndex(r=>normalizePeriod(r._period)===normalizePeriod(selPeriod))
                      : sorted.length - 1
                    const anchor = anchorIdx >= 0 ? anchorIdx : sorted.length - 1

                    // Take last selLb months ending at anchor
                    const start = Math.max(0, anchor - selLb + 1)
                    const window = sorted.slice(start, anchor + 1)
                    if (!window.length) return null

                    const colPeriods = window.map(r=>r._period)

                    // Determine which movement rows to show based on selDims
                    const movementRows = selDims==='customer'
                      ? ['New Logo','Upsell','Downsell','Churn']
                      : selDims==='region'
                      ? ['New Logo','Upsell','Downsell','Churn','Other In','Other Out']
                      : ['New Logo','Upsell','Cross-sell','Downsell','Churn Partial','Churn','Other In','Other Out']

                    const fmt2 = v => { if(!v) return '—'; const a=Math.abs(v); if(a>=1e6) return `${v<0?'':'+'}$${(v/1e6).toFixed(1)}M`; if(a>=1e3) return `${v<0?'':'+'}$${(v/1e3).toFixed(0)}K`; return `${v<0?'':'+'}$${v.toFixed(0)}` }

                    // Build lookup: period → row data
                    const lookup = {}
                    window.forEach(r => { lookup[r._period] = r })

                    return (
                      <div style={{...S.cardF}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 20px',borderBottom:'1px solid #1E2D45'}}>
                          <div>
                            <div style={{fontSize:13,fontWeight:700,color:'#E2E8F0',letterSpacing:'-0.01em'}}>Monthly ARR Bridge</div>
                            <div style={{fontSize:11,color:'#4A5A6E',marginTop:2}}>
                              {colPeriods[0]} → {colPeriods[colPeriods.length-1]} · {colPeriods.length} months · {selDims==='customer'?'Customer level':selDims==='product'?'Customer × Product':'Customer × Region'}
                            </div>
                          </div>
                          <div style={{fontSize:10,color:'#3D5068',fontWeight:500}}>
                            {selPeriod&&`Selected: ${selPeriod}`}
                          </div>
                        </div>
                        <div style={{overflowX:'auto'}}>
                          <table style={{borderCollapse:'collapse',minWidth:Math.max(colPeriods.length*90+180,560),fontSize:11}}>
                            <thead>
                              <tr style={{background:'#162035'}}>
                                <th style={{textAlign:'left',padding:'9px 16px',fontSize:9,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.08em',color:'#4A5A6E',whiteSpace:'nowrap',borderBottom:'1px solid #1E2D45',position:'sticky',left:0,background:'#162035',minWidth:160}}>Movement</th>
                                {colPeriods.map(p=>(
                                  <th key={p} style={{textAlign:'right',padding:'9px 12px',fontSize:9,fontWeight:normalizePeriod(p)===normalizePeriod(selPeriod)?700:500,letterSpacing:'0.06em',color:normalizePeriod(p)===normalizePeriod(selPeriod)?'#CBD5E1':'#4A5A6E',whiteSpace:'nowrap',borderBottom:'1px solid #1E2D45',background:p===selPeriod?'#1A2840':'#162035'}}>
                                    {p}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {movementRows.map((cat,ri)=>{
                                const hasAnyData = colPeriods.some(p=>lookup[p]?.[cat])
                                if(!hasAnyData) return null
                                return (
                                  <tr key={cat} style={{borderBottom:'1px solid #1E2D45',background:ri%2===0?'transparent':'#0D1525'}}>
                                    <td style={{padding:'8px 16px',position:'sticky',left:0,background:ri%2===0?'#0F1A2E':'#0D1525',display:'flex',alignItems:'center',gap:8,whiteSpace:'nowrap'}}>
                                      <span style={{width:6,height:6,borderRadius:'50%',background:BC[cat]||'#64748B',flexShrink:0}}/>
                                      <span style={{fontWeight:500,color:'#94A3B8'}}>{cat}</span>
                                    </td>
                                    {colPeriods.map(p=>{
                                      const v = lookup[p]?.[cat]
                                      const isPos = (v||0)>=0
                                      const isCurrentPeriod = normalizePeriod(p)===normalizePeriod(selPeriod)
                                      return (
                                        <td key={p} style={{textAlign:'right',padding:'8px 12px',fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:isCurrentPeriod?700:400,color:!v?'#2A3040':isPos?'#4ADE80':'#F87171',background:isCurrentPeriod?'rgba(26,40,64,0.6)':'transparent'}}>
                                          {v?fmt2(toARR(v)):'—'}
                                        </td>
                                      )
                                    })}
                                  </tr>
                                )
                              })}
                              {/* Net row */}
                              <tr style={{borderTop:'1px solid #253550',background:'#162035'}}>
                                <td style={{padding:'9px 16px',position:'sticky',left:0,background:'#162035',fontWeight:700,color:'#E2E8F0',fontSize:11}}>Net Change</td>
                                {colPeriods.map(p=>{
                                  const row = lookup[p]||{}
                                  const posSum = ['New Logo','Upsell','Cross-sell','Returning','Other In'].reduce((s,k)=>s+(Math.max(row[k]||0,0)),0)
                                  const negSum = ['Downsell','Churn Partial','Churn','Lapsed','Other Out'].reduce((s,k)=>s+(Math.min(row[k]||0,0)),0)
                                  const net = toARR(posSum+negSum)
                                  const isCurrentPeriod = normalizePeriod(p)===normalizePeriod(selPeriod)
                                  return (
                                    <td key={p} style={{textAlign:'right',padding:'9px 12px',fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:net>=0?'#4ADE80':'#F87171',background:isCurrentPeriod?'rgba(26,40,64,0.8)':'#162035'}}>
                                      {net?fmt2(net):'—'}
                                    </td>
                                  )
                                })}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })()}

                  {kpiRows.length>0?(
                    <>
                    {/* ── Continuous monthly ARR trend ──────────────────── */}
                    <div style={{...S.card}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                        <div style={{fontSize:14,fontWeight:700,color:'#E2E8F0',letterSpacing:'-0.01em'}}>ARR Trend — Monthly</div>
                        <div style={{fontSize:10,color:'#4A5A6E'}}>All available months · continuous</div>
                      </div>
                      <div style={{fontSize:11,color:'#64748B',marginBottom:16}}>Ending ARR each period</div>
                      <div style={{height:220}}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={kpiRowsWindowed} margin={{left:8,right:16,bottom:4}}>
                            <defs>
                              <linearGradient id="arrGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4ADE80" stopOpacity={0.08}/>
                                <stop offset="95%" stopColor="#4ADE80" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="period" tick={{fontSize:9,fill:'#6B7280'}}
                              interval={kpiRows.length>24?3:kpiRows.length>12?1:0}
                              axisLine={false} tickLine={false}/>
                            <YAxis tickFormatter={v=>fmt(v)} tick={{fontSize:9,fill:'#6B7280'}} width={52} axisLine={false} tickLine={false}/>
                            <Tooltip
                              formatter={(v,n)=>[fmt(v), n==='ending'?'Ending ARR':'Beginning ARR']}
                              contentStyle={{background:'#0F1A2E',border:'1px solid #1E2D45',borderRadius:4,fontSize:11,color:'#E2E8F0',boxShadow:'0 4px 12px rgba(0,0,0,0.4)'}}
                              labelStyle={{color:'#64748B',marginBottom:3,fontSize:10}}/>
                            <Area type="monotone" dataKey="ending" stroke="#4ADE80" strokeWidth={1.5}
                              fill="url(#arrGrad)" dot={false} activeDot={{r:3,fill:'#4ADE80',strokeWidth:0}} name="ending"/>
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* ── NRR / GRR continuous monthly trend ────────────── */}
                    <div style={{...S.card}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                        <div style={{fontSize:14,fontWeight:700,color:'#E2E8F0',letterSpacing:'-0.01em'}}>NRR & GRR — Monthly</div>
                        <div style={{display:'flex',gap:16,fontSize:10,color:'#4A5A6E'}}>
                          <span style={{display:'flex',alignItems:'center',gap:5}}>
                            <span style={{width:12,height:2,background:'#4ADE80',borderRadius:2,display:'inline-block'}}/>NRR
                          </span>
                          <span style={{display:'flex',alignItems:'center',gap:5}}>
                            <span style={{width:12,height:2,background:'#94A3B8',borderRadius:2,display:'inline-block'}}/>GRR
                          </span>
                        </div>
                      </div>
                      <div style={{fontSize:11,color:'#64748B',marginBottom:16}}>100% = flat retention baseline</div>
                      <div style={{height:220}}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={kpiRowsWindowed} margin={{left:8,right:16,bottom:4}}>
                            <XAxis dataKey="period" tick={{fontSize:9,fill:'#6B7280'}}
                              interval={kpiRows.length>24?3:kpiRows.length>12?1:0}
                              axisLine={false} tickLine={false}/>
                            <YAxis tickFormatter={v=>`${v.toFixed(0)}%`} tick={{fontSize:9,fill:'#6B7280'}}
                              domain={['dataMin - 5','dataMax + 5']} width={44} axisLine={false} tickLine={false}/>
                            <ReferenceLine y={100} stroke="#253550" strokeDasharray="4 4"
                              label={{value:'100%',position:'insideTopRight',fontSize:9,fill:'#3D5068'}}/>
                            <Tooltip
                              formatter={(v,n)=>[`${Number(v).toFixed(1)}%`, n]}
                              contentStyle={{background:'#0F1A2E',border:'1px solid #1E2D45',borderRadius:4,fontSize:11,color:'#E2E8F0',boxShadow:'0 4px 12px rgba(0,0,0,0.4)'}}
                              labelStyle={{color:'#64748B',marginBottom:3,fontSize:10}}/>
                            <Line type="monotone" dataKey="nrr" stroke="#4ADE80" strokeWidth={1.5}
                              dot={false} activeDot={{r:3,fill:"#4ADE80"}} name="NRR" connectNulls/>
                            <Line type="monotone" dataKey="grr" stroke="#94A3B8" strokeWidth={1.5}
                              dot={false} activeDot={{r:3,fill:"#94A3B8"}} name="GRR" connectNulls strokeDasharray="4 2"/>
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* ── Monthly data table ─────────────────────────────── */}
                    <div style={{...S.cardF}}>
                      <div style={{padding:'12px 20px',borderBottom:'1px solid #1E2D45'}}>
                        <div style={{fontSize:13,fontWeight:700,color:'#E2E8F0'}}>Monthly Detail</div>
                      </div>
                      <div style={{overflowX:'auto'}}>
                        <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
                          <thead><tr style={{background:'#162035'}}>
                            {['Period','Beg ARR','End ARR','New Logo','Upsell','Downsell','Churn','GRR','NRR'].map(h=>(
                              <th key={h} style={{padding:'9px 14px',textAlign:'left',fontSize:9,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.08em',color:'#4A5A6E',whiteSpace:'nowrap',borderBottom:'1px solid #1E2D45'}}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>{kpiRows.map((row,i)=>{
                            const isSelected = selPeriod && normalizePeriod(row.period) === normalizePeriod(selPeriod)
                            return (
                              <tr key={i} style={{borderBottom:'1px solid #1E2D45',background:isSelected?'#162035':'transparent'}}
                                onMouseEnter={e=>!isSelected&&(e.currentTarget.style.background='#111827')}
                                onMouseLeave={e=>!isSelected&&(e.currentTarget.style.background='transparent')}>
                                <td style={{padding:'8px 14px',fontWeight:isSelected?700:400,color:isSelected?'#E2E8F0':'#94A3B8',fontFamily:"'JetBrains Mono',monospace"}}>{row.period}</td>
                                <td style={{padding:'8px 14px',color:'#64748B',fontFamily:"'JetBrains Mono',monospace"}}>{fmt(toARR(row.beginning))}</td>
                                <td style={{padding:'8px 14px',color:'#94A3B8',fontFamily:"'JetBrains Mono',monospace"}}>{fmt(toARR(row.ending))}</td>
                                <td style={{padding:'8px 14px',color:'#4ADE80',fontWeight:500,fontFamily:"'JetBrains Mono',monospace"}}>{row.new_logo?`+${fmt(toARR(row.new_logo))}`:'—'}</td>
                                <td style={{padding:'8px 14px',color:'#4ADE80',fontWeight:500,fontFamily:"'JetBrains Mono',monospace"}}>{row.upsell?`+${fmt(toARR(row.upsell))}`:'—'}</td>
                                <td style={{padding:'8px 14px',color:'#F87171',fontWeight:500,fontFamily:"'JetBrains Mono',monospace"}}>{row.downsell?fmt(toARR(row.downsell)):'—'}</td>
                                <td style={{padding:'8px 14px',color:'#F87171',fontWeight:500,fontFamily:"'JetBrains Mono',monospace"}}>{row.churn?fmt(toARR(row.churn)):'—'}</td>
                                <td style={{padding:'8px 14px',fontWeight:600,fontFamily:"'JetBrains Mono',monospace",color:(row.grr||0)>=80?'#4ADE80':(row.grr||0)>=60?'#FCD34D':'#F87171'}}>{fmtPct(row.grr)}</td>
                                <td style={{padding:'8px 14px',fontWeight:600,fontFamily:"'JetBrains Mono',monospace",color:(row.nrr||0)>=100?'#4ADE80':(row.nrr||0)>=80?'#FCD34D':'#F87171'}}>{fmtPct(row.nrr)}</td>
                              </tr>
                            )
                          })}</tbody>
                        </table>
                      </div>
                    </div>
                    </>
                  ):(
                    <div style={{textAlign:'center',padding:'48px 24px',color:'#4A5A6E',fontSize:13}}>
                      No trend data available for the selected lookback and period type.
                    </div>
                  )}
                </div>
              )}

              {/* COHORT HEATMAP TAB — embedded inside MRR/ARR Analytics */}
              {!isCohort&&activeTab==='cohort_heatmap'&&(
                <div style={{display:'flex',flexDirection:'column',gap:20}}>
                  {/* Context explanation */}
                  <div style={{padding:'12px 16px',background:'#0F1A2E',border:'1px solid #1E2D45',borderRadius:6,display:'flex',alignItems:'flex-start',gap:10}}>
                    <Info size={13} color="#64748B" style={{flexShrink:0,marginTop:1}}/>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:'#CBD5E1',marginBottom:3}}>Cohort Retention Heatmap</div>
                      <div style={{fontSize:11,color:'#64748B',lineHeight:1.5}}>
                        Shows customer retention rates by acquisition cohort. Uses the same data file and field mapping already configured. Customer, Date and Revenue columns are required.
                      </div>
                    </div>
                  </div>

                  {/* Run state / results */}
                  {!cohortResults&&!cohortRunning&&(
                    <div style={{textAlign:'center',padding:'48px 24px'}}>
                      <div style={{width:56,height:56,borderRadius:12,border:'1px solid #1E2D45',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
                        <Layers size={24} color="#3D5068"/>
                      </div>
                      <div style={{fontSize:15,fontWeight:600,color:'#CBD5E1',marginBottom:6}}>Build Retention Heatmap</div>
                      <div style={{fontSize:12,color:'#64748B',marginBottom:20,maxWidth:360,margin:'0 auto 20px'}}>
                        Analyse cohort retention using your existing data. This runs a separate cohort pass on the same file.
                      </div>
                      {cohortErr&&<div style={{marginBottom:16,padding:'10px 14px',background:'#1A0A0A',border:'1px solid #3A1A1A',borderRadius:6,fontSize:11,color:'#F87171'}}>{cohortErr}</div>}
                      <button onClick={runInlineCohort} style={{
                        padding:'10px 28px',borderRadius:6,border:'1px solid #2D5A3D',
                        background:'#1A3A2A',color:'#4ADE80',fontSize:13,fontWeight:600,cursor:'pointer',
                      }}>
                        Run Cohort Analysis
                      </button>
                    </div>
                  )}

                  {cohortRunning&&(
                    <div style={{textAlign:'center',padding:'48px 24px'}}>
                      <Loader2 size={24} color="#64748B" style={{animation:'spin 1s linear infinite',margin:'0 auto 12px',display:'block'}}/>
                      <div style={{fontSize:12,color:'#64748B'}}>Running cohort analysis…</div>
                    </div>
                  )}

                  {cohortResults&&!cohortRunning&&(
                    <div style={{display:'flex',flexDirection:'column',gap:16}}>

                      {/* Header: metadata + view toggle + re-run */}
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <div style={{fontSize:11,color:'#64748B'}}>
                          {cohortResults.retention?.length||0} cohorts · {cohortResults.retention?.[0] ? Object.keys(cohortResults.retention[0]).filter(k=>k!=='cohort').length : 0} periods
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          {/* View toggle */}
                          <div style={{display:'flex',background:'#0B1220',borderRadius:5,border:'1px solid #1E2D45',overflow:'hidden',height:28}}>
                            {[['pct','Retention %'],['arr','Revenue $'],['per_cust','$ / Customer']].map(([v,l])=>(
                              <button key={v} onClick={()=>setCohortView(v)} style={{
                                padding:'0 10px',height:28,fontSize:10,fontWeight:cohortView===v?600:400,border:'none',
                                cursor:'pointer',background:cohortView===v?'#162035':'transparent',
                                color:cohortView===v?'#CBD5E1':'#4A5A6E',whiteSpace:'nowrap',
                              }}>{l}</button>
                            ))}
                          </div>
                          <button onClick={()=>setCohortResults(null)}
                            style={{height:28,padding:'0 10px',fontSize:11,color:'#4A5A6E',background:'transparent',border:'1px solid #1E2D45',borderRadius:5,cursor:'pointer'}}>
                            ↺ Re-run
                          </button>
                        </div>
                      </div>

                      {/* Retention % view */}
                      {cohortView==='pct'&&cohortResults.retention?.length>0&&(
                        <div style={{...S.card}}>
                          <div style={{fontSize:13,fontWeight:700,color:'#E2E8F0',marginBottom:4}}>Retention Rate %</div>
                          <div style={{fontSize:11,color:'#64748B',marginBottom:16}}>% of original cohort ARR retained each period</div>
                          <CohortHeatmap data={cohortResults.retention} title="" isPercent={true}/>
                        </div>
                      )}

                      {/* Revenue $ view — use revenue heatmap data if available */}
                      {cohortView==='arr'&&(
                        <div style={{...S.card}}>
                          <div style={{fontSize:13,fontWeight:700,color:'#E2E8F0',marginBottom:4}}>Revenue by Cohort ($)</div>
                          <div style={{fontSize:11,color:'#64748B',marginBottom:16}}>Absolute revenue retained per cohort each period</div>
                          {cohortResults.heatmap?.length>0
                            ? <CohortHeatmap data={cohortResults.heatmap} title="" isPercent={false}/>
                            : <div style={{textAlign:'center',color:'#4A5A6E',padding:'32px 0',fontSize:12}}>Revenue cohort data not available. Re-run with revenue metric mapped.</div>
                          }
                        </div>
                      )}

                      {/* $ per customer view — derived from revenue / heatmap */}
                      {cohortView==='per_cust'&&(
                        <div style={{...S.card}}>
                          <div style={{fontSize:13,fontWeight:700,color:'#E2E8F0',marginBottom:4}}>Revenue per Customer</div>
                          <div style={{fontSize:11,color:'#64748B',marginBottom:16}}>Average ARR per retained customer each period</div>
                          {(()=>{
                            if (!cohortResults.retention?.length || !cohortResults.heatmap?.length) {
                              return <div style={{textAlign:'center',color:'#4A5A6E',padding:'32px 0',fontSize:12}}>Requires both retention % and revenue data.</div>
                            }
                            // Compute per-customer: revenue[row][col] / (retention%[row][col]/100 * cohortSize)
                            // We approximate: revenue heatmap values are already per-cohort totals
                            // Per customer = revenue_cell / (retention_pct * initial_customers / 100)
                            const perCustData = cohortResults.heatmap.map((revRow, ri) => {
                              const retRow = cohortResults.retention[ri]
                              if (!retRow) return revRow
                              const result = {cohort: revRow.cohort}
                              Object.keys(revRow).filter(k=>k!=='cohort').forEach(k => {
                                const rev = revRow[k]||0
                                const ret = retRow[k]||0
                                result[k] = ret > 0 ? Math.round(rev / (ret/100)) : 0
                              })
                              return result
                            })
                            return <CohortHeatmap data={perCustData} title="" isPercent={false}/>
                          })()}
                        </div>
                      )}

                      {/* Period summary table — always visible */}
                      {cohortResults.fy_summary?.length>0&&(
                        <div style={{...S.cardF}}>
                          <div style={{padding:'12px 20px',borderBottom:'1px solid #1E2D45'}}>
                            <div style={{fontSize:13,fontWeight:700,color:'#E2E8F0'}}>Period Summary</div>
                          </div>
                          <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
                            <thead><tr style={{background:'#162035'}}>
                              {['Period','Revenue','Customers','Rev / Customer'].map(h=>(
                                <th key={h} style={{textAlign:'left',padding:'9px 14px',fontSize:9,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.08em',color:'#4A5A6E',borderBottom:'1px solid #1E2D45'}}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>{cohortResults.fy_summary.map((row,i)=>(
                              <tr key={i} style={{borderBottom:'1px solid #1E2D45'}}>
                                <td style={{padding:'9px 14px',fontWeight:600,color:'#E2E8F0'}}>{String(Object.values(row)[0])}</td>
                                <td style={{padding:'9px 14px',color:'#4ADE80',fontFamily:"'JetBrains Mono',monospace"}}>{fmt(toARR(row.revenue))}</td>
                                <td style={{padding:'9px 14px',color:'#94A3B8',fontFamily:"'JetBrains Mono',monospace"}}>{(row.customers||0).toLocaleString()}</td>
                                <td style={{padding:'9px 14px',color:'#94A3B8',fontFamily:"'JetBrains Mono',monospace"}}>{fmt(toARR(row.rev_per_customer))}</td>
                              </tr>
                            ))}</tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* MRR: TOP MOVERS — hero two-column layout */}
              {!isCohort&&activeTab==='top_movers'&&(
                <div style={{display:'flex',flexDirection:'column',gap:20}}>

                  {/* ── Movers context bar ──────────────────────────────── */}
                  <div style={{display:'flex',alignItems:'center',gap:20,padding:'10px 16px',background:'#0F1A2E',border:'1px solid #1E2D45',borderRadius:6}}>
                    <div>
                      <span style={{fontSize:9,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.08em',color:'#4A5A6E'}}>Expansion</span>
                      <span style={{fontSize:14,fontWeight:700,color:'#4ADE80',fontFamily:"'JetBrains Mono',monospace",marginLeft:8}}>
                        +{fmt(expansionList.reduce((s,r)=>s+Math.abs(getMoverValue(r,r._cat||moverCat)||0),0))}
                      </span>
                      <span style={{fontSize:11,color:'#4A5A6E',marginLeft:4}}>({expansionList.length} accounts)</span>
                    </div>
                    <div style={{width:1,height:16,background:'#253550'}}/>
                    <div>
                      <span style={{fontSize:9,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.08em',color:'#4A5A6E'}}>Churn risk</span>
                      <span style={{fontSize:14,fontWeight:700,color:'#F87171',fontFamily:"'JetBrains Mono',monospace",marginLeft:8}}>
                        -{fmt(churnList.reduce((s,r)=>s+Math.abs(getMoverValue(r,r._cat||moverCat)||0),0))}
                      </span>
                      <span style={{fontSize:11,color:'#4A5A6E',marginLeft:4}}>({churnList.length} accounts)</span>
                    </div>
                    <div style={{marginLeft:'auto',fontSize:11,color:'#4A5A6E'}}>{periodType==='Annual'?'YoY':'QoQ'} · {selLb}M · {selPeriod||'—'}</div>
                  </div>

                  {/* ── Two-column: Expansion | Churn Risk ─────────────── */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>

                    {/* Expansion Opportunities */}
                    <div style={{background:'#0F1A2E',border:'1px solid #1E2D45',borderRadius:8,boxShadow:'0 1px 3px rgba(0,0,0,0.07)',overflow:'hidden'}}>
                      {/* Panel header */}
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',borderBottom:'1px solid #1E2D45',background:'#162035'}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div style={{width:28,height:28,borderRadius:6,background:'rgba(22,163,74,0.08)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                            <TrendingUp size={13} color="#16A34A"/>
                          </div>
                          <div>
                            <div style={{fontSize:13,fontWeight:700,color:'#16A34A'}}>Expansion Opportunities</div>
                            <div style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.08em',color:'#7B8EA8'}}>High upsell potential</div>
                          </div>
                        </div>
                        <span style={{fontSize:11,fontWeight:700,background:'rgba(22,163,74,0.08)',color:'#16A34A',border:'1px solid #9CA3AF',padding:'3px 10px',borderRadius:20}}>
                          {expansionList.length} accounts
                        </span>
                      </div>
                      {/* Cards */}
                      <div style={{padding:12,maxHeight:520,overflowY:'auto'}}>
                        {expansionList.length
                          ? expansionList.map((row,i)=>{
                              const cat=row._cat||moverCat
                              const val=getMoverValue(row,cat)
                              const cust=getMoverCustomer(row)
                              const per=getMoverPeriod(row)
                              return (
                                <MoverCard key={i}
                                  customer={cust}
                                  value={val}
                                  period={per}
                                  isRisk={false}
                                  rank={i}
                                  arr={row.arr||row.ending_arr||row['Ending ARR']||Math.abs(val)*6}
                                  health={row.health}
                                  segment={row.segment||row.channel||row.Channel}
                                  region={row.region||row.Region}
                                  product={row.product||row.Product||row['Product Name']}
                                  endingArr={customerArrMap[cust]?.endingArr??row.ending_arr??null}
                                  beginningArr={customerArrMap[cust]?.beginningArr??row.beginning_arr??(ret?.beginning>0?ret.beginning:null)}
                                  endingArr={customerArrMap[cust]?.endingArr??row.ending_arr??null}
                                  beginningArr={customerArrMap[cust]?.beginningArr??row.beginning_arr??(ret?.beginning>0?ret.beginning:null)}
                                />
                              )})
                          : <div style={{textAlign:'center',color:'#7B8EA8',fontSize:13,padding:32}}>No expansion data for selected lookback</div>
                        }
                      </div>
                      {expansionList.length>0&&(
                        <div style={{padding:'10px 16px',borderTop:'1px solid #1E2D45',textAlign:'center'}}>
                          <span style={{fontSize:11,fontWeight:600,color:'#4ADE80',cursor:'pointer'}}>View all {expansionList.length} opportunities →</span>
                        </div>
                      )}
                    </div>

                    {/* Churn Risk */}
                    <div style={{background:'#0F1A2E',border:'1px solid #1E2D45',borderRadius:8,boxShadow:'0 1px 3px rgba(0,0,0,0.07)',overflow:'hidden'}}>
                      {/* Panel header */}
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',borderBottom:'1px solid #1E2D45',background:'#162035'}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div style={{width:28,height:28,borderRadius:6,background:'rgba(220,38,38,0.06)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                            <TrendingDown size={13} color="#DC2626"/>
                          </div>
                          <div>
                            <div style={{fontSize:13,fontWeight:600,color:'#F87171'}}>Churn Risk</div>
                            <div style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.08em',color:'#7B8EA8'}}>Priority interventions</div>
                          </div>
                        </div>
                        <span style={{fontSize:11,fontWeight:700,background:'rgba(220,38,38,0.06)',color:'#DC2626',border:'1px solid #9CA3AF',padding:'3px 10px',borderRadius:20}}>
                          {churnList.length} accounts
                        </span>
                      </div>
                      {/* Cards */}
                      <div style={{padding:12,maxHeight:520,overflowY:'auto'}}>
                        {churnList.length
                          ? churnList.map((row,i)=>{
                              const cat=row._cat||moverCat
                              const val=getMoverValue(row,cat)
                              const cust=getMoverCustomer(row)
                              const per=getMoverPeriod(row)
                              return (
                                <MoverCard key={i}
                                  customer={cust}
                                  value={val}
                                  period={per}
                                  isRisk={true}
                                  rank={i}
                                  arr={row.arr||row.ending_arr||row['Ending ARR']||Math.abs(val)*6}
                                  health={row.health}
                                  segment={row.segment||row.channel||row.Channel}
                                  region={row.region||row.Region}
                                  product={row.product||row.Product||row['Product Name']}
                                  endingArr={customerArrMap[cust]?.endingArr??row.ending_arr??null}
                                  beginningArr={customerArrMap[cust]?.beginningArr??row.beginning_arr??(ret?.beginning>0?ret.beginning:null)}
                                  endingArr={customerArrMap[cust]?.endingArr??row.ending_arr??null}
                                  beginningArr={customerArrMap[cust]?.beginningArr??row.beginning_arr??(ret?.beginning>0?ret.beginning:null)}
                                />
                              )})
                          : <div style={{textAlign:'center',color:'#7B8EA8',fontSize:13,padding:32}}>No churn data for selected lookback</div>
                        }
                      </div>
                      {churnList.length>0&&(
                        <div style={{padding:'10px 16px',borderTop:'1px solid #1E2D45',textAlign:'center'}}>
                          <span style={{fontSize:11,fontWeight:600,color:'#DC2626',cursor:'pointer'}}>View all {churnList.length} at-risk accounts →</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── All movers by category ────────────────────────── */}
                  {Object.keys(moversForPeriod).length>0&&(
                    <div style={{background:'#0F1A2E',border:'1px solid #1E2D45',borderRadius:8,boxShadow:'0 1px 3px rgba(0,0,0,0.07)',overflow:'hidden'}}>
                      {/* Category tabs */}
                      <div style={{display:'flex',alignItems:'center',gap:4,padding:'12px 16px',borderBottom:'1px solid #1E2D45',flexWrap:'wrap',background:'#0D1525'}}>
                        <span style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.08em',color:'#7B8EA8',marginRight:8}}>Filter:</span>
                        {Object.keys(moversForPeriod).map(cat=>(
                          <button key={cat} onClick={()=>setMoverCat(cat)} style={{
                            display:'flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:20,fontSize:11,fontWeight:600,
                            border:`1px solid ${moverCat===cat?'rgba(37,99,235,0.25)':'#E5E7EB'}`,
                            background:moverCat===cat?'rgba(37,99,235,0.08)':'transparent',
                            color:moverCat===cat?'#2563EB':'#6B7280',cursor:'pointer',transition:'all 0.12s',
                          }}>
                            <span style={{width:6,height:6,borderRadius:'50%',background:BC[cat]||'#6B7280',flexShrink:0}}/>
                            {cat}
                            <span style={{fontSize:9,background:'#162035',color:'#7B8EA8',padding:'1px 5px',borderRadius:10}}>{(moversForPeriod[cat]||[]).length}</span>
                          </button>
                        ))}
                      </div>
                      {/* Table */}
                      {moverCat&&moversForPeriod[moverCat]?.length>0&&(
                        <div style={{overflowX:'auto'}}>
                          <table style={{borderCollapse:'collapse',width:'100%',fontSize:13}}>
                            <thead>
                              <tr style={{background:'#162035',borderBottom:'2px solid #E5E7EB'}}>
                                {Object.keys(moversForPeriod[moverCat][0]).filter(k=>k!=='value'&&k!=='period'&&k!=='health'&&k!=='segment').map(k=>(
                                  <th key={k} style={{textAlign:'left',padding:'10px 16px',fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'#7B8EA8',whiteSpace:'nowrap'}}>{k}</th>
                                ))}
                                <th style={{textAlign:'right',padding:'10px 16px',fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'#7B8EA8'}}>Period</th>
                                <th style={{textAlign:'right',padding:'10px 16px',fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'#7B8EA8'}}>ARR Impact</th>
                              </tr>
                            </thead>
                            <tbody>
                              {moversForPeriod[moverCat].slice(0,30).map((row,i)=>(
                                <tr key={i} style={{borderBottom:'1px solid #1E2D45',transition:'background 0.1s'}}
                                  onMouseEnter={e=>e.currentTarget.style.background='#111827'}
                                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                  {Object.keys(row).filter(k=>k!=='value'&&k!=='period'&&k!=='health'&&k!=='segment').map(k=>(
                                    <td key={k} style={{padding:'10px 16px',color:'#FFFFFF',fontSize:13}}>{row[k]??'—'}</td>
                                  ))}
                                  <td style={{textAlign:'right',padding:'10px 16px',color:'#7B8EA8',fontSize:12,fontFamily:"'JetBrains Mono',monospace"}}>{row.period||'—'}</td>
                                  <td style={{textAlign:'right',padding:'10px 16px',fontWeight:700,fontSize:13,fontFamily:"'JetBrains Mono',monospace",color:getMoverValue(row,moverCat)>=0?'#16A34A':'#DC2626'}}>
                                    {getMoverValue(row,moverCat)>=0?'+':''}{fmt(getMoverValue(row,moverCat))}
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

                            {/* MRR: TOP CUSTOMERS */}
              {!isCohort&&activeTab==='top_customers'&&(
                <div style={{background:'#0F1A2E',border:'1px solid #1E2D45',borderRadius:8,padding:0,overflow:'hidden'}}>
                  <div style={{padding:'14px 20px',borderBottom:'1px solid #1E2D45'}}><div style={{...S.label}}>Top Customers by Ending ARR</div></div>
                  {topCustsForPeriod.length>0?(
                    <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
                      <thead><tr style={{borderBottom:'1px solid #1E2D45'}}>
                        <th style={{textAlign:'left',padding:'10px 20px',fontSize:9,fontWeight:700,textTransform:'uppercase',color:'#7B8EA8'}}>#</th>
                        {Object.keys(topCustsForPeriod[0]).map(k=><th key={k} style={{textAlign:'left',padding:'10px 20px',fontSize:9,fontWeight:700,textTransform:'uppercase',color:'#7B8EA8'}}>{k}</th>)}
                      </tr></thead>
                      <tbody>{topCustsForPeriod.map((row,i)=>(
                        <tr key={i} style={{borderBottom:'1px solid #1E2D45'}}>
                          <td style={{padding:'10px 20px',color:'#7B8EA8',fontWeight:600,fontSize:11}}>#{i+1}</td>
                          {Object.values(row).map((val,j)=>(
                            <td key={j} style={{padding:'10px 20px',color:typeof val==='number'?'white':'#6B7280',fontWeight:typeof val==='number'?700:400,fontFamily:typeof val==='number'?'DM Mono,monospace':'inherit'}}>
                              {typeof val==='number'?fmt(val):val??'—'}
                            </td>
                          ))}
                        </tr>
                      ))}</tbody>
                    </table>
                  ):<div style={{padding:40,textAlign:'center',color:'#7B8EA8',fontSize:13}}>No customer data available.</div>}
                </div>
              )}

              {/* MRR: KPI MATRIX */}
              {!isCohort&&activeTab==='kpi_matrix'&&(
                <div style={{display:'flex',flexDirection:'column',gap:20}}>
                  {lookbacks.map(lb=>{
                    const kpiData=results?.pivot?.[String(lb)]?.kpi_table
                    if(!kpiData?.length) return null
                    return (
                      <div key={lb} style={{...S.card}}>
                        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
                          <div style={{...S.label}}>KPI Summary</div>
                          <span style={{fontSize:9,background:'transparent',color:'#3D5068',border:'none',padding:'2px 0',fontWeight:400}}>{lb}M Lookback</span>
                        </div>
                        <KpiSummaryTable rows={kpiData}/>
                      </div>
                    )
                  })}
                  {!results?.pivot&&kpiRows.length>0&&(
                    <div style={{background:'#0F1A2E',border:'1px solid #1E2D45',borderRadius:8,padding:0,overflow:'hidden'}}>
                      <div style={{padding:'14px 20px',borderBottom:'1px solid #1E2D45'}}><div style={{...S.label}}>KPI Matrix — {periodType}</div></div>
                      <div style={{overflowX:'auto'}}>
                        <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
                          <thead><tr style={{borderBottom:'1px solid #1E2D45'}}>
                            {['Period','Beginning ARR','Ending ARR','New Logo','Upsell','Downsell','Churn','GRR','NRR'].map(h=>(
                              <th key={h} style={{padding:'10px 16px',textAlign:'left',fontSize:9,fontWeight:700,textTransform:'uppercase',color:'#7B8EA8',whiteSpace:'nowrap'}}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>{kpiRows.map((row,i)=>(
                            <tr key={i} style={{borderBottom:'1px solid #1E2D45'}}>
                              <td style={{padding:'8px 16px',fontWeight:700,color:'#FFFFFF',fontFamily:"'JetBrains Mono',monospace"}}>{row.period}</td>
                              <td style={{padding:'8px 16px',color:'#7B8EA8',fontFamily:"'JetBrains Mono',monospace"}}>{fmt(row.beginning)}</td>
                              <td style={{padding:'8px 16px',color:'#7B8EA8',fontFamily:"'JetBrains Mono',monospace"}}>{fmt(row.ending)}</td>
                              <td style={{padding:'8px 16px',color:'#16A34A',fontWeight:600,fontFamily:"'JetBrains Mono',monospace"}}>{row.new_logo?`+${fmt(row.new_logo)}`:'—'}</td>
                              <td style={{padding:'8px 16px',color:'#4ADE80',fontWeight:600,fontFamily:"'JetBrains Mono',monospace"}}>{row.upsell?`+${fmt(row.upsell)}`:'—'}</td>
                              <td style={{padding:'8px 16px',color:'#7B8EA8',fontWeight:600,fontFamily:"'JetBrains Mono',monospace"}}>{row.downsell?fmt(row.downsell):'—'}</td>
                              <td style={{padding:'8px 16px',color:'#DC2626',fontWeight:600,fontFamily:"'JetBrains Mono',monospace"}}>{row.churn?fmt(row.churn):'—'}</td>
                              <td style={{padding:'8px 16px',fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:(row.grr||0)>=80?'#16A34A':'#DC2626'}}>{fmtPct(row.grr)}</td>
                              <td style={{padding:'8px 16px',fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:(row.nrr||0)>=100?'#16A34A':'#6B7280'}}>{fmtPct(row.nrr)}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* OUTPUT TABLE */}
              {activeTab==='output'&&(
                <div style={{background:'#0F1A2E',border:'1px solid #1E2D45',borderRadius:8,padding:0,overflow:'hidden'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',borderBottom:'1px solid #1E2D45'}}>
                    <div style={{...S.label}}>Output — {results.output?.length?.toLocaleString()} rows</div>
                    {isAdmin?(
                      <button onClick={downloadCSV} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,fontWeight:700,padding:'6px 14px',borderRadius:10,border:'none',cursor:'pointer',background:'#1A3A2A',color:'#FFFFFF'}}>
                        <Download size={11}/> Export CSV
                      </button>
                    ):(
                      <button onClick={()=>router.push('/dashboard/upgrade')} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,fontWeight:600,color:'#7B8EA8',background:'#E5E7EB',border:'none',padding:'6px 14px',borderRadius:10,cursor:'pointer'}}>
                        <Lock size={11}/> Upgrade to Export
                      </button>
                    )}
                  </div>
                  {results.output?.length>0?(
                    <div style={{overflowX:'auto',maxHeight:500,overflowY:'auto'}}>
                      <table style={{borderCollapse:'collapse',width:'100%',fontSize:11}}>
                        <thead style={{position:'sticky',top:0,background:'#0F1A2E',zIndex:1}}>
                          <tr style={{borderBottom:'1px solid #1E2D45'}}>
                            {Object.keys(results.output[0]).map(col=>(
                              <th key={col} style={{textAlign:'left',padding:'10px 14px',fontSize:9,fontWeight:700,textTransform:'uppercase',color:'#7B8EA8',whiteSpace:'nowrap',background:'#162035'}}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>{results.output.slice(0,200).map((row,i)=>(
                          <tr key={i} style={{borderBottom:'1px solid #1E2D45'}}>
                            {Object.values(row).map((val,j)=>(
                              <td key={j} style={{padding:'7px 14px',color:'#7B8EA8',whiteSpace:'nowrap',fontFamily:typeof val==='number'?'DM Mono,monospace':'inherit'}}>{val??'—'}</td>
                            ))}
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  ):<div style={{padding:40,textAlign:'center',color:'#7B8EA8',fontSize:13}}>No output data available.</div>}
                </div>
              )}

            </div>{/* end tab content */}
          </div>
        )}
      </main>
    </div>
  )
}
