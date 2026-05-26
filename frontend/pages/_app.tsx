// @ts-nocheck
/**
 * _app.tsx — Global app wrapper with PWA support
 * Deploy to: frontend/pages/_app.tsx
 */
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import '../styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const [visible, setVisible] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error)
    }
  }, [])

  useEffect(() => {
    function onStart() { setVisible(false) }
    function onDone()  { setVisible(true); window.scrollTo(0, 0) }
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
      <Head>
        {/* PWA Meta Tags */}
        <meta name="application-name" content="RevenueLens" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="RevenueLens" />
        <meta name="description" content="Revenue Intelligence Operating System for CFOs" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#6B31D4" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />

        {/* PWA Icons */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-192.png" />

        {/* Apple Splash Screens */}
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Head>

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

      {!visible && (
        <div style={{
          position: 'fixed', top: 0, left: 0, height: 2,
          background: '#6B31D4', zIndex: 9999,
          animation: 'rl-progress 800ms ease forwards',
        }}/>
      )}

      <div className={`rl-transition${mounted && visible ? ' ready' : ''}`} style={{ minHeight: '100vh' }}>
        <Component {...pageProps} />
      </div>
    </>
  )
}
