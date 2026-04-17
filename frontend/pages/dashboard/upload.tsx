// @ts-nocheck
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, CheckCircle, ArrowRight, ChevronRight, AlertCircle, Users, Loader2, RefreshCw, AlertTriangle } from 'lucide-react'
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

// ── Fuzzy match helpers (client-side, no dependency) ─────────────────────────
function normalize(s) {
  return s.toLowerCase()
    .replace(/[.,\-_&()'"/\\]+/g, ' ')
    .replace(/\b(inc|ltd|llc|corp|co|the|and|plc|gmbh|sas|bv|ag|sa)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function similarity(a, b) {
  const na = normalize(a), nb = normalize(b)
  if (na === nb) return 1
  // Jaccard on bigrams
  function bigrams(s) {
    const bg = new Set()
    for (let i = 0; i < s.length - 1; i++) bg.add(s[i] + s[i+1])
    return bg
  }
  const ba = bigrams(na), bb = bigrams(nb)
  let inter = 0
  ba.forEach(g => { if (bb.has(g)) inter++ })
  const union = ba.size + bb.size - inter
  return union === 0 ? 0 : inter / union
}

function findFuzzyGroups(names, threshold = 0.72) {
  const groups = []
  const assigned = new Set()
  const sorted = [...names].sort()
  for (let i = 0; i < sorted.length; i++) {
    if (assigned.has(sorted[i])) continue
    const group = [sorted[i]]
    assigned.add(sorted[i])
    for (let j = i + 1; j < sorted.length; j++) {
      if (assigned.has(sorted[j])) continue
      if (similarity(sorted[i], sorted[j]) >= threshold) {
        group.push(sorted[j])
        assigned.add(sorted[j])
      }
    }
    if (group.length > 1) groups.push(group)
  }
  return groups
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
  const [rawRows, setRawRows]       = useState([])    // parsed CSV rows
  const [columns, setColumns]       = useState([])
  const [datasetType, setDatasetType] = useState('revenue')
  const [mapping, setMapping]       = useState({})
  const [error, setError]           = useState('')

  // Quality step state
  const [qualityRunning, setQualityRunning] = useState(false)
  const [qualityDone, setQualityDone]       = useState(false)
  const [fuzzyGroups, setFuzzyGroups]       = useState([])   // [{names:[], canonical:''}]
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [resolvedNames, setResolvedNames]   = useState({})   // original → canonical
  const [appliedFuzzy, setAppliedFuzzy]     = useState(false)

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
    setQualityDone(false)
    setAppliedFuzzy(false)
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

  // ── Run data quality checks ─────────────────────────────────────────────────
  function runQualityChecks() {
    setQualityRunning(true)
    setTimeout(() => {
      const customerCol = mapping.customer
      if (customerCol && rawRows.length) {
        const names = [...new Set(rawRows.map(r => r[customerCol]).filter(Boolean))]
        setTotalCustomers(names.length)
        const groups = findFuzzyGroups(names)
        // Build group objects with canonical name (longest/most common)
        const groupObjs = groups.map(grp => ({
          names: grp,
          canonical: grp.reduce((a, b) => a.length >= b.length ? a : b),
        }))
        setFuzzyGroups(groupObjs)
        // Build initial resolution map
        const res = {}
        groupObjs.forEach(g => g.names.forEach(n => { res[n] = g.canonical }))
        setResolvedNames(res)
      }
      setQualityRunning(false)
      setQualityDone(true)
    }, 800)
  }

  // ── Apply fuzzy corrections to rawRows ──────────────────────────────────────
  function applyFuzzyMapping() {
    const customerCol = mapping.customer
    if (!customerCol) return
    setRawRows(prev => prev.map(row => ({
      ...row,
      [customerCol]: resolvedNames[row[customerCol]] || row[customerCol],
    })))
    setAppliedFuzzy(true)
    // Rebuild unique count
    setTotalCustomers(new Set(
      rawRows.map(r => resolvedNames[r[customerCol]] || r[customerCol]).filter(Boolean)
    ).size)
  }

  // ── Launch ──────────────────────────────────────────────────────────────────
  function launchAnalytics() {
    if (!file || !rawRows.length) return

    // Build transforms list
    const transforms: string[] = []
    if (appliedFuzzy) transforms.push('customer_consolidation')

    // Build full cleaned CSV from current rawRows (may have fuzzy corrections applied)
    const csvText = dataCubeStore.buildCsv(columns, rawRows)

    // Save data cube to sessionStorage
    dataCubeStore.save({
      meta: {
        fileName:    file.name,
        datasetType: datasetType,
        rowCount:    rawRows.length,
        columns:     columns,
        mapping:     mapping,
        transforms,
        createdAt:   new Date().toISOString(),
      },
      csvText,
    })

    router.push('/app/command-center')
  }
  // ── Styles ──────────────────────────────────────────────────────────────────
  const S = {
    card:    { background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, padding:'20px 24px' },
    label:   { fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#9CA3AF' },
    chip:    { fontSize:10, padding:'2px 8px', borderRadius:20, border:'1px solid #E5E7EB', background:'#F9FAFB', color:'#374151', fontWeight:500 },
    btnPrimary: { display:'flex', alignItems:'center', gap:6, padding:'9px 20px', background:'#2563EB', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' },
    btnSecondary: { display:'flex', alignItems:'center', gap:6, padding:'9px 20px', background:'#fff', color:'#374151', border:'1px solid #E5E7EB', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' },
    input:   { width:'100%', padding:'7px 10px', border:'1px solid #E5E7EB', borderRadius:6, fontSize:13, outline:'none', color:'#111827' },
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
                  background: i < stepIdx ? '#2563EB' : i === stepIdx ? '#2563EB' : '#F3F4F6',
                  color: i <= stepIdx ? '#fff' : '#9CA3AF',
                }}>
                  {i < stepIdx ? '✓' : i + 1}
                </div>
                <span style={{ fontSize:13, fontWeight: i === stepIdx ? 600 : 400, color: i === stepIdx ? '#111827' : i < stepIdx ? '#2563EB' : '#9CA3AF' }}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ width:48, height:1, background: i < stepIdx ? '#2563EB' : '#E5E7EB', margin:'0 12px' }}/>
              )}
            </div>
          ))}
        </div>

        {/* ══ STEP 1: UPLOAD ══════════════════════════════════════════════════ */}
        {step === 'upload' && (
          <div>
            <div style={{ fontSize:22, fontWeight:700, color:'#111827', marginBottom:6, letterSpacing:'-0.02em' }}>Add your data</div>
            <div style={{ fontSize:13, color:'#6B7280', marginBottom:24 }}>Choose how to bring your data into RevenueLens.</div>

            {/* Dataset type */}
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

            {/* Source tabs */}
            <div style={{ display:'flex', gap:2, marginBottom:0, background:'#F3F4F6', padding:4, borderRadius:10, width:'fit-content' }}>
              {[
                { id:'file',     label:'File' },
                { id:'folder',   label:'Folder' },
                { id:'database', label:'Database' },
                { id:'cloud',    label:'Cloud Storage' },
                { id:'api',      label:'API / Webhook' },
              ].map(tab => (
                <button key={tab.id} onClick={() => { setSourceTab(tab.id); setConnectionStatus('') }} style={{
                  padding:'6px 14px', borderRadius:7, border:'none', cursor:'pointer', fontSize:12, fontWeight:sourceTab===tab.id?600:400,
                  background: sourceTab===tab.id?'#fff':'transparent',
                  color: sourceTab===tab.id?'#111827':'#6B7280',
                  boxShadow: sourceTab===tab.id?'0 1px 3px rgba(0,0,0,0.08)':'none',
                  transition:'all 150ms',
                }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── TAB: Single file ── */}
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

            {/* ── TAB: Folder ── */}
            {sourceTab === 'folder' && (
              <div style={{ marginTop:12 }}>
                <input ref={folderInputRef} type="file" webkitdirectory="" multiple style={{ display:'none' }}
                  onChange={async e => {
                    const allFiles = Array.from(e.target.files || [])
                    const csvXlsx = allFiles.filter(f => f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))
                    setFolderFiles(csvXlsx)
                    if (!csvXlsx.length) return
                    setFolderMerging(true)
                    let mergedRows = []
                    let mergedCols = []
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

            {/* ── TAB: Database ── */}
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
                  <div>
                    <div style={{ ...S.label, marginBottom:4 }}>Host</div>
                    <input style={S.input} placeholder="db.example.com" value={dbConfig.host} onChange={e => setDbConfig(p => ({...p, host:e.target.value}))}/>
                  </div>
                  <div>
                    <div style={{ ...S.label, marginBottom:4 }}>Port</div>
                    <input style={S.input} placeholder="5432" value={dbConfig.port} onChange={e => setDbConfig(p => ({...p, port:e.target.value}))}/>
                  </div>
                  <div>
                    <div style={{ ...S.label, marginBottom:4 }}>Database name</div>
                    <input style={S.input} placeholder="analytics_db" value={dbConfig.db} onChange={e => setDbConfig(p => ({...p, db:e.target.value}))}/>
                  </div>
                  <div>
                    <div style={{ ...S.label, marginBottom:4 }}>Username</div>
                    <input style={S.input} placeholder="readonly_user" value={dbConfig.user} onChange={e => setDbConfig(p => ({...p, user:e.target.value}))}/>
                  </div>
                  <div style={{ gridColumn:'1/-1' }}>
                    <div style={{ ...S.label, marginBottom:4 }}>Password</div>
                    <input style={S.input} type="password" placeholder="••••••••" value={dbConfig.pass} onChange={e => setDbConfig(p => ({...p, pass:e.target.value}))}/>
                  </div>
                  <div style={{ gridColumn:'1/-1' }}>
                    <div style={{ ...S.label, marginBottom:4 }}>SQL Query</div>
                    <textarea style={{ ...S.input, height:80, fontFamily:'monospace', fontSize:12, resize:'vertical' }}
                      placeholder="SELECT customer_name, date, arr FROM subscriptions WHERE date >= '2024-01-01'"
                      value={dbConfig.query} onChange={e => setDbConfig(p => ({...p, query:e.target.value}))}/>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <button onClick={() => { setConnectionTesting(true); setTimeout(() => { setConnectionTesting(false); setConnectionStatus('Coming Soon') }, 800) }}
                    style={{ ...S.btnSecondary, fontSize:12 }}>
                    {connectionTesting ? <><Loader2 size={12} style={{ animation:'spin 1s linear infinite' }}/> Testing…</> : 'Test connection'}
                  </button>
                  {connectionStatus && <span style={{ fontSize:12, color: connectionStatus==='ok'?'#16A34A':'#6B7280', fontWeight:500 }}>{connectionStatus}</span>}
                </div>
              </div>
            )}

            {/* ── TAB: Cloud Storage ── */}
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
                <div style={{ marginBottom:12 }}>
                  <div style={{ ...S.label, marginBottom:4 }}>File URL or path</div>
                  <input style={S.input} placeholder="gs://my-bucket/data/revenue.csv  or  https://drive.google.com/…"
                    value={cloudConfig.url} onChange={e => setCloudConfig(p => ({...p, url:e.target.value}))}/>
                </div>
                <div style={{ marginBottom:16 }}>
                  <div style={{ ...S.label, marginBottom:4 }}>Access token / API key</div>
                  <input style={S.input} type="password" placeholder="••••••••" value={cloudConfig.token} onChange={e => setCloudConfig(p => ({...p, token:e.target.value}))}/>
                </div>
                <div style={{ padding:'10px 14px', background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, fontSize:12, color:'#92400E' }}>
                  Cloud storage connections are coming soon — use file upload in the meantime.
                </div>
              </div>
            )}

            {/* ── TAB: API / Webhook ── */}
            {sourceTab === 'api' && (
              <div style={{ marginTop:12, ...S.card }}>
                <div style={{ display:'grid', gridTemplateColumns:'120px 1fr', gap:12, marginBottom:12 }}>
                  <div>
                    <div style={{ ...S.label, marginBottom:4 }}>Method</div>
                    <select style={{ ...S.input, background:'#fff' }} value={apiConfig.method} onChange={e => setApiConfig(p => ({...p, method:e.target.value}))}>
                      <option>GET</option><option>POST</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ ...S.label, marginBottom:4 }}>Endpoint URL</div>
                    <input style={S.input} placeholder="https://api.example.com/v2/revenue" value={apiConfig.url} onChange={e => setApiConfig(p => ({...p, url:e.target.value}))}/>
                  </div>
                </div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ ...S.label, marginBottom:4 }}>Headers (JSON)</div>
                  <textarea style={{ ...S.input, height:64, fontFamily:'monospace', fontSize:12, resize:'vertical' }}
                    placeholder={'{ "Authorization": "Bearer your-token", "Content-Type": "application/json" }'}
                    value={apiConfig.headers} onChange={e => setApiConfig(p => ({...p, headers:e.target.value}))}/>
                </div>
                <div style={{ marginBottom:16 }}>
                  <div style={{ ...S.label, marginBottom:6 }}>Refresh schedule</div>
                  <div style={{ display:'flex', gap:8 }}>
                    {[{id:'manual',label:'Manual only'},{id:'daily',label:'Daily'},{id:'weekly',label:'Weekly'},{id:'monthly',label:'Monthly'}].map(s => (
                      <button key={s.id} onClick={() => setApiConfig(p => ({...p, schedule:s.id}))} style={{
                        padding:'5px 14px', borderRadius:6, border:`1.5px solid ${apiConfig.schedule===s.id?'#2563EB':'#E5E7EB'}`,
                        background:apiConfig.schedule===s.id?'#EFF6FF':'#fff', cursor:'pointer', fontSize:12, fontWeight:apiConfig.schedule===s.id?600:400,
                        color:apiConfig.schedule===s.id?'#2563EB':'#6B7280',
                      }}>{s.label}</button>
                    ))}
                  </div>
                </div>
                <div style={{ padding:'10px 14px', background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, fontSize:12, color:'#92400E' }}>
                  API connections are coming soon — use file upload in the meantime.
                </div>
              </div>
            )}

            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:24 }}>
              <button onClick={() => setStep('map')} disabled={!file} style={{ ...S.btnPrimary, opacity: file?1:0.4, cursor:file?'pointer':'default' }}>
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
                  <select
                    value={mapping[field.key] || ''}
                    onChange={e => setMapping(m => ({ ...m, [field.key]: e.target.value }))}
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
                setError('')
                setQualityDone(false)
                setAppliedFuzzy(false)
                setStep('quality')
              }} style={S.btnPrimary}>
                Data Quality Checks <ArrowRight size={14}/>
              </button>
            </div>
          </div>
        )}

        {/* ══ STEP 3: DATA QUALITY ════════════════════════════════════════════ */}
        {step === 'quality' && (
          <div>
            <div style={{ fontSize:22, fontWeight:700, color:'#111827', marginBottom:6, letterSpacing:'-0.02em' }}>Data Quality</div>
            <div style={{ fontSize:13, color:'#6B7280', marginBottom:28 }}>Run automated checks and fix issues before analysis.</div>

            {/* Fuzzy customer matching card */}
            <div style={{ ...S.card, marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <Users size={16} color="#2563EB"/>
                    <div style={{ fontSize:14, fontWeight:700, color:'#111827' }}>Customer Name Consolidation</div>
                    {qualityDone && (
                      <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:20,
                        background: fuzzyGroups.length>0?'#FEF3C7':'#F0FDF4',
                        color: fuzzyGroups.length>0?'#92400E':'#166534',
                        border: fuzzyGroups.length>0?'1px solid #FCD34D':'1px solid #BBF7D0',
                      }}>
                        {fuzzyGroups.length > 0 ? `${fuzzyGroups.length} issues found` : 'All clean'}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize:12, color:'#6B7280', lineHeight:1.6 }}>
                    Detects variations of the same customer name — e.g. <em>"Acme Inc"</em>, <em>"ACME"</em>, <em>"Acme Corp"</em> — and consolidates them into a single canonical name. This prevents the same customer appearing as multiple entities in your analytics.
                  </div>
                  {qualityDone && (
                    <div style={{ marginTop:10, display:'flex', gap:20 }}>
                      <div>
                        <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:'#9CA3AF', marginBottom:2 }}>Total Customers</div>
                        <div style={{ fontSize:22, fontWeight:700, color:'#111827' }}>{totalCustomers.toLocaleString()}</div>
                      </div>
                      {fuzzyGroups.length > 0 && (
                        <div>
                          <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:'#9CA3AF', marginBottom:2 }}>Need Consolidation</div>
                          <div style={{ fontSize:22, fontWeight:700, color:'#D97706' }}>{fuzzyGroups.reduce((s,g)=>s+g.names.length,0)}</div>
                        </div>
                      )}
                      {appliedFuzzy && (
                        <div>
                          <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:'#9CA3AF', marginBottom:2 }}>After Consolidation</div>
                          <div style={{ fontSize:22, fontWeight:700, color:'#16A34A' }}>{totalCustomers.toLocaleString()}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ flexShrink:0 }}>
                  {!qualityDone
                    ? <button onClick={runQualityChecks} disabled={qualityRunning} style={{ ...S.btnPrimary, opacity:qualityRunning?0.7:1 }}>
                        {qualityRunning ? <><Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/> Running…</> : <>Run Check</>}
                      </button>
                    : !appliedFuzzy && fuzzyGroups.length > 0
                    ? <button onClick={applyFuzzyMapping} style={{ ...S.btnPrimary, background:'#059669' }}>
                        <CheckCircle size={13}/> Apply Fixes
                      </button>
                    : <div style={{ display:'flex', alignItems:'center', gap:6, color:'#16A34A', fontSize:13, fontWeight:600 }}>
                        <CheckCircle size={14}/> {appliedFuzzy ? 'Applied' : 'No issues'}
                      </div>
                  }
                </div>
              </div>

              {/* Fuzzy groups detail */}
              {qualityDone && fuzzyGroups.length > 0 && !appliedFuzzy && (
                <div style={{ marginTop:16, borderTop:'1px solid #F3F4F6', paddingTop:16 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'#374151', marginBottom:10 }}>
                    Review suggested consolidations — edit canonical names if needed:
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:10, maxHeight:280, overflowY:'auto' }}>
                    {fuzzyGroups.map((grp, gi) => (
                      <div key={gi} style={{ background:'#FFFBEB', border:'1px solid #FCD34D', borderRadius:8, padding:'10px 14px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                          <AlertTriangle size={11} color="#D97706"/>
                          <span style={{ fontSize:11, fontWeight:600, color:'#92400E' }}>These {grp.names.length} names appear to be the same customer</span>
                        </div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>
                          {grp.names.map(n => (
                            <span key={n} style={{ ...S.chip, background:'#FEF3C7', border:'1px solid #FCD34D', color:'#92400E' }}>{n}</span>
                          ))}
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ fontSize:11, color:'#6B7280', flexShrink:0 }}>Consolidate as:</span>
                          <input
                            value={resolvedNames[grp.names[0]] || grp.canonical}
                            onChange={e => {
                              const newName = e.target.value
                              setResolvedNames(prev => {
                                const next = {...prev}
                                grp.names.forEach(n => { next[n] = newName })
                                return next
                              })
                              setFuzzyGroups(prev => prev.map((g,i) => i===gi?{...g,canonical:newName}:g))
                            }}
                            style={{ ...S.input, fontSize:12, padding:'5px 8px', flex:1 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* More checks — coming soon */}
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
              <button onClick={() => setStep('review')} style={S.btnPrimary}>
                Review & Confirm <ArrowRight size={14}/>
              </button>
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

            {/* Quality summary */}
            <div style={{ ...S.card, marginBottom:24, background:'#F0FDF4', border:'1px solid #BBF7D0' }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#9CA3AF', marginBottom:10 }}>Data Quality</div>
              <div style={{ display:'flex', gap:24 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  {qualityDone ? <CheckCircle size={14} color="#16A34A"/> : <AlertCircle size={14} color="#D97706"/>}
                  <span style={{ fontSize:13, color:'#374151' }}>
                    {qualityDone
                      ? appliedFuzzy
                        ? `Customer names consolidated · ${totalCustomers} unique customers`
                        : fuzzyGroups.length === 0
                        ? `No issues found · ${totalCustomers} unique customers`
                        : `${fuzzyGroups.length} consolidation suggestions skipped`
                      : 'Quality checks not run'
                    }
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setStep('quality')} style={S.btnSecondary}>← Back</button>
              <button onClick={() => {
                    if (!file || !rawRows.length) return
                    const csvText = dataCubeStore.buildCsv(columns, rawRows)
                    const blob = new Blob([csvText], { type: 'text/csv' })
                    const url  = URL.createObjectURL(blob)
                    const a    = document.createElement('a')
                    a.href     = url
                    a.download = file.name.replace('.csv','').replace('.xlsx','').replace('.xls','') + '_cleaned.csv'
                    a.click()
                    URL.revokeObjectURL(url)
                  }} style={{ ...S.btnSecondary, padding:'11px 24px', fontSize:14, marginRight:8 }}>
                  Download data cube
                </button>
                <button onClick={launchAnalytics} style={{ ...S.btnPrimary, padding:'11px 24px', fontSize:14 }}>
                <CheckCircle size={14}/> Launch Analytics Engine
              </button>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  )
}
