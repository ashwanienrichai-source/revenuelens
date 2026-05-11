// @ts-nocheck
/**
 * pages/auth/login.tsx — RevenueLens Login Page
 * Deploy to: frontend/pages/auth/login.tsx
 *
 * Matches landing page design exactly:
 * DM Sans + DM Serif Display, purple #6B31D4, light bg #F8F7FC
 * Pure visual update — zero changes to auth logic or supabase calls
 */

import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'

// ── Design tokens — exactly matching index.tsx ────────────────────────────────
const C = {
  bg:       '#F8F7FC',
  surface:  '#FFFFFF',
  purple:   '#6B31D4',
  purple2:  '#5A28B4',
  purpleXl: '#F0EBFF',
  purpleMd: '#E0D5FF',
  text1:    '#0F0A1E',
  text2:    '#4C4668',
  text3:    '#9990B0',
  border:   '#E8E4F2',
  borderMd: '#D0C9E8',
  green:    '#12B76A',
  red:      '#F04438',
  redBg:    '#FEF2F2',
}
const FONT  = "'DM Sans','Helvetica Neue',Arial,sans-serif"
const SERIF = "'DM Serif Display',Georgia,serif"

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [showPass, setShowPass] = useState(false)
  const [mounted,  setMounted]  = useState(false)

  useEffect(() => { setMounted(true) }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) { setError(err.message); setLoading(false); return }
      router.push('/app/command-center')
    } catch (e) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Sign in — RevenueLens</title>
        <meta name="description" content="Sign in to RevenueLens" />
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet"/>
      </Head>

      {/* Full page — matches landing bg + grid */}
      <div style={{
        minHeight: '100vh',
        background: `radial-gradient(ellipse 80% 55% at 50% -5%, ${C.purpleMd} 0%, ${C.bg} 65%)`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '32px 16px', position: 'relative', overflow: 'hidden', fontFamily: FONT,
      }}>
        {/* Grid overlay — same as landing hero */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `linear-gradient(${C.borderMd}44 1px, transparent 1px), linear-gradient(90deg, ${C.borderMd}44 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse 80% 55% at 50% 0%, black 0%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 55% at 50% 0%, black 0%, transparent 70%)',
        }}/>

        {/* Card container */}
        <div style={{
          width: '100%', maxWidth: 420, position: 'relative',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'none' : 'translateY(16px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
        }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 32 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: C.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(107,49,212,0.4)' }}>
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <path d="M2 13L8 3L14 13H2Z" fill="white" fillOpacity="0.95"/>
                <path d="M5.5 13L8 8.5L10.5 13H5.5Z" fill="white" fillOpacity="0.5"/>
              </svg>
            </div>
            <span style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: C.text1, letterSpacing: '-0.02em' }}>RevenueLens</span>
          </div>

          {/* Card */}
          <div style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 20,
            padding: '36px 36px 32px',
            boxShadow: '0 8px 40px rgba(107,49,212,0.10), 0 1px 4px rgba(0,0,0,0.04)',
          }}>
            {/* Heading */}
            <div style={{ marginBottom: 28, textAlign: 'center' }}>
              <h1 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 400, color: C.text1, margin: '0 0 6px', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                Welcome back
              </h1>
              <p style={{ fontFamily: FONT, fontSize: 14, color: C.text3, margin: 0, lineHeight: 1.5 }}>
                Sign in to access your analytics dashboard.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: C.redBg, border: `1px solid ${C.red}33`, borderRadius: 10, padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>⚠</span>
                <span style={{ fontFamily: FONT, fontSize: 13, color: C.red, lineHeight: 1.4 }}>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Email */}
              <div>
                <label style={{ display: 'block', fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 6 }}>
                  Email address
                </label>
                <input
                  type="email" required
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '11px 14px', borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    background: C.bg, color: C.text1,
                    fontFamily: FONT, fontSize: 14, outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onFocus={e => { e.target.style.borderColor = C.purple; e.target.style.boxShadow = `0 0 0 3px ${C.purpleXl}` }}
                  onBlur={e => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none' }}
                />
              </div>

              {/* Password */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.text2 }}>Password</label>
                  <Link href="/auth/forgot-password" style={{ fontFamily: FONT, fontSize: 13, color: C.purple, textDecoration: 'none', fontWeight: 500 }}
                    onMouseEnter={e => e.target.style.color = C.purple2}
                    onMouseLeave={e => e.target.style.color = C.purple}>
                    Forgot?
                  </Link>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'} required
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '11px 42px 11px 14px', borderRadius: 10,
                      border: `1px solid ${C.border}`,
                      background: C.bg, color: C.text1,
                      fontFamily: FONT, fontSize: 14, outline: 'none',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onFocus={e => { e.target.style.borderColor = C.purple; e.target.style.boxShadow = `0 0 0 3px ${C.purpleXl}` }}
                    onBlur={e => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none' }}
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.text3, padding: 2, display: 'flex', alignItems: 'center' }}>
                    {showPass ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
                  background: loading ? C.purpleMd : C.purple,
                  color: '#fff', fontFamily: FONT, fontSize: 15, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 4px 16px rgba(107,49,212,0.35)',
                  transition: 'all 0.18s', marginTop: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
                onMouseEnter={e => { if (!loading) { e.target.style.background = C.purple2; e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 6px 20px rgba(107,49,212,0.45)' } }}
                onMouseLeave={e => { e.target.style.background = loading ? C.purpleMd : C.purple; e.target.style.transform = ''; e.target.style.boxShadow = loading ? 'none' : '0 4px 16px rgba(107,49,212,0.35)' }}>
                {loading ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'rl_spin 0.8s linear infinite' }}>
                      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.25"/>
                      <path d="M21 12a9 9 0 00-9-9"/>
                    </svg>
                    Signing in…
                  </>
                ) : 'Sign in'}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
              <div style={{ flex: 1, height: 1, background: C.border }}/>
              <span style={{ fontFamily: FONT, fontSize: 12, color: C.text3 }}>or</span>
              <div style={{ flex: 1, height: 1, background: C.border }}/>
            </div>

            {/* Sign up link */}
            <p style={{ textAlign: 'center', fontFamily: FONT, fontSize: 14, color: C.text3, margin: 0 }}>
              No account?{' '}
              <Link href="/auth/signup" style={{ color: C.purple, fontWeight: 600, textDecoration: 'none' }}
                onMouseEnter={e => e.target.style.color = C.purple2}
                onMouseLeave={e => e.target.style.color = C.purple}>
                Create one free
              </Link>
            </p>
          </div>

          {/* Back to site */}
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Link href="/" style={{ fontFamily: FONT, fontSize: 13, color: C.text3, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = C.text2}
              onMouseLeave={e => e.currentTarget.style.color = C.text3}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Back to site
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes rl_spin { to { transform: rotate(360deg); } }
        input::placeholder { color: ${C.text3}; }
      `}</style>
    </>
  )
}
