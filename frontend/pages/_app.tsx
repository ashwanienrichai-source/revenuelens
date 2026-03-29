// @ts-nocheck
/**
 * _app.tsx — Global app wrapper
 * Deploy to: frontend/pages/_app.tsx
 *
 * Provides:
 * - Page transition (fade 200ms, no flicker)
 * - Global CSS import
 * - Font preload
 */

import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import '../styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const [visible, setVisible] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    function onStart() { setVisible(false) }
    function onDone()  {
      setVisible(true)
      // Scroll to top on navigation
      window.scrollTo(0, 0)
    }
    router.events.on('routeChangeStart',    onStart)
    router.events.on('routeChangeComplete', onDone)
    router.events.on('routeChangeError',    onDone)
    return () => {
      router.events.off('routeChangeStart',    onStart)
      router.events.off('routeChangeComplete', onDone)
      router.events.off('routeChangeError',    onDone)
    }
  }, [router])

  return (
    <>
      {/* Progress bar */}
      <style>{`
        @keyframes rl-progress {
          0%   { width: 0%; opacity: 1; }
          80%  { width: 85%; opacity: 1; }
          100% { width: 100%; opacity: 0; }
        }
        .rl-transition {
          opacity: 0;
          transition: opacity 180ms ease;
        }
        .rl-transition.ready {
          opacity: 1;
        }
      `}</style>

      {/* Top loading bar */}
      {!visible && (
        <div style={{
          position:   'fixed',
          top:         0,
          left:        0,
          height:      2,
          background: '#2563EB',
          zIndex:      9999,
          animation:  'rl-progress 800ms ease forwards',
        }}/>
      )}

      {/* Page with fade transition */}
      <div
        className={`rl-transition${mounted && visible ? ' ready' : ''}`}
        style={{ minHeight: '100vh' }}
      >
        <Component {...pageProps} />
      </div>
    </>
  )
}
