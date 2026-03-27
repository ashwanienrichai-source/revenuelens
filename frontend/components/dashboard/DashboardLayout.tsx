// @ts-nocheck
/**
 * DashboardLayout.tsx — Unified dark app shell
 *
 * Replaces the old light-theme layout. All app pages (dashboard,
 * analytics, command-center) use this single layout so they feel
 * like one product.
 *
 * Deploy to:
 *   frontend/components/dashboard/DashboardLayout.tsx
 *
 * Replaces the old file at the same path.
 */

import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  BarChart3, LayoutDashboard, Zap, Users, TrendingUp,
  DollarSign, FileText, Settings, LogOut, Crown, Clock, Upload
} from 'lucide-react'
import { supabase, canDownload } from '../../lib/supabase'

const NAV = [
  { href: '/dashboard',          icon: LayoutDashboard, label: 'Dashboard',         live: true  },
  { href: '/app/command-center', icon: Zap,             label: 'Command Center',    live: true, badge: 'NEW' },
  { href: '/dashboard/upload',   icon: Upload,          label: 'Upload Dataset',    live: true  },
  { href: '/app/customer',       icon: Users,           label: 'Customer Analytics',live: false },
  { href: '/app/bridge',         icon: TrendingUp,      label: 'Revenue Bridge',    live: false },
  { href: '/app/pricing',        icon: DollarSign,      label: 'Pricing',           live: false },
  { href: '/dashboard/reports',  icon: FileText,        label: 'Reports',           live: true  },
  { href: '/dashboard/settings', icon: Settings,        label: 'Settings',          live: true  },
]

export default function DashboardLayout({ children, profile, title }) {
  const router  = useRouter()
  const isAdmin = canDownload(profile || null)

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div style={{
      display:    'flex',
      height:     '100vh',
      overflow:   'hidden',
      background: 'var(--bg-page)',
      fontFamily: 'var(--font-sans)',
    }}>

      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <aside style={{
        width:         220,
        display:       'flex',
        flexDirection: 'column',
        flexShrink:    0,
        background:    'var(--bg-sidebar)',
        borderRight:   '1px solid var(--border-muted)',
        overflow:      'hidden',
      }}>

        {/* Logo */}
        <div style={{
          height:      56,
          display:     'flex',
          alignItems:  'center',
          gap:         12,
          padding:     '0 16px',
          borderBottom:'1px solid var(--border-muted)',
          flexShrink:  0,
        }}>
          <div style={{
            width:          28,
            height:         28,
            borderRadius:   8,
            background:     'var(--accent-gradient)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            flexShrink:     0,
          }}>
            <BarChart3 size={13} color="var(--bg-page)"/>
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:900, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.01em', lineHeight:1 }}>RevenueLens</div>
            <div style={{ fontSize:8, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.15em', color:'var(--accent)', marginTop:2 }}>Analytics</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, overflowY:'auto', padding:'12px 8px' }}>
          <div style={{ fontSize:8, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.15em', color:'var(--text-ghost)', padding:'0 8px', marginBottom:8 }}>Platform</div>

          {NAV.map(item => {
            const active   = router.pathname === item.href || router.pathname.startsWith(item.href + '/')
            const Icon     = item.icon
            const disabled = !item.live

            if (disabled) return (
              <div key={item.href} style={{
                display:    'flex',
                alignItems: 'center',
                gap:        10,
                padding:    '8px 10px',
                borderRadius: 10,
                marginBottom: 2,
                opacity:    0.35,
                cursor:     'not-allowed',
              }}>
                <Icon size={13} color="var(--text-muted)"/>
                <span style={{ fontSize:12, color:'var(--text-muted)', flex:1 }}>{item.label}</span>
                <span style={{ fontSize:8, color:'var(--text-ghost)', display:'flex', alignItems:'center', gap:3 }}>
                  <Clock size={8}/> Soon
                </span>
              </div>
            )

            return (
              <Link key={item.href} href={item.href} style={{
                display:        'flex',
                alignItems:     'center',
                gap:            10,
                padding:        '8px 10px',
                borderRadius:   10,
                marginBottom:   2,
                textDecoration: 'none',
                background:     active ? 'rgba(0,229,160,0.08)' : 'transparent',
                border:         active ? '1px solid rgba(0,229,160,0.2)' : '1px solid transparent',
                color:          active ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight:     active ? 600 : 400,
                fontSize:       12,
                transition:     'all 0.12s',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' } }}
              >
                <Icon size={13} color={active ? 'var(--accent)' : 'var(--text-muted)'}/>
                <span style={{ flex:1 }}>{item.label}</span>
                {item.badge && (
                  <span style={{ fontSize:8, background:'var(--accent)', color:'var(--bg-page)', padding:'1px 6px', borderRadius:20, fontWeight:700, letterSpacing:'0.05em' }}>
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Plan badge */}
        {profile && (
          <div style={{ padding:'0 12px 8px' }}>
            {isAdmin ? (
              <div style={{ borderRadius:10, padding:'10px 12px', background:'rgba(244,162,97,0.08)', border:'1px solid rgba(244,162,97,0.2)', display:'flex', alignItems:'center', gap:8 }}>
                <Crown size={12} color="var(--warning)"/>
                <span style={{ fontSize:11, fontWeight:700, color:'var(--warning)' }}>Premium Access</span>
              </div>
            ) : (
              <div style={{ borderRadius:10, padding:'10px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)' }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:4 }}>Free plan</div>
                <Link href="/dashboard/upgrade" style={{ fontSize:10, color:'var(--accent)', fontWeight:600, textDecoration:'none' }}>Upgrade to export →</Link>
              </div>
            )}
          </div>
        )}

        {/* User row */}
        <div style={{ borderTop:'1px solid var(--border-muted)', padding:12 }}>
          <div style={{
            display:     'flex',
            alignItems:  'center',
            gap:         10,
            padding:     '8px 10px',
            borderRadius: 10,
            cursor:      'pointer',
            transition:  'background 0.12s',
          }}
          onMouseEnter={e => e.currentTarget.style.background='var(--bg-elevated)'}
          onMouseLeave={e => e.currentTarget.style.background='transparent'}
          >
            <div style={{
              width:          28,
              height:         28,
              borderRadius:   '50%',
              background:     'rgba(0,229,160,0.15)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              flexShrink:     0,
            }}>
              <span style={{ fontSize:12, fontWeight:700, color:'var(--accent)' }}>
                {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{profile?.full_name || 'User'}</div>
              <div style={{ fontSize:10, color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{profile?.email}</div>
            </div>
            <button onClick={signOut} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', padding:4, borderRadius:6 }}
              onMouseEnter={e => e.currentTarget.style.color='var(--negative)'}
              onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}>
              <LogOut size={12}/>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ──────────────────────────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>

        {/* Header */}
        {title && (
          <header style={{
            height:      56,
            background:  'var(--bg-sidebar)',
            borderBottom:'1px solid var(--border-muted)',
            display:     'flex',
            alignItems:  'center',
            padding:     '0 24px',
            flexShrink:  0,
          }}>
            <h1 style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', fontFamily:'var(--font-display)', margin:0 }}>{title}</h1>
          </header>
        )}

        {/* Content */}
        <main style={{ flex:1, overflowY:'auto', background:'var(--bg-page)' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
