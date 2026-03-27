// @ts-nocheck
/**
 * ui_components.tsx — Core reusable components
 *
 * Contains: PageContainer, SectionHeader, Card, KPIBlock
 * All use CSS tokens only. No raw hex.
 *
 * Split into individual files before deploying:
 *   frontend/components/ui/PageContainer.tsx
 *   frontend/components/ui/SectionHeader.tsx
 *   frontend/components/ui/Card.tsx
 *   frontend/components/ui/KPIBlock.tsx
 *   frontend/components/layout/AuthLayout.tsx
 *   frontend/components/layout/SiteLayout.tsx
 */

// ─── PageContainer ────────────────────────────────────────────────────────────
export function PageContainer({ children, title, description, actions, maxWidth = 1280 }) {
  return (
    <div style={{ maxWidth, margin:'0 auto', padding:'24px 32px' }}>
      {(title || actions) && (
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, gap:16 }}>
          <div>
            {title && (
              <h1 style={{ margin:0, fontSize:'1.375rem', fontWeight:600, color:'var(--color-text-primary)', letterSpacing:'-0.015em', lineHeight:1.25 }}>
                {title}
              </h1>
            )}
            {description && (
              <p style={{ margin:'4px 0 0', fontSize:'0.875rem', color:'var(--color-text-secondary)', lineHeight:1.55 }}>
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>{actions}</div>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

// ─── SectionHeader ────────────────────────────────────────────────────────────
export function SectionHeader({ title, subtitle, rightSlot, compact = false }) {
  return (
    <div style={{
      display:'flex', alignItems:subtitle?'flex-start':'center',
      justifyContent:'space-between', gap:16,
      marginBottom: compact ? 12 : 16,
    }}>
      <div>
        <h2 style={{ margin:0, fontSize:'0.9375rem', fontWeight:600, color:'var(--color-text-primary)', letterSpacing:'-0.005em', lineHeight:1.4 }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ margin:'2px 0 0', fontSize:'0.8125rem', color:'var(--color-text-secondary)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {rightSlot && <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>{rightSlot}</div>}
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────
// variant: 'default' | 'muted' | 'danger'
export function Card({ children, variant = 'default', padding = 20, style: extra = {}, onClick }) {
  const base = {
    background:    variant === 'muted' ? 'var(--color-muted)' : variant === 'danger' ? 'var(--color-negative-dim)' : 'var(--color-surface)',
    border:        `1px solid ${variant === 'danger' ? 'var(--color-negative-border)' : 'var(--color-border)'}`,
    borderRadius:  'var(--radius-card)',
    boxShadow:     'var(--shadow-card)',
    padding,
    transition:    onClick ? 'border-color 0.15s, background 0.15s' : undefined,
    cursor:        onClick ? 'pointer' : undefined,
    ...extra,
  }

  return (
    <div style={base} onClick={onClick}
      onMouseEnter={onClick ? e => { e.currentTarget.style.borderColor='var(--color-accent-border)'; e.currentTarget.style.background='var(--color-surface-hover)' } : undefined}
      onMouseLeave={onClick ? e => { e.currentTarget.style.borderColor='var(--color-border)'; e.currentTarget.style.background='var(--color-surface)' } : undefined}
    >
      {children}
    </div>
  )
}

// ─── KPIBlock ─────────────────────────────────────────────────────────────────
// The financial KPI display. Numbers dominate; labels are small and muted.
// deltaDirection: 'up' | 'down' | 'neutral'
export function KPIBlock({ label, value, delta, deltaDirection = 'neutral', hint, compact = false }) {
  const deltaColor = deltaDirection === 'up' ? 'var(--color-positive)' : deltaDirection === 'down' ? 'var(--color-negative)' : 'var(--color-text-secondary)'
  const deltaPrefix = deltaDirection === 'up' ? '↑ ' : deltaDirection === 'down' ? '↓ ' : ''

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: compact ? 2 : 4 }}>
      {/* Label — small, muted, uppercase */}
      <div style={{ fontSize:'0.6875rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--color-text-secondary)' }}>
        {label}
      </div>

      {/* Value — bold, mono, dominant */}
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize:   compact ? '1.25rem' : '1.75rem',
        fontWeight: 700,
        color:      'var(--color-text-primary)',
        lineHeight:  1,
        letterSpacing: '-0.02em',
        fontFeatureSettings: "'tnum'",
      }}>
        {value}
      </div>

      {/* Delta */}
      {delta && (
        <div style={{ fontSize:'0.8125rem', fontWeight:500, color:deltaColor, display:'flex', alignItems:'center', gap:3, marginTop:1 }}>
          {deltaPrefix}{delta}
        </div>
      )}

      {/* Hint — optional secondary info */}
      {hint && (
        <div style={{ fontSize:'0.75rem', color:'var(--color-text-secondary)', marginTop:2 }}>{hint}</div>
      )}
    </div>
  )
}

// ─── KPIStrip ─────────────────────────────────────────────────────────────────
// Horizontal row of KPI blocks — used on Summary, Dashboard, Bridge header
export function KPIStrip({ children, cols = 4 }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 1,
      background: 'var(--color-border)',  // gap shows as thin border
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-card)',
      overflow: 'hidden',
    }}>
      {Array.isArray(children) ? children.map((child, i) => (
        <div key={i} style={{ background:'var(--color-surface)', padding:'16px 20px' }}>
          {child}
        </div>
      )) : (
        <div style={{ background:'var(--color-surface)', padding:'16px 20px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─── AuthLayout ───────────────────────────────────────────────────────────────
export function AuthLayout({ children, title, subtitle }) {
  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'var(--color-background)', fontFamily:'var(--font-sans)', padding:'40px 16px',
    }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        {/* Logo mark */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:32 }}>
          <div style={{ width:28, height:28, borderRadius:7, background:'var(--color-accent)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontSize:14, color:'#fff', fontWeight:700 }}>R</span>
          </div>
          <span style={{ fontSize:15, fontWeight:700, color:'var(--color-text-primary)', letterSpacing:'-0.01em' }}>RevenueLens</span>
        </div>

        {/* Card */}
        <div style={{
          background:    'var(--color-surface)',
          border:        '1px solid var(--color-border)',
          borderRadius:  'var(--radius-card)',
          padding:       '28px 32px',
          boxShadow:     'var(--shadow-card)',
        }}>
          {title && (
            <div style={{ marginBottom:20 }}>
              <h1 style={{ margin:0, fontSize:'1.25rem', fontWeight:600, color:'var(--color-text-primary)', letterSpacing:'-0.015em' }}>{title}</h1>
              {subtitle && <p style={{ margin:'4px 0 0', fontSize:'13px', color:'var(--color-text-secondary)' }}>{subtitle}</p>}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── SiteLayout ───────────────────────────────────────────────────────────────
export function SiteLayout({ children }) {
  return (
    <div style={{ minHeight:'100vh', background:'var(--color-background)', fontFamily:'var(--font-sans)' }}>
      {children}
    </div>
  )
}

