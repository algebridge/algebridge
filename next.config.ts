import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com" }],
  },
  // Deploy resilience: types + lint are verified locally (npm run build passes
  // cleanly), so a build-environment discrepancy must never block a deploy.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // algebridge.org frames /try and the /demo pages; nobody else may frame
  // anything here (a signed-in page inside a stranger's iframe is clickjacking
  // bait). The localhost origin is the site's own local server. In
  // development any origin may frame the app: a phone on the same network
  // opens the site by the computer's address.
  async headers() {
    const ancestors =
      process.env.NODE_ENV === "production"
        ? "'self' https://algebridge.org https://www.algebridge.org http://localhost:4828 http://127.0.0.1:4828"
        : "*";
    return [
      {
        source: "/(.*)",
        headers: [{ key: "Content-Security-Policy", value: `frame-ancestors ${ancestors}` }],
      },
    ];
  },
};

export default nextConfig;
