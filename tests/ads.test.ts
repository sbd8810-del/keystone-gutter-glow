import { afterEach, describe, expect, it, vi } from "vitest";
import { BOOKING_CONVERSION, GOOGLE_TAG_ID, GOOGLE_TAG_INLINE, googleTagOn, reportBookingConversion } from "@/lib/ads";

// Google Ads: the tag and the booking conversion, with the IDs from Jimmy's Google Ads setup.

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Google tag", () => {
  it("uses Jimmy's container and Google's own setup script", () => {
    expect(GOOGLE_TAG_ID).toBe("GTM-MVK64PHQ");
    expect(GOOGLE_TAG_INLINE).toContain("window.dataLayer = window.dataLayer || [];");
    expect(GOOGLE_TAG_INLINE).toContain("function gtag(){dataLayer.push(arguments);}");
    expect(GOOGLE_TAG_INLINE).toContain("gtag('js', new Date());");
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

  it("sends Google's Purchase event with the booking number as the transaction ID", () => {
    const gtag = browser();
    expect(reportBookingConversion("KGG-ABC23")).toBe(true);
    expect(gtag).toHaveBeenCalledWith("event", "conversion", {
      send_to: "AW-18566097431/YzNNCIGmpLUdEJfUgJVF",
      value: 1.0,
      currency: "USD",
      transaction_id: "KGG-ABC23",
    });
    expect(BOOKING_CONVERSION.send_to).toBe("AW-18566097431/YzNNCIGmpLUdEJfUgJVF");
  });

  it("sends it once per booking, even if the page is reloaded", () => {
    const gtag = browser();
    reportBookingConversion("KGG-ABC23");
    expect(reportBookingConversion("KGG-ABC23")).toBe(false);
    reportBookingConversion("KGG-XYZ45");
    expect(gtag).toHaveBeenCalledTimes(2);
  });

  it("does nothing where the tag isn't loaded", () => {
    vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: () => {} });
    vi.stubGlobal("window", {});
    expect(reportBookingConversion("KGG-ABC23")).toBe(false);
  });
});
