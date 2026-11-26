import { site } from "@/content/site";
import { indexingAllowed } from "@/lib/deploy";

// Deployment-dependent settings. Server-side only (read at build time for static pages).
//
// The site's public address lives here and nowhere else. Canonical URLs, the sitemap,
// Open Graph and Twitter cards, and the JSON-LD all build their links from `publicUrl`.
//
// SITE_URL        The canonical address, e.g. https://www.example.com. Set it once the custom
//                 domain is attached. On Vercel, the old *.vercel.app production address then
//                 also redirects to it (next.config.ts). Unset, Vercel's production domain is
//                 used, so previews never claim to be the canonical site. On any other host, set
//                 it to wherever the site lives: unset there, links use keystonegutterglow.com.
// ALLOW_INDEXING  Not needed: the live site (VERCEL_ENV or SITE_ENV = production) may be listed by
//                 Google, and every other copy is noindex (lib/deploy.ts, `indexingAllowed`).
//                 "false" hides the live site too. Meta robots and the X-Robots-Tag header follow it.
// GOOGLE_SITE_VERIFICATION
//                 The token from Google Search Console's "HTML tag" method, if that method is used.

const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const publicUrl = (process.env.SITE_URL ?? (vercelProd ? `https://${vercelProd}` : site.url)).replace(/\/$/, "");

export const allowIndexing = indexingAllowed();

export const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION || undefined;

/**
 * Where Stripe sends the customer back to. Never the request's Host header on a deployed site,
 * because a forged header could send a customer somewhere else after they pay.
 */
export function checkoutOrigin(request: Request, env: Record<string, string | undefined> = process.env): string {
  if (env.SITE_URL) return env.SITE_URL.replace(/\/$/, "");
  if (env.VERCEL_ENV === "preview" && env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  if (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  const origin = new URL(request.url).origin;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : publicUrl;
}
