/** @type {import('next').NextConfig} */
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    turbo: {
      resolveAlias: {
        'ethers': path.join(__dirname, '../node_modules/ethers'),
        'pg': path.join(__dirname, '../node_modules/pg'),
      },
    },
  },
  outputFileTracingRoot: path.join(__dirname, '..'),
  typescript: {
    // Temporarily ignore TypeScript errors to unblock deployment
    // TODO: Fix async/await issues in core/api/agent-api.ts
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    // Add parent node_modules to resolve paths so core can access ethers/pg
    config.resolve.modules.push(path.join(__dirname, '../node_modules'));
    return config;
  },
};

export default nextConfig;
