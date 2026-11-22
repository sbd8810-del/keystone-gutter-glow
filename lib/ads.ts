// Google Ads measurement, set up by Jimmy. These IDs are public by design: they're in every page's HTML.
// Two Google Ads accounts count bookings, each with its own Google tag and Purchase conversion:
//
//   account 18566097431 (2026-11-11)  container GTM-MVK64PHQ, loaded with gtm.js
//   account 18587142549 (2026-11-21)  Google tag GTM-N8CX448C, loaded with gtag.js as Google gave it
//
// - Both tags go in every page's <head>: app/layout.tsx.
// - Both "Purchase" conversions fire once per booking on /booking-confirmed, where the booking form
//   sends people after a successful booking (components/booking/BookingConfirmed.tsx).
// - To drop an account, remove its tag ID and its conversion below (and its <script> in app/layout.tsx).
//
// Only the real production site loads the tags, so preview deployments, local runs and tests never
// count as visits or conversions in Jimmy's Google Ads accounts. "Production" comes from lib/deploy.ts:
// automatic on Vercel, SITE_ENV=production on any other host.

import { deployEnv } from "./deploy";

/** Account 18566097431's Google Tag Manager container. */
export const GOOGLE_TAG_ID = "GTM-MVK64PHQ";
/** Account 18587142549's Google tag. */
export const GOOGLE_TAG_ID_2 = "GTM-N8CX448C";

/** Google's event snippets for the Purchase conversions, as given. The booking reference is added as transaction_id. */
export const BOOKING_CONVERSIONS = [
  // Account 18566097431: value 1.0 USD per booking
  { send_to: "AW-18566097431/YzNNCIGmpLUdEJfUgJVF", value: 1.0, currency: "USD" },
  // Account 18587142549, "Purchase (1)": Google's snippet sets no value
  { send_to: "AW-18587142549/dryfCLjY_rwdEJWThZ9F" },
] as const;

type Env = Record<string, string | undefined>;

/** Server only. True on the live site: Vercel's production deployment, or SITE_ENV=production on any other host. */
export function googleTagOn(env: Env = process.env): boolean {
  return deployEnv(env) === "production";
}

/** The tags' own setup script, exactly as Google gives it, shared by both tags. */
export const GOOGLE_TAG_INLINE = `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GOOGLE_TAG_ID_2}');`;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/**
 * Client only. Google's Purchase event snippets, one per Google Ads account, with the booking
 * reference as transaction_id so Google counts each booking once even if the page is reloaded or
 * reopened. A per-tab flag stops the same tab sending them twice in the first place.
 */
export function reportBookingConversion(ref: string): boolean {
  const flag = `kgg:conversion:${ref}`;
  try {
    if (sessionStorage.getItem(flag)) return false;
  } catch {
    // Storage blocked: Google's transaction_id still dedupes.
  }
  if (typeof window.gtag !== "function") return false;
  // <!-- Event snippet for Purchase conversion page -->, once for each account
  for (const conversion of BOOKING_CONVERSIONS) window.gtag("event", "conversion", { ...conversion, transaction_id: ref });
  try {
    sessionStorage.setItem(flag, "1");
  } catch {
    // ignore
  }
  return true;
}
