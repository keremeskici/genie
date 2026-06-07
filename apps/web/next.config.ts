import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Trace the workspace root so @genie/db (workspace TS package) is bundled into
  // the serverless functions.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Transpile the workspace DB package (ships raw TS via its package exports).
  transpilePackages: ['@genie/db'],
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
};

export default nextConfig;
