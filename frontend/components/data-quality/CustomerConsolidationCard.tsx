// @ts-nocheck
// frontend/components/data-quality/CustomerConsolidationCard.tsx
// Full fuzzy matching engine integrated into RevenueLens Data Quality step.
// Self-contained — no external deps beyond React.

import { useState, useCallback, useRef } from 'react'
import { Users, CheckCircle, AlertCircle, Loader2, Edit2, X, Check, ChevronDown, ChevronUp, Search } from 'lucide-react'

// ─── Engine Math (Six-Layer Ensemble) ────────────────────────────────────────
function cleanEntity(str: string): string {
  let s = String(str).toUpperCase().trim()
  if (!s) return ''
  s = s.replace(/\*\*\s*SEE\s+([^*]+)\s*\*\*/g, '$1')
  s = s.replace(/\bA\/R\b/g,' ').replace(/\bPO\s*[A-Z0-9\-]+\b/g,' ').replace(/\*/g,' ')
       .replace(/:\s*[A-Z0-9]*\d{5,}[A-Z0-9\-_]*/g,' ').replace(/\.COM|\.NET|\.ORG/g,' ')
  s = s.replace(/\([^)]+\)/g,' ').replace(/&/g,' AND ').replace(/[^\w\s\-]/g,' ')
  s = s.replace(/\bUNIV\b/g,'UNIVERSITY').replace(/\bINTL\b/g,'INTERNATIONAL')
       .replace(/\bTECH\b/g,'TECHNOLOGIES').replace(/\bMFG\b/g,'MANUFACTURING')
       .replace(/\bGRP\b/g,'GROUP').replace(/\bCTR\b/g,'CENTER')
  const busSuffixes = /\b(INC|LLC|LLP|LTD|LIMITED|CORP|CORPORATION|CO|COMPANY|PA|PLLC|PLC|GMBH|AG|SA|BV|AB|HOLDINGS|GROUP|INTERNATIONAL|ENTERPRISES|SERVICES|LP|LC)\b/g
  s = s.replace(busSuffixes,' ')
  return s.replace(/\s+/g,' ').trim()
}

function standardLev(a: string, b: string): number {
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

function tokenSetRatio(s1: string, s2: string): number {
  const t1 = s1.split(' ').filter(x=>x), t2 = s2.split(' ').filter(x=>x)
  const intersect = t1.filter(x => t2.includes(x))
  const diff1 = t1.filter(x => !t2.includes(x))
  const diff2 = t2.filter(x => !t1.includes(x))
  return Math.max(
    standardLev(intersect.join(' '), intersect.concat(diff1).join(' ')),
    standardLev(intersect.join(' '), intersect.concat(diff2).join(' ')),
    standardLev(intersect.concat(diff1).join(' '), intersect.concat(diff2).join(' '))
  )
}

function soundex(s: string): string {
  if (!s) return ''
  const codes: Record<string,any> = {A:'',E:'',I:'',O:'',U:'',B:1,F:1,P:1,V:1,C:2,G:2,J:2,K:2,Q:2,S:2,X:2,Z:2,D:3,T:3,L:4,M:5,N:5,R:6}
  const a = s.split('')
  const f = a.shift()!
  const r = f + a.map(v=>codes[v]).filter((v,i,arr)=>(i===0?v!==codes[f]:v!==arr[i-1])).filter(v=>v!=='').join('')
  return (r+'000').slice(0,4)
}

function multiSoundex(str: string): string { return str.split(' ').map(soundex).join(' ') }

function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1
  const len1 = s1.length, len2 = s2.length
  if (!len1 || !len2) return 0
  const matchWindow = Math.max(0, Math.floor(Math.max(len1,len2)/2)-1)
  const match1 = new Array(len1).fill(false), match2 = new Array(len2).fill(false)
  let m = 0
  for (let i = 0; i < len1; i++) {
    for (let j = Math.max(0,i-matchWindow); j < Math.min(i+matchWindow+1,len2); j++) {
      if (!match2[j] && s1[i]===s2[j]) { match1[i]=true; match2[j]=true; m++; break }
    }
  }
  if (!m) return 0
  let t=0, k=0
  for (let i=0;i<len1;i++) { if(match1[i]){while(!match2[k])k++;if(s1[i]!==s2[k])t++;k++} }
  const jaro = (m/len1+m/len2+(m-t/2)/m)/3
  let prefix=0
  for (let i=0;i<Math.min(4,Math.min(len1,len2));i++){if(s1[i]===s2[i])prefix++;else break}
  return jaro+prefix*0.1*(1-jaro)
}

function evalScore(s1clean: string, s2clean: string): {val: number, meth: string} {
  if (!s1clean || !s2clean) return {val:0, meth:'none'}
  if (s1clean === s2clean) return {val:100, meth:'exact'}
  const tsr = tokenSetRatio(s1clean, s2clean)
  const phon = standardLev(multiSoundex(s1clean), multiSoundex(s2clean))
  const jw = jaroWinkler(s1clean, s2clean)
  const lev = standardLev(s1clean, s2clean)
  const composite = tsr*0.35 + phon*0.10 + jw*0.30 + lev*0.25
  const val = Math.round(composite*100)
  const meth = tsr>0.95?'substring':jw>0.90?'jaro-winkler':lev>0.85?'levenshtein':'fuzzy'
  return {val, meth}
}

function getClean(raw: string): string {
  return cleanEntity(raw).replace(/[:\-]/g,' ').replace(/\s+/g,' ').trim()
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface FuzzyGroup {
  canonical: string          // suggested canonical name
  members: string[]          // all raw name variants
  confidence: number         // 0–100
  method: string             // how it was matched
  status: 'approved'|'rejected'|'pending'
  editedCanonical?: string   // if user overrides
}

interface Props {
  rawRows: any[]             // the uploaded CSV rows
  customerCol: string        // name of the customer column
  onApply: (mapping: Map<string,string>) => void  // called with {rawName → canonical}
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CustomerConsolidationCard({ rawRows, customerCol, onApply }: Props) {
  const [state, setState] = useState<'idle'|'running'|'done'>('idle')
  const [progress, setProgress] = useState(0)
  const [progressMsg, setProgressMsg] = useState('')
  const [groups, setGroups] = useState<FuzzyGroup[]>([])
  const [expandedIdx, setExpandedIdx] = useState<number|null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all'|'pending'|'approved'|'rejected'>('all')
  const [editingIdx, setEditingIdx] = useState<number|null>(null)
  const [editValue, setEditValue] = useState('')
  const [applied, setApplied] = useState(false)
  const runRef = useRef(0)

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

  async function runCheck() {
    if (!rawRows?.length || !customerCol) return
    setState('running')
    setProgress(0)
    setGroups([])
    setApplied(false)
    const myRun = ++runRef.current

    await sleep(50)

    // Extract unique customer names
    setProgressMsg('Extracting customer names…')
    setProgress(10)
    await sleep(20)

    const nameSet = new Map<string, number>() // raw → count
    for (const row of rawRows) {
      const raw = String(row[customerCol] ?? '').trim()
      if (raw) nameSet.set(raw, (nameSet.get(raw) || 0) + 1)
    }

    const names = Array.from(nameSet.keys())
    if (runRef.current !== myRun) return

    setProgressMsg(`Cleaning ${names.length.toLocaleString()} names…`)
    setProgress(20)
    await sleep(20)

    // Build cleaned objects
    const objs = names.map(raw => ({ raw, clean: getClean(raw), count: nameSet.get(raw) || 1 }))
      .filter(o => o.clean.length > 0)
      .sort((a,b) => a.clean.length - b.clean.length)

    if (runRef.current !== myRun) return

    setProgressMsg('Running six-layer similarity engine…')
    setProgress(30)
    await sleep(30)

    // Cluster using greedy approach
    const clusters: { root: typeof objs[0], members: typeof objs, confidence: number, method: string }[] = []

    for (let i = 0; i < objs.length; i++) {
      if (runRef.current !== myRun) return
      const u = objs[i]
      let bestCluster: typeof clusters[0] | null = null
      let bestScore = 0
      let bestMethod = 'none'

      for (const c of clusters) {
        const score = evalScore(u.clean, c.root.clean)
        if (score.val > bestScore) {
          bestScore = score.val
          bestCluster = c
          bestMethod = score.meth
          if (bestScore === 100) break
        }
      }

      const thresh = u.raw.length < 8 ? 101 : u.raw.length <= 15 ? 80 : 75

      if (bestCluster && bestScore >= thresh) {
        bestCluster.members.push(u)
        if (bestScore < bestCluster.confidence) {
          bestCluster.confidence = bestScore
          bestCluster.method = bestMethod
        }
      } else {
        clusters.push({ root: u, members: [u], confidence: 100, method: 'exact' })
      }

      if (i % 100 === 0) {
        setProgress(30 + Math.floor(i / objs.length * 55))
        setProgressMsg(`Grouping ${i.toLocaleString()} / ${objs.length.toLocaleString()}…`)
        await sleep(0)
      }
    }

    if (runRef.current !== myRun) return

    setProgress(90)
    setProgressMsg('Building review groups…')
    await sleep(20)

    // Only show groups with 2+ variants (actual duplicates)
    const fuzzyGroups: FuzzyGroup[] = clusters
      .filter(c => c.members.length > 1)
      .sort((a,b) => a.confidence - b.confidence) // lowest confidence first (needs most review)
      .map(c => {
        // Pick canonical: longest name, most tokens (usually most complete)
        const canonical = c.members.reduce((best, m) =>
          m.clean.split(' ').length > best.clean.split(' ').length ? m : best
        ).raw
        return {
          canonical,
          members: c.members.map(m => m.raw),
          confidence: c.confidence,
          method: c.method,
          status: c.confidence >= 90 ? 'approved' : 'pending',
        }
      })

    if (runRef.current !== myRun) return

    setProgress(100)
    setProgressMsg('Done')
    setGroups(fuzzyGroups)
    setState('done')
  }

  function approveAll() {
    setGroups(g => g.map(gr => ({...gr, status: 'approved'})))
  }

  function rejectAll() {
    setGroups(g => g.map(g => ({...g, status: 'rejected'})))
  }

  function toggleStatus(idx: number) {
    setGroups(g => g.map((gr,i) => i!==idx?gr:{...gr, status: gr.status==='approved'?'rejected':gr.status==='rejected'?'pending':'approved'}))
  }

  function startEdit(idx: number) {
    setEditingIdx(idx)
    setEditValue(groups[idx].editedCanonical || groups[idx].canonical)
  }

  function saveEdit(idx: number) {
    setGroups(g => g.map((gr,i) => i!==idx?gr:{...gr, editedCanonical: editValue.trim()||gr.canonical}))
    setEditingIdx(null)
  }

  function applyMappings() {
    const mapping = new Map<string,string>()
    for (const gr of groups) {
      if (gr.status === 'approved') {
        const target = gr.editedCanonical || gr.canonical
        for (const m of gr.members) {
          if (m !== target) mapping.set(m, target)
        }
      }
    }
    onApply(mapping)
    setApplied(true)
  }

  // Filter groups
  const filtered = groups.filter(gr => {
    if (filterStatus !== 'all' && gr.status !== filterStatus) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return gr.canonical.toLowerCase().includes(q) ||
             gr.members.some(m => m.toLowerCase().includes(q))
    }
    return true
  })

  const stats = {
    total: groups.length,
    approved: groups.filter(g=>g.status==='approved').length,
    pending: groups.filter(g=>g.status==='pending').length,
    rejected: groups.filter(g=>g.status==='rejected').length,
    entities: groups.reduce((s,g)=>s+g.members.length,0),
  }

  const confColor = (c: number) => c>=90?'#10B981':c>=75?'#F59E0B':'#EF4444'
  const confBg    = (c: number) => c>=90?'#ECFDF5':c>=75?'#FFFBEB':'#FEF2F2'
  const statusColor = {approved:'#10B981',pending:'#F59E0B',rejected:'#EF4444'}
  const statusBg    = {approved:'#ECFDF5',pending:'#FFFBEB',rejected:'#FEF2F2'}

  return (
    <div style={{border:'1px solid #E5E7EB',borderRadius:12,overflow:'hidden',background:'#FFFFFF'}}>

      {/* Card header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',padding:'20px 24px',borderBottom: state==='idle'?'none':'1px solid #F3F4F6'}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
          <div style={{width:36,height:36,borderRadius:10,background:'#EEF2FF',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <Users size={16} color="#4F46E5"/>
          </div>
          <div>
            <div style={{fontSize:14,fontWeight:600,color:'#111827',marginBottom:3}}>Customer Name Consolidation</div>
            <div style={{fontSize:12,color:'#6B7280',lineHeight:1.5}}>
              Detects variations of the same customer — e.g. <em>"Acme Inc"</em>, <em>"ACME"</em>, <em>"Acme Corp"</em> — and consolidates them into a single canonical name.
            </div>
          </div>
        </div>

        {state === 'idle' && (
          <button onClick={runCheck} disabled={!rawRows?.length || !customerCol}
            style={{flexShrink:0,padding:'8px 18px',borderRadius:8,border:'none',background:'#4F46E5',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',opacity:(!rawRows?.length||!customerCol)?0.5:1}}>
            Run Check
          </button>
        )}

        {state === 'running' && (
          <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#6B7280'}}>
            <Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> Analyzing…
          </div>
        )}

        {state === 'done' && !applied && (
          <div style={{display:'flex',gap:8,flexShrink:0}}>
            <button onClick={runCheck} style={{padding:'7px 14px',borderRadius:8,border:'1px solid #E5E7EB',background:'transparent',color:'#6B7280',fontSize:12,fontWeight:600,cursor:'pointer'}}>
              Re-run
            </button>
            <button onClick={applyMappings}
              style={{padding:'7px 16px',borderRadius:8,border:'none',background:'#10B981',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer'}}>
              Approve & Apply
            </button>
          </div>
        )}

        {applied && (
          <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#10B981',fontWeight:600}}>
            <CheckCircle size={14}/> Applied
          </div>
        )}
      </div>

      {/* Progress bar */}
      {state === 'running' && (
        <div style={{padding:'16px 24px',background:'#F9FAFB',borderBottom:'1px solid #F3F4F6'}}>
          <div style={{height:4,background:'#E5E7EB',borderRadius:2,overflow:'hidden',marginBottom:8}}>
            <div style={{height:'100%',background:'#4F46E5',borderRadius:2,width:`${progress}%`,transition:'width 0.3s ease'}}/>
          </div>
          <div style={{fontSize:11,color:'#9CA3AF'}}>{progressMsg}</div>
        </div>
      )}

      {/* Results */}
      {state === 'done' && (
        <>
          {/* Stats strip */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',borderBottom:'1px solid #F3F4F6'}}>
            {[
              {label:'Groups Found',    value: stats.total,    color:'#4F46E5'},
              {label:'Approved',        value: stats.approved, color:'#10B981'},
              {label:'Needs Review',    value: stats.pending,  color:'#F59E0B'},
              {label:'Entities Merged', value: stats.entities, color:'#6B7280'},
            ].map(s => (
              <div key={s.label} style={{padding:'14px 20px',borderRight:'1px solid #F3F4F6'}}>
                <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'#9CA3AF',marginBottom:4}}>{s.label}</div>
                <div style={{fontSize:22,fontWeight:700,color:s.color,fontVariantNumeric:'tabular-nums'}}>{s.value}</div>
              </div>
            ))}
          </div>

          {groups.length === 0 ? (
            <div style={{padding:'32px',textAlign:'center',color:'#6B7280',fontSize:13}}>
              <CheckCircle size={24} color="#10B981" style={{margin:'0 auto 8px',display:'block'}}/>
              No duplicate customer names detected. Your data looks clean!
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 20px',borderBottom:'1px solid #F3F4F6',background:'#F9FAFB',flexWrap:'wrap'}}>
                {/* Search */}
                <div style={{position:'relative',flex:1,minWidth:180}}>
                  <Search size={12} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#9CA3AF'}}/>
                  <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
                    placeholder="Search customer names…"
                    style={{width:'100%',padding:'7px 10px 7px 30px',borderRadius:7,border:'1px solid #E5E7EB',fontSize:12,outline:'none',background:'#fff'}}/>
                </div>
                {/* Status filter */}
                <div style={{display:'flex',gap:4}}>
                  {(['all','pending','approved','rejected'] as const).map(s => (
                    <button key={s} onClick={()=>setFilterStatus(s)}
                      style={{padding:'5px 12px',borderRadius:20,fontSize:11,fontWeight:600,border:'1px solid',cursor:'pointer',
                        borderColor:filterStatus===s?'#4F46E5':'#E5E7EB',
                        background:filterStatus===s?'#4F46E5':'transparent',
                        color:filterStatus===s?'#fff':'#6B7280',
                        textTransform:'capitalize'}}>
                      {s}
                    </button>
                  ))}
                </div>
                {/* Bulk actions */}
                <div style={{display:'flex',gap:6,marginLeft:'auto'}}>
                  <button onClick={approveAll} style={{padding:'5px 12px',borderRadius:7,border:'1px solid #D1FAE5',background:'#ECFDF5',color:'#10B981',fontSize:11,fontWeight:600,cursor:'pointer'}}>Approve All</button>
                  <button onClick={rejectAll}  style={{padding:'5px 12px',borderRadius:7,border:'1px solid #FECACA',background:'#FEF2F2',color:'#EF4444',fontSize:11,fontWeight:600,cursor:'pointer'}}>Reject All</button>
                </div>
              </div>

              {/* Group list */}
              <div style={{maxHeight:480,overflowY:'auto'}}>
                {filtered.map((gr, idx) => {
                  const realIdx = groups.indexOf(gr)
                  const isExpanded = expandedIdx === realIdx
                  const isEditing  = editingIdx  === realIdx
                  const canonical  = gr.editedCanonical || gr.canonical
                  return (
                    <div key={realIdx} style={{borderBottom:'1px solid #F3F4F6'}}>
                      {/* Row */}
                      <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 20px',cursor:'pointer',background:isExpanded?'#FAFAFA':'#fff'}}
                        onClick={()=>setExpandedIdx(isExpanded?null:realIdx)}>

                        {/* Status toggle */}
                        <button onClick={e=>{e.stopPropagation();toggleStatus(realIdx)}}
                          style={{flexShrink:0,padding:'3px 9px',borderRadius:20,border:'none',cursor:'pointer',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',
                            background:statusBg[gr.status],color:statusColor[gr.status]}}>
                          {gr.status}
                        </button>

                        {/* Canonical name */}
                        <div style={{flex:1,minWidth:0}}>
                          {isEditing ? (
                            <div style={{display:'flex',gap:6}} onClick={e=>e.stopPropagation()}>
                              <input value={editValue} onChange={e=>setEditValue(e.target.value)}
                                autoFocus onKeyDown={e=>{if(e.key==='Enter')saveEdit(realIdx);if(e.key==='Escape')setEditingIdx(null)}}
                                style={{flex:1,padding:'4px 8px',borderRadius:6,border:'1px solid #4F46E5',fontSize:13,fontWeight:500,outline:'none'}}/>
                              <button onClick={()=>saveEdit(realIdx)} style={{padding:'4px 8px',borderRadius:6,background:'#10B981',border:'none',color:'#fff',cursor:'pointer'}}><Check size={12}/></button>
                              <button onClick={()=>setEditingIdx(null)} style={{padding:'4px 8px',borderRadius:6,background:'#F3F4F6',border:'none',color:'#6B7280',cursor:'pointer'}}><X size={12}/></button>
                            </div>
                          ) : (
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <span style={{fontSize:13,fontWeight:600,color:'#111827',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{canonical}</span>
                              {gr.editedCanonical && <span style={{fontSize:10,color:'#4F46E5',background:'#EEF2FF',padding:'1px 6px',borderRadius:4,flexShrink:0}}>edited</span>}
                              <button onClick={e=>{e.stopPropagation();startEdit(realIdx)}}
                                style={{padding:'2px 6px',borderRadius:5,border:'1px solid #E5E7EB',background:'transparent',color:'#9CA3AF',cursor:'pointer',flexShrink:0}}>
                                <Edit2 size={10}/>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Variants count */}
                        <span style={{fontSize:11,color:'#9CA3AF',flexShrink:0}}>{gr.members.length} variants</span>

                        {/* Confidence */}
                        <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                          <div style={{width:48,height:5,background:'#E5E7EB',borderRadius:3,overflow:'hidden'}}>
                            <div style={{height:'100%',background:confColor(gr.confidence),width:`${gr.confidence}%`,borderRadius:3}}/>
                          </div>
                          <span style={{fontSize:11,fontWeight:700,color:confColor(gr.confidence),minWidth:32}}>{gr.confidence}%</span>
                        </div>

                        {/* Method badge */}
                        <span style={{fontSize:10,fontWeight:600,padding:'2px 7px',borderRadius:4,background:'#F3F4F6',color:'#6B7280',flexShrink:0,textTransform:'capitalize'}}>{gr.method}</span>

                        {/* Expand */}
                        {isExpanded ? <ChevronUp size={14} color="#9CA3AF"/> : <ChevronDown size={14} color="#9CA3AF"/>}
                      </div>

                      {/* Expanded: show all variants */}
                      {isExpanded && (
                        <div style={{padding:'0 20px 14px 52px',background:'#FAFAFA'}}>
                          <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'#9CA3AF',marginBottom:8}}>
                            All variants → will be mapped to <strong style={{color:'#4F46E5'}}>{canonical}</strong>
                          </div>
                          <div style={{display:'flex',flexDirection:'column',gap:4}}>
                            {gr.members.map(m => (
                              <div key={m} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',borderRadius:6,background:m===(gr.editedCanonical||gr.canonical)?'#EEF2FF':'#fff',border:'1px solid',borderColor:m===(gr.editedCanonical||gr.canonical)?'#C7D2FE':'#F3F4F6'}}>
                                {m===(gr.editedCanonical||gr.canonical)
                                  ? <CheckCircle size={11} color="#4F46E5" style={{flexShrink:0}}/>
                                  : <div style={{width:11,height:11,borderRadius:'50%',border:'1px solid #D1D5DB',flexShrink:0}}/>
                                }
                                <span style={{fontSize:12,color:'#374151'}}>{m}</span>
                                {m===(gr.editedCanonical||gr.canonical) && <span style={{fontSize:10,color:'#4F46E5',marginLeft:'auto',fontWeight:600}}>canonical</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                {filtered.length === 0 && (
                  <div style={{padding:'32px',textAlign:'center',color:'#9CA3AF',fontSize:13}}>No groups match your filter.</div>
                )}
              </div>

              {/* Footer */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 20px',borderTop:'1px solid #F3F4F6',background:'#F9FAFB'}}>
                <div style={{fontSize:12,color:'#6B7280'}}>
                  {stats.approved} groups approved · {stats.pending} pending · {stats.rejected} rejected
                </div>
                {!applied && (
                  <button onClick={applyMappings}
                    style={{padding:'8px 20px',borderRadius:8,border:'none',background:'#4F46E5',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
                    <Check size={13}/> Approve & Apply ({stats.approved} groups)
                  </button>
                )}
                {applied && (
                  <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#10B981',fontWeight:600}}>
                    <CheckCircle size={13}/> Mappings applied to dataset
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
