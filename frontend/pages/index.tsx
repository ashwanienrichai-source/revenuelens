// @ts-nocheck
/**
 * pages/index.tsx — RevenueLens Landing Page
 * Deploy to: frontend/pages/index.tsx
 * Pure addition. Zero changes to existing product.
 * All CTAs route to /auth/login
 */

import React, { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

const C = {
  bg:'#F8F7FC',surface:'#FFFFFF',purple:'#6B31D4',purple2:'#5A28B4',
  purpleXl:'#F0EBFF',purpleMd:'#E0D5FF',text1:'#0F0A1E',text2:'#4C4668',
  text3:'#9990B0',border:'#E8E4F2',borderMd:'#D0C9E8',green:'#12B76A',
  greenBg:'#ECFDF3',red:'#F04438',amber:'#F79009',blue:'#2E90FA',
}
const FONT  = "'DM Sans','Helvetica Neue',Arial,sans-serif"
const SERIF = "'DM Serif Display',Georgia,serif"
const MONO  = "'DM Mono','Fira Code',monospace"

function useInView() {
  const ref = useRef(null)
  const [v, setV] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); obs.disconnect() } }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, v]
}

const fadeIn = (v, d=0) => ({ opacity: v?1:0, transform: v?'none':'translateY(20px)', transition: `opacity 0.65s ease ${d}s, transform 0.65s ease ${d}s` })

function Nav({ onLogin, onStart }) {
  const [sc, setSc] = useState(false)
  useEffect(() => { const fn = () => setSc(window.scrollY>40); window.addEventListener('scroll',fn,{passive:true}); return ()=>window.removeEventListener('scroll',fn) },[])
  return (
    <header style={{ position:'fixed',top:0,left:0,right:0,zIndex:1000, background:sc?'rgba(248,247,252,0.88)':'transparent', backdropFilter:sc?'blur(16px)':'none', borderBottom:sc?`1px solid ${C.border}`:'1px solid transparent', transition:'all 0.3s' }}>
      <div style={{ maxWidth:1200,margin:'0 auto',padding:'0 32px',height:64,display:'flex',alignItems:'center',gap:48 }}>
        <div style={{ display:'flex',alignItems:'center',gap:10,flexShrink:0 }}>
          <div style={{ width:32,height:32,borderRadius:10,background:C.purple,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 8px rgba(107,49,212,0.4)' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 13L8 3L14 13H2Z" fill="white" fillOpacity="0.95"/><path d="M5.5 13L8 8.5L10.5 13H5.5Z" fill="white" fillOpacity="0.5"/></svg>
          </div>
          <span style={{ fontFamily:FONT,fontSize:16,fontWeight:700,color:C.text1,letterSpacing:'-0.02em' }}>RevenueLens</span>
        </div>
        <nav style={{ display:'flex',gap:32,flex:1 }}>
          {['Product','How it works','Pricing','Docs'].map(l=>(
            <a key={l} href="#" style={{ fontFamily:FONT,fontSize:14,fontWeight:500,color:C.text2,textDecoration:'none',transition:'color 0.15s' }} onMouseEnter={e=>e.target.style.color=C.purple} onMouseLeave={e=>e.target.style.color=C.text2}>{l}</a>
          ))}
        </nav>
        <div style={{ display:'flex',alignItems:'center',gap:12 }}>
          <button onClick={onLogin} style={{ background:'none',border:'none',cursor:'pointer',fontFamily:FONT,fontSize:14,fontWeight:500,color:C.text2,padding:'8px 12px' }}>Sign in</button>
          <button onClick={onStart} style={{ background:C.purple,color:'#fff',border:'none',borderRadius:9,padding:'9px 20px',fontFamily:FONT,fontSize:14,fontWeight:600,cursor:'pointer',boxShadow:'0 1px 2px rgba(107,49,212,0.3)',transition:'all 0.18s' }} onMouseEnter={e=>{e.target.style.background=C.purple2;e.target.style.boxShadow='0 4px 14px rgba(107,49,212,0.45)'}} onMouseLeave={e=>{e.target.style.background=C.purple;e.target.style.boxShadow='0 1px 2px rgba(107,49,212,0.3)'}}>Get started free</button>
        </div>
      </div>
    </header>
  )
}

function Hero({ onStart }) {
  const words = ['ARR bridge','cohort analysis','AI insights','retention trends','ACV analysis','revenue decisions']
  const [wi, setWi] = useState(0)
  const [fd, setFd] = useState(true)
  useEffect(() => {
    const t = setInterval(()=>{ setFd(false); setTimeout(()=>{ setWi(p=>(p+1)%words.length); setFd(true) },280) },2200)
    return ()=>clearInterval(t)
  },[])
  return (
    <section style={{ minHeight:'100vh',background:`radial-gradient(ellipse 80% 55% at 50% -5%, ${C.purpleMd} 0%, ${C.bg} 65%)`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'120px 32px 80px',position:'relative',overflow:'hidden' }}>
      <div aria-hidden style={{ position:'absolute',inset:0,pointerEvents:'none',backgroundImage:`linear-gradient(${C.borderMd}44 1px,transparent 1px),linear-gradient(90deg,${C.borderMd}44 1px,transparent 1px)`,backgroundSize:'60px 60px',maskImage:'radial-gradient(ellipse 80% 55% at 50% 0%,black 0%,transparent 70%)',WebkitMaskImage:'radial-gradient(ellipse 80% 55% at 50% 0%,black 0%,transparent 70%)' }}/>
      <div style={{ maxWidth:820,textAlign:'center',position:'relative' }}>
        <div style={{ display:'inline-flex',alignItems:'center',gap:7,background:C.surface,border:`1px solid ${C.borderMd}`,borderRadius:99,padding:'5px 14px 5px 8px',marginBottom:32 }}>
          <span style={{ background:C.purple,color:'#fff',borderRadius:99,fontSize:10,fontWeight:700,padding:'2px 8px',fontFamily:FONT,letterSpacing:'0.04em' }}>NEW</span>
          <span style={{ fontFamily:FONT,fontSize:13,fontWeight:500,color:C.text2 }}>AI Consultant now live — ask anything about your revenue</span>
        </div>
        <h1 style={{ fontFamily:SERIF,fontSize:'clamp(44px,6vw,72px)',fontWeight:400,color:C.text1,lineHeight:1.1,letterSpacing:'-0.025em',margin:'0 0 14px' }}>
          Your revenue data,{' '}<em style={{ fontStyle:'italic',color:C.purple }}>finally</em>{' '}understood.
        </h1>
        <p style={{ fontFamily:FONT,fontSize:20,fontWeight:400,color:C.text2,lineHeight:1.6,margin:'0 0 40px',maxWidth:600,marginLeft:'auto',marginRight:'auto' }}>
          Upload any revenue data. Get instant{' '}
          <span style={{ color:C.purple,fontWeight:600,opacity:fd?1:0,transition:'opacity 0.28s',display:'inline-block' }}>{words[wi]}</span>
          {' '}powered by an AI that explains, teaches, and advises.
        </p>
        <div style={{ display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap' }}>
          <button onClick={onStart} style={{ background:C.purple,color:'#fff',border:'none',borderRadius:10,padding:'14px 32px',fontFamily:FONT,fontSize:16,fontWeight:600,cursor:'pointer',boxShadow:'0 4px 20px rgba(107,49,212,0.35)',transition:'all 0.18s' }} onMouseEnter={e=>{e.target.style.transform='translateY(-2px)';e.target.style.boxShadow='0 8px 28px rgba(107,49,212,0.45)'}} onMouseLeave={e=>{e.target.style.transform='';e.target.style.boxShadow='0 4px 20px rgba(107,49,212,0.35)'}}>Start for free →</button>
          <button style={{ background:C.surface,color:C.text1,border:`1px solid ${C.border}`,borderRadius:10,padding:'14px 28px',fontFamily:FONT,fontSize:16,fontWeight:500,cursor:'pointer',transition:'all 0.18s' }} onMouseEnter={e=>{e.target.style.borderColor=C.borderMd;e.target.style.boxShadow='0 4px 12px rgba(0,0,0,0.07)'}} onMouseLeave={e=>{e.target.style.borderColor=C.border;e.target.style.boxShadow='none'}}>Watch 2-min demo</button>
        </div>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:28,marginTop:52,paddingTop:36,borderTop:`1px solid ${C.border}` }}>
          {[{v:'100%',l:'Reconciliation accuracy'},{v:'< 2 min',l:'Time to first insight'},{v:'8+',l:'Analytics engines'},{v:'SOC 2',l:'Compliance ready'}].map((s,i)=>(
            <div key={i} style={{ textAlign:'center',paddingRight:i<3?28:0,borderRight:i<3?`1px solid ${C.border}`:'none' }}>
              <div style={{ fontFamily:SERIF,fontSize:26,fontWeight:400,color:C.purple,letterSpacing:'-0.02em' }}>{s.v}</div>
              <div style={{ fontFamily:FONT,fontSize:12,color:C.text3,marginTop:2,fontWeight:500 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ProductPreview() {
  const [ref,iv] = useInView()
  return (
    <section ref={ref} style={{ background:C.text1,padding:'80px 32px',position:'relative',overflow:'hidden' }}>
      <div aria-hidden style={{ position:'absolute',top:-200,left:'50%',transform:'translateX(-50%)',width:800,height:400,background:`radial-gradient(ellipse,${C.purple}33 0%,transparent 70%)`,pointerEvents:'none' }}/>
      <div style={{ maxWidth:1100,margin:'0 auto',...fadeIn(iv) }}>
        <div style={{ textAlign:'center',marginBottom:48 }}>
          <p style={{ fontFamily:FONT,fontSize:13,fontWeight:600,color:C.purple,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:12 }}>The platform</p>
          <h2 style={{ fontFamily:SERIF,fontSize:38,fontWeight:400,color:'#fff',letterSpacing:'-0.02em',margin:0 }}>Built for CFOs. Loved by revenue teams.</h2>
        </div>
        <div style={{ background:'#1A1530',border:'1px solid #2D2650',borderRadius:16,overflow:'hidden',boxShadow:'0 40px 80px rgba(0,0,0,0.6)' }}>
          <div style={{ background:'#120F24',padding:'10px 16px',borderBottom:'1px solid #2D2650',display:'flex',alignItems:'center',gap:8 }}>
            <div style={{ width:10,height:10,borderRadius:'50%',background:'#FF5F56' }}/><div style={{ width:10,height:10,borderRadius:'50%',background:'#FFBD2E' }}/><div style={{ width:10,height:10,borderRadius:'50%',background:'#27C93F' }}/>
            <div style={{ flex:1,background:'#1E1A38',borderRadius:6,height:24,marginLeft:12,display:'flex',alignItems:'center',justifyContent:'center' }}>
              <span style={{ fontFamily:MONO,fontSize:10,color:'#6B6490' }}>revenuelens.ai/app/command-center</span>
            </div>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'220px 1fr',minHeight:400 }}>
            <div style={{ background:'#120F24',borderRight:'1px solid #2D2650',padding:16 }}>
              <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:24 }}>
                <div style={{ width:26,height:26,borderRadius:8,background:C.purple,display:'flex',alignItems:'center',justifyContent:'center' }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 13L8 3L14 13H2Z" fill="white"/></svg>
                </div>
                <span style={{ fontFamily:FONT,fontSize:13,fontWeight:700,color:'#fff' }}>RevenueLens</span>
              </div>
              <div style={{ fontSize:9,fontWeight:700,color:'#6B6490',letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:FONT,marginBottom:8 }}>Select Engine</div>
              {[{l:'MRR / ARR Analytics',a:true},{l:'ACV Analysis'},{l:'Cohort Analytics'}].map((e,i)=>(
                <div key={i} style={{ display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:8,marginBottom:4,background:e.a?`${C.purple}22`:'transparent',border:e.a?`1px solid ${C.purple}44`:'1px solid transparent' }}>
                  <div style={{ width:6,height:6,borderRadius:'50%',background:e.a?C.purple:'#3D3860',flexShrink:0 }}/>
                  <span style={{ fontFamily:FONT,fontSize:11,fontWeight:e.a?600:400,color:e.a?'#C4A8FF':'#6B6490' }}>{e.l}</span>
                </div>
              ))}
              <div style={{ marginTop:16,background:C.purple,borderRadius:8,padding:'10px 0',textAlign:'center',fontFamily:FONT,fontSize:12,fontWeight:600,color:'#fff',boxShadow:'0 4px 12px rgba(107,49,212,0.4)' }}>Run Analysis</div>
            </div>
            <div style={{ padding:20 }}>
              <div style={{ display:'flex',gap:0,borderBottom:'1px solid #2D2650',marginBottom:16 }}>
                {['Summary','Detailed Bridge','Historical','Top Movers','KPI Matrix'].map((t,i)=>(
                  <div key={i} style={{ padding:'8px 14px',fontFamily:FONT,fontSize:12,fontWeight:i===0?600:400,color:i===0?C.purple:'#6B6490',borderBottom:i===0?`2px solid ${C.purple}`:'2px solid transparent',marginBottom:-1 }}>{t}</div>
                ))}
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,marginBottom:16 }}>
                {[{l:'Beginning ARR',v:'$10.5M'},{l:'Ending ARR',v:'$11.1M',d:'+5.3%',up:true},{l:'Net Retention',v:'105.3%',d:'+2.1pp',up:true},{l:'Gross Retention',v:'94.7%'},{l:'New Logo ARR',v:'$1.1M',d:'+$1.1M',up:true}].map((k,i)=>(
                  <div key={i} style={{ background:'#1E1A38',borderRadius:8,padding:'10px 12px',border:'1px solid #2D2650' }}>
                    <div style={{ fontFamily:FONT,fontSize:9,color:'#6B6490',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4 }}>{k.l}</div>
                    <div style={{ fontFamily:MONO,fontSize:16,fontWeight:700,color:'#fff',letterSpacing:'-0.02em' }}>{k.v}</div>
                    {k.d&&<div style={{ fontFamily:FONT,fontSize:10,fontWeight:600,color:k.up?C.green:C.red,marginTop:2 }}>{k.d}</div>}
                  </div>
                ))}
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 280px',gap:12 }}>
                <div style={{ background:'#1E1A38',borderRadius:8,padding:'12px 14px',border:'1px solid #2D2650' }}>
                  <div style={{ fontFamily:FONT,fontSize:11,fontWeight:600,color:'#9990B0',marginBottom:12 }}>ARR Bridge — YoY 12M Dec 2025</div>
                  <div style={{ display:'flex',alignItems:'flex-end',gap:5,height:72 }}>
                    {[{h:100,c:'#6B6490',l:'Beg.'},{h:18,c:C.red,l:'Churn'},{h:10,c:C.red,l:'Down'},{h:40,c:C.green,l:'Up'},{h:28,c:C.green,l:'New'},{h:12,c:C.blue,l:'Ret.'},{h:110,c:C.purple,l:'End.'}].map((b,i)=>(
                      <div key={i} style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4 }}>
                        <div style={{ width:'100%',height:b.h*0.65,background:b.c,borderRadius:'3px 3px 0 0',minHeight:4 }}/>
                        <span style={{ fontFamily:MONO,fontSize:8,color:'#6B6490' }}>{b.l}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ background:'#1A1130',borderRadius:8,padding:'12px 14px',border:`1px solid ${C.purple}55`,borderLeft:`3px solid ${C.purple}` }}>
                  <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:8 }}>
                    <span style={{ color:C.purple,fontSize:14 }}>&#10022;</span>
                    <span style={{ fontFamily:FONT,fontSize:10,fontWeight:700,color:C.purple,letterSpacing:'0.04em' }}>REVENUELENS AI</span>
                  </div>
                  <div style={{ fontFamily:FONT,fontSize:11,fontWeight:600,color:'#E8E0FF',marginBottom:6,lineHeight:1.4 }}>NRR 105.3% — strong expansion quarter</div>
                  <div style={{ fontFamily:FONT,fontSize:11,color:'#9990B0',lineHeight:1.55 }}>Upsell of $832K from 12 accounts drove growth. Churn controlled at $362K below 4% threshold.</div>
                  <div style={{ marginTop:8,fontFamily:FONT,fontSize:10,color:C.purple,fontWeight:600 }}>Review Top Movers for customer drivers</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const [ref,iv] = useInView()
  const steps = [
    {n:'01',icon:'📥',title:'Upload anything',body:'CSV, Excel, ERP exports, CRM dumps. Any format. Duplicates, gaps, dirty data — all handled automatically.',tag:'Any source',tc:C.text3,tb:`${C.border}88`},
    {n:'02',icon:'⚙️',title:'Clean, map and classify',body:'Fuzzy matching, deduplication, customer consolidation. Every revenue movement classified at the atomic level.',tag:'100% reconciled',tc:C.green,tb:C.greenBg},
    {n:'03',icon:'📦',title:'Download the data cube',body:'A single verified flat file — your ground truth. Downloadable, auditable, used by every analysis engine.',tag:'Ground truth',tc:C.blue,tb:'#EFF6FF'},
    {n:'04',icon:'📊',title:'Run any analysis engine',body:'ARR Bridge, ACV, Cohorts, Segmentation, Retention, PVM, 4-Wall, Product Bundling — 8 engines, one file.',tag:'8 engines',tc:C.purple,tb:C.purpleXl},
    {n:'05',icon:'✦',title:'AI explains and advises',body:'What happened. Why it happened. What it means. What to do next. Embedded financial intelligence, not a chatbot.',tag:'AI-powered',tc:'#7C3AED',tb:'#F5F3FF'},
    {n:'06',icon:'📤',title:'Export in any format',body:'Board packs, PDFs, CSVs, Slack alerts, dashboards. Take the decision wherever it needs to go.',tag:'Any format',tc:C.text3,tb:`${C.border}88`},
  ]
  return (
    <section ref={ref} style={{ background:C.bg,padding:'96px 32px',borderTop:`1px solid ${C.border}` }}>
      <div style={{ maxWidth:1100,margin:'0 auto' }}>
        <div style={{ textAlign:'center',marginBottom:60,...fadeIn(iv) }}>
          <p style={{ fontFamily:FONT,fontSize:13,fontWeight:600,color:C.purple,letterSpacing:'0.08em',textTransform:'uppercase',margin:'0 0 14px' }}>How it works</p>
          <h2 style={{ fontFamily:SERIF,fontSize:42,fontWeight:400,color:C.text1,letterSpacing:'-0.025em',margin:'0 0 14px' }}>From raw data to real decisions</h2>
          <p style={{ fontFamily:FONT,fontSize:17,color:C.text2,maxWidth:500,margin:'0 auto',lineHeight:1.65 }}>Six steps. Fully automated. No analysts, no spreadsheets, no waiting.</p>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16 }}>
          {steps.map((s,i)=>(
            <div key={i} style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:'26px 24px',...fadeIn(iv,i*0.07),transition:`opacity 0.65s ease ${i*0.07}s, transform 0.65s ease ${i*0.07}s, border-color 0.18s, box-shadow 0.18s`,cursor:'default' }} onMouseEnter={e=>{e.currentTarget.style.borderColor=C.purple+'66';e.currentTarget.style.boxShadow='0 4px 24px rgba(107,49,212,0.09)'}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.boxShadow='none'}}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14 }}>
                <span style={{ fontSize:22 }}>{s.icon}</span>
                <span style={{ fontFamily:MONO,fontSize:11,fontWeight:600,color:C.text3 }}>{s.n}</span>
              </div>
              <div style={{ fontFamily:FONT,fontSize:16,fontWeight:700,color:C.text1,letterSpacing:'-0.015em',marginBottom:8 }}>{s.title}</div>
              <div style={{ fontFamily:FONT,fontSize:13,color:C.text2,lineHeight:1.65,marginBottom:16 }}>{s.body}</div>
              <span style={{ display:'inline-block',fontFamily:FONT,fontSize:11,fontWeight:600,color:s.tc,background:s.tb,borderRadius:99,padding:'3px 10px' }}>{s.tag}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function AISection() {
  const [ref,iv] = useInView()
  const [active,setActive] = useState(0)
  const caps = [
    {icon:'📈',label:'AI Insights',hl:'What changed and why',detail:'After every analysis, RevenueLens AI generates a structured executive narrative. What moved. What caused it. What it means.',preview:{q:null,a:'NRR 105.3% this quarter — driven by $832K upsell from 12 expansion accounts. Churn held at $362K, below the 4% threshold. Gross retention: 94.7%.'}},
    {icon:'💬',label:'AI Consultant',hl:'Ask anything about your data',detail:'Not generic AI. Every answer is grounded in your actual verified revenue data. Ask about customers, products, time periods.',preview:{q:'Why did NRR drop in Q3?',a:'Q3 NRR fell to 98.4% from 107.2% in Q2. Primary driver: $421K downsell from 3 Enterprise accounts reducing seats post-renewal. New logo at $198K vs $340K prior quarter.'}},
    {icon:'🎓',label:'AI Educator',hl:'Teaches metrics in context',detail:'New to NRR? Never modeled a cohort? RevenueLens AI explains every metric in plain English — always in context of your own data.',preview:{q:'What is NRR and is mine good?',a:'NRR measures revenue kept and grown from existing customers. Above 100% means you grow without new customers. Your 105.3% is top quartile — healthy SaaS benchmark is 100-110%.'}},
    {icon:'🎯',label:'Decision Advisor',hl:'Tells you what to do next',detail:'Beyond explaining what happened, RevenueLens AI surfaces specific actions — which customers to call, where to focus.',preview:{q:null,a:'Action 1: Call accounts A-119, A-203, A-341 — all show expansion signals with seat usage above 85%. Upsell opportunity: $280K ARR.\n\nAction 2: SMB cohort at month 6 shows 23% churn. Run proactive check-in at month 5.'}},
  ]
  const cur = caps[active]
  return (
    <section ref={ref} style={{ background:C.surface,padding:'96px 32px',borderTop:`1px solid ${C.border}` }}>
      <div style={{ maxWidth:1100,margin:'0 auto',display:'grid',gridTemplateColumns:'1fr 1fr',gap:72,alignItems:'center' }}>
        <div style={{ ...fadeIn(iv) }}>
          <p style={{ fontFamily:FONT,fontSize:13,fontWeight:600,color:C.purple,letterSpacing:'0.08em',textTransform:'uppercase',margin:'0 0 14px' }}>AI intelligence</p>
          <h2 style={{ fontFamily:SERIF,fontSize:40,fontWeight:400,color:C.text1,letterSpacing:'-0.025em',margin:'0 0 16px',lineHeight:1.15 }}>Analyzes. Explains.<br/>Teaches. Advises.</h2>
          <p style={{ fontFamily:FONT,fontSize:15,color:C.text2,lineHeight:1.7,margin:'0 0 32px' }}>Most tools show charts. RevenueLens AI understands your revenue and tells you exactly what to do about it.</p>
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {caps.map((c,i)=>(
              <button key={i} onClick={()=>setActive(i)} style={{ display:'flex',alignItems:'center',gap:12,padding:'11px 14px',borderRadius:10,cursor:'pointer',textAlign:'left',border:`1px solid ${active===i?C.purpleMd:C.border}`,background:active===i?C.purpleXl:'transparent',transition:'all 0.15s',fontFamily:FONT }}>
                <span style={{ fontSize:18,flexShrink:0 }}>{c.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13,fontWeight:600,color:active===i?C.purple:C.text1 }}>{c.label}</div>
                  <div style={{ fontSize:11,color:C.text3,marginTop:1 }}>{c.hl}</div>
                </div>
                {active===i&&<span style={{ color:C.purple,fontSize:14 }}>&#8594;</span>}
              </button>
            ))}
          </div>
        </div>
        <div style={{ ...fadeIn(iv,0.15) }}>
          <div style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:18,overflow:'hidden',boxShadow:'0 8px 32px rgba(0,0,0,0.06)' }}>
            <div style={{ padding:'14px 18px',borderBottom:`1px solid ${C.border}`,background:C.surface,display:'flex',alignItems:'center',gap:10 }}>
              <div style={{ width:30,height:30,borderRadius:9,background:C.purple,display:'flex',alignItems:'center',justifyContent:'center' }}>
                <span style={{ color:'#fff',fontSize:14 }}>&#10022;</span>
              </div>
              <div>
                <div style={{ fontFamily:FONT,fontSize:13,fontWeight:700,color:C.text1 }}>RevenueLens AI</div>
                <div style={{ fontFamily:FONT,fontSize:11,color:C.text3 }}>{cur.label}</div>
              </div>
              <div style={{ marginLeft:'auto',display:'flex',alignItems:'center',gap:5 }}>
                <div style={{ width:6,height:6,borderRadius:'50%',background:C.green }}/>
                <span style={{ fontFamily:FONT,fontSize:10,color:C.text3 }}>live</span>
              </div>
            </div>
            <div style={{ padding:'20px 18px',minHeight:200,display:'flex',flexDirection:'column',gap:12 }}>
              {cur.preview.q&&(
                <div style={{ display:'flex',justifyContent:'flex-end' }}>
                  <div style={{ background:C.purple,color:'#fff',borderRadius:'12px 12px 2px 12px',padding:'10px 14px',maxWidth:'80%',fontFamily:FONT,fontSize:13,lineHeight:1.55 }}>{cur.preview.q}</div>
                </div>
              )}
              <div style={{ display:'flex' }}>
                <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:cur.preview.q?'12px 12px 12px 2px':'12px',padding:'12px 14px',maxWidth:'90%',fontFamily:FONT,fontSize:13,color:C.text1,lineHeight:1.65,whiteSpace:'pre-line' }}>{cur.preview.a}</div>
              </div>
              <div style={{ fontFamily:FONT,fontSize:12,color:C.text3,fontStyle:'italic',marginTop:4 }}>{cur.detail}</div>
            </div>
            <div style={{ padding:'10px 14px',borderTop:`1px solid ${C.border}`,background:C.surface,display:'flex',gap:8 }}>
              <div style={{ flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:'9px 12px',fontFamily:FONT,fontSize:12,color:C.text3 }}>Ask about your revenue…</div>
              <div style={{ width:34,height:34,borderRadius:8,background:C.purple,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0 }}>
                <span style={{ color:'#fff',fontSize:14 }}>&#8594;</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ComparisonTable() {
  const [ref,iv] = useInView()
  const rows = [
    {cap:'Analyzes your revenue data',rl:true,tb:true,gpt:false,con:false},
    {cap:'Explains what happened and why',rl:true,tb:false,gpt:'partial',con:true},
    {cap:'Uses your actual real data',rl:true,tb:true,gpt:false,con:true},
    {cap:'Teaches your metrics in context',rl:true,tb:false,gpt:'partial',con:false},
    {cap:'Recommends specific next actions',rl:true,tb:false,gpt:'partial',con:true},
    {cap:'Available instantly, 24 hours a day',rl:true,tb:true,gpt:true,con:false},
    {cap:'100% reconciled output guaranteed',rl:true,tb:false,gpt:false,con:false},
    {cap:'Costs under $1,000 per month',rl:true,tb:false,gpt:true,con:false},
  ]
  const Cell=({v})=>{
    if(v===true) return <span style={{color:C.green,fontSize:17,fontWeight:700}}>&#10003;</span>
    if(v===false) return <span style={{color:C.borderMd,fontSize:17}}>&#8212;</span>
    return <span style={{fontFamily:FONT,fontSize:10,fontWeight:600,color:C.amber,background:'#FFFBEB',borderRadius:99,padding:'2px 8px'}}>partial</span>
  }
  return (
    <section ref={ref} style={{ background:C.bg,padding:'96px 32px',borderTop:`1px solid ${C.border}` }}>
      <div style={{ maxWidth:900,margin:'0 auto' }}>
        <div style={{ textAlign:'center',marginBottom:52,...fadeIn(iv) }}>
          <p style={{ fontFamily:FONT,fontSize:13,fontWeight:600,color:C.purple,letterSpacing:'0.08em',textTransform:'uppercase',margin:'0 0 14px' }}>Why RevenueLens</p>
          <h2 style={{ fontFamily:SERIF,fontSize:40,fontWeight:400,color:C.text1,letterSpacing:'-0.025em',margin:0 }}>Nothing else does all of this.</h2>
        </div>
        <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,overflow:'hidden',boxShadow:'0 4px 20px rgba(0,0,0,0.04)',...fadeIn(iv,0.1) }}>
          <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr',background:C.bg,borderBottom:`1px solid ${C.border}` }}>
            <div style={{ padding:'13px 20px' }}/>
            {['RevenueLens','Tableau / BI','ChatGPT','Consultants'].map((col,i)=>(
              <div key={i} style={{ padding:'13px 12px',textAlign:'center',borderLeft:`1px solid ${C.border}`,background:i===0?C.purpleXl:'transparent' }}>
                <span style={{ fontFamily:FONT,fontSize:12,fontWeight:700,color:i===0?C.purple:C.text2 }}>{col}</span>
              </div>
            ))}
          </div>
          {rows.map((r,ri)=>(
            <div key={ri} style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr',borderBottom:ri<rows.length-1?`1px solid ${C.bg}`:'none' }}>
              <div style={{ padding:'12px 20px',fontFamily:FONT,fontSize:13,color:C.text1,fontWeight:500 }}>{r.cap}</div>
              {[r.rl,r.tb,r.gpt,r.con].map((v,ci)=>(
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

function Pricing({ onStart }) {
  const [ref,iv] = useInView()
  const plans = [
    {name:'Starter',price:'$299',desc:'For growing finance teams starting with ARR analytics.',features:['MRR / ARR bridge analytics','Up to 5M rows per month','3 users included','Data cube download','Email support'],cta:'Start free trial',popular:false},
    {name:'Growth',price:'$799',desc:'For teams who need the full platform and AI layer.',features:['All 8 analytics engines','Unlimited rows','10 users included','AI Insights + Consultant + Educator','Board pack generation','Slack alerts'],cta:'Start free trial',popular:true},
    {name:'Enterprise',price:'$2,500',desc:'For large teams, PE firms, and portfolio oversight.',features:['Everything in Growth','Unlimited users','SSO + audit logs','Dedicated CSM','SLA 99.9% uptime','SOC 2 report on request'],cta:'Talk to sales',popular:false},
  ]
  return (
    <section ref={ref} style={{ background:C.surface,padding:'96px 32px',borderTop:`1px solid ${C.border}` }}>
      <div style={{ maxWidth:1000,margin:'0 auto' }}>
        <div style={{ textAlign:'center',marginBottom:56,...fadeIn(iv) }}>
          <p style={{ fontFamily:FONT,fontSize:13,fontWeight:600,color:C.purple,letterSpacing:'0.08em',textTransform:'uppercase',margin:'0 0 14px' }}>Pricing</p>
          <h2 style={{ fontFamily:SERIF,fontSize:40,fontWeight:400,color:C.text1,letterSpacing:'-0.025em',margin:'0 0 12px' }}>Simple pricing. Serious value.</h2>
          <p style={{ fontFamily:FONT,fontSize:16,color:C.text2 }}>All plans include the data cube, classification engine, and AI layer.</p>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16 }}>
          {plans.map((p,i)=>(
            <div key={i} style={{ background:C.bg,border:`${p.popular?'2px':'1px'} solid ${p.popular?C.purple:C.border}`,borderRadius:16,padding:'28px 24px',position:'relative',boxShadow:p.popular?'0 8px 32px rgba(107,49,212,0.14)':'0 1px 4px rgba(0,0,0,0.04)',...fadeIn(iv,i*0.1) }}>
              {p.popular&&<div style={{ position:'absolute',top:-14,left:'50%',transform:'translateX(-50%)',background:C.purple,color:'#fff',borderRadius:99,padding:'4px 16px',fontFamily:FONT,fontSize:11,fontWeight:700,whiteSpace:'nowrap' }}>Most popular</div>}
              <div style={{ fontFamily:FONT,fontSize:15,fontWeight:700,color:C.text1,marginBottom:6 }}>{p.name}</div>
              <div style={{ display:'flex',alignItems:'baseline',gap:3,marginBottom:8 }}>
                <span style={{ fontFamily:SERIF,fontSize:36,fontWeight:400,color:p.popular?C.purple:C.text1,letterSpacing:'-0.02em' }}>{p.price}</span>
                <span style={{ fontFamily:FONT,fontSize:13,color:C.text3 }}>/mo</span>
              </div>
              <div style={{ fontFamily:FONT,fontSize:13,color:C.text2,lineHeight:1.55,marginBottom:22 }}>{p.desc}</div>
              <button onClick={onStart} style={{ width:'100%',padding:'11px 0',borderRadius:9,border:`1px solid ${p.popular?'transparent':C.borderMd}`,background:p.popular?C.purple:C.surface,color:p.popular?'#fff':C.text1,fontFamily:FONT,fontSize:13,fontWeight:600,cursor:'pointer',marginBottom:20,boxShadow:p.popular?'0 4px 12px rgba(107,49,212,0.3)':'none',transition:'all 0.15s' }}>{p.cta}</button>
              <div style={{ display:'flex',flexDirection:'column',gap:9 }}>
                {p.features.map((f,fi)=>(
                  <div key={fi} style={{ display:'flex',gap:8,alignItems:'center',fontFamily:FONT,fontSize:13,color:C.text2 }}>
                    <span style={{ color:C.green,flexShrink:0,fontSize:13 }}>&#10003;</span>{f}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p style={{ textAlign:'center',marginTop:28,fontFamily:FONT,fontSize:13,color:C.text3 }}>
          PE portfolio or multi-company?{' '}
          <a href="#" style={{ color:C.purple,fontWeight:600,textDecoration:'none' }}>Talk to us about custom pricing</a>
        </p>
      </div>
    </section>
  )
}

function FinalCTA({ onStart }) {
  return (
    <section style={{ background:C.purple,padding:'88px 32px',position:'relative',overflow:'hidden' }}>
      <div aria-hidden style={{ position:'absolute',top:-100,left:'50%',transform:'translateX(-50%)',width:600,height:300,background:'radial-gradient(ellipse,rgba(255,255,255,0.12) 0%,transparent 70%)',pointerEvents:'none' }}/>
      <div style={{ maxWidth:640,margin:'0 auto',textAlign:'center',position:'relative' }}>
        <div style={{ fontFamily:FONT,fontSize:40,marginBottom:20,lineHeight:1,color:'#fff' }}>&#10022;</div>
        <h2 style={{ fontFamily:SERIF,fontSize:44,fontWeight:400,color:'#fff',letterSpacing:'-0.025em',margin:'0 0 18px',lineHeight:1.15 }}>The window is now.</h2>
        <p style={{ fontFamily:FONT,fontSize:17,color:'rgba(255,255,255,0.72)',lineHeight:1.7,margin:'0 0 40px' }}>No dominant player owns this space yet. The CFO who logs into RevenueLens every morning makes better decisions, faster.</p>
        <div style={{ display:'flex',justifyContent:'center',gap:12,flexWrap:'wrap' }}>
          <button onClick={onStart} style={{ background:'#fff',color:C.purple,border:'none',borderRadius:10,padding:'14px 30px',fontFamily:FONT,fontSize:15,fontWeight:700,cursor:'pointer',boxShadow:'0 4px 16px rgba(0,0,0,0.15)',transition:'all 0.18s' }} onMouseEnter={e=>e.target.style.transform='translateY(-2px)'} onMouseLeave={e=>e.target.style.transform=''}>Start free — no card required</button>
          <button style={{ background:'rgba(255,255,255,0.14)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)',borderRadius:10,padding:'14px 24px',fontFamily:FONT,fontSize:15,fontWeight:500,cursor:'pointer' }}>Book a demo</button>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  const links = [
    {head:'Product',items:['Features','Pricing','Changelog','Roadmap']},
    {head:'Company',items:['About','Blog','Careers','Press']},
    {head:'Resources',items:['Documentation','API Reference','Status','Security']},
    {head:'Legal',items:['Privacy','Terms','SOC 2','GDPR']},
  ]
  return (
    <footer style={{ background:C.text1,padding:'60px 32px 32px' }}>
      <div style={{ maxWidth:1100,margin:'0 auto' }}>
        <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr',gap:48,marginBottom:48 }}>
          <div>
            <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:16 }}>
              <div style={{ width:28,height:28,borderRadius:8,background:C.purple,display:'flex',alignItems:'center',justifyContent:'center' }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 13L8 3L14 13H2Z" fill="white"/></svg>
              </div>
              <span style={{ fontFamily:FONT,fontSize:14,fontWeight:700,color:'#fff' }}>RevenueLens</span>
            </div>
            <p style={{ fontFamily:FONT,fontSize:13,color:'rgba(255,255,255,0.42)',lineHeight:1.65,margin:0,maxWidth:220 }}>The system that understands your revenue and tells you what to do next.</p>
          </div>
          {links.map((col,i)=>(
            <div key={i}>
              <div style={{ fontFamily:FONT,fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',letterSpacing:'0.07em',textTransform:'uppercase',marginBottom:14 }}>{col.head}</div>
              {col.items.map(item=>(
                <a key={item} href="#" style={{ display:'block',fontFamily:FONT,fontSize:13,color:'rgba(255,255,255,0.52)',textDecoration:'none',marginBottom:9,transition:'color 0.15s' }} onMouseEnter={e=>e.target.style.color='rgba(255,255,255,0.85)'} onMouseLeave={e=>e.target.style.color='rgba(255,255,255,0.52)'}>{item}</a>
              ))}
            </div>
          ))}
        </div>
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.08)',paddingTop:24,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
          <span style={{ fontFamily:FONT,fontSize:12,color:'rgba(255,255,255,0.28)' }}>&#169; 2026 RevenueLens. All rights reserved.</span>
          <span style={{ fontFamily:FONT,fontSize:12,color:'rgba(255,255,255,0.28)' }}>Built for CFOs who want answers, not charts.</span>
        </div>
      </div>
    </footer>
  )
}

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
        <ProductPreview/>
        <HowItWorks/>
        <AISection/>
        <ComparisonTable/>
        <Pricing onStart={go}/>
        <FinalCTA onStart={go}/>
        <Footer/>
      </div>
    </>
  )
}
