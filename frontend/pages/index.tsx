// @ts-nocheck
/**
 * pages/index.tsx — RevenueLens Landing Page v2
 * Deploy to: frontend/pages/index.tsx
 */

import React, { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

const C = {
  bg:'#F8F7FC', surface:'#FFFFFF', purple:'#6B31D4', purple2:'#5A28B4',
  purpleXl:'#F0EBFF', purpleMd:'#E0D5FF', text1:'#0F0A1E', text2:'#4C4668',
  text3:'#9990B0', border:'#E8E4F2', borderMd:'#D0C9E8', green:'#12B76A',
  greenBg:'#ECFDF3', red:'#F04438', amber:'#F79009', blue:'#2E90FA',
  dark:'#0F0A1E', dark2:'#1A1530', dark3:'#2D2650',
}
const FONT  = "'DM Sans','Helvetica Neue',Arial,sans-serif"
const SERIF = "'DM Serif Display',Georgia,serif"
const MONO  = "'DM Mono','Fira Code',monospace"

function useInView() {
  const ref = useRef(null)
  const [v, setV] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); obs.disconnect() } }, { threshold: 0.08 })
    obs.observe(el); return () => obs.disconnect()
  }, [])
  return [ref, v]
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

const fadeIn = (v, d=0) => ({
  opacity: v?1:0,
  transform: v?'none':'translateY(22px)',
  transition: `opacity 0.6s ease ${d}s, transform 0.6s ease ${d}s`
})

function scrollTo(id) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior:'smooth', block:'start' })
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function Nav({ onLogin, onStart }) {
  const [sc, setSc] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const isMobile = useIsMobile()
  useEffect(() => {
    const fn = () => setSc(window.scrollY > 40)
    window.addEventListener('scroll', fn, { passive:true })
    return () => window.removeEventListener('scroll', fn)
  }, [])
  return (
    <header style={{ position:'fixed',top:0,left:0,right:0,zIndex:1000,
      background: sc||menuOpen ? 'rgba(248,247,252,0.97)' : 'transparent',
      backdropFilter: sc ? 'blur(16px)' : 'none',
      borderBottom: sc ? `1px solid ${C.border}` : '1px solid transparent',
      transition: 'all 0.3s',
      paddingTop:'env(safe-area-inset-top)' }}>
      <div style={{ maxWidth:1200,margin:'0 auto',padding:'0 20px',height:64,display:'flex',alignItems:'center',gap:isMobile?0:40 }}>
        <div style={{ display:'flex',alignItems:'center',gap:10,flexShrink:0 }}>
          <div style={{ width:32,height:32,borderRadius:10,background:C.purple,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 8px rgba(107,49,212,0.4)' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 13L8 3L14 13H2Z" fill="white" fillOpacity=".95"/><path d="M5.5 13L8 8.5L10.5 13H5.5Z" fill="white" fillOpacity=".5"/></svg>
          </div>
          <span style={{ fontFamily:FONT,fontSize:16,fontWeight:700,color:C.text1,letterSpacing:'-.02em' }}>RevenueLens</span>
        </div>
        {!isMobile && (
          <nav style={{ display:'flex',gap:28,flex:1 }}>
            {[['Product','product'],['Solutions','solutions'],['AI Studio','ai-studio'],['AI Layer','ai-section'],['Pricing','pricing']].map(([l,id]) => (
              <a key={l} href={`#${id}`} onClick={e=>{e.preventDefault();scrollTo(id)}}
                style={{ fontFamily:FONT,fontSize:13,fontWeight:500,color:C.text2,textDecoration:'none',transition:'color .15s' }}
                onMouseEnter={e=>e.target.style.color=C.purple}
                onMouseLeave={e=>e.target.style.color=C.text2}>{l}</a>
            ))}
          </nav>
        )}
        {!isMobile && (
          <div style={{ display:'flex',alignItems:'center',gap:12 }}>
            <button onClick={onLogin} style={{ background:'none',border:'none',cursor:'pointer',fontFamily:FONT,fontSize:13,fontWeight:500,color:C.text2,padding:'8px 12px' }}>Sign in</button>
            <button onClick={onStart} style={{ background:C.purple,color:'#fff',border:'none',borderRadius:9,padding:'9px 20px',fontFamily:FONT,fontSize:13,fontWeight:600,cursor:'pointer',boxShadow:'0 1px 2px rgba(107,49,212,0.3)',transition:'all .18s' }}
              onMouseEnter={e=>{e.target.style.background=C.purple2;e.target.style.boxShadow='0 4px 14px rgba(107,49,212,0.45)'}}
              onMouseLeave={e=>{e.target.style.background=C.purple;e.target.style.boxShadow='0 1px 2px rgba(107,49,212,0.3)'}}>Get started free</button>
          </div>
        )}
        {isMobile && (
          <div style={{ marginLeft:'auto',display:'flex',alignItems:'center',gap:10 }}>
            <button onClick={onStart} style={{ background:C.purple,color:'#fff',border:'none',borderRadius:8,padding:'8px 14px',fontFamily:FONT,fontSize:12,fontWeight:600,cursor:'pointer' }}>Start free</button>
            <button onClick={()=>setMenuOpen(o=>!o)} style={{ background:'none',border:`1px solid ${C.border}`,borderRadius:8,padding:'7px 10px',cursor:'pointer',fontSize:18,color:C.text1 }}>
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        )}
      </div>
      {isMobile && menuOpen && (
        <div style={{ background:C.surface,borderTop:`1px solid ${C.border}`,padding:'16px 20px',display:'flex',flexDirection:'column',gap:4 }}>
          {[['Product','product'],['Solutions','solutions'],['AI Studio','ai-studio'],['AI Layer','ai-section'],['Pricing','pricing']].map(([l,id]) => (
            <a key={l} href={`#${id}`} onClick={e=>{e.preventDefault();scrollTo(id);setMenuOpen(false)}}
              style={{ fontFamily:FONT,fontSize:15,fontWeight:500,color:C.text2,textDecoration:'none',padding:'10px 4px',borderBottom:`1px solid ${C.border}` }}>{l}</a>
          ))}
          <button onClick={()=>{onLogin();setMenuOpen(false)}} style={{ marginTop:8,background:'none',border:`1px solid ${C.border}`,borderRadius:8,padding:'10px',fontFamily:FONT,fontSize:14,fontWeight:500,color:C.text2,cursor:'pointer' }}>Sign in</button>
        </div>
      )}
    </header>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero({ onStart }) {
  const words = ['ARR bridge','cohort analysis','AI insights','retention trends','ACV analysis','revenue decisions']
  const [wi, setWi] = useState(0)
  const [fd, setFd] = useState(true)
  useEffect(() => {
    const t = setInterval(() => { setFd(false); setTimeout(() => { setWi(p=>(p+1)%words.length); setFd(true) }, 280) }, 2200)
    return () => clearInterval(t)
  }, [])
  return (
    <section style={{ minHeight:'100vh',background:`radial-gradient(ellipse 80% 55% at 50% -5%,${C.purpleMd} 0%,${C.bg} 65%)`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'120px 32px 80px',position:'relative',overflow:'hidden' }}>
      <div aria-hidden style={{ position:'absolute',inset:0,pointerEvents:'none',backgroundImage:`linear-gradient(${C.borderMd}44 1px,transparent 1px),linear-gradient(90deg,${C.borderMd}44 1px,transparent 1px)`,backgroundSize:'60px 60px',maskImage:'radial-gradient(ellipse 80% 55% at 50% 0%,black 0%,transparent 70%)',WebkitMaskImage:'radial-gradient(ellipse 80% 55% at 50% 0%,black 0%,transparent 70%)' }}/>
      <div style={{ maxWidth:820,textAlign:'center',position:'relative' }}>
        <div style={{ display:'inline-flex',alignItems:'center',gap:7,background:C.surface,border:`1px solid ${C.borderMd}`,borderRadius:99,padding:'5px 14px 5px 8px',marginBottom:32 }}>
          <span style={{ background:C.purple,color:'#fff',borderRadius:99,fontSize:10,fontWeight:700,padding:'2px 8px',fontFamily:FONT,letterSpacing:'.04em' }}>NEW</span>
          <span style={{ fontFamily:FONT,fontSize:13,fontWeight:500,color:C.text2 }}>AI Consultant now live — ask anything about your revenue</span>
        </div>
        <h1 style={{ fontFamily:SERIF,fontSize:'clamp(44px,6vw,72px)',fontWeight:400,color:C.text1,lineHeight:1.1,letterSpacing:'-.025em',margin:'0 0 14px' }}>
          Your revenue data,{' '}<em style={{ fontStyle:'italic',color:C.purple }}>finally</em>{' '}understood.
        </h1>
        <p style={{ fontFamily:FONT,fontSize:20,fontWeight:400,color:C.text2,lineHeight:1.6,margin:'0 0 40px',maxWidth:600,marginLeft:'auto',marginRight:'auto' }}>
          Upload any revenue data. Get instant{' '}
          <span style={{ color:C.purple,fontWeight:600,opacity:fd?1:0,transition:'opacity .28s',display:'inline-block' }}>{words[wi]}</span>
          {' '}powered by an AI that explains, teaches, and advises.
        </p>
        <div style={{ display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap' }}>
          <button onClick={onStart} style={{ background:C.purple,color:'#fff',border:'none',borderRadius:10,padding:'14px 32px',fontFamily:FONT,fontSize:16,fontWeight:600,cursor:'pointer',boxShadow:'0 4px 20px rgba(107,49,212,0.35)',transition:'all .18s' }}
            onMouseEnter={e=>{e.target.style.transform='translateY(-2px)';e.target.style.boxShadow='0 8px 28px rgba(107,49,212,0.45)'}}
            onMouseLeave={e=>{e.target.style.transform='';e.target.style.boxShadow='0 4px 20px rgba(107,49,212,0.35)'}}>Start for free →</button>
          <button onClick={()=>window.location.href='mailto:ashwani.enrichai@gmail.com?subject=RevenueLens Demo Request'}
            style={{ background:C.surface,color:C.text1,border:`1px solid ${C.border}`,borderRadius:10,padding:'14px 28px',fontFamily:FONT,fontSize:16,fontWeight:500,cursor:'pointer',transition:'all .18s' }}
            onMouseEnter={e=>{e.target.style.borderColor=C.borderMd;e.target.style.boxShadow='0 4px 12px rgba(0,0,0,0.07)'}}
            onMouseLeave={e=>{e.target.style.borderColor=C.border;e.target.style.boxShadow='none'}}>Book a demo</button>
        </div>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:0,marginTop:52,paddingTop:36,borderTop:`1px solid ${C.border}` }}>
          {[{v:'100%',l:'Reconciliation accuracy'},{v:'< 2 min',l:'Time to first insight'},{v:'8+',l:'Analytics engines'},{v:'5 min',l:'Setup, no code needed'}].map((s,i) => (
            <div key={i} style={{ textAlign:'center',padding:'0 28px',borderRight:i<3?`1px solid ${C.border}`:'none' }}>
              <div style={{ fontFamily:SERIF,fontSize:26,fontWeight:400,color:C.purple,letterSpacing:'-.02em' }}>{s.v}</div>
              <div style={{ fontFamily:FONT,fontSize:12,color:C.text3,marginTop:2,fontWeight:500 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Social Proof ──────────────────────────────────────────────────────────────
function SocialProof() {
  const isMobile = useIsMobile()
  const quotes = [
    { text:'Finally stopped using 14 spreadsheet tabs for our monthly ARR close.', role:'Head of Finance, B2B SaaS startup' },
    { text:'We cut board pack preparation from 3 days to 20 minutes.', role:'CFO, PE-backed software company' },
    { text:'The waterfall chart alone saved us hours of reconciliation every month.', role:'Revenue Operations Lead' },
  ]
  return (
    <section style={{ background:C.purpleXl,borderTop:`1px solid ${C.purpleMd}`,borderBottom:`1px solid ${C.purpleMd}`,padding:isMobile?'48px 16px':'48px 32px' }}>
      <div style={{ maxWidth:1100,margin:'0 auto' }}>
        <div style={{ textAlign:'center',marginBottom:28 }}>
          <p style={{ fontFamily:FONT,fontSize:12,fontWeight:700,color:C.purple,letterSpacing:'.1em',textTransform:'uppercase',margin:0 }}>Used by finance teams building their revenue stack</p>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)',gap:16 }}>
          {quotes.map((q,i) => (
            <div key={i} style={{ background:C.surface,border:`1px solid ${C.purpleMd}`,borderRadius:14,padding:'22px 24px' }}>
              <div style={{ fontFamily:SERIF,fontSize:32,color:C.purple,lineHeight:1,marginBottom:10 }}>"</div>
              <p style={{ fontFamily:FONT,fontSize:13,color:C.text1,lineHeight:1.65,margin:'0 0 12px',fontStyle:'italic' }}>{q.text}</p>
              <div style={{ fontFamily:FONT,fontSize:11,fontWeight:600,color:C.text3 }}>{q.role}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Product Preview ───────────────────────────────────────────────────────────
function ProductPreview() {
  const isMobileP = useIsMobile()
  const [ref,iv] = useInView()
  return (
    <section id="product" ref={ref} style={{ background:C.dark,padding:isMobileP?'56px 16px':'88px 32px',position:'relative',overflow:'hidden' }}>
      <div aria-hidden style={{ position:'absolute',top:-200,left:'50%',transform:'translateX(-50%)',width:800,height:400,background:`radial-gradient(ellipse,${C.purple}33 0%,transparent 70%)`,pointerEvents:'none' }}/>
      <div style={{ maxWidth:1100,margin:'0 auto',...fadeIn(iv) }}>
        <div style={{ textAlign:'center',marginBottom:48 }}>
          <p style={{ fontFamily:FONT,fontSize:12,fontWeight:700,color:C.purple,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:12 }}>The platform</p>
          <h2 style={{ fontFamily:SERIF,fontSize:38,fontWeight:400,color:'#fff',letterSpacing:'-.02em',margin:0 }}>Built for CFOs. Loved by revenue teams.</h2>
        </div>
        <div style={{ background:'#1A1530',border:'1px solid #2D2650',borderRadius:16,overflow:'hidden',boxShadow:'0 40px 80px rgba(0,0,0,0.6)' }}>
          <div style={{ background:'#120F24',padding:'10px 16px',borderBottom:'1px solid #2D2650',display:'flex',alignItems:'center',gap:8 }}>
            <div style={{ width:10,height:10,borderRadius:'50%',background:'#FF5F56' }}/><div style={{ width:10,height:10,borderRadius:'50%',background:'#FFBD2E' }}/><div style={{ width:10,height:10,borderRadius:'50%',background:'#27C93F' }}/>
            <div style={{ flex:1,background:'#1E1A38',borderRadius:6,height:24,marginLeft:12,display:'flex',alignItems:'center',justifyContent:'center' }}>
              <span style={{ fontFamily:MONO,fontSize:9,color:'#6B6490',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'100%',display:'block' }}>revenuelens.ashwaniandcompany.com/app/command-center</span>
            </div>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:isMobileP?'1fr':'220px 1fr',minHeight:isMobileP?'auto':380 }}>
            <div style={{ background:'#120F24',borderRight:'1px solid #2D2650',padding:16 }}>
              <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:24 }}>
                <div style={{ width:26,height:26,borderRadius:8,background:C.purple,display:'flex',alignItems:'center',justifyContent:'center' }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 13L8 3L14 13H2Z" fill="white"/></svg>
                </div>
                <span style={{ fontFamily:FONT,fontSize:13,fontWeight:700,color:'#fff' }}>RevenueLens</span>
              </div>
              <div style={{ fontSize:9,fontWeight:700,color:'#6B6490',letterSpacing:'.08em',textTransform:'uppercase',fontFamily:FONT,marginBottom:8 }}>Select Engine</div>
              {[{l:'MRR / ARR Analytics',a:true},{l:'ACV Analysis'},{l:'Cohort Analytics'}].map((e,i) => (
                <div key={i} style={{ display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:8,marginBottom:4,background:e.a?`${C.purple}22`:'transparent',border:e.a?`1px solid ${C.purple}44`:'1px solid transparent' }}>
                  <div style={{ width:6,height:6,borderRadius:'50%',background:e.a?C.purple:'#3D3860',flexShrink:0 }}/>
                  <span style={{ fontFamily:FONT,fontSize:11,fontWeight:e.a?600:400,color:e.a?'#C4A8FF':'#6B6490' }}>{e.l}</span>
                </div>
              ))}
              <div style={{ marginTop:16,background:C.purple,borderRadius:8,padding:'10px 0',textAlign:'center',fontFamily:FONT,fontSize:12,fontWeight:600,color:'#fff',boxShadow:'0 4px 12px rgba(107,49,212,0.4)',boxSizing:'border-box',width:'100%' }}>Run Analysis</div>
            </div>
            <div style={{ padding:isMobileP?'16px 12px':20 }}>
              <div style={{ display:'flex',gap:0,borderBottom:'1px solid #2D2650',marginBottom:16,overflowX:'auto',WebkitOverflowScrolling:'touch',scrollbarWidth:'none' }}>
                {['Summary','Detailed Bridge','Historical','Top Movers','KPI Matrix'].map((t,i) => (
                  <div key={i} style={{ padding:'8px 14px',fontFamily:FONT,fontSize:12,fontWeight:i===0?600:400,color:i===0?C.purple:'#6B6490',borderBottom:i===0?`2px solid ${C.purple}`:'2px solid transparent',marginBottom:-1,whiteSpace:'nowrap',flexShrink:0 }}>{t}</div>
                ))}
              </div>
              <div style={{ display:'grid',gridTemplateColumns:isMobileP?'repeat(2,1fr)':'repeat(5,1fr)',gap:8,marginBottom:16 }}>
                {[{l:'Beginning ARR',v:'$10.5M'},{l:'Ending ARR',v:'$11.1M',d:'+5.3%',up:true},{l:'Net Retention',v:'105.3%',d:'+2.1pp',up:true},{l:'Gross Retention',v:'94.7%'},{l:'New Logo ARR',v:'$1.1M',d:'+$1.1M',up:true}].map((k,i) => (
                  <div key={i} style={{ background:'#1E1A38',borderRadius:8,padding:'10px 12px',border:'1px solid #2D2650',gridColumn:isMobileP&&i===4?'1 / -1':'auto' }}>
                    <div style={{ fontFamily:FONT,fontSize:9,color:'#6B6490',fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:4 }}>{k.l}</div>
                    <div style={{ fontFamily:MONO,fontSize:16,fontWeight:700,color:'#fff',letterSpacing:'-.02em' }}>{k.v}</div>
                    {k.d && <div style={{ fontFamily:FONT,fontSize:10,fontWeight:600,color:k.up?C.green:C.red,marginTop:2 }}>{k.d}</div>}
                  </div>
                ))}
              </div>
              <div style={{ display:'grid',gridTemplateColumns:isMobileP?'1fr':'1fr 280px',gap:12 }}>
                <div style={{ background:'#1E1A38',borderRadius:8,padding:'12px 14px',border:'1px solid #2D2650' }}>
                  <div style={{ fontFamily:FONT,fontSize:11,fontWeight:600,color:'#9990B0',marginBottom:12 }}>ARR Bridge — YoY 12M Dec 2025</div>
                  <div style={{ display:'flex',alignItems:'flex-end',gap:5,height:72,overflow:'hidden',width:'100%' }}>
                    {[{h:100,c:'#6B6490',l:'Beg.'},{h:18,c:C.red,l:'Churn'},{h:10,c:C.red,l:'Down'},{h:40,c:C.green,l:'Up'},{h:28,c:C.green,l:'New'},{h:12,c:C.blue,l:'Ret.'},{h:110,c:C.purple,l:'End.'}].map((b,i) => (
                      <div key={i} style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4 }}>
                        <div style={{ width:'100%',height:b.h*0.65,background:b.c,borderRadius:'3px 3px 0 0',minHeight:4 }}/>
                        <span style={{ fontFamily:MONO,fontSize:8,color:'#6B6490' }}>{b.l}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ background:'#1A1130',borderRadius:8,padding:'12px 14px',border:`1px solid ${C.purple}55`,borderLeft:`3px solid ${C.purple}` }}>
                  <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:8 }}>
                    <span style={{ color:C.purple,fontSize:14 }}>✦</span>
                    <span style={{ fontFamily:FONT,fontSize:10,fontWeight:700,color:C.purple,letterSpacing:'.04em' }}>REVENUELENS AI</span>
                  </div>
                  <div style={{ fontFamily:FONT,fontSize:11,fontWeight:600,color:'#E8E0FF',marginBottom:6,lineHeight:1.4 }}>NRR 105.3% — strong expansion quarter</div>
                  <div style={{ fontFamily:FONT,fontSize:11,color:'#9990B0',lineHeight:1.55 }}>Upsell of $832K from 12 accounts drove growth. Churn controlled at $362K below 4% threshold.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Solutions ─────────────────────────────────────────────────────────────────
function Solutions() {
  const isMobileS = useIsMobile()
  const [ref,iv] = useInView()
  const solutions = [
    { slug:'growth',       icon:'📈', label:'Growth',       accent:'#6B31D4', desc:'Understand every driver of revenue growth, expansion, contraction, and churn.' },
    { slug:'customers',    icon:'👥', label:'Customers',     accent:'#2E90FA', desc:'Understand customer health, retention risk, and expansion potential at account level.' },
    { slug:'contracts',    icon:'📋', label:'Contracts',     accent:'#12B76A', desc:'Monitor renewals, commitments, and future revenue obligations across your book.' },
    { slug:'pricing',      icon:'💲', label:'Pricing',       accent:'#F79009', desc:'Evaluate pricing performance and improve monetization across segments.' },
    { slug:'products',     icon:'📦', label:'Products',      accent:'#7C3AED', desc:'Discover which products and bundles drive growth, adoption, and durable revenue.' },
    { slug:'profitability',icon:'💹', label:'Profitability',  accent:'#059669', desc:'Analyze margins, contribution, and value creation across the entire business.' },
    { slug:'retention',    icon:'🔄', label:'Retention',      accent:'#0EA5E9', desc:'Measure customer loyalty and the true sustainability of revenue growth.' },
  ]
  return (
    <section id="solutions" ref={ref} style={{ background:C.surface,padding:isMobileS?'56px 16px':'96px 32px',borderTop:`1px solid ${C.border}` }}>
      <div style={{ maxWidth:1100,margin:'0 auto' }}>
        <div style={{ marginBottom:56,...fadeIn(iv) }}>
          <p style={{ fontFamily:FONT,fontSize:12,fontWeight:700,color:C.purple,letterSpacing:'.1em',textTransform:'uppercase',margin:'0 0 14px' }}>Solutions</p>
          <div style={{ display:'flex',alignItems:'flex-end',justifyContent:isMobileS?'flex-start':'space-between',gap:isMobileS?16:32,flexDirection:isMobileS?'column':'row',flexWrap:'wrap' }}>
            <h2 style={{ fontFamily:SERIF,fontSize:42,fontWeight:400,color:C.text1,letterSpacing:'-.025em',margin:0,lineHeight:1.15,maxWidth:520 }}>Revenue intelligence built around business outcomes.</h2>
            <p style={{ fontFamily:FONT,fontSize:15,color:C.text2,maxWidth:380,lineHeight:1.7,margin:0 }}>Solutions that help organizations accelerate growth, improve retention, optimize pricing, and maximize profitability.</p>
          </div>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:isMobileS?'1fr 1fr':'repeat(4,1fr)',gap:14 }}>
          {solutions.slice(0,4).map((s,i) => (
            <a key={s.slug} href={`/solutions/${s.slug}`}
              style={{ display:'block',textDecoration:'none',background:C.bg,border:`1px solid ${C.border}`,borderRadius:16,padding:'24px 20px',transition:'border-color .18s,box-shadow .18s,transform .18s',...fadeIn(iv,i*0.06) }}
              onMouseEnter={ev=>{ev.currentTarget.style.borderColor=`${s.accent}55`;ev.currentTarget.style.boxShadow=`0 6px 24px ${s.accent}18`;ev.currentTarget.style.transform='translateY(-3px)'}}
              onMouseLeave={ev=>{ev.currentTarget.style.borderColor=C.border;ev.currentTarget.style.boxShadow='none';ev.currentTarget.style.transform='none'}}>
              <div style={{ height:3,borderRadius:2,background:s.accent,marginBottom:18 }}/>
              <div style={{ fontSize:24,marginBottom:12 }}>{s.icon}</div>
              <div style={{ fontFamily:FONT,fontSize:15,fontWeight:700,color:C.text1,marginBottom:8,letterSpacing:'-.01em' }}>{s.label}</div>
              <div style={{ fontFamily:FONT,fontSize:12.5,color:C.text2,lineHeight:1.65,marginBottom:16 }}>{s.desc}</div>
              <div style={{ fontFamily:FONT,fontSize:12,fontWeight:600,color:s.accent,display:'flex',alignItems:'center',gap:5 }}>Explore {s.label} <span>→</span></div>
            </a>
          ))}
        </div>
        <div style={{ display:'grid',gridTemplateColumns:isMobileS?'1fr':'repeat(3,1fr)',gap:14,marginTop:14 }}>
          {solutions.slice(4).map((s,i) => (
            <a key={s.slug} href={`/solutions/${s.slug}`}
              style={{ display:'block',textDecoration:'none',background:C.bg,border:`1px solid ${C.border}`,borderRadius:16,padding:'24px 20px',transition:'border-color .18s,box-shadow .18s,transform .18s',...fadeIn(iv,(i+4)*0.06) }}
              onMouseEnter={ev=>{ev.currentTarget.style.borderColor=`${s.accent}55`;ev.currentTarget.style.boxShadow=`0 6px 24px ${s.accent}18`;ev.currentTarget.style.transform='translateY(-3px)'}}
              onMouseLeave={ev=>{ev.currentTarget.style.borderColor=C.border;ev.currentTarget.style.boxShadow='none';ev.currentTarget.style.transform='none'}}>
              <div style={{ height:3,borderRadius:2,background:s.accent,marginBottom:18 }}/>
              <div style={{ fontSize:24,marginBottom:12 }}>{s.icon}</div>
              <div style={{ fontFamily:FONT,fontSize:15,fontWeight:700,color:C.text1,marginBottom:8,letterSpacing:'-.01em' }}>{s.label}</div>
              <div style={{ fontFamily:FONT,fontSize:12.5,color:C.text2,lineHeight:1.65,marginBottom:16 }}>{s.desc}</div>
              <div style={{ fontFamily:FONT,fontSize:12,fontWeight:600,color:s.accent,display:'flex',alignItems:'center',gap:5 }}>Explore {s.label} <span>→</span></div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── AI Studio ─────────────────────────────────────────────────────────────────
function AIStudio() {
  const isMobileAS = useIsMobile()
  const [ref,iv] = useInView()
  const checks = [
    { live:true,  accent:C.purple, icon:'🔗', title:'Customer Name Consolidation',
      body:'Six-layer similarity engine: Levenshtein · Jaro-Winkler · Soundex · Token Set Ratio · Proper-name boost · Phonetic matching.',
      detail:'Detects "Acme Inc" vs "ACME Corp" vs "Acme Corporation" and consolidates into one canonical entity. Full review table with confidence scores, match method labels, approve/reject per group, inline edit, Trends & Analysis tab.', tag:'Live' },
    { live:false, accent:C.amber,  icon:'🔁', title:'Duplicate Row Detection',
      body:'Identifies exact or near-duplicate records within the same period for the same customer. Prevents double-counting in every downstream analysis.',
      detail:'Shows duplicate pairs with merge/keep options. Handles both exact duplicates and near-matches with configurable threshold.', tag:'Next' },
    { live:false, accent:C.amber,  icon:'📅', title:'Date Gap Analysis',
      body:'Finds missing periods in subscription timelines that cause incorrect churn classification.',
      detail:'A customer missing from March isn\'t churned — they might have had a payment delay. Flags or fills gaps before the bridge engine runs.', tag:'Next' },
    { live:false, accent:C.amber,  icon:'⚠️', title:'Negative Value Flagging',
      body:'Highlights negative ARR/MRR values that may indicate credits, reversals, or data entry errors.',
      detail:'Lets the user decide to exclude, correct, or accept before analysis runs. Never modifies data silently.', tag:'Next' },
    { live:false, accent:C.amber,  icon:'📈', title:'Revenue Smoothing',
      body:'Detects one-time spikes or dips that distort period-over-period trends. Optionally smooths outliers before analysis runs.',
      detail:'User controls what gets smoothed (e.g. annual prepayments). Every transformation is tracked and reversible.', tag:'Next' },
    { live:false, accent:C.text3,  icon:'🔜', title:'More Coming',
      body:'Currency normalization · ARR vs MRR conversion · Timezone reconciliation · Outlier scoring · Manual override layer.',
      detail:'Every check is optional, additive, and non-destructive. The original data is never modified — transformations are tracked and reversible.', tag:'Planned' },
  ]
  return (
    <section id="ai-studio" ref={ref} style={{ background:C.dark,padding:isMobileAS?'56px 16px':'96px 32px',borderTop:'none' }}>
      <div aria-hidden style={{ position:'absolute',pointerEvents:'none',left:'-5%',top:'50%',width:'40%',height:'80%',background:`radial-gradient(ellipse,${C.purple}18 0%,transparent 70%)`,transform:'translateY(-50%)' }}/>
      <div style={{ maxWidth:1100,margin:'0 auto',position:'relative' }}>
        <div style={{ marginBottom:52,...fadeIn(iv) }}>
          <p style={{ fontFamily:FONT,fontSize:12,fontWeight:700,color:'#C4A8FF',letterSpacing:'.1em',textTransform:'uppercase',margin:'0 0 14px' }}>AI Studio Engine</p>
          <div style={{ display:'flex',alignItems:'flex-end',justifyContent:isMobileAS?'flex-start':'space-between',gap:isMobileAS?16:32,flexDirection:isMobileAS?'column':'row',flexWrap:'wrap' }}>
            <h2 style={{ fontFamily:SERIF,fontSize:42,fontWeight:400,color:'#fff',letterSpacing:'-.025em',margin:0,lineHeight:1.15 }}>Enterprise-grade data preparation<br/>before any analysis runs.</h2>
            <p style={{ fontFamily:FONT,fontSize:15,color:'rgba(255,255,255,0.5)',maxWidth:380,lineHeight:1.7,margin:0 }}>The output is only as good as the input. AI Studio runs a full intelligent quality suite before classification begins.</p>
          </div>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:isMobileAS?'1fr':'repeat(3,1fr)',gap:16 }}>
          {checks.map((c,i) => (
            <div key={i} style={{ background:'#1A1530',border:`1px solid ${c.live?`${C.purple}55`:'#2D2650'}`,borderRadius:16,padding:'24px 22px',display:'flex',flexDirection:'column',transition:'border-color .18s,box-shadow .18s',...fadeIn(iv,i*0.06) }}
              onMouseEnter={ev=>{ev.currentTarget.style.borderColor=c.live?`${C.purple}88`:'#3D3660';ev.currentTarget.style.boxShadow=`0 8px 28px rgba(107,49,212,0.15)`}}
              onMouseLeave={ev=>{ev.currentTarget.style.borderColor=c.live?`${C.purple}55`:'#2D2650';ev.currentTarget.style.boxShadow='none'}}>
              {/* Accent line */}
              <div style={{ height:3,borderRadius:2,background:c.accent,marginBottom:18 }}/>
              <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:12 }}>
                <span style={{ fontSize:18 }}>{c.icon}</span>
                <span style={{ fontFamily:FONT,fontSize:13,fontWeight:700,color:'#fff' }}>{c.title}</span>
              </div>
              <div style={{ fontFamily:FONT,fontSize:12,color:'#9990B0',lineHeight:1.65,marginBottom:10 }}>{c.body}</div>
              <div style={{ fontFamily:FONT,fontSize:11.5,color:'rgba(255,255,255,0.35)',lineHeight:1.6,flex:1 }}>{c.detail}</div>
              <div style={{ marginTop:16 }}>
                <span style={{ fontFamily:FONT,fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:99,
                  background: c.tag==='Live'?`${C.green}22`:c.tag==='Next'?`${C.amber}22`:'rgba(255,255,255,0.06)',
                  color: c.tag==='Live'?C.green:c.tag==='Next'?C.amber:C.text3,
                  border: `1px solid ${c.tag==='Live'?`${C.green}44`:c.tag==='Next'?`${C.amber}44`:'rgba(255,255,255,0.1)'}` }}>{c.tag}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── AI Intelligence Layer ─────────────────────────────────────────────────────
function AISection() {
  const isMobileAI = useIsMobile()
  const [ref,iv] = useInView()
  const [active, setActive] = useState(0)
  const caps = [
    { icon:'📈', label:'AI Insights',      accent:C.purple, hl:'What changed and why — automatically',
      detail:'After every analysis run, RevenueLens AI generates a structured executive narrative. What moved. What caused it. What it means.',
      preview:{ q:null, a:'NRR 105.3% this quarter — driven by $832K upsell from 12 expansion accounts. Churn held at $362K, below the 4% threshold. Gross retention: 94.7%.' }},
    { icon:'💬', label:'AI Consultant',    accent:C.blue,   hl:'Ask anything about your data',
      detail:'Not generic AI. Every answer is grounded in your actual verified revenue data. Ask about customers, products, time periods.',
      preview:{ q:'Why did NRR drop in Q3?', a:'Q3 NRR fell to 98.4% from 107.2% in Q2. Primary driver: $421K downsell from 3 Enterprise accounts reducing seats post-renewal. New logo at $198K vs $340K prior quarter.' }},
    { icon:'🎓', label:'AI Educator',      accent:C.green,  hl:'Teaches metrics in plain English',
      detail:'New to NRR? Never modeled a cohort? RevenueLens AI explains every metric in plain English — always in context of your own data.',
      preview:{ q:'What is NRR and is mine good?', a:'NRR measures revenue kept and grown from existing customers. Above 100% means you grow without new customers. Your 105.3% is top quartile — healthy SaaS benchmark is 100–110%.' }},
    { icon:'🎯', label:'Decision Advisor', accent:C.amber,  hl:'Tells you exactly what to do next',
      detail:'Beyond explaining what happened, RevenueLens AI surfaces specific actions — which customers to call, where to focus.',
      preview:{ q:null, a:'Action 1: Call accounts A-119, A-203, A-341 — all show expansion signals with seat usage above 85%. Upsell opportunity: $280K ARR.\n\nAction 2: SMB cohort at month 6 shows 23% churn. Run proactive check-in at month 5.' }},
  ]
  const cur = caps[active]
  return (
    <section id="ai-section" ref={ref} style={{ background:C.surface,padding:isMobileAI?'56px 16px':'96px 32px',borderTop:`1px solid ${C.border}` }}>
      <div style={{ maxWidth:1100,margin:'0 auto' }}>
        <div style={{ textAlign:'center',marginBottom:56,...fadeIn(iv) }}>
          <p style={{ fontFamily:FONT,fontSize:12,fontWeight:700,color:C.purple,letterSpacing:'.1em',textTransform:'uppercase',margin:'0 0 14px' }}>AI Intelligence Layer</p>
          <h2 style={{ fontFamily:SERIF,fontSize:42,fontWeight:400,color:C.text1,letterSpacing:'-.025em',margin:'0 0 14px',lineHeight:1.15 }}>Analyzes. Explains. Teaches. Advises.</h2>
          <p style={{ fontFamily:FONT,fontSize:16,color:C.text2,maxWidth:560,margin:'0 auto',lineHeight:1.7 }}>Most tools show charts. RevenueLens AI understands your revenue and tells you exactly what to do about it. Every answer is grounded in your actual verified data.</p>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:isMobileAI?'1fr':'1fr 1fr',gap:isMobileAI?32:64,alignItems:'center' }}>
          {/* Tabs */}
          <div style={{ ...fadeIn(iv,0.1) }}>
            <div style={{ display:'flex',flexDirection:'column',gap:10,marginBottom:24 }}>
              {caps.map((c,i) => (
                <button key={i} onClick={()=>setActive(i)} style={{ display:'flex',alignItems:'center',gap:14,padding:'14px 16px',borderRadius:12,cursor:'pointer',textAlign:'left',
                  border:`1px solid ${active===i?c.accent+'55':C.border}`,
                  background:active===i?`${c.accent}0A`:'transparent',
                  transition:'all .15s',fontFamily:FONT }}>
                  <span style={{ fontSize:20,flexShrink:0 }}>{c.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14,fontWeight:700,color:active===i?c.accent:C.text1,marginBottom:2 }}>{c.label}</div>
                    <div style={{ fontSize:11.5,color:C.text3 }}>{c.hl}</div>
                  </div>
                  {active===i && <span style={{ color:c.accent,fontSize:16,fontWeight:300 }}>→</span>}
                </button>
              ))}
            </div>
            <p style={{ fontFamily:FONT,fontSize:13,color:C.text2,lineHeight:1.7,margin:0,paddingLeft:4 }}>{cur.detail}</p>
          </div>
          {/* Chat preview */}
          <div style={{ ...fadeIn(iv,0.2) }}>
            <div style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:20,overflow:'hidden',boxShadow:'0 8px 32px rgba(0,0,0,0.06)' }}>
              {/* Header */}
              <div style={{ padding:'14px 18px',borderBottom:`1px solid ${C.border}`,background:C.surface,display:'flex',alignItems:'center',gap:10 }}>
                <div style={{ width:32,height:32,borderRadius:10,background:C.purple,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                  <span style={{ color:'#fff',fontSize:14 }}>✦</span>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:FONT,fontSize:13,fontWeight:700,color:C.text1 }}>RevenueLens AI</div>
                  <div style={{ fontFamily:FONT,fontSize:11,color:C.text3 }}>{cur.label}</div>
                </div>
                <div style={{ display:'flex',alignItems:'center',gap:5 }}>
                  <div style={{ width:7,height:7,borderRadius:'50%',background:C.green }}/>
                  <span style={{ fontFamily:FONT,fontSize:10,color:C.text3,fontWeight:500 }}>Live</span>
                </div>
              </div>
              {/* Messages */}
              <div style={{ padding:'20px 18px',minHeight:210,display:'flex',flexDirection:'column',gap:12 }}>
                {cur.preview.q && (
                  <div style={{ display:'flex',justifyContent:'flex-end' }}>
                    <div style={{ background:C.purple,color:'#fff',borderRadius:'14px 14px 3px 14px',padding:'10px 14px',maxWidth:'82%',fontFamily:FONT,fontSize:13,lineHeight:1.55 }}>{cur.preview.q}</div>
                  </div>
                )}
                <div style={{ display:'flex',gap:10,alignItems:'flex-start' }}>
                  <div style={{ width:28,height:28,borderRadius:9,background:C.purpleXl,border:`1px solid ${C.purpleMd}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2 }}>
                    <span style={{ fontSize:12 }}>✦</span>
                  </div>
                  <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:'3px 14px 14px 14px',padding:'12px 14px',fontFamily:FONT,fontSize:13,color:C.text1,lineHeight:1.65,whiteSpace:'pre-line' }}>{cur.preview.a}</div>
                </div>
              </div>
              {/* Input */}
              <div style={{ padding:'12px 14px',borderTop:`1px solid ${C.border}`,background:C.surface,display:'flex',gap:8 }}>
                <div style={{ flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:'9px 12px',fontFamily:FONT,fontSize:12,color:C.text3 }}>Ask about your revenue…</div>
                <div style={{ width:36,height:36,borderRadius:10,background:C.purple,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,boxShadow:'0 2px 8px rgba(107,49,212,0.3)' }}>
                  <span style={{ color:'#fff',fontSize:15 }}>→</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Comparison ────────────────────────────────────────────────────────────────
function ComparisonTable() {
  const isMobileCT = useIsMobile()
  const [ref,iv] = useInView()
  const rows = [
    { cap:'Analyzes your revenue data',             rl:true,  tb:true,  gpt:false,     con:false },
    { cap:'100% reconciled output guaranteed',      rl:true,  tb:false, gpt:false,     con:false },
    { cap:'Classifies every movement (churn/upsell)',rl:true, tb:false, gpt:false,     con:true  },
    { cap:'Uses your actual real data',             rl:true,  tb:true,  gpt:false,     con:true  },
    { cap:'Explains what happened and why',         rl:true,  tb:false, gpt:'partial', con:true  },
    { cap:'Teaches your metrics in context',        rl:true,  tb:false, gpt:'partial', con:false },
    { cap:'Recommends specific next actions',       rl:true,  tb:false, gpt:'partial', con:true  },
    { cap:'Available instantly, 24/7',              rl:true,  tb:true,  gpt:true,      con:false },
    { cap:'Costs under $1,000 per month',           rl:true,  tb:false, gpt:true,      con:false },
  ]
  const Cell = ({v}) => {
    if(v===true)  return <span style={{ color:C.green, fontSize:17, fontWeight:700 }}>✓</span>
    if(v===false) return <span style={{ color:C.borderMd, fontSize:16 }}>—</span>
    return <span style={{ fontFamily:FONT,fontSize:10,fontWeight:600,color:C.amber,background:'#FFFBEB',padding:'2px 8px',borderRadius:99 }}>partial</span>
  }
  return (
    <section ref={ref} style={{ background:C.bg,padding:isMobileCT?'56px 16px':'96px 32px',borderTop:`1px solid ${C.border}` }}>
      <div style={{ maxWidth:900,margin:'0 auto' }}>
        <div style={{ textAlign:'center',marginBottom:52,...fadeIn(iv) }}>
          <p style={{ fontFamily:FONT,fontSize:12,fontWeight:700,color:C.purple,letterSpacing:'.1em',textTransform:'uppercase',margin:'0 0 14px' }}>Why RevenueLens</p>
          <h2 style={{ fontFamily:SERIF,fontSize:40,fontWeight:400,color:C.text1,letterSpacing:'-.025em',margin:0 }}>Nothing else does all of this.</h2>
        </div>
        <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,overflow:'hidden',boxShadow:'0 4px 20px rgba(0,0,0,0.04)',...fadeIn(iv,0.1) }}>
          <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr',background:C.bg,borderBottom:`1px solid ${C.border}` }}>
            <div style={{ padding:'13px 20px' }}/>
            {['RevenueLens','Tableau / BI','ChatGPT','Consultants'].map((col,i) => (
              <div key={i} style={{ padding:'13px 12px',textAlign:'center',borderLeft:`1px solid ${C.border}`,background:i===0?C.purpleXl:'transparent' }}>
                <span style={{ fontFamily:FONT,fontSize:12,fontWeight:700,color:i===0?C.purple:C.text2 }}>{col}</span>
              </div>
            ))}
          </div>
          {rows.map((r,ri) => (
            <div key={ri} style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr',borderBottom:ri<rows.length-1?`1px solid ${C.bg}`:'none' }}>
              <div style={{ padding:'12px 20px',fontFamily:FONT,fontSize:13,color:C.text1,fontWeight:500 }}>{r.cap}</div>
              {[r.rl,r.tb,r.gpt,r.con].map((v,ci) => (
                <div key={ci} style={{ padding:'12px',textAlign:'center',borderLeft:`1px solid ${C.bg}`,background:ci===0?`${C.purpleXl}88`:'transparent',display:'flex',alignItems:'center',justifyContent:'center' }}>
                  <Cell v={v}/>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Pricing ───────────────────────────────────────────────────────────────────
function Pricing({ onStart }) {
  const isMobilePR = useIsMobile()
  const [ref,iv] = useInView()
  const plans = [
    { name:'Starter', price:'$299', desc:'For growing finance teams starting with ARR analytics.', popular:false, cta:'Start free trial',
      features:['MRR / ARR bridge analytics','Up to 5M rows per month','3 users included','Data cube download','AI Studio engine','Email support'] },
    { name:'Growth',  price:'$799', desc:'For teams who need the full platform and AI layer.', popular:true, cta:'Start free trial',
      features:['All 8 analytics engines','Unlimited rows','10 users included','AI Insights + Consultant + Educator','Board pack generation','Slack alerts'] },
    { name:'Enterprise', price:'$2,500', desc:'For PE firms, large teams, and portfolio oversight.', popular:false, cta:'Talk to sales',
      features:['Everything in Growth','Unlimited users','SSO + audit logs','Dedicated CSM','SLA 99.9% uptime','Custom contract'] },
  ]
  return (
    <section id="pricing" ref={ref} style={{ background:C.surface,padding:isMobilePR?'56px 16px':'96px 32px',borderTop:`1px solid ${C.border}` }}>
      <div style={{ maxWidth:1000,margin:'0 auto' }}>
        <div style={{ textAlign:'center',marginBottom:56,...fadeIn(iv) }}>
          <p style={{ fontFamily:FONT,fontSize:12,fontWeight:700,color:C.purple,letterSpacing:'.1em',textTransform:'uppercase',margin:'0 0 14px' }}>Pricing</p>
          <h2 style={{ fontFamily:SERIF,fontSize:40,fontWeight:400,color:C.text1,letterSpacing:'-.025em',margin:'0 0 12px' }}>Simple pricing. Serious value.</h2>
          <p style={{ fontFamily:FONT,fontSize:15,color:C.text2 }}>All plans include AI Studio, data cube, classification engine, and AI layer.</p>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:isMobilePR?'1fr':'repeat(3,1fr)',gap:16 }}>
          {plans.map((p,i) => (
            <div key={i} style={{ background:C.bg,border:`${p.popular?'2px':'1px'} solid ${p.popular?C.purple:C.border}`,borderRadius:18,padding:'30px 26px',position:'relative',boxShadow:p.popular?'0 8px 36px rgba(107,49,212,0.15)':'0 1px 4px rgba(0,0,0,0.04)',...fadeIn(iv,i*0.1) }}>
              {p.popular && <div style={{ position:'absolute',top:-14,left:'50%',transform:'translateX(-50%)',background:C.purple,color:'#fff',borderRadius:99,padding:'4px 18px',fontFamily:FONT,fontSize:11,fontWeight:700,whiteSpace:'nowrap',letterSpacing:'.02em' }}>Most popular</div>}
              <div style={{ fontFamily:FONT,fontSize:15,fontWeight:700,color:C.text1,marginBottom:6 }}>{p.name}</div>
              <div style={{ display:'flex',alignItems:'baseline',gap:4,marginBottom:8 }}>
                <span style={{ fontFamily:SERIF,fontSize:38,fontWeight:400,color:p.popular?C.purple:C.text1,letterSpacing:'-.02em' }}>{p.price}</span>
                <span style={{ fontFamily:FONT,fontSize:13,color:C.text3 }}>/mo</span>
              </div>
              <div style={{ fontFamily:FONT,fontSize:13,color:C.text2,lineHeight:1.55,marginBottom:22 }}>{p.desc}</div>
              <button onClick={p.cta==='Talk to sales'?()=>window.location.href='mailto:ashwani.enrichai@gmail.com?subject=RevenueLens Enterprise Enquiry':onStart}
                style={{ width:'100%',padding:'11px 0',borderRadius:10,border:`1px solid ${p.popular?'transparent':C.borderMd}`,background:p.popular?C.purple:C.surface,color:p.popular?'#fff':C.text1,fontFamily:FONT,fontSize:13,fontWeight:600,cursor:'pointer',marginBottom:20,boxShadow:p.popular?'0 4px 14px rgba(107,49,212,0.3)':'none',transition:'all .15s' }}>
                {p.cta}
              </button>
              <div style={{ display:'flex',flexDirection:'column',gap:9 }}>
                {p.features.map((f,fi) => (
                  <div key={fi} style={{ display:'flex',gap:8,alignItems:'flex-start',fontFamily:FONT,fontSize:13,color:C.text2 }}>
                    <span style={{ color:C.green,flexShrink:0,fontSize:13,marginTop:1 }}>✓</span>{f}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p style={{ textAlign:'center',marginTop:28,fontFamily:FONT,fontSize:13,color:C.text3 }}>
          PE portfolio or multi-company?{' '}
          <a href="mailto:ashwani.enrichai@gmail.com?subject=RevenueLens Custom Pricing" style={{ color:C.purple,fontWeight:600,textDecoration:'none' }}>Talk to us about custom pricing</a>
        </p>
      </div>
    </section>
  )
}

// ── Final CTA ─────────────────────────────────────────────────────────────────
function FinalCTA({ onStart }) {
  return (
    <section style={{ background:C.purple,padding:'88px 32px',position:'relative',overflow:'hidden' }}>
      <div aria-hidden style={{ position:'absolute',top:-100,left:'50%',transform:'translateX(-50%)',width:600,height:300,background:'radial-gradient(ellipse,rgba(255,255,255,0.12) 0%,transparent 70%)',pointerEvents:'none' }}/>
      <div style={{ maxWidth:640,margin:'0 auto',textAlign:'center',position:'relative' }}>
        <div style={{ fontFamily:FONT,fontSize:36,marginBottom:20,lineHeight:1,color:'#fff' }}>✦</div>
        <h2 style={{ fontFamily:SERIF,fontSize:44,fontWeight:400,color:'#fff',letterSpacing:'-.025em',margin:'0 0 18px',lineHeight:1.15 }}>The window is now.</h2>
        <p style={{ fontFamily:FONT,fontSize:17,color:'rgba(255,255,255,0.72)',lineHeight:1.7,margin:'0 0 40px' }}>No dominant player owns this space yet. The CFO who logs into RevenueLens every morning makes better decisions, faster.</p>
        <div style={{ display:'flex',justifyContent:'center',gap:12,flexWrap:'wrap' }}>
          <button onClick={onStart} style={{ background:'#fff',color:C.purple,border:'none',borderRadius:10,padding:'14px 30px',fontFamily:FONT,fontSize:15,fontWeight:700,cursor:'pointer',boxShadow:'0 4px 16px rgba(0,0,0,0.15)',transition:'all .18s' }}
            onMouseEnter={e=>e.target.style.transform='translateY(-2px)'}
            onMouseLeave={e=>e.target.style.transform=''}>Start free — no card required</button>
          <button onClick={()=>window.location.href='mailto:ashwani.enrichai@gmail.com?subject=RevenueLens Demo Request'}
            style={{ background:'rgba(255,255,255,0.14)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)',borderRadius:10,padding:'14px 24px',fontFamily:FONT,fontSize:15,fontWeight:500,cursor:'pointer' }}>Book a demo</button>
        </div>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  const isMobileF = useIsMobile()
  const links = [
    { head:'Product', items:[{l:'Engines',href:'#engines'},{l:'AI Studio',href:'#ai-studio'},{l:'AI Layer',href:'#ai-section'},{l:'Pricing',href:'#pricing'}] },
    { head:'Company', items:[{l:'About',href:'mailto:ashwani.enrichai@gmail.com'},{l:'Consulting',href:'/consulting'},{l:'Contact',href:'mailto:ashwani.enrichai@gmail.com'},{l:'Book a demo',href:'mailto:ashwani.enrichai@gmail.com?subject=RevenueLens Demo Request'}] },
    { head:'Platform', items:[{l:'Sign in',href:'/auth/login'},{l:'Get started',href:'/auth/login'},{l:'Dashboard',href:'/dashboard'}] },
    { head:'Legal', items:[{l:'Privacy',href:'#'},{l:'Terms',href:'#'}] },
  ]
  return (
    <footer style={{ background:C.text1,padding:'60px 32px 28px' }}>
      <div style={{ maxWidth:1100,margin:'0 auto' }}>
        <div style={{ display:'grid',gridTemplateColumns:isMobileF?'1fr 1fr':'2fr 1fr 1fr 1fr 1fr',gap:isMobileF?24:48,marginBottom:48 }}>
          <div>
            <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:14 }}>
              <div style={{ width:28,height:28,borderRadius:8,background:C.purple,display:'flex',alignItems:'center',justifyContent:'center' }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 13L8 3L14 13H2Z" fill="white"/></svg>
              </div>
              <span style={{ fontFamily:FONT,fontSize:14,fontWeight:700,color:'#fff' }}>RevenueLens</span>
            </div>
            <p style={{ fontFamily:FONT,fontSize:13,color:'rgba(255,255,255,0.38)',lineHeight:1.65,margin:'0 0 14px',maxWidth:220 }}>The system that understands your revenue and tells you what to do next.</p>
            <a href="mailto:ashwani.enrichai@gmail.com" style={{ fontFamily:FONT,fontSize:12,color:'rgba(255,255,255,0.35)',textDecoration:'none' }}>ashwani.enrichai@gmail.com</a>
          </div>
          {links.map((col,i) => (
            <div key={i}>
              <div style={{ fontFamily:FONT,fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.35)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:14 }}>{col.head}</div>
              {col.items.map(item => (
                <a key={item.l} href={item.href}
                  onClick={item.href.startsWith('#')?e=>{e.preventDefault();scrollTo(item.href.slice(1))}:undefined}
                  style={{ display:'block',fontFamily:FONT,fontSize:13,color:'rgba(255,255,255,0.45)',textDecoration:'none',marginBottom:8,transition:'color .15s' }}
                  onMouseEnter={e=>e.target.style.color='rgba(255,255,255,0.82)'}
                  onMouseLeave={e=>e.target.style.color='rgba(255,255,255,0.45)'}>{item.l}</a>
              ))}
            </div>
          ))}
        </div>
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)',paddingTop:22,display:'flex',justifyContent:'space-between',alignItems:'center',flexDirection:isMobileF?'column':'row',gap:isMobileF?12:0,textAlign:isMobileF?'center':'left' }}>
          <span style={{ fontFamily:FONT,fontSize:12,color:'rgba(255,255,255,0.22)' }}>© 2026 RevenueLens. All rights reserved.</span>
          <span style={{ fontFamily:FONT,fontSize:12,color:'rgba(255,255,255,0.22)' }}>Built for CFOs who want answers, not charts.</span>
        </div>
      </div>
    </footer>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter()
  const go = () => router.push('/auth/login')
  return (
    <>
      <Head>
        <title>RevenueLens — The Revenue Decision Platform</title>
        <meta name="description" content="From raw data to real decisions. RevenueLens analyzes your revenue, explains what happened, teaches your metrics, and tells you what to do next."/>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
      </Head>
      <div style={{ background:C.bg,overflowX:'hidden' }}>
        <Nav onLogin={go} onStart={go}/>
        <Hero onStart={go}/>
        <SocialProof/>
        <ProductPreview/>
        <Solutions/>
        <AIStudio/>
        <AISection/>
        <ComparisonTable/>
        <Pricing onStart={go}/>
        <FinalCTA onStart={go}/>
        <Footer/>
      </div>
    </>
  )
}
