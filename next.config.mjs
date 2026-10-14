/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@napi-rs/canvas'],
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
};

export default nextConfig;
