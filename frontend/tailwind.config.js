/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ── ONE font stack. Inter for UI, JetBrains Mono for numbers only. ────
      fontFamily: {
        sans:    ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],   // same font, no Syne
        mono:    ['JetBrains Mono', 'DM Mono', 'Menlo', 'monospace'],
        body:    ['Inter', 'system-ui', 'sans-serif'],
      },

      // ── 8 semantic color tokens → CSS variables ─────────────────────────
      // Every component uses these names. Zero raw hex inside JSX.
      colors: {
        background:       'var(--color-background)',
        surface:          'var(--color-surface)',
        'surface-hover':  'var(--color-surface-hover)',
        border:           'var(--color-border)',
        'text-primary':   'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        accent:           'var(--color-accent)',
        positive:         'var(--color-positive)',
        negative:         'var(--color-negative)',
        muted:            'var(--color-muted)',

        // ── Legacy aliases kept for backward compat (DashboardLayout etc.) ─
        brand: {
          50:  '#EEF2FF', 100: '#E0E7FF', 200: '#C7D2FE',
          300: '#A5B4FC', 400: '#818CF8', 500: '#6366F1',
          600: '#4F46E5', 700: '#4338CA', 800: '#3730A3', 900: '#312E81', 950: '#1E1B4B',
        },
        ink: {
          50:  '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1',
          400: '#94A3B8', 500: '#64748B', 600: '#475569', 700: '#334155',
          800: '#1E293B', 900: '#0F172A', 950: '#090E1A',
        },
      },

      // ── Border radius — flat, precise ───────────────────────────────────
      borderRadius: {
        card:  '10px',
        pill:  '9999px',
        input: '7px',
        btn:   '8px',
        sm:    '4px',
      },

      // ── Shadows — minimal, no glow ──────────────────────────────────────
      boxShadow: {
        card:    '0 1px 4px rgba(0,0,0,0.35)',
        'card-md':'0 2px 8px rgba(0,0,0,0.4)',
        modal:   '0 8px 32px rgba(0,0,0,0.6)',
        // Remove glow shadows entirely — not consulting-grade
      },

      // ── Spacing shorthand ────────────────────────────────────────────────
      spacing: {
        'page':    '32px',
        'section': '24px',
        'card':    '20px',
      },

      fontSize: {
        // Semantic type scale
        'display':  ['2.25rem', { lineHeight: '1.1',  fontWeight: '600', letterSpacing: '-0.025em' }],
        'h1':       ['1.375rem',{ lineHeight: '1.25', fontWeight: '600', letterSpacing: '-0.015em' }],
        'h2':       ['1.125rem',{ lineHeight: '1.3',  fontWeight: '600', letterSpacing: '-0.01em'  }],
        'h3':       ['0.9375rem',{lineHeight: '1.4',  fontWeight: '600'                            }],
        'body':     ['0.875rem', { lineHeight: '1.55', fontWeight: '400' }],
        'body-sm':  ['0.8125rem',{ lineHeight: '1.5',  fontWeight: '400' }],
        'label':    ['0.6875rem',{ lineHeight: '1',    fontWeight: '600', letterSpacing: '0.07em', textTransform: 'uppercase' }],
      },

      animation: {
        'fade-in': 'fadeIn 0.25s ease forwards',
        'spin':    'spin 1s linear infinite',
      },
      keyframes: {
        fadeIn: { '0%':{ opacity:'0' }, '100%':{ opacity:'1' } },
      },
    },
  },
  plugins: [],
}
