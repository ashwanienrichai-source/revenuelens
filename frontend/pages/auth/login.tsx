// @ts-nocheck
/**
 * frontend/pages/auth/login.tsx — REFACTORED
 *
 * CHANGES from old version:
 *   - REMOVE: white left panel (text-ink-900 on white background)
 *   - REMOVE: dark right panel split (was visually two different products)
 *   - REMOVE: bg-ink-950 / raw hex / Syne font
 *   - ADD: AuthLayout wrapper — unified dark card matching app
 *   - ADD: token-based colors throughout
 *   - KEEP: all auth logic, form validation, Supabase call, routing
 */

import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import { Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react'
import { AuthLayout } from '../../components/layout/AuthLayout'

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
      <AuthLayout title="Welcome back" subtitle="Sign in to access your analytics dashboard.">

        {/* Error */}
        {error && (
          <div style={{
            marginBottom:16, padding:'10px 13px',
            background:'var(--color-negative-dim)',
            border:'1px solid var(--color-negative-border)',
            borderRadius:'var(--radius-input)',
            fontSize:13, color:'var(--color-negative)',
          }}>{error}</div>
        )}

        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'var(--color-text-primary)', marginBottom:6 }}>
              Email address
            </label>
            <input type="email" required placeholder="you@company.com" className="input-field"
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}/>
          </div>

          <div>
            <label style={{ display:'block', fontSize:13, fontWeight:500, color:'var(--color-text-primary)', marginBottom:6 }}>
              Password
            </label>
            <div style={{ position:'relative' }}>
              <input type={showPwd ? 'text' : 'password'} required placeholder="••••••••"
                className="input-field" style={{ paddingRight:40 }}
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}/>
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                style={{ position:'absolute', right:11, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--color-text-secondary)', display:'flex' }}>
                {showPwd ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary"
            style={{ justifyContent:'center', width:'100%', padding:'11px 0', marginTop:4 }}>
            {loading && <Loader2 size={14} className="animate-spin"/>}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={{ marginTop:20, textAlign:'center', fontSize:13, color:'var(--color-text-secondary)' }}>
          No account?{' '}
          <Link href="/auth/signup" style={{ color:'var(--color-accent)', fontWeight:600, textDecoration:'none' }}>
            Create one free
          </Link>
        </div>

        <div style={{ marginTop:16, textAlign:'center' }}>
          <Link href="/" style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, color:'var(--color-text-secondary)', textDecoration:'none' }}>
            <ArrowLeft size={12}/> Back to site
          </Link>
        </div>

      </AuthLayout>
    </>
  )
}
