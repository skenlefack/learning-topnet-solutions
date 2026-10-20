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
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.topnet-solutions.com' },
      { protocol: 'https', hostname: 'learning.topnet-solutions.com' },
      { protocol: 'http', hostname: 'minio' },
    ],
  },
  async rewrites() {
    const isDev = process.env.NODE_ENV !== 'production';
    const host = (name, port) =>
      isDev ? `http://localhost:${port}` : `http://${name}:${port}`;
    return [
      { source: '/api/public/:path*', destination: `${host('academy-course', 4001)}/public/:path*` },
      { source: '/api/courses/:path*', destination: `${host('academy-course', 4001)}/:path*` },
      { source: '/api/learning/:path*', destination: `${host('academy-learning', 4002)}/:path*` },
      { source: '/api/assessment/:path*', destination: `${host('academy-assessment', 4003)}/:path*` },
      { source: '/api/live/:path*', destination: `${host('academy-live', 4004)}/:path*` },
      { source: '/api/commerce/:path*', destination: `${host('academy-commerce', 4005)}/:path*` },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
