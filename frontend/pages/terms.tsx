import Head from 'next/head'
import Link from 'next/link'

export default function TermsPage() {
  const s: Record<string, React.CSSProperties> = {
    page: {
      minHeight: '100vh',
      backgroundColor: '#F8F7FC',
      fontFamily: "'DM Sans', sans-serif",
      color: '#0F0A1E',
    },
    nav: {
      borderBottom: '1px solid #E8E4F2',
      backgroundColor: '#FFFFFF',
      padding: '0 40px',
      height: '60px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    logo: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      textDecoration: 'none',
    },
    logoMark: {
      width: '28px',
      height: '28px',
      borderRadius: '7px',
      backgroundColor: '#6B31D4',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoText: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: '16px',
      color: '#0F0A1E',
      fontWeight: 400,
    },
    navLink: {
      fontSize: '13px',
      color: '#6B31D4',
      textDecoration: 'none',
      fontWeight: 500,
    },
    container: {
      maxWidth: '720px',
      margin: '0 auto',
      padding: '56px 24px 80px',
    },
    badge: {
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: '20px',
      backgroundColor: '#F0EBFF',
      color: '#6B31D4',
      fontSize: '12px',
      fontWeight: 600,
      marginBottom: '16px',
      letterSpacing: '0.04em',
      textTransform: 'uppercase' as const,
    },
    title: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: '36px',
      fontWeight: 400,
      color: '#0F0A1E',
      marginBottom: '8px',
      lineHeight: 1.2,
    },
    updated: {
      fontSize: '13px',
      color: '#9990B0',
      marginBottom: '48px',
      paddingBottom: '32px',
      borderBottom: '1px solid #E8E4F2',
    },
    section: {
      marginBottom: '36px',
    },
    h2: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: '20px',
      fontWeight: 400,
      color: '#0F0A1E',
      marginBottom: '12px',
    },
    p: {
      fontSize: '15px',
      color: '#4C4668',
      lineHeight: '1.75',
      marginBottom: '12px',
    },
    ul: {
      paddingLeft: '20px',
      margin: '0 0 12px',
    },
    li: {
      fontSize: '15px',
      color: '#4C4668',
      lineHeight: '1.75',
      marginBottom: '6px',
    },
    highlight: {
      backgroundColor: '#FFFFFF',
      border: '1px solid #E8E4F2',
      borderRadius: '12px',
      padding: '20px 24px',
      marginBottom: '36px',
    },
    highlightText: {
      fontSize: '15px',
      color: '#4C4668',
      lineHeight: '1.75',
      margin: 0,
    },
    email: {
      color: '#6B31D4',
      textDecoration: 'none',
      fontWeight: 500,
    },
    footer: {
      borderTop: '1px solid #E8E4F2',
      padding: '24px 40px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
    },
    footerText: {
      fontSize: '13px',
      color: '#9990B0',
    },
    footerLink: {
      fontSize: '13px',
      color: '#6B31D4',
      textDecoration: 'none',
      fontWeight: 500,
    },
  }

  return (
    <>
      <Head>
        <title>Terms of Service — RevenueLens AI</title>
        <meta name="description" content="RevenueLens AI Terms of Service" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display&display=swap" rel="stylesheet" />
      </Head>

      <div style={s.page}>
        {/* Nav */}
        <nav style={s.nav}>
          <Link href="/" style={s.logo}>
            <div style={s.logoMark}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 13L8 3L13 13H3Z" fill="white" fillOpacity="0.9"/>
              </svg>
            </div>
            <span style={s.logoText}>RevenueLens AI</span>
          </Link>
          <Link href="/auth/login" style={s.navLink}>Sign in →</Link>
        </nav>

        {/* Content */}
        <div style={s.container}>
          <div style={s.badge}>Legal</div>
          <h1 style={s.title}>Terms of Service</h1>
          <p style={s.updated}>Last updated: May 26, 2026</p>

          {/* Summary box */}
          <div style={s.highlight}>
            <p style={s.highlightText}>
              <strong style={{ color: '#0F0A1E' }}>The short version:</strong> Use RevenueLens AI for lawful purposes, don't abuse the platform, and pay for your subscription. We'll provide the service reliably and keep your data secure.
            </p>
          </div>

          <div style={s.section}>
            <h2 style={s.h2}>1. Acceptance of Terms</h2>
            <p style={s.p}>
              By accessing or using RevenueLens AI ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service. These terms apply to all users, including those on free and paid plans.
            </p>
          </div>

          <div style={s.section}>
            <h2 style={s.h2}>2. Description of Service</h2>
            <p style={s.p}>
              RevenueLens AI is a revenue intelligence platform that enables finance leaders, CFOs, and revenue operations teams to analyse, visualise, and interpret ARR and MRR data. The Service is provided on a subscription basis with free and paid tiers.
            </p>
          </div>

          <div style={s.section}>
            <h2 style={s.h2}>3. Account Registration</h2>
            <p style={s.p}>To use the Service, you must:</p>
            <ul style={s.ul}>
              <li style={s.li}>Create an account with accurate, complete information.</li>
              <li style={s.li}>Maintain the security of your account credentials.</li>
              <li style={s.li}>Notify us immediately of any unauthorised access.</li>
              <li style={s.li}>Be at least 18 years of age or have authorisation from your organisation.</li>
            </ul>
            <p style={s.p}>
              You are responsible for all activity that occurs under your account.
            </p>
          </div>

          <div style={s.section}>
            <h2 style={s.h2}>4. Acceptable Use</h2>
            <p style={s.p}>You agree not to:</p>
            <ul style={s.ul}>
              <li style={s.li}>Use the Service for any unlawful purpose or in violation of any regulations.</li>
              <li style={s.li}>Upload false, misleading, or fraudulent financial data.</li>
              <li style={s.li}>Attempt to reverse-engineer, decompile, or extract source code from the platform.</li>
              <li style={s.li}>Use automated tools to scrape or extract data from the Service.</li>
              <li style={s.li}>Resell or sublicense access to the Service without written permission.</li>
              <li style={s.li}>Interfere with the security or integrity of the platform.</li>
            </ul>
          </div>

          <div style={s.section}>
            <h2 style={s.h2}>5. Subscription and Payment</h2>
            <p style={s.p}>
              RevenueLens AI offers free and paid subscription plans. Paid plans are billed monthly or annually as selected at checkout. All payments are processed securely via Stripe.
            </p>
            <ul style={s.ul}>
              <li style={s.li}>Subscriptions auto-renew unless cancelled before the renewal date.</li>
              <li style={s.li}>Refunds are considered on a case-by-case basis within 7 days of payment.</li>
              <li style={s.li}>Downgrading or cancelling your plan takes effect at the end of the current billing period.</li>
              <li style={s.li}>We reserve the right to change pricing with 30 days' notice.</li>
            </ul>
          </div>

          <div style={s.section}>
            <h2 style={s.h2}>6. Your Data</h2>
            <p style={s.p}>
              You retain full ownership of all data you upload to RevenueLens AI. By uploading data, you grant us a limited licence to process and display it solely to provide the Service to you. We do not claim ownership of your revenue data.
            </p>
            <p style={s.p}>
              Upon account termination, you may request a full export of your data within 30 days. After that period, data may be permanently deleted.
            </p>
          </div>

          <div style={s.section}>
            <h2 style={s.h2}>7. Intellectual Property</h2>
            <p style={s.p}>
              The RevenueLens AI platform, including its software, design, algorithms, and analytical models, is the intellectual property of Ashwani and Company. Nothing in these terms grants you ownership of or rights to our intellectual property beyond the limited right to use the Service.
            </p>
          </div>

          <div style={s.section}>
            <h2 style={s.h2}>8. Availability and Uptime</h2>
            <p style={s.p}>
              We aim to provide a reliable, high-availability service. However, we do not guarantee 100% uptime. Scheduled maintenance will be communicated in advance where possible. We are not liable for losses resulting from service interruptions outside our reasonable control.
            </p>
          </div>

          <div style={s.section}>
            <h2 style={s.h2}>9. Limitation of Liability</h2>
            <p style={s.p}>
              To the maximum extent permitted by law, RevenueLens AI and Ashwani and Company shall not be liable for any indirect, incidental, consequential, or punitive damages arising from your use of the Service, including but not limited to loss of revenue, data, or business opportunities.
            </p>
            <p style={s.p}>
              Our total aggregate liability shall not exceed the amount you paid us in the 12 months preceding the claim.
            </p>
          </div>

          <div style={s.section}>
            <h2 style={s.h2}>10. Termination</h2>
            <p style={s.p}>
              You may terminate your account at any time from your account settings. We reserve the right to suspend or terminate accounts that violate these Terms, with or without notice depending on the severity of the violation.
            </p>
          </div>

          <div style={s.section}>
            <h2 style={s.h2}>11. Changes to Terms</h2>
            <p style={s.p}>
              We may update these Terms from time to time. We will notify you of material changes via email at least 14 days before they take effect. Continued use of the Service after that date constitutes acceptance of the updated Terms.
            </p>
          </div>

          <div style={s.section}>
            <h2 style={s.h2}>12. Governing Law</h2>
            <p style={s.p}>
              These Terms are governed by the laws of India. Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts of India.
            </p>
          </div>

          <div style={s.section}>
            <h2 style={s.h2}>13. Contact</h2>
            <p style={s.p}>
              For any questions regarding these Terms, contact us at:
            </p>
            <p style={s.p}>
              <a href="mailto:hello@ashwaniandcompany.com" style={s.email}>hello@ashwaniandcompany.com</a><br />
              RevenueLens AI / Ashwani and Company
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer style={s.footer}>
          <span style={s.footerText}>© 2026 RevenueLens AI. All rights reserved.</span>
          <Link href="/privacy" style={s.footerLink}>Privacy Policy</Link>
        </footer>
      </div>
    </>
  )
}
