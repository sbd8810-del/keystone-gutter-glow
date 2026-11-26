import type { MetadataRoute } from "next";
import { allowIndexing, publicUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  if (!allowIndexing) {
    // Mockup / preview deployments stay out of search results entirely.
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  // Scripts, styles and images (/_next/) stay crawlable so Google can render the pages.
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/firewood/order", "/booking-confirmed", "/notify-test", "/check/"] }],
    sitemap: `${publicUrl}/sitemap.xml`,
  };
}
