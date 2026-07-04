/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Disable SWC minification for the ACV engine module
  // SWC's variable renaming causes TDZ (Temporal Dead Zone) errors
  // when it flattens module scopes during tree-shaking
  swcMinify: false,  // ← This is the fix

  // Alternative: keep minification but exclude specific file
  // (Next.js 13.4+ supports this via experimental config)
  experimental: {
    // Prevent SWC from renaming variables in the ACV engine
    // which causes "Cannot access 'x' before initialization" errors
  },
}

module.exports = nextConfig
