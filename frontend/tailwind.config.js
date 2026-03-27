/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ── Typography ───────────────────────────────────────────────────────
      fontFamily: {
        display: ['Syne', 'DM Sans', 'sans-serif'],
        body:    ['DM Sans', 'system-ui', 'sans-serif'],
        mono:    ['DM Mono', 'JetBrains Mono', 'monospace'],
        sans:    ['DM Sans', 'system-ui', '-apple-system', 'sans-serif'],
      },

      // ── Colors — ALL mapped to CSS variables ─────────────────────────────
      // Use these in Tailwind classes: bg-bg-card, text-accent, border-border, etc.
      colors: {
        // Backgrounds
        bg: {
          page:     'var(--bg-page)',
          sidebar:  'var(--bg-sidebar)',
          card:     'var(--bg-card)',
          elevated: 'var(--bg-elevated)',
          inset:    'var(--bg-inset)',
          overlay:  'var(--bg-overlay)',
        },
        // Borders
        border: {
          DEFAULT: 'var(--border)',
          strong:  'var(--border-strong)',
          hover:   'var(--border-hover)',
          muted:   'var(--border-muted)',
        },
        // Text
        text: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted:     'var(--text-muted)',
          ghost:     'var(--text-ghost)',
        },
        // Accent / brand
        accent: {
          DEFAULT: 'var(--accent)',
          dim:     'var(--accent-dim)',
          '2':     'var(--accent-2)',
        },
        // Status
        positive: 'var(--positive)',
        negative: 'var(--negative)',
        warning:  'var(--warning)',
        violet:   'var(--violet)',

        // Keep original ink/brand for backward compat with existing Tailwind classes
        brand: {
          50:  '#EEF3FF',
          100: '#D9E4FF',
          200: '#BACBFF',
          300: '#8FABFF',
          400: '#6285FF',
          500: '#3D5EFF',
          600: '#1A3CF5',
          700: '#1430DE',
          800: '#1228B3',
          900: '#15278C',
          950: '#0D1857',
        },
        ink: {
          50:  '#F6F7F9',
          100: '#ECEEF2',
          200: '#D4D8E2',
          300: '#AEB6C5',
          400: '#8390A4',
          500: '#62708A',
          600: '#4D5870',
          700: '#3E4759',
          800: '#353D4C',
          900: '#1E2330',
          950: '#12151E',
        },
        success: '#00E5A0',
        danger:  '#FF4757',
      },

      // ── Border radius ──────────────────────────────────────────────────
      borderRadius: {
        card:  '16px',
        pill:  '9999px',
        input: '10px',
        btn:   '12px',
      },

      // ── Box shadows ────────────────────────────────────────────────────
      boxShadow: {
        card:    '0 1px 8px rgba(0,0,0,0.4)',
        'card-hover': '0 4px 20px rgba(0,0,0,0.5)',
        teal:    '0 4px 20px rgba(0,229,160,0.2)',
        modal:   '0 8px 40px rgba(0,0,0,0.6)',
        // Keep old shadows for backward compat
        'card-md': '0 4px 6px -1px rgba(0,0,0,0.3)',
        'card-lg': '0 10px 15px -3px rgba(0,0,0,0.4)',
        glow:      '0 0 40px rgba(0,229,160,0.2)',
        'glow-sm': '0 0 20px rgba(0,229,160,0.12)',
      },

      // ── Background images ──────────────────────────────────────────────
      backgroundImage: {
        'gradient-teal':  'linear-gradient(135deg, #00E5A0, #00B4D8)',
        'gradient-mesh':  'radial-gradient(at 40% 20%, rgba(0,229,160,0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(0,180,216,0.1) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(26,60,245,0.1) 0px, transparent 50%)',
        'dot-grid':       'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
      },

      // ── Animations ────────────────────────────────────────────────────
      animation: {
        'fade-up':    'fadeUp 0.5s ease forwards',
        'fade-in':    'fadeIn 0.4s ease forwards',
        'spin':       'spin 1s linear infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity:'0', transform:'translateY(16px)' },
          '100%': { opacity:'1', transform:'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity:'0' },
          '100%': { opacity:'1' },
        },
      },
    },
  },
  plugins: [],
}
