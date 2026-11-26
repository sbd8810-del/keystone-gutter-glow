// Which copy of the site this is, on any host. No imports, so next.config.ts can use it too.
//
//   SITE_ENV=production   the real, public site: the Google tag loads, and Google may list it
//   SITE_ENV=preview      a test copy: no Google tag, hidden from Google, and it never emails Jimmy
//
// On Vercel, VERCEL_ENV says this automatically, so SITE_ENV is only needed on other hosts.
// If both are set, SITE_ENV wins. With neither (local runs, tests), it's "development".

export type DeployEnv = "production" | "preview" | "development";

type Env = Record<string, string | undefined>;

export function deployEnv(env: Env = process.env): DeployEnv {
  const kind = (env.SITE_ENV || env.VERCEL_ENV || "").trim().toLowerCase();
  return kind === "production" || kind === "preview" ? kind : "development";
}

/**
 * Whether Google and other search engines may list this copy. The live site: yes. Previews, test
 * copies and local runs: never, so search results only ever point at the real site.
 *
 *   ALLOW_INDEXING=false   hides the live site from Google too
 *   ALLOW_INDEXING=true    opens any copy (the live site doesn't need it)
 *
 * There's no robots.txt on purpose (Sam, 2026-11-26): Google may crawl every page. Pages that
 * shouldn't show in search results, like the booking confirmation, say so on the page itself.
 */
export function indexingAllowed(env: Env = process.env): boolean {
  const setting = (env.ALLOW_INDEXING || "").trim().toLowerCase();
  if (setting === "false") return false;
  return setting === "true" || deployEnv(env) === "production";
}
