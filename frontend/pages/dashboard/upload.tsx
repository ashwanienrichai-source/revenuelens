// @ts-nocheck
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, CheckCircle, ArrowRight, AlertCircle, Users, Loader2, AlertTriangle, Search, Edit2, X, Check, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import { supabase } from '../../lib/supabase'
import { dataCubeStore } from '../../lib/dataCubeStore'

// ── Types ─────────────────────────────────────────────────────────────────────
const DATASET_TYPES = [
  { id: 'revenue',  label: 'Revenue Dataset',  desc: 'ARR / MRR / Subscription revenue' },
  { id: 'billing',  label: 'Billing Dataset',  desc: 'Invoices, billing amounts' },
  { id: 'bookings', label: 'Bookings Dataset', desc: 'ACV / TCV / Contract records' },
]
const FIELDS = [
  { key: 'customer', label: 'Customer Column',   required: true },
  { key: 'date',     label: 'Date Column',        required: true },
  { key: 'revenue',  label: 'Revenue Column',     required: true },
  { key: 'product',  label: 'Product Column',     required: false },
  { key: 'channel',  label: 'Channel Column',     required: false },
  { key: 'region',   label: 'Region Column',      required: false },
  { key: 'fiscal',   label: 'Fiscal Year Column', required: false },
  { key: 'quantity', label: 'Quantity Column',    required: false },
]
const STEPS = [
  { id: 'upload',   label: 'Upload' },
  { id: 'analysis', label: 'Analysis Type' },
  { id: 'map',      label: 'Map Fields' },
  { id: 'quality',  label: 'Data Quality' },
  { id: 'review',   label: 'Review' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// SIX-LAYER FUZZY ENGINE — full port from mapper.js
// ═══════════════════════════════════════════════════════════════════════════════
function cleanEntity(str) {
  let s = String(str).toUpperCase().trim()
  if (!s) return ''
  s = s.replace(/\*\*\s*SEE\s+([^*]+)\s*\*\*/g, '$1')
  s = s.replace(/\bA\/R\b/g,' ').replace(/\bPO\s*[A-Z0-9\-]+\b/g,' ')
       .replace(/\*/g,' ').replace(/\.COM|\.NET|\.ORG/g,' ')
  s = s.replace(/\([^)]+\)/g,' ').replace(/&/g,' AND ').replace(/[^\w\s\-]/g,' ')
  s = s.replace(/\bUNIV\b/g,'UNIVERSITY').replace(/\bINTL\b/g,'INTERNATIONAL')
       .replace(/\bTECH\b/g,'TECHNOLOGIES').replace(/\bGRP\b/g,'GROUP')
       .replace(/\bCTR\b/g,'CENTER').replace(/\bMFG\b/g,'MANUFACTURING')
  const suf = /\b(INC|LLC|LLP|LTD|LIMITED|CORP|CORPORATION|CO|COMPANY|PA|PLLC|PLC|GMBH|AG|SA|BV|HOLDINGS|GROUP|INTERNATIONAL|ENTERPRISES|SERVICES|LP|LC)\b/g
  s = s.replace(suf,' ')
  return s.replace(/\s+/g,' ').trim()
}

function standardLev(a, b) {
  if (!a||!b) return 0
  if (a===b) return 1
  const la=a.length, lb=b.length
  const d = Array.from({length:la+1},()=>new Uint16Array(lb+1))
  for(let i=0;i<=la;i++) d[i][0]=i
  for(let j=0;j<=lb;j++) d[0][j]=j
  for(let i=1;i<=la;i++) for(let j=1;j<=lb;j++)
    d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1))
  return 1 - d[la][lb]/Math.max(la,lb)
}

function tokenSetRatio(s1, s2) {
  const t1=s1.split(' ').filter(x=>x), t2=s2.split(' ').filter(x=>x)
  const inter=t1.filter(x=>t2.includes(x))
  const d1=t1.filter(x=>!t2.includes(x)), d2=t2.filter(x=>!t1.includes(x))
  return Math.max(
    standardLev(inter.join(' '),[...inter,...d1].join(' ')),
    standardLev(inter.join(' '),[...inter,...d2].join(' ')),
    standardLev([...inter,...d1].join(' '),[...inter,...d2].join(' '))
  )
}

function soundex(s) {
  if(!s) return ''
  const codes={A:'',E:'',I:'',O:'',U:'',B:1,F:1,P:1,V:1,C:2,G:2,J:2,K:2,Q:2,S:2,X:2,Z:2,D:3,T:3,L:4,M:5,N:5,R:6}
  const a=s.split(''), f=a.shift()
  const r=f+a.map(v=>codes[v]).filter((v,i,arr)=>(i===0?v!==codes[f]:v!==arr[i-1])).filter(v=>v!=='').join('')
  return (r+'000').slice(0,4)
}
function multiSoundex(str) { return str.split(' ').map(soundex).join(' ') }

function jaroWinkler(s1, s2) {
  if(s1===s2) return 1
  const l1=s1.length, l2=s2.length
  if(!l1||!l2) return 0
  const mw=Math.max(0,Math.floor(Math.max(l1,l2)/2)-1)
  const m1=new Array(l1).fill(false), m2=new Array(l2).fill(false)
  let m=0
  for(let i=0;i<l1;i++) for(let j=Math.max(0,i-mw);j<Math.min(i+mw+1,l2);j++)
    if(!m2[j]&&s1[i]===s2[j]){m1[i]=true;m2[j]=true;m++;break}
  if(!m) return 0
  let t=0, k=0
  for(let i=0;i<l1;i++){if(m1[i]){while(!m2[k])k++;if(s1[i]!==s2[k])t++;k++}}
  const jaro=(m/l1+m/l2+(m-t/2)/m)/3
  let p=0; for(let i=0;i<Math.min(4,Math.min(l1,l2));i++){if(s1[i]===s2[i])p++;else break}
  return jaro+p*0.1*(1-jaro)
}

const GENERIC_FIRST = new Set(['THE','A','FIRST','UNITED','AMERICAN','NATIONAL','GENERAL','STANDARD','ADVANCED','GLOBAL','NEW','CITY','STATE','NORTHERN','SOUTHERN','EASTERN','WESTERN','CENTRAL'])

function evalScore(s1, s2) {
  if(!s1||!s2) return {val:0,meth:'none'}
  if(s1===s2) return {val:100,meth:'exact'}
  const tsr=tokenSetRatio(s1,s2)
  const phon=standardLev(multiSoundex(s1),multiSoundex(s2))
  const jw=jaroWinkler(s1,s2)
  const lev=standardLev(s1,s2)
  let val=Math.round((tsr*0.30+phon*0.10+jw*0.25+lev*0.20+lev*0.15)*100)
  let meth=tsr>0.95?'substring':jw>0.90?'jaro-winkler':lev>0.85?'levenshtein':'fuzzy'
  // proper-name boost
  const sT=s1.split(' '), mT=s2.split(' ')
  if(sT[0]===mT[0]&&sT[0].length>2&&!GENERIC_FIRST.has(sT[0])){
    const shared=sT.filter(w=>mT.includes(w)).length
    const pn=Math.min(94,85+shared*2)
    if(pn>val){val=pn;meth='proper-name'}
  }
  return {val,meth}
}

function getClean(raw) { return cleanEntity(raw).replace(/[:\-]/g,' ').replace(/\s+/g,' ').trim() }

// ── Match record type ──────────────────────────────────────────────────────────
// { id, source, canonical, confidence, method, status, userRemoved, count, revenue, candidates[] }

function uid() { return Math.random().toString(36).slice(2,10) }

function readFileAsText(f) {
  return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=e=>resolve(e.target?.result||'');r.onerror=reject;r.readAsText(f)})
}


// ── Trends Tab Component ──────────────────────────────────────────────────────
function TrendsTab({ matches, hasRevenue }) {
  const validM   = matches.filter(m=>!m.userRemoved&&m.method!=='low-revenue')
  const matchedM = validM.filter(m=>m.method!=='alone')
  const total    = validM.length
  const matchRate= total?Math.round(matchedM.length/total*100):0

  const methodCounts = {}
  validM.forEach(m=>{const k=m.method||'none';methodCounts[k]=(methodCounts[k]||0)+1})
  const methodMax=Math.max(1,...Object.values(methodCounts))

  const confBuckets={'100':0,'90-99':0,'80-89':0,'70-79':0,'<70':0}
  matchedM.forEach(m=>{const c=m.confidence;if(c===100)confBuckets['100']++;else if(c>=90)confBuckets['90-99']++;else if(c>=80)confBuckets['80-89']++;else if(c>=70)confBuckets['70-79']++;else confBuckets['<70']++})
  const confMax=Math.max(1,...Object.values(confBuckets))
  const confColors={'100':'#10B981','90-99':'#34D399','80-89':'#FBBF24','70-79':'#FB923C','<70':'#EF4444'}

  const masterFreq=new Map()
  matchedM.forEach(m=>{if(!masterFreq.has(m.canonical))masterFreq.set(m.canonical,{name:m.canonical,count:0,revenue:0,sources:new Set()});const o=masterFreq.get(m.canonical);o.count+=m.count;o.revenue+=m.revenue;o.sources.add(m.source)})
  const topGroups=[...masterFreq.values()].filter(x=>x.sources.size>=2).sort((a,b)=>b.sources.size-a.sources.size).slice(0,20)
  const groupMax=Math.max(1,...topGroups.map(x=>x.sources.size),1)

  const aloneM=matches.filter(m=>m.method==='alone')
  const tokenMap=new Map()
  aloneM.forEach(m=>{cleanEntity(m.source).split(/\s+/).forEach(t=>{if(t.length>3)tokenMap.set(t,(tokenMap.get(t)||0)+1)})})
  const topTokens=[...tokenMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12)
  const tokenMax=Math.max(1,...topTokens.map(x=>x[1]),1)
  const totalRev=hasRevenue?validM.reduce((s,m)=>s+m.revenue,0):0

  const methodLabel=(m)=>({'exact':'Exact','exact-part':'Exact Pt','substring':'Substr','proper-name':'Proper','fuzzy':'Fuzzy','jaro-winkler':'Jaro-W','levenshtein':'Levenshtein','canonical':'Canon','alone':'Unique','manual':'Manual','low-revenue':'Skipped'}[m]||m)
  const methodColor=(m)=>({'exact':'#1D4ED8','exact-part':'#1D4ED8','substring':'#065F46','proper-name':'#065F46','fuzzy':'#5B21B6','jaro-winkler':'#5B21B6','levenshtein':'#5B21B6','canonical':'#92400E','alone':'#991B1B','manual':'#0E7490','low-revenue':'#6B7280'}[m]||'#6B7280')

  return (
    <div style={{padding:'20px 22px'}}>
      <div style={{display:'grid',gridTemplateColumns:`repeat(${hasRevenue?4:3},1fr)`,gap:12,marginBottom:24}}>
        {([
          {label:'Match rate',    value:`${matchRate}%`,               color:'#10B981'},
          {label:'Unique sources',value:total.toLocaleString(),         color:'#111827'},
          {label:'Master names',  value:masterFreq.size.toLocaleString(),color:'#4F46E5'},
          hasRevenue?{label:'Total value',value:'$'+totalRev.toLocaleString(),color:'#111827'}:null,
        ].filter(Boolean)).map(s=>(
          <div key={s.label} style={{padding:'14px 16px',background:'#F9FAFB',border:'1px solid #E5E7EB',borderRadius:8}}>
            <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'#9CA3AF',marginBottom:4}}>{s.label}</div>
            <div style={{fontSize:22,fontWeight:700,color:s.color}}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:20}}>
        <div style={{background:'#F9FAFB',border:'1px solid #E5E7EB',borderRadius:10,padding:'16px 18px'}}>
          <div style={{fontSize:13,fontWeight:700,color:'#111827',marginBottom:14}}>Match method breakdown</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {Object.entries(methodCounts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>(
              <div key={k} style={{display:'flex',alignItems:'center',gap:10,fontSize:12}}>
                <div style={{width:90,flexShrink:0,textAlign:'right',color:'#374151',fontWeight:500}}>{methodLabel(k)}</div>
                <div style={{flex:1,height:20,background:'#E5E7EB',borderRadius:4,overflow:'hidden',position:'relative'}}>
                  <div style={{height:'100%',borderRadius:4,background:methodColor(k),width:`${v/methodMax*100}%`}}/>
                  <span style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',fontSize:11,fontWeight:600,color:'#374151'}}>{v.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{background:'#F9FAFB',border:'1px solid #E5E7EB',borderRadius:10,padding:'16px 18px'}}>
          <div style={{fontSize:13,fontWeight:700,color:'#111827',marginBottom:14}}>Confidence distribution</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {Object.entries(confBuckets).map(([k,v])=>(
              <div key={k} style={{display:'flex',alignItems:'center',gap:10,fontSize:12}}>
                <div style={{width:55,flexShrink:0,textAlign:'right',color:'#374151',fontWeight:500}}>{k}%</div>
                <div style={{flex:1,height:20,background:'#E5E7EB',borderRadius:4,overflow:'hidden',position:'relative'}}>
                  <div style={{height:'100%',borderRadius:4,background:confColors[k],width:`${v/confMax*100}%`}}/>
                  <span style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',fontSize:11,fontWeight:600,color:'#374151'}}>{v.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        <div style={{background:'#F9FAFB',border:'1px solid #E5E7EB',borderRadius:10,padding:'16px 18px'}}>
          <div style={{fontSize:13,fontWeight:700,color:'#111827',marginBottom:4}}>Top grouped entities</div>
          <div style={{fontSize:11,color:'#6B7280',marginBottom:12}}>Names with 2+ source variants merged</div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {topGroups.slice(0,12).map(x=>(
              <div key={x.name} style={{display:'flex',alignItems:'center',gap:10,fontSize:12}}>
                <div style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#111827',fontWeight:600,maxWidth:160}} title={x.name}>{x.name}</div>
                <div style={{width:100,height:18,background:'#E5E7EB',borderRadius:4,overflow:'hidden',position:'relative',flexShrink:0}}>
                  <div style={{height:'100%',borderRadius:4,background:'#4F46E5',width:`${x.sources.size/groupMax*100}%`}}/>
                  <span style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',fontSize:10,fontWeight:600,color:'#374151'}}>{x.sources.size} variants</span>
                </div>
              </div>
            ))}
            {topGroups.length===0&&<div style={{fontSize:12,color:'#9CA3AF',textAlign:'center',padding:'16px 0'}}>No groups with 2+ variants found.</div>}
          </div>
        </div>
        <div style={{background:'#F9FAFB',border:'1px solid #E5E7EB',borderRadius:10,padding:'16px 18px'}}>
          <div style={{fontSize:13,fontWeight:700,color:'#111827',marginBottom:4}}>Common unmatched words</div>
          <div style={{fontSize:11,color:'#6B7280',marginBottom:12}}>Frequent tokens in standalone names</div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {topTokens.map(([t,c])=>(
              <div key={t} style={{display:'flex',alignItems:'center',gap:10,fontSize:12}}>
                <div style={{width:80,flexShrink:0,textAlign:'right',color:'#374151',fontWeight:500}}>{t.toLowerCase()}</div>
                <div style={{flex:1,height:18,background:'#E5E7EB',borderRadius:4,overflow:'hidden',position:'relative'}}>
                  <div style={{height:'100%',borderRadius:4,background:'#EF4444',width:`${c/tokenMax*100}%`}}/>
                  <span style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',fontSize:10,fontWeight:600,color:'#374151'}}>{c}</span>
                </div>
              </div>
            ))}
            {topTokens.length===0&&<div style={{fontSize:12,color:'#9CA3AF',textAlign:'center',padding:'16px 0'}}>No standalone names to analyze.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function UploadPage() {
  const router = useRouter()
  const [profile, setProfile]         = useState(null)
  const [step, setStep]               = useState('upload')
  const stepIdx = STEPS.findIndex(s => s.id === step)
  const [analysisType, setAnalysisType] = useState('') // 'mrr_arr' | 'acv_tcv'
  const [revenueUnit,  setRevenueUnit]  = useState('') // 'MRR' | 'ARR' | 'TCV' | 'ACV'
  const [file, setFile]               = useState(null)
  const [rawRows, setRawRows]         = useState([])
  const [columns, setColumns]         = useState([])
  const [datasetType, setDatasetType] = useState('revenue')
  const [mapping, setMapping]         = useState({})
  const [error, setError]             = useState('')

  // Quality state
  const [qState, setQState]           = useState('idle') // idle|running|done
  const [qProgress, setQProgress]     = useState(0)
  const [qMsg, setQMsg]               = useState('')
  const [matches, setMatches]         = useState([])     // full match records
  const [appliedFuzzy, setAppliedFuzzy] = useState(false)
  const [reviewTab, setReviewTab]     = useState('mapping') // 'mapping'|'trends'
  const [editModalMatch, setEditModalMatch] = useState(null)
  const [editSearch, setEditSearch]   = useState('')
  const [allCanonicals, setAllCanonicals] = useState([])
  // Filters
  const [fStatus, setFStatus]         = useState('all')
  const [fMethod, setFMethod]         = useState('all')
  const [fConf, setFConf]             = useState('all')
  const [fQuery, setFQuery]           = useState('')
  const [sortKey, setSortKey]         = useState('confidence')
  const [sortDir, setSortDir]         = useState('asc')
  const [page, setPage]               = useState(1)
  const PAGE_SIZE = 50
  const runRef = useRef(0)

  // Upload tabs
  const [sourceTab, setSourceTab]           = useState('file')
  const folderInputRef                      = useRef(null)
  const [folderFiles, setFolderFiles]       = useState([])
  const [folderMerging, setFolderMerging]   = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('')
  const [connectionTesting, setConnectionTesting] = useState(false)
  const [dbConfig, setDbConfig]             = useState({type:'postgres',host:'',port:'5432',db:'',user:'',pass:'',query:''})
  const [cloudConfig, setCloudConfig]       = useState({type:'gdrive',url:'',token:''})
  const [apiConfig, setApiConfig]           = useState({method:'GET',url:'',headers:'',schedule:'manual'})

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      if(!session){router.push('/auth/login');return}
      supabase.from('profiles').select('*').eq('id',session.user.id).single().then(({data})=>{if(data)setProfile(data)})
    })
  },[router])

  const onDrop = useCallback((accepted)=>{
    if(!accepted.length) return
    const f=accepted[0]; setFile(f); setColumns([]); setRawRows([])
    setQState('idle'); setAppliedFuzzy(false); setMatches([])
    const reader=new FileReader()
    reader.onload=(e)=>{
      const text=e.target?.result
      const lines=text.split('\n').filter(l=>l.trim())
      if(!lines.length) return
      const cols=lines[0].split(',').map(c=>c.trim().replace(/^["']|["']$/g,''))
      setColumns(cols)
      setRawRows(lines.slice(1).map(line=>{
        const vals=line.split(',').map(v=>v.trim().replace(/^["']|["']$/g,''))
        const row={}; cols.forEach((col,i)=>{row[col]=vals[i]||''}); return row
      }))
    }
    if(f.name.endsWith('.csv')) reader.readAsText(f)
  },[])

  const {getRootProps,getInputProps,isDragActive}=useDropzone({
    onDrop, accept:{'text/csv':['.csv'],'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':['.xlsx']}, maxFiles:1
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // RUN CONSOLIDATION ENGINE
  // ═══════════════════════════════════════════════════════════════════════════
  async function runQualityChecks() {
    const customerCol=mapping.customer, revenueCol=mapping.revenue
    if(!customerCol||!rawRows.length) return
    setQState('running'); setQProgress(0); setMatches([]); setAppliedFuzzy(false)
    const myRun=++runRef.current
    await new Promise(r=>setTimeout(r,30))

    setQMsg('Extracting unique customer names…'); setQProgress(8)
    await new Promise(r=>setTimeout(r,20))

    // Build unique name → {count, revenue}
    const nameMap = new Map()
    for(const row of rawRows){
      const raw=String(row[customerCol]??'').trim(); if(!raw) continue
      const rev=revenueCol?parseFloat(String(row[revenueCol]??'0').replace(/[^0-9.\-]/g,''))||0:0
      if(!nameMap.has(raw)) nameMap.set(raw,{count:0,revenue:0})
      const o=nameMap.get(raw); o.count++; o.revenue+=rev
    }

    setQMsg(`Cleaning ${nameMap.size.toLocaleString()} names…`); setQProgress(18)
    await new Promise(r=>setTimeout(r,20))

    const objs=[...nameMap.entries()]
      .map(([raw,{count,revenue}])=>({raw,clean:getClean(raw),count,revenue}))
      .filter(o=>o.clean.length>0)
      .sort((a,b)=>a.clean.length-b.clean.length)
    if(runRef.current!==myRun) return

    setQMsg('Running six-layer similarity engine…'); setQProgress(30)
    await new Promise(r=>setTimeout(r,30))

    // Greedy clustering
    const clusters=[]
    for(let i=0;i<objs.length;i++){
      if(runRef.current!==myRun) return
      const u=objs[i]
      let bestC=null, bestScore=0, bestMeth='none'
      for(const c of clusters){
        const s=evalScore(u.clean,c.root.clean)
        if(s.val>bestScore){bestScore=s.val;bestC=c;bestMeth=s.meth;if(bestScore===100)break}
      }
      const thresh=u.raw.length<8?101:u.raw.length<=15?80:75
      if(bestC&&bestScore>=thresh){
        bestC.members.push({...u,matchScore:bestScore,matchMeth:bestMeth})
      } else {
        clusters.push({root:u,members:[{...u,matchScore:100,matchMeth:'alone'}]})
      }
      if(i%100===0){
        setQProgress(30+Math.floor(i/objs.length*55))
        setQMsg(`Grouping ${i.toLocaleString()} / ${objs.length.toLocaleString()}…`)
        await new Promise(r=>setTimeout(r,0))
      }
    }
    if(runRef.current!==myRun) return

    setQProgress(88); setQMsg('Selecting canonical names…')
    await new Promise(r=>setTimeout(r,20))

    // Build match records — one per unique source name
    const result=[]
    for(const c of clusters){
      // Pick canonical: most frequent, then shortest, then alphabetical
      const canon=c.members.sort((a,b)=>b.count!==a.count?b.count-a.count:a.raw.length!==b.raw.length?a.raw.length-b.raw.length:a.raw.localeCompare(b.raw))[0].raw
      for(const m of c.members){
        const isAlone=c.members.length===1
        const meth=m.raw===canon?(isAlone?'alone':'canonical'):m.matchMeth
        const conf=m.raw===canon?100:m.matchScore
        result.push({
          id:uid(),
          source:m.raw,
          canonical:canon,
          confidence:conf,
          method:meth,
          status: isAlone?'unique':conf>=90?'matched':conf>=80?'matched':'review',
          userRemoved:false,
          count:m.count,
          revenue:m.revenue,
          candidates:[],
        })
      }
    }

    // Build suggestions for alone/low-conf records
    const canonList=[...new Set(result.map(r=>r.canonical))].map(raw=>({raw,clean:getClean(raw)}))
    setAllCanonicals(canonList)
    for(const r of result){
      if(r.method==='alone'||r.confidence<75){
        const src=getClean(r.source)
        const scored=canonList
          .filter(c=>c.raw!==r.source)
          .map(c=>({raw:c.raw,val:evalScore(src,c.clean).val}))
          .filter(x=>x.val>=45)
          .sort((a,b)=>b.val-a.val)
          .slice(0,5)
          .map(x=>x.raw)
        r.candidates=scored
      }
    }

    setQProgress(100); setQMsg('Done')
    setMatches(result)
    setQState('done')
    setPage(1)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MATCH ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  function removeMatch(id){
    setMatches(m=>m.map(x=>x.id===id?{...x,userRemoved:true}:x))
  }
  function restoreMatch(id){
    setMatches(m=>m.map(x=>x.id===id?{...x,userRemoved:false}:x))
  }
  function acceptSuggestion(id){
    setMatches(m=>m.map(x=>x.id===id&&x.candidates?.length?{...x,canonical:x.candidates[0],confidence:80,method:'manual',userRemoved:false,status:'matched'}:x))
  }
  function assignMatch(id, newCanonical){
    setMatches(m=>m.map(x=>x.id===id?{...x,canonical:newCanonical,confidence:100,method:'manual',userRemoved:false,status:'matched'}:x))
    setEditModalMatch(null)
  }
  function clearMatch(id){
    setMatches(m=>m.map(x=>x.id===id?{...x,userRemoved:true,canonical:x.source,method:'manual'}:x))
    setEditModalMatch(null)
  }

  // Apply approved mappings to rawRows
  function applyMappings(){
    const customerCol=mapping.customer; if(!customerCol) return
    const mp=new Map()
    for(const r of matches){
      if(!r.userRemoved&&r.source!==r.canonical) mp.set(r.source,r.canonical)
    }
    setRawRows(prev=>prev.map(row=>({...row,[customerCol]:mp.get(row[customerCol])||row[customerCol]})))
    setAppliedFuzzy(true)
  }

  // Launch
  function launchAnalytics(){
    if(!file||!rawRows.length) return
    const transforms=[]; if(appliedFuzzy) transforms.push('customer_consolidation')
    const csvText=dataCubeStore.buildCsv(columns,rawRows)
    dataCubeStore.save({meta:{fileName:file.name,datasetType,rowCount:rawRows.length,columns,mapping,transforms,revenueUnit,analysisType,createdAt:new Date().toISOString()},csvText,revenueUnit,analysisType})
    if(analysisType==='acv_tcv') router.push('/app/acv-center')
    else router.push('/app/command-center')
  }

  // ── Filtering / sorting ────────────────────────────────────────────────────
  function getFiltered(){
    return matches.filter(m=>{
      const eff=!m.userRemoved&&m.method!=='alone'&&m.method!=='low-revenue'
      if(fStatus==='matched'&&!eff) return false
      if(fStatus==='unique'&&(eff||m.method==='low-revenue')) return false
      if(fStatus==='review'&&(!eff||m.confidence>=85)) return false
      if(fMethod!=='all'&&!m.method.includes(fMethod)) return false
      if(fConf==='high'&&m.confidence<90) return false
      if(fConf==='med'&&(m.confidence<80||m.confidence>=90)) return false
      if(fConf==='low'&&m.confidence>=80) return false
      if(fQuery){const q=fQuery.toLowerCase();if(!(m.source+' '+m.canonical).toLowerCase().includes(q))return false}
      return true
    })
  }

  function getSorted(arr){
    return [...arr].sort((a,b)=>{
      let va=a[sortKey]??'', vb=b[sortKey]??''
      if(typeof va==='string'){va=va.toLowerCase();vb=vb.toLowerCase()}
      return sortDir==='asc'?(va<vb?-1:va>vb?1:0):(va>vb?-1:va<vb?1:0)
    })
  }

  function toggleSort(key){
    if(sortKey===key) setSortDir(d=>d==='asc'?'desc':'asc')
    else{setSortKey(key);setSortDir('asc')}
    setPage(1)
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  function getStats(){
    const total=matches.length
    const matched=matches.filter(m=>!m.userRemoved&&m.method!=='alone'&&m.method!=='low-revenue').length
    const alone=matches.filter(m=>m.method==='alone'&&!m.userRemoved).length
    const review=matches.filter(m=>!m.userRemoved&&m.method!=='alone'&&m.confidence<85).length
    const byMethod=(meth)=>matches.filter(m=>m.method===meth||m.method.includes(meth)).length
    return {total,matched,alone,review,
      exact:byMethod('exact'),
      exactPart:matches.filter(m=>m.method==='exact-part').length,
      properName:byMethod('proper-name'),
      substring:byMethod('substring'),
      fuzzy:byMethod('fuzzy'),
      jw:byMethod('jaro-winkler'),
      lev:byMethod('levenshtein'),
      canonical:matches.filter(m=>m.method==='canonical').length,
      manual:matches.filter(m=>m.method==='manual').length,
    }
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const S={
    card:         {background:'#fff',border:'1px solid #E5E7EB',borderRadius:10,padding:'20px 24px'},
    label:        {fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'#9CA3AF'},
    btnPrimary:   {display:'flex',alignItems:'center',gap:6,padding:'9px 20px',background:'#2563EB',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'},
    btnSecondary: {display:'flex',alignItems:'center',gap:6,padding:'9px 20px',background:'#fff',color:'#374151',border:'1px solid #E5E7EB',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'},
    input:        {width:'100%',padding:'7px 10px',border:'1px solid #E5E7EB',borderRadius:6,fontSize:13,outline:'none',color:'#111827'},
  }

  const confColor=(c)=>c>=90?'#10B981':c>=80?'#F59E0B':'#EF4444'

  // Method labels & colors
  const methodLabel=(m)=>({
    'exact':'Exact','exact-part':'Exact Pt','substring':'Substr','proper-name':'Proper',
    'fuzzy':'Fuzzy','jaro-winkler':'Jaro-W','levenshtein':'Levenshtein',
    'canonical':'Canon','alone':'Unique','manual':'Manual','low-revenue':'Skipped',
  }[m]||m)

  const methodBg=(m)=>({
    'exact':'#DBEAFE','exact-part':'#DBEAFE','substring':'#D1FAE5','proper-name':'#D1FAE5',
    'fuzzy':'#EDE9FE','jaro-winkler':'#EDE9FE','levenshtein':'#EDE9FE',
    'canonical':'#FEF3C7','alone':'#FEF2F2','manual':'#CFFAFE','low-revenue':'#F3F4F6',
  }[m]||'#F3F4F6')

  const methodColor=(m)=>({
    'exact':'#1D4ED8','exact-part':'#1D4ED8','substring':'#065F46','proper-name':'#065F46',
    'fuzzy':'#5B21B6','jaro-winkler':'#5B21B6','levenshtein':'#5B21B6',
    'canonical':'#92400E','alone':'#991B1B','manual':'#0E7490','low-revenue':'#6B7280',
  }[m]||'#6B7280')

  // ── Edit modal search ──────────────────────────────────────────────────────
  const editResults = editModalMatch
    ? (editSearch.trim()
        ? allCanonicals.filter(c=>c.raw.toLowerCase().includes(editSearch.toLowerCase())).slice(0,50).map(c=>c.raw)
        : editModalMatch.candidates||[])
    : []

  // ── Render ─────────────────────────────────────────────────────────────────
  const filtered = qState==='done' ? getFiltered() : []
  const sorted   = getSorted(filtered)
  const totalPages = Math.max(1,Math.ceil(sorted.length/PAGE_SIZE))
  const pageSlice  = sorted.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)
  const stats = qState==='done' ? getStats() : null
  const hasRevenue = matches.some(m=>m.revenue>0)

  return (
    <DashboardLayout profile={profile} title="Analytics Engine">
      <div style={{maxWidth:qState==='done'?1100:780,margin:'0 auto',padding:'32px 40px',transition:'max-width 0.3s'}}>

        {/* Step indicator */}
        <div style={{display:'flex',alignItems:'center',marginBottom:40}}>
          {STEPS.map((s,i)=>(
            <div key={s.id} style={{display:'flex',alignItems:'center'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0,
                  background:i<=stepIdx?'#2563EB':'#F3F4F6',color:i<=stepIdx?'#fff':'#9CA3AF'}}>
                  {i<stepIdx?'✓':i+1}
                </div>
                <span style={{fontSize:13,fontWeight:i===stepIdx?600:400,color:i===stepIdx?'#111827':i<stepIdx?'#2563EB':'#9CA3AF'}}>{s.label}</span>
              </div>
              {i<STEPS.length-1&&<div style={{width:48,height:1,background:i<stepIdx?'#2563EB':'#E5E7EB',margin:'0 12px'}}/>}
            </div>
          ))}
        </div>

        {/* ══ STEP 1: UPLOAD ══════════════════════════════════════════════════ */}
        {step==='upload'&&(
          <div>
            <div style={{fontSize:22,fontWeight:700,color:'#111827',marginBottom:6,letterSpacing:'-0.02em'}}>Add your data</div>
            <div style={{fontSize:13,color:'#6B7280',marginBottom:24}}>Choose how to bring your data into RevenueLens.</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:24}}>
              {DATASET_TYPES.map(t=>(
                <button key={t.id} onClick={()=>setDatasetType(t.id)} style={{padding:'14px 16px',borderRadius:10,border:`2px solid ${datasetType===t.id?'#2563EB':'#E5E7EB'}`,background:datasetType===t.id?'#EFF6FF':'#fff',cursor:'pointer',textAlign:'left',transition:'all 150ms'}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#111827',marginBottom:2}}>{t.label}</div>
                  <div style={{fontSize:11,color:'#6B7280'}}>{t.desc}</div>
                </button>
              ))}
            </div>
            <div style={{display:'flex',gap:2,marginBottom:0,background:'#F3F4F6',padding:4,borderRadius:10,width:'fit-content'}}>
              {[{id:'file',label:'File'},{id:'folder',label:'Folder'},{id:'database',label:'Database'},{id:'cloud',label:'Cloud Storage'},{id:'api',label:'API / Webhook'}].map(tab=>(
                <button key={tab.id} onClick={()=>{setSourceTab(tab.id);setConnectionStatus('')}} style={{padding:'6px 14px',borderRadius:7,border:'none',cursor:'pointer',fontSize:12,fontWeight:sourceTab===tab.id?600:400,background:sourceTab===tab.id?'#fff':'transparent',color:sourceTab===tab.id?'#111827':'#6B7280',boxShadow:sourceTab===tab.id?'0 1px 3px rgba(0,0,0,0.08)':'none',transition:'all 150ms'}}>{tab.label}</button>
              ))}
            </div>
            {sourceTab==='file'&&(
              <div style={{marginTop:12}}>
                <div {...getRootProps()} style={{borderRadius:12,border:`2px dashed ${isDragActive?'#2563EB':file?'#16A34A':'#D1D5DB'}`,padding:'48px 24px',textAlign:'center',cursor:'pointer',transition:'all 150ms',background:isDragActive?'#EFF6FF':file?'#F0FDF4':'#F9FAFB'}}>
                  <input {...getInputProps()}/>
                  {file?(
                    <div><FileText size={36} color="#16A34A" style={{margin:'0 auto 10px'}}/>
                      <div style={{fontSize:14,fontWeight:700,color:'#111827',marginBottom:4}}>{file.name}</div>
                      <div style={{fontSize:12,color:'#6B7280'}}>{columns.length} columns · {rawRows.length.toLocaleString()} rows detected</div>
                      <button onClick={e=>{e.stopPropagation();setFile(null);setRawRows([]);setColumns([])}} style={{marginTop:8,fontSize:11,color:'#6B7280',background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>Remove</button>
                    </div>
                  ):(
                    <div><Upload size={36} color="#9CA3AF" style={{margin:'0 auto 10px'}}/>
                      <div style={{fontSize:14,fontWeight:600,color:'#374151',marginBottom:4}}>Drag and drop your file, or click to browse</div>
                      <div style={{fontSize:12,color:'#9CA3AF'}}>CSV, Excel (.xlsx) · Max 200MB</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {sourceTab==='folder'&&(
              <div style={{marginTop:12}}>
                <input ref={folderInputRef} type="file" webkitdirectory="" multiple style={{display:'none'}}
                  onChange={async e=>{
                    const allFiles=Array.from(e.target.files||[])
                    const csvXlsx=allFiles.filter(f=>f.name.endsWith('.csv')||f.name.endsWith('.xlsx')||f.name.endsWith('.xls'))
                    setFolderFiles(csvXlsx); if(!csvXlsx.length) return
                    setFolderMerging(true)
                    let mRows=[],mCols=[]
                    for(const f of csvXlsx){try{const text=await readFileAsText(f);const lines=text.split('\n').filter(l=>l.trim());if(!lines.length) continue;const cols=lines[0].split(',').map(c=>c.trim().replace(/^["']|["']$/g,''));if(!mCols.length) mCols=cols;const rows=lines.slice(1).map(line=>{const vals=line.split(',').map(v=>v.trim().replace(/^["']|["']$/g,''));const row={};cols.forEach((col,i)=>{row[col]=vals[i]||''});return row});mRows=[...mRows,...rows]}catch{}}
                    setColumns(mCols);setRawRows(mRows);setFile(new File([dataCubeStore.buildCsv(mCols,mRows)],'merged_folder.csv',{type:'text/csv'}));setFolderMerging(false)
                  }}/>
                <div onClick={()=>folderInputRef.current?.click()} style={{borderRadius:12,border:'2px dashed #D1D5DB',padding:'48px 24px',textAlign:'center',cursor:'pointer',background:folderFiles.length?'#F0FDF4':'#F9FAFB'}}>
                  {folderMerging?(<div><Loader2 size={32} color="#2563EB" style={{margin:'0 auto 10px',animation:'spin 1s linear infinite'}}/><div style={{fontSize:14,color:'#374151'}}>Merging files…</div></div>)
                  :folderFiles.length?(<div><CheckCircle size={32} color="#16A34A" style={{margin:'0 auto 10px'}}/><div style={{fontSize:14,fontWeight:700,color:'#111827',marginBottom:6}}>{folderFiles.length} files merged</div><div style={{fontSize:12,color:'#6B7280'}}>{rawRows.length.toLocaleString()} total rows · {columns.length} columns</div></div>)
                  :(<div><Upload size={36} color="#9CA3AF" style={{margin:'0 auto 10px'}}/><div style={{fontSize:14,fontWeight:600,color:'#374151',marginBottom:4}}>Click to select a folder</div><div style={{fontSize:12,color:'#9CA3AF'}}>All CSV and Excel files inside will be merged</div></div>)}
                </div>
              </div>
            )}
            {(sourceTab==='database'||sourceTab==='cloud'||sourceTab==='api')&&(
              <div style={{marginTop:12,...S.card}}>
                <div style={{padding:'10px 14px',background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:8,fontSize:12,color:'#92400E'}}>
                  {sourceTab==='database'?'Database connections':'Cloud/API connections'} are coming soon — use file upload in the meantime.
                </div>
              </div>
            )}
            <div style={{display:'flex',justifyContent:'flex-end',marginTop:24}}>
              <button onClick={()=>setStep('analysis')} disabled={!file} style={{...S.btnPrimary,opacity:file?1:0.4,cursor:file?'pointer':'default'}}>Continue <ArrowRight size={14}/></button>
            </div>
          </div>
        )}


        {/* ══ STEP: ANALYSIS TYPE ════════════════════════════════════════════ */}
        {step==='analysis'&&(
          <div>
            <div style={{fontSize:22,fontWeight:700,color:'#111827',marginBottom:6,letterSpacing:'-0.02em'}}>Analysis Type</div>
            <div style={{fontSize:13,color:'#6B7280',marginBottom:28}}>Tell us how your revenue is structured so we can run the right engine.</div>

            {/* Level 1 — Analysis Type */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:12}}>Select your analysis type</div>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {[
                  { id:'mrr_arr', label:'MRR / ARR Analysis', sub:'Subscription & recurring revenue — monthly or annual amounts per customer' },
                  { id:'acv_tcv', label:'ACV / Contract Analysis', sub:'Contract deals with start dates, end dates, and TCV or ACV values' },
                ].map(opt=>(
                  <button key={opt.id} onClick={()=>{setAnalysisType(opt.id);setRevenueUnit('')}}
                    style={{display:'flex',alignItems:'flex-start',gap:14,padding:'16px 18px',borderRadius:10,border:`2px solid ${analysisType===opt.id?'#2563EB':'#E5E7EB'}`,background:analysisType===opt.id?'#EFF6FF':'#fff',cursor:'pointer',textAlign:'left',transition:'all 150ms',width:'100%'}}>
                    <div style={{width:18,height:18,borderRadius:'50%',border:`2px solid ${analysisType===opt.id?'#2563EB':'#D1D5DB'}`,background:analysisType===opt.id?'#2563EB':'#fff',flexShrink:0,marginTop:2,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {analysisType===opt.id&&<div style={{width:6,height:6,borderRadius:'50%',background:'#fff'}}/>}
                    </div>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:'#111827',marginBottom:3}}>{opt.label}</div>
                      <div style={{fontSize:12,color:'#6B7280',lineHeight:1.5}}>{opt.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Level 2 — Revenue Unit (inline reveal) */}
            {analysisType==='mrr_arr'&&(
              <div style={{marginBottom:20,padding:'18px 20px',background:'#F9FAFB',border:'1px solid #E5E7EB',borderRadius:10}}>
                <div style={{fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:12}}>What unit is your revenue figure in?</div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {[
                    { id:'MRR', label:'MRR — Monthly Recurring Revenue', sub:"Monthly amount per customer — we'll multiply × 12 to get ARR" },
                    { id:'ARR', label:'ARR — Annual Recurring Revenue',  sub:'Annual amount per customer — used as-is' },
                  ].map(opt=>(
                    <button key={opt.id} onClick={()=>setRevenueUnit(opt.id)}
                      style={{display:'flex',alignItems:'flex-start',gap:12,padding:'12px 14px',borderRadius:8,border:`2px solid ${revenueUnit===opt.id?'#2563EB':'#E5E7EB'}`,background:revenueUnit===opt.id?'#EFF6FF':'#fff',cursor:'pointer',textAlign:'left',transition:'all 150ms',width:'100%'}}>
                      <div style={{width:16,height:16,borderRadius:'50%',border:`2px solid ${revenueUnit===opt.id?'#2563EB':'#D1D5DB'}`,background:revenueUnit===opt.id?'#2563EB':'#fff',flexShrink:0,marginTop:2,display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {revenueUnit===opt.id&&<div style={{width:5,height:5,borderRadius:'50%',background:'#fff'}}/>}
                      </div>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:'#111827',marginBottom:2}}>{opt.label}</div>
                        <div style={{fontSize:11,color:'#6B7280'}}>{opt.sub}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {analysisType==='acv_tcv'&&(
              <div style={{marginBottom:20,padding:'18px 20px',background:'#F9FAFB',border:'1px solid #E5E7EB',borderRadius:10}}>
                <div style={{fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:12}}>What contract value is in your file?</div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {[
                    { id:'TCV', label:'TCV — Total Contract Value', sub:"Total deal value — we'll divide by contract duration to get ACV" },
                    { id:'ACV', label:'ACV — Annual Contract Value', sub:'Annual contract value — used as-is' },
                  ].map(opt=>(
                    <button key={opt.id} onClick={()=>setRevenueUnit(opt.id)}
                      style={{display:'flex',alignItems:'flex-start',gap:12,padding:'12px 14px',borderRadius:8,border:`2px solid ${revenueUnit===opt.id?'#2563EB':'#E5E7EB'}`,background:revenueUnit===opt.id?'#EFF6FF':'#fff',cursor:'pointer',textAlign:'left',transition:'all 150ms',width:'100%'}}>
                      <div style={{width:16,height:16,borderRadius:'50%',border:`2px solid ${revenueUnit===opt.id?'#2563EB':'#D1D5DB'}`,background:revenueUnit===opt.id?'#2563EB':'#fff',flexShrink:0,marginTop:2,display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {revenueUnit===opt.id&&<div style={{width:5,height:5,borderRadius:'50%',background:'#fff'}}/>}
                      </div>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:'#111827',marginBottom:2}}>{opt.label}</div>
                        <div style={{fontSize:11,color:'#6B7280'}}>{opt.sub}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}



            {/* Nav buttons */}
            <div style={{display:'flex',justifyContent:'space-between',marginTop:8}}>
              <button onClick={()=>setStep('upload')} style={S.btnSecondary}>← Back</button>
              <button
                onClick={()=>setStep('map')}
                disabled={!analysisType||!revenueUnit}
                style={{...S.btnPrimary,opacity:(!analysisType||!revenueUnit)?0.4:1,cursor:(!analysisType||!revenueUnit)?'default':'pointer'}}>
                Continue to field mapping <ArrowRight size={14}/>
              </button>
            </div>
          </div>
        )}

        {/* ══ STEP 2: MAP FIELDS ══════════════════════════════════════════════ */}
        {step==='map'&&(
          <div>
            <div style={{fontSize:22,fontWeight:700,color:'#111827',marginBottom:6,letterSpacing:'-0.02em'}}>Map your columns</div>
            <div style={{fontSize:13,color:'#6B7280',marginBottom:28}}>Tell us which column in your file corresponds to each field.</div>
            <div style={{...S.card,padding:0,overflow:'hidden',marginBottom:20}}>
              {FIELDS.map((field,i)=>(
                <div key={field.key} style={{display:'flex',alignItems:'center',gap:16,padding:'14px 20px',borderBottom:i<FIELDS.length-1?'1px solid #F3F4F6':'none'}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:13,fontWeight:600,color:'#111827'}}>{field.label}</span>
                      {field.required
                        ?<span style={{fontSize:9,fontWeight:700,background:'#EFF6FF',color:'#2563EB',border:'1px solid #BFDBFE',padding:'1px 6px',borderRadius:20}}>Required</span>
                        :<span style={{fontSize:9,color:'#9CA3AF',background:'#F9FAFB',border:'1px solid #E5E7EB',padding:'1px 6px',borderRadius:20}}>Optional</span>}
                    </div>
                  </div>
                  <select value={mapping[field.key]||''} onChange={e=>setMapping(m=>({...m,[field.key]:e.target.value}))}
                    style={{width:200,padding:'7px 10px',border:'1px solid #E5E7EB',borderRadius:6,fontSize:13,outline:'none',color:'#111827',background:'#fff'}}>
                    <option value="">— Select column —</option>
                    {columns.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {error&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:8,marginBottom:16,fontSize:13,color:'#DC2626'}}><AlertCircle size={14}/>{error}</div>}
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setStep('analysis')} style={S.btnSecondary}>← Back</button>
              <button onClick={()=>{if(!mapping.customer||!mapping.date||!mapping.revenue){setError('Please map Customer, Date, and Revenue fields.');return}setError('');setQState('idle');setAppliedFuzzy(false);setStep('quality')}} style={S.btnPrimary}>Data Quality Checks <ArrowRight size={14}/></button>
            </div>
          </div>
        )}

        {/* ══ STEP 3: DATA QUALITY ════════════════════════════════════════════ */}
        {step==='quality'&&(
          <div>
            <div style={{fontSize:22,fontWeight:700,color:'#111827',marginBottom:6,letterSpacing:'-0.02em'}}>Data Quality</div>
            <div style={{fontSize:13,color:'#6B7280',marginBottom:20}}>Run automated checks and fix issues before analysis.</div>

            {/* ════════════════════════════════════════════════════════════════
                CUSTOMER NAME CONSOLIDATION CARD — full engine
            ════════════════════════════════════════════════════════════════ */}
            <div style={{border:'1px solid #E5E7EB',borderRadius:12,overflow:'hidden',background:'#fff',marginBottom:12}}>

              {/* Card header */}
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',padding:'18px 22px',borderBottom:qState==='idle'?'none':'1px solid #F3F4F6'}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                  <div style={{width:36,height:36,borderRadius:10,background:'#EEF2FF',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <Users size={16} color="#4F46E5"/>
                  </div>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                      <div style={{fontSize:14,fontWeight:700,color:'#111827'}}>Customer Name Consolidation</div>
                      {qState==='done'&&stats&&(
                        <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:20,
                          background:stats.alone>0?'#FFFBEB':'#F0FDF4',
                          color:stats.alone>0?'#92400E':'#166534',
                          border:stats.alone>0?'1px solid #FCD34D':'1px solid #BBF7D0'}}>
                          {stats.matched} matched · {stats.alone} unique
                        </span>
                      )}
                    </div>
                    <div style={{fontSize:12,color:'#6B7280',lineHeight:1.55,maxWidth:560}}>
                      Six-layer similarity engine: Levenshtein · Jaro-Winkler · Soundex · Token Set Ratio · Proper-name boost · Phonetic. Detects <em>"Acme Inc"</em> vs <em>"ACME Corp"</em> and consolidates into one canonical entity.
                    </div>
                  </div>
                </div>
                <div style={{flexShrink:0,marginLeft:16,display:'flex',gap:8,alignItems:'center'}}>
                  {qState==='idle'&&<button onClick={runQualityChecks} disabled={!rawRows.length||!mapping.customer} style={{...S.btnPrimary,opacity:(!rawRows.length||!mapping.customer)?0.4:1}}>Run Check</button>}
                  {qState==='running'&&<div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#6B7280'}}><Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> Analyzing…</div>}
                  {qState==='done'&&!appliedFuzzy&&(
                    <>
                      <button onClick={runQualityChecks} style={{...S.btnSecondary,fontSize:12,padding:'7px 12px'}}>Re-run</button>
                      <button onClick={applyMappings} style={{...S.btnPrimary,background:'#059669',padding:'7px 14px',fontSize:12}}>
                        <Check size={12}/> Apply Consolidation
                      </button>
                    </>
                  )}
                  {appliedFuzzy&&<div style={{display:'flex',alignItems:'center',gap:6,color:'#16A34A',fontSize:13,fontWeight:600}}><CheckCircle size={14}/> Applied</div>}
                </div>
              </div>

              {/* Progress */}
              {qState==='running'&&(
                <div style={{padding:'12px 22px',background:'#F9FAFB',borderBottom:'1px solid #F3F4F6'}}>
                  <div style={{height:4,background:'#E5E7EB',borderRadius:2,overflow:'hidden',marginBottom:5}}>
                    <div style={{height:'100%',background:'#4F46E5',borderRadius:2,width:`${qProgress}%`,transition:'width 0.3s ease'}}/>
                  </div>
                  <div style={{fontSize:11,color:'#9CA3AF'}}>{qMsg}</div>
                </div>
              )}

              {/* Results */}
              {qState==='done'&&stats&&(
                <>
                  {/* Stats grid */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr) repeat(5,1fr)',borderBottom:'1px solid #F3F4F6',overflowX:'auto'}}>
                    {[
                      {label:'Total Unique', value:stats.total,          color:'#111827'},
                      {label:'Matched',      value:stats.matched,        color:'#10B981'},
                      {label:'Exact',        value:stats.exact,          color:'#1D4ED8'},
                      {label:'Main Name',    value:stats.properName,     color:'#065F46'},
                      {label:'Text Match',   value:stats.substring,      color:'#065F46'},
                      {label:'Typo Match',   value:stats.fuzzy+stats.jw+stats.lev, color:'#5B21B6'},
                      {label:'Canonical',    value:stats.canonical,      color:'#92400E'},
                      {label:'Manual',       value:stats.manual,         color:'#0E7490'},
                      {label:'Needs Review', value:stats.review,         color:'#D97706'},
                      {label:'Unique',       value:stats.alone,          color:'#DC2626'},
                    ].map(s=>(
                      <div key={s.label} style={{padding:'10px 14px',borderRight:'1px solid #F3F4F6',minWidth:90}}>
                        <div style={{fontSize:9,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'#9CA3AF',marginBottom:3}}>{s.label}</div>
                        <div style={{fontSize:18,fontWeight:700,color:s.color}}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Match labels guide */}
                  <div style={{padding:'12px 22px',borderBottom:'1px solid #F3F4F6',background:'#FAFAFA'}}>
                    <div style={{fontSize:11,fontWeight:700,color:'#374151',marginBottom:8}}>💡 Match labels guide</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                      {[
                        ['exact','Exact','Perfect text match'],
                        ['exact-part','Exact Pt','Match on a split part'],
                        ['substring','Substr','Name contained within another'],
                        ['proper-name','Proper','Core company name matched'],
                        ['fuzzy','Fuzzy','Minor spelling differences'],
                        ['jaro-winkler','Jaro-W','Jaro-Winkler phonetic'],
                        ['levenshtein','Levenshtein','Edit distance match'],
                        ['canonical','Canon','Primary name for merged group'],
                        ['alone','Unique','Stands alone, no similar names'],
                        ['manual','Manual','User manually assigned'],
                      ].map(([meth,label,desc])=>(
                        <div key={meth} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'#6B7280'}}>
                          <span style={{padding:'2px 7px',borderRadius:4,fontSize:10,fontWeight:700,background:methodBg(meth),color:methodColor(meth)}}>{label}</span>
                          <span>{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tabs */}
                  <div style={{display:'flex',borderBottom:'1px solid #E5E7EB',padding:'0 22px',background:'#fff'}}>
                    {[['mapping','Mapping Review'],['trends','Trends & Analysis']].map(([id,label])=>(
                      <button key={id} onClick={()=>setReviewTab(id)} style={{padding:'10px 16px',border:'none',borderBottom:`2px solid ${reviewTab===id?'#4F46E5':'transparent'}`,background:'transparent',cursor:'pointer',fontSize:13,fontWeight:reviewTab===id?600:400,color:reviewTab===id?'#4F46E5':'#6B7280',display:'flex',alignItems:'center',gap:6}}>
                        {id==='trends'&&<BarChart2 size={13}/>}{label}
                      </button>
                    ))}
                  </div>

                  {/* ── MAPPING TAB ── */}
                  {reviewTab==='mapping'&&(
                    <>
                      {/* Filter bar */}
                      <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',background:'#F9FAFB',borderBottom:'1px solid #F3F4F6',flexWrap:'wrap'}}>
                        <span style={{fontSize:10,fontWeight:700,textTransform:'uppercase',color:'#9CA3AF',flexShrink:0}}>Status:</span>
                        {[['all','All'],['matched','Matched'],['unique','Unique'],['review','< 85%']].map(([v,l])=>(
                          <button key={v} onClick={()=>{setFStatus(v);setPage(1)}} style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,border:'1px solid',cursor:'pointer',borderColor:fStatus===v?'#4F46E5':'#E5E7EB',background:fStatus===v?'#4F46E5':'transparent',color:fStatus===v?'#fff':'#6B7280'}}>{l}</button>
                        ))}
                        <div style={{width:1,height:16,background:'#E5E7EB',margin:'0 4px'}}/>
                        <span style={{fontSize:10,fontWeight:700,textTransform:'uppercase',color:'#9CA3AF',flexShrink:0}}>Method:</span>
                        {[['all','All'],['exact','Exact'],['proper-name','Noun'],['substring','Substr'],['fuzzy','Fuzzy'],['alone','Unique']].map(([v,l])=>(
                          <button key={v} onClick={()=>{setFMethod(v);setPage(1)}} style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,border:'1px solid',cursor:'pointer',borderColor:fMethod===v?'#4F46E5':'#E5E7EB',background:fMethod===v?'#4F46E5':'transparent',color:fMethod===v?'#fff':'#6B7280'}}>{l}</button>
                        ))}
                        <div style={{width:1,height:16,background:'#E5E7EB',margin:'0 4px'}}/>
                        <span style={{fontSize:10,fontWeight:700,textTransform:'uppercase',color:'#9CA3AF',flexShrink:0}}>Conf:</span>
                        {[['all','All'],['high','≥90'],['med','80-89'],['low','<80']].map(([v,l])=>(
                          <button key={v} onClick={()=>{setFConf(v);setPage(1)}} style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,border:'1px solid',cursor:'pointer',borderColor:fConf===v?'#4F46E5':'#E5E7EB',background:fConf===v?'#4F46E5':'transparent',color:fConf===v?'#fff':'#6B7280'}}>{l}</button>
                        ))}
                        <div style={{position:'relative',flex:1,minWidth:160,marginLeft:'auto'}}>
                          <Search size={11} style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:'#9CA3AF'}}/>
                          <input value={fQuery} onChange={e=>{setFQuery(e.target.value);setPage(1)}} placeholder="Search names…"
                            style={{width:'100%',padding:'6px 9px 6px 28px',borderRadius:6,border:'1px solid #E5E7EB',fontSize:12,outline:'none',background:'#fff'}}/>
                        </div>
                      </div>

                      {/* Table */}
                      <div style={{overflowX:'auto'}}>
                        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                          <thead>
                            <tr style={{background:'#F9FAFB',borderBottom:'1px solid #E5E7EB'}}>
                              {[['source','Source Data'],['canonical','Canonical Match'],['count','Records'],hasRevenue&&['revenue','Revenue'],['confidence','Conf ↕'],['method','Method'],['_a','Action',false]].filter(Boolean).map(([k,l,sort=true])=>(
                                <th key={k} onClick={sort?()=>toggleSort(k):undefined}
                                  style={{textAlign:'left',padding:'10px 14px',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'#9CA3AF',whiteSpace:'nowrap',cursor:sort?'pointer':'default',userSelect:'none'}}>
                                  {l}{sort&&sortKey===k&&(sortDir==='asc'?' ↑':' ↓')}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {pageSlice.length===0?(
                              <tr><td colSpan={8} style={{padding:'40px',textAlign:'center',color:'#9CA3AF',fontSize:13}}>No rows match current filters.</td></tr>
                            ):pageSlice.map(m=>{
                              const isAlone=m.method==='alone'
                              const isMatched=!m.userRemoved&&!isAlone
                              const hasSug=m.candidates?.length>0
                              return(
                                <tr key={m.id} style={{borderBottom:'1px solid #F3F4F6',background:m.userRemoved?'#FEF2F2':'#fff'}}
                                  onMouseEnter={e=>e.currentTarget.style.background=m.userRemoved?'#FEF2F2':'#F9FAFB'}
                                  onMouseLeave={e=>e.currentTarget.style.background=m.userRemoved?'#FEF2F2':'#fff'}>
                                  {/* Source */}
                                  <td style={{padding:'10px 14px',fontWeight:500,color:'#111827',maxWidth:200}}>
                                    <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.source||'(empty)'}</div>
                                  </td>
                                  {/* Canonical match */}
                                  <td style={{padding:'10px 14px',maxWidth:220}}>
                                    {m.userRemoved?(
                                      <span style={{color:'#9CA3AF',fontStyle:'italic'}}>Removed</span>
                                    ):isMatched?(
                                      <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:600,color:'#111827'}}>{m.canonical}</div>
                                    ):hasSug?(
                                      <div>
                                        <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:600,color:'#111827'}}>{m.canonical}</div>
                                        <div style={{fontSize:10,color:'#D97706',marginTop:2}}>💡 Suggestion: {m.candidates[0]}</div>
                                      </div>
                                    ):(
                                      <span style={{color:'#DC2626',fontStyle:'italic'}}>No match</span>
                                    )}
                                  </td>
                                  {/* Records */}
                                  <td style={{padding:'10px 14px',color:'#6B7280',textAlign:'right'}}>{m.count.toLocaleString()}</td>
                                  {/* Revenue */}
                                  {hasRevenue&&<td style={{padding:'10px 14px',color:'#6B7280',textAlign:'right',fontWeight:500}}>{m.revenue>0?'$'+m.revenue.toLocaleString():'-'}</td>}
                                  {/* Confidence */}
                                  <td style={{padding:'10px 14px'}}>
                                    {isMatched?(
                                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                                        <div style={{width:48,height:5,background:'#E5E7EB',borderRadius:3,overflow:'hidden'}}>
                                          <div style={{height:'100%',background:confColor(m.confidence),width:`${m.confidence}%`,borderRadius:3}}/>
                                        </div>
                                        <span style={{fontSize:11,fontWeight:700,color:confColor(m.confidence),minWidth:32}}>{m.confidence}%</span>
                                      </div>
                                    ):<span style={{color:'#9CA3AF'}}>—</span>}
                                  </td>
                                  {/* Method */}
                                  <td style={{padding:'10px 14px'}}>
                                    <span style={{padding:'2px 8px',borderRadius:4,fontSize:10,fontWeight:700,background:methodBg(m.userRemoved?'alone':m.method),color:methodColor(m.userRemoved?'alone':m.method)}}>
                                      {m.userRemoved?'Removed':methodLabel(m.method)}
                                    </span>
                                  </td>
                                  {/* Actions */}
                                  <td style={{padding:'10px 14px'}}>
                                    <div style={{display:'flex',gap:4}}>
                                      {m.userRemoved?(
                                        <button onClick={()=>restoreMatch(m.id)} style={{padding:'4px 10px',borderRadius:5,border:'1px solid #D1FAE5',background:'#ECFDF5',color:'#059669',fontSize:11,fontWeight:600,cursor:'pointer'}}>Restore</button>
                                      ):isAlone&&hasSug?(
                                        <>
                                          <button onClick={()=>acceptSuggestion(m.id)} style={{padding:'4px 10px',borderRadius:5,border:'1px solid #FDE68A',background:'#FEF9C3',color:'#92400E',fontSize:11,fontWeight:600,cursor:'pointer'}}>✓ Merge</button>
                                          <button onClick={()=>{setEditModalMatch(m);setEditSearch('')}} style={{padding:'4px 10px',borderRadius:5,border:'1px solid #E5E7EB',background:'#fff',color:'#374151',fontSize:11,fontWeight:600,cursor:'pointer'}}>Edit</button>
                                        </>
                                      ):isMatched?(
                                        <>
                                          <button onClick={()=>removeMatch(m.id)} style={{padding:'4px 10px',borderRadius:5,border:'1px solid #FECACA',background:'#FEF2F2',color:'#DC2626',fontSize:11,fontWeight:600,cursor:'pointer'}}>Remove</button>
                                          <button onClick={()=>{setEditModalMatch(m);setEditSearch('')}} style={{padding:'4px 10px',borderRadius:5,border:'1px solid #E5E7EB',background:'#fff',color:'#374151',fontSize:11,fontWeight:600,cursor:'pointer'}}>Edit</button>
                                        </>
                                      ):(
                                        <button onClick={()=>{setEditModalMatch(m);setEditSearch('')}} style={{padding:'4px 10px',borderRadius:5,border:'1px solid #E5E7EB',background:'#fff',color:'#374151',fontSize:11,fontWeight:600,cursor:'pointer'}}>Assign</button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 16px',background:'#F9FAFB',borderTop:'1px solid #F3F4F6',fontSize:12,color:'#6B7280'}}>
                        <div>{sorted.length===0?'0':`${((page-1)*PAGE_SIZE+1).toLocaleString()}–${Math.min(page*PAGE_SIZE,sorted.length).toLocaleString()}`} of {sorted.length.toLocaleString()} items</div>
                        <div style={{display:'flex',gap:4,alignItems:'center'}}>
                          {[['first','«'],['prev','‹'],null,['next','›'],['last','»']].map((item,i)=>item?(
                            <button key={item[0]} onClick={()=>setPage(p=>item[0]==='first'?1:item[0]==='prev'?Math.max(1,p-1):item[0]==='next'?Math.min(totalPages,p+1):totalPages)}
                              disabled={(item[0]==='first'||item[0]==='prev')&&page<=1||(item[0]==='next'||item[0]==='last')&&page>=totalPages}
                              style={{padding:'4px 10px',borderRadius:5,border:'1px solid #E5E7EB',background:'#fff',color:'#374151',cursor:'pointer',fontWeight:600,fontSize:13,opacity:((item[0]==='first'||item[0]==='prev')&&page<=1)||(item[0]==='next'||item[0]==='last')&&page>=totalPages?0.4:1}}>
                              {item[1]}
                            </button>
                          ):<span key={i} style={{margin:'0 6px',fontSize:12}}>Page {page} of {totalPages}</span>)}
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── TRENDS TAB ── */}
                  {reviewTab==='trends'&&<TrendsTab matches={matches} hasRevenue={hasRevenue}/>}
                </>
              )}
            </div>
            {/* ── end consolidation card ── */}

            {/* Coming soon checks */}
            {[
              {title:'Duplicate Row Detection',desc:'Identifies exact or near-duplicate records within the same period for the same customer.'},
              {title:'Date Gap Analysis',desc:'Finds missing periods in subscription timelines that could cause incorrect churn classification.'},
              {title:'Negative Value Flagging',desc:'Highlights negative ARR/MRR values that may indicate credits or data entry errors.'},
              {title:'Revenue Smoothing',desc:'Detects and optionally smooths one-time spikes that distort period-over-period trends.'},
            ].map(check=>(
              <div key={check.title} style={{...S.card,marginBottom:10,opacity:0.55}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:'#111827',marginBottom:2}}>{check.title}</div>
                    <div style={{fontSize:12,color:'#6B7280'}}>{check.desc}</div>
                  </div>
                  <span style={{fontSize:9,fontWeight:700,background:'#F3F4F6',color:'#6B7280',border:'1px solid #E5E7EB',padding:'2px 8px',borderRadius:20,flexShrink:0,marginLeft:16,textTransform:'uppercase',letterSpacing:'0.06em'}}>Coming Soon</span>
                </div>
              </div>
            ))}

            <div style={{display:'flex',gap:10,marginTop:24}}>
              <button onClick={()=>setStep('map')} style={S.btnSecondary}>← Back</button>
              <button onClick={()=>setStep('review')} style={S.btnPrimary}>Review & Confirm <ArrowRight size={14}/></button>
            </div>
          </div>
        )}

        {/* ══ STEP 4: REVIEW ══════════════════════════════════════════════════ */}
        {step==='review'&&(
          <div>
            <div style={{fontSize:22,fontWeight:700,color:'#111827',marginBottom:6,letterSpacing:'-0.02em'}}>Review & Launch</div>
            <div style={{fontSize:13,color:'#6B7280',marginBottom:28}}>Confirm your configuration before running analytics.</div>
            <div style={{...S.card,marginBottom:16}}>
              <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'#9CA3AF',marginBottom:16}}>Configuration</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><div style={{fontSize:11,color:'#9CA3AF',marginBottom:2}}>File</div><div style={{fontSize:13,fontWeight:600,color:'#111827'}}>{file?.name}</div></div>
                <div><div style={{fontSize:11,color:'#9CA3AF',marginBottom:2}}>Dataset Type</div><div style={{fontSize:13,fontWeight:600,color:'#111827',textTransform:'capitalize'}}>{datasetType}</div></div>
                <div><div style={{fontSize:11,color:'#9CA3AF',marginBottom:2}}>Rows</div><div style={{fontSize:13,fontWeight:600,color:'#111827'}}>{rawRows.length.toLocaleString()}</div></div>
                <div><div style={{fontSize:11,color:'#9CA3AF',marginBottom:2}}>Columns</div><div style={{fontSize:13,fontWeight:600,color:'#111827'}}>{columns.length}</div></div>
                {Object.entries(mapping).filter(([,v])=>v&&v!=='None').map(([k,v])=>(
                  <div key={k}><div style={{fontSize:11,color:'#9CA3AF',marginBottom:2,textTransform:'capitalize'}}>{k}</div><div style={{fontSize:13,fontWeight:600,color:'#111827'}}>{v}</div></div>
                ))}
              </div>
            </div>
            <div style={{...S.card,marginBottom:24,background:appliedFuzzy?'#F0FDF4':'#FFFBEB',border:`1px solid ${appliedFuzzy?'#BBF7D0':'#FDE68A'}`}}>
              <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'#9CA3AF',marginBottom:10}}>Data Quality</div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                {qState==='done'?<CheckCircle size={14} color={appliedFuzzy?'#16A34A':'#D97706'}/>:<AlertCircle size={14} color="#D97706"/>}
                <span style={{fontSize:13,color:'#374151'}}>
                  {qState==='done'
                    ?appliedFuzzy
                      ?`Consolidation applied · ${stats?.matched} matches across ${matches.length} unique names`
                      :`${matches.length} unique names analyzed · ${stats?.matched} matched · consolidation not applied`
                    :'Quality checks not run'}
                </span>
              </div>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setStep('quality')} style={S.btnSecondary}>← Back</button>
              <button onClick={()=>{if(!file||!rawRows.length) return;const csvText=dataCubeStore.buildCsv(columns,rawRows);const blob=new Blob([csvText],{type:'text/csv'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=file.name.replace(/\.(csv|xlsx|xls)$/,'')+'_cleaned.csv';a.click();URL.revokeObjectURL(url)}} style={{...S.btnSecondary,padding:'11px 24px',fontSize:14}}>Download data cube</button>
              <button onClick={launchAnalytics} style={{...S.btnPrimary,padding:'11px 24px',fontSize:14}}><CheckCircle size={14}/> Launch Analytics Engine</button>
            </div>
          </div>
        )}

      </div>

      {/* ── Edit / Assign Modal ─────────────────────────────────────────────── */}
      {editModalMatch&&(
        <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}}
          onClick={()=>setEditModalMatch(null)}>
          <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:520,padding:28,boxShadow:'0 20px 40px rgba(0,0,0,0.15)'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:16,fontWeight:700,color:'#111827',marginBottom:16}}>Change Match Assignment</div>
            <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'#9CA3AF',marginBottom:6}}>Source Name</div>
            <div style={{padding:'12px 16px',background:'#F9FAFB',border:'1px solid #E5E7EB',borderRadius:8,fontSize:14,fontWeight:600,color:'#111827',marginBottom:20}}>{editModalMatch.source}</div>
            <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'#9CA3AF',marginBottom:6}}>Search canonical names</div>
            <input value={editSearch} onChange={e=>setEditSearch(e.target.value)} placeholder="Type to find a canonical name…"
              autoFocus style={{width:'100%',padding:'10px 14px',border:'1px solid #E5E7EB',borderRadius:8,fontSize:13,outline:'none',color:'#111827',marginBottom:8}}/>
            <div style={{maxHeight:240,overflowY:'auto',border:'1px solid #E5E7EB',borderRadius:8,background:'#fff'}}>
              {editResults.length===0?(
                <div style={{padding:'16px',textAlign:'center',color:'#9CA3AF',fontSize:12}}>
                  {editSearch?'No results found':'Type to search, or review suggestions above'}
                </div>
              ):editResults.map(name=>(
                <div key={name} onClick={()=>assignMatch(editModalMatch.id,name)}
                  style={{padding:'10px 16px',cursor:'pointer',borderBottom:'1px solid #F3F4F6',fontSize:13,color:'#111827',fontWeight:500}}
                  onMouseEnter={e=>e.currentTarget.style.background='#F9FAFB'}
                  onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                  {name}
                </div>
              ))}
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:20,paddingTop:16,borderTop:'1px solid #F3F4F6'}}>
              <button onClick={()=>clearMatch(editModalMatch.id)} style={{padding:'8px 14px',borderRadius:8,border:'1px solid #FECACA',background:'#FEF2F2',color:'#DC2626',fontSize:12,fontWeight:600,cursor:'pointer'}}>Clear Match</button>
              <button onClick={()=>setEditModalMatch(null)} style={{padding:'8px 14px',borderRadius:8,border:'1px solid #E5E7EB',background:'#fff',color:'#374151',fontSize:12,fontWeight:600,cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </DashboardLayout>
  )
}
