// @ts-nocheck
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, CheckCircle, ArrowRight, ChevronRight, AlertCircle, Users, Loader2, RefreshCw, AlertTriangle, Search, Edit2, X, Check, ChevronDown, ChevronUp } from 'lucide-react'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import { supabase } from '../../lib/supabase'
import { dataCubeStore } from '../../lib/dataCubeStore'

// ── Types ─────────────────────────────────────────────────────────────────────
type DatasetType = 'revenue' | 'billing' | 'bookings'
type Step = 'upload' | 'map' | 'quality' | 'review'

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
  { id: 'upload',  label: 'Upload' },
  { id: 'map',     label: 'Map Fields' },
  { id: 'quality', label: 'Data Quality' },
  { id: 'review',  label: 'Review' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// SIX-LAYER FUZZY ENGINE
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
  const busSuffixes = /\b(INC|LLC|LLP|LTD|LIMITED|CORP|CORPORATION|CO|COMPANY|PA|PLLC|PLC|GMBH|AG|SA|BV|HOLDINGS|GROUP|INTERNATIONAL|ENTERPRISES|SERVICES|LP|LC)\b/g
  s = s.replace(busSuffixes,' ')
  return s.replace(/\s+/g,' ').trim()
}

function standardLev(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1
  const la = a.length, lb = b.length
  const d = Array.from({length:la+1}, () => new Uint16Array(lb+1))
  for (let i = 0; i <= la; i++) d[i][0] = i
  for (let j = 0; j <= lb; j++) d[0][j] = j
  for (let i = 1; i <= la; i++)
    for (let j = 1; j <= lb; j++)
      d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+(a[i-1]===b[j-1]?0:1))
  return 1 - d[la][lb] / Math.max(la, lb)
}

function tokenSetRatio(s1, s2) {
  const t1 = s1.split(' ').filter(x=>x), t2 = s2.split(' ').filter(x=>x)
  const intersect = t1.filter(x => t2.includes(x))
  const diff1 = t1.filter(x => !t2.includes(x))
  const diff2 = t2.filter(x => !t1.includes(x))
  return Math.max(
    standardLev(intersect.join(' '), [...intersect,...diff1].join(' ')),
    standardLev(intersect.join(' '), [...intersect,...diff2].join(' ')),
    standardLev([...intersect,...diff1].join(' '), [...intersect,...diff2].join(' '))
  )
}

function soundex(s) {
  if (!s) return ''
  const codes = {A:'',E:'',I:'',O:'',U:'',B:1,F:1,P:1,V:1,C:2,G:2,J:2,K:2,Q:2,S:2,X:2,Z:2,D:3,T:3,L:4,M:5,N:5,R:6}
  const a = s.split('')
  const f = a.shift()
  const r = f + a.map(v=>codes[v]).filter((v,i,arr)=>(i===0?v!==codes[f]:v!==arr[i-1])).filter(v=>v!=='').join('')
  return (r+'000').slice(0,4)
}

function multiSoundex(str) { return str.split(' ').map(soundex).join(' ') }

function jaroWinkler(s1, s2) {
  if (s1 === s2) return 1
  const len1 = s1.length, len2 = s2.length
  if (!len1 || !len2) return 0
  const mw = Math.max(0, Math.floor(Math.max(len1,len2)/2)-1)
  const m1 = new Array(len1).fill(false), m2 = new Array(len2).fill(false)
  let m = 0
  for (let i = 0; i < len1; i++)
    for (let j = Math.max(0,i-mw); j < Math.min(i+mw+1,len2); j++)
      if (!m2[j] && s1[i]===s2[j]) { m1[i]=true; m2[j]=true; m++; break }
  if (!m) return 0
  let t=0, k=0
  for (let i=0;i<len1;i++) { if(m1[i]){while(!m2[k])k++;if(s1[i]!==s2[k])t++;k++} }
  const jaro = (m/len1+m/len2+(m-t/2)/m)/3
  let prefix=0
  for (let i=0;i<Math.min(4,Math.min(len1,len2));i++){if(s1[i]===s2[i])prefix++;else break}
  return jaro+prefix*0.1*(1-jaro)
}

function getClean(raw) {
  return cleanEntity(raw).replace(/[:\-]/g,' ').replace(/\s+/g,' ').trim()
}

function evalScore(s1, s2) {
  if (!s1 || !s2) return {val:0, meth:'none'}
  if (s1 === s2) return {val:100, meth:'exact'}
  const tsr  = tokenSetRatio(s1, s2)
  const phon = standardLev(multiSoundex(s1), multiSoundex(s2))
  const jw   = jaroWinkler(s1, s2)
  const lev  = standardLev(s1, s2)
  const val  = Math.round((tsr*0.35 + phon*0.10 + jw*0.30 + lev*0.25) * 100)
  const meth = tsr>0.95?'substring':jw>0.90?'jaro-winkler':lev>0.85?'levenshtein':'fuzzy'
  return {val, meth}
}

// ── File reading helper ────────────────────────────────────────────────────────
function readFileAsText(f) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = e => resolve(e.target?.result || '')
    r.onerror = reject
    r.readAsText(f)
  })
}

// ── Main component ────────────────────────────────────────────────────────────
export default function UploadPage() {
  const router = useRouter()
  const [profile, setProfile]       = useState(null)
  const [step, setStep]             = useState('upload')
  const stepIdx = STEPS.findIndex(s => s.id === step)
  const [file, setFile]             = useState(null)
  const [rawRows, setRawRows]       = useState([])
  const [columns, setColumns]       = useState([])
  const [datasetType, setDatasetType] = useState('revenue')
  const [mapping, setMapping]       = useState({})
  const [error, setError]           = useState('')

  // ── Quality step state ──────────────────────────────────────────────────────
  const [qualityState, setQualityState]   = useState('idle') // 'idle'|'running'|'done'
  const [qualityProgress, setQualityProgress] = useState(0)
  const [qualityMsg, setQualityMsg]       = useState('')
  const [fuzzyGroups, setFuzzyGroups]     = useState([])
  // Each group: { canonical, editedCanonical, members[], confidence, method, status }
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [appliedFuzzy, setAppliedFuzzy]   = useState(false)
  const [expandedIdx, setExpandedIdx]     = useState(null)
  const [editingIdx, setEditingIdx]       = useState(null)
  const [editValue, setEditValue]         = useState('')
  const [searchQuery, setSearchQuery]     = useState('')
  const [filterStatus, setFilterStatus]   = useState('all')
  const runRef = useRef(0)

  // ── Upload source tab state ─────────────────────────────────────────────────
  const [sourceTab, setSourceTab]           = useState('file')
  const folderInputRef                      = useRef(null)
  const [folderFiles, setFolderFiles]       = useState([])
  const [folderMerging, setFolderMerging]   = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('')
  const [connectionTesting, setConnectionTesting] = useState(false)
  const [dbConfig, setDbConfig]             = useState({ type:'postgres', host:'', port:'5432', db:'', user:'', pass:'', query:'' })
  const [cloudConfig, setCloudConfig]       = useState({ type:'gdrive', url:'', token:'' })
  const [apiConfig, setApiConfig]           = useState({ method:'GET', url:'', headers:'', schedule:'manual' })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }
      supabase.from('profiles').select('*').eq('id', session.user.id).single()
        .then(({ data }) => { if (data) setProfile(data) })
    })
  }, [router])

  // ── Parse file ─────────────────────────────────────────────────────────────
  const onDrop = useCallback((accepted) => {
    if (!accepted.length) return
    const f = accepted[0]
    setFile(f)
    setColumns([])
    setRawRows([])
    setQualityState('idle')
    setAppliedFuzzy(false)
    setFuzzyGroups([])
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result
      const lines = text.split('\n').filter(l => l.trim())
      if (!lines.length) return
      const cols = lines[0].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''))
      setColumns(cols)
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''))
        const row = {}
        cols.forEach((col, i) => { row[col] = vals[i] || '' })
        return row
      })
      setRawRows(rows)
    }
    if (f.name.endsWith('.csv')) reader.readAsText(f)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    maxFiles: 1,
  })

  // ── Six-layer fuzzy engine ──────────────────────────────────────────────────
  async function runQualityChecks() {
    const customerCol = mapping.customer
    if (!customerCol || !rawRows.length) return
    setQualityState('running')
    setQualityProgress(0)
    setFuzzyGroups([])
    setAppliedFuzzy(false)
    setExpandedIdx(null)
    const myRun = ++runRef.current
    await new Promise(r => setTimeout(r, 30))

    // Extract unique names
    setQualityMsg('Extracting customer names…')
    setQualityProgress(10)
    await new Promise(r => setTimeout(r, 20))
    const nameSet = new Map()
    for (const row of rawRows) {
      const raw = String(row[customerCol] ?? '').trim()
      if (raw) nameSet.set(raw, (nameSet.get(raw)||0)+1)
    }
    const names = Array.from(nameSet.keys())
    setTotalCustomers(names.length)
    if (runRef.current !== myRun) return

    // Clean names
    setQualityMsg(`Cleaning ${names.length.toLocaleString()} names…`)
    setQualityProgress(20)
    await new Promise(r => setTimeout(r, 20))
    const objs = names
      .map(raw => ({ raw, clean: getClean(raw), count: nameSet.get(raw)||1 }))
      .filter(o => o.clean.length > 0)
      .sort((a,b) => a.clean.length - b.clean.length)
    if (runRef.current !== myRun) return

    // Cluster
    setQualityMsg('Running six-layer similarity engine…')
    setQualityProgress(30)
    await new Promise(r => setTimeout(r, 30))
    const clusters = []
    for (let i = 0; i < objs.length; i++) {
      if (runRef.current !== myRun) return
      const u = objs[i]
      let bestCluster = null, bestScore = 0, bestMethod = 'none'
      for (const c of clusters) {
        const score = evalScore(u.clean, c.root.clean)
        if (score.val > bestScore) { bestScore=score.val; bestCluster=c; bestMethod=score.meth; if(bestScore===100)break }
      }
      const thresh = u.raw.length < 8 ? 101 : u.raw.length <= 15 ? 80 : 75
      if (bestCluster && bestScore >= thresh) {
        bestCluster.members.push(u)
        if (bestScore < bestCluster.confidence) { bestCluster.confidence=bestScore; bestCluster.method=bestMethod }
      } else {
        clusters.push({ root:u, members:[u], confidence:100, method:'exact' })
      }
      if (i % 100 === 0) {
        setQualityProgress(30 + Math.floor(i/objs.length*55))
        setQualityMsg(`Grouping ${i.toLocaleString()} / ${objs.length.toLocaleString()}…`)
        await new Promise(r => setTimeout(r, 0))
      }
    }
    if (runRef.current !== myRun) return

    setQualityProgress(90)
    setQualityMsg('Building review groups…')
    await new Promise(r => setTimeout(r, 20))

    const groups = clusters
      .filter(c => c.members.length > 1)
      .sort((a,b) => a.confidence - b.confidence)
      .map(c => {
        const canonical = c.members.reduce((best,m) =>
          m.clean.split(' ').length > best.clean.split(' ').length ? m : best
        ).raw
        return {
          canonical,
          editedCanonical: null,
          members: c.members.map(m => m.raw),
          confidence: c.confidence,
          method: c.method,
          status: c.confidence >= 90 ? 'approved' : 'pending',
        }
      })

    setQualityProgress(100)
    setQualityMsg('Done')
    setFuzzyGroups(groups)
    setQualityState('done')
  }

  // ── Apply approved mappings to rawRows ──────────────────────────────────────
  function applyFuzzyMapping() {
    const customerCol = mapping.customer
    if (!customerCol) return
    const mappingMap = new Map()
    for (const gr of fuzzyGroups) {
      if (gr.status === 'approved') {
        const target = gr.editedCanonical || gr.canonical
        for (const m of gr.members) { if (m !== target) mappingMap.set(m, target) }
      }
    }
    setRawRows(prev => prev.map(row => ({
      ...row,
      [customerCol]: mappingMap.get(row[customerCol]) || row[customerCol],
    })))
    setAppliedFuzzy(true)
    setTotalCustomers(new Set(
      rawRows.map(r => mappingMap.get(r[customerCol]) || r[customerCol]).filter(Boolean)
    ).size)
  }

  // ── Group helpers ───────────────────────────────────────────────────────────
  function toggleStatus(idx) {
    setFuzzyGroups(g => g.map((gr,i) => i!==idx?gr:{...gr,
      status: gr.status==='approved'?'rejected':gr.status==='rejected'?'pending':'approved'
    }))
  }
  function approveAll() { setFuzzyGroups(g => g.map(gr=>({...gr,status:'approved'}))) }
  function rejectAll()  { setFuzzyGroups(g => g.map(gr=>({...gr,status:'rejected'}))) }
  function startEdit(idx) { setEditingIdx(idx); setEditValue(fuzzyGroups[idx].editedCanonical||fuzzyGroups[idx].canonical) }
  function saveEdit(idx)  {
    setFuzzyGroups(g => g.map((gr,i)=>i!==idx?gr:{...gr,editedCanonical:editValue.trim()||gr.canonical}))
    setEditingIdx(null)
  }

  // ── Launch ──────────────────────────────────────────────────────────────────
  function launchAnalytics() {
    if (!file || !rawRows.length) return
    const transforms = []
    if (appliedFuzzy) transforms.push('customer_consolidation')
    const csvText = dataCubeStore.buildCsv(columns, rawRows)
    dataCubeStore.save({
      meta: { fileName:file.name, datasetType, rowCount:rawRows.length, columns, mapping, transforms, createdAt:new Date().toISOString() },
      csvText,
    })
    router.push('/app/command-center')
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const S = {
    card:         { background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, padding:'20px 24px' },
    label:        { fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#9CA3AF' },
    chip:         { fontSize:10, padding:'2px 8px', borderRadius:20, border:'1px solid #E5E7EB', background:'#F9FAFB', color:'#374151', fontWeight:500 },
    btnPrimary:   { display:'flex', alignItems:'center', gap:6, padding:'9px 20px', background:'#2563EB', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' },
    btnSecondary: { display:'flex', alignItems:'center', gap:6, padding:'9px 20px', background:'#fff', color:'#374151', border:'1px solid #E5E7EB', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' },
    input:        { width:'100%', padding:'7px 10px', border:'1px solid #E5E7EB', borderRadius:6, fontSize:13, outline:'none', color:'#111827' },
  }

  // Confidence colour helpers
  const confColor = (c) => c>=90?'#10B981':c>=75?'#F59E0B':'#EF4444'
  const statusColor = {approved:'#10B981',pending:'#F59E0B',rejected:'#EF4444'}
  const statusBg    = {approved:'#ECFDF5',pending:'#FFFBEB',rejected:'#FEF2F2'}

  // Filtered groups for the review table
  const filteredGroups = fuzzyGroups.filter(gr => {
    if (filterStatus !== 'all' && gr.status !== filterStatus) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (gr.editedCanonical||gr.canonical).toLowerCase().includes(q) ||
             gr.members.some(m => m.toLowerCase().includes(q))
    }
    return true
  })

  const stats = {
    total:    fuzzyGroups.length,
    approved: fuzzyGroups.filter(g=>g.status==='approved').length,
    pending:  fuzzyGroups.filter(g=>g.status==='pending').length,
    rejected: fuzzyGroups.filter(g=>g.status==='rejected').length,
    entities: fuzzyGroups.reduce((s,g)=>s+g.members.length,0),
  }

  return (
    <DashboardLayout profile={profile} title="Analytics Engine">
      <div style={{ maxWidth:780, margin:'0 auto', padding:'32px 40px' }}>

        {/* ── Step indicator ── */}
        <div style={{ display:'flex', alignItems:'center', marginBottom:40 }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{ display:'flex', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{
                  width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:12, fontWeight:700, flexShrink:0,
                  background: i <= stepIdx ? '#2563EB' : '#F3F4F6',
                  color: i <= stepIdx ? '#fff' : '#9CA3AF',
                }}>
                  {i < stepIdx ? '✓' : i + 1}
                </div>
                <span style={{ fontSize:13, fontWeight: i===stepIdx?600:400, color: i===stepIdx?'#111827':i<stepIdx?'#2563EB':'#9CA3AF' }}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ width:48, height:1, background: i<stepIdx?'#2563EB':'#E5E7EB', margin:'0 12px' }}/>
              )}
            </div>
          ))}
        </div>

        {/* ══ STEP 1: UPLOAD ══════════════════════════════════════════════════ */}
        {step === 'upload' && (
          <div>
            <div style={{ fontSize:22, fontWeight:700, color:'#111827', marginBottom:6, letterSpacing:'-0.02em' }}>Add your data</div>
            <div style={{ fontSize:13, color:'#6B7280', marginBottom:24 }}>Choose how to bring your data into RevenueLens.</div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
              {DATASET_TYPES.map(t => (
                <button key={t.id} onClick={() => setDatasetType(t.id)} style={{
                  padding:'14px 16px', borderRadius:10, border:`2px solid ${datasetType===t.id?'#2563EB':'#E5E7EB'}`,
                  background: datasetType===t.id?'#EFF6FF':'#fff', cursor:'pointer', textAlign:'left', transition:'all 150ms',
                }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#111827', marginBottom:2 }}>{t.label}</div>
                  <div style={{ fontSize:11, color:'#6B7280' }}>{t.desc}</div>
                </button>
              ))}
            </div>

            <div style={{ display:'flex', gap:2, marginBottom:0, background:'#F3F4F6', padding:4, borderRadius:10, width:'fit-content' }}>
              {[{id:'file',label:'File'},{id:'folder',label:'Folder'},{id:'database',label:'Database'},{id:'cloud',label:'Cloud Storage'},{id:'api',label:'API / Webhook'}].map(tab => (
                <button key={tab.id} onClick={() => { setSourceTab(tab.id); setConnectionStatus('') }} style={{
                  padding:'6px 14px', borderRadius:7, border:'none', cursor:'pointer', fontSize:12, fontWeight:sourceTab===tab.id?600:400,
                  background: sourceTab===tab.id?'#fff':'transparent', color: sourceTab===tab.id?'#111827':'#6B7280',
                  boxShadow: sourceTab===tab.id?'0 1px 3px rgba(0,0,0,0.08)':'none', transition:'all 150ms',
                }}>{tab.label}</button>
              ))}
            </div>

            {sourceTab === 'file' && (
              <div style={{ marginTop:12 }}>
                <div {...getRootProps()} style={{
                  borderRadius:12, border:`2px dashed ${isDragActive?'#2563EB':file?'#16A34A':'#D1D5DB'}`,
                  padding:'48px 24px', textAlign:'center', cursor:'pointer', transition:'all 150ms',
                  background: isDragActive?'#EFF6FF':file?'#F0FDF4':'#F9FAFB',
                }}>
                  <input {...getInputProps()} />
                  {file ? (
                    <div>
                      <FileText size={36} color="#16A34A" style={{ margin:'0 auto 10px' }}/>
                      <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:4 }}>{file.name}</div>
                      <div style={{ fontSize:12, color:'#6B7280' }}>{columns.length} columns · {rawRows.length.toLocaleString()} rows detected</div>
                      <button onClick={e=>{e.stopPropagation();setFile(null);setRawRows([]);setColumns([])}} style={{ marginTop:8, fontSize:11, color:'#6B7280', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>Remove</button>
                    </div>
                  ) : (
                    <div>
                      <Upload size={36} color="#9CA3AF" style={{ margin:'0 auto 10px' }}/>
                      <div style={{ fontSize:14, fontWeight:600, color:'#374151', marginBottom:4 }}>Drag and drop your file, or click to browse</div>
                      <div style={{ fontSize:12, color:'#9CA3AF' }}>CSV, Excel (.xlsx) · Max 200MB</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {sourceTab === 'folder' && (
              <div style={{ marginTop:12 }}>
                <input ref={folderInputRef} type="file" webkitdirectory="" multiple style={{ display:'none' }}
                  onChange={async e => {
                    const allFiles = Array.from(e.target.files || [])
                    const csvXlsx = allFiles.filter(f => f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))
                    setFolderFiles(csvXlsx)
                    if (!csvXlsx.length) return
                    setFolderMerging(true)
                    let mergedRows = [], mergedCols = []
                    for (const f of csvXlsx) {
                      try {
                        const text = await readFileAsText(f)
                        const lines = text.split('\n').filter(l => l.trim())
                        if (!lines.length) continue
                        const cols = lines[0].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''))
                        if (!mergedCols.length) mergedCols = cols
                        const rows = lines.slice(1).map(line => {
                          const vals = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''))
                          const row = {}
                          cols.forEach((col, i) => { row[col] = vals[i] || '' })
                          return row
                        })
                        mergedRows = [...mergedRows, ...rows]
                      } catch {}
                    }
                    setColumns(mergedCols)
                    setRawRows(mergedRows)
                    setFile(new File([dataCubeStore.buildCsv(mergedCols, mergedRows)], 'merged_folder.csv', { type:'text/csv' }))
                    setFolderMerging(false)
                  }}
                />
                <div onClick={() => folderInputRef.current?.click()} style={{
                  borderRadius:12, border:'2px dashed #D1D5DB', padding:'48px 24px', textAlign:'center',
                  cursor:'pointer', background: folderFiles.length?'#F0FDF4':'#F9FAFB', transition:'all 150ms',
                }}>
                  {folderMerging ? (
                    <div><Loader2 size={32} color="#2563EB" style={{ margin:'0 auto 10px', animation:'spin 1s linear infinite' }}/><div style={{ fontSize:14, color:'#374151' }}>Merging files…</div></div>
                  ) : folderFiles.length ? (
                    <div>
                      <CheckCircle size={32} color="#16A34A" style={{ margin:'0 auto 10px' }}/>
                      <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:6 }}>{folderFiles.length} files merged</div>
                      <div style={{ fontSize:12, color:'#6B7280', marginBottom:10 }}>{rawRows.length.toLocaleString()} total rows · {columns.length} columns</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4, justifyContent:'center' }}>
                        {folderFiles.slice(0,6).map((f,i) => <span key={i} style={{ fontSize:10, padding:'2px 8px', background:'#ECFDF5', color:'#065F46', borderRadius:20, border:'1px solid #A7F3D0' }}>{f.name}</span>)}
                        {folderFiles.length > 6 && <span style={{ fontSize:10, padding:'2px 8px', background:'#F3F4F6', color:'#6B7280', borderRadius:20 }}>+{folderFiles.length-6} more</span>}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Upload size={36} color="#9CA3AF" style={{ margin:'0 auto 10px' }}/>
                      <div style={{ fontSize:14, fontWeight:600, color:'#374151', marginBottom:4 }}>Click to select a folder</div>
                      <div style={{ fontSize:12, color:'#9CA3AF' }}>All CSV and Excel files inside will be merged into one dataset</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {sourceTab === 'database' && (
              <div style={{ marginTop:12, ...S.card }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:20 }}>
                  {[{id:'postgres',label:'PostgreSQL'},{id:'mysql',label:'MySQL'},{id:'mssql',label:'SQL Server'},{id:'redshift',label:'Redshift'}].map(db => (
                    <button key={db.id} onClick={() => setDbConfig(p => ({...p, type:db.id}))} style={{
                      padding:'10px 8px', borderRadius:8, border:`2px solid ${dbConfig.type===db.id?'#2563EB':'#E5E7EB'}`,
                      background:dbConfig.type===db.id?'#EFF6FF':'#fff', cursor:'pointer', fontSize:12, fontWeight:600, color:'#111827',
                    }}>{db.label}</button>
                  ))}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                  <div><div style={{ ...S.label, marginBottom:4 }}>Host</div><input style={S.input} placeholder="db.example.com" value={dbConfig.host} onChange={e => setDbConfig(p => ({...p, host:e.target.value}))}/></div>
                  <div><div style={{ ...S.label, marginBottom:4 }}>Port</div><input style={S.input} placeholder="5432" value={dbConfig.port} onChange={e => setDbConfig(p => ({...p, port:e.target.value}))}/></div>
                  <div><div style={{ ...S.label, marginBottom:4 }}>Database name</div><input style={S.input} placeholder="analytics_db" value={dbConfig.db} onChange={e => setDbConfig(p => ({...p, db:e.target.value}))}/></div>
                  <div><div style={{ ...S.label, marginBottom:4 }}>Username</div><input style={S.input} placeholder="readonly_user" value={dbConfig.user} onChange={e => setDbConfig(p => ({...p, user:e.target.value}))}/></div>
                  <div style={{ gridColumn:'1/-1' }}><div style={{ ...S.label, marginBottom:4 }}>Password</div><input style={S.input} type="password" placeholder="••••••••" value={dbConfig.pass} onChange={e => setDbConfig(p => ({...p, pass:e.target.value}))}/></div>
                  <div style={{ gridColumn:'1/-1' }}><div style={{ ...S.label, marginBottom:4 }}>SQL Query</div>
                    <textarea style={{ ...S.input, height:80, fontFamily:'monospace', fontSize:12, resize:'vertical' }}
                      placeholder="SELECT customer_name, date, arr FROM subscriptions" value={dbConfig.query} onChange={e => setDbConfig(p => ({...p, query:e.target.value}))}/>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <button onClick={() => { setConnectionTesting(true); setTimeout(() => { setConnectionTesting(false); setConnectionStatus('Coming Soon') }, 800) }} style={{ ...S.btnSecondary, fontSize:12 }}>
                    {connectionTesting ? <><Loader2 size={12} style={{ animation:'spin 1s linear infinite' }}/> Testing…</> : 'Test connection'}
                  </button>
                  {connectionStatus && <span style={{ fontSize:12, color:'#6B7280', fontWeight:500 }}>{connectionStatus}</span>}
                </div>
              </div>
            )}

            {sourceTab === 'cloud' && (
              <div style={{ marginTop:12, ...S.card }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:20 }}>
                  {[{id:'gdrive',label:'Google Drive'},{id:'s3',label:'Amazon S3'},{id:'sharepoint',label:'SharePoint'},{id:'dropbox',label:'Dropbox'},{id:'onedrive',label:'OneDrive'},{id:'gcs',label:'Google Cloud Storage'}].map(cl => (
                    <button key={cl.id} onClick={() => setCloudConfig(p => ({...p, type:cl.id}))} style={{
                      padding:'10px 8px', borderRadius:8, border:`2px solid ${cloudConfig.type===cl.id?'#2563EB':'#E5E7EB'}`,
                      background:cloudConfig.type===cl.id?'#EFF6FF':'#fff', cursor:'pointer', fontSize:12, fontWeight:600, color:'#111827',
                    }}>{cl.label}</button>
                  ))}
                </div>
                <div style={{ marginBottom:12 }}><div style={{ ...S.label, marginBottom:4 }}>File URL or path</div><input style={S.input} placeholder="gs://my-bucket/data/revenue.csv" value={cloudConfig.url} onChange={e => setCloudConfig(p => ({...p, url:e.target.value}))}/></div>
                <div style={{ marginBottom:16 }}><div style={{ ...S.label, marginBottom:4 }}>Access token / API key</div><input style={S.input} type="password" placeholder="••••••••" value={cloudConfig.token} onChange={e => setCloudConfig(p => ({...p, token:e.target.value}))}/></div>
                <div style={{ padding:'10px 14px', background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, fontSize:12, color:'#92400E' }}>Cloud storage connections are coming soon.</div>
              </div>
            )}

            {sourceTab === 'api' && (
              <div style={{ marginTop:12, ...S.card }}>
                <div style={{ display:'grid', gridTemplateColumns:'120px 1fr', gap:12, marginBottom:12 }}>
                  <div><div style={{ ...S.label, marginBottom:4 }}>Method</div>
                    <select style={{ ...S.input, background:'#fff' }} value={apiConfig.method} onChange={e => setApiConfig(p => ({...p, method:e.target.value}))}><option>GET</option><option>POST</option></select>
                  </div>
                  <div><div style={{ ...S.label, marginBottom:4 }}>Endpoint URL</div><input style={S.input} placeholder="https://api.example.com/v2/revenue" value={apiConfig.url} onChange={e => setApiConfig(p => ({...p, url:e.target.value}))}/></div>
                </div>
                <div style={{ marginBottom:12 }}><div style={{ ...S.label, marginBottom:4 }}>Headers (JSON)</div>
                  <textarea style={{ ...S.input, height:64, fontFamily:'monospace', fontSize:12, resize:'vertical' }} placeholder={'{ "Authorization": "Bearer token" }'} value={apiConfig.headers} onChange={e => setApiConfig(p => ({...p, headers:e.target.value}))}/>
                </div>
                <div style={{ marginBottom:16 }}>
                  <div style={{ ...S.label, marginBottom:6 }}>Refresh schedule</div>
                  <div style={{ display:'flex', gap:8 }}>
                    {[{id:'manual',label:'Manual only'},{id:'daily',label:'Daily'},{id:'weekly',label:'Weekly'},{id:'monthly',label:'Monthly'}].map(s => (
                      <button key={s.id} onClick={() => setApiConfig(p => ({...p, schedule:s.id}))} style={{
                        padding:'5px 14px', borderRadius:6, border:`1.5px solid ${apiConfig.schedule===s.id?'#2563EB':'#E5E7EB'}`,
                        background:apiConfig.schedule===s.id?'#EFF6FF':'#fff', cursor:'pointer', fontSize:12,
                        fontWeight:apiConfig.schedule===s.id?600:400, color:apiConfig.schedule===s.id?'#2563EB':'#6B7280',
                      }}>{s.label}</button>
                    ))}
                  </div>
                </div>
                <div style={{ padding:'10px 14px', background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, fontSize:12, color:'#92400E' }}>API connections are coming soon.</div>
              </div>
            )}

            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:24 }}>
              <button onClick={() => setStep('map')} disabled={!file} style={{ ...S.btnPrimary, opacity:file?1:0.4, cursor:file?'pointer':'default' }}>
                Continue to field mapping <ArrowRight size={14}/>
              </button>
            </div>
          </div>
        )}

        {/* ══ STEP 2: MAP FIELDS ══════════════════════════════════════════════ */}
        {step === 'map' && (
          <div>
            <div style={{ fontSize:22, fontWeight:700, color:'#111827', marginBottom:6, letterSpacing:'-0.02em' }}>Map your columns</div>
            <div style={{ fontSize:13, color:'#6B7280', marginBottom:28 }}>Tell us which column in your file corresponds to each field.</div>

            <div style={{ ...S.card, padding:0, overflow:'hidden', marginBottom:20 }}>
              {FIELDS.map((field, i) => (
                <div key={field.key} style={{ display:'flex', alignItems:'center', gap:16, padding:'14px 20px', borderBottom: i<FIELDS.length-1?'1px solid #F3F4F6':'none' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:'#111827' }}>{field.label}</span>
                      {field.required
                        ? <span style={{ fontSize:9, fontWeight:700, background:'#EFF6FF', color:'#2563EB', border:'1px solid #BFDBFE', padding:'1px 6px', borderRadius:20 }}>Required</span>
                        : <span style={{ fontSize:9, color:'#9CA3AF', background:'#F9FAFB', border:'1px solid #E5E7EB', padding:'1px 6px', borderRadius:20 }}>Optional</span>
                      }
                    </div>
                  </div>
                  <select value={mapping[field.key] || ''} onChange={e => setMapping(m => ({ ...m, [field.key]: e.target.value }))}
                    style={{ width:200, padding:'7px 10px', border:'1px solid #E5E7EB', borderRadius:6, fontSize:13, outline:'none', color:'#111827', background:'#fff' }}>
                    <option value="">— Select column —</option>
                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {error && (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, marginBottom:16, fontSize:13, color:'#DC2626' }}>
                <AlertCircle size={14}/>{error}
              </div>
            )}

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setStep('upload')} style={S.btnSecondary}>← Back</button>
              <button onClick={() => {
                if (!mapping.customer || !mapping.date || !mapping.revenue) { setError('Please map Customer, Date, and Revenue fields.'); return }
                setError(''); setQualityState('idle'); setAppliedFuzzy(false); setStep('quality')
              }} style={S.btnPrimary}>Data Quality Checks <ArrowRight size={14}/></button>
            </div>
          </div>
        )}

        {/* ══ STEP 3: DATA QUALITY ════════════════════════════════════════════ */}
        {step === 'quality' && (
          <div>
            <div style={{ fontSize:22, fontWeight:700, color:'#111827', marginBottom:6, letterSpacing:'-0.02em' }}>Data Quality</div>
            <div style={{ fontSize:13, color:'#6B7280', marginBottom:28 }}>Run automated checks and fix issues before analysis.</div>

            {/* ── Customer Name Consolidation card ─────────────────────────── */}
            <div style={{ border:'1px solid #E5E7EB', borderRadius:12, overflow:'hidden', background:'#fff', marginBottom:12 }}>

              {/* Card header */}
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'20px 24px', borderBottom: qualityState==='idle'?'none':'1px solid #F3F4F6' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:'#EEF2FF', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <Users size={16} color="#4F46E5"/>
                  </div>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:'#111827' }}>Customer Name Consolidation</div>
                      {qualityState === 'done' && (
                        <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:20,
                          background: fuzzyGroups.length>0?'#FFFBEB':'#F0FDF4',
                          color: fuzzyGroups.length>0?'#92400E':'#166534',
                          border: fuzzyGroups.length>0?'1px solid #FCD34D':'1px solid #BBF7D0',
                        }}>
                          {fuzzyGroups.length > 0 ? `${fuzzyGroups.length} groups found` : 'All clean'}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize:12, color:'#6B7280', lineHeight:1.6 }}>
                      Detects variations of the same customer — e.g. <em>"Acme Inc"</em>, <em>"ACME"</em>, <em>"Acme Corp"</em> — and consolidates them using a six-layer similarity engine (Levenshtein, Jaro-Winkler, Soundex, Token Set Ratio, TF-IDF, phonetic).
                    </div>
                  </div>
                </div>

                <div style={{ flexShrink:0, marginLeft:16 }}>
                  {qualityState === 'idle' && (
                    <button onClick={runQualityChecks} disabled={!rawRows.length || !mapping.customer}
                      style={{ ...S.btnPrimary, opacity:(!rawRows.length||!mapping.customer)?0.4:1 }}>
                      Run Check
                    </button>
                  )}
                  {qualityState === 'running' && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'#6B7280' }}>
                      <Loader2 size={14} style={{ animation:'spin 1s linear infinite' }}/> Analyzing…
                    </div>
                  )}
                  {qualityState === 'done' && !appliedFuzzy && (
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={runQualityChecks} style={{ ...S.btnSecondary, fontSize:12, padding:'7px 14px' }}>Re-run</button>
                      {stats.approved > 0 && (
                        <button onClick={applyFuzzyMapping}
                          style={{ ...S.btnPrimary, background:'#059669' }}>
                          <Check size={13}/> Apply ({stats.approved})
                        </button>
                      )}
                    </div>
                  )}
                  {appliedFuzzy && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, color:'#16A34A', fontSize:13, fontWeight:600 }}>
                      <CheckCircle size={14}/> Applied
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              {qualityState === 'running' && (
                <div style={{ padding:'14px 24px', background:'#F9FAFB', borderBottom:'1px solid #F3F4F6' }}>
                  <div style={{ height:4, background:'#E5E7EB', borderRadius:2, overflow:'hidden', marginBottom:6 }}>
                    <div style={{ height:'100%', background:'#4F46E5', borderRadius:2, width:`${qualityProgress}%`, transition:'width 0.3s ease' }}/>
                  </div>
                  <div style={{ fontSize:11, color:'#9CA3AF' }}>{qualityMsg}</div>
                </div>
              )}

              {/* Results */}
              {qualityState === 'done' && (
                <>
                  {/* Stats strip */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', borderBottom:'1px solid #F3F4F6' }}>
                    {[
                      { label:'Groups Found',    value:stats.total,    color:'#4F46E5' },
                      { label:'Approved',        value:stats.approved, color:'#10B981' },
                      { label:'Needs Review',    value:stats.pending,  color:'#F59E0B' },
                      { label:'Entities Merged', value:stats.entities, color:'#6B7280' },
                    ].map(s => (
                      <div key={s.label} style={{ padding:'12px 16px', borderRight:'1px solid #F3F4F6' }}>
                        <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'#9CA3AF', marginBottom:3 }}>{s.label}</div>
                        <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {fuzzyGroups.length === 0 ? (
                    <div style={{ padding:'28px', textAlign:'center', color:'#6B7280', fontSize:13 }}>
                      <CheckCircle size={22} color="#10B981" style={{ margin:'0 auto 8px', display:'block' }}/>
                      No duplicate customer names detected. Your data looks clean!
                    </div>
                  ) : (
                    <>
                      {/* Toolbar */}
                      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', borderBottom:'1px solid #F3F4F6', background:'#F9FAFB', flexWrap:'wrap' }}>
                        <div style={{ position:'relative', flex:1, minWidth:160 }}>
                          <Search size={11} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'#9CA3AF' }}/>
                          <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search names…"
                            style={{ width:'100%', padding:'6px 9px 6px 28px', borderRadius:6, border:'1px solid #E5E7EB', fontSize:12, outline:'none', background:'#fff' }}/>
                        </div>
                        <div style={{ display:'flex', gap:4 }}>
                          {(['all','pending','approved','rejected']).map(s => (
                            <button key={s} onClick={()=>setFilterStatus(s)} style={{
                              padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:600, border:'1px solid', cursor:'pointer',
                              borderColor:filterStatus===s?'#4F46E5':'#E5E7EB',
                              background:filterStatus===s?'#4F46E5':'transparent',
                              color:filterStatus===s?'#fff':'#6B7280',
                              textTransform:'capitalize',
                            }}>{s}</button>
                          ))}
                        </div>
                        <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
                          <button onClick={approveAll} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid #D1FAE5', background:'#ECFDF5', color:'#10B981', fontSize:11, fontWeight:600, cursor:'pointer' }}>Approve All</button>
                          <button onClick={rejectAll}  style={{ padding:'4px 10px', borderRadius:6, border:'1px solid #FECACA', background:'#FEF2F2', color:'#EF4444', fontSize:11, fontWeight:600, cursor:'pointer' }}>Reject All</button>
                        </div>
                      </div>

                      {/* Group list */}
                      <div style={{ maxHeight:400, overflowY:'auto' }}>
                        {filteredGroups.map((gr) => {
                          const idx = fuzzyGroups.indexOf(gr)
                          const isExpanded = expandedIdx === idx
                          const isEditing  = editingIdx === idx
                          const canonical  = gr.editedCanonical || gr.canonical
                          return (
                            <div key={idx} style={{ borderBottom:'1px solid #F3F4F6' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 16px', cursor:'pointer', background:isExpanded?'#FAFAFA':'#fff' }}
                                onClick={()=>setExpandedIdx(isExpanded?null:idx)}>

                                {/* Status pill */}
                                <button onClick={e=>{e.stopPropagation();toggleStatus(idx)}}
                                  style={{ flexShrink:0, padding:'2px 8px', borderRadius:20, border:'none', cursor:'pointer', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', background:statusBg[gr.status], color:statusColor[gr.status] }}>
                                  {gr.status}
                                </button>

                                {/* Name / edit */}
                                <div style={{ flex:1, minWidth:0 }}>
                                  {isEditing ? (
                                    <div style={{ display:'flex', gap:5 }} onClick={e=>e.stopPropagation()}>
                                      <input value={editValue} onChange={e=>setEditValue(e.target.value)} autoFocus
                                        onKeyDown={e=>{if(e.key==='Enter')saveEdit(idx);if(e.key==='Escape')setEditingIdx(null)}}
                                        style={{ flex:1, padding:'4px 8px', borderRadius:5, border:'1px solid #4F46E5', fontSize:13, fontWeight:500, outline:'none' }}/>
                                      <button onClick={()=>saveEdit(idx)} style={{ padding:'4px 8px', borderRadius:5, background:'#10B981', border:'none', color:'#fff', cursor:'pointer' }}><Check size={11}/></button>
                                      <button onClick={()=>setEditingIdx(null)} style={{ padding:'4px 8px', borderRadius:5, background:'#F3F4F6', border:'none', color:'#6B7280', cursor:'pointer' }}><X size={11}/></button>
                                    </div>
                                  ) : (
                                    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                                      <span style={{ fontSize:13, fontWeight:600, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{canonical}</span>
                                      {gr.editedCanonical && <span style={{ fontSize:10, color:'#4F46E5', background:'#EEF2FF', padding:'1px 5px', borderRadius:4, flexShrink:0 }}>edited</span>}
                                      <button onClick={e=>{e.stopPropagation();startEdit(idx)}}
                                        style={{ padding:'2px 5px', borderRadius:4, border:'1px solid #E5E7EB', background:'transparent', color:'#9CA3AF', cursor:'pointer', flexShrink:0 }}>
                                        <Edit2 size={9}/>
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <span style={{ fontSize:11, color:'#9CA3AF', flexShrink:0 }}>{gr.members.length} variants</span>

                                {/* Confidence bar */}
                                <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                                  <div style={{ width:40, height:4, background:'#E5E7EB', borderRadius:2, overflow:'hidden' }}>
                                    <div style={{ height:'100%', background:confColor(gr.confidence), width:`${gr.confidence}%`, borderRadius:2 }}/>
                                  </div>
                                  <span style={{ fontSize:11, fontWeight:700, color:confColor(gr.confidence), minWidth:30 }}>{gr.confidence}%</span>
                                </div>

                                <span style={{ fontSize:10, fontWeight:600, padding:'2px 6px', borderRadius:4, background:'#F3F4F6', color:'#6B7280', flexShrink:0, textTransform:'capitalize' }}>{gr.method}</span>

                                {isExpanded ? <ChevronUp size={13} color="#9CA3AF"/> : <ChevronDown size={13} color="#9CA3AF"/>}
                              </div>

                              {/* Expanded variants */}
                              {isExpanded && (
                                <div style={{ padding:'0 16px 12px 48px', background:'#FAFAFA' }}>
                                  <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'#9CA3AF', marginBottom:7 }}>
                                    All variants → mapped to <strong style={{ color:'#4F46E5' }}>{canonical}</strong>
                                  </div>
                                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                                    {gr.members.map(m => (
                                      <div key={m} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 10px', borderRadius:6,
                                        background: m===canonical?'#EEF2FF':'#fff',
                                        border: `1px solid ${m===canonical?'#C7D2FE':'#F3F4F6'}` }}>
                                        {m===canonical
                                          ? <CheckCircle size={11} color="#4F46E5" style={{ flexShrink:0 }}/>
                                          : <div style={{ width:11, height:11, borderRadius:'50%', border:'1px solid #D1D5DB', flexShrink:0 }}/>
                                        }
                                        <span style={{ fontSize:12, color:'#374151' }}>{m}</span>
                                        {m===canonical && <span style={{ fontSize:10, color:'#4F46E5', marginLeft:'auto', fontWeight:600 }}>canonical</span>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                        {filteredGroups.length === 0 && (
                          <div style={{ padding:'28px', textAlign:'center', color:'#9CA3AF', fontSize:13 }}>No groups match your filter.</div>
                        )}
                      </div>

                      {/* Footer */}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', borderTop:'1px solid #F3F4F6', background:'#F9FAFB' }}>
                        <div style={{ fontSize:12, color:'#6B7280' }}>{stats.approved} approved · {stats.pending} pending · {stats.rejected} rejected</div>
                        {!appliedFuzzy && stats.approved > 0 && (
                          <button onClick={applyFuzzyMapping}
                            style={{ ...S.btnPrimary, background:'#4F46E5', padding:'7px 16px', fontSize:12 }}>
                            <Check size={12}/> Approve & Apply ({stats.approved} groups)
                          </button>
                        )}
                        {appliedFuzzy && (
                          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#10B981', fontWeight:600 }}>
                            <CheckCircle size={13}/> Mappings applied to dataset
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* ── Coming soon checks ─────────────────────────────────────────── */}
            {[
              { title:'Duplicate Row Detection', desc:'Identifies exact or near-duplicate records within the same period for the same customer.' },
              { title:'Date Gap Analysis', desc:'Finds missing periods in subscription timelines that could cause incorrect churn classification.' },
              { title:'Negative Value Flagging', desc:'Highlights negative ARR/MRR values that may indicate credits or data entry errors.' },
              { title:'Revenue Smoothing', desc:'Detects and optionally smooths one-time spikes that distort period-over-period trends.' },
            ].map(check => (
              <div key={check.title} style={{ ...S.card, marginBottom:10, opacity:0.55 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#111827', marginBottom:2 }}>{check.title}</div>
                    <div style={{ fontSize:12, color:'#6B7280' }}>{check.desc}</div>
                  </div>
                  <span style={{ fontSize:9, fontWeight:700, background:'#F3F4F6', color:'#6B7280', border:'1px solid #E5E7EB', padding:'2px 8px', borderRadius:20, flexShrink:0, marginLeft:16, textTransform:'uppercase', letterSpacing:'0.06em' }}>Coming Soon</span>
                </div>
              </div>
            ))}

            <div style={{ display:'flex', gap:10, marginTop:24 }}>
              <button onClick={() => setStep('map')} style={S.btnSecondary}>← Back</button>
              <button onClick={() => setStep('review')} style={S.btnPrimary}>Review & Confirm <ArrowRight size={14}/></button>
            </div>
          </div>
        )}

        {/* ══ STEP 4: REVIEW ══════════════════════════════════════════════════ */}
        {step === 'review' && (
          <div>
            <div style={{ fontSize:22, fontWeight:700, color:'#111827', marginBottom:6, letterSpacing:'-0.02em' }}>Review & Launch</div>
            <div style={{ fontSize:13, color:'#6B7280', marginBottom:28 }}>Confirm your configuration before running analytics.</div>

            <div style={{ ...S.card, marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#9CA3AF', marginBottom:16 }}>Configuration</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div><div style={{ fontSize:11, color:'#9CA3AF', marginBottom:2 }}>File</div><div style={{ fontSize:13, fontWeight:600, color:'#111827' }}>{file?.name}</div></div>
                <div><div style={{ fontSize:11, color:'#9CA3AF', marginBottom:2 }}>Dataset Type</div><div style={{ fontSize:13, fontWeight:600, color:'#111827', textTransform:'capitalize' }}>{datasetType}</div></div>
                <div><div style={{ fontSize:11, color:'#9CA3AF', marginBottom:2 }}>Rows</div><div style={{ fontSize:13, fontWeight:600, color:'#111827' }}>{rawRows.length.toLocaleString()}</div></div>
                <div><div style={{ fontSize:11, color:'#9CA3AF', marginBottom:2 }}>Columns</div><div style={{ fontSize:13, fontWeight:600, color:'#111827' }}>{columns.length}</div></div>
                {Object.entries(mapping).filter(([,v]) => v && v !== 'None').map(([k,v]) => (
                  <div key={k}><div style={{ fontSize:11, color:'#9CA3AF', marginBottom:2, textTransform:'capitalize' }}>{k}</div><div style={{ fontSize:13, fontWeight:600, color:'#111827' }}>{v}</div></div>
                ))}
              </div>
            </div>

            <div style={{ ...S.card, marginBottom:24, background:'#F0FDF4', border:'1px solid #BBF7D0' }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#9CA3AF', marginBottom:10 }}>Data Quality</div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                {qualityState === 'done' ? <CheckCircle size={14} color="#16A34A"/> : <AlertCircle size={14} color="#D97706"/>}
                <span style={{ fontSize:13, color:'#374151' }}>
                  {qualityState === 'done'
                    ? appliedFuzzy
                      ? `${stats.approved} customer groups consolidated · ${totalCustomers} unique customers`
                      : fuzzyGroups.length === 0
                      ? `No issues found · ${totalCustomers} unique customers`
                      : `${fuzzyGroups.length} groups found · ${stats.approved} approved, ${stats.pending} pending`
                    : 'Quality checks not run'
                  }
                </span>
              </div>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setStep('quality')} style={S.btnSecondary}>← Back</button>
              <button onClick={() => {
                if (!file || !rawRows.length) return
                const csvText = dataCubeStore.buildCsv(columns, rawRows)
                const blob = new Blob([csvText], { type:'text/csv' })
                const url  = URL.createObjectURL(blob)
                const a    = document.createElement('a')
                a.href=url; a.download=file.name.replace(/\.(csv|xlsx|xls)$/,'')+'_cleaned.csv'; a.click()
                URL.revokeObjectURL(url)
              }} style={{ ...S.btnSecondary, padding:'11px 24px', fontSize:14 }}>
                Download data cube
              </button>
              <button onClick={launchAnalytics} style={{ ...S.btnPrimary, padding:'11px 24px', fontSize:14 }}>
                <CheckCircle size={14}/> Launch Analytics Engine
              </button>
            </div>
          </div>
        )}

      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </DashboardLayout>
  )
}
