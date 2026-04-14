const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.au-ibar.org' },
      { protocol: 'https', hostname: 'learning.au-ibar.org' },
      { protocol: 'http', hostname: 'minio' },
    ],
  },
  async rewrites() {
    const isDev = process.env.NODE_ENV !== 'production';
    const host = (name, port) =>
      isDev ? `http://localhost:${port}` : `http://${name}:${port}`;
    return [
      { source: '/api/courses/:path*', destination: `${host('academy-course', 4001)}/:path*` },
      { source: '/api/learning/:path*', destination: `${host('academy-learning', 4002)}/:path*` },
      { source: '/api/assessment/:path*', destination: `${host('academy-assessment', 4003)}/:path*` },
      { source: '/api/live/:path*', destination: `${host('academy-live', 4004)}/:path*` },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
