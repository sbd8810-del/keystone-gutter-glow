import type { NextConfig } from "next";

// `frame-ancestors` stops the site being framed for clickjacking. Scripts aren't restricted here
// because Next's inline scripts would need a nonce on every page, which rules out static pages.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The dev badge sits bottom-left, right on top of the rail's phone number and the mobile Menu button.
  devIndicators: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Vercel only. Once SITE_URL names the custom domain, the production *.vercel.app addresses send
  // people and search engines there permanently. API routes are left alone so webhooks configured
  // with the old address keep working. Previews (VERCEL_ENV=preview) are never redirected. Other
  // hosts have no .vercel.app address; their own address is handled in the host's settings (README).
  async redirects() {
    const site = process.env.SITE_URL?.replace(/\/$/, "");
    if (!site || process.env.VERCEL_ENV !== "production") return [];
    return [
      {
        source: "/:path((?!api/).*)",
        has: [{ type: "host", value: "(?<sub>.+)\\.vercel\\.app" }],
        destination: `${site}/:path`,
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...securityHeaders,
          // Covers APIs and any file robots.txt alone wouldn't. Comes off with ALLOW_INDEXING=true.
          ...(process.env.ALLOW_INDEXING === "true" ? [] : [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]),
        ],
      },
    ];
  },
};

export default nextConfig;
