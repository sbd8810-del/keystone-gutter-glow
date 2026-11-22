import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BOOKING_CONVERSIONS, GOOGLE_TAG_ID, GOOGLE_TAG_ID_2, GOOGLE_TAG_INLINE, googleTagOn, reportBookingConversion } from "@/lib/ads";

// Google Ads: the tags and the booking conversions, with the IDs from Jimmy's two Google Ads accounts.

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Google tag", () => {
  it("uses Jimmy's two tags and Google's own setup script", () => {
    expect(GOOGLE_TAG_ID).toBe("GTM-MVK64PHQ");
    expect(GOOGLE_TAG_ID_2).toBe("GTM-N8CX448C");
    expect(GOOGLE_TAG_INLINE).toContain("window.dataLayer = window.dataLayer || [];");
    expect(GOOGLE_TAG_INLINE).toContain("function gtag(){dataLayer.push(arguments);}");
    expect(GOOGLE_TAG_INLINE).toContain("gtag('js', new Date());");
    expect(GOOGLE_TAG_INLINE).toContain("gtag('config', 'GTM-N8CX448C');");
  });

  it("puts both tags in every page's head", () => {
    const layout = readFileSync("app/layout.tsx", "utf8");
    expect(layout).toContain("https://www.googletagmanager.com/gtm.js?id=${GOOGLE_TAG_ID}");
    expect(layout).toContain("https://www.googletagmanager.com/gtag/js?id=${GOOGLE_TAG_ID_2}");
  });

  it("only loads on the production deployment, so tests and previews never count", () => {
    expect(googleTagOn({ VERCEL_ENV: "production" })).toBe(true);
    expect(googleTagOn({ VERCEL_ENV: "preview" })).toBe(false);
    expect(googleTagOn({ NODE_ENV: "development" })).toBe(false);
    expect(googleTagOn({})).toBe(false);
  });

  it("loads on another host's live site when SITE_ENV=production, and not on a test copy there", () => {
    expect(googleTagOn({ SITE_ENV: "production", NODE_ENV: "production" })).toBe(true);
    expect(googleTagOn({ SITE_ENV: "preview", NODE_ENV: "production" })).toBe(false);
    // A production build without either setting stays off: local `npm start` never counts
    expect(googleTagOn({ NODE_ENV: "production" })).toBe(false);
  });
});

describe("booking conversion", () => {
  function browser() {
    const store = new Map<string, string>();
    const gtag = vi.fn();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    vi.stubGlobal("window", { gtag });
    return gtag;
  }

  it("sends each account's Purchase event with the booking number as the transaction ID", () => {
    const gtag = browser();
    expect(reportBookingConversion("KGG-ABC23")).toBe(true);
    expect(gtag.mock.calls).toEqual([
      ["event", "conversion", { send_to: "AW-18566097431/YzNNCIGmpLUdEJfUgJVF", value: 1.0, currency: "USD", transaction_id: "KGG-ABC23" }],
      ["event", "conversion", { send_to: "AW-18587142549/dryfCLjY_rwdEJWThZ9F", transaction_id: "KGG-ABC23" }],
    ]);
    expect(BOOKING_CONVERSIONS.map((c) => c.send_to)).toEqual(["AW-18566097431/YzNNCIGmpLUdEJfUgJVF", "AW-18587142549/dryfCLjY_rwdEJWThZ9F"]);
  });

  it("sends them once per booking, even if the page is reloaded", () => {
    const gtag = browser();
    reportBookingConversion("KGG-ABC23");
    expect(reportBookingConversion("KGG-ABC23")).toBe(false);
    reportBookingConversion("KGG-XYZ45");
    expect(gtag).toHaveBeenCalledTimes(2 * BOOKING_CONVERSIONS.length);
  });

  it("does nothing where the tag isn't loaded", () => {
    vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: () => {} });
    vi.stubGlobal("window", {});
    expect(reportBookingConversion("KGG-ABC23")).toBe(false);
  });
});
