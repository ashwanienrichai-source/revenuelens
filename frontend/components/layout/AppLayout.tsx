// @ts-nocheck
/**
 * AppLayout.tsx — Unified authenticated app shell
 *
 * ALL app pages use this: dashboard, command-center, retention, reports, settings.
 * Uses CSS tokens. No raw hex.
 *
 * Deploy to: frontend/components/layout/AppLayout.tsx
 */

import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  BarChart3, LayoutDashboard, Zap, Users, TrendingUp,
  DollarSign, FileText, Settings, LogOut, Crown, Clock, Upload
} from 'lucide-react'
import { supabase, canDownload } from '../../lib/supabase'

const NAV = [
  { href:'/dashboard',          icon:LayoutDashboard, label:'Dashboard',          live:true  },
  { href:'/app/command-center', icon:Zap,             label:'Command Center',     live:true, badge:'NEW' },
  { href:'/dashboard/upload',   icon:Upload,          label:'Upload Dataset',     live:true  },
  { href:'/app/customer',       icon:Users,           label:'Customer Analytics', live:false },
  { href:'/app/bridge',         icon:TrendingUp,      label:'Revenue Bridge',     live:false },
  { href:'/app/pricing',        icon:DollarSign,      label:'Pricing',            live:false },
  { href:'/dashboard/reports',  icon:FileText,        label:'Reports',            live:true  },
  { href:'/dashboard/settings', icon:Settings,        label:'Settings',           live:true  },
]

const S = {
  shell:   { display:'flex', height:'100vh', overflow:'hidden', background:'var(--color-background)', fontFamily:'var(--font-sans)' },
  sidebar: { width:216, display:'flex', flexDirection:'column', flexShrink:0, background:'var(--color-surface)', borderRight:'1px solid var(--color-border)', overflow:'hidden' },
  logo:    { height:52, display:'flex', alignItems:'center', gap:10, padding:'0 16px', borderBottom:'1px solid var(--color-border)', flexShrink:0 },
  logoIcon:{ width:26, height:26, borderRadius:6, background:'var(--color-accent)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  nav:     { flex:1, overflowY:'auto', padding:'10px 8px' },
  navGroup:{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--color-text-secondary)', padding:'0 6px', marginBottom:6, marginTop:4 },
  main:    { flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' },
  header:  { height:52, display:'flex', alignItems:'center', padding:'0 24px', borderBottom:'1px solid var(--color-border)', background:'var(--color-surface)', flexShrink:0 },
  content: { flex:1, overflowY:'auto', background:'var(--color-background)' },
}

export default function AppLayout({ children, profile, title, actions }) {
  const router  = useRouter()
  const isAdmin = canDownload(profile || null)

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div style={S.shell}>

      {/* Sidebar */}
      <aside style={S.sidebar}>

        {/* Logo */}
        <div style={S.logo}>
          <div style={S.logoIcon}>
            <BarChart3 size={13} color="#fff"/>
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--color-text-primary)', letterSpacing:'-0.01em', lineHeight:1 }}>RevenueLens</div>
            <div style={{ fontSize:9, fontWeight:600, color:'var(--color-text-secondary)', letterSpacing:'0.08em', textTransform:'uppercase', marginTop:1 }}>Analytics</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={S.nav}>
          <div style={S.navGroup}>Platform</div>
          {NAV.map(item => {
            const Icon   = item.icon
            const active = router.pathname === item.href || router.pathname.startsWith(item.href + '/')

            if (!item.live) return (
              <div key={item.href} style={{
                display:'flex', alignItems:'center', gap:9, padding:'7px 10px', borderRadius:7,
                marginBottom:1, opacity:0.3, cursor:'not-allowed',
                fontSize:13, color:'var(--color-text-secondary)',
              }}>
                <Icon size={13}/>
                <span style={{ flex:1 }}>{item.label}</span>
                <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:9 }}>
                  <Clock size={8}/> Soon
                </span>
              </div>
            )

            return (
              <Link key={item.href} href={item.href} style={{
                display:'flex', alignItems:'center', gap:9, padding:'7px 10px',
                borderRadius:7, marginBottom:1, textDecoration:'none', transition:'all 0.12s',
                fontSize:13, fontWeight: active ? 600 : 400,
                color:      active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                background: active ? 'var(--color-accent-dim)' : 'transparent',
                border:     active ? '1px solid var(--color-accent-border)' : '1px solid transparent',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--color-surface-hover)'; e.currentTarget.style.color = 'var(--color-text-primary)' }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)' }}}
              >
                <Icon size={13}/>
                <span style={{ flex:1 }}>{item.label}</span>
                {item.badge && (
                  <span style={{ fontSize:8, background:'var(--color-accent)', color:'#fff', padding:'1px 5px', borderRadius:20, fontWeight:700 }}>
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Plan badge */}
        {profile && (
          <div style={{ padding:'0 10px 8px' }}>
            {isAdmin ? (
              <div style={{ borderRadius:8, padding:'9px 11px', background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.18)', display:'flex', alignItems:'center', gap:7 }}>
                <Crown size={11} color="var(--color-positive)"/>
                <span style={{ fontSize:11, fontWeight:600, color:'var(--color-positive)' }}>Premium Access</span>
              </div>
            ) : (
              <div style={{ borderRadius:8, padding:'9px 11px', background:'var(--color-surface-hover)', border:'1px solid var(--color-border)' }}>
                <div style={{ fontSize:11, fontWeight:500, color:'var(--color-text-secondary)', marginBottom:3 }}>Free plan</div>
                <Link href="/dashboard/upgrade" style={{ fontSize:11, color:'var(--color-accent)', fontWeight:600, textDecoration:'none' }}>Upgrade to export →</Link>
              </div>
            )}
          </div>
        )}

        {/* User row */}
        <div style={{ borderTop:'1px solid var(--color-border)', padding:10 }}>
          <div style={{
            display:'flex', alignItems:'center', gap:9, padding:'7px 9px',
            borderRadius:7, cursor:'pointer', transition:'background 0.12s',
          }}
          onMouseEnter={e => e.currentTarget.style.background='var(--color-surface-hover)'}
          onMouseLeave={e => e.currentTarget.style.background='transparent'}
          >
            <div style={{
              width:27, height:27, borderRadius:'50%',
              background:'var(--color-accent-dim)', border:'1px solid var(--color-accent-border)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            }}>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--color-accent)' }}>
                {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--color-text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {profile?.full_name || 'User'}
              </div>
              <div style={{ fontSize:10, color:'var(--color-text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {profile?.email}
              </div>
            </div>
            <button onClick={signOut} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--color-text-secondary)', display:'flex', padding:3, borderRadius:5, transition:'color 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.color='var(--color-negative)'}
              onMouseLeave={e => e.currentTarget.style.color='var(--color-text-secondary)'}>
              <LogOut size={12}/>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={S.main}>
        {/* Top header — only if title provided */}
        {title && (
          <header style={S.header}>
            <div style={{ flex:1 }}>
              <h1 style={{ margin:0, fontSize:'1.125rem', fontWeight:600, color:'var(--color-text-primary)', letterSpacing:'-0.01em' }}>{title}</h1>
            </div>
            {actions && <div style={{ display:'flex', alignItems:'center', gap:8 }}>{actions}</div>}
          </header>
        )}
        <main style={S.content}>{children}</main>
      </div>
    </div>
  )
}
