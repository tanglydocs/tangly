/**
 * Resolve the absolute base URLs + indexing posture for a build/dev run.
 *
 * Two distinct bases matter: `og:image` must point at *this* deploy (so the
 * image actually resolves on a preview), while `canonical` should point at the
 * *production* domain (so previews never compete in search). Precedence:
 *
 *   --site-url / TANGLY_SITE_URL   (explicit override — wins)
 *   dev request origin             (tangly dev, e.g. Astro.url.origin)
 *   platform deploy URL            (Vercel / Netlify / Cloudflare Pages)
 *   docs.json siteUrl              (committed production canonical)
 *
 * Non-production deploys (previews/staging) get `noindex` and a canonical that
 * points back at production.
 *
 * Lives in `@tanglydocs/schema` (the shared leaf both `tangly` and the themes
 * depend on) so theme components can resolve SEO URLs without importing `tangly`
 * — keeping the package graph acyclic.
 */

export interface ResolvedSite {
  /** Absolute base for og:image / twitter:image (this deploy). No trailing slash. */
  ogUrl: string;
  /** Absolute base for canonical / og:url (production domain). No trailing slash. */
  canonicalUrl: string;
  /** Emit robots noindex (non-production deploy). */
  noindex: boolean;
  /** Whether this run is the production deploy. */
  isProd: boolean;
}

export interface ResolveSiteInput {
  /** docs.json `siteUrl` — the committed production canonical. */
  docsSiteUrl?: string;
  /** Environment to read overrides + platform vars from. Defaults vary by caller. */
  env?: Record<string, string | undefined>;
  /** Live request origin (e.g. `Astro.url.origin`); set only in dev. */
  devOrigin?: string;
}

function clean(url: string | undefined): string {
  return (url ?? "").trim().replace(/\/+$/, "");
}

interface Platform {
  deployUrl?: string;
  prodUrl?: string;
  /** undefined when the platform exposes no reliable prod signal (e.g. CF Pages). */
  isProd?: boolean;
}

/** Detect the deploy URL + environment from common host platforms. */
export function detectPlatform(env: Record<string, string | undefined>): Platform | null {
  if (env.VERCEL || env.VERCEL_URL) {
    return {
      deployUrl: env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined,
      prodUrl: env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
        : undefined,
      isProd: env.VERCEL_ENV ? env.VERCEL_ENV === "production" : undefined,
    };
  }
  if (env.NETLIFY) {
    return {
      deployUrl: env.DEPLOY_PRIME_URL || env.DEPLOY_URL || undefined,
      prodUrl: env.URL || undefined,
      isProd: env.CONTEXT ? env.CONTEXT === "production" : undefined,
    };
  }
  if (env.CF_PAGES) {
    // Cloudflare Pages exposes no reliable production signal — callers should
    // set TANGLY_ENV=preview on preview branches to get noindex/canonical.
    return { deployUrl: env.CF_PAGES_URL || undefined, isProd: undefined };
  }
  return null;
}

export function resolveSite(input: ResolveSiteInput): ResolvedSite {
  const env = input.env ?? {};
  const docsUrl = clean(input.docsSiteUrl);
  const override = clean(env.TANGLY_SITE_URL);
  const explicitEnv = env.TANGLY_ENV;
  const isPreviewEnv = explicitEnv === "preview";

  // 1. Explicit override wins. With TANGLY_ENV=preview it still points canonical
  //    at the committed prod domain and goes noindex (manual staging).
  if (override) {
    const prod = docsUrl || override;
    return {
      ogUrl: override,
      canonicalUrl: isPreviewEnv ? prod : override,
      noindex: isPreviewEnv,
      isProd: !isPreviewEnv,
    };
  }

  // 2. Dev: everything points at the live request origin.
  if (input.devOrigin) {
    const origin = clean(input.devOrigin);
    return { ogUrl: origin, canonicalUrl: origin, noindex: false, isProd: false };
  }

  // 3. Platform auto-detect, falling back to docs.json.
  const platform = detectPlatform(env);
  const isProd = isPreviewEnv
    ? false
    : explicitEnv === "production"
      ? true
      : (platform?.isProd ?? true);
  const prod = docsUrl || clean(platform?.prodUrl);
  const deploy = (!isProd ? clean(platform?.deployUrl) : "") || prod;
  return {
    ogUrl: deploy || prod,
    canonicalUrl: isProd ? deploy || prod : prod || deploy,
    noindex: !isProd,
    isProd,
  };
}
