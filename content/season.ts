// Which business the site is showing. This is the one switch between the gutter-cleaning site
// and firewood mode. Read on the server only: client components get the result as props.
//
// FIREWOOD IS SWITCHED OFF right now (Jimmy's call, 2026-11-09): see `firewoodSwitch` below.
// While it's off, everything in this comment is ignored and the site is gutters only.
//
//   SITE_MODE=gutter    (default) "/" is the gutter site. /firewood is hidden on production.
//   SITE_MODE=firewood  "/" is the firewood site and the gutter site moves to /gutters.
//   FIREWOOD_PREVIEW=true  shows /firewood and the mode switch without changing "/".
//
// Next dev and preview copies (Vercel previews, or SITE_ENV=preview elsewhere) show /firewood
// automatically, so it can be reviewed. The live site never does unless one of the variables above
// says so. Static pages read these at build time, so redeploy after changing one.

import { deployEnv } from "@/lib/deploy";

export type SiteMode = "gutter" | "firewood";

type Env = Record<string, string | undefined>;

/**
 * The off switch for the whole firewood business. While `off` is true, nothing leads to firewood
 * on any deployment, preview or local dev server: no hero button, no menu, rail or footer link, no
 * mode switch, and no firewood mention in the search markup. /firewood, /firewood/order and the
 * firewood share image are 404s, the sitemap leaves it out, and checkout stays shut.
 * SITE_MODE=firewood and FIREWOOD_PREVIEW=true are ignored.
 *
 * All the firewood code, content and tests stay as they are. To bring firewood back, set `off` to
 * false and redeploy: production then shows it again, because FIREWOOD_PREVIEW=true is still set
 * there. Only the tests change `off` at runtime.
 */
export const firewoodSwitch = { off: true };

export function getSiteMode(env: Env = process.env): SiteMode {
  if (firewoodSwitch.off) return "gutter";
  return env.SITE_MODE === "firewood" ? "firewood" : "gutter";
}

export function isFirewoodVisible(env: Env = process.env): boolean {
  if (firewoodSwitch.off) return false;
  if (getSiteMode(env) === "firewood" || env.FIREWOOD_PREVIEW === "true") return true;
  const kind = deployEnv(env);
  if (kind !== "development") return kind === "preview";
  return env.NODE_ENV !== "production";
}

export interface ModeLinks {
  mode: SiteMode;
  gutterHref: string;
  firewoodHref: string;
}

/** Where each side of the mode switch points. null when the switch shouldn't show. */
export function modeLinks(env: Env = process.env): ModeLinks | null {
  if (!isFirewoodVisible(env)) return null;
  const mode = getSiteMode(env);
  return mode === "firewood"
    ? { mode, gutterHref: "/gutters", firewoodHref: "/" }
    : { mode, gutterHref: "/", firewoodHref: "/firewood" };
}
