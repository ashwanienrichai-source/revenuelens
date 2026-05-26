import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ROLES = ['CFO', 'Founder', 'RevOps', 'Finance', 'Other']

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    fullName: '',
    company: '',
    role: '',
    phone: '',
    email: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [linkedinLoading, setLinkedinLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const s: Record<string, React.CSSProperties> = {
    page: {
      minHeight: '100vh',
      backgroundColor: '#F8F7FC',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: "'DM Sans', sans-serif",
    },
    card: {
      backgroundColor: '#FFFFFF',
      borderRadius: '16px',
      border: '1px solid #E8E4F2',
      padding: '40px',
      width: '100%',
      maxWidth: '480px',
      boxShadow: '0 4px 24px rgba(107,49,212,0.06)',
    },
    logo: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '28px',
    },
    logoMark: {
      width: '32px',
      height: '32px',
      borderRadius: '8px',
      backgroundColor: '#6B31D4',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoText: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: '18px',
      color: '#0F0A1E',
      fontWeight: 400,
    },
    heading: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: '26px',
      color: '#0F0A1E',
      marginBottom: '6px',
      fontWeight: 400,
    },
    subheading: {
      fontSize: '14px',
      color: '#9990B0',
      marginBottom: '28px',
    },
    // Social buttons row
    socialRow: {
      display: 'flex',
      gap: '10px',
      marginBottom: '20px',
    },
    socialBtn: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '11px 16px',
      borderRadius: '10px',
      border: '1px solid #E8E4F2',
      backgroundColor: '#FFFFFF',
      color: '#0F0A1E',
      fontSize: '13px',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      fontFamily: "'DM Sans', sans-serif",
    },
    dividerRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '20px',
    },
    dividerLine: {
      flex: 1,
      height: '1px',
      backgroundColor: '#E8E4F2',
    },
    dividerText: {
      fontSize: '12px',
      color: '#9990B0',
      whiteSpace: 'nowrap' as const,
    },
    label: {
      display: 'block',
      fontSize: '13px',
      fontWeight: 500,
      color: '#4C4668',
      marginBottom: '6px',
    },
    input: {
      width: '100%',
      padding: '11px 14px',
      borderRadius: '10px',
      border: '1px solid #E8E4F2',
      backgroundColor: '#FFFFFF',
      color: '#0F0A1E',
      fontSize: '14px',
      fontFamily: "'DM Sans', sans-serif",
      outline: 'none',
      boxSizing: 'border-box' as const,
      transition: 'border-color 0.15s ease',
    },
    row: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '12px',
      marginBottom: '14px',
    },
    field: {
      marginBottom: '14px',
    },
    select: {
      width: '100%',
      padding: '11px 14px',
      borderRadius: '10px',
      border: '1px solid #E8E4F2',
      backgroundColor: '#FFFFFF',
      color: '#0F0A1E',
      fontSize: '14px',
      fontFamily: "'DM Sans', sans-serif",
      outline: 'none',
      boxSizing: 'border-box' as const,
      appearance: 'none' as const,
      cursor: 'pointer',
    },
    submitBtn: {
      width: '100%',
      padding: '13px',
      borderRadius: '10px',
      border: 'none',
      backgroundColor: '#6B31D4',
      color: '#FFFFFF',
      fontSize: '15px',
      fontWeight: 600,
      cursor: 'pointer',
      fontFamily: "'DM Sans', sans-serif",
      marginTop: '6px',
      transition: 'background-color 0.15s ease',
    },
    error: {
      backgroundColor: '#FFF0EE',
      border: '1px solid #F04438',
      borderRadius: '8px',
      padding: '10px 14px',
      color: '#F04438',
      fontSize: '13px',
      marginBottom: '16px',
    },
    success: {
      backgroundColor: '#F0FFF8',
      border: '1px solid #12B76A',
      borderRadius: '8px',
      padding: '16px',
      color: '#0A7A47',
      fontSize: '14px',
      textAlign: 'center' as const,
    },
    footer: {
      textAlign: 'center' as const,
      marginTop: '20px',
      fontSize: '13px',
      color: '#9990B0',
    },
    link: {
      color: '#6B31D4',
      textDecoration: 'none',
      fontWeight: 500,
    },
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleGoogleSignup = async () => {
    setGoogleLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  const handleLinkedInSignup = async () => {
    setLinkedinLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'linkedin_oidc',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setLinkedinLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!form.fullName || !form.email || !form.password || !form.role) {
      setError('Please fill in all required fields.')
      setLoading(false)
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      setLoading(false)
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          company_name: form.company,
          role: form.role,
          phone: form.phone,
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        email: form.email,
        full_name: form.fullName,
        company_name: form.company,
        role: form.role,
        phone: form.phone,
        subscription_status: 'free',
      })
      if (profileError) console.error('Profile error:', profileError)
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.logo}>
            <div style={s.logoMark}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 13L8 3L13 13H3Z" fill="white" fillOpacity="0.9"/>
              </svg>
            </div>
            <span style={s.logoText}>RevenueLens AI</span>
          </div>
          <div style={s.success}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>✉️</div>
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>Check your email</div>
            <div style={{ color: '#4C4668', fontSize: '13px' }}>
              We sent a confirmation link to <strong>{form.email}</strong>.<br />
              Click it to activate your account.
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Sign Up — RevenueLens AI</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display&display=swap" rel="stylesheet" />
      </Head>
      <div style={s.page}>
        <div style={s.card}>
          {/* Logo */}
          <div style={s.logo}>
            <div style={s.logoMark}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 13L8 3L13 13H3Z" fill="white" fillOpacity="0.9"/>
              </svg>
            </div>
            <span style={s.logoText}>RevenueLens AI</span>
          </div>

          <h1 style={s.heading}>Create your account</h1>
          <p style={s.subheading}>Start your revenue intelligence journey</p>

          {/* Social Buttons */}
          <div style={s.socialRow}>
            {/* Google */}
            <button
              style={{
                ...s.socialBtn,
                opacity: googleLoading ? 0.7 : 1,
              }}
              onClick={handleGoogleSignup}
              disabled={googleLoading || linkedinLoading}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F8F7FC'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#D0C9E8' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#FFFFFF'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#E8E4F2' }}
            >
              {googleLoading ? (
                <span style={{ fontSize: '13px' }}>Redirecting...</span>
              ) : (
                <>
                  {/* Google G logo */}
                  <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16.32 8.69c0-.57-.05-1.12-.14-1.64H8.5v3.1h4.4a3.76 3.76 0 01-1.63 2.47v2.05h2.64c1.55-1.43 2.44-3.53 2.44-6z" fill="#4285F4"/>
                    <path d="M8.5 17c2.21 0 4.07-.73 5.42-1.98l-2.64-2.05c-.73.49-1.67.78-2.78.78-2.14 0-3.95-1.44-4.6-3.38H1.18v2.12A8.5 8.5 0 008.5 17z" fill="#34A853"/>
                    <path d="M3.9 10.37A5.1 5.1 0 013.63 8.5c0-.65.11-1.28.27-1.87V4.51H1.18A8.5 8.5 0 000 8.5c0 1.37.33 2.67.9 3.82l2.77-1.95z" fill="#FBBC05"/>
                    <path d="M8.5 3.38c1.2 0 2.29.41 3.14 1.22l2.35-2.35A8.36 8.36 0 008.5 0 8.5 8.5 0 001.18 4.51L3.9 6.63C4.55 4.69 6.36 3.38 8.5 3.38z" fill="#EA4335"/>
                  </svg>
                  Google
                </>
              )}
            </button>

            {/* LinkedIn */}
            <button
              style={{
                ...s.socialBtn,
                opacity: linkedinLoading ? 0.7 : 1,
              }}
              onClick={handleLinkedInSignup}
              disabled={googleLoading || linkedinLoading}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F8F7FC'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#D0C9E8' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#FFFFFF'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#E8E4F2' }}
            >
              {linkedinLoading ? (
                <span style={{ fontSize: '13px' }}>Redirecting...</span>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect width="16" height="16" rx="3" fill="#0A66C2"/>
                    <path d="M3.5 6H5.5V12.5H3.5V6ZM4.5 5.2C3.84 5.2 3.3 4.66 3.3 4 3.3 3.34 3.84 2.8 4.5 2.8 5.16 2.8 5.7 3.34 5.7 4 5.7 4.66 5.16 5.2 4.5 5.2ZM12.5 12.5H10.5V9.3C10.5 8.2 10.08 7.7 9.3 7.7 8.48 7.7 8 8.24 8 9.3V12.5H6V6H8V7C8.38 6.36 9.08 6 9.96 6 11.4 6 12.5 6.96 12.5 8.9V12.5Z" fill="white"/>
                  </svg>
                  LinkedIn
                </>
              )}
            </button>
          </div>

          {/* Divider */}
          <div style={s.dividerRow}>
            <div style={s.dividerLine} />
            <span style={s.dividerText}>or sign up with email</span>
            <div style={s.dividerLine} />
          </div>

          {error && <div style={s.error}>{error}</div>}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={s.row}>
              <div>
                <label style={s.label}>Full name *</label>
                <input
                  style={s.input}
                  name="fullName"
                  type="text"
                  placeholder="Ashwani Kumar"
                  value={form.fullName}
                  onChange={handleChange}
                  required
                  onFocus={e => e.currentTarget.style.borderColor = '#6B31D4'}
                  onBlur={e => e.currentTarget.style.borderColor = '#E8E4F2'}
                />
              </div>
              <div>
                <label style={s.label}>Company</label>
                <input
                  style={s.input}
                  name="company"
                  type="text"
                  placeholder="Acme Inc."
                  value={form.company}
                  onChange={handleChange}
                  onFocus={e => e.currentTarget.style.borderColor = '#6B31D4'}
                  onBlur={e => e.currentTarget.style.borderColor = '#E8E4F2'}
                />
              </div>
            </div>

            <div style={s.row}>
              <div>
                <label style={s.label}>Role *</label>
                <select
                  style={s.select}
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  required
                  onFocus={e => e.currentTarget.style.borderColor = '#6B31D4'}
                  onBlur={e => e.currentTarget.style.borderColor = '#E8E4F2'}
                >
                  <option value="">Select role</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>Phone</label>
                <input
                  style={s.input}
                  name="phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={handleChange}
                  onFocus={e => e.currentTarget.style.borderColor = '#6B31D4'}
                  onBlur={e => e.currentTarget.style.borderColor = '#E8E4F2'}
                />
              </div>
            </div>

            <div style={s.field}>
              <label style={s.label}>Email *</label>
              <input
                style={s.input}
                name="email"
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={handleChange}
                required
                onFocus={e => e.currentTarget.style.borderColor = '#6B31D4'}
                onBlur={e => e.currentTarget.style.borderColor = '#E8E4F2'}
              />
            </div>

            <div style={s.field}>
              <label style={s.label}>Password *</label>
              <input
                style={s.input}
                name="password"
                type="password"
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={handleChange}
                required
                onFocus={e => e.currentTarget.style.borderColor = '#6B31D4'}
                onBlur={e => e.currentTarget.style.borderColor = '#E8E4F2'}
              />
            </div>

            <button
              type="submit"
              style={{
                ...s.submitBtn,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
              disabled={loading}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#5A28B4' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#6B31D4' }}
            >
              {loading ? 'Creating account...' : 'Create account →'}
            </button>
          </form>

          <div style={s.footer}>
            Already have an account?{' '}
            <Link href="/auth/login" style={s.link}>Sign in</Link>
          </div>
        </div>
      </div>
    </>
  )
}
