import Head from 'next/head'
import Link from 'next/link'

export default function PrivacyPage() {
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
        <title>Privacy Policy — RevenueLens AI</title>
        <meta name="description" content="RevenueLens AI Privacy Policy" />
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
          <h1 style={s.title}>Privacy Policy</h1>
          <p style={s.updated}>Last updated: May 26, 2026</p>

          {/* Summary box */}
          <div style={s.highlight}>
            <p style={s.highlightText}>
              <strong style={{ color: '#0F0A1E' }}>The short version:</strong> RevenueLens AI collects only what's necessary to operate the product. We do not sell your data. We do not share your revenue data with third parties. Your data is yours.
            </p>
          </div>

          <div style={s.section}>
            <h2 style={s.h2}>1. Who We Are</h2>
            <p style={s.p}>
              RevenueLens AI ("we", "us", "our") is a revenue intelligence platform operated by Ashwani and Company. We provide SaaS analytics tools for finance leaders, CFOs, and revenue operations teams. Our registered contact is <a href="mailto:hello@ashwaniandcompany.com" style={s.email}>hello@ashwaniandcompany.com</a>.
            </p>
          </div>

          <div style={s.section}>
            <h2 style={s.h2}>2. Information We Collect</h2>
            <p style={s.p}>We collect the following categories of information:</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Account information:</strong> Name, email address, company name, role, and phone number provided during signup.</li>
              <li style={s.li}><strong>Authentication data:</strong> OAuth tokens when you sign in via Google or LinkedIn (we never see your passwords for these providers).</li>
              <li style={s.li}><strong>Revenue data:</strong> Financial data you upload or connect to the platform for analysis (MRR files, ARR data, customer records).</li>
              <li style={s.li}><strong>Usage data:</strong> Pages visited, features used, session duration — collected to improve the product.</li>
              <li style={s.li}><strong>Device data:</strong> Browser type, IP address, and device information for security and analytics.</li>
            </ul>
          </div>

          <div style={s.section}>
            <h2 style={s.h2}>3. How We Use Your Information</h2>
            <p style={s.p}>We use the information we collect to:</p>
            <ul style={s.ul}>
              <li style={s.li}>Provide, operate, and improve the RevenueLens AI platform.</li>
              <li style={s.li}>Authenticate your identity and maintain account security.</li>
              <li style={s.li}>Process and display your revenue analytics.</li>
              <li style={s.li}>Send transactional emails (account confirmation, password reset).</li>
              <li style={s.li}>Respond to support requests and communications.</li>
              <li style={s.li}>Comply with legal obligations.</li>
            </ul>
            <p style={s.p}>We do <strong>not</strong> use your revenue data to train machine learning models or share it with other customers.</p>
          </div>

          <div style={s.section}>
            <h2 style={s.h2}>4. Data Storage and Security</h2>
            <p style={s.p}>
              Your data is stored securely using Supabase (PostgreSQL), hosted on AWS infrastructure. All data in transit is encrypted via TLS. All data at rest is encrypted using AES-256.
            </p>
            <p style={s.p}>
              We implement access controls, audit logging, and regular security reviews. Only authorized personnel have access to production systems.
            </p>
          </div>

          <div style={s.section}>
            <h2 style={s.h2}>5. Third-Party Services</h2>
            <p style={s.p}>We use the following third-party services to operate the platform:</p>
            <ul style={s.ul}>
              <li style={s.li}><strong>Supabase</strong> — database and authentication infrastructure.</li>
              <li style={s.li}><strong>Vercel</strong> — frontend hosting and deployment.</li>
              <li style={s.li}><strong>Render</strong> — backend API hosting.</li>
              <li style={s.li}><strong>Resend</strong> — transactional email delivery.</li>
              <li style={s.li}><strong>Stripe</strong> — payment processing (we never store card details directly).</li>
            </ul>
            <p style={s.p}>Each provider has their own privacy policy governing their handling of data.</p>
          </div>

          <div style={s.section}>
            <h2 style={s.h2}>6. Data Sharing</h2>
            <p style={s.p}>
              We do not sell, rent, or trade your personal information or revenue data to any third party. We may share data only in the following circumstances:
            </p>
            <ul style={s.ul}>
              <li style={s.li}>With service providers listed above, solely to operate the platform.</li>
              <li style={s.li}>If required by law, court order, or regulatory authority.</li>
              <li style={s.li}>To protect the rights, property, or safety of RevenueLens AI or its users.</li>
            </ul>
          </div>

          <div style={s.section}>
            <h2 style={s.h2}>7. Your Rights</h2>
            <p style={s.p}>Depending on your jurisdiction, you may have the right to:</p>
            <ul style={s.ul}>
              <li style={s.li}>Access the personal data we hold about you.</li>
              <li style={s.li}>Request correction of inaccurate data.</li>
              <li style={s.li}>Request deletion of your account and associated data.</li>
              <li style={s.li}>Export your data in a portable format.</li>
              <li style={s.li}>Withdraw consent at any time.</li>
            </ul>
            <p style={s.p}>
              To exercise any of these rights, contact us at <a href="mailto:hello@ashwaniandcompany.com" style={s.email}>hello@ashwaniandcompany.com</a>.
            </p>
          </div>

          <div style={s.section}>
            <h2 style={s.h2}>8. Cookies</h2>
            <p style={s.p}>
              We use essential cookies to maintain your authenticated session. We do not use advertising or tracking cookies. Analytics cookies (if any) are anonymised and used solely to improve product experience.
            </p>
          </div>

          <div style={s.section}>
            <h2 style={s.h2}>9. Data Retention</h2>
            <p style={s.p}>
              We retain your account data for as long as your account is active. If you delete your account, we will remove your personal data within 30 days, except where retention is required by law.
            </p>
          </div>

          <div style={s.section}>
            <h2 style={s.h2}>10. Changes to This Policy</h2>
            <p style={s.p}>
              We may update this Privacy Policy from time to time. When we do, we will update the "Last updated" date at the top of this page and notify you via email if the changes are material.
            </p>
          </div>

          <div style={s.section}>
            <h2 style={s.h2}>11. Contact Us</h2>
            <p style={s.p}>
              If you have any questions about this Privacy Policy or how we handle your data, please contact us at:
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
          <Link href="/terms" style={s.footerLink}>Terms of Service</Link>
        </footer>
      </div>
    </>
  )
}
