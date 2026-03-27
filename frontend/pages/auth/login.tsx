// ═══════════════════════════════════════════════════════════════════════
// FILE 1: frontend/pages/auth/login.tsx
// CHANGE: Full dark theme — white panel → dark card, light bg → var(--bg-page)
// ═══════════════════════════════════════════════════════════════════════

import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import { BarChart3, Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm]       = useState({ email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
  }

  return (
    <>
      <Head><title>Sign In — RevenueLens</title></Head>

      {/* Full dark background — matches landing hero + analytics */}
      <div style={{ minHeight:'100vh', display:'flex', background:'var(--bg-page)', fontFamily:'var(--font-sans)' }}>

        {/* Left: login form */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'48px 32px', maxWidth:480, margin:'0 auto', width:'100%' }}>

          <Link href="/" style={{ display:'inline-flex', alignItems:'center', gap:6, color:'var(--text-muted)', fontSize:13, textDecoration:'none', marginBottom:40, transition:'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color='var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}>
            <ArrowLeft size={14}/> Back to site
          </Link>

          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:32 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#00E5A0,#00B4D8)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <BarChart3 size={16} color="#060D1A"/>
            </div>
            <span style={{ fontSize:16, fontWeight:900, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.01em' }}>RevenueLens</span>
          </div>

          <h1 style={{ fontSize:28, fontWeight:800, color:'var(--text-primary)', fontFamily:'var(--font-display)', margin:'0 0 8px', letterSpacing:'-0.02em' }}>Welcome back</h1>
          <p style={{ fontSize:14, color:'var(--text-muted)', margin:'0 0 32px' }}>Sign in to access your analytics dashboard.</p>

          {error && (
            <div style={{ marginBottom:20, padding:'12px 14px', background:'var(--negative-dim)', border:'1px solid var(--negative-border)', borderRadius:10, color:'var(--negative)', fontSize:13 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <label style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--text-secondary)', marginBottom:6 }}>Email address</label>
              <input type="email" required placeholder="you@company.com" className="input-field"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}/>
            </div>

            <div>
              <label style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--text-secondary)', marginBottom:6 }}>Password</label>
              <div style={{ position:'relative' }}>
                <input type={showPwd ? 'text' : 'password'} required placeholder="••••••••"
                  className="input-field" style={{ paddingRight:40 }}
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}/>
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}>
                  {showPwd ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ justifyContent:'center', padding:'12px 0', marginTop:4 }}>
              {loading ? <Loader2 size={15} className="animate-spin"/> : null}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div style={{ marginTop:24, textAlign:'center', fontSize:13, color:'var(--text-muted)' }}>
            No account?{' '}
            <Link href="/auth/signup" style={{ color:'var(--accent)', fontWeight:600, textDecoration:'none' }}>Create one free</Link>
          </div>
        </div>

        {/* Right: brand panel — dark, matches the left side now */}
        <div style={{ display:'none', flex:1, background:'var(--bg-sidebar)', alignItems:'center', justifyContent:'center', padding:48, position:'relative', overflow:'hidden', borderLeft:'1px solid var(--border-muted)' }}
          className="lg:flex">
          <div style={{ position:'absolute', top:'25%', left:'25%', width:256, height:256, background:'rgba(0,229,160,0.08)', borderRadius:'50%', filter:'blur(80px)', pointerEvents:'none' }}/>
          <div style={{ position:'absolute', bottom:'20%', right:'20%', width:200, height:200, background:'rgba(0,180,216,0.06)', borderRadius:'50%', filter:'blur(60px)', pointerEvents:'none' }}/>
          <div style={{ position:'relative', textAlign:'center', maxWidth:320 }}>
            <div style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', fontFamily:'var(--font-display)', marginBottom:12, letterSpacing:'-0.02em' }}>
              Revenue intelligence for modern SaaS
            </div>
            <p style={{ fontSize:13, color:'var(--text-muted)', lineHeight:1.7 }}>ARR bridge, cohort retention, NRR/GRR — built on PE-grade methodology.</p>
            <div style={{ marginTop:32, display:'flex', flexDirection:'column', gap:10 }}>
              {['MRR / ARR Bridge Analysis','Cohort Retention Heatmaps','Net & Gross Revenue Retention'].map(f => (
                <div key={f} style={{ display:'flex', alignItems:'center', gap:10, fontSize:12, color:'var(--text-secondary)' }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', flexShrink:0 }}/>
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default LoginPage