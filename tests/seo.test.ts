import { afterEach, describe, expect, it, vi } from "vitest";

// robots.txt, the sitemap and the JSON-LD all read the deployment's environment when they load,
// so each test sets the environment and then imports a fresh copy.

const ENV_KEYS = ["SITE_URL", "VERCEL_PROJECT_PRODUCTION_URL", "ALLOW_INDEXING", "FIREWOOD_PREVIEW", "SITE_MODE", "VERCEL_ENV", "SITE_ENV"];
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

async function load(env: Record<string, string | undefined>, firewood: "on" | "off" = "on") {
  vi.resetModules();
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, env);
  // Firewood is switched off on the site for now. Most of these test it switched on.
  (await import("@/content/season")).firewoodSwitch.off = firewood === "off";
  return {
    robots: (await import("@/app/robots")).default,
    sitemap: (await import("@/app/sitemap")).default,
    schema: await import("@/lib/schema"),
  };
}

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("robots.txt", () => {
  it("blocks everything while indexing is off", async () => {
    const { robots } = await load({ VERCEL_PROJECT_PRODUCTION_URL: "keystone-gutter-glow.vercel.app" });
    expect(robots()).toEqual({ rules: [{ userAgent: "*", disallow: "/" }] });
  });

  it("opens the site, keeps APIs and the order page out, and points at the sitemap", async () => {
    const { robots } = await load({ ALLOW_INDEXING: "true", SITE_URL: "https://example.test" });
    const r = robots();
    expect(r.rules).toEqual([{ userAgent: "*", allow: "/", disallow: ["/api/", "/firewood/order", "/booking-confirmed", "/notify-test", "/check/"] }]);
    expect(r.sitemap).toBe("https://example.test/sitemap.xml");
  });
});

describe("sitemap", () => {
  it("uses the configured address and lists firewood when it's public", async () => {
    const { sitemap } = await load({ SITE_URL: "https://example.test/", FIREWOOD_PREVIEW: "true" });
    expect(sitemap().map((p) => p.url)).toEqual(["https://example.test/", "https://example.test/firewood", "https://example.test/refer"]);
  });

  it("falls back to Vercel's production domain, and leaves firewood out when it's hidden", async () => {
    const { sitemap } = await load({ VERCEL_PROJECT_PRODUCTION_URL: "keystone-gutter-glow.vercel.app", VERCEL_ENV: "production" });
    expect(sitemap().map((p) => p.url)).toEqual(["https://keystone-gutter-glow.vercel.app/", "https://keystone-gutter-glow.vercel.app/refer"]);
  });

  it("lists /gutters instead in firewood mode", async () => {
    const { sitemap } = await load({ SITE_URL: "https://example.test", SITE_MODE: "firewood" });
    expect(sitemap().map((p) => p.url)).toEqual(["https://example.test/", "https://example.test/gutters", "https://example.test/refer"]);
  });

  it("lists only the gutter site while firewood is switched off, whatever the environment says", async () => {
    const { sitemap } = await load({ SITE_URL: "https://example.test", SITE_MODE: "firewood", FIREWOOD_PREVIEW: "true" }, "off");
    expect(sitemap().map((p) => p.url)).toEqual(["https://example.test/", "https://example.test/refer"]);
  });
});

describe("JSON-LD", () => {
  it("builds every link from the configured address and invents nothing", async () => {
    const { schema } = await load({ SITE_URL: "https://example.test" });
    for (const graph of [schema.homeJsonLd(), schema.firewoodJsonLd("/firewood")]) {
      const text = JSON.stringify(graph);
      expect(JSON.parse(text)).toEqual(graph);
      const urls = text.match(/https?:\/\/[^"]+/g) ?? [];
      expect(urls.filter((u) => !u.startsWith("https://example.test") && !u.startsWith("https://schema.org"))).toEqual([]);
      // No street address, coordinates, hours, ratings or reviews: none are confirmed.
      for (const key of ['"address"', '"geo"', '"openingHours', '"aggregateRating"', '"review"']) expect(text).not.toContain(key);
    }
  });

  it("doesn't mention firewood in the home page markup while it's switched off", async () => {
    const on = await load({ SITE_URL: "https://example.test", FIREWOOD_PREVIEW: "true" });
    expect(JSON.stringify(on.schema.homeJsonLd())).toContain("Firewood delivery");
    const off = await load({ SITE_URL: "https://example.test", FIREWOOD_PREVIEW: "true" }, "off");
    expect(JSON.stringify(off.schema.homeJsonLd()).toLowerCase()).not.toContain("firewood");
  });

  it("describes the business, its service and its FAQ on the home page", async () => {
    const { schema } = await load({ SITE_URL: "https://example.test" });
    const types = (schema.homeJsonLd()["@graph"] as Array<{ "@type": string }>).map((n) => n["@type"]);
    expect(types).toEqual(["WebSite", "HomeAndConstructionBusiness", "Service", "FAQPage"]);
  });

  it("adds a breadcrumb on /firewood but not when firewood is the home page", async () => {
    const { schema } = await load({ SITE_URL: "https://example.test" });
    const types = (path: string) => (schema.firewoodJsonLd(path)["@graph"] as Array<{ "@type": string }>).map((n) => n["@type"]);
    expect(types("/firewood")).toEqual(["HomeAndConstructionBusiness", "Service", "BreadcrumbList"]);
    expect(types("/")).toEqual(["HomeAndConstructionBusiness", "Service"]);
  });
});

describe("FAQ", () => {
  it("quotes the current prices", async () => {
    vi.resetModules();
    const { faqs } = await import("@/content/faqs");
    const { packages, rinse } = await import("@/content/pricing");
    const cost = faqs.find((f) => f.q === "How much does gutter cleaning cost?")!.a;
    for (const p of packages) expect(cost).toContain(`$${p.price}`);
    expect(cost).toContain(`$${rinse.price}`);
  });
});
