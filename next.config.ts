import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async redirects() {
    return [
      {
        source: "/club/:slug",
        destination: "/clubs/:slug",
        permanent: true,
      },
      // keep a trailing-slash version just in case
      {
        source: "/club/:slug/",
        destination: "/clubs/:slug/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
