// Which copy of the site this is, on any host. No imports, so next.config.ts can use it too.
//
//   SITE_ENV=production   the real, public site: the Google tag loads
//   SITE_ENV=preview      a test copy: no Google tag, and it never emails Jimmy
//
// On Vercel, VERCEL_ENV says this automatically, so SITE_ENV is only needed on other hosts.
// If both are set, SITE_ENV wins. With neither (local runs, tests), it's "development".

export type DeployEnv = "production" | "preview" | "development";

type Env = Record<string, string | undefined>;

export function deployEnv(env: Env = process.env): DeployEnv {
  const kind = (env.SITE_ENV || env.VERCEL_ENV || "").trim().toLowerCase();
  return kind === "production" || kind === "preview" ? kind : "development";
}
