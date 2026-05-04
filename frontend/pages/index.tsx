// @ts-nocheck
/**
 * pages/index.tsx — RevenueLens Landing Page
 * Deploy to: frontend/pages/index.tsx
 *
 * Enhanced from existing file. Keeps all original sections.
 * Adds: animated hero, product preview, AI section, pipeline story,
 *       competitive table, upgraded pricing, trust strip.
 * Uses Tailwind CSS throughout to match existing design system.
 * CTA routes to /auth/login
 */

import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import {
  BarChart3, TrendingUp, Users, ArrowRight, CheckCircle, ChevronRight,
  Layers, Target, Zap, Shield, LineChart, Play, Star,
  Sparkles, BrainCircuit, FileDown, Database, GitMerge, Cpu
} from 'lucide-react'

// ─── useInView ────────────────────────────────────────────────────────────────
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

// ─── NAV ──────────────────────────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-white/95 backdrop-blur-md border-b border-ink-100 shadow-sm' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-lg">
            <BarChart3 size={16} className="text-white" />
          </div>
          <span className="font-display font-700 text-ink-900 text-[15px] tracking-tight">RevenueLens</span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {['Product','Pricing','Consulting','About'].map(item => (
            <Link key={item} href={`/${item.toLowerCase()}`}
              className="px-4 py-2 text-[13px] font-medium text-ink-600 hover:text-ink-900 hover:bg-ink-50 rounded-lg transition-all">
              {item}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-[13px] font-medium text-ink-600 hover:text-ink-900 px-3 py-2 transition-colors">Sign in</Link>
          <Link href="/auth/login" className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-[13px] font-600 px-4 py-2 rounded-lg transition-all shadow-sm hover:shadow-md">
            Start free <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </nav>
  )
}

// ─── HERO ─────────────────────────────────────────────────────────────────────
function Hero() {
  const words = ['ARR bridge analysis','cohort analytics','AI insights','retention trends','ACV analysis','revenue decisions']
  const [wi, setWi] = useState(0)
  const [fd, setFd] = useState(true)
  useEffect(() => {
    const t = setInterval(() => {
      setFd(false)
      setTimeout(() => { setWi(p => (p + 1) % words.length); setFd(true) }, 280)
    }, 2400)
    return () => clearInterval(t)
  }, [])

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-ink-950">
      {/* Background mesh */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-600/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-brand-400/15 rounded-full blur-[80px]" />
        <div className="absolute inset-0" style={{ backgroundImage:'radial-gradient(circle at 1px 1px,rgba(255,255,255,0.04) 1px,transparent 0)', backgroundSize:'40px 40px' }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-20 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left */}
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold tracking-wide mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
              Revenue Decision Platform
            </div>

            <h1 className="font-display text-5xl lg:text-6xl font-800 text-white leading-[1.05] tracking-tight mb-4">
              The system that{' '}
              <span className="text-brand-400">understands</span>{' '}
              your revenue.
            </h1>

            {/* Animated line */}
            <p className="text-ink-300 text-lg leading-relaxed mb-3 max-w-xl">
              Upload any data. Get instant{' '}
              <span
                className="text-brand-400 font-semibold transition-opacity duration-300"
                style={{ opacity: fd ? 1 : 0 }}
              >
                {words[wi]}
              </span>
              {' '}— powered by an AI that explains, teaches, and advises.
            </p>
            <p className="text-ink-400 text-base leading-relaxed mb-10 max-w-xl">
              Not just charts. RevenueLens tells you what happened, why it happened, and exactly what to do next.
            </p>

            <div className="flex flex-wrap gap-4 mb-12">
              <Link href="/auth/login"
                className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-600 px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                Start free analysis <ArrowRight size={15} />
              </Link>
              <button className="inline-flex items-center gap-2.5 px-6 py-3 text-white/80 text-sm font-medium hover:text-white transition-colors">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  <Play size={12} className="fill-white text-white ml-0.5" />
                </div>
                Watch demo (2 min)
              </button>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-8">
              {[
                { n:'100%', l:'Reconciliation accuracy' },
                { n:'< 2 min', l:'Time to first insight' },
                { n:'8+', l:'Analytics engines' },
              ].map(({ n, l }) => (
                <div key={l}>
                  <div className="font-display text-2xl font-700 text-white">{n}</div>
                  <div className="text-ink-400 text-xs mt-0.5">{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — dashboard preview */}
          <div className="relative hidden lg:block">
            <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-ink-900">
              {/* Browser chrome */}
              <div className="bg-ink-950 border-b border-white/5 px-5 py-3 flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                </div>
                <div className="flex-1 bg-white/5 rounded-md h-5 mx-4 flex items-center justify-center">
                  <span className="text-ink-500 text-[10px] font-mono">revenuelens.ai/app/command-center</span>
                </div>
              </div>

              {/* KPI row */}
              <div className="p-5 grid grid-cols-3 gap-3">
                {[
                  { label:'Ending ARR', value:'$11.1M', change:'+5.3%', up:true },
                  { label:'Net Retention', value:'105.3%', change:'+2.1pp', up:true },
                  { label:'Gross Churn', value:'$562K', change:'-$89K', up:false },
                ].map(kpi => (
                  <div key={kpi.label} className="bg-ink-800/50 rounded-xl p-3.5 border border-white/5">
                    <div className="text-ink-400 text-[10px] font-semibold uppercase tracking-wide mb-1">{kpi.label}</div>
                    <div className="font-display text-white text-lg font-700">{kpi.value}</div>
                    <div className={`text-xs font-medium mt-1 ${kpi.up ? 'text-green-400' : 'text-red-400'}`}>{kpi.change}</div>
                  </div>
                ))}
              </div>

              {/* Waterfall */}
              <div className="px-5 pb-3">
                <div className="bg-ink-800/40 rounded-xl p-4 border border-white/5">
                  <div className="text-ink-300 text-xs font-semibold mb-4">ARR Bridge — YoY 12M Dec 2025</div>
                  <div className="flex items-end gap-2 h-24">
                    {[
                      { h:80, c:'#6B7280', l:'Beg.' },
                      { h:18, c:'#EF4444', l:'Churn' },
                      { h:10, c:'#EF4444', l:'Down' },
                      { h:40, c:'#10B981', l:'Up' },
                      { h:28, c:'#10B981', l:'New' },
                      { h:12, c:'#3B82F6', l:'Ret.' },
                      { h:88, c:'#6B31D4', l:'End.' },
                    ].map((b,i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full rounded-sm" style={{ height:b.h*0.85+'%', background:b.c, minHeight:4 }} />
                        <span className="text-ink-500 text-[9px]">{b.l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI insight bar */}
              <div className="px-5 pb-5">
                <div className="rounded-xl p-3 border-l-2 border-brand-500 bg-brand-500/5 border border-brand-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={11} className="text-brand-400" />
                    <span className="text-brand-400 text-[10px] font-700 tracking-wide uppercase">RevenueLens AI</span>
                  </div>
                  <p className="text-ink-300 text-[11px] leading-relaxed">NRR 105.3% driven by $832K upsell from 12 accounts. Churn controlled at $362K — below 4% threshold.</p>
                </div>
              </div>
            </div>

            {/* Floating tag */}
            <div className="absolute -top-4 -right-4 bg-white rounded-xl px-4 py-2.5 shadow-xl flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                <TrendingUp size={14} className="text-green-600" />
              </div>
              <div>
                <div className="text-ink-900 text-xs font-700">NRR 105.3%</div>
                <div className="text-ink-400 text-[10px]">Dec 2025</div>
              </div>
            </div>

            {/* Floating AI tag */}
            <div className="absolute -bottom-4 -left-4 bg-white rounded-xl px-4 py-2.5 shadow-xl flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center">
                <Sparkles size={14} className="text-brand-600" />
              </div>
              <div>
                <div className="text-ink-900 text-xs font-700">AI insight ready</div>
                <div className="text-ink-400 text-[10px]">What to do next</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── PLATFORM STORY ───────────────────────────────────────────────────────────
function PlatformStory() {
  const [ref, iv] = useInView()
  const steps = [
    { icon:Database,   n:'01', label:'Upload anything',      sub:'CSV, ERP, CRM — any mess',    c:'text-amber-600', bg:'bg-amber-50',  tag:'Any source',      tc:'text-amber-700', tb:'bg-amber-50' },
    { icon:GitMerge,   n:'02', label:'Clean and classify',   sub:'Fuzzy match, reconcile',       c:'text-blue-600',  bg:'bg-blue-50',   tag:'100% accurate',   tc:'text-blue-700',  tb:'bg-blue-50'  },
    { icon:FileDown,   n:'03', label:'Download data cube',   sub:'Verified flat file, ground truth', c:'text-green-600', bg:'bg-green-50', tag:'Ground truth', tc:'text-green-700', tb:'bg-green-50' },
    { icon:Cpu,        n:'04', label:'Run 8 engines',        sub:'ARR, ACV, Cohorts, PVM...',    c:'text-brand-600', bg:'bg-brand-50',  tag:'8 engines',       tc:'text-brand-700', tb:'bg-brand-50' },
    { icon:Sparkles,   n:'05', label:'AI explains + advises',sub:'What, why, what next',         c:'text-purple-600',bg:'bg-purple-50', tag:'AI-powered',      tc:'text-purple-700',tb:'bg-purple-50'},
    { icon:ArrowRight, n:'06', label:'Export any format',    sub:'PDF, CSV, board pack, Slack',  c:'text-ink-600',   bg:'bg-ink-50',    tag:'Any format',      tc:'text-ink-600',   tb:'bg-ink-50'   },
  ]

  return (
    <section ref={ref} className="py-24 bg-ink-50 border-t border-ink-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className={`text-center mb-16 transition-all duration-700 ${iv ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}>
          <span className="text-xs font-700 text-brand-600 uppercase tracking-widest">How it works</span>
          <h2 className="font-display text-4xl font-800 text-ink-900 tracking-tight mt-3 mb-4">From raw data to real decisions</h2>
          <p className="text-ink-500 text-lg max-w-xl mx-auto">Six steps. Fully automated. No analysts, no spreadsheets, no waiting.</p>
        </div>

        <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
          {steps.map((s, i) => (
            <div key={i}
              className={`bg-white border border-ink-200 rounded-2xl p-5 transition-all duration-700 hover:border-brand-200 hover:shadow-lg cursor-default ${iv ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}
              style={{ transitionDelay: `${i * 70}ms` }}>
              <div className="flex justify-between items-start mb-4">
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center`}>
                  <s.icon size={16} className={s.c} />
                </div>
                <span className="font-mono text-[10px] font-600 text-ink-300">{s.n}</span>
              </div>
              <div className="font-display text-[13px] font-700 text-ink-900 mb-1 leading-snug">{s.label}</div>
              <div className="text-ink-500 text-[11px] leading-relaxed mb-3">{s.sub}</div>
              <span className={`inline-block text-[10px] font-600 ${s.tc} ${s.tb} rounded-full px-2.5 py-0.5`}>{s.tag}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── FEATURES ─────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon:Layers,    title:'Cohort Analytics',       desc:'Size, percentile, and revenue cohorts. Individual and hierarchical with fiscal year filtering.', c:'text-brand-600',  bg:'bg-brand-50' },
  { icon:TrendingUp,title:'ARR Bridge Analysis',    desc:'Full SaaS waterfall: New Logo, Upsell, Downsell, Churn, Lapsed, Returning. 1M/3M/12M windows.', c:'text-green-600', bg:'bg-green-50' },
  { icon:Users,     title:'Customer Analytics',     desc:'NRR/GRR tracking, vintage cohorts, top movers, segmentation by fiscal year. PE-grade output.',  c:'text-purple-600',bg:'bg-purple-50' },
  { icon:Target,    title:'PVM Diagnostics',        desc:'Price vs volume decomposition. Isolate price impact and volume impact for Upsell/Downsell.', c:'text-amber-600', bg:'bg-amber-50' },
  { icon:LineChart, title:'Revenue Concentration',  desc:'See what percentage of revenue comes from top 5/10/20% of customers — and how it shifts.',    c:'text-red-600',   bg:'bg-red-50' },
  { icon:Sparkles,  title:'AI Intelligence',        desc:'Explains what happened, teaches metrics, recommends next actions. Embedded advisor, not a chatbot.', c:'text-brand-600',bg:'bg-brand-50' },
]

function Features() {
  const [ref, iv] = useInView()
  return (
    <section ref={ref} className="py-24 bg-white border-t border-ink-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className={`text-center mb-16 transition-all duration-700 ${iv ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}>
          <span className="text-xs font-700 text-brand-600 uppercase tracking-widest">Platform capabilities</span>
          <h2 className="font-display text-4xl font-800 text-ink-900 tracking-tight mt-3 mb-4">Everything to diagnose revenue health</h2>
          <p className="text-ink-500 text-lg max-w-2xl mx-auto">Built on the same methodology used by PE firms and SaaS-focused investment bankers.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <div key={f.title}
              className={`bg-white border border-ink-200 rounded-2xl p-6 transition-all duration-700 hover:border-brand-200 hover:shadow-lg ${iv ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}
              style={{ transitionDelay: `${i * 80}ms` }}>
              <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center mb-4`}>
                <f.icon size={20} className={f.c} />
              </div>
              <h3 className="font-display text-[15px] font-700 text-ink-900 mb-2">{f.title}</h3>
              <p className="text-ink-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── AI SECTION ───────────────────────────────────────────────────────────────
function AISection() {
  const [ref, iv] = useInView()
  const [active, setActive] = useState(0)
  const caps = [
    { icon:'📈', label:'AI Insights',      hl:'What changed and why',      q:null,                          a:'NRR 105.3% this quarter — driven by $832K upsell from 12 accounts. Churn held at $362K, below 4% threshold. Gross retention: 94.7%.' },
    { icon:'💬', label:'AI Consultant',    hl:'Ask anything about your data', q:'Why did NRR drop in Q3?',   a:'Q3 NRR fell to 98.4% from 107.2% in Q2. Primary driver: $421K downsell from 3 Enterprise accounts reducing seats post-renewal.' },
    { icon:'🎓', label:'AI Educator',      hl:'Teaches metrics in context', q:'What is NRR and is mine good?', a:'NRR measures revenue kept and grown from existing customers. Above 100% means growth without new customers. Your 105.3% is top quartile.' },
    { icon:'🎯', label:'Decision Advisor', hl:'Tells you what to do next',  q:null,                          a:'Action: Call accounts A-119, A-203, A-341 — all showing expansion signals with seat usage above 85%. Combined upsell opportunity: $280K ARR.' },
  ]
  const cur = caps[active]

  return (
    <section ref={ref} className="py-24 bg-ink-50 border-t border-ink-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className={`grid lg:grid-cols-2 gap-16 items-center transition-all duration-700 ${iv ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}>

          {/* Left */}
          <div>
            <span className="text-xs font-700 text-brand-600 uppercase tracking-widest">AI intelligence</span>
            <h2 className="font-display text-4xl font-800 text-ink-900 tracking-tight mt-3 mb-4 leading-tight">
              Analyzes. Explains.<br />Teaches. Advises.
            </h2>
            <p className="text-ink-500 text-base leading-relaxed mb-8">
              Most tools show charts. RevenueLens AI understands your revenue and tells you exactly what to do about it.
            </p>
            <div className="flex flex-col gap-3">
              {caps.map((c, i) => (
                <button key={i} onClick={() => setActive(i)}
                  className={`flex items-center gap-3 p-4 rounded-xl text-left transition-all border ${active === i ? 'border-brand-200 bg-brand-50' : 'border-ink-200 bg-white hover:border-ink-300'}`}>
                  <span className="text-xl flex-shrink-0">{c.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-600 ${active === i ? 'text-brand-700' : 'text-ink-900'}`}>{c.label}</div>
                    <div className="text-ink-400 text-xs mt-0.5">{c.hl}</div>
                  </div>
                  {active === i && <ArrowRight size={14} className="text-brand-600 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Right — chat preview */}
          <div>
            <div className="bg-white border border-ink-200 rounded-2xl overflow-hidden shadow-lg">
              {/* Header */}
              <div className="px-5 py-4 border-b border-ink-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
                  <Sparkles size={14} className="text-white" />
                </div>
                <div>
                  <div className="text-sm font-700 text-ink-900">RevenueLens AI</div>
                  <div className="text-ink-400 text-[11px]">{cur.label}</div>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-ink-400 text-[10px]">live</span>
                </div>
              </div>

              {/* Messages */}
              <div className="p-5 min-h-[200px] flex flex-col gap-3">
                {cur.q && (
                  <div className="flex justify-end">
                    <div className="bg-brand-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm max-w-[80%] leading-relaxed">{cur.q}</div>
                  </div>
                )}
                <div className="flex">
                  <div className="bg-ink-50 border border-ink-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-ink-800 max-w-[90%] leading-relaxed">{cur.a}</div>
                </div>
              </div>

              {/* Input */}
              <div className="px-4 pb-4 flex gap-2">
                <div className="flex-1 bg-ink-50 border border-ink-200 rounded-lg px-3 py-2 text-sm text-ink-400">Ask about your revenue…</div>
                <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center cursor-pointer">
                  <ArrowRight size={14} className="text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── COMPETITIVE TABLE ────────────────────────────────────────────────────────
function CompetitiveTable() {
  const [ref, iv] = useInView()
  const rows = [
    { cap:'Analyzes your revenue data',          rl:true,  tb:true,  gpt:false,     con:false },
    { cap:'Explains what happened and why',       rl:true,  tb:false, gpt:'partial', con:true  },
    { cap:'Uses your actual real data',           rl:true,  tb:true,  gpt:false,     con:true  },
    { cap:'Teaches your metrics in context',      rl:true,  tb:false, gpt:'partial', con:false },
    { cap:'Recommends specific next actions',     rl:true,  tb:false, gpt:'partial', con:true  },
    { cap:'Available instantly around the clock', rl:true,  tb:true,  gpt:true,      con:false },
    { cap:'100% reconciled output',              rl:true,  tb:false, gpt:false,     con:false },
    { cap:'Costs under $1,000 per month',        rl:true,  tb:false, gpt:true,      con:false },
  ]

  const Cell = ({ v }) => {
    if (v === true)      return <CheckCircle size={16} className="text-green-500 mx-auto" />
    if (v === false)     return <span className="text-ink-300 text-lg leading-none mx-auto block text-center">-</span>
    return <span className="text-amber-600 text-[10px] font-600 bg-amber-50 px-2 py-0.5 rounded-full">partial</span>
  }

  return (
    <section ref={ref} className="py-24 bg-white border-t border-ink-100">
      <div className="max-w-4xl mx-auto px-6">
        <div className={`text-center mb-12 transition-all duration-700 ${iv ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}>
          <span className="text-xs font-700 text-brand-600 uppercase tracking-widest">Why RevenueLens</span>
          <h2 className="font-display text-4xl font-800 text-ink-900 tracking-tight mt-3">Nothing else does all of this.</h2>
        </div>

        <div className={`border border-ink-200 rounded-2xl overflow-hidden shadow-sm transition-all duration-700 ${iv ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`} style={{ transitionDelay:'100ms' }}>
          {/* Header */}
          <div className="grid bg-ink-50 border-b border-ink-200" style={{ gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr' }}>
            <div className="p-4" />
            {['RevenueLens','Tableau / BI','ChatGPT','Consultants'].map((col, i) => (
              <div key={i} className={`p-4 text-center border-l border-ink-200 ${i === 0 ? 'bg-brand-50' : ''}`}>
                <span className={`text-xs font-700 ${i === 0 ? 'text-brand-700' : 'text-ink-500'}`}>{col}</span>
              </div>
            ))}
          </div>
          {/* Rows */}
          {rows.map((r, ri) => (
            <div key={ri} className={`grid border-b last:border-0 border-ink-100 ${ri % 2 === 0 ? 'bg-white' : 'bg-ink-50/40'}`} style={{ gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr' }}>
              <div className="p-4 text-sm font-500 text-ink-700">{r.cap}</div>
              {[r.rl, r.tb, r.gpt, r.con].map((v, ci) => (
                <div key={ci} className={`p-4 flex items-center justify-center border-l border-ink-100 ${ci === 0 ? 'bg-brand-50/50' : ''}`}>
                  <Cell v={v} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── PRICING ──────────────────────────────────────────────────────────────────
const PRICING_PLANS = [
  {
    name:'Starter', price:'$299', period:'/month',
    desc:'For finance teams starting with ARR analytics.',
    features:['MRR / ARR bridge analytics','Up to 5M rows per month','3 users included','Data cube download','Email support'],
    cta:'Start free trial', href:'/auth/login', highlight:false,
  },
  {
    name:'Growth', price:'$799', period:'/month',
    desc:'For teams who need the full platform and AI layer.',
    features:['All 8 analytics engines','Unlimited rows','10 users included','AI Insights + Consultant + Educator','Board pack generation','Slack alerts'],
    cta:'Start free trial', href:'/auth/login', highlight:true,
  },
  {
    name:'Enterprise', price:'$2,500', period:'/month',
    desc:'For large teams, PE firms, and portfolio oversight.',
    features:['Everything in Growth','Unlimited users','SSO + audit logs','Dedicated CSM','SLA 99.9% uptime','SOC 2 on request'],
    cta:'Talk to sales', href:'/auth/login', highlight:false,
  },
]

function Pricing() {
  const [ref, iv] = useInView()
  return (
    <section id="pricing" ref={ref} className="py-24 bg-ink-50 border-t border-ink-100">
      <div className="max-w-5xl mx-auto px-6">
        <div className={`text-center mb-16 transition-all duration-700 ${iv ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}>
          <span className="text-xs font-700 text-brand-600 uppercase tracking-widest">Pricing</span>
          <h2 className="font-display text-4xl font-800 text-ink-900 tracking-tight mt-3 mb-3">Simple pricing. Serious value.</h2>
          <p className="text-ink-500 text-lg">All plans include the data cube, classification engine, and AI layer.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-10">
          {PRICING_PLANS.map((plan, i) => (
            <div key={plan.name}
              className={`relative rounded-2xl p-7 border transition-all duration-700 ${plan.highlight ? 'bg-brand-600 border-brand-600 shadow-xl' : 'bg-white border-ink-200'} ${iv ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}
              style={{ transitionDelay:`${i * 100}ms` }}>
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-ink-900 text-[10px] font-700 px-3 py-1 rounded-full uppercase tracking-wide">Most popular</div>
              )}
              <div className={`text-sm font-600 mb-1 ${plan.highlight ? 'text-blue-200' : 'text-ink-500'}`}>{plan.name}</div>
              <div className={`font-display text-3xl font-800 ${plan.highlight ? 'text-white' : 'text-ink-900'}`}>
                {plan.price}<span className={`text-sm font-400 ${plan.highlight ? 'text-blue-200' : 'text-ink-400'}`}>{plan.period}</span>
              </div>
              <p className={`text-sm mt-2 mb-6 ${plan.highlight ? 'text-blue-100' : 'text-ink-500'}`}>{plan.desc}</p>
              <Link href={plan.href} className={`block text-center py-2.5 px-4 rounded-lg text-sm font-600 transition-all mb-7 ${plan.highlight ? 'bg-white text-brand-600 hover:bg-blue-50' : 'bg-brand-600 text-white hover:bg-brand-700'}`}>
                {plan.cta}
              </Link>
              <ul className="space-y-2.5">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <CheckCircle size={14} className={plan.highlight ? 'text-blue-200 flex-shrink-0' : 'text-brand-500 flex-shrink-0'} />
                    <span className={plan.highlight ? 'text-blue-100' : 'text-ink-600'}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Consulting add-on */}
        <div className="bg-white border border-ink-200 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="flex-1">
            <div className="font-display text-[15px] font-700 text-ink-900 mb-1">Expert Analytics Consulting</div>
            <p className="text-ink-500 text-sm leading-relaxed">Need someone to interpret your data, build a revenue narrative for investors, or set up your analytics model? Former PE analytics background, deep SaaS metrics expertise.</p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            {[{t:'1 hr',p:'$150'},{t:'2 hrs',p:'$280'},{t:'Half day',p:'$500'}].map(s=>(
              <div key={s.t} className="px-4 py-2 bg-ink-50 rounded-lg text-center border border-ink-200">
                <div className="font-700 text-ink-900 text-sm">{s.t}</div>
                <div className="text-ink-500 text-xs">{s.p}</div>
              </div>
            ))}
          </div>
          <Link href="/consulting" className="inline-flex items-center gap-1.5 border border-ink-200 bg-white hover:bg-ink-50 text-ink-700 text-sm font-600 px-4 py-2.5 rounded-lg transition-all flex-shrink-0">
            Book a session <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── FINAL CTA ────────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section className="bg-brand-600 py-24 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-[80px]" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-white/5 rounded-full blur-[60px]" />
      </div>
      <div className="max-w-2xl mx-auto px-6 text-center relative">
        <div className="text-4xl mb-5">&#10022;</div>
        <h2 className="font-display text-4xl font-800 text-white tracking-tight mb-4 leading-tight">The window is now.</h2>
        <p className="text-blue-100 text-lg leading-relaxed mb-10">No dominant player owns this space yet. The CFO who logs into RevenueLens every morning makes better decisions, faster.</p>
        <div className="flex justify-center gap-4 flex-wrap">
          <Link href="/auth/login" className="inline-flex items-center gap-2 bg-white text-brand-600 text-sm font-700 px-8 py-3.5 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
            Start free — no card required
          </Link>
          <button className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white text-sm font-500 px-6 py-3.5 rounded-xl hover:bg-white/15 transition-all">
            Book a demo
          </button>
        </div>
      </div>
    </section>
  )
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-ink-950 py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-5 gap-10 mb-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
                <BarChart3 size={13} className="text-white" />
              </div>
              <span className="font-display font-700 text-white text-sm">RevenueLens</span>
            </div>
            <p className="text-ink-400 text-sm leading-relaxed max-w-xs">The system that understands your revenue — and tells you what to do next.</p>
          </div>
          {[
            { title:'Product', links:['ARR Bridge','Cohort Analytics','ACV Analysis','AI Intelligence','Pricing'] },
            { title:'Company', links:['About','Consulting','Blog','Careers'] },
            { title:'Legal', links:['Privacy Policy','Terms of Service','Security'] },
          ].map(col => (
            <div key={col.title}>
              <div className="text-ink-300 text-xs font-700 uppercase tracking-widest mb-4">{col.title}</div>
              <ul className="space-y-2">
                {col.links.map(l => (
                  <li key={l}><Link href="#" className="text-ink-400 text-sm hover:text-white transition-colors">{l}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-ink-500 text-sm">&#169; 2026 RevenueLens. All rights reserved.</div>
          <div className="flex items-center gap-2 text-ink-500 text-sm">
            <Star size={12} className="text-amber-400 fill-amber-400" />
            Built for CFOs who want answers, not charts.
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <>
      <Head>
        <title>RevenueLens — Revenue Intelligence for SaaS</title>
        <meta name="description" content="The system that understands your revenue. ARR bridge, cohort analytics, AI insights, and decision recommendations — in minutes." />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Nav />
      <main>
        <Hero />
        <PlatformStory />
        <Features />
        <AISection />
        <CompetitiveTable />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </>
  )
}
