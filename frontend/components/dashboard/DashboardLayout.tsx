// @ts-nocheck
/**
 * DashboardLayout.tsx — Premium app shell
 * Deploy to: frontend/components/dashboard/DashboardLayout.tsx
 *
 * Design: Stripe / Linear sidebar pattern
 * - Fixed left sidebar (220px)
 * - Fixed top header (52px) with breadcrumb + actions slot
 * - Scrollable main area with max-width container
 * - Smooth nav transitions
 * - Skeleton loading state
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  BarChart3, LayoutDashboard, Zap,
  FileText, Settings, LogOut, Crown, Upload
} from 'lucide-react'
import { supabase, canDownload } from '../../lib/supabase'

const NAV_SECTIONS = [
  {
    label: 'Analytics',
    items: [
      { href: '/dashboard',          icon: LayoutDashboard, label: 'Dashboard',      live: true  },
      { href: '/app/command-center', icon: Zap,             label: 'Command Center', live: true, badge: 'New' },
    ]
  },
  {
    label: 'Workspace',
    items: [
      { href: '/dashboard/upload',   icon: Upload,   label: 'Upload Dataset', live: true },
      { href: '/dashboard/reports',  icon: FileText, label: 'Reports',        live: true },
      { href: '/dashboard/settings', icon: Settings, label: 'Settings',       live: true },
    ]
  }
]

// ── Skeleton loader for page content ─────────────────────────────────────────
export function PageSkeleton() {
  return (
    <div className="page-container animate-in" style={{ paddingTop: 24 }}>
      {/* Header skeleton */}
      <div style={{ marginBottom: 28 }}>
        <div className="skeleton skeleton-title" style={{ width: 220, marginBottom: 8 }}/>
        <div className="skeleton skeleton-text" style={{ width: 160 }}/>
      </div>
      {/* KPI strip skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[1,2,3,4].map(i => (
          <div key={i} className="skeleton skeleton-kpi"/>
        ))}
      </div>
      {/* Content skeleton */}
      <div className="skeleton skeleton-chart"/>
    </div>
  )
}

// ── Main layout ───────────────────────────────────────────────────────────────
export default function DashboardLayout({ children, profile, title, loading = false }) {
  const router  = useRouter()
  const isAdmin = canDownload(profile || null)
  const [hoveredItem, setHoveredItem] = useState(null)

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const initials = profile?.full_name
    ?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || 'U'

  return (
    <div style={{
      display:    'flex',
      height:     '100vh',
      overflow:   'hidden',
      background: '#F9FAFB',
      fontFamily: "'Inter', system-ui, sans-serif",
      color:      '#111827',
    }}>

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside style={{
        width:          'var(--sidebar-w, 220px)',
        display:        'flex',
        flexDirection:  'column',
        flexShrink:     0,
        background:     '#FFFFFF',
        borderRight:    '1px solid #E5E7EB',
        overflow:       'hidden',
        zIndex:         20,
      }}>

        {/* Logo */}
        <div style={{
          height:      52,
          display:     'flex',
          alignItems:  'center',
          gap:         10,
          padding:     '0 16px',
          borderBottom:'1px solid #E5E7EB',
          flexShrink:  0,
        }}>
          <div style={{
            width:          28,
            height:         28,
            borderRadius:   7,
            background:     '#003A8F',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            flexShrink:     0,
          }}>
            <BarChart3 size={14} color="#fff"/>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', letterSpacing: '-0.01em', lineHeight: 1 }}>
              RevenueLens
            </div>
            <div style={{ fontSize: 9, fontWeight: 500, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 1 }}>
              Analytics
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
          {NAV_SECTIONS.map((section, si) => (
            <div key={si} style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: '#9CA3AF',
                padding: '0 8px', marginBottom: 4,
              }}>
                {section.label}
              </div>
              {section.items.map(item => {
                const Icon    = item.icon
                const active  = router.pathname === item.href || router.pathname.startsWith(item.href + '/')
                const isHover = hoveredItem === item.href

                if (!item.live) return (
                  <div key={item.href} style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '7px 8px', borderRadius: 6, marginBottom: 1,
                    opacity: 0.35, cursor: 'not-allowed', fontSize: 13,
                    color: '#6B7280',
                  }}>
                    <Icon size={14} strokeWidth={1.75}/>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <Clock size={10} color="#9CA3AF"/>
                  </div>
                )

                return (
                  <Link key={item.href} href={item.href} style={{
                    display:        'flex',
                    alignItems:     'center',
                    gap:            9,
                    padding:        '7px 8px',
                    borderRadius:   6,
                    marginBottom:   1,
                    textDecoration: 'none',
                    fontSize:       13,
                    fontWeight:     active ? 600 : 400,
                    color:          active ? '#2563EB' : '#6B7280',
                    background:     active ? '#EFF6FF' : isHover ? '#F9FAFB' : 'transparent',
                    border:         `1px solid ${active ? '#BFDBFE' : 'transparent'}`,
                    transition:     'all 150ms ease',
                  }}
                  onMouseEnter={() => setHoveredItem(item.href)}
                  onMouseLeave={() => setHoveredItem(null)}
                  >
                    <Icon size={14} strokeWidth={1.75} color={active ? '#2563EB' : '#6B7280'}/>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.badge && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, background: '#2563EB',
                        color: '#fff', padding: '1px 5px', borderRadius: 20,
                        letterSpacing: '0.04em',
                      }}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Plan badge */}
        {profile && (
          <div style={{ padding: '0 10px 8px' }}>
            {isAdmin ? (
              <div style={{
                borderRadius: 7, padding: '9px 12px',
                background: '#F0FDF4', border: '1px solid #BBF7D0',
                display: 'flex', alignItems: 'center', gap: 7,
              }}>
                <Crown size={12} color="#16A34A" strokeWidth={2}/>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#16A34A' }}>Premium Access</span>
              </div>
            ) : (
              <div style={{
                borderRadius: 7, padding: '10px 12px',
                background: '#F9FAFB', border: '1px solid #E5E7EB',
              }}>
                <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 3 }}>Free plan</div>
                <Link href="/dashboard/upgrade" style={{
                  fontSize: 11, color: '#003A8F', fontWeight: 600, textDecoration: 'none',
                }}>
                  Upgrade to export →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* User row */}
        <div style={{ borderTop: '1px solid #E5E7EB', padding: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '7px 8px', borderRadius: 7, cursor: 'pointer',
            transition: 'background 150ms ease',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: '#EFF6FF', border: '1px solid #BFDBFE',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#003A8F',
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.full_name || 'User'}
              </div>
              <div style={{ fontSize: 10, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.email}
              </div>
            </div>
            <button onClick={signOut} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9CA3AF', display: 'flex', padding: 3, borderRadius: 4,
              transition: 'color 150ms ease',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
            onMouseLeave={e => e.currentTarget.style.color = '#9CA3AF'}
            >
              <LogOut size={13} strokeWidth={1.75}/>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Top header */}
        {title && (
          <header style={{
            height:      52,
            background:  '#FFFFFF',
            borderBottom:'1px solid #E5E7EB',
            display:     'flex',
            alignItems:  'center',
            padding:     '0 28px',
            flexShrink:  0,
            gap:         8,
          }}>
            <h1 style={{
              margin: 0, flex: 1,
              fontSize: 14, fontWeight: 600, color: '#111827',
              letterSpacing: '-0.005em',
            }}>
              {title}
            </h1>
          </header>
        )}

        {/* Content */}
        <main style={{
          flex:       1,
          overflowY:  'auto',
          background: '#F9FAFB',
        }}>
          {loading ? <PageSkeleton/> : children}
        </main>
      </div>
    </div>
  )
}
