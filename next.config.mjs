/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // build mandiri untuk image Docker yang ramping
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
};

export default nextConfig;
