// @ts-nocheck
/**
 * pages/auth/callback.tsx
 * 
 * Handles Supabase OAuth + Magic Link redirects.
 * 
 * Supabase sends tokens in TWO formats depending on auth method:
 *   Hash fragment:  /auth/callback#access_token=...&refresh_token=...  (implicit flow / magic link)
 *   Query string:   /auth/callback?code=...                             (PKCE flow / OAuth)
 * 
 * This page handles BOTH.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'

// Create Supabase client directly here — avoids any import chain issues
// that could fail silently and cause "Authentication failed"
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Stage = 'processing' | 'success' | 'error'

export default function AuthCallback() {
  const router = useRouter()
  const [stage, setStage]   = useState<Stage>('processing')
  const [message, setMessage] = useState('Completing sign-in…')

  useEffect(() => {
    // Wait for router to be ready (query params available)
    if (!router.isReady) return
    handleCallback()
  }, [router.isReady])

  async function handleCallback() {
    try {
      // ── PATH 1: Hash fragment (implicit flow / magic link / email OTP) ────────
      // Supabase puts tokens in the URL hash: #access_token=...&refresh_token=...
      if (typeof window !== 'undefined' && window.location.hash) {
        const hash   = window.location.hash.substring(1) // strip leading #
        const params = new URLSearchParams(hash)
        const accessToken  = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        const errorDesc    = params.get('error_description')

        if (errorDesc) {
          throw new Error(decodeURIComponent(errorDesc.replace(/\+/g, ' ')))
        }

        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token:  accessToken,
            refresh_token: refreshToken,
          })
          if (error) throw error
          if (!data.session) throw new Error('Session not established')

          setStage('success')
          setMessage('Signed in successfully. Redirecting…')
          await redirectAfterAuth()
          return
        }
      }

      // ── PATH 2: Query string code (PKCE / OAuth / Google) ───────────────────
      // Supabase sends a one-time code: ?code=...
      const code = router.query.code as string | undefined
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) throw error
        if (!data.session) throw new Error('Session not established after code exchange')

        setStage('success')
        setMessage('Signed in successfully. Redirecting…')
        await redirectAfterAuth()
        return
      }

      // ── PATH 3: Session already exists (page refreshed mid-flow) ────────────
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setStage('success')
        setMessage('Already signed in. Redirecting…')
        await redirectAfterAuth()
        return
      }

      // Nothing worked
      throw new Error('No authentication token found. Please sign in again.')

    } catch (err: any) {
      console.error('[AuthCallback] Error:', err)
      setStage('error')
      setMessage(err?.message || 'Authentication failed. Please try again.')
    }
  }

  async function redirectAfterAuth() {
    // Respect intended destination (stored before auth redirect)
    const next = router.query.next as string
    const destination = (next && next.startsWith('/') && !next.startsWith('//'))
      ? next
      : '/dashboard'
    // Small delay so user sees success state
    setTimeout(() => router.replace(destination), 800)
  }

  // ── UI ──────────────────────────────────────────────────────────────────────
  const isError = stage === 'error'

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F8F7FC',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        background: '#fff',
        border: '1px solid #E5E7EB',
        borderRadius: 16,
        padding: '40px 48px',
        maxWidth: 420,
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        {/* Icon */}
        <div style={{ fontSize: 40, marginBottom: 16 }}>
          {stage === 'processing' && '🔐'}
          {stage === 'success'    && '✅'}
          {stage === 'error'      && '⚠️'}
        </div>

        {/* Title */}
        <div style={{
          fontSize: 20,
          fontWeight: 700,
          color: '#111827',
          marginBottom: 8,
        }}>
          {stage === 'processing' && 'Signing you in'}
          {stage === 'success'    && 'Welcome back'}
          {stage === 'error'      && 'Something went wrong'}
        </div>

        {/* Message */}
        <div style={{
          fontSize: 14,
          color: isError ? '#EF4444' : '#6B7280',
          marginBottom: 24,
          lineHeight: 1.5,
        }}>
          {message}
        </div>

        {/* Spinner (processing only) */}
        {stage === 'processing' && (
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '3px solid #E5E7EB',
            borderTop: '3px solid #6B31D4',
            margin: '0 auto',
            animation: 'spin 0.8s linear infinite',
          }} />
        )}

        {/* Error action */}
        {stage === 'error' && (
          <button
            onClick={() => router.replace('/login')}
            style={{
              background: '#6B31D4',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Back to login
          </button>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
