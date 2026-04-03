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
  if (new_arr>0) s += ` New logos contributed ${fmt(new_arr)}.`
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
function WaterfallBridge({data, showBoundary=false}) {
  if(!data?.length) return <div style={{height:180,display:'flex',alignItems:'center',justifyContent:'center',color:'#7B8EA8',fontSize:13}}>No bridge data</div>

  const BOUNDARY = new Set(['Beginning ARR','Ending ARR','Beginning MRR','Ending MRR','Prior ACV','Ending ACV'])
  const ORDER=['Beginning ARR','Beginning MRR','New Logo','Upsell','Cross-sell','Returning','Other In','Downsell','Churn Partial','Churn','Lapsed','Other Out','Ending ARR','Ending MRR']
  const rows = showBoundary
    ? [...data].sort((a,b)=>{ const ai=ORDER.indexOf(a.category); const bi=ORDER.indexOf(b.category); return (ai<0?99:ai)-(bi<0?99:bi) })
    : data.filter(d=>!BOUNDARY.has(d.category) && d.value!==0)

  const CustomTooltip=({active,payload})=>{
    if(!active||!payload?.length) return null
    const d=payload[0].payload
    const isBound=BOUNDARY.has(d.category)
    return (
      <div style={{background:'#0F1A2E',border:'1px solid var(--color-border)',borderRadius:8,padding:'8px 12px'}}>
        <div style={{fontSize:11,fontWeight:600,color:'#7B8EA8',marginBottom:3}}>{d.category}</div>
        <div style={{fontSize:15,fontWeight:700,color:isBound?'#6B7280':d.value>=0?'#16A34A':'#DC2626',fontFamily:"'JetBrains Mono',monospace"}}>
          {isBound?'':d.value>=0?'+':''}{fmt(d.value)}
        </div>
      </div>
    )
  }
  const getColor=(cat,val)=>BOUNDARY.has(cat)?'#9CA3AF':BC[cat]||(val>=0?'#22C55E':'#EF4444')

  return (
    <div style={{height:260}}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{top:8,right:8,bottom:48,left:8}}>
          <XAxis dataKey="category" tick={{fontSize:9,fill:'#9CA3AF'}} angle={-35} textAnchor="end" interval={0} axisLine={false} tickLine={false}/>
          <YAxis tickFormatter={fmt} tick={{fontSize:9,fill:'#9CA3AF'}} width={48} axisLine={false} tickLine={false}/>
          <ReferenceLine y={0} stroke='#1A2840' strokeDasharray='3 3'/>
          <Tooltip content={<CustomTooltip/>} cursor={{fill:'rgba(255,255,255,0.02)'}}/>
          <Bar dataKey="value" radius={[3,3,0,0]} maxBarSize={36}>
            {rows.map((e,i)=><Cell key={i} fill={getColor(e.category,e.value)}/>)}
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
    return row?.Period || row?.period || ''
  }

  // ── Available periods — actual data months only, chronological, no synthetic fill
  // Reads _period strings from ALL lookback buckets, validates format, sorts chronologically.
  // Format enforced: 'Mon-YY' e.g. 'Jan-22', 'Dec-25'. Invalid entries are discarded.
  const availablePeriods = useMemo(() => {
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const raw = new Set()

    // Collect all real _period values from every lookback window
    if (results?.bridge) {
      Object.values(results.bridge).forEach(b => {
        if (b?.by_period) {
          b.by_period.forEach(r => {
            const p = r?._period
            if (typeof p === 'string' && p.trim() && p.includes('-')) raw.add(p.trim())
          })
        }
      })
    }
    if (raw.size === 0) return []

    // Strict parser: 'Mon-YY' → {valid, sortKey}
    const parse = (s) => {
      const parts = (s||'').split('-')
      if (parts.length !== 2) return null
      const [mon, yr] = parts
      const mi = MONTHS.indexOf(mon)
      if (mi < 0) return null                         // not a real month name
      const yrNum = parseInt(yr, 10)
      if (isNaN(yrNum) || yrNum <= 0) return null     // catches 'Jan-0', 'Jan-NaN'
      const fullYr = yrNum < 50 ? 2000 + yrNum : 1900 + yrNum
      if (fullYr < 2000 || fullYr > 2099) return null  // sanity range
      return fullYr * 100 + mi
    }

    // Filter to only valid, real period strings
    const valid = Array.from(raw).filter(p => parse(p) !== null)
    if (valid.length === 0) return []

    // Sort chronologically
    return valid.sort((a, b) => parse(a) - parse(b))
  }, [results])

  // Filtered by_period data based on selPeriod
  const filteredByPeriod = useMemo(() => {
    if (!bdg?.by_period?.length) return []
    if (!selPeriod) return bdg.by_period
    return bdg.by_period.filter(r => r._period === selPeriod)
  }, [bdg, selPeriod])

  // kpiRowsWindowed — trend charts show last selLb months ending at selPeriod
  // This ensures Lookback control drives trend chart window too
  const kpiRowsWindowed = useMemo(() => {
    if (!kpiRows.length) return kpiRows
    if (!selPeriod && !selLb) return kpiRows

    // Find anchor index (selPeriod position in kpiRows)
    const anchorIdx = selPeriod
      ? kpiRows.findIndex(r => r.period === selPeriod)
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
    'New Logo', 'Upsell', 'Downsell', 'Churn'
  ])
  const PRODUCT_LEVEL_CATS = new Set([
    'New Logo', 'Upsell', 'Cross-sell', 'Downsell', 'Churn Partial', 'Churn-Partial', 'Churn',
    'Other In', 'Other Out', 'Returning', 'Lapsed', 'Add on', 'Add-on'
  ])
  const REGION_LEVEL_CATS = new Set([
    'New Logo', 'Upsell', 'Downsell', 'Churn', 'Other In', 'Other Out'
  ])

  // Canonical display order for waterfall — always enforced regardless of API order
  const CANONICAL_ORDER = [
    'Beginning ARR', 'Beginning MRR',
    'New Logo', 'Upsell', 'Cross-sell', 'Returning', 'Add on', 'Add-on', 'Other In',
    'Downsell', 'Churn Partial', 'Churn-Partial', 'Churn', 'Lapsed', 'Other Out',
    'Ending ARR', 'Ending MRR'
  ]

  function filterByDimension(wfallData) {
    if (!wfallData?.length) return []
    // Always strip price/volume — they never belong in the bridge
    const noPV = wfallData.filter(r => !PRICE_VOLUME_CATS.has(r.category))
    if (selDims === 'customer') {
      // Customer level: only the 4 canonical movements
      return noPV.filter(r => CUSTOMER_LEVEL_CATS.has(r.category))
    }
    if (selDims === 'region') {
      return noPV.filter(r => REGION_LEVEL_CATS.has(r.category))
    }
    // product or deeper: full movement set
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
    if (selPeriod && bdg?.by_period?.length) {
      const row = bdg.by_period.find(r => r._period === selPeriod)
      if (row) {
        // All possible movement categories from the row (exclude _period key and boundary keys)
        const BOUNDARY_KEYS = new Set(['_period','Beginning ARR','Ending ARR','Beginning MRR','Ending MRR'])
        base = Object.keys(row)
          .filter(k => !BOUNDARY_KEYS.has(k))
          .map(k => ({ category: k, value: row[k] || 0 }))
          .filter(r => r.value !== 0)
      }
    }
    // Filter by granularity rules (strips price/volume, enforces level visibility)
    const filtered = filterByDimension(base)
    // Apply canonical ordering
    return applyCanonicalOrder(filtered)
  }, [selPeriod, bdg, wfall, selDims])

  // ── Period-specific KPI values — respect selected granularity + period ──
  const retForPeriod = useMemo(() => {
    // Without a specific period, use the overall retention (covers full lookback)
    if (!selPeriod || !bdg?.by_period?.length) return ret
    const row = bdg.by_period.find(r => r._period === selPeriod)
    if (!row) return ret

    // Build movement items from row, apply same dimension filter as selectedWfall
    const BOUNDARY_KEYS = new Set(['_period','Beginning ARR','Ending ARR','Beginning MRR','Ending MRR','beginning','ending'])
    const rowItems = Object.keys(row)
      .filter(k => !BOUNDARY_KEYS.has(k))
      .map(k => ({ category: k, value: row[k] || 0 }))
    const filtered = filterByDimension(rowItems)

    const newArr  = filtered.filter(r => r.value > 0).reduce((s,r) => s + r.value, 0)
    const lostArr = filtered.filter(r => r.value < 0).reduce((s,r) => s + r.value, 0)
    const beg = ret?.beginning || 0
    const end = beg + newArr + lostArr

    return {
      beginning: beg,
      ending:    end,
      new_arr:   newArr,
      lost_arr:  lostArr,
      // NRR = ending / beginning (includes expansion); GRR = (ending excl expansion) / beginning
      nrr:       beg > 0 ? (end / beg) * 100 : ret?.nrr,
      grr:       beg > 0 ? ((beg + lostArr) / beg) * 100 : ret?.grr,
    }
  }, [selPeriod, bdg, ret, selDims])

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

  // Auto-select latest period when periods first become available
  useEffect(() => {
    if (availablePeriods.length > 0 && !selPeriod) {
      setSelPeriod(availablePeriods[availablePeriods.length - 1])
    }
  }, [availablePeriods])

  const narrative = useMemo(() => genNarrative(retForPeriod||ret, movers), [retForPeriod, ret, movers])

  // Expansion / churn lists for Top Movers tab
  // ── Top Movers — aggregate all categories, sort by ARR impact (highest first)
  const expansionList = useMemo(() => {
    const posCats = ['New Logo','Upsell','Cross-sell','Returning','Other In']
    const all = []
    for (const cat of posCats) {
      if (movers[cat]?.length) movers[cat].forEach(r => all.push({...r, _cat:cat}))
    }
    return all.sort((a,b) => Math.abs(b.value||0) - Math.abs(a.value||0)).slice(0, 25)
  }, [movers])

  const churnList = useMemo(() => {
    const negCats = ['Churn','Churn-Partial','Churn Partial','Lapsed','Downsell','Other Out']
    const all = []
    for (const cat of negCats) {
      if (movers[cat]?.length) movers[cat].forEach(r => all.push({...r, _cat:cat}))
    }
    return all.sort((a,b) => Math.abs(b.value||0) - Math.abs(a.value||0)).slice(0, 25)
  }, [movers])

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

                {/* Period selector — real data months only, chronological, default=latest */}
                {!isCohort&&availablePeriods.length>0&&(
                  <select value={selPeriod} onChange={e=>setSelPeriod(e.target.value)}
                    style={{height:30,fontSize:11,border:'1px solid #1E2D45',borderRadius:5,padding:'0 8px',background:'#0B1220',color:'#94A3B8',outline:'none',cursor:'pointer',fontFamily:"'Inter',system-ui,sans-serif"}}>
                    {availablePeriods.map(p=>(
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                )}

                {!isCohort&&<div style={{width:1,height:18,background:'#1E2D45'}}/>}

                {/* YoY / QoQ — re-runs analysis */}
                {!isCohort&&(
                  <div style={{display:'flex',background:'#0B1220',borderRadius:5,border:'1px solid #1E2D45',overflow:'hidden',height:30}}>
                    {[['Annual','YoY'],['Quarter','QoQ']].map(([val,lbl])=>(
                      <button key={val} onClick={()=>applyPeriodType(val)} disabled={rerunning}
                        style={{padding:'0 11px',height:30,fontSize:11,fontWeight:periodType===val?500:400,border:'none',cursor:rerunning?'not-allowed':'pointer',background:periodType===val?'#162035':'transparent',color:periodType===val?'#CBD5E1':'#4A5A6E',transition:'all 0.12s',opacity:rerunning?0.6:1}}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                )}

                {!isCohort&&<div style={{width:1,height:18,background:'#1E2D45'}}/>}

                {/* Lookback pills — controls bridge window + trend window */}
                {!isCohort&&(
                  <div style={{display:'flex',alignItems:'center',background:'#0B1220',borderRadius:5,border:'1px solid #1E2D45',overflow:'hidden',height:30}}>
                    {lookbacks.map(l=>(
                      <button key={l} onClick={()=>setSelLb(l)}
                        style={{padding:'0 10px',height:30,fontSize:11,fontWeight:600,border:'none',cursor:'pointer',background:selLb===l?'#162035':'transparent',color:selLb===l?'#CBD5E1':'#4A5A6E',transition:'all 0.15s'}}>
                        {l}M
                      </button>
                    ))}
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
                <button onClick={()=>{setResults(null);setFile(null);setColumns([]);setEngine(null);setFieldMap({});setSelDims('customer');setSelPeriod('');setCohortResults(null)}}
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
                <div style={{display:'flex',flexDirection:'column',gap:20}}>

                  {/* ── AI narrative insight bar ─────────────────────── */}
                  {narrative&&(
                    <div style={{padding:'12px 18px',background:'#0F1A2E',border:'1px solid #1E2D45',borderLeft:'3px solid #3D5068',borderRadius:6,display:'flex',alignItems:'center',gap:10}}>
                      <Info size={12} color="#64748B" style={{flexShrink:0}}/>
                      <p style={{margin:0,fontSize:13,color:'#FFFFFF',lineHeight:1.55,fontWeight:400}}>{narrative}</p>
                    </div>
                  )}

                  {/* ── Metadata chip ────────────────────────────────── */}
                  {results?.metadata&&(
                    <div style={{padding:'7px 14px',borderRadius:8,border:'1px solid #253550',background:'#162035',display:'inline-flex',alignItems:'center',gap:8,alignSelf:'flex-start'}}>
                      <span style={{fontSize:11,color:'#FFFFFF',fontWeight:600}}>{results.metadata.dimensions?.length>0?`Customer × ${results.metadata.dimensions.join(' × ')}`:'Customer level'}</span>
                      <span style={{color:'#E5E7EB'}}>·</span>
                      <span style={{fontSize:11,color:'#7B8EA8'}}>{results.metadata.row_count?.toLocaleString()} rows</span>
                    </div>
                  )}

                  {/* ── Reconciliation warning ───────────────────────── */}
                  {bridgeOk && !bridgeOk.valid && (
                    <div style={{padding:'10px 14px',background:'#1A1400',border:'1px solid #3A2E00',borderRadius:6,display:'flex',alignItems:'center',gap:8}}>
                      <AlertCircle size={11} color="#FCD34D"/>
                      <span style={{fontSize:11,color:'#FCD34D',fontWeight:400}}>
                        Reconciliation gap: movements sum {fmt(bridgeOk.total)}, expected {fmt(bridgeOk.expected)} (Δ {fmt(Math.abs(bridgeOk.diff))})
                      </span>
                    </div>
                  )}

                  {/* ── Hero: Waterfall Bridge chart ─────────────────── */}
                  <div style={{...S.cardF}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid #1E2D45'}}>
                      <div>
                        <div style={{fontSize:14,fontWeight:700,color:'#FFFFFF',letterSpacing:'-0.01em'}}>
                          ARR Bridge: {periodType==='Annual'?'YoY':'QoQ'} · {selLb}M{selPeriod?` · ${selPeriod}`:''}
                        </div>
                        <div style={{fontSize:11,color:'#7B8EA8',marginTop:2}}>Movement from beginning to ending ARR</div>
                      </div>
                      {/* Legend */}
                      <div style={{display:'flex',alignItems:'center',gap:14,fontSize:10,color:'#7B8EA8'}}>
                        <span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:10,height:10,borderRadius:2,background:'#4ADE80',display:'inline-block'}}/> Expansion</span>
                        <span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:10,height:10,borderRadius:2,background:'#F87171',display:'inline-block'}}/> Contraction</span>
                        <span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:10,height:10,borderRadius:2,background:'#3D5068',display:'inline-block'}}/> Baseline</span>
                      </div>
                    </div>
                    <div style={{padding:'20px 20px 8px'}}>
                      {(()=>{
                        const movements = selectedWfall.filter(r=>!['Beginning MRR','Ending MRR','Beginning ARR','Ending ARR'].includes(r.category))
                        const beginning = {category:'Beginning ARR', value:toARR((retForPeriod||ret)?.beginning)||0}
                        const ending    = {category:'Ending ARR',    value:toARR((retForPeriod||ret)?.ending)||0}
                        const fullData  = [beginning, ...movements, ending]
                        return <WaterfallBridge data={fullData} showBoundary={true}/>
                      })()}
                    </div>
                  </div>

                  {/* ── Movement Breakdown Details table ─────────────── */}
                  <div style={{...S.cardF}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',borderBottom:'1px solid #1E2D45'}}>
                      <div style={{fontSize:14,fontWeight:700,color:'#FFFFFF',letterSpacing:'-0.01em'}}>Movement Breakdown Details</div>
                      {isAdmin&&<button onClick={downloadCSV} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,fontWeight:600,color:'#4ADE80',background:'transparent',border:'none',cursor:'pointer',padding:'4px 0'}}>
                        <Download size={12}/> Export Data
                      </button>}
                    </div>
                    <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
                      <thead>
                        <tr style={{background:'#162035'}}>
                          {['Category','Count','ARR Impact','% Change'].map((h,i)=>(
                            <th key={h} style={{textAlign:i===0?'left':'right',padding:'10px 20px',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'#7B8EA8',borderBottom:'1px solid #1E2D45',whiteSpace:'nowrap'}}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedWfall.filter(r=>!['Beginning ARR','Ending ARR','Beginning MRR','Ending MRR'].includes(r.category)).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)).map((row,i)=>{
                          const total=selectedWfall.filter(r=>!['Beginning ARR','Ending ARR','Beginning MRR','Ending MRR'].includes(r.category)).reduce((s,r)=>s+Math.abs(r.value),0)
                          const isPos=row.value>=0
                          return (
                            <tr key={i} style={{borderBottom:'1px solid #1E2D45'}}
                              onMouseEnter={e=>e.currentTarget.style.background='#111827'}
                              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                              {/* Category */}
                              <td style={{padding:'12px 20px',display:'flex',alignItems:'center',gap:10}}>
                                <span style={{width:8,height:8,borderRadius:'50%',background:BC[row.category]||'#6B7280',flexShrink:0}}/>
                                <span style={{fontWeight:600,color:'#FFFFFF',fontSize:13}}>{row.category}</span>
                              </td>
                              {/* Count — from bridge data if available */}
                              <td style={{textAlign:'right',padding:'12px 20px',fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:'#7B8EA8'}}>
                                {row.count!=null?row.count.toLocaleString():'—'}
                              </td>
                              {/* ARR Impact */}
                              <td style={{textAlign:'right',padding:'12px 20px',fontWeight:700,fontSize:13,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:isPos?'#16A34A':'#DC2626'}}>
                                {isPos?'+':''}{fmt(row.value)}
                              </td>
                              {/* % of total */}
                              <td style={{textAlign:'right',padding:'12px 20px',fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:'#7B8EA8'}}>
                                {total>0?`${isPos?'+':''}${((row.value/total)*100).toFixed(1)}%`:'—'}
                              </td>
                            </tr>
                          )
                        })}
                        {/* Total row */}
                        {selectedWfall.length>0&&(()=>{
                          const mvts=selectedWfall.filter(r=>!['Beginning ARR','Ending ARR','Beginning MRR','Ending MRR'].includes(r.category))
                          const totalImpact=mvts.reduce((s,r)=>s+r.value,0)
                          const totalCount=mvts.reduce((s,r)=>s+(r.count||0),0)
                          const totalAbs=mvts.reduce((s,r)=>s+Math.abs(r.value),0)
                          return (
                            <tr style={{background:'#162035',borderTop:'1px solid #253550'}}>
                              <td style={{padding:'12px 20px',fontWeight:700,color:'#FFFFFF',fontSize:13}}>Total Bridge Impact</td>
                              <td style={{textAlign:'right',padding:'12px 20px',fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:700,color:'#FFFFFF'}}>{totalCount>0?totalCount.toLocaleString():'—'}</td>
                              <td style={{textAlign:'right',padding:'12px 20px',fontWeight:700,fontSize:13,fontFamily:"'JetBrains Mono',monospace",color:totalImpact>=0?'#16A34A':'#DC2626'}}>
                                {totalImpact>=0?'+':''}{fmt(totalImpact)}
                              </td>
                              <td style={{textAlign:'right',padding:'12px 20px',fontSize:12,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:'#7B8EA8'}}>
                                {totalAbs>0?`${((totalImpact/totalAbs)*100).toFixed(1)}%`:'—'}
                              </td>
                            </tr>
                          )
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* ── Price / Volume Decomposition ─────────────────── */}
                  {(()=>{
                    const PV_KEYS = new Set(['Price Impact','Volume Impact','Price on Volume'])
                    const rawPV = (wfall||[]).filter(r => PV_KEYS.has(r.category))
                    const pvSource = (()=>{
                      if (selPeriod && bdg?.by_period?.length) {
                        const row = bdg.by_period.find(r => r._period === selPeriod)
                        if (row) return Object.keys(row)
                          .filter(k => PV_KEYS.has(k))
                          .map(k => ({ category: k, value: row[k] || 0 }))
                      }
                      return rawPV
                    })()
                    if (!pvSource.length) return null

                    const sum = (cat, sign) => pvSource
                      .filter(r => r.category === cat && (sign === 'pos' ? r.value > 0 : r.value < 0))
                      .reduce((s,r) => s + r.value, 0)

                    const upPrice  = sum('Price Impact','pos')
                    const upVol    = sum('Volume Impact','pos')
                    const upPov    = sum('Price on Volume','pos')
                    const dnPrice  = sum('Price Impact','neg')
                    const dnVol    = sum('Volume Impact','neg')
                    const dnPov    = sum('Price on Volume','neg')

                    const totPrice = pvSource.filter(r=>r.category==='Price Impact').reduce((s,r)=>s+r.value,0)
                    const totVol   = pvSource.filter(r=>r.category==='Volume Impact').reduce((s,r)=>s+r.value,0)
                    const totPov   = pvSource.filter(r=>r.category==='Price on Volume').reduce((s,r)=>s+r.value,0)
                    const netPV    = totPrice + totVol + totPov

                    const upsellNet   = selectedWfall.find(r=>r.category==='Upsell')?.value   || 0
                    const downsellNet = selectedWfall.find(r=>r.category==='Downsell')?.value || 0

                    const fs = v => v === 0 ? '—' : (v > 0 ? '+' : '') + fmt(v)
                    const fc = v => v > 0 ? '#4ADE80' : v < 0 ? '#F87171' : '#64748B'

                    const Row = ({label, val, indent}) => (
                      <tr style={{borderBottom:`1px solid ${T.border}`}}>
                        <td style={{padding:'8px 20px',paddingLeft:indent?34:20,color:indent?T.text2:T.text,fontSize:12,fontWeight:indent?400:500}}>
                          {indent&&<span style={{display:'inline-block',width:5,height:5,borderRadius:'50%',background:'#253550',marginRight:8,verticalAlign:'middle'}}/>}
                          {label}
                        </td>
                        <td style={{textAlign:'right',padding:'8px 20px',fontFamily:T.mono,fontSize:12,fontWeight:500,color:fc(val)}}>
                          {fs(val)}
                        </td>
                      </tr>
                    )

                    return (
                      <div style={{...S.cardF}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',borderBottom:`1px solid ${T.border}`,flexWrap:'wrap',gap:12}}>
                          <div>
                            <div style={{fontSize:14,fontWeight:700,color:'#FFFFFF',letterSpacing:'-0.01em'}}>Price / Volume Decomposition</div>
                            <div style={{fontSize:11,color:T.text2,marginTop:2}}>Sub-components of Upsell & Downsell — not included in core bridge sum</div>
                          </div>
                          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                            {[
                              {label:'Price Effect', val:totPrice},
                              {label:'Volume Effect',val:totVol},
                              {label:'Net P×V',      val:netPV},
                            ].map(c=>(
                              <div key={c.label} style={{padding:'6px 12px',borderRadius:6,background:T.bgRaised,border:`1px solid ${T.border}`,textAlign:'right'}}>
                                <div style={{fontSize:9,color:T.text3,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:3}}>{c.label}</div>
                                <div style={{fontSize:13,fontWeight:700,fontFamily:T.mono,color:fc(c.val)}}>{fs(c.val)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',borderBottom:`1px solid ${T.border}`}}>
                          <div style={{borderRight:`1px solid ${T.border}`}}>
                            <div style={{padding:'9px 20px',background:T.bgRaised,borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:8}}>
                              <span style={{fontSize:11,fontWeight:700,color:'#4ADE80'}}>Upsell</span>
                              <span style={{fontSize:11,color:T.text2,fontFamily:T.mono}}>{fs(upsellNet)}</span>
                            </div>
                            <table style={{borderCollapse:'collapse',width:'100%'}}>
                              <tbody>
                                <Row label="Net Upsell"         val={upsellNet} />
                                <Row label="→ Price component"  val={upPrice}   indent={true} />
                                <Row label="→ Volume component" val={upVol}     indent={true} />
                                <Row label="→ Price × Volume"   val={upPov}     indent={true} />
                              </tbody>
                            </table>
                          </div>
                          <div>
                            <div style={{padding:'9px 20px',background:T.bgRaised,borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:8}}>
                              <span style={{fontSize:11,fontWeight:700,color:'#F87171'}}>Downsell</span>
                              <span style={{fontSize:11,color:T.text2,fontFamily:T.mono}}>{fs(downsellNet)}</span>
                            </div>
                            <table style={{borderCollapse:'collapse',width:'100%'}}>
                              <tbody>
                                <Row label="Net Downsell"       val={downsellNet} />
                                <Row label="→ Price component"  val={dnPrice}     indent={true} />
                                <Row label="→ Volume component" val={dnVol}       indent={true} />
                                <Row label="→ Price × Volume"   val={dnPov}       indent={true} />
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div style={{padding:'10px 20px',display:'flex',alignItems:'center',gap:8,background:T.bgRaised}}>
                          <Info size={11} color={T.text3} style={{flexShrink:0}}/>
                          <span style={{fontSize:11,color:T.text3,lineHeight:1.5}}>
                            These rows are sub-decompositions of Upsell/Downsell. Excluded from the reconciliation sum above to prevent double-counting. Net Upsell + Net Downsell already captures the full movement.
                          </span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* ── Pivot tables (QoQ + YoY) below the main view ─── */}
                  {results?.pivot?.[String(selLb)]?.bridge_pivot&&(
                    <div style={{...S.card}}>
                      <BridgePivotTable pivot={results.pivot[String(selLb)].bridge_pivot} title="ARR Waterfall" lookbackLabel={`${selLb}M Lookback`} showPct={false}/>
                      <CustomerCountPivot pivot={results.pivot[String(selLb)].customer_pivot}/>
                    </div>
                  )}
                  {results?.pivot?.['12']?.bridge_pivot&&selLb!==12&&(
                    <div style={{...S.card}}>
                      <BridgePivotTable pivot={results.pivot['12'].bridge_pivot} title="ARR Waterfall" lookbackLabel="YoY (12M)" showPct={true}/>
                      <CustomerCountPivot pivot={results.pivot['12'].customer_pivot}/>
                    </div>
                  )}

                  {/* ── Bridge trend chart (stacked bars over time) ───── */}
                  {bdg?.by_period?.length>0&&(
                    <div style={{...S.card}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                        <div style={{...S.label}}>Bridge Trend Over Time</div>
                        <span style={{fontSize:10,color:'#7B8EA8'}}>{periodType} · {selLb}M lookback</span>
                      </div>
                      <div style={{height:240}}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={(()=>{const all=bdg?.by_period||[];if(!selPeriod||!selLb)return all;const ai=all.findIndex(r=>r._period===selPeriod);const a=ai>=0?ai:all.length-1;return all.slice(Math.max(0,a-selLb+1),a+1)})()} margin={{left:8,right:8,bottom:8}}>
                            <XAxis dataKey="_period" tick={{fontSize:10,fill:'#6B7280'}} axisLine={false} tickLine={false}/>
                            <YAxis tickFormatter={fmt} tick={{fontSize:10,fill:'#9CA3AF'}} width={48} axisLine={false} tickLine={false}/>
                            <Tooltip formatter={v=>fmt(Number(v))} contentStyle={{background:'#0F1A2E',border:'1px solid #1E2D45',borderRadius:7,fontSize:11,color:'#FFFFFF'}}/>
                            
                            {['New Logo','Upsell','Cross-sell','Returning','Downsell','Churn','Churn Partial'].map(cat=>(
                              <Bar key={cat} dataKey={cat} stackId="a" fill={BC[cat]||'#6B7280'} name={cat}/>
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MRR: DETAILED BRIDGE + RETENTION TRENDS */}
              {!isCohort&&activeTab==='retention_trend'&&(
                <div style={{display:'flex',flexDirection:'column',gap:20}}>

                  {/* ── Monthly Bridge Table — columns = actual months ───── */}
                  {(()=>{
                    // Build monthly bridge matrix from by_period data
                    // Columns: last selLb months up to selPeriod (or latest)
                    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                    const allPeriods = bdg?.by_period || []
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
                      ? sorted.findIndex(r=>r._period===selPeriod)
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
                                  <th key={p} style={{textAlign:'right',padding:'9px 12px',fontSize:9,fontWeight:p===selPeriod?700:500,letterSpacing:'0.06em',color:p===selPeriod?'#CBD5E1':'#4A5A6E',whiteSpace:'nowrap',borderBottom:'1px solid #1E2D45',background:p===selPeriod?'#1A2840':'#162035'}}>
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
                                      const isCurrentPeriod = p===selPeriod
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
                                  const posSum = ['New Logo','Upsell','Cross-sell','Returning','Other In'].reduce((s,k)=>s+(row[k]||0),0)
                                  const negSum = ['Downsell','Churn Partial','Churn','Lapsed','Other Out'].reduce((s,k)=>s+(row[k]||0),0)
                                  const net = toARR(posSum+negSum)
                                  const isCurrentPeriod = p===selPeriod
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
                            const isSelected = selPeriod && row.period === selPeriod
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
                  {Object.keys(movers).length>0&&(
                    <div style={{background:'#0F1A2E',border:'1px solid #1E2D45',borderRadius:8,boxShadow:'0 1px 3px rgba(0,0,0,0.07)',overflow:'hidden'}}>
                      {/* Category tabs */}
                      <div style={{display:'flex',alignItems:'center',gap:4,padding:'12px 16px',borderBottom:'1px solid #1E2D45',flexWrap:'wrap',background:'#0D1525'}}>
                        <span style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.08em',color:'#7B8EA8',marginRight:8}}>Filter:</span>
                        {Object.keys(movers).map(cat=>(
                          <button key={cat} onClick={()=>setMoverCat(cat)} style={{
                            display:'flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:20,fontSize:11,fontWeight:600,
                            border:`1px solid ${moverCat===cat?'rgba(37,99,235,0.25)':'#E5E7EB'}`,
                            background:moverCat===cat?'rgba(37,99,235,0.08)':'transparent',
                            color:moverCat===cat?'#2563EB':'#6B7280',cursor:'pointer',transition:'all 0.12s',
                          }}>
                            <span style={{width:6,height:6,borderRadius:'50%',background:BC[cat]||'#6B7280',flexShrink:0}}/>
                            {cat}
                            <span style={{fontSize:9,background:'#162035',color:'#7B8EA8',padding:'1px 5px',borderRadius:10}}>{(movers[cat]||[]).length}</span>
                          </button>
                        ))}
                      </div>
                      {/* Table */}
                      {moverCat&&movers[moverCat]?.length>0&&(
                        <div style={{overflowX:'auto'}}>
                          <table style={{borderCollapse:'collapse',width:'100%',fontSize:13}}>
                            <thead>
                              <tr style={{background:'#162035',borderBottom:'2px solid #E5E7EB'}}>
                                {Object.keys(movers[moverCat][0]).filter(k=>k!=='value'&&k!=='period'&&k!=='health'&&k!=='segment').map(k=>(
                                  <th key={k} style={{textAlign:'left',padding:'10px 16px',fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'#7B8EA8',whiteSpace:'nowrap'}}>{k}</th>
                                ))}
                                <th style={{textAlign:'right',padding:'10px 16px',fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'#7B8EA8'}}>Period</th>
                                <th style={{textAlign:'right',padding:'10px 16px',fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'#7B8EA8'}}>ARR Impact</th>
                              </tr>
                            </thead>
                            <tbody>
                              {movers[moverCat].slice(0,30).map((row,i)=>(
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
                  {topCusts.length>0?(
                    <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
                      <thead><tr style={{borderBottom:'1px solid #1E2D45'}}>
                        <th style={{textAlign:'left',padding:'10px 20px',fontSize:9,fontWeight:700,textTransform:'uppercase',color:'#7B8EA8'}}>#</th>
                        {Object.keys(topCusts[0]).map(k=><th key={k} style={{textAlign:'left',padding:'10px 20px',fontSize:9,fontWeight:700,textTransform:'uppercase',color:'#7B8EA8'}}>{k}</th>)}
                      </tr></thead>
                      <tbody>{topCusts.map((row,i)=>(
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
