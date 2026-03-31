// @ts-nocheck
/**
 * frontend/pages/auth/login.tsx
 * Inline styles only — no CSS var dependencies, guaranteed to render correctly.
 * Design: centered card on light grey background (Stripe/Linear auth style)
 */

import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import { Eye, EyeOff, ArrowLeft, Loader2, BarChart3 } from 'lucide-react'

const C = {
  bg:      '#F9FAFB',
  white:   '#FFFFFF',
  border:  '#E5E7EB',
  text:    '#111827',
  text2:   '#6B7280',
  text3:   '#9CA3AF',
  accent:  '#003A8F',
  red:     '#DC2626',
  redSoft: '#FEF2F2',
  redBdr:  '#FECACA',
  font:    "'Inter', system-ui, sans-serif",
}

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm]       = useState({ email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email, password: form.password
    })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
  }

  return (
    <>
      <Head><title>Sign In — RevenueLens</title></Head>
      <div style={{
        minHeight:   '100vh',
        display:     'flex',
        alignItems:  'center',
        justifyContent: 'center',
        background:  C.bg,
        fontFamily:  C.font,
        padding:     '40px 16px',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Logo */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 10, marginBottom: 32,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: C.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BarChart3 size={16} color="#fff" strokeWidth={2}/>
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>
              RevenueLens
            </span>
          </div>

          {/* Card */}
          <div style={{
            background:   C.white,
            border:       `1px solid ${C.border}`,
            borderRadius: 12,
            padding:      '28px 32px',
            boxShadow:    '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
          }}>
            <h1 style={{
              margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 700,
              color: C.text, letterSpacing: '-0.02em',
            }}>
              Welcome back
            </h1>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: C.text2 }}>
              Sign in to access your analytics dashboard.
            </p>

            {/* Error */}
            {error && (
              <div style={{
                marginBottom: 16, padding: '10px 13px',
                background: C.redSoft, border: `1px solid ${C.redBdr}`,
                borderRadius: 7, fontSize: 13, color: C.red,
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{
                  display: 'block', fontSize: 13, fontWeight: 500,
                  color: C.text, marginBottom: 5,
                }}>
                  Email address
                </label>
                <input
                  type="email" required placeholder="you@company.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  style={{
                    display: 'block', width: '100%', padding: '8px 12px',
                    background: C.white, border: `1px solid ${C.border}`,
                    borderRadius: 6, fontFamily: C.font, fontSize: 14,
                    color: C.text, outline: 'none', transition: 'border-color 150ms',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = C.accent; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
                  onBlur={e  => { e.target.style.borderColor = C.border;  e.target.style.boxShadow = 'none' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                    Password
                  </label>
                  <Link href="/auth/forgot" style={{ fontSize: 12, color: C.accent, textDecoration: 'none' }}>
                    Forgot?
                  </Link>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPwd ? 'text' : 'password'} required placeholder="••••••••"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    style={{
                      display: 'block', width: '100%', padding: '8px 40px 8px 12px',
                      background: C.white, border: `1px solid ${C.border}`,
                      borderRadius: 6, fontFamily: C.font, fontSize: 14,
                      color: C.text, outline: 'none', transition: 'border-color 150ms',
                      boxSizing: 'border-box',
                    }}
                    onFocus={e => { e.target.style.borderColor = C.accent; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
                    onBlur={e  => { e.target.style.borderColor = C.border;  e.target.style.boxShadow = 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    style={{
                      position: 'absolute', right: 11, top: '50%',
                      transform: 'translateY(-50%)', background: 'none',
                      border: 'none', cursor: 'pointer', color: C.text3, display: 'flex',
                    }}
                  >
                    {showPwd ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  width: '100%', padding: '9px 0', marginTop: 4,
                  background: loading ? '#93C5FD' : C.accent, color: '#fff',
                  border: 'none', borderRadius: 6, fontFamily: C.font,
                  fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background 150ms',
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#1D4ED8' }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.background = C.accent }}
              >
                {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }}/>}
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: C.text2 }}>
              No account?{' '}
              <Link href="/auth/signup" style={{ color: C.accent, fontWeight: 600, textDecoration: 'none' }}>
                Create one free
              </Link>
            </p>
          </div>

          {/* Back link */}
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <Link href="/" style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 12, color: C.text2, textDecoration: 'none',
              transition: 'color 150ms',
            }}>
              <ArrowLeft size={12}/> Back to site
            </Link>
          </div>
        </div>

        {/* Keyframes */}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </>
  )
}
