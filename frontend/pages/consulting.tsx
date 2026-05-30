// @ts-nocheck
// frontend/pages/consulting.tsx
// Fully inline-styled — matches main platform exactly (same C palette, DM Sans, DM Serif)

import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'

// ── Exact same palette as index.tsx ──────────────────────────────────────────
const C = {
  bg:'#F8F7FC', surface:'#FFFFFF', purple:'#6B31D4', purple2:'#5A28B4',
  purpleXl:'#F0EBFF', purpleMd:'#E0D5FF', text1:'#0F0A1E', text2:'#4C4668',
  text3:'#9990B0', border:'#E8E4F2', borderMd:'#D0C9E8', green:'#12B76A',
  greenBg:'#ECFDF3', red:'#F04438', amber:'#F79009', blue:'#2E90FA',
  dark:'#0F0A1E', dark2:'#1A1530',
}
const FONT  = "'DM Sans','Helvetica Neue',Arial,sans-serif"
const SERIF = "'DM Serif Display',Georgia,serif"


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

const PACKAGES = [
  {
    id: 'strategy',
    duration: '1 hour',
    price: '$150',
    title: 'Strategy Session',
    desc: 'Interpret your revenue data, understand your retention metrics, and get a clear picture of your ARR drivers.',
    includes: ['ARR bridge walkthrough','NRR / GRR interpretation','Top 3 action items','Summary notes delivered'],
    cta: 'Book 1-hour session',
    popular: false,
  },
  {
    id: 'deep-dive',
    duration: '2 hours',
    price: '$280',
    title: 'Deep Dive',
    desc: 'Full cohort analysis setup, revenue bridge build, and investor-ready narrative for your SaaS metrics.',
    includes: ['Everything in Strategy','Cohort analytics setup','Customer segmentation','Investor narrative draft','Excel waterfall output'],
    cta: 'Book 2-hour session',
    popular: true,
  },
  {
    id: 'analytics-build',
    duration: 'Half day (4 hrs)',
    price: '$500',
    title: 'Analytics Build',
    desc: 'Complete analytics model setup: data pipeline, cohort engine configuration, and PE-grade output templates.',
    includes: ['Everything in Deep Dive','Full model configuration','Custom dashboard setup','Team walkthrough','1-week follow-up support'],
    cta: 'Book half-day session',
    popular: false,
  },
]

const EXPERTISE = [
  { icon:'📈', label:'SaaS Revenue Metrics', desc:'ARR, MRR, NRR, GRR, logo retention — the full stack' },
  { icon:'👥', label:'Cohort Analysis',       desc:'Customer cohorts, retention curves, vintage analysis' },
  { icon:'💼', label:'PE Diligence',           desc:'Revenue quality analysis for investment decisions' },
  { icon:'⚙️', label:'Alteryx Methodology',   desc:'MRR bridge workflow translated to Python' },
]

export default function ConsultingPage() {
  const isMobile = useIsMobile()
  const router = useRouter()
  const [form, setForm] = useState({ name:'', email:'', company:'', message:'', pkg:'' })
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [selectedPkg, setSelectedPkg] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSending(true)
    // Build mailto as fallback — in production wire to /api/contact
    const subject = encodeURIComponent(`RevenueLens Consulting: ${form.pkg || 'Session Request'}`)
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\nCompany: ${form.company}\nPackage: ${form.pkg}\n\nMessage:\n${form.message}`
    )
    window.location.href = `mailto:ashwani.enrichai@gmail.com?subject=${subject}&body=${body}`
    setTimeout(() => { setSending(false); setSent(true) }, 800)
  }

  function scrollToBook(pkgTitle = '') {
    setSelectedPkg(pkgTitle)
    setForm(f => ({ ...f, pkg: pkgTitle }))
    document.getElementById('book')?.scrollIntoView({ behavior:'smooth', block:'start' })
  }

  const card = (extra={}) => ({
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    ...extra,
  })

  return (
    <>
      <Head>
        <title>Analytics Consulting — RevenueLens</title>
        <meta name="description" content="Book Ashwani for 1-on-1 SaaS analytics consulting. Revenue bridge, cohort analysis, investor narratives. No retainer — book by the hour."/>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet"/>
      </Head>

      <div style={{ background:C.bg, fontFamily:FONT, color:C.text1, minHeight:'100vh' }}>

        {/* ── NAV — identical to index.tsx ── */}
        <header style={{ position:'fixed',top:0,left:0,right:0,zIndex:1000,background:'rgba(248,247,252,0.92)',backdropFilter:'blur(16px)',borderBottom:`1px solid ${C.border}` }}>
          <div style={{ maxWidth:1200,margin:'0 auto',padding:'0 20px',height:64,display:'flex',alignItems:'center',gap:40 }}>
            <a href="/" style={{ display:'flex',alignItems:'center',gap:10,textDecoration:'none',flexShrink:0 }}>
              <div style={{ width:32,height:32,borderRadius:10,background:C.purple,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 8px rgba(107,49,212,0.4)' }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 13L8 3L14 13H2Z" fill="white" fillOpacity=".95"/><path d="M5.5 13L8 8.5L10.5 13H5.5Z" fill="white" fillOpacity=".5"/></svg>
              </div>
              <span style={{ fontFamily:FONT,fontSize:16,fontWeight:700,color:C.text1,letterSpacing:'-.02em' }}>RevenueLens</span>
            </a>
            <nav style={{ display:'flex',gap:28,flex:1 }}>
              {[['Platform','/'],[`Pricing`,'/#pricing'],['Sign in','/auth/login']].map(([l,h]) => (
                <a key={l} href={h} style={{ fontFamily:FONT,fontSize:13,fontWeight:500,color:C.text2,textDecoration:'none' }}
                  onMouseEnter={e=>e.target.style.color=C.purple}
                  onMouseLeave={e=>e.target.style.color=C.text2}>{l}</a>
              ))}
            </nav>
            <button onClick={()=>router.push('/auth/login')}
              style={{ background:C.purple,color:'#fff',border:'none',borderRadius:9,padding:'9px 20px',fontFamily:FONT,fontSize:13,fontWeight:600,cursor:'pointer',boxShadow:'0 1px 2px rgba(107,49,212,0.3)' }}>
              Try the platform →
            </button>
          </div>
        </header>

        <main style={{ paddingTop:'calc(64px + env(safe-area-inset-top))' }}>

          {/* ── HERO ── */}
          <section style={{ background:C.dark,padding:isMobile?'88px 20px 60px':'88px 32px 80px',textAlign:'center',position:'relative',overflow:'hidden' }}>
            <div aria-hidden style={{ position:'absolute',top:-120,left:'50%',transform:'translateX(-50%)',width:700,height:380,background:`radial-gradient(ellipse,${C.purple}35 0%,transparent 70%)`,pointerEvents:'none' }}/>
            <div aria-hidden style={{ position:'absolute',inset:0,pointerEvents:'none',backgroundImage:`linear-gradient(rgba(107,49,212,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(107,49,212,0.06) 1px,transparent 1px)`,backgroundSize:'60px 60px' }}/>
            <div style={{ maxWidth:680,margin:'0 auto',position:'relative' }}>
              <div style={{ display:'inline-flex',alignItems:'center',gap:7,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:99,padding:'5px 16px 5px 10px',marginBottom:32 }}>
                <span style={{ fontSize:12 }}>⏱</span>
                <span style={{ fontFamily:FONT,fontSize:13,color:'rgba(255,255,255,0.65)',fontWeight:500 }}>No retainer · Book by the hour</span>
              </div>
              <h1 style={{ fontFamily:SERIF,fontSize:'clamp(36px,5vw,56px)',fontWeight:400,color:'#fff',lineHeight:1.1,letterSpacing:'-.025em',margin:'0 0 20px' }}>
                Expert Analytics Consulting.<br/>
                <em style={{ fontStyle:'italic',color:'#C4A8FF' }}>On Your Schedule.</em>
              </h1>
              <p style={{ fontFamily:FONT,fontSize:17,color:'rgba(255,255,255,0.58)',lineHeight:1.7,margin:'0 0 36px',maxWidth:560,marginLeft:'auto',marginRight:'auto' }}>
                Need someone to interpret your SaaS metrics, build a revenue narrative for investors, or set up your cohort analytics model? Book Ashwani for a focused 1-on-1 session.
              </p>
              <div style={{ display:'flex',flexWrap:'wrap',gap:10,justifyContent:'center',marginBottom:40 }}>
                {[['⭐','Former PE analytics background'],['✓','Deep SaaS metrics expertise'],['📊','Alteryx-level methodology']].map(([icon,label]) => (
                  <div key={label} style={{ display:'flex',alignItems:'center',gap:8,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:99,padding:'7px 16px',fontFamily:FONT,fontSize:13,color:'rgba(255,255,255,0.75)',fontWeight:500 }}>
                    <span>{icon}</span>{label}
                  </div>
                ))}
              </div>
              <button onClick={()=>scrollToBook()}
                style={{ background:C.purple,color:'#fff',border:'none',borderRadius:10,padding:'13px 28px',fontFamily:FONT,fontSize:15,fontWeight:600,cursor:'pointer',boxShadow:'0 4px 20px rgba(107,49,212,0.4)' }}>
                Book a session →
              </button>
            </div>
          </section>

          {/* ── EXPERTISE CARDS ── */}
          <section style={{ background:C.surface,padding:isMobile?'40px 16px':'56px 32px',borderBottom:`1px solid ${C.border}` }}>
            <div style={{ maxWidth:1000,margin:'0 auto' }}>
              <div style={{ display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:16 }}>
                {EXPERTISE.map((e,i) => (
                  <div key={i} style={{ ...card(),padding:'22px 20px',textAlign:'center',transition:'border-color .18s,box-shadow .18s' }}
                    onMouseEnter={ev=>{ev.currentTarget.style.borderColor=`${C.purple}55`;ev.currentTarget.style.boxShadow='0 4px 16px rgba(107,49,212,0.08)'}}
                    onMouseLeave={ev=>{ev.currentTarget.style.borderColor=C.border;ev.currentTarget.style.boxShadow='none'}}>
                    <div style={{ width:44,height:44,borderRadius:12,background:C.purpleXl,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px',fontSize:20 }}>{e.icon}</div>
                    <div style={{ fontFamily:FONT,fontSize:13,fontWeight:700,color:C.text1,marginBottom:6 }}>{e.label}</div>
                    <div style={{ fontFamily:FONT,fontSize:12,color:C.text3,lineHeight:1.6 }}>{e.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── PACKAGES ── */}
          <section style={{ background:C.bg,padding:isMobile?'56px 16px':'88px 32px' }}>
            <div style={{ maxWidth:1000,margin:'0 auto' }}>
              <div style={{ textAlign:'center',marginBottom:52 }}>
                <p style={{ fontFamily:FONT,fontSize:12,fontWeight:700,color:C.purple,letterSpacing:'.1em',textTransform:'uppercase',margin:'0 0 14px' }}>Consulting Packages</p>
                <h2 style={{ fontFamily:SERIF,fontSize:40,fontWeight:400,color:C.text1,letterSpacing:'-.025em',margin:0 }}>Choose your session.</h2>
              </div>
              <div style={{ display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)',gap:20 }}>
                {PACKAGES.map((pkg,i) => {
                  const hot = pkg.popular
                  return (
                    <div key={i} style={{ position:'relative',background:hot?C.dark2:C.surface,border:`${hot?2:1}px solid ${hot?C.purple:C.border}`,borderRadius:20,padding:'30px 26px',display:'flex',flexDirection:'column',boxShadow:hot?'0 8px 36px rgba(107,49,212,0.18)':'0 1px 4px rgba(0,0,0,0.04)' }}>
                      {hot && (
                        <div style={{ position:'absolute',top:-14,left:'50%',transform:'translateX(-50%)',background:C.amber,color:C.text1,borderRadius:99,padding:'4px 18px',fontFamily:FONT,fontSize:10,fontWeight:700,whiteSpace:'nowrap',letterSpacing:'.04em' }}>MOST POPULAR</div>
                      )}
                      {/* Duration badge */}
                      <div style={{ display:'inline-flex',alignItems:'center',gap:6,marginBottom:16 }}>
                        <span style={{ fontFamily:FONT,fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em',color:hot?'rgba(255,255,255,0.4)':C.text3 }}>⏱ {pkg.duration}</span>
                      </div>
                      {/* Price */}
                      <div style={{ display:'flex',alignItems:'baseline',gap:4,marginBottom:6 }}>
                        <span style={{ fontFamily:SERIF,fontSize:42,fontWeight:400,color:hot?'#C4A8FF':C.purple,letterSpacing:'-.02em',lineHeight:1 }}>{pkg.price}</span>
                      </div>
                      {/* Title */}
                      <div style={{ fontFamily:FONT,fontSize:16,fontWeight:700,color:hot?'#fff':C.text1,marginBottom:10 }}>{pkg.title}</div>
                      {/* Desc */}
                      <p style={{ fontFamily:FONT,fontSize:13,color:hot?'rgba(255,255,255,0.5)':C.text2,lineHeight:1.65,marginBottom:22 }}>{pkg.desc}</p>
                      {/* Features */}
                      <ul style={{ listStyle:'none',padding:0,margin:'0 0 24px',display:'flex',flexDirection:'column',gap:9,flex:1 }}>
                        {pkg.includes.map((f,fi) => (
                          <li key={fi} style={{ display:'flex',gap:8,alignItems:'flex-start',fontFamily:FONT,fontSize:13,color:hot?'rgba(255,255,255,0.6)':C.text2 }}>
                            <span style={{ color:hot?'#A5B4FC':C.green,flexShrink:0,marginTop:1 }}>✓</span>{f}
                          </li>
                        ))}
                      </ul>
                      {/* CTA */}
                      <button onClick={()=>scrollToBook(pkg.title)}
                        style={{ width:'100%',padding:'12px 0',borderRadius:10,border:'none',
                          background: hot?C.purple:C.purpleXl,
                          color: hot?'#fff':C.purple,
                          fontFamily:FONT,fontSize:14,fontWeight:600,cursor:'pointer',
                          boxShadow: hot?'0 4px 14px rgba(107,49,212,0.35)':'none',
                          transition:'all .15s' }}
                        onMouseEnter={e=>e.target.style.opacity='0.9'}
                        onMouseLeave={e=>e.target.style.opacity='1'}>
                        📅 {pkg.cta}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* ── WHAT YOU GET strip ── */}
          <section style={{ background:C.purpleXl,borderTop:`1px solid ${C.purpleMd}`,borderBottom:`1px solid ${C.purpleMd}`,padding:isMobile?'40px 16px':'48px 32px' }}>
            <div style={{ maxWidth:900,margin:'0 auto',textAlign:'center' }}>
              <p style={{ fontFamily:FONT,fontSize:12,fontWeight:700,color:C.purple,letterSpacing:'.1em',textTransform:'uppercase',margin:'0 0 16px' }}>What you get</p>
              <div style={{ display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:24 }}>
                {[
                  { icon:'📄', title:'Written summary', desc:'Notes and action items delivered within 24 hours.' },
                  { icon:'📊', title:'Live data work', desc:'We work in your actual data, not generic examples.' },
                  { icon:'🎯', title:'Specific actions', desc:'Walk away with 3–5 concrete next steps.' },
                  { icon:'🔄', title:'Follow-up included', desc:'One follow-up email Q&A included with every session.' },
                ].map((w,i) => (
                  <div key={i} style={{ textAlign:'center' }}>
                    <div style={{ fontSize:24,marginBottom:10 }}>{w.icon}</div>
                    <div style={{ fontFamily:FONT,fontSize:13,fontWeight:700,color:C.text1,marginBottom:6 }}>{w.title}</div>
                    <div style={{ fontFamily:FONT,fontSize:12,color:C.text2,lineHeight:1.6 }}>{w.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── BOOKING FORM ── */}
          <section id="book" style={{ background:C.bg,padding:isMobile?'56px 16px':'88px 32px' }}>
            <div style={{ maxWidth:540,margin:'0 auto' }}>
              <div style={{ textAlign:'center',marginBottom:44 }}>
                <p style={{ fontFamily:FONT,fontSize:12,fontWeight:700,color:C.purple,letterSpacing:'.1em',textTransform:'uppercase',margin:'0 0 14px' }}>Book a Session</p>
                <h2 style={{ fontFamily:SERIF,fontSize:38,fontWeight:400,color:C.text1,letterSpacing:'-.025em',margin:'0 0 10px' }}>Get in touch.</h2>
                <p style={{ fontFamily:FONT,fontSize:14,color:C.text3,margin:0 }}>Fill in the form and we'll confirm a time within 24 hours.</p>
              </div>

              {sent ? (
                <div style={{ ...card(),padding:'40px',textAlign:'center' }}>
                  <div style={{ fontSize:40,marginBottom:16 }}>✅</div>
                  <div style={{ fontFamily:SERIF,fontSize:24,fontWeight:400,color:C.text1,marginBottom:10 }}>Request sent!</div>
                  <p style={{ fontFamily:FONT,fontSize:14,color:C.text2,marginBottom:20,lineHeight:1.6 }}>We'll confirm your session within 24 hours. Check your email for a response from ashwani.enrichai@gmail.com</p>
                  <button onClick={()=>setSent(false)}
                    style={{ background:C.purpleXl,color:C.purple,border:'none',borderRadius:9,padding:'10px 22px',fontFamily:FONT,fontSize:13,fontWeight:600,cursor:'pointer' }}>
                    Send another request
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ ...card(),padding:'32px 30px' }}>
                  {/* Selected package banner */}
                  {form.pkg && (
                    <div style={{ padding:'10px 14px',background:C.purpleXl,border:`1px solid ${C.purpleMd}`,borderRadius:9,marginBottom:20,fontFamily:FONT,fontSize:13,fontWeight:600,color:C.purple,display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                      <span>📅 {form.pkg}</span>
                      <button type="button" onClick={()=>setForm(f=>({...f,pkg:''}))} style={{ background:'none',border:'none',cursor:'pointer',color:C.text3,fontSize:16,padding:0 }}>×</button>
                    </div>
                  )}

                  <div style={{ display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:14,marginBottom:14 }}>
                    <div>
                      <label style={{ display:'block',fontFamily:FONT,fontSize:12,fontWeight:600,color:C.text2,marginBottom:6 }}>Your name</label>
                      <input required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                        placeholder="Ashwani Vatsal"
                        style={{ width:'100%',padding:'9px 12px',border:`1px solid ${C.border}`,borderRadius:8,fontFamily:FONT,fontSize:13,color:C.text1,outline:'none',boxSizing:'border-box' }}
                        onFocus={e=>e.target.style.borderColor=C.purple}
                        onBlur={e=>e.target.style.borderColor=C.border}/>
                    </div>
                    <div>
                      <label style={{ display:'block',fontFamily:FONT,fontSize:12,fontWeight:600,color:C.text2,marginBottom:6 }}>Email</label>
                      <input required type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}
                        placeholder="you@company.com"
                        style={{ width:'100%',padding:'9px 12px',border:`1px solid ${C.border}`,borderRadius:8,fontFamily:FONT,fontSize:13,color:C.text1,outline:'none',boxSizing:'border-box' }}
                        onFocus={e=>e.target.style.borderColor=C.purple}
                        onBlur={e=>e.target.style.borderColor=C.border}/>
                    </div>
                  </div>

                  <div style={{ marginBottom:14 }}>
                    <label style={{ display:'block',fontFamily:FONT,fontSize:12,fontWeight:600,color:C.text2,marginBottom:6 }}>Company</label>
                    <input value={form.company} onChange={e=>setForm(f=>({...f,company:e.target.value}))}
                      placeholder="Your company name"
                      style={{ width:'100%',padding:'9px 12px',border:`1px solid ${C.border}`,borderRadius:8,fontFamily:FONT,fontSize:13,color:C.text1,outline:'none',boxSizing:'border-box' }}
                      onFocus={e=>e.target.style.borderColor=C.purple}
                      onBlur={e=>e.target.style.borderColor=C.border}/>
                  </div>

                  <div style={{ marginBottom:14 }}>
                    <label style={{ display:'block',fontFamily:FONT,fontSize:12,fontWeight:600,color:C.text2,marginBottom:6 }}>What do you need help with?</label>
                    <textarea value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))}
                      placeholder="Describe what you'd like to cover in the session..."
                      rows={4}
                      style={{ width:'100%',padding:'9px 12px',border:`1px solid ${C.border}`,borderRadius:8,fontFamily:FONT,fontSize:13,color:C.text1,outline:'none',resize:'vertical',boxSizing:'border-box' }}
                      onFocus={e=>e.target.style.borderColor=C.purple}
                      onBlur={e=>e.target.style.borderColor=C.border}/>
                  </div>

                  <div style={{ marginBottom:24 }}>
                    <label style={{ display:'block',fontFamily:FONT,fontSize:12,fontWeight:600,color:C.text2,marginBottom:6 }}>Package preference</label>
                    <select value={form.pkg} onChange={e=>setForm(f=>({...f,pkg:e.target.value}))}
                      style={{ width:'100%',padding:'9px 12px',border:`1px solid ${C.border}`,borderRadius:8,fontFamily:FONT,fontSize:13,color:form.pkg?C.text1:C.text3,outline:'none',background:C.surface,boxSizing:'border-box' }}
                      onFocus={e=>e.target.style.borderColor=C.purple}
                      onBlur={e=>e.target.style.borderColor=C.border}>
                      <option value="">Select a package</option>
                      {PACKAGES.map(p=><option key={p.id} value={p.title}>{p.title} — {p.price}</option>)}
                    </select>
                  </div>

                  <button type="submit" disabled={sending}
                    style={{ width:'100%',padding:'13px 0',background:C.purple,color:'#fff',border:'none',borderRadius:10,fontFamily:FONT,fontSize:14,fontWeight:600,cursor:sending?'not-allowed':'pointer',boxShadow:'0 4px 14px rgba(107,49,212,0.3)',opacity:sending?0.7:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
                    {sending ? '⏳ Sending…' : '📨 Send booking request →'}
                  </button>

                  <p style={{ fontFamily:FONT,fontSize:11,color:C.text3,textAlign:'center',marginTop:14,margin:'14px 0 0' }}>
                    Or email directly: <a href="mailto:ashwani.enrichai@gmail.com" style={{ color:C.purple,textDecoration:'none',fontWeight:600 }}>ashwani.enrichai@gmail.com</a>
                  </p>
                </form>
              )}
            </div>
          </section>

          {/* ── BACK TO PLATFORM strip ── */}
          <section style={{ background:C.dark,padding:'48px 32px',textAlign:'center' }}>
            <div style={{ maxWidth:600,margin:'0 auto' }}>
              <p style={{ fontFamily:FONT,fontSize:13,color:'rgba(255,255,255,0.4)',marginBottom:16 }}>Want to run the analysis yourself?</p>
              <button onClick={()=>router.push('/auth/login')}
                style={{ background:C.purple,color:'#fff',border:'none',borderRadius:10,padding:'13px 28px',fontFamily:FONT,fontSize:14,fontWeight:600,cursor:'pointer',boxShadow:'0 4px 16px rgba(107,49,212,0.35)' }}>
                Try RevenueLens free →
              </button>
              <p style={{ fontFamily:FONT,fontSize:12,color:'rgba(255,255,255,0.2)',marginTop:14 }}>No credit card required · Full platform access</p>
            </div>
          </section>
        </main>

        {/* ── FOOTER — matches main site ── */}
        <footer style={{ background:C.text1,padding:'44px 32px 24px' }}>
          <div style={{ maxWidth:1100,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:16 }}>
            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
              <div style={{ width:28,height:28,borderRadius:8,background:C.purple,display:'flex',alignItems:'center',justifyContent:'center' }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 13L8 3L14 13H2Z" fill="white"/></svg>
              </div>
              <span style={{ fontFamily:FONT,fontSize:14,fontWeight:700,color:'#fff' }}>RevenueLens</span>
            </div>
            <div style={{ display:'flex',gap:24 }}>
              {[['Platform','/'],['Pricing','/#pricing'],['Sign in','/auth/login']].map(([l,h]) => (
                <a key={l} href={h} style={{ fontFamily:FONT,fontSize:13,color:'rgba(255,255,255,0.4)',textDecoration:'none',transition:'color .15s' }}
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
