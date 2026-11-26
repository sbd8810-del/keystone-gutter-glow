import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { firewoodSwitch, isFirewoodVisible } from "@/content/season";
import { SupabaseBookingStore } from "@/lib/booking/store/supabase";
import { deployEnv } from "@/lib/deploy";
import { clientIp } from "@/lib/rateLimit";
import { supabaseHeaders } from "@/lib/supabase";

// The site runs on any host that runs Node, not just Vercel (README, "Hosting somewhere other than Vercel").

afterEach(() => {
  vi.unstubAllGlobals();
  firewoodSwitch.off = true;
});

describe("which copy of the site this is", () => {
  it("reads Vercel's own setting, or SITE_ENV on any other host", () => {
    expect(deployEnv({ VERCEL_ENV: "production" })).toBe("production");
    expect(deployEnv({ VERCEL_ENV: "preview" })).toBe("preview");
    expect(deployEnv({ SITE_ENV: "production" })).toBe("production");
    expect(deployEnv({ SITE_ENV: " Preview " })).toBe("preview");
    // SITE_ENV wins over Vercel's
    expect(deployEnv({ SITE_ENV: "preview", VERCEL_ENV: "production" })).toBe("preview");
  });

  it("is development when nothing says otherwise, including a local production build", () => {
    expect(deployEnv({})).toBe("development");
    expect(deployEnv({ NODE_ENV: "production" })).toBe("development");
    expect(deployEnv({ VERCEL_ENV: "development" })).toBe("development");
    expect(deployEnv({ SITE_ENV: "prod" })).toBe("development");
  });

  it("shows firewood for review on another host's test copy, never on its live site", () => {
    firewoodSwitch.off = false;
    expect(isFirewoodVisible({ NODE_ENV: "production", SITE_ENV: "preview" })).toBe(true);
    expect(isFirewoodVisible({ NODE_ENV: "production", SITE_ENV: "production" })).toBe(false);
  });
});

describe("the Supabase key", () => {
  it("sends the newer sb_secret_ key on apikey only, as Supabase asks", () => {
    expect(supabaseHeaders("sb_secret_abc")).toEqual({ apikey: "sb_secret_abc", "Content-Type": "application/json" });
  });

  it("keeps sending the older service_role key on both headers", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.e30.sig";
    expect(supabaseHeaders(jwt)).toEqual({ apikey: jwt, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" });
  });

  it("is what the booking store actually sends", async () => {
    const seen: Headers[] = [];
    vi.stubGlobal("fetch", (async (_input: string | URL | Request, init?: RequestInit) => {
      seen.push(new Headers(init?.headers));
      return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch);
    await new SupabaseBookingStore("https://x.supabase.co", "sb_secret_abc").listTaken("2026-12-01", "2026-12-01");
    expect(seen[0]!.get("apikey")).toBe("sb_secret_abc");
    expect(seen[0]!.has("authorization")).toBe(false);
  });
});

describe("the visitor's address for rate limits", () => {
  const req = (headers: Record<string, string>) => new Request("http://localhost/api/bookings", { headers });

  it("takes the address the host's proxy added, not one the visitor typed in", () => {
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4" }))).toBe("1.2.3.4");
    expect(clientIp(req({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" }))).toBe("1.2.3.4");
    expect(clientIp(req({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIp(req({}))).toBe("unknown");
  });
});

describe("the daily keep-alive off Vercel", () => {
  const workflow = readFileSync(".github/workflows/keepalive.yml", "utf8");

  it("runs every day, and on demand to test it", () => {
    expect(workflow).toMatch(/schedule:\s*\n\s*- cron: "30 13 \* \* \*"/);
    expect(workflow).toContain("workflow_dispatch:");
  });

  it("calls /api/keepalive at SITE_URL with CRON_SECRET, and fails loudly when it doesn't answer", () => {
    expect(workflow).toContain("if: ${{ vars.SITE_URL != '' }}");
    expect(workflow).toContain("SITE_URL: ${{ vars.SITE_URL }}");
    expect(workflow).toContain("CRON_SECRET: ${{ secrets.CRON_SECRET }}");
    expect(workflow).toContain('"${SITE_URL%/}/api/keepalive"');
    expect(workflow).toContain("Authorization: Bearer $CRON_SECRET");
    expect(workflow).toContain("--fail-with-body");
  });
});

describe("what a host needs to know", () => {
  it("declares the Node version Next.js needs, so hosts pick a working one", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { engines?: { node?: string }; scripts: Record<string, string> };
    expect(pkg.engines?.node).toBe(">=20.9.0");
    expect(pkg.scripts.build).toBe("next build");
    expect(pkg.scripts.start).toBe("next start");
  });
});

describe("the check on every push", () => {
  const workflow = readFileSync(".github/workflows/check.yml", "utf8");

  it("runs the tests and the real build for every push to main, with no secrets", () => {
    expect(workflow).toMatch(/push:\s*\n\s*branches: \[main\]/);
    expect(workflow).toContain("run: npm ci");
    expect(workflow).toContain("run: npm test");
    expect(workflow).toContain("run: npm run build");
    expect(workflow).not.toContain("secrets.");
    expect(workflow).toMatch(/permissions:\s*\n\s*contents: read/);
  });
});
