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
  // Financial-grade: muted green=positive, muted red=negative, blue=baseline
  'New Logo':      '#4ADE80',
  'Cross-sell':    '#86EFAC',
  'Other In':      '#93C5FD',
  'Returning':     '#93C5FD',
  'Upsell':        '#4ADE80',
  'Downsell':      '#FCA5A5',
  'Add on':        '#86EFAC',
  'Add-on':        '#86EFAC',
  'Churn':         '#F87171',
  'Churn Partial': '#FCA5A5',
  'Churn-Partial': '#FCA5A5',
  'Other Out':     '#94A3B8',
  'Lapsed':        '#64748B',
  'Beginning MRR': '#3B82F6',
  'Ending MRR':    '#3B82F6',
  'Prior ACV':     '#3B82F6',
  'Ending ACV':    '#3B82F6',
  'RoB':           '#93C5FD',
  'Expiry Pool':   '#64748B',
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
      <div className="flex justify-between mb-1"><span className="text-[10px] text-[#4A5A7A]">{msg}</span><span className="text-[10px] font-bold" style={{color:'var(--color-accent)'}}>{s}s</span></div>
      <div className="h-1 rounded-full overflow-hidden" style={{background:'var(--color-border)'}}>
        <div className="h-full rounded-full transition-all duration-1000" style={{width:`${pct}%`,background:'var(--color-accent)'}}/>
      </div>
      {s>6&&<p className="text-[9px] mt-1" style={{color:'var(--color-text-secondary)'}}>⚡ First run each session takes 30–90s</p>}
    </div>
  )
}

// ─── KPI Chip ─────────────────────────────────────────────────────────────────
function KpiChip({label,value,sub,subGood,accent}) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: `1px solid ${accent?'rgba(0,229,160,0.25)':'var(--color-border)'}`,
      borderRadius:16,padding:'14px 18px',
    }}>
      <div style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em',color:'var(--color-text-secondary)',marginBottom:4}}>{label}</div>
      <div style={{fontSize:22,fontWeight:900,letterSpacing:'-0.02em',color:accent?'var(--color-accent)':'white',fontFamily:'var(--font-mono)',lineHeight:1}}>{value}</div>
      {sub!=null&&(
        <div style={{marginTop:4,fontSize:10,fontWeight:600,color:subGood===true?'var(--color-accent)':subGood===false?'var(--color-negative)':'var(--color-text-secondary)',display:'flex',alignItems:'center',gap:3}}>
          {subGood===true&&<TrendingUp size={9}/>}{subGood===false&&<TrendingDown size={9}/>}{sub}
        </div>
      )}
    </div>
  )
}

// ─── Mover Card ───────────────────────────────────────────────────────────────
function MoverCard({customer,value,period,isRisk,rank}) {
  const abs=Math.abs(value||0)
  const barPct=Math.min((abs/2000000)*100,100)
  const letter=String(customer||'?')[0].toUpperCase()
  const palette=['var(--color-accent)','var(--color-accent-2, #60A5FA)','var(--color-accent)','var(--color-text-secondary)','#F87171']
  const bg=palette[rank%palette.length]
  return (
    <div style={{
      padding:'14px 16px',borderRadius:14,
      background:'var(--color-surface)',
      border:`1px solid ${isRisk?'var(--color-negative-border)':'var(--color-accent-border)'}`,
      marginBottom:8,transition:'all 0.15s',
    }}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{width:36,height:36,borderRadius:10,background:bg,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:14,color:'var(--color-background)',flexShrink:0}}>{letter}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
            <div style={{fontWeight:700,fontSize:13,color:'var(--color-text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{customer}</div>
            <div style={{fontWeight:900,fontSize:13,color:isRisk?'var(--color-negative)':'var(--color-accent)',fontFamily:'var(--font-mono)',flexShrink:0}}>{isRisk?'':'+' }{fmt(value)}</div>
          </div>
          {period&&<div style={{fontSize:9,color:'var(--color-text-secondary)',marginTop:1}}>{period}</div>}
          <div style={{height:3,background:'var(--color-border)',borderRadius:4,marginTop:8,overflow:'hidden'}}>
            <div style={{height:'100%',borderRadius:4,background:isRisk?'var(--color-negative)':'var(--color-accent)',width:`${barPct}%`,transition:'width 0.7s'}}/>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Waterfall Bridge ─────────────────────────────────────────────────────────
function WaterfallBridge({data}) {
  if(!data?.length) return <div style={{height:180,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--color-text-secondary)',fontSize:13}}>No bridge data</div>
  const ORDER=['New Logo','Cross-sell','Returning','Other In','Upsell','Downsell','Churn','Churn Partial','Other Out','Lapsed']
  const rows=data.filter(d=>ORDER.includes(d.category)).sort((a,b)=>ORDER.indexOf(a.category)-ORDER.indexOf(b.category))
  const CustomTooltip=({active,payload})=>{
    if(!active||!payload?.length) return null
    const d=payload[0].payload
    return (
      <div style={{background:'var(--color-surface)',border:'1px solid #1E2D45',borderRadius:12,padding:'8px 12px'}}>
        <div style={{fontSize:10,fontWeight:600,color:'var(--color-text-primary)',marginBottom:2}}>{d.category}</div>
        <div style={{fontSize:14,fontWeight:900,color:d.value>=0?'var(--color-accent)':'var(--color-negative)',fontFamily:'var(--font-mono)'}}>{d.value>=0?'+':''}{fmt(d.value)}</div>
      </div>
    )
  }
  return (
    <div style={{height:200}}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{top:8,right:8,bottom:44,left:8}}>
          <CartesianGrid strokeDasharray="2 4" stroke='var(--color-border)' vertical={false}/>
          <XAxis dataKey="category" tick={{fontSize:9,fill:'var(--color-text-secondary)'}} angle={-35} textAnchor="end" interval={0} axisLine={false} tickLine={false}/>
          <YAxis tickFormatter={fmt} tick={{fontSize:9,fill:'var(--color-text-secondary)'}} width={44} axisLine={false} tickLine={false}/>
          <ReferenceLine y={0} stroke='var(--color-border)'/>
          <Tooltip content={<CustomTooltip/>} cursor={{fill:'rgba(255,255,255,0.02)'}}/>
          <Bar dataKey="value" radius={[4,4,0,0]} maxBarSize={32}>
            {rows.map((e,i)=><Cell key={i} fill={BC[e.category]||'var(--color-text-secondary)'}/>)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Bridge Pivot Table ───────────────────────────────────────────────────────
function BridgePivotTable({pivot,title,lookbackLabel,showPct}) {
  if(!pivot?.periods?.length||!pivot?.rows?.length) return <div style={{color:'var(--color-text-secondary)',textAlign:'center',padding:'32px',fontSize:13}}>No bridge data</div>
  const {periods,rows,retention}=pivot
  return (
    <div style={{overflowX:'auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
        <span style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em',color:'var(--color-text-secondary)'}}>{title}</span>
        {lookbackLabel&&<span style={{fontSize:9,background:'rgba(0,229,160,0.1)',color:'var(--color-accent)',border:'1px solid rgba(0,229,160,0.2)',padding:'2px 8px',borderRadius:20,fontWeight:600}}>{lookbackLabel}</span>}
      </div>
      <table style={{borderCollapse:'collapse',minWidth:Math.max(periods.length*100+220,420),width:'100%',fontSize:12}}>
        <thead>
          <tr style={{borderBottom:'1px solid #1E2D45'}}>
            <th style={{textAlign:'left',padding:'8px 12px',fontSize:9,fontWeight:700,textTransform:'uppercase',color:'var(--color-text-secondary)',width:160,position:'sticky',left:0,background:'var(--color-surface)'}}>Bridge</th>
            {periods.map(p=><th key={p} style={{textAlign:'right',padding:'8px 12px',fontSize:9,fontWeight:700,color:'var(--color-text-secondary)',whiteSpace:'nowrap'}}>{p}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row,ri)=>{
            const isB=row.is_beginning||row.is_ending
            return (
              <tr key={ri} style={{borderBottom:`1px solid ${isB?'var(--color-border)':'var(--color-border)'}`,background:isB?'var(--color-surface-hover)':'transparent'}}>
                <td style={{padding:'8px 12px',position:'sticky',left:0,background:isB?'var(--color-surface-hover)':'var(--color-surface)',color:isB?'var(--color-text-primary)':'var(--color-text-secondary)',fontWeight:isB?700:500,fontSize:11,whiteSpace:'nowrap'}}>
                  {!isB&&<span style={{display:'inline-block',width:6,height:6,borderRadius:'50%',background:BC[row.classification]||'var(--color-text-secondary)',marginRight:8,verticalAlign:'middle'}}/>}
                  {row.classification}
                </td>
                {periods.map(p=>{
                  const v=row.values?.[p]
                  const pos=v>0
                  return (
                    <td key={p} style={{textAlign:'right',padding:'8px 12px',whiteSpace:'nowrap',fontFamily:'var(--font-mono)',fontSize:11,fontWeight:isB?700:500,color:isB?'var(--color-text-primary)':pos?'var(--color-positive)':v<0?'var(--color-negative)':'var(--color-text-secondary)'}}>
                      {v==null||v===0?'—':(pos&&!isB?'+':'')+fmt(v)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
          {retention&&Object.keys(retention).length>0&&[['Gross Retention','grr',80],['Net Retention','nrr',100]].map(([lbl,key,thr])=>(
            <tr key={key} style={{borderTop:'1px solid #1E2D45',background:'var(--color-surface-hover)'}}>
              <td style={{padding:'8px 12px',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--color-text-secondary)',position:'sticky',left:0,background:'var(--color-surface-hover)',whiteSpace:'nowrap'}}>{lbl}</td>
              {periods.map(p=>{const v=retention[p]?.[key];return(
                <td key={p} style={{textAlign:'right',padding:'8px 12px',fontWeight:900,fontSize:11,fontFamily:'var(--font-mono)',color:v>=thr?'var(--color-positive)':'var(--color-negative)'}}>{v!=null?`${v.toFixed(1)}%`:'—'}</td>
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
    <div style={{overflowX:'auto',marginTop:24,paddingTop:24,borderTop:'1px solid #1E2D45'}}>
      <div style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em',color:'var(--color-text-secondary)',marginBottom:10}}>Customer Count Rollforward</div>
      <table style={{borderCollapse:'collapse',minWidth:Math.max(periods.length*90+200,400),width:'100%',fontSize:12}}>
        <thead>
          <tr style={{borderBottom:'1px solid #1E2D45'}}>
            <th style={{textAlign:'left',padding:'6px 12px',fontSize:9,fontWeight:700,color:'var(--color-text-secondary)',width:160,position:'sticky',left:0,background:'var(--color-surface)'}}/>
            {periods.map(p=><th key={p} style={{textAlign:'right',padding:'6px 12px',fontSize:9,fontWeight:700,color:'var(--color-text-secondary)',whiteSpace:'nowrap'}}>{p}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row,ri)=>{
            const isB=row.is_beginning||row.is_ending
            return (
              <tr key={ri} style={{borderBottom:'1px solid #0F1924',background:isB?'var(--color-surface-hover)':'transparent'}}>
                <td style={{padding:'6px 12px',position:'sticky',left:0,background:isB?'var(--color-surface-hover)':'var(--color-surface)',color:isB?'var(--color-text-primary)':'var(--color-text-secondary)',fontWeight:isB?700:400,fontSize:11,whiteSpace:'nowrap'}}>{row.classification}</td>
                {periods.map(p=>{const v=row.values?.[p]||0;return(
                  <td key={p} style={{textAlign:'right',padding:'6px 12px',fontFamily:'var(--font-mono)',fontSize:11,fontWeight:500,color:v>0&&!isB?'var(--color-accent)':v<0?'var(--color-negative)':'var(--color-text-secondary)'}}>{v===0?'—':(v>0&&!isB?'+':'')+v.toLocaleString()}</td>
                )})}
              </tr>
            )
          })}
          {logo_retention&&(
            <tr style={{borderTop:'1px solid #1E2D45',background:'var(--color-surface-hover)'}}>
              <td style={{padding:'6px 12px',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--color-text-secondary)',position:'sticky',left:0,background:'var(--color-surface-hover)',whiteSpace:'nowrap'}}>Logo Retention</td>
              {periods.map(p=>{const lr=logo_retention[p]?.logo_retention;return(
                <td key={p} style={{textAlign:'right',padding:'6px 12px',fontWeight:900,fontSize:11,fontFamily:'var(--font-mono)',color:lr>=80?'var(--color-positive)':lr>=60?'var(--color-text-secondary)':'var(--color-negative)'}}>{lr!=null?`${lr.toFixed(1)}%`:'—'}</td>
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
  const pc=(v,g=80,gr=100)=>v==null?'var(--color-text-secondary)':v>=gr?'var(--color-accent)':v>=g?'var(--color-text-secondary)':'var(--color-negative)'
  return (
    <div style={{overflowX:'auto'}}>
      <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
        <thead>
          <tr style={{borderBottom:'1px solid #1E2D45'}}>
            {['Period','Beg ARR','New Logo','Upsell','Downsell','Churn','End ARR','GRR','NRR'].map(h=>(
              <th key={h} style={{textAlign:'left',padding:'10px 12px',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--color-text-secondary)',whiteSpace:'nowrap'}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r,i)=>(
            <tr key={i} style={{borderBottom:'1px solid #0F1924'}}>
              <td style={{padding:'8px 12px',fontWeight:700,color:'var(--color-text-primary)',fontFamily:'var(--font-mono)'}}>{r.period}</td>
              <td style={{padding:'8px 12px',color:'var(--color-text-secondary)',fontFamily:'var(--font-mono)'}}>{fV(r.beginning_arr)}</td>
              <td style={{padding:'8px 12px',color:'var(--color-positive)',fontWeight:600,fontFamily:'var(--font-mono)'}}>{r.new_logo>0?`+${fV(r.new_logo)}`:'—'}</td>
              <td style={{padding:'8px 12px',color:'var(--color-accent)',fontWeight:600,fontFamily:'var(--font-mono)'}}>{r.upsell>0?`+${fV(r.upsell)}`:'—'}</td>
              <td style={{padding:'8px 12px',color:'var(--color-text-secondary)',fontWeight:600,fontFamily:'var(--font-mono)'}}>{fV(r.downsell)}</td>
              <td style={{padding:'8px 12px',color:'var(--color-negative)',fontWeight:600,fontFamily:'var(--font-mono)'}}>{fV(r.churn)}</td>
              <td style={{padding:'8px 12px',fontWeight:700,color:'var(--color-text-primary)',fontFamily:'var(--font-mono)'}}>{fV(r.ending_arr)}</td>
              <td style={{padding:'8px 12px',fontWeight:700,fontFamily:'var(--font-mono)',color:pc(r.gross_retention)}}>{fP(r.gross_retention)}</td>
              <td style={{padding:'8px 12px',fontWeight:700,fontFamily:'var(--font-mono)',color:pc(r.net_retention,100,110)}}>{fP(r.net_retention)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Cohort Heatmap ───────────────────────────────────────────────────────────
function CohortHeatmap({data,title,isPercent}) {
  if(!data?.length) return <div style={{color:'var(--color-text-secondary)',textAlign:'center',padding:24,fontSize:13}}>No data</div>
  const allKeys=Array.from(new Set(data.flatMap(r=>Object.keys(r).filter(k=>k!=='cohort')))).sort((a,b)=>Number(a)-Number(b))
  const allVals=data.flatMap(r=>allKeys.map(k=>r[k]||0)).filter(v=>v>0)
  const maxVal=Math.max(...allVals,1)
  const color=v=>{
    if(!v)return'transparent'
    if(!isPercent)return`rgba(0,229,160,${0.08+(v/maxVal)*0.75})`
    if(v>=90)return'var(--color-accent)';if(v>=70)return'var(--color-accent)';if(v>=50)return'var(--color-accent)'
    if(v>=30)return'var(--color-text-secondary)';return'var(--color-negative)'
  }
  const tc=v=>{if(!v)return'transparent';if(isPercent&&v>=50)return'var(--color-surface)';return'var(--color-text-secondary)'}
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <span style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em',color:'var(--color-text-secondary)'}}>{title}</span>
        <span style={{fontSize:9,color:'var(--color-text-secondary)'}}>{allKeys.length} periods · {data.length} cohorts</span>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{fontSize:11,minWidth:allKeys.length*36+120}}>
          <thead><tr>
            <th style={{textAlign:'left',padding:'4px 12px 4px 0',fontSize:9,fontWeight:600,color:'var(--color-text-secondary)',position:'sticky',left:0,background:'var(--color-surface)',whiteSpace:'nowrap'}}>Cohort</th>
            {allKeys.map(k=><th key={k} style={{padding:'0 2px',textAlign:'center',fontSize:9,color:'var(--color-text-secondary)',fontWeight:600,whiteSpace:'nowrap'}}>M{k}</th>)}
          </tr></thead>
          <tbody>
            {data.map((row,ri)=>(
              <tr key={ri}>
                <td style={{padding:'2px 12px 2px 0',fontSize:10,fontWeight:600,color:'var(--color-text-primary)',whiteSpace:'nowrap',position:'sticky',left:0,background:'var(--color-surface)'}}>{row.cohort}</td>
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
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderBottom:'1px solid var(--color-border)'}}>
      <div style={{flex:1,fontSize:11,color:'var(--color-text-secondary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{label}</div>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{
        fontSize:10,border:`1px solid ${showError&&!value?'rgba(255,71,87,0.4)':value?'rgba(0,229,160,0.3)':'var(--color-border)'}`,
        borderRadius:8,padding:'5px 8px',background:'var(--color-background)',
        color:showError&&!value?'var(--color-negative)':value?'var(--color-accent)':'var(--color-text-secondary)',
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

  // Results
  const [results, setResults]     = useState(null)
  const [running, setRunning]     = useState(false)
  const [runErr, setRunErr]       = useState('')
  const [selLb, setSelLb]         = useState(12)
  const [yearFilter, setYearFilter] = useState('All')
  const [activeTab, setActiveTab]   = useState('summary')
  const [moverCat, setMoverCat]     = useState('')

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

  // Derived
  const lb       = String(selLb)
  const bdg      = results?.bridge?.[lb]
  const ret      = bdg?.retention
  const wfall    = bdg?.waterfall || []
  const fyYears  = results?.metadata?.fiscal_years || results?.fiscal_years || []
  const kpiRows  = results?.kpi_matrix || []
  const movers   = results?.top_movers || {}
  const topCusts = results?.top_customers || []

  const narrative = useMemo(() => genNarrative(ret, movers), [ret, movers])

  // Expansion / churn lists for Top Movers tab
  const expansionList = useMemo(() => {
    if (moverCat && movers[moverCat]) return movers[moverCat].filter(r=>r.value>0).slice(0,20)
    for (const cat of ['Upsell','New Logo','Cross-sell','Returning']) {
      if (movers[cat]?.length) return movers[cat].slice(0,20)
    }
    return []
  }, [moverCat, movers])

  const churnList = useMemo(() => {
    for (const cat of ['Churn','Churn Partial']) {
      if (movers[cat]?.length) return movers[cat].slice(0,20)
    }
    if (moverCat && movers[moverCat]) return movers[moverCat].filter(r=>r.value<0).slice(0,20)
    return []
  }, [moverCat, movers])

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
        const cats=Object.keys(data.top_movers||{}); if(cats.length) setMoverCat(cats[0])
      }
    } catch(e) { setRunErr(e?.response?.data?.detail||'Analysis failed. Please try again.') }
    setRunning(false)
  }

  function downloadCSV() {
    const out=results?.output||[]; if(!out.length) return
    const keys=Object.keys(out[0])
    const csv=[keys.join(','),...out.map(r=>keys.map(k=>`"${r[k]??''}"`).join(','))].join('\n')
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
    a.download=`revenuelens_${engine}_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  }

  const TABS = isCohort ? [
    {id:'heatmap',label:'Retention'},{id:'revenue_heatmap',label:'Revenue'},
    {id:'segmentation',label:'Segments'},{id:'summary',label:'Summary'},{id:'output',label:'Output'},
  ] : [
    {id:'summary',label:'Summary'},{id:'bridge',label:'Bridge'},
    {id:'retention',label:'Retention'},{id:'top_movers',label:'Top Movers'},
    {id:'top_customers',label:'Customers'},{id:'kpi_matrix',label:'KPI Matrix'},{id:'output',label:'Output'},
  ]

  // ── Style helpers ──────────────────────────────────────────────────────────
  const S = {
    card: {background:'var(--color-surface)',border:'1px solid #1E2D45',borderRadius:16,padding:24},
    label: {fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em',color:'var(--color-text-secondary)'},
  }


  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:'var(--color-background)',fontFamily:'var(--font-sans)'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#1E2D45;border-radius:4px}
        ::-webkit-scrollbar-thumb:hover{background:#2A3D55}
        .rl-tab-active{border-bottom:2px solid #00E5A0!important;color:#00E5A0!important}
        .rl-hover:hover{background:#111927}
        .rl-btn-ghost:hover{border-color:#2A3D55!important;color:white!important}
      `}</style>

      {/* ══ LEFT SIDEBAR ══════════════════════════════════════════════════ */}
      <aside style={{width:264,display:'flex',flexDirection:'column',flexShrink:0,borderRight:'1px solid var(--color-border)',background:'var(--color-surface)',overflow:'hidden'}}>

        {/* Logo */}
        <div style={{height:56,display:'flex',alignItems:'center',gap:12,padding:'0 20px',borderBottom:'1px solid var(--color-border)',flexShrink:0}}>
          <div style={{width:28,height:28,borderRadius:8,background:'var(--color-accent)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <BarChart3 size={13} color="#fff"/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:900,color:'var(--color-text-primary)',letterSpacing:'-0.01em',lineHeight:1}}>RevenueLens</div>
            <div style={{fontSize:8,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.15em',color:'var(--color-accent)',marginTop:2}}>Analytics</div>
          </div>
          <button onClick={()=>router.push('/dashboard')} style={{padding:6,borderRadius:8,background:'transparent',border:'none',cursor:'pointer',color:'var(--color-text-secondary)'}} onMouseEnter={e=>e.target.style.color='white'} onMouseLeave={e=>e.target.style.color='var(--color-text-secondary)'}>
            <Home size={12}/>
          </button>
        </div>

        {/* Progress steps */}
        <div style={{padding:'12px 16px',borderBottom:'1px solid var(--color-border)',flexShrink:0}}>
          {[[1,'Upload Data',step1,!step1],[2,'Select Engine',step2,step1&&!step2],[3,'Map Fields',step3,step2&&!step3],[4,'Configure',!!results,step3&&!results]].map(([n,lbl,done,active])=>(
            <div key={n} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 8px',borderRadius:10,background:active?'var(--color-surface-hover)':'transparent',marginBottom:2}}>
              <div style={{width:20,height:20,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:900,flexShrink:0,background:done?'var(--color-accent)':active?'var(--color-accent)':'var(--color-muted)',color:done?'var(--color-background)':'white'}}>{done?'✓':n}</div>
              <span style={{fontSize:11,fontWeight:600,color:active?'white':done?'var(--color-text-secondary)':'var(--color-text-secondary)'}}>{lbl}</span>
            </div>
          ))}
        </div>

        {/* Scrollable sidebar content */}
        <div style={{flex:1,overflowY:'auto'}}>

          {/* STEP 1: Upload */}
          <div style={{padding:16,borderBottom:'1px solid var(--color-border)'}}>
            <div style={S.label}>1. Upload Data</div>
            {uploadErr&&<div style={{marginTop:8,padding:10,borderRadius:10,border:'1px solid var(--color-negative-border)',background:'var(--color-negative-dim)',color:'var(--color-negative)',fontSize:10,display:'flex',gap:8}}><AlertCircle size={11} style={{flexShrink:0,marginTop:1}}/>{uploadErr}</div>}
            <div onClick={()=>!uploading&&fileRef.current?.click()} style={{
              marginTop:10,borderRadius:12,border:`2px dashed ${file&&columns.length?'rgba(0,229,160,0.4)':uploading?'rgba(123,97,255,0.4)':'var(--color-border)'}`,
              padding:16,textAlign:'center',cursor:'pointer',
              background:file&&columns.length?'rgba(0,229,160,0.04)':uploading?'rgba(123,97,255,0.04)':'rgba(13,21,37,0.5)',
            }}>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)uploadFile(f)}}/>
              {uploading?(<div><Loader2 size={18} color="#7B61FF" style={{margin:'0 auto 4px',animation:'spin 1s linear infinite'}}/><div style={{fontSize:11,color:'var(--color-accent)',fontWeight:600}}>Reading file…</div></div>)
              :file&&columns.length?(<div><CheckCircle size={18} color="var(--color-accent)" style={{margin:'0 auto 4px'}}/><div style={{fontSize:11,fontWeight:700,color:'var(--color-text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{file.name}</div><div style={{fontSize:10,color:'var(--color-text-secondary)'}}>{rowCount.toLocaleString()} rows · {columns.length} cols</div><button onClick={e=>{e.stopPropagation();fileRef.current?.click()}} style={{fontSize:9,color:'var(--color-accent)',background:'none',border:'none',cursor:'pointer',fontWeight:600,marginTop:4}}>Change file</button></div>)
              :(<div><Upload size={18} color="#2A3D55" style={{margin:'0 auto 6px'}}/><div style={{fontSize:11,color:'var(--color-text-secondary)',fontWeight:600}}>Click or drag file</div><div style={{fontSize:10,color:'var(--color-text-secondary)',marginTop:2}}>CSV or Excel</div></div>)}
            </div>
            <UploadTimer active={uploading}/>
          </div>

          {/* STEP 2: Engine */}
          {step1&&(
            <div style={{padding:16,borderBottom:'1px solid var(--color-border)'}}>
              <div style={S.label}>2. Select Engine</div>
              <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:6}}>
                {Object.entries(ENGINE_CONFIG).map(([id,ec])=>{
                  const Icon=ec.icon; const active=engine===id
                  return (
                    <button key={id} onClick={()=>setEngine(id)} style={{
                      display:'flex',alignItems:'center',gap:12,padding:12,borderRadius:12,
                      border:`1px solid ${active?'rgba(0,229,160,0.25)':'var(--color-border)'}`,
                      background:active?'rgba(0,229,160,0.05)':'var(--color-surface)',
                      cursor:'pointer',textAlign:'left',width:'100%',transition:'all 0.15s',
                    }}>
                      <div style={{width:28,height:28,borderRadius:8,background:active?'rgba(0,229,160,0.15)':'var(--color-border)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <Icon size={12} color={active?'var(--color-accent)':'var(--color-text-secondary)'}/>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,fontWeight:700,color:active?'var(--color-accent)':'white',lineHeight:1.2}}>{ec.label}</div>
                        <div style={{fontSize:9,color:'var(--color-text-secondary)',marginTop:2}}>{ec.desc}</div>
                      </div>
                      {active&&<CheckCircle size={12} color="var(--color-accent)"/>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Map Fields */}
          {step2&&cfg&&(
            <div style={{padding:16,borderBottom:'1px solid var(--color-border)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <div style={S.label}>3. Map Fields</div>
                <span style={{fontSize:9,fontWeight:700,color:Object.keys(errors).length===0?'var(--color-accent)':'var(--color-text-secondary)'}}>
                  {cfg.required.filter(f=>!!fieldMap[f.key]).length}/{cfg.required.length} mapped
                </span>
              </div>
              <div style={{borderRadius:10,border:'1px solid var(--color-border)',overflow:'hidden',marginBottom:8,background:'var(--color-surface)'}}>
                <div style={{padding:'6px 12px',borderBottom:'1px solid var(--color-border)',fontSize:8,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em',color:'var(--color-text-secondary)'}}>Required</div>
                {cfg.required.map(f=><FieldRow key={f.key} label={f.label} required value={fieldMap[f.key]||''} columns={columns} onChange={v=>setFieldMap(m=>({...m,[f.key]:v}))} showError={validated}/>)}
              </div>
              <div style={{borderRadius:10,border:'1px solid var(--color-border)',overflow:'hidden',background:'var(--color-surface)'}}>
                <button onClick={()=>setShowOpt(v=>!v)} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 12px',background:'transparent',border:'none',cursor:'pointer'}}>
                  <span style={{fontSize:8,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em',color:'var(--color-text-secondary)'}}>Optional Fields</span>
                  {showOpt?<ChevronUp size={10} color="#4A5A7A"/>:<ChevronDown size={10} color="#4A5A7A"/>}
                </button>
                {showOpt&&cfg.optional.map(f=><FieldRow key={f.key} label={f.label} value={fieldMap[f.key]||''} columns={columns} onChange={v=>setFieldMap(m=>({...m,[f.key]:v}))} showError={false}/>)}
              </div>
              {validated&&Object.keys(errors).length>0&&(
                <div style={{marginTop:8,padding:10,borderRadius:10,border:'1px solid rgba(255,71,87,0.2)',background:'rgba(255,71,87,0.05)'}}>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--color-negative)',marginBottom:4}}>Map required fields:</div>
                  {cfg.required.filter(f=>errors[f.key]).map(f=><div key={f.key} style={{fontSize:9,color:'var(--color-negative)'}}>· {f.label}</div>)}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Configure */}
          {step3&&(
            <div style={{padding:16}}>
              <div style={{...S.label,marginBottom:12}}>4. Configure</div>
              {engine==='cohort'?(
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  <div>
                    <div style={{fontSize:10,fontWeight:600,color:'var(--color-text-secondary)',marginBottom:8}}>Cohort Types</div>
                    {COHORT_TYPES_CFG.map(ct=>(
                      <label key={ct.id} style={{display:'flex',alignItems:'center',gap:10,padding:10,borderRadius:10,border:`1px solid ${cohortTypes.includes(ct.id)?'rgba(0,229,160,0.2)':'var(--color-border)'}`,background:cohortTypes.includes(ct.id)?'var(--color-accent-dim)':'transparent',cursor:'pointer',marginBottom:6}}>
                        <input type="checkbox" checked={cohortTypes.includes(ct.id)} onChange={e=>setCohortTypes(p=>e.target.checked?[...p,ct.id]:p.filter(x=>x!==ct.id))} style={{accentColor:'var(--color-accent)',flexShrink:0}}/>
                        <div><div style={{fontSize:11,fontWeight:700,color:'var(--color-text-primary)'}}>{ct.label}</div><div style={{fontSize:9,color:'var(--color-text-secondary)'}}>{ct.desc}</div></div>
                      </label>
                    ))}
                  </div>
                  <div>
                    <div style={{fontSize:10,fontWeight:600,color:'var(--color-text-secondary)',marginBottom:6}}>Period Filter</div>
                    <div style={{display:'flex',gap:4,marginBottom:6}}>
                      {[['all','All'],['latest','Latest'],['fiscal_year','By FY']].map(([v,l])=>(
                        <button key={v} onClick={()=>setPeriodFilter(v)} style={{flex:1,padding:'5px 0',borderRadius:8,fontSize:10,fontWeight:600,border:`1px solid ${periodFilter===v?'var(--color-accent)':'var(--color-border)'}`,background:periodFilter===v?'var(--color-accent)':'transparent',color:periodFilter===v?'var(--color-background)':'var(--color-text-secondary)',cursor:'pointer'}}>{l}</button>
                      ))}
                    </div>
                    {periodFilter==='fiscal_year'&&<input value={selectedFY} onChange={e=>setSelectedFY(e.target.value)} placeholder="e.g. FY2024" style={{width:'100%',fontSize:11,border:'1px solid var(--color-border)',borderRadius:8,padding:'6px 10px',background:'var(--color-surface)',color:'var(--color-text-primary)',outline:'none'}}/>}
                  </div>
                  {[
                    [useSingle,setUseSingle,'Individual Cohorts','Cohort by single column',individualCols,setIndividualCols],
                  ].map(([checked,setChecked,title,desc,cols,setCols])=>(
                    <div key={title} style={{borderRadius:10,border:'1px solid var(--color-border)',overflow:'hidden'}}>
                      <label style={{display:'flex',alignItems:'center',gap:10,padding:12,cursor:'pointer',background:checked?'var(--color-surface-hover)':'transparent'}}>
                        <input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} style={{accentColor:'var(--color-accent)',flexShrink:0}}/>
                        <div><div style={{fontSize:11,fontWeight:700,color:'var(--color-text-primary)'}}>{title}</div><div style={{fontSize:9,color:'var(--color-text-secondary)'}}>{desc}</div></div>
                      </label>
                      {checked&&<div style={{padding:8,background:'var(--color-background)',display:'flex',flexDirection:'column',gap:6}}>
                        {cols.map((col,i)=>(
                          <div key={i} style={{display:'flex',gap:6}}>
                            <select value={col} onChange={e=>{const n=[...cols];n[i]=e.target.value;setCols(n)}} style={{flex:1,fontSize:10,border:'1px solid var(--color-border)',borderRadius:6,padding:'4px 8px',background:'var(--color-surface)',color:'var(--color-text-secondary)',outline:'none'}}>
                              <option value="">— Select column —</option>
                              {columns.map(c=><option key={c} value={c}>{c}</option>)}
                            </select>
                            {cols.length>1&&<button onClick={()=>setCols(p=>p.filter((_,j)=>j!==i))} style={{color:'var(--color-text-secondary)',background:'none',border:'none',cursor:'pointer',fontSize:12}}>✕</button>}
                          </div>
                        ))}
                        <button onClick={()=>setCols(p=>[...p,''])} style={{fontSize:10,color:'var(--color-accent)',background:'none',border:'none',cursor:'pointer',fontWeight:600,textAlign:'left'}}>+ Add column</button>
                      </div>}
                    </div>
                  ))}
                  <div style={{borderRadius:10,border:'1px solid var(--color-border)',overflow:'hidden'}}>
                    <label style={{display:'flex',alignItems:'center',gap:10,padding:12,cursor:'pointer',background:useMulti?'var(--color-surface-hover)':'transparent'}}>
                      <input type="checkbox" checked={useMulti} onChange={e=>setUseMulti(e.target.checked)} style={{accentColor:'var(--color-accent)',flexShrink:0}}/>
                      <div><div style={{fontSize:11,fontWeight:700,color:'var(--color-text-primary)'}}>Hierarchical Cohorts</div><div style={{fontSize:9,color:'var(--color-text-secondary)'}}>Multi-level combinations</div></div>
                    </label>
                    {useMulti&&<div style={{padding:8,background:'var(--color-background)',display:'flex',flexDirection:'column',gap:8}}>
                      {hierarchies.map((hier,hi)=>(
                        <div key={hi} style={{padding:8,background:'var(--color-surface)',borderRadius:8,border:'1px solid var(--color-border)'}}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                            <span style={{fontSize:10,color:'var(--color-text-secondary)',fontWeight:600}}>Hierarchy {hi+1}</span>
                            <button onClick={()=>setHierarchies(p=>p.filter((_,j)=>j!==hi))} style={{color:'var(--color-text-secondary)',background:'none',border:'none',cursor:'pointer'}}>✕</button>
                          </div>
                          {hier.map((col,ci)=>(
                            <div key={ci} style={{display:'flex',gap:6,alignItems:'center',marginBottom:4}}>
                              <span style={{fontSize:9,color:'var(--color-text-secondary)',width:16}}>L{ci+1}</span>
                              <select value={col} onChange={e=>{const n=hierarchies.map((h,j)=>j===hi?h.map((c,k)=>k===ci?e.target.value:c):h);setHierarchies(n)}} style={{flex:1,fontSize:10,border:'1px solid var(--color-border)',borderRadius:6,padding:'4px 8px',background:'var(--color-surface)',color:'var(--color-text-secondary)',outline:'none'}}>
                                <option value="">— Select —</option>{columns.map(c=><option key={c} value={c}>{c}</option>)}
                              </select>
                              {hier.length>1&&<button onClick={()=>setHierarchies(p=>p.map((h,j)=>j===hi?h.filter((_,k)=>k!==ci):h))} style={{color:'var(--color-text-secondary)',background:'none',border:'none',cursor:'pointer'}}>✕</button>}
                            </div>
                          ))}
                          <button onClick={()=>setHierarchies(p=>p.map((h,j)=>j===hi?[...h,'']:h))} style={{fontSize:10,color:'var(--color-accent)',background:'none',border:'none',cursor:'pointer',fontWeight:600}}>+ Add level</button>
                        </div>
                      ))}
                      <button onClick={()=>setHierarchies(p=>[...p,['']]) } style={{fontSize:10,color:'var(--color-accent)',background:'none',border:'none',cursor:'pointer',fontWeight:600}}>+ Add hierarchy</button>
                    </div>}
                  </div>
                </div>
              ):(
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  <div>
                    <div style={{fontSize:10,fontWeight:600,color:'var(--color-text-secondary)',marginBottom:8}}>Lookback Windows</div>
                    <div style={{display:'flex',gap:6}}>
                      {[1,3,6,12].map(lb=>(
                        <button key={lb} onClick={()=>setLookbacks(p=>p.includes(lb)?p.filter(x=>x!==lb):[...p,lb])} style={{flex:1,padding:'6px 0',borderRadius:10,fontSize:10,fontWeight:700,border:`1px solid ${lookbacks.includes(lb)?'var(--color-accent)':'var(--color-border)'}`,background:lookbacks.includes(lb)?'var(--color-accent)':'transparent',color:lookbacks.includes(lb)?'#fff':'var(--color-text-secondary)',cursor:'pointer'}}>{lb}M</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:10,fontWeight:600,color:'var(--color-text-secondary)',marginBottom:8}}>Revenue Units</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4}}>
                      {[['raw','As-is'],['thousands','÷1K'],['millions','÷1M']].map(([v,l])=>(
                        <button key={v} onClick={()=>setRevUnit(v)} style={{padding:'5px 0',borderRadius:8,fontSize:10,fontWeight:600,border:`1px solid ${revenueUnit===v?'rgba(123,97,255,0.4)':'var(--color-border)'}`,background:revenueUnit===v?'rgba(123,97,255,0.15)':'transparent',color:revenueUnit===v?'var(--color-accent)':'var(--color-text-secondary)',cursor:'pointer'}}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:4}}>
                    {['Annual','Quarter'].map(p=>(
                      <button key={p} onClick={()=>setPeriod(p)} style={{flex:1,padding:'6px 0',borderRadius:10,fontSize:10,fontWeight:700,border:`1px solid ${periodType===p?'rgba(0,180,216,0.4)':'var(--color-border)'}`,background:periodType===p?'rgba(0,180,216,0.12)':'transparent',color:periodType===p?'var(--color-accent)':'var(--color-text-secondary)',cursor:'pointer'}}>{p}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Run button */}
        <div style={{padding:16,borderTop:'1px solid var(--color-border)',flexShrink:0}}>
          {runErr&&<div style={{marginBottom:10,padding:10,borderRadius:10,border:'1px solid var(--color-negative-border)',background:'var(--color-negative-dim)',color:'var(--color-negative)',fontSize:10,display:'flex',gap:6}}><AlertCircle size={10} style={{flexShrink:0}}/>{runErr}</div>}
          <button onClick={runAnalysis} disabled={!step1||!step2||running} style={{
            width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8,
            fontWeight:700,fontSize:13,padding:'12px 0',borderRadius:14,border:'none',cursor:canRun?'pointer':'not-allowed',
            background:canRun?'var(--color-accent)':'var(--color-muted)',
            color:canRun?'#fff':'var(--color-text-secondary)',transition:'opacity 0.15s',
          }}>
            {running?<Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/>:<Zap size={14}/>}
            {running?'Analyzing…':'Run Analysis'}
          </button>
          {running&&<UploadTimer active={running}/>}
          {results&&!running&&(
            isAdmin?(
              <button onClick={downloadCSV} style={{width:'100%',marginTop:8,display:'flex',alignItems:'center',justifyContent:'center',gap:8,border:'1px solid #1E2D45',color:'var(--color-text-secondary)',fontWeight:600,fontSize:11,padding:'8px 0',borderRadius:12,background:'transparent',cursor:'pointer'}}>
                <Download size={11}/> Export CSV
              </button>
            ):(
              <button onClick={()=>router.push('/dashboard/upgrade')} style={{width:'100%',marginTop:8,display:'flex',alignItems:'center',justifyContent:'center',gap:8,border:'1px solid var(--color-border)',color:'var(--color-text-secondary)',fontWeight:600,fontSize:11,padding:'8px 0',borderRadius:12,background:'transparent',cursor:'pointer'}}>
                <Lock size={11}/> Export <span style={{marginLeft:'auto',fontSize:9,background:'rgba(244,162,97,0.1)',color:'var(--color-text-secondary)',border:'1px solid rgba(244,162,97,0.2)',padding:'2px 6px',borderRadius:10,fontWeight:700}}>PRO</span>
              </button>
            )
          )}
          {!results&&!running&&<button disabled style={{width:'100%',marginTop:8,display:'flex',alignItems:'center',justifyContent:'center',gap:8,border:'1px solid var(--color-border)',color:'var(--color-muted)',fontWeight:600,fontSize:11,padding:'8px 0',borderRadius:12,background:'transparent',cursor:'not-allowed'}}>
            <Lock size={11}/> Export <span style={{marginLeft:'auto',fontSize:9,background:'var(--color-border)',color:'var(--color-text-secondary)',padding:'2px 6px',borderRadius:10,fontWeight:700}}>PRO</span>
          </button>}
        </div>
      </aside>

      {/* ══ RIGHT PANEL ═══════════════════════════════════════════════════ */}
      <main style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column',background:'var(--color-background)'}}>

        {/* Header */}
        <header style={{height:56,display:'flex',alignItems:'center',padding:'0 24px',gap:16,flexShrink:0,borderBottom:'1px solid var(--color-border)',background:'var(--color-surface)'}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:'var(--color-text-primary)'}}>{isCohort?'Cohort Analytics':'Subscription Analytics'}</div>
            <div style={{fontSize:10,color:'var(--color-text-secondary)'}}>{isCohort?'Retention · Cohorts · Segmentation':'Revenue Bridge · Retention · Movers'}</div>
          </div>
          <div style={{flex:1}}/>
          {results&&(
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {!isCohort&&<>
                <div style={{display:'flex',gap:2,padding:3,background:'var(--color-surface)',borderRadius:12,border:'1px solid #1E2D45'}}>
                  {['Annual','Quarter'].map(p=>(
                    <button key={p} onClick={()=>setPeriod(p)} style={{padding:'5px 12px',borderRadius:9,fontSize:11,fontWeight:600,border:'none',cursor:'pointer',background:periodType===p?'var(--color-border)':'transparent',color:periodType===p?'white':'var(--color-text-secondary)'}}>{p==='Annual'?'YoY':'QoQ'}</button>
                  ))}
                </div>
                {fyYears.length>0&&<select value={yearFilter} onChange={e=>setYearFilter(e.target.value)} style={{fontSize:11,border:'1px solid #1E2D45',borderRadius:10,padding:'6px 12px',background:'var(--color-surface)',color:'var(--color-text-secondary)',outline:'none'}}>
                  <option value="All">All Years</option>
                  {fyYears.map(fy=><option key={String(fy)} value={String(fy)}>{String(fy)}</option>)}
                </select>}
                <div style={{display:'flex',gap:2,padding:3,background:'var(--color-surface)',borderRadius:12,border:'1px solid #1E2D45'}}>
                  {lookbacks.map(l=>(
                    <button key={l} onClick={()=>setSelLb(l)} style={{padding:'5px 10px',borderRadius:9,fontSize:11,fontWeight:600,border:'none',cursor:'pointer',background:selLb===l?'var(--color-accent)':'transparent',color:selLb===l?'#fff':'var(--color-text-secondary)'}}>{l}M</button>
                  ))}
                </div>
              </>}
              {isCohort&&fyYears.length>0&&<select value={yearFilter} onChange={e=>setYearFilter(e.target.value)} style={{fontSize:11,border:'1px solid #1E2D45',borderRadius:10,padding:'6px 12px',background:'var(--color-surface)',color:'var(--color-text-secondary)',outline:'none'}}>
                <option value="All">All Years</option>
                {fyYears.map(fy=><option key={String(fy)} value={String(fy)}>{String(fy)}</option>)}
              </select>}
              <button onClick={()=>{setResults(null);setFile(null);setColumns([]);setEngine(null);setFieldMap({})}} style={{padding:8,borderRadius:10,border:'none',background:'transparent',cursor:'pointer',color:'var(--color-text-secondary)'}}><RefreshCw size={13}/></button>
              {isAdmin?(
                <button onClick={downloadCSV} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,fontWeight:700,padding:'6px 14px',borderRadius:10,border:'none',cursor:'pointer',background:'var(--color-accent)',color:'var(--color-background)'}}>
                  <Download size={11}/> Export
                </button>
              ):(
                <button onClick={()=>router.push('/dashboard/upgrade')} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,fontWeight:600,color:'var(--color-text-secondary)',border:'1px solid #1E2D45',padding:'6px 14px',borderRadius:10,background:'transparent',cursor:'pointer'}}>
                  <Lock size={11}/> Upgrade
                </button>
              )}
            </div>
          )}
        </header>

        {/* ── EMPTY STATE ─────────────────────────────────────────────── */}
        {!results&&(
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:32}}>
            <div style={{textAlign:'center',maxWidth:480}}>
              <div style={{width:80,height:80,borderRadius:24,border:'1px solid #1E2D45',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 24px'}}><BarChart3 size={32} color="var(--color-accent)" style={{opacity:0.6}}/></div>
              <h2 style={{fontSize:24,fontWeight:900,color:'var(--color-text-primary)',margin:'0 0 8px',letterSpacing:'-0.02em'}}>{engine?ENGINE_CONFIG[engine].label:'Revenue Analytics'}</h2>
              <p style={{color:'var(--color-text-secondary)',fontSize:14,marginBottom:32,lineHeight:1.6}}>
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
                  <div key={i} style={{padding:16,borderRadius:14,border:'1px solid var(--color-border)',background:'var(--color-surface)',textAlign:'left'}}>
                    <m.icon size={15} color="var(--color-accent)" style={{opacity:0.8,marginBottom:8}}/>
                    <div style={{fontSize:12,fontWeight:700,color:'var(--color-text-primary)',marginBottom:3}}>{m.label}</div>
                    <div style={{fontSize:10,color:'var(--color-text-secondary)'}}>{m.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── RESULTS ──────────────────────────────────────────────────── */}
        {results&&(
          <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>

            {/* KPI Strip */}
            <div style={{padding:'14px 24px',borderBottom:'1px solid var(--color-border)',background:'var(--color-surface)',flexShrink:0}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:1,background:'var(--color-border)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-card)',overflow:'hidden'}}>
                {isCohort?(<>
                  <KpiChip label="Total Revenue"  value={fmt(results.summary?.total_revenue)} accent/>
                  <KpiChip label="Customers"      value={(results.summary?.n_customers||0).toLocaleString()}/>
                  <KpiChip label="Rev / Customer" value={fmt(results.summary?.rev_per_customer)}/>
                  <KpiChip label="Rows"           value={(results.summary?.rows_analyzed||0).toLocaleString()}/>
                  <KpiChip label="Cohort Columns" value={(results.summary?.cohort_cols?.length||0).toString()}/>
                  <KpiChip label="Fiscal Years"   value={(results.fiscal_years?.length||0).toString()}/>
                </>):(<>
                  <KpiChip label="Starting ARR"    value={fmt(ret?.beginning)} accent/>
                  <KpiChip label="Ending ARR"      value={fmt(ret?.ending)} sub={ret?.beginning>0?`${(((ret?.ending||0)-(ret?.beginning||0))/(ret?.beginning||1)*100).toFixed(1)}%`:null} subGood={(ret?.ending||0)>=(ret?.beginning||0)}/>
                  <KpiChip label="New ARR"         value={fmt(ret?.new_arr)} sub={ret?.new_arr>0?`+${fmt(ret?.new_arr)}`:null} subGood={true}/>
                  <KpiChip label="Lost ARR"        value={fmt(Math.abs(ret?.lost_arr||0))} sub={ret?.lost_arr<0?fmt(ret?.lost_arr):null} subGood={false}/>
                  <KpiChip label="Net Retention"   value={fmtPct(ret?.nrr)} sub={(ret?.nrr||0)>=100?'Healthy':'At Risk'} subGood={(ret?.nrr||0)>=100}/>
                  <KpiChip label="Gross Retention" value={fmtPct(ret?.grr)} sub={(ret?.grr||0)>=80?'Strong':'Alert'} subGood={(ret?.grr||0)>=80}/>
                </>)}
              </div>
            </div>

            {/* Tab bar */}
            <div style={{display:'flex',borderBottom:'1px solid var(--color-border)',background:'var(--color-surface)',flexShrink:0,paddingLeft:24}}>
              {TABS.map(tab=>(
                <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{
                  padding:'12px 16px',fontSize:12,fontWeight:600,border:'none',
                  borderBottom:`2px solid ${activeTab===tab.id?'var(--color-accent)':'transparent'}`,
                  background:'transparent',cursor:'pointer',marginBottom:-1,marginRight:4,
                  color:activeTab===tab.id?'var(--color-accent)':'var(--color-text-secondary)',transition:'color 0.15s',
                }}>{tab.label}</button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{flex:1,overflowY:'auto',padding:24}}>

              {/* COHORT: Heatmap */}
              {isCohort&&activeTab==='heatmap'&&(
                <div style={{display:'flex',flexDirection:'column',gap:20}}>
                  <div style={S.card}><CohortHeatmap data={results.retention} title="Retention Rate % by Cohort" isPercent={true}/></div>
                  {results.heatmap?.length>0&&<div style={S.card}><CohortHeatmap data={results.heatmap} title="Customer Count by Cohort" isPercent={false}/></div>}
                </div>
              )}

              {/* COHORT: Revenue */}
              {isCohort&&activeTab==='revenue_heatmap'&&(
                <div>
                  {results.fy_summary?.length>0?(
                    <div style={S.card}>
                      <div style={{...S.label,marginBottom:20}}>Revenue by Fiscal Year</div>
                      <div style={{height:220,marginBottom:24}}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={results.fy_summary}>
                            <CartesianGrid strokeDasharray="2 4" stroke='var(--color-border)' vertical={false}/>
                            <XAxis dataKey={Object.keys(results.fy_summary[0])[0]} tick={{fontSize:10,fill:'var(--color-text-secondary)'}} axisLine={false} tickLine={false}/>
                            <YAxis tickFormatter={fmt} tick={{fontSize:10,fill:'var(--color-text-secondary)'}} axisLine={false} tickLine={false}/>
                            <Tooltip formatter={v=>fmt(v)} contentStyle={{background:'var(--color-surface)',border:'1px solid #1E2D45',borderRadius:12,fontSize:12}}/>
                            <Bar dataKey="revenue" fill="#00E5A0" radius={[5,5,0,0]}/>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
                        <thead><tr style={{borderBottom:'1px solid #1E2D45'}}>{['FY','Revenue','Customers','Rev/Customer'].map(h=><th key={h} style={{textAlign:'left',padding:'8px 12px',fontSize:9,fontWeight:700,textTransform:'uppercase',color:'var(--color-text-secondary)'}}>{h}</th>)}</tr></thead>
                        <tbody>{results.fy_summary.map((row,i)=>(
                          <tr key={i} style={{borderBottom:'1px solid #0F1924'}}>
                            <td style={{padding:'10px 12px',fontWeight:700,color:'var(--color-text-primary)'}}>{String(Object.values(row)[0])}</td>
                            <td style={{padding:'10px 12px',color:'var(--color-positive)',fontWeight:600,fontFamily:'var(--font-mono)'}}>{fmt(row.revenue)}</td>
                            <td style={{padding:'10px 12px',color:'var(--color-text-secondary)',fontFamily:'var(--font-mono)'}}>{row.customers?.toLocaleString()}</td>
                            <td style={{padding:'10px 12px',color:'var(--color-text-secondary)',fontFamily:'var(--font-mono)'}}>{fmt(row.rev_per_customer)}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  ):<div style={{...S.card,textAlign:'center',color:'var(--color-text-secondary)',fontSize:13,padding:40}}>No fiscal year data. Ensure Fiscal Year column is mapped.</div>}
                </div>
              )}

              {/* COHORT: Segmentation */}
              {isCohort&&activeTab==='segmentation'&&results.segmentation?.length>0&&(
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
                  <div style={S.card}>
                    <div style={{...S.label,marginBottom:16}}>Revenue Segmentation</div>
                    <div style={{height:200}}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={results.segmentation} dataKey={Object.keys(results.segmentation[0]).find(k=>k!=='segment')||''} nameKey="segment" cx="50%" cy="50%" outerRadius={80} innerRadius={36}>
                            {results.segmentation.map((_,i)=><Cell key={i} fill={['var(--color-accent)','var(--color-accent)','var(--color-accent)','var(--color-text-secondary)','var(--color-negative)','var(--color-negative)'][i%6]}/>)}
                          </Pie>
                          <Tooltip formatter={v=>fmt(v)} contentStyle={{background:'var(--color-surface)',border:'1px solid #1E2D45',borderRadius:12}}/>
                          <Legend iconType="circle" wrapperStyle={{fontSize:11}}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* COHORT: Summary */}
              {isCohort&&activeTab==='summary'&&results.fy_summary?.length>0&&(
                <div style={S.card}>
                  <div style={{...S.label,marginBottom:16}}>Summary by Fiscal Year</div>
                  <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
                    <thead><tr style={{borderBottom:'1px solid #1E2D45'}}>{['FY','Revenue','Customers','Rev/Customer'].map(h=><th key={h} style={{textAlign:'left',padding:'8px 12px',fontSize:9,fontWeight:700,textTransform:'uppercase',color:'var(--color-text-secondary)'}}>{h}</th>)}</tr></thead>
                    <tbody>{results.fy_summary.map((row,i)=>(
                      <tr key={i} style={{borderBottom:'1px solid #0F1924'}}>
                        <td style={{padding:'10px 12px',fontWeight:700,color:'var(--color-text-primary)'}}>{String(Object.values(row)[0])}</td>
                        <td style={{padding:'10px 12px',color:'var(--color-positive)',fontWeight:600,fontFamily:'var(--font-mono)'}}>{fmt(row.revenue)}</td>
                        <td style={{padding:'10px 12px',color:'var(--color-text-secondary)',fontFamily:'var(--font-mono)'}}>{row.customers?.toLocaleString()}</td>
                        <td style={{padding:'10px 12px',color:'var(--color-text-secondary)',fontFamily:'var(--font-mono)'}}>{fmt(row.rev_per_customer)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}

              {/* MRR: SUMMARY */}
              {!isCohort&&activeTab==='summary'&&(
                <div style={{display:'flex',flexDirection:'column',gap:20}}>
                  {narrative&&(
                    <div style={{padding:'14px 18px',background:'var(--color-surface)',border:'1px solid var(--color-border)',borderLeft:'3px solid var(--color-accent)',borderRadius:'var(--radius-card)'}}>
                      <div style={{...S.label,marginBottom:6}}>Revenue Insight</div>
                      <p style={{margin:0,fontSize:13,color:'var(--color-text-primary)',lineHeight:1.6,fontWeight:400}}>{narrative}</p>
                    </div>
                  )}
                  {results?.metadata&&(
                    <div style={{padding:'10px 16px',borderRadius:12,border:'1px solid #1E2D45',background:'var(--color-surface)',display:'flex',alignItems:'center',gap:10}}>
                      <Info size={11} color="#4A5A7A"/>
                      <span style={{fontSize:11,color:'var(--color-text-secondary)'}}>
                        <span style={{color:'var(--color-text-primary)',fontWeight:600}}>{results.metadata.dimensions?.length>0?`Customer × ${results.metadata.dimensions.join(' × ')}`:'Customer level'}</span>
                        {' · '}{results.metadata.row_count?.toLocaleString()} rows
                        {' · '}<span style={{color:'var(--color-text-secondary)'}}>{results.metadata.classifications?.filter(c=>!['Beginning MRR','Ending MRR','Beginning ARR','Ending ARR'].includes(c)).join(', ')}</span>
                      </span>
                    </div>
                  )}
                  {results?.pivot?.['3']?.bridge_pivot&&(
                    <div style={S.card}>
                      <BridgePivotTable pivot={results.pivot['3'].bridge_pivot} title="ARR Waterfall" lookbackLabel="QoQ (3M)" showPct={false}/>
                      <CustomerCountPivot pivot={results.pivot['3'].customer_pivot}/>
                    </div>
                  )}
                  {results?.pivot?.['12']?.bridge_pivot&&(
                    <div style={S.card}>
                      <BridgePivotTable pivot={results.pivot['12'].bridge_pivot} title="ARR Waterfall" lookbackLabel="YoY (12M)" showPct={true}/>
                      <CustomerCountPivot pivot={results.pivot['12'].customer_pivot}/>
                    </div>
                  )}
                  {!results?.pivot&&(
                    <div style={S.card}>
                      <div style={{...S.label,marginBottom:16}}>Revenue Bridge</div>
                      <WaterfallBridge data={wfall}/>
                    </div>
                  )}
                </div>
              )}

              {/* MRR: BRIDGE */}
              {!isCohort&&activeTab==='bridge'&&(
                <div style={{display:'flex',flexDirection:'column',gap:20}}>
                  {bdg?.by_period?.length>0&&(
                    <div style={S.card}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                        <div style={S.label}>Bridge Trend</div>
                        <span style={{fontSize:9,color:'var(--color-text-secondary)'}}>{periodType} · {selLb}M</span>
                      </div>
                      <div style={{height:240}}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={bdg.by_period} margin={{left:8,right:8,bottom:8}}>
                            <CartesianGrid strokeDasharray="2 4" stroke='var(--color-border)' vertical={false}/>
                            <XAxis dataKey="_period" tick={{fontSize:10,fill:'var(--color-text-secondary)'}} axisLine={false} tickLine={false}/>
                            <YAxis tickFormatter={fmt} tick={{fontSize:10,fill:'var(--color-text-secondary)'}} width={48} axisLine={false} tickLine={false}/>
                            <Tooltip formatter={v=>fmt(Number(v))} contentStyle={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:7,fontSize:11,color:'var(--color-text-primary)'}}/>
                            <Legend iconType="circle" wrapperStyle={{fontSize:10}}/>
                            {['New Logo','Upsell','Cross-sell','Returning','Downsell','Churn','Churn Partial'].map(cat=>(
                              <Bar key={cat} dataKey={cat} stackId="a" fill={BC[cat]||'var(--color-text-secondary)'} name={cat}/>
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-card)',padding:0,overflow:'hidden'}}>
                    <div style={{padding:'14px 24px',borderBottom:'1px solid #1E2D45'}}><div style={S.label}>Waterfall Breakdown</div></div>
                    <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
                      <thead><tr style={{borderBottom:'1px solid #1E2D45'}}>
                        {['Classification','Value','% of Total'].map((h,i)=><th key={h} style={{textAlign:i===0?'left':'right',padding:'10px 20px',fontSize:9,fontWeight:700,textTransform:'uppercase',color:'var(--color-text-secondary)'}}>{h}</th>)}
                      </tr></thead>
                      <tbody>{wfall.sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)).map((row,i)=>{
                        const total=wfall.reduce((s,r)=>s+Math.abs(r.value),0)
                        return (
                          <tr key={i} style={{borderBottom:'1px solid #0F1924'}}>
                            <td style={{padding:'10px 20px',display:'flex',alignItems:'center',gap:10}}>
                              <span style={{width:8,height:8,borderRadius:'50%',background:BC[row.category]||'var(--color-text-secondary)',flexShrink:0}}/>
                              <span style={{fontWeight:600,color:'var(--color-text-primary)',fontSize:12}}>{row.category}</span>
                            </td>
                            <td style={{textAlign:'right',padding:'10px 20px',fontWeight:700,fontSize:12,fontFamily:'var(--font-mono)',color:row.value>=0?'var(--color-positive)':'var(--color-negative)'}}>{row.value>=0?'+':''}{fmt(row.value)}</td>
                            <td style={{textAlign:'right',padding:'10px 20px',color:'var(--color-text-secondary)',fontSize:11,fontFamily:'var(--font-mono)'}}>{total>0?((Math.abs(row.value)/total)*100).toFixed(1):0}%</td>
                          </tr>
                        )
                      })}</tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* MRR: RETENTION */}
              {!isCohort&&activeTab==='retention'&&(
                <div style={{display:'flex',flexDirection:'column',gap:20}}>
                  {kpiRows.length>0&&(
                    <div style={S.card}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                        <div style={S.label}>Retention Trends</div>
                        <div style={{display:'flex',gap:16,fontSize:10,color:'var(--color-text-secondary)'}}>
                          <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:14,height:2,background:'var(--color-accent)',display:'inline-block'}}/>NRR</span>
                          <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:14,height:2,background:'var(--color-positive)',display:'inline-block'}}/>GRR</span>
                        </div>
                      </div>
                      <div style={{height:220}}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={kpiRows} margin={{left:8,right:8}}>
                            <defs>
                              <linearGradient id="nG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor='var(--color-accent)' stopOpacity={0.3}/><stop offset="95%" stopColor='var(--color-accent)' stopOpacity={0}/></linearGradient>
                              <linearGradient id="gG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor='var(--color-positive)' stopOpacity={0.2}/><stop offset="95%" stopColor='var(--color-positive)' stopOpacity={0}/></linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="2 4" stroke='var(--color-border)' vertical={false}/>
                            <XAxis dataKey="period" tick={{fontSize:10,fill:'var(--color-text-secondary)'}} axisLine={false} tickLine={false}/>
                            <YAxis tickFormatter={v=>`${v}%`} tick={{fontSize:10,fill:'var(--color-text-secondary)'}} domain={[0,130]} width={40} axisLine={false} tickLine={false}/>
                            <ReferenceLine y={100} stroke="#2A3D55" strokeDasharray="4 4"/>
                            <Tooltip formatter={v=>`${Number(v).toFixed(1)}%`} contentStyle={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:7,fontSize:11,color:'var(--color-text-primary)'}}/>
                            <Area type="monotone" dataKey="nrr" stroke="var(--color-accent)" strokeWidth={2} fill="url(#nG)" dot={{r:3,fill:'var(--color-accent)'}} name="NRR"/>
                            <Area type="monotone" dataKey="grr" stroke="var(--color-positive)" strokeWidth={2} fill="url(#gG)" dot={{r:3,fill:'var(--color-positive)'}} name="GRR"/>
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  {kpiRows.length>0&&(
                    <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-card)',padding:0,overflow:'hidden'}}>
                      <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
                        <thead><tr style={{borderBottom:'1px solid #1E2D45'}}>
                          {['Period','Beginning','Ending','New Logo','Upsell','Downsell','Churn','GRR','NRR'].map(h=>(
                            <th key={h} style={{padding:'10px 16px',textAlign:'left',fontSize:9,fontWeight:700,textTransform:'uppercase',color:'var(--color-text-secondary)',whiteSpace:'nowrap'}}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>{kpiRows.map((row,i)=>(
                          <tr key={i} style={{borderBottom:'1px solid #0F1924'}}>
                            <td style={{padding:'8px 16px',fontWeight:700,color:'var(--color-text-primary)',fontFamily:'var(--font-mono)'}}>{row.period}</td>
                            <td style={{padding:'8px 16px',color:'var(--color-text-secondary)',fontFamily:'var(--font-mono)'}}>{fmt(row.beginning)}</td>
                            <td style={{padding:'8px 16px',color:'var(--color-text-secondary)',fontFamily:'var(--font-mono)'}}>{fmt(row.ending)}</td>
                            <td style={{padding:'8px 16px',color:'var(--color-positive)',fontWeight:600,fontFamily:'var(--font-mono)'}}>{row.new_logo?`+${fmt(row.new_logo)}`:'—'}</td>
                            <td style={{padding:'8px 16px',color:'var(--color-accent)',fontWeight:600,fontFamily:'var(--font-mono)'}}>{row.upsell?`+${fmt(row.upsell)}`:'—'}</td>
                            <td style={{padding:'8px 16px',color:'var(--color-text-secondary)',fontWeight:600,fontFamily:'var(--font-mono)'}}>{row.downsell?fmt(row.downsell):'—'}</td>
                            <td style={{padding:'8px 16px',color:'var(--color-negative)',fontWeight:600,fontFamily:'var(--font-mono)'}}>{row.churn?fmt(row.churn):'—'}</td>
                            <td style={{padding:'8px 16px',fontWeight:700,fontFamily:'var(--font-mono)',color:(row.grr||0)>=80?'var(--color-positive)':'var(--color-negative)'}}>{fmtPct(row.grr)}</td>
                            <td style={{padding:'8px 16px',fontWeight:700,fontFamily:'var(--font-mono)',color:(row.nrr||0)>=100?'var(--color-positive)':'var(--color-text-secondary)'}}>{fmtPct(row.nrr)}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* MRR: TOP MOVERS — hero two-column layout */}
              {!isCohort&&activeTab==='top_movers'&&(
                <div style={{display:'flex',flexDirection:'column',gap:20}}>
                  {/* Category pills */}
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    {Object.keys(movers).map(cat=>(
                      <button key={cat} onClick={()=>setMoverCat(cat)} style={{
                        display:'flex',alignItems:'center',gap:8,padding:'7px 14px',borderRadius:12,fontSize:11,fontWeight:600,
                        border:`1px solid ${moverCat===cat?'rgba(0,229,160,0.3)':'var(--color-border)'}`,
                        background:moverCat===cat?'rgba(0,229,160,0.08)':'var(--color-surface)',
                        color:moverCat===cat?'var(--color-accent)':'var(--color-text-secondary)',cursor:'pointer',
                      }}>
                        <span style={{width:7,height:7,borderRadius:'50%',background:BC[cat]||'var(--color-text-secondary)'}}/>
                        {cat}
                        <span style={{fontSize:9,padding:'1px 7px',borderRadius:10,fontWeight:700,background:moverCat===cat?'rgba(0,229,160,0.15)':'var(--color-border)',color:moverCat===cat?'var(--color-accent)':'var(--color-text-secondary)'}}>{(movers[cat]||[]).length}</span>
                      </button>
                    ))}
                  </div>

                  {/* Two-column: expansion | churn */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
                    {/* Expansion */}
                    <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-card)',padding:0,overflow:'hidden'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid #1E2D45'}}>
                        <div>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                            <TrendingUp size={13} color="var(--color-accent)"/>
                            <span style={{fontSize:13,fontWeight:700,color:'var(--color-text-primary)'}}>Expansion Opportunities</span>
                          </div>
                          <div style={{fontSize:9,color:'var(--color-text-secondary)',textTransform:'uppercase',letterSpacing:'0.1em'}}>High upsell potential</div>
                        </div>
                        <span style={{fontSize:9,background:'rgba(0,229,160,0.1)',color:'var(--color-accent)',border:'1px solid rgba(0,229,160,0.2)',padding:'3px 10px',borderRadius:20,fontWeight:700}}>{expansionList.length} accounts</span>
                      </div>
                      <div style={{padding:16}}>
                        {expansionList.length?expansionList.map((row,i)=><MoverCard key={i} customer={row.customer} value={row.value} period={row.period} isRisk={false} rank={i}/>)
                        :<div style={{textAlign:'center',color:'var(--color-text-secondary)',fontSize:13,padding:32}}>No expansion data for selected lookback</div>}
                      </div>
                    </div>

                    {/* Churn Risk */}
                    <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-card)',padding:0,overflow:'hidden'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid #1E2D45'}}>
                        <div>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                            <TrendingDown size={13} color="#FF4757"/>
                            <span style={{fontSize:13,fontWeight:700,color:'var(--color-text-primary)'}}>Churn Risk</span>
                          </div>
                          <div style={{fontSize:9,color:'var(--color-text-secondary)',textTransform:'uppercase',letterSpacing:'0.1em'}}>Priority interventions</div>
                        </div>
                        <span style={{fontSize:9,background:'rgba(255,71,87,0.1)',color:'var(--color-negative)',border:'1px solid rgba(255,71,87,0.2)',padding:'3px 10px',borderRadius:20,fontWeight:700}}>{churnList.length} accounts</span>
                      </div>
                      <div style={{padding:16}}>
                        {churnList.length?churnList.map((row,i)=><MoverCard key={i} customer={row.customer} value={row.value} period={row.period} isRisk={true} rank={i}/>)
                        :<div style={{textAlign:'center',color:'var(--color-text-secondary)',fontSize:13,padding:32}}>No churn data for selected lookback</div>}
                      </div>
                    </div>
                  </div>

                  {/* Full moverCat table fallback */}
                  {moverCat&&movers[moverCat]?.length>0&&(
                    <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-card)',padding:0,overflow:'hidden'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10,padding:'14px 20px',borderBottom:'1px solid #1E2D45'}}>
                        <span style={{width:8,height:8,borderRadius:'50%',background:BC[moverCat]||'var(--color-text-secondary)'}}/>
                        <div style={S.label}>All {moverCat}</div>
                      </div>
                      <div style={{overflowX:'auto'}}>
                        <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
                          <thead><tr style={{borderBottom:'1px solid #1E2D45'}}>
                            {Object.keys(movers[moverCat][0]).filter(k=>k!=='value'&&k!=='period').map(k=>(
                              <th key={k} style={{textAlign:'left',padding:'10px 16px',fontSize:9,fontWeight:700,textTransform:'uppercase',color:'var(--color-text-secondary)'}}>{k}</th>
                            ))}
                            <th style={{textAlign:'right',padding:'10px 16px',fontSize:9,fontWeight:700,textTransform:'uppercase',color:'var(--color-text-secondary)'}}>Period</th>
                            <th style={{textAlign:'right',padding:'10px 16px',fontSize:9,fontWeight:700,textTransform:'uppercase',color:'var(--color-text-secondary)'}}>Value</th>
                          </tr></thead>
                          <tbody>{movers[moverCat].slice(0,30).map((row,i)=>(
                            <tr key={i} style={{borderBottom:'1px solid #0F1924'}}>
                              {Object.keys(row).filter(k=>k!=='value'&&k!=='period').map(k=>(
                                <td key={k} style={{padding:'8px 16px',color:'var(--color-text-secondary)',fontSize:11}}>{row[k]??'—'}</td>
                              ))}
                              <td style={{textAlign:'right',padding:'8px 16px',color:'var(--color-text-secondary)',fontSize:11,fontFamily:'var(--font-mono)'}}>{row.period||'—'}</td>
                              <td style={{textAlign:'right',padding:'8px 16px',fontWeight:700,fontSize:12,fontFamily:'var(--font-mono)',color:row.value>=0?'var(--color-positive)':'var(--color-negative)'}}>{row.value>=0?'+':''}{fmt(row.value)}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MRR: TOP CUSTOMERS */}
              {!isCohort&&activeTab==='top_customers'&&(
                <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-card)',padding:0,overflow:'hidden'}}>
                  <div style={{padding:'14px 20px',borderBottom:'1px solid #1E2D45'}}><div style={S.label}>Top Customers by Ending ARR</div></div>
                  {topCusts.length>0?(
                    <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
                      <thead><tr style={{borderBottom:'1px solid #1E2D45'}}>
                        <th style={{textAlign:'left',padding:'10px 20px',fontSize:9,fontWeight:700,textTransform:'uppercase',color:'var(--color-text-secondary)'}}>#</th>
                        {Object.keys(topCusts[0]).map(k=><th key={k} style={{textAlign:'left',padding:'10px 20px',fontSize:9,fontWeight:700,textTransform:'uppercase',color:'var(--color-text-secondary)'}}>{k}</th>)}
                      </tr></thead>
                      <tbody>{topCusts.map((row,i)=>(
                        <tr key={i} style={{borderBottom:'1px solid #0F1924'}}>
                          <td style={{padding:'10px 20px',color:'var(--color-text-secondary)',fontWeight:600,fontSize:11}}>#{i+1}</td>
                          {Object.values(row).map((val,j)=>(
                            <td key={j} style={{padding:'10px 20px',color:typeof val==='number'?'white':'var(--color-text-secondary)',fontWeight:typeof val==='number'?700:400,fontFamily:typeof val==='number'?'DM Mono,monospace':'inherit'}}>
                              {typeof val==='number'?fmt(val):val??'—'}
                            </td>
                          ))}
                        </tr>
                      ))}</tbody>
                    </table>
                  ):<div style={{padding:40,textAlign:'center',color:'var(--color-text-secondary)',fontSize:13}}>No customer data available.</div>}
                </div>
              )}

              {/* MRR: KPI MATRIX */}
              {!isCohort&&activeTab==='kpi_matrix'&&(
                <div style={{display:'flex',flexDirection:'column',gap:20}}>
                  {lookbacks.map(lb=>{
                    const kpiData=results?.pivot?.[String(lb)]?.kpi_table
                    if(!kpiData?.length) return null
                    return (
                      <div key={lb} style={S.card}>
                        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
                          <div style={S.label}>KPI Summary</div>
                          <span style={{fontSize:9,background:'rgba(0,229,160,0.1)',color:'var(--color-accent)',border:'1px solid rgba(0,229,160,0.2)',padding:'2px 8px',borderRadius:20,fontWeight:600}}>{lb}M Lookback</span>
                        </div>
                        <KpiSummaryTable rows={kpiData}/>
                      </div>
                    )
                  })}
                  {!results?.pivot&&kpiRows.length>0&&(
                    <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-card)',padding:0,overflow:'hidden'}}>
                      <div style={{padding:'14px 20px',borderBottom:'1px solid #1E2D45'}}><div style={S.label}>KPI Matrix — {periodType}</div></div>
                      <div style={{overflowX:'auto'}}>
                        <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
                          <thead><tr style={{borderBottom:'1px solid #1E2D45'}}>
                            {['Period','Beginning','Ending','New Logo','Upsell','Downsell','Churn','GRR','NRR'].map(h=>(
                              <th key={h} style={{padding:'10px 16px',textAlign:'left',fontSize:9,fontWeight:700,textTransform:'uppercase',color:'var(--color-text-secondary)',whiteSpace:'nowrap'}}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>{kpiRows.map((row,i)=>(
                            <tr key={i} style={{borderBottom:'1px solid #0F1924'}}>
                              <td style={{padding:'8px 16px',fontWeight:700,color:'var(--color-text-primary)',fontFamily:'var(--font-mono)'}}>{row.period}</td>
                              <td style={{padding:'8px 16px',color:'var(--color-text-secondary)',fontFamily:'var(--font-mono)'}}>{fmt(row.beginning)}</td>
                              <td style={{padding:'8px 16px',color:'var(--color-text-secondary)',fontFamily:'var(--font-mono)'}}>{fmt(row.ending)}</td>
                              <td style={{padding:'8px 16px',color:'var(--color-positive)',fontWeight:600,fontFamily:'var(--font-mono)'}}>{row.new_logo?`+${fmt(row.new_logo)}`:'—'}</td>
                              <td style={{padding:'8px 16px',color:'var(--color-accent)',fontWeight:600,fontFamily:'var(--font-mono)'}}>{row.upsell?`+${fmt(row.upsell)}`:'—'}</td>
                              <td style={{padding:'8px 16px',color:'var(--color-text-secondary)',fontWeight:600,fontFamily:'var(--font-mono)'}}>{row.downsell?fmt(row.downsell):'—'}</td>
                              <td style={{padding:'8px 16px',color:'var(--color-negative)',fontWeight:600,fontFamily:'var(--font-mono)'}}>{row.churn?fmt(row.churn):'—'}</td>
                              <td style={{padding:'8px 16px',fontWeight:700,fontFamily:'var(--font-mono)',color:(row.grr||0)>=80?'var(--color-positive)':'var(--color-negative)'}}>{fmtPct(row.grr)}</td>
                              <td style={{padding:'8px 16px',fontWeight:700,fontFamily:'var(--font-mono)',color:(row.nrr||0)>=100?'var(--color-positive)':'var(--color-text-secondary)'}}>{fmtPct(row.nrr)}</td>
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
                <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-card)',padding:0,overflow:'hidden'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',borderBottom:'1px solid #1E2D45'}}>
                    <div style={S.label}>Output — {results.output?.length?.toLocaleString()} rows</div>
                    {isAdmin?(
                      <button onClick={downloadCSV} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,fontWeight:700,padding:'6px 14px',borderRadius:10,border:'none',cursor:'pointer',background:'var(--color-accent)',color:'var(--color-background)'}}>
                        <Download size={11}/> Export CSV
                      </button>
                    ):(
                      <button onClick={()=>router.push('/dashboard/upgrade')} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,fontWeight:600,color:'var(--color-text-secondary)',background:'var(--color-border)',border:'none',padding:'6px 14px',borderRadius:10,cursor:'pointer'}}>
                        <Lock size={11}/> Upgrade to Export
                      </button>
                    )}
                  </div>
                  {results.output?.length>0?(
                    <div style={{overflowX:'auto',maxHeight:500,overflowY:'auto'}}>
                      <table style={{borderCollapse:'collapse',width:'100%',fontSize:11}}>
                        <thead style={{position:'sticky',top:0,background:'var(--color-surface)',zIndex:1}}>
                          <tr style={{borderBottom:'1px solid #1E2D45'}}>
                            {Object.keys(results.output[0]).map(col=>(
                              <th key={col} style={{textAlign:'left',padding:'10px 14px',fontSize:9,fontWeight:700,textTransform:'uppercase',color:'var(--color-text-secondary)',whiteSpace:'nowrap',background:'var(--color-surface-hover)'}}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>{results.output.slice(0,200).map((row,i)=>(
                          <tr key={i} style={{borderBottom:'1px solid #0A1020'}}>
                            {Object.values(row).map((val,j)=>(
                              <td key={j} style={{padding:'7px 14px',color:'var(--color-text-secondary)',whiteSpace:'nowrap',fontFamily:typeof val==='number'?'DM Mono,monospace':'inherit'}}>{val??'—'}</td>
                            ))}
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  ):<div style={{padding:40,textAlign:'center',color:'var(--color-text-secondary)',fontSize:13}}>No output data available.</div>}
                </div>
              )}

            </div>{/* end tab content */}
          </div>
        )}
      </main>
    </div>
  )
}
