// @ts-nocheck
/**
 * DashboardLayout.tsx — Premium app shell
 * Deploy to: frontend/components/dashboard/DashboardLayout.tsx
 *
 * Restyled to match landing page + login:
 * - DM Sans font, purple #6B31D4, light bg #F8F7FC
 * - Zero logic changes — only visual tokens updated
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  BarChart3, LayoutDashboard, Users, TrendingUp,
  DollarSign, FileText, Settings, LogOut, Crown,
  Clock, ChevronRight
} from 'lucide-react'
import { supabase, canDownload } from '../../lib/supabase'

// ── Design tokens — matches landing page + login exactly ──────────────────────
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
  greenBg:  '#ECFDF3',
}
const FONT = "'DM Sans','Helvetica Neue',Arial,sans-serif"

const NAV_SECTIONS = [
  {
    label: 'Analytics',
    items: [
      { href: '/dashboard',          icon: LayoutDashboard, label: 'Dashboard',          live: true  },
      { href: '/app/customer',       icon: TrendingUp,      label: 'Customer Analytics', live: false },
      { href: '/app/bridge',         icon: TrendingUp,      label: 'Revenue Bridge',     live: false },
      { href: '/app/pricing',        icon: DollarSign,      label: 'Pricing',            live: false },
    ]
  },
  {
    label: 'Workspace',
    items: [
      { href: '/dashboard/reports',  icon: FileText, label: 'Reports',        live: true },
      { href: '/dashboard/settings', icon: Settings, label: 'Settings',       live: true },
    ]
  }
]

export function PageSkeleton() {
  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ width: 220, height: 24, borderRadius: 6, background: C.purpleMd, marginBottom: 8, opacity: 0.4 }}/>
        <div style={{ width: 160, height: 14, borderRadius: 4, background: C.border, opacity: 0.6 }}/>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ height: 90, borderRadius: 12, background: C.purpleXl, opacity: 0.4 }}/>
        ))}
      </div>
      <div style={{ height: 200, borderRadius: 14, background: C.purpleXl, opacity: 0.3 }}/>
    </div>
  )
}

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
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: C.bg,
      fontFamily: FONT,
      color: C.text1,
    }}>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside style={{
        width: 224, display: 'flex', flexDirection: 'column', flexShrink: 0,
        background: C.surface,
        borderRight: `1px solid ${C.border}`,
        overflow: 'hidden', zIndex: 20,
      }}>

        {/* Logo */}
        <div style={{
          height: 60, display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 18px', borderBottom: `1px solid ${C.border}`, flexShrink: 0,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: C.purple,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: '0 2px 8px rgba(107,49,212,0.35)',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 13L8 3L14 13H2Z" fill="white" fillOpacity="0.95"/>
              <path d="M5.5 13L8 8.5L10.5 13H5.5Z" fill="white" fillOpacity="0.5"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, letterSpacing: '-0.02em', lineHeight: 1 }}>
              RevenueLens
            </div>
            <div style={{ fontSize: 10, fontWeight: 500, color: C.text3, letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 2 }}>
              Analytics
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '14px 10px' }}>
          {NAV_SECTIONS.map((section, si) => (
            <div key={si} style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: C.text3,
                padding: '0 8px', marginBottom: 6,
              }}>
                {section.label}
              </div>
              {section.items.map(item => {
                const Icon   = item.icon
                const active = router.pathname === item.href || router.pathname.startsWith(item.href + '/')
                const isHov  = hoveredItem === item.href

                if (!item.live) return (
                  <div key={item.href} style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '7px 10px', borderRadius: 8, marginBottom: 2,
                    opacity: 0.35, cursor: 'not-allowed', fontSize: 13,
                    color: C.text2, fontFamily: FONT,
                  }}>
                    <Icon size={14} strokeWidth={1.75}/>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <Clock size={10} color={C.text3}/>
                  </div>
                )

                return (
                  <Link key={item.href} href={item.href} style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '7px 10px', borderRadius: 8, marginBottom: 2,
                    textDecoration: 'none', fontSize: 13, fontFamily: FONT,
                    fontWeight: active ? 600 : 400,
                    color: active ? C.purple : C.text2,
                    background: active ? C.purpleXl : isHov ? C.bg : 'transparent',
                    border: `1px solid ${active ? C.purpleMd : 'transparent'}`,
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={() => setHoveredItem(item.href)}
                  onMouseLeave={() => setHoveredItem(null)}
                  >
                    <Icon size={14} strokeWidth={1.75} color={active ? C.purple : C.text3}/>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.badge && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, background: C.purple,
                        color: '#fff', padding: '2px 6px', borderRadius: 99,
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
          <div style={{ padding: '0 10px 10px' }}>
            {isAdmin ? (
              <div style={{
                borderRadius: 10, padding: '10px 13px',
                background: C.greenBg, border: `1px solid ${C.green}33`,
                display: 'flex', alignItems: 'center', gap: 7,
              }}>
                <Crown size={12} color={C.green} strokeWidth={2}/>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.green, fontFamily: FONT }}>Premium Access</span>
              </div>
            ) : (
              <div style={{
                borderRadius: 10, padding: '11px 13px',
                background: C.purpleXl, border: `1px solid ${C.purpleMd}`,
              }}>
                <div style={{ fontSize: 11, color: C.text3, marginBottom: 4, fontFamily: FONT }}>Free plan</div>
                <Link href="/dashboard/upgrade" style={{
                  fontSize: 12, color: C.purple, fontWeight: 600, textDecoration: 'none', fontFamily: FONT,
                }}>
                  Upgrade to export →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* User row */}
        <div style={{ borderTop: `1px solid ${C.border}`, padding: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '8px 10px', borderRadius: 9, cursor: 'pointer',
            transition: 'background 150ms ease',
          }}
          onMouseEnter={e => e.currentTarget.style.background = C.bg}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: C.purpleXl, border: `1px solid ${C.purpleMd}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: 11, fontWeight: 700, color: C.purple, fontFamily: FONT,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: FONT }}>
                {profile?.full_name || 'User'}
              </div>
              <div style={{ fontSize: 10, color: C.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: FONT }}>
                {profile?.email}
              </div>
            </div>
            <button onClick={signOut} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.text3, display: 'flex', padding: 4, borderRadius: 5,
              transition: 'color 150ms ease',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
            onMouseLeave={e => e.currentTarget.style.color = C.text3}
            >
              <LogOut size={13} strokeWidth={1.75}/>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Top header */}
        {title && (
          <header style={{
            height: 58, background: C.surface,
            borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center',
            padding: '0 32px', flexShrink: 0, gap: 8,
          }}>
            <h1 style={{
              margin: 0, flex: 1, fontFamily: FONT,
              fontSize: 15, fontWeight: 600, color: C.text1,
              letterSpacing: '-0.01em',
            }}>
              {title}
            </h1>
          </header>
        )}

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', background: C.bg }}>
          {loading ? <PageSkeleton/> : children}
        </main>
      </div>
    </div>
  )
}
