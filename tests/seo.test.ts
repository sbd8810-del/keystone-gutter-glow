import { existsSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { indexingAllowed } from "@/lib/deploy";

// Indexing, the sitemap and the JSON-LD all read the deployment's environment when they load,
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
    env: await import("@/lib/env"),
    headers: () => import("@/next.config").then((m) => m.default.headers!()),
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

describe("Google indexing", () => {
  it("lists the live site, on Vercel or any other host, and never a preview, test copy or local run", () => {
    expect(indexingAllowed({ VERCEL_ENV: "production" })).toBe(true);
    expect(indexingAllowed({ SITE_ENV: "production" })).toBe(true);
    expect(indexingAllowed({ VERCEL_ENV: "preview" })).toBe(false);
    expect(indexingAllowed({ SITE_ENV: "preview", VERCEL_ENV: "production" })).toBe(false);
    expect(indexingAllowed({ NODE_ENV: "production" })).toBe(false);
    expect(indexingAllowed({})).toBe(false);
  });

  it("can still be switched either way with ALLOW_INDEXING", () => {
    expect(indexingAllowed({ VERCEL_ENV: "production", ALLOW_INDEXING: "false" })).toBe(false);
    expect(indexingAllowed({ VERCEL_ENV: "preview", ALLOW_INDEXING: "true" })).toBe(true);
  });

  it("has no robots.txt, so Google may crawl every page (Sam, 2026-11-26)", () => {
    expect(existsSync("app/robots.ts")).toBe(false);
    expect(existsSync("public/robots.txt")).toBe(false);
  });

  it("tells Google to list the live site's pages, and sends no noindex header there except on the APIs", async () => {
    const { env, headers } = await load({ VERCEL_ENV: "production" });
    expect(env.allowIndexing).toBe(true);
    const rules = await headers();
    const robotsHeader = (source: string) => rules.find((r) => r.source === source)?.headers.find((h) => h.key === "X-Robots-Tag")?.value;
    expect(robotsHeader("/:path*")).toBeUndefined();
    expect(robotsHeader("/api/:path*")).toBe("noindex, nofollow");
  });

  it("keeps a preview out of Google entirely", async () => {
    const { env, headers } = await load({ VERCEL_ENV: "preview" });
    expect(env.allowIndexing).toBe(false);
    const all = (await headers()).find((r) => r.source === "/:path*")!;
    expect(all.headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow" });
  });

  it("keeps private pages out of search results on the page itself, since there's no robots.txt to do it", () => {
    for (const page of ["booking-confirmed", "check/[kind]/[id]", "firewood/order", "notify-test", "referred", "referred/[code]"]) {
      expect(readFileSync(`app/${page}/page.tsx`, "utf8"), page).toContain("robots: { index: false, follow: false }");
    }
  });
});

describe("sitemap", () => {
  it("uses the configured address and lists firewood when it's public", async () => {
    const { sitemap } = await load({ SITE_URL: "https://example.test/", FIREWOOD_PREVIEW: "true" });
    expect(sitemap().map((p) => p.url)).toEqual(["https://example.test/", "https://example.test/firewood", "https://example.test/referrals"]);
  });

  it("falls back to Vercel's production domain, and leaves firewood out when it's hidden", async () => {
    const { sitemap } = await load({ VERCEL_PROJECT_PRODUCTION_URL: "keystone-gutter-glow.vercel.app", VERCEL_ENV: "production" });
    expect(sitemap().map((p) => p.url)).toEqual(["https://keystone-gutter-glow.vercel.app/", "https://keystone-gutter-glow.vercel.app/referrals"]);
  });

  it("lists /gutters instead in firewood mode", async () => {
    const { sitemap } = await load({ SITE_URL: "https://example.test", SITE_MODE: "firewood" });
    expect(sitemap().map((p) => p.url)).toEqual(["https://example.test/", "https://example.test/gutters", "https://example.test/referrals"]);
  });

  it("lists only the gutter site while firewood is switched off, whatever the environment says", async () => {
    const { sitemap } = await load({ SITE_URL: "https://example.test", SITE_MODE: "firewood", FIREWOOD_PREVIEW: "true" }, "off");
    expect(sitemap().map((p) => p.url)).toEqual(["https://example.test/", "https://example.test/referrals"]);
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
