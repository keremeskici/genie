import type { NextConfig } from 'next';
import path from 'path';

const backendApiUrl = process.env.BACKEND_API_URL?.replace(/\/$/, '');

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../../'),
  images: {
    domains: ['static.usernames.app-backend.toolsforhumanity.com'],
  },
  allowedDevOrigins: ['*.ngrok-free.app', '*.ngrok.io', 'localhost'],
  reactStrictMode: false,
  compress: true,
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: [
      '@worldcoin/minikit-js',
      '@worldcoin/mini-apps-ui-kit-react',
      '@ai-sdk/react',
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
  async rewrites() {
    if (!backendApiUrl) return [];

    return [
      { source: '/api/chat', destination: `${backendApiUrl}/api/chat` },
      { source: '/api/send', destination: `${backendApiUrl}/api/send` },
      { source: '/api/confirm', destination: `${backendApiUrl}/api/confirm` },
      { source: '/api/balance', destination: `${backendApiUrl}/api/balance` },
      { source: '/api/transactions', destination: `${backendApiUrl}/api/transactions` },
      { source: '/api/verify', destination: `${backendApiUrl}/api/verify` },
      { source: '/api/version', destination: `${backendApiUrl}/api/version` },
      { source: '/api/users/:path*', destination: `${backendApiUrl}/api/users/:path*` },
    ];
  },
};

export default nextConfig;
