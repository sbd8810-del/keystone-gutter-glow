// Google Ads measurement, set up by Jimmy (2026-11-11). These IDs are public by design: they're in
// every page's HTML.
//
// - The Google tag (container GTM-MVK64PHQ) goes in every page's <head>: app/layout.tsx.
// - The "Purchase" conversion fires once per booking on /booking-confirmed, where the booking form
//   sends people after a successful booking (components/booking/BookingConfirmed.tsx).
//
// Only the real production site loads the tag, so preview deployments, local runs and tests never
// count as visits or conversions in Jimmy's Google Ads account. "Production" comes from lib/deploy.ts:
// automatic on Vercel, SITE_ENV=production on any other host.

import { deployEnv } from "./deploy";

export const GOOGLE_TAG_ID = "GTM-MVK64PHQ";

/** Google's event snippet for the Purchase conversion, as given (value 1.0 USD per booking). */
export const BOOKING_CONVERSION = {
  send_to: "AW-18566097431/YzNNCIGmpLUdEJfUgJVF",
  value: 1.0,
  currency: "USD",
} as const;

type Env = Record<string, string | undefined>;

/** Server only. True on the live site: Vercel's production deployment, or SITE_ENV=production on any other host. */
export function googleTagOn(env: Env = process.env): boolean {
  return deployEnv(env) === "production";
}

/** The tag's own setup script, exactly as Google gives it. */
export const GOOGLE_TAG_INLINE = `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());`;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/**
 * Client only. Google's Purchase event snippet, with the booking reference as transaction_id so
 * Google counts each booking once even if the page is reloaded or reopened. A per-tab flag stops
 * the same tab sending it twice in the first place.
 */
export function reportBookingConversion(ref: string): boolean {
  const flag = `kgg:conversion:${ref}`;
  try {
    if (sessionStorage.getItem(flag)) return false;
  } catch {
    // Storage blocked: Google's transaction_id still dedupes.
  }
  if (typeof window.gtag !== "function") return false;
  // <!-- Event snippet for Purchase conversion page -->
  window.gtag("event", "conversion", { ...BOOKING_CONVERSION, transaction_id: ref });
  try {
    sessionStorage.setItem(flag, "1");
  } catch {
    // ignore
  }
  return true;
}
