/** @type {import('next').NextConfig} */
const isCI = process.env.GITHUB_ACTIONS === 'true';
const repoName = 'Trading-channel-AI-app';

const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  basePath: isCI ? `/${repoName}` : '',
  assetPrefix: isCI ? `/${repoName}/` : '',
  trailingSlash: true,
};

module.exports = nextConfig;
