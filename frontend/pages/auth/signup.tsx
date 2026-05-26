// @ts-nocheck
/**
 * pages/auth/signup.tsx — RevenueLens Signup Page
 * Deploy to: frontend/pages/auth/signup.tsx
 */

import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'

const C = {
  bg: '#F8F7FC', surface: '#FFFFFF', purple: '#6B31D4', purple2: '#5A28B4',
  purpleXl: '#F0EBFF', purpleMd: '#E0D5FF', text1: '#0F0A1E', text2: '#4C4668',
  text3: '#9990B0', border: '#E8E4F2', borderMd: '#D0C9E8',
  green: '#12B76A', greenBg: '#F0FDF4', red: '#F04438', redBg: '#FEF2F2',
}
const FONT  = "'DM Sans','Helvetica Neue',Arial,sans-serif"
const SERIF = "'DM Serif Display',Georgia,serif"
const ROLES = ['CFO', 'Founder', 'RevOps', 'Finance', 'Other']

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 10,
  border: `1px solid ${C.border}`, background: C.bg, color: C.text1,
  fontFamily: FONT, fontSize: 14, outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}

function InputField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

export default function SignupPage() {
  const router  = useRouter()
  const [step,    setStep]    = useState<'form' | 'otp'>('form')
  const [form,    setForm]    = useState({ fullName: '', company: '', role: '', phone: '', email: '', password: '' })
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // CHANGED: destructure data so we get user.id back
      const { data, error: err } = await supabase.auth.signUp({
        email:    form.email,
        password: form.password,
        options: {
          data: {
            full_name:    form.fullName,
            company_name: form.company,
            role:         form.role,
            phone:        form.phone,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (err) { setError(err.message); setLoading(false); return }

      // ADDED: save profile directly — no trigger needed
      if (data?.user?.id) {
        await supabase.from('profiles').upsert({
          id:           data.user.id,
          email:        form.email,
          full_name:    form.fullName,
          company_name: form.company,
          role:         form.role,
          phone:        form.phone,
        }, { onConflict: 'id' })
      }

      setStep('otp')
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  async function handleLinkedIn() {
    setError('')
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'linkedin_oidc',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (err) setError(err.message)
  }

  async function handleResend() {
    setError('')
    const { error: err } = await supabase.auth.resend({ type: 'signup', email: form.email })
    if (err) setError(err.message)
  }

  const setF = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }))
  const focusIn  = (e: any) => { e.target.style.borderColor = C.purple; e.target.style.boxShadow = `0 0 0 3px ${C.purpleXl}` }
  const focusOut = (e: any) => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none' }

  return (
    <>
      <Head>
        <title>Create Account — RevenueLens</title>
        <meta name="description" content="Create your RevenueLens account" />
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet"/>
      </Head>

      <div style={{
        minHeight: '100vh',
        background: `radial-gradient(ellipse 80% 55% at 50% -5%, ${C.purpleMd} 0%, ${C.bg} 65%)`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '32px 16px', position: 'relative', overflow: 'hidden', fontFamily: FONT,
      }}>
        <div aria-hidden style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `linear-gradient(${C.borderMd}44 1px, transparent 1px), linear-gradient(90deg, ${C.borderMd}44 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse 80% 55% at 50% 0%, black 0%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 55% at 50% 0%, black 0%, transparent 70%)',
        }}/>

        <div style={{
          width: '100%', maxWidth: 460, position: 'relative',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'none' : 'translateY(16px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 32 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: C.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(107,49,212,0.4)' }}>
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <path d="M2 13L8 3L14 13H2Z" fill="white" fillOpacity="0.95"/>
                <path d="M5.5 13L8 8.5L10.5 13H5.5Z" fill="white" fillOpacity="0.5"/>
              </svg>
            </div>
            <span style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: C.text1, letterSpacing: '-0.02em' }}>RevenueLens</span>
          </div>

          {step === 'otp' ? (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: '36px 36px 32px', boxShadow: '0 8px 40px rgba(107,49,212,0.10), 0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: C.purpleXl, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.purple} strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </div>
                <h1 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 400, color: C.text1, margin: '0 0 8px', letterSpacing: '-0.02em' }}>Check your email</h1>
                <p style={{ fontFamily: FONT, fontSize: 14, color: C.text3, margin: 0, lineHeight: 1.5 }}>
                  We sent a confirmation link to<br/>
                  <strong style={{ color: C.text2 }}>{form.email}</strong>
                </p>
              </div>
              {error && (
                <div style={{ background: C.redBg, border: `1px solid ${C.red}33`, borderRadius: 10, padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>⚠</span>
                  <span style={{ fontFamily: FONT, fontSize: 13, color: C.red, lineHeight: 1.4 }}>{error}</span>
                </div>
              )}
              <div style={{ background: C.purpleXl, borderRadius: 12, padding: '16px 20px', marginBottom: 20, textAlign: 'center' }}>
                <p style={{ fontFamily: FONT, fontSize: 14, color: C.purple, margin: 0, lineHeight: 1.6 }}>
                  Click the link in your email to verify your account and access RevenueLens.
                </p>
              </div>
              <p style={{ textAlign: 'center', fontFamily: FONT, fontSize: 13, color: C.text3, margin: 0 }}>
                Didn't get it?{' '}
                <button onClick={handleResend} style={{ background: 'none', border: 'none', color: C.purple, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, fontSize: 13, padding: 0 }}>
                  Resend email
                </button>
                {' '}or{' '}
                <button onClick={() => setStep('form')} style={{ background: 'none', border: 'none', color: C.text3, cursor: 'pointer', fontFamily: FONT, fontSize: 13, padding: 0, textDecoration: 'underline' }}>
                  go back
                </button>
              </p>
            </div>
          ) : (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: '36px 36px 32px', boxShadow: '0 8px 40px rgba(107,49,212,0.10), 0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ marginBottom: 28, textAlign: 'center' }}>
                <h1 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 400, color: C.text1, margin: '0 0 6px', letterSpacing: '-0.02em', lineHeight: 1.15 }}>Create your account</h1>
                <p style={{ fontFamily: FONT, fontSize: 14, color: C.text3, margin: 0, lineHeight: 1.5 }}>Free to start. No credit card required.</p>
              </div>

              <button onClick={handleLinkedIn} type="button"
                style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.text1, fontFamily: FONT, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'all 0.15s', marginBottom: 20 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.borderMd; (e.currentTarget as HTMLElement).style.background = C.bg }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).style.background = C.surface }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                Continue with LinkedIn
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: C.border }}/>
                <span style={{ fontFamily: FONT, fontSize: 12, color: C.text3 }}>or sign up with email</span>
                <div style={{ flex: 1, height: 1, background: C.border }}/>
              </div>

              {error && (
                <div style={{ background: C.redBg, border: `1px solid ${C.red}33`, borderRadius: 10, padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>⚠</span>
                  <span style={{ fontFamily: FONT, fontSize: 13, color: C.red, lineHeight: 1.4 }}>{error}</span>
                </div>
              )}

              <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <InputField label="Full name">
                    <input type="text" required placeholder="Ashwani Vats" value={form.fullName} onChange={setF('fullName')} style={inputStyle} onFocus={focusIn} onBlur={focusOut}/>
                  </InputField>
                  <InputField label="Company">
                    <input type="text" required placeholder="Acme Corp" value={form.company} onChange={setF('company')} style={inputStyle} onFocus={focusIn} onBlur={focusOut}/>
                  </InputField>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <InputField label="Your role">
                    <select required value={form.role} onChange={setF('role')}
                      style={{ ...inputStyle, appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 6L11 1' stroke='%239990B0' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 32, color: form.role ? C.text1 : C.text3 }}
                      onFocus={focusIn} onBlur={focusOut}>
                      <option value="" disabled>Select role</option>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </InputField>
                  <InputField label="Phone (optional)">
                    <input type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={setF('phone')} style={inputStyle} onFocus={focusIn} onBlur={focusOut}/>
                  </InputField>
                </div>
                <InputField label="Work email">
                  <input type="email" required placeholder="you@company.com" value={form.email} onChange={setF('email')} style={inputStyle} onFocus={focusIn} onBlur={focusOut}/>
                </InputField>
                <InputField label="Password">
                  <div style={{ position: 'relative' }}>
                    <input type={showPwd ? 'text' : 'password'} required minLength={8} placeholder="Min 8 characters" value={form.password} onChange={setF('password')} style={{ ...inputStyle, paddingRight: 42 }} onFocus={focusIn} onBlur={focusOut}/>
                    <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.text3, padding: 2, display: 'flex', alignItems: 'center' }}>
                      {showPwd ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                    </button>
                  </div>
                </InputField>
                <button type="submit" disabled={loading}
                  style={{ width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', background: loading ? C.purpleMd : C.purple, color: '#fff', fontFamily: FONT, fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 4px 16px rgba(107,49,212,0.35)', transition: 'all 0.18s', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.background = C.purple2; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(107,49,212,0.45)' } }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = loading ? C.purpleMd : C.purple; (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = loading ? 'none' : '0 4px 16px rgba(107,49,212,0.35)' }}>
                  {loading ? <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'rl_spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.25"/><path d="M21 12a9 9 0 00-9-9"/></svg>Creating account…</> : 'Create free account →'}
                </button>
                <p style={{ fontFamily: FONT, fontSize: 11, color: C.text3, textAlign: 'center', margin: '4px 0 0', lineHeight: 1.5 }}>
                  By creating an account you agree to our{' '}
                  <Link href="/privacy" style={{ color: C.purple, textDecoration: 'none' }}>Privacy Policy</Link>{' '}and{' '}
                  <Link href="/terms" style={{ color: C.purple, textDecoration: 'none' }}>Terms of Service</Link>
                </p>
              </form>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0 0' }}>
                <div style={{ flex: 1, height: 1, background: C.border }}/>
                <span style={{ fontFamily: FONT, fontSize: 12, color: C.text3 }}>already have an account?</span>
                <div style={{ flex: 1, height: 1, background: C.border }}/>
              </div>
              <Link href="/auth/login"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '11px 0', borderRadius: 10, marginTop: 12, border: `1px solid ${C.border}`, background: 'transparent', color: C.text2, fontFamily: FONT, fontSize: 14, fontWeight: 600, textDecoration: 'none', transition: 'all 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.purple; (e.currentTarget as HTMLElement).style.color = C.purple }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).style.color = C.text2 }}>
                Sign in instead
              </Link>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Link href="/" style={{ fontFamily: FONT, fontSize: 13, color: C.text3, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = C.text2}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = C.text3}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Back to site
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes rl_spin { to { transform: rotate(360deg); } }
        input::placeholder { color: ${C.text3}; }
        select option { color: ${C.text1}; }
      `}</style>
    </>
  )
}
