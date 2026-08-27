/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: false
  },
  async redirects() {
    return [
      {
        source: '/jobs',
        destination: '/autoapply/jobs',
        permanent: false,
      },
      {
        source: '/job',
        destination: '/autoapply/jobs',
        permanent: false,
      },
      {
        source: '/auto-apply',
        destination: '/autoapply',
        permanent: false,
      },
      {
        source: '/auto-apply/jobs',
        destination: '/autoapply/jobs',
        permanent: false,
      },
      {
        source: '/auto-apply/:path*',
        destination: '/autoapply/:path*',
        permanent: false,
      }
    ];
  }
};

export default nextConfig;
