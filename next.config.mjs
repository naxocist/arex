/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.supabase.co http://127.0.0.1:54321",
              "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co http://127.0.0.1:54321 http://localhost:8000 https://*.run.app",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
  transpilePackages: ['leaflet', 'react-leaflet'],
  images: {
    remotePatterns: [
      // Local Supabase storage
      { protocol: 'http', hostname: '127.0.0.1', port: '54321', pathname: '/storage/v1/object/public/**' },
      // Supabase Cloud (production)
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
};

export default nextConfig;
