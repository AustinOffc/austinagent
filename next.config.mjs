// Header keamanan global. API URL hanya dibaca saat build (NEXT_PUBLIC_API_URL).
const apiUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
let apiOrigin = '';
let wsOrigin = '';
try {
  const u = new URL(apiUrl);
  apiOrigin = u.origin;
  wsOrigin = `${u.protocol === 'https:' ? 'wss:' : 'ws:'}//${u.host}`;
} catch {
  /* dibiarkan kosong: halaman login akan menampilkan pesan konfigurasi */
}

const isDev = process.env.NODE_ENV !== 'production';

// Catatan CSP: Next.js App Router menyisipkan skrip inline untuk hidrasi, jadi script-src memerlukan
// 'unsafe-inline' tanpa nonce per-request. Mitigasi: tidak ada dangerouslySetInnerHTML, semua teks
// dari API dirender sebagai teks, access token hanya di memori, dan connect-src dikunci ke domain API.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} ${wsOrigin}${isDev ? ' ws://localhost:*' : ''}`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
