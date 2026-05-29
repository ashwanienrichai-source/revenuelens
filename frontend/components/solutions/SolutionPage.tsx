// @ts-nocheck
// frontend/components/solutions/SolutionPage.tsx
// Shared template for all 7 solution pages — receives a Solution config and renders everything

import { useRouter } from 'next/router'
import Head from 'next/head'

const FONT  = "'DM Sans','Helvetica Neue',Arial,sans-serif"
const SERIF = "'DM Serif Display',Georgia,serif"

const C = {
  bg:'#F8F7FC', surface:'#FFFFFF', purple:'#6B31D4', purple2:'#5A28B4',
  purpleXl:'#F0EBFF', purpleMd:'#E0D5FF', text1:'#0F0A1E', text2:'#4C4668',
  text3:'#9990B0', border:'#E8E4F2', borderMd:'#D0C9E8', green:'#12B76A',
  greenBg:'#ECFDF3', red:'#F04438', amber:'#F79009', blue:'#2E90FA',
  dark:'#0F0A1E', dark2:'#1A1530',
}

function fadeIn(delay = 0) {
  return { animation: `fadeUp 0.6s ease ${delay}s both` }
}


function useIsMobile() {
  const [m, setM] = useState(false)
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 768)
    fn()
    window.addEventListener('resize', fn, { passive:true })
    return () => window.removeEventListener('resize', fn)
  }, [])
  return m
}

export default function SolutionPage({ solution: s }) {
  const router = useRouter()
  const isMobile = useIsMobile()

  if (!s) return null

  const A = s.accent
  const AL = s.accentLight

  return (
    <>
      <Head>
        <title>{s.label} Intelligence — RevenueLens</title>
        <meta name="description" content={s.heroSub}/>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet"/>
        <style>{`
          @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:none; } }
          * { box-sizing:border-box; margin:0; padding:0; }
        `}</style>
      </Head>

      <div style={{ background:C.bg, fontFamily:FONT, color:C.text1, overflowX:'hidden' }}>

        {/* ── NAV ── */}
        <header style={{ position:'fixed',top:0,left:0,right:0,zIndex:1000,background:'rgba(248,247,252,0.94)',backdropFilter:'blur(16px)',borderBottom:`1px solid ${C.border}` }}>
          <div style={{ maxWidth:1200,margin:'0 auto',padding:'0 20px',height:64,display:'flex',alignItems:'center',gap:40 }}>
            <a href="/" style={{ display:'flex',alignItems:'center',gap:10,textDecoration:'none' }}>
              <div style={{ width:32,height:32,borderRadius:10,background:C.purple,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 8px rgba(107,49,212,0.4)' }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 13L8 3L14 13H2Z" fill="white" fillOpacity=".95"/><path d="M5.5 13L8 8.5L10.5 13H5.5Z" fill="white" fillOpacity=".5"/></svg>
              </div>
              <span style={{ fontFamily:FONT,fontSize:16,fontWeight:700,color:C.text1,letterSpacing:'-.02em' }}>RevenueLens</span>
            </a>
            <nav style={{ display:'flex',gap:24,flex:1 }}>
              <a href="/#solutions" style={{ fontFamily:FONT,fontSize:13,fontWeight:500,color:C.text2,textDecoration:'none' }}
                onMouseEnter={e=>e.target.style.color=C.purple} onMouseLeave={e=>e.target.style.color=C.text2}>Solutions</a>
              <a href="/#pricing" style={{ fontFamily:FONT,fontSize:13,fontWeight:500,color:C.text2,textDecoration:'none' }}
                onMouseEnter={e=>e.target.style.color=C.purple} onMouseLeave={e=>e.target.style.color=C.text2}>Pricing</a>
              <a href="/consulting" style={{ fontFamily:FONT,fontSize:13,fontWeight:500,color:C.text2,textDecoration:'none' }}
                onMouseEnter={e=>e.target.style.color=C.purple} onMouseLeave={e=>e.target.style.color=C.text2}>Consulting</a>
            </nav>
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={()=>router.push('/auth/login')} style={{ background:'none',border:`1px solid ${C.border}`,borderRadius:9,padding:'8px 16px',fontFamily:FONT,fontSize:13,fontWeight:500,color:C.text2,cursor:'pointer' }}>Sign in</button>
              <button onClick={()=>router.push('/auth/login')} style={{ background:C.purple,color:'#fff',border:'none',borderRadius:9,padding:'9px 20px',fontFamily:FONT,fontSize:13,fontWeight:600,cursor:'pointer',boxShadow:'0 1px 2px rgba(107,49,212,0.3)' }}>Get started free</button>
            </div>
          </div>
        </header>

        <main style={{ paddingTop:64 }}>

          {/* ══ 1. HERO ══════════════════════════════════════════════════════ */}
          <section style={{ background:C.dark,padding:isMobile?'80px 20px 60px':'96px 32px 88px',position:'relative',overflow:'hidden',textAlign:'center' }}>
            <div aria-hidden style={{ position:'absolute',top:-150,left:'50%',transform:'translateX(-50%)',width:800,height:500,background:`radial-gradient(ellipse,${A}40 0%,transparent 70%)`,pointerEvents:'none' }}/>
            <div aria-hidden style={{ position:'absolute',inset:0,backgroundImage:`linear-gradient(${A}08 1px,transparent 1px),linear-gradient(90deg,${A}08 1px,transparent 1px)`,backgroundSize:'60px 60px',pointerEvents:'none' }}/>
            <div style={{ maxWidth:760,margin:'0 auto',position:'relative',width:'100%' }}>
              {/* Breadcrumb */}
              <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:28 }}>
                <a href="/#solutions" style={{ fontFamily:FONT,fontSize:12,color:'rgba(255,255,255,0.35)',textDecoration:'none' }}>Solutions</a>
                <span style={{ color:'rgba(255,255,255,0.2)',fontSize:12 }}>›</span>
                <span style={{ fontFamily:FONT,fontSize:12,fontWeight:600,color:A }}>{s.label}</span>
              </div>
              {/* Icon + label */}
              <div style={{ display:'inline-flex',alignItems:'center',gap:10,background:`${A}20`,border:`1px solid ${A}40`,borderRadius:99,padding:'6px 18px 6px 10px',marginBottom:28 }}>
                <span style={{ fontSize:20 }}>{s.icon}</span>
                <span style={{ fontFamily:FONT,fontSize:13,fontWeight:700,color:A,letterSpacing:'.04em',textTransform:'uppercase' }}>{s.label} Intelligence</span>
              </div>
              <p style={{ fontFamily:FONT,fontSize:15,fontWeight:500,color:A,margin:'0 0 14px',letterSpacing:'.02em' }}>{s.tagline}</p>
              <h1 style={{ fontFamily:SERIF,fontSize:'clamp(36px,5vw,58px)',fontWeight:400,color:'#fff',lineHeight:1.1,letterSpacing:'-.025em',margin:'0 0 20px' }}>{s.heroHeadline}</h1>
              <p style={{ fontFamily:FONT,fontSize:17,color:'rgba(255,255,255,0.55)',lineHeight:1.7,margin:'0 0 40px',maxWidth:580,marginLeft:'auto',marginRight:'auto' }}>{s.heroSub}</p>
              <div style={{ display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap' }}>
                <button onClick={()=>router.push('/auth/login')}
                  style={{ background:A,color:'#fff',border:'none',borderRadius:10,padding:'13px 28px',fontFamily:FONT,fontSize:15,fontWeight:600,cursor:'pointer',boxShadow:`0 4px 20px ${A}55` }}>
                  Start for free →
                </button>
                <button onClick={()=>router.push('/consulting')}
                  style={{ background:'rgba(255,255,255,0.08)',color:'#fff',border:'1px solid rgba(255,255,255,0.18)',borderRadius:10,padding:'13px 24px',fontFamily:FONT,fontSize:15,fontWeight:500,cursor:'pointer' }}>
                  Request a demo
                </button>
              </div>
            </div>
          </section>

          {/* ══ 2. METRICS PREVIEW ═══════════════════════════════════════════ */}
          <section style={{ background:C.dark2,padding:'40px 32px',borderBottom:`1px solid #2D2650` }}>
            <div style={{ maxWidth:1000,margin:'0 auto',display:'flex',gap:0,justifyContent:'center',flexWrap:'wrap' }}>
              {s.previewMetrics.map((m,i) => (
                <div key={i} style={{ textAlign:'center',padding:isMobile?'12px 16px':'0 24px',minWidth:isMobile?'45%':'auto',borderRight:isMobile?'none':i<s.previewMetrics.length-1?'1px solid #2D2650':'none' }}>
                  <div style={{ fontFamily:'DM Mono,monospace',fontSize:22,fontWeight:700,color:m.up===false?C.red:m.up===true?C.green:'#C4A8FF',letterSpacing:'-.02em' }}>{m.value}</div>
                  {m.delta && <div style={{ fontFamily:FONT,fontSize:11,fontWeight:600,color:m.up===false?`${C.red}99`:m.up===true?`${C.green}99`:A,marginTop:2 }}>{m.delta}</div>}
                  <div style={{ fontFamily:FONT,fontSize:10,color:'rgba(255,255,255,0.35)',marginTop:4,fontWeight:500,textTransform:'uppercase',letterSpacing:'.06em' }}>{m.label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ══ 3. CHALLENGES ════════════════════════════════════════════════ */}
          <section style={{ background:C.surface,padding:isMobile?'56px 16px':'88px 32px',borderBottom:`1px solid ${C.border}` }}>
            <div style={{ maxWidth:1000,margin:'0 auto',display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:isMobile?32:64,alignItems:'center' }}>
              <div>
                <p style={{ fontFamily:FONT,fontSize:12,fontWeight:700,color:A,letterSpacing:'.1em',textTransform:'uppercase',margin:'0 0 14px' }}>Challenges We Solve</p>
                <h2 style={{ fontFamily:SERIF,fontSize:36,fontWeight:400,color:C.text1,letterSpacing:'-.02em',margin:'0 0 20px',lineHeight:1.2 }}>The problems finance<br/>teams face every week.</h2>
                <p style={{ fontFamily:FONT,fontSize:14,color:C.text2,lineHeight:1.7,margin:0 }}>These are the questions that slow teams down — the ones that take days to answer and still leave executives uncertain.</p>
              </div>
              <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
                {s.challenges.map((c,i) => (
                  <div key={i} style={{ display:'flex',gap:14,alignItems:'flex-start',padding:'16px 18px',background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,borderLeft:`3px solid ${A}` }}>
                    <span style={{ color:A,fontSize:16,flexShrink:0,marginTop:1 }}>⚡</span>
                    <span style={{ fontFamily:FONT,fontSize:13,color:C.text1,lineHeight:1.6,fontWeight:500 }}>{c}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ══ 4. CAPABILITIES ══════════════════════════════════════════════ */}
          <section style={{ background:C.bg,padding:isMobile?'56px 16px':'88px 32px',borderBottom:`1px solid ${C.border}` }}>
            <div style={{ maxWidth:1100,margin:'0 auto' }}>
              <div style={{ textAlign:'center',marginBottom:52 }}>
                <p style={{ fontFamily:FONT,fontSize:12,fontWeight:700,color:A,letterSpacing:'.1em',textTransform:'uppercase',margin:'0 0 14px' }}>What You'll Get</p>
                <h2 style={{ fontFamily:SERIF,fontSize:38,fontWeight:400,color:C.text1,letterSpacing:'-.025em',margin:'0 0 14px' }}>Capabilities built for outcomes.</h2>
                <p style={{ fontFamily:FONT,fontSize:15,color:C.text2,maxWidth:480,margin:'0 auto',lineHeight:1.7 }}>Every capability feeds from the same ground-truth data cube — fully consistent, fully reconciled.</p>
              </div>
              <div style={{ display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)',gap:16 }}>
                {s.capabilities.map((cap,i) => (
                  <div key={i} style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:'24px 22px',transition:'border-color .18s,box-shadow .18s,transform .18s' }}
                    onMouseEnter={ev=>{ev.currentTarget.style.borderColor=`${A}55`;ev.currentTarget.style.boxShadow=`0 6px 24px ${A}15`;ev.currentTarget.style.transform='translateY(-2px)'}}
                    onMouseLeave={ev=>{ev.currentTarget.style.borderColor=C.border;ev.currentTarget.style.boxShadow='none';ev.currentTarget.style.transform='none'}}>
                    <div style={{ height:3,borderRadius:2,background:A,marginBottom:18 }}/>
                    <div style={{ fontSize:22,marginBottom:10 }}>{cap.icon}</div>
                    <div style={{ fontFamily:FONT,fontSize:14,fontWeight:700,color:C.text1,marginBottom:8,letterSpacing:'-.01em' }}>{cap.title}</div>
                    <div style={{ fontFamily:FONT,fontSize:12.5,color:C.text2,lineHeight:1.65 }}>{cap.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ══ 5. WHY IT MATTERS ════════════════════════════════════════════ */}
          <section style={{ background:C.dark,padding:isMobile?'56px 16px':'88px 32px',borderBottom:'none' }}>
            <div aria-hidden style={{ position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:600,height:300,background:`radial-gradient(ellipse,${A}20 0%,transparent 70%)`,pointerEvents:'none' }}/>
            <div style={{ maxWidth:900,margin:'0 auto',position:'relative' }}>
              <div style={{ textAlign:'center',marginBottom:52 }}>
                <p style={{ fontFamily:FONT,fontSize:12,fontWeight:700,color:A,letterSpacing:'.1em',textTransform:'uppercase',margin:'0 0 14px' }}>Why It Matters</p>
                <h2 style={{ fontFamily:SERIF,fontSize:38,fontWeight:400,color:'#fff',letterSpacing:'-.025em',margin:0,lineHeight:1.15 }}>Business outcomes, not just metrics.</h2>
              </div>
              <div style={{ display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)',gap:20 }}>
                {s.whyMatters.map((w,i) => (
                  <div key={i} style={{ background:'#1A1530',border:`1px solid ${A}30`,borderRadius:16,padding:'28px 24px',textAlign:'center' }}>
                    <div style={{ width:48,height:48,borderRadius:14,background:`${A}20`,border:`1px solid ${A}30`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',fontSize:22 }}>{w.icon}</div>
                    <div style={{ fontFamily:FONT,fontSize:15,fontWeight:700,color:'#fff',marginBottom:10 }}>{w.title}</div>
                    <div style={{ fontFamily:FONT,fontSize:13,color:'rgba(255,255,255,0.5)',lineHeight:1.65 }}>{w.body}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ══ 6. QUESTIONS ANSWERED ════════════════════════════════════════ */}
          <section style={{ background:AL,borderTop:`1px solid ${A}22`,borderBottom:`1px solid ${A}22`,padding:isMobile?'48px 16px':'72px 32px' }}>
            <div style={{ maxWidth:800,margin:'0 auto' }}>
              <div style={{ textAlign:'center',marginBottom:40 }}>
                <p style={{ fontFamily:FONT,fontSize:12,fontWeight:700,color:A,letterSpacing:'.1em',textTransform:'uppercase',margin:'0 0 14px' }}>Questions RevenueLens Answers</p>
                <h2 style={{ fontFamily:SERIF,fontSize:34,fontWeight:400,color:C.text1,letterSpacing:'-.02em',margin:0 }}>Stop guessing. Start knowing.</h2>
              </div>
              <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
                {s.questions.map((q,i) => (
                  <div key={i} style={{ display:'flex',gap:14,alignItems:'center',padding:'15px 20px',background:C.surface,border:`1px solid ${A}30`,borderRadius:12 }}>
                    <span style={{ color:A,fontWeight:700,fontSize:14,flexShrink:0 }}>?</span>
                    <span style={{ fontFamily:FONT,fontSize:14,color:C.text1,fontWeight:500 }}>{q}</span>
                    <span style={{ marginLeft:'auto',fontFamily:FONT,fontSize:12,color:A,fontWeight:600,flexShrink:0 }}>See answer →</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ══ 7. INDUSTRIES ════════════════════════════════════════════════ */}
          <section style={{ background:C.surface,padding:isMobile?'48px 16px':'72px 32px',borderBottom:`1px solid ${C.border}` }}>
            <div style={{ maxWidth:900,margin:'0 auto',textAlign:'center' }}>
              <p style={{ fontFamily:FONT,fontSize:12,fontWeight:700,color:A,letterSpacing:'.1em',textTransform:'uppercase',margin:'0 0 14px' }}>Industries Served</p>
              <h2 style={{ fontFamily:SERIF,fontSize:32,fontWeight:400,color:C.text1,letterSpacing:'-.02em',margin:'0 0 40px' }}>Built for revenue-driven organizations.</h2>
              <div style={{ display:'flex',gap:16,justifyContent:'center',flexWrap:'wrap' }}>
                {[
                  {icon:'💻',name:'SaaS & Software'},{icon:'💼',name:'PE Portfolio Companies'},{icon:'🏥',name:'Healthcare Tech'},
                  {icon:'🏭',name:'Manufacturing'},{icon:'📡',name:'Telecom'},{icon:'🏦',name:'Financial Services'},
                  {icon:'🛍️',name:'Professional Services'},{icon:'🎓',name:'EdTech'},
                ].map((ind,i) => (
                  <div key={i} style={{ display:'flex',alignItems:'center',gap:9,padding:'10px 18px',background:C.bg,border:`1px solid ${C.border}`,borderRadius:99,fontFamily:FONT,fontSize:13,color:C.text2,fontWeight:500,transition:'border-color .15s' }}
                    onMouseEnter={ev=>{ev.currentTarget.style.borderColor=`${A}55`;ev.currentTarget.style.color=A}}
                    onMouseLeave={ev=>{ev.currentTarget.style.borderColor=C.border;ev.currentTarget.style.color=C.text2}}>
                    <span>{ind.icon}</span>{ind.name}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ══ 8. FINAL CTA ═════════════════════════════════════════════════ */}
          <section style={{ background:A,padding:isMobile?'60px 20px':'88px 32px',position:'relative',overflow:'hidden',textAlign:'center' }}>
            <div aria-hidden style={{ position:'absolute',top:-80,left:'50%',transform:'translateX(-50%)',width:500,height:280,background:'radial-gradient(ellipse,rgba(255,255,255,0.15) 0%,transparent 70%)',pointerEvents:'none' }}/>
            <div style={{ maxWidth:560,margin:'0 auto',position:'relative' }}>
              <p style={{ fontFamily:FONT,fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.6)',letterSpacing:'.1em',textTransform:'uppercase',margin:'0 0 14px' }}>{s.label} Intelligence</p>
              <h2 style={{ fontFamily:SERIF,fontSize:40,fontWeight:400,color:'#fff',letterSpacing:'-.025em',margin:'0 0 16px',lineHeight:1.15 }}>Turn data into<br/>revenue intelligence.</h2>
              <p style={{ fontFamily:FONT,fontSize:16,color:'rgba(255,255,255,0.65)',lineHeight:1.7,margin:'0 0 36px' }}>Upload your data. Get answers in under 2 minutes. No consultants, no waiting, no spreadsheets.</p>
              <div style={{ display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap' }}>
                <button onClick={()=>router.push('/auth/login')}
                  style={{ background:'#fff',color:A,border:'none',borderRadius:10,padding:'13px 28px',fontFamily:FONT,fontSize:15,fontWeight:700,cursor:'pointer',boxShadow:'0 4px 16px rgba(0,0,0,0.15)' }}>
                  Start for free — no card required
                </button>
                <button onClick={()=>router.push('/consulting')}
                  style={{ background:'rgba(255,255,255,0.15)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)',borderRadius:10,padding:'13px 22px',fontFamily:FONT,fontSize:15,fontWeight:500,cursor:'pointer' }}>
                  Book a demo
                </button>
              </div>
            </div>
          </section>
        </main>

        {/* ── FOOTER ── */}
        <footer style={{ background:C.dark,padding:'44px 32px 24px' }}>
          <div style={{ maxWidth:1100,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:isMobile?'center':'space-between',flexWrap:'wrap',gap:16,flexDirection:isMobile?'column':'row',textAlign:isMobile?'center':'left' }}>
            <a href="/" style={{ display:'flex',alignItems:'center',gap:10,textDecoration:'none' }}>
              <div style={{ width:28,height:28,borderRadius:8,background:C.purple,display:'flex',alignItems:'center',justifyContent:'center' }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 13L8 3L14 13H2Z" fill="white"/></svg>
              </div>
              <span style={{ fontFamily:FONT,fontSize:14,fontWeight:700,color:'#fff' }}>RevenueLens</span>
            </a>
            <div style={{ display:'flex',gap:24 }}>
              {[['Solutions','/#solutions'],['Pricing','/#pricing'],['Consulting','/consulting'],['Sign in','/auth/login']].map(([l,h]) => (
                <a key={l} href={h} style={{ fontFamily:FONT,fontSize:13,color:'rgba(255,255,255,0.4)',textDecoration:'none' }}
                  onMouseEnter={e=>e.target.style.color='rgba(255,255,255,0.8)'}
                  onMouseLeave={e=>e.target.style.color='rgba(255,255,255,0.4)'}>{l}</a>
              ))}
            </div>
            <span style={{ fontFamily:FONT,fontSize:12,color:'rgba(255,255,255,0.22)' }}>© 2026 RevenueLens · Built for CFOs who want answers, not charts.</span>
          </div>
        </footer>
      </div>
    </>
  )
}
