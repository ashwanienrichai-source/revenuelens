import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AuthCallback() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase automatically exchanges the code/token from the URL
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          setErrorMsg(error.message)
          setStatus('error')
          return
        }

        if (data.session) {
          // Session exists — ensure profile row exists for OAuth users
          const user = data.session.user
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .single()

          if (!existingProfile) {
            // First-time OAuth user — create their profile
            await supabase.from('profiles').insert({
              id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
              role: 'Other',
              subscription_status: 'free',
            })
          }

          // Redirect to dashboard
          router.replace('/dashboard')
        } else {
          // No session yet — may still be processing
          // Give Supabase a moment then check again
          setTimeout(async () => {
            const { data: retryData, error: retryError } = await supabase.auth.getSession()
            if (retryData?.session) {
              router.replace('/dashboard')
            } else {
              setErrorMsg(retryError?.message || 'Authentication failed. Please try again.')
              setStatus('error')
            }
          }, 1500)
        }
      } catch (err) {
        setErrorMsg('Something went wrong. Please try again.')
        setStatus('error')
      }
    }

    handleCallback()
  }, [router])

  const s: Record<string, React.CSSProperties> = {
    page: {
      minHeight: '100vh',
      backgroundColor: '#F8F7FC',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
    },
    card: {
      backgroundColor: '#FFFFFF',
      borderRadius: '16px',
      border: '1px solid #E8E4F2',
      padding: '48px 40px',
      textAlign: 'center',
      maxWidth: '380px',
      width: '100%',
      boxShadow: '0 4px 24px rgba(107,49,212,0.06)',
    },
    spinner: {
      width: '40px',
      height: '40px',
      border: '3px solid #F0EBFF',
      borderTop: '3px solid #6B31D4',
      borderRadius: '50%',
      margin: '0 auto 20px',
      animation: 'spin 0.8s linear infinite',
    },
    heading: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: '22px',
      color: '#0F0A1E',
      marginBottom: '8px',
      fontWeight: 400,
    },
    sub: {
      fontSize: '14px',
      color: '#9990B0',
    },
    errorIcon: {
      fontSize: '36px',
      marginBottom: '16px',
    },
    errorText: {
      fontSize: '14px',
      color: '#F04438',
      marginBottom: '20px',
    },
    backBtn: {
      padding: '10px 24px',
      borderRadius: '10px',
      border: 'none',
      backgroundColor: '#6B31D4',
      color: '#FFFFFF',
      fontSize: '14px',
      fontWeight: 500,
      cursor: 'pointer',
      fontFamily: "'DM Sans', sans-serif",
    },
  }

  return (
    <>
      <Head>
        <title>Signing in — RevenueLens AI</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display&display=swap" rel="stylesheet" />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </Head>
      <div style={s.page}>
        <div style={s.card}>
          {status === 'loading' ? (
            <>
              <div style={s.spinner} />
              <h2 style={s.heading}>Signing you in...</h2>
              <p style={s.sub}>Setting up your revenue command center</p>
            </>
          ) : (
            <>
              <div style={s.errorIcon}>⚠️</div>
              <h2 style={s.heading}>Something went wrong</h2>
              <p style={s.errorText}>{errorMsg}</p>
              <button
                style={s.backBtn}
                onClick={() => router.push('/auth/login')}
              >
                Back to login
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
