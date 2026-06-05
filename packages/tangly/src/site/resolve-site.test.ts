import { describe, expect, test } from "vitest";
import { resolveSite } from "./resolve-site.js";

const PROD = "https://docs.tangly.dev";

describe("resolveSite", () => {
  test("plain build uses docs.json siteUrl for both bases, indexed", () => {
    const r = resolveSite({ docsSiteUrl: PROD, env: {} });
    expect(r).toEqual({ ogUrl: PROD, canonicalUrl: PROD, noindex: false, isProd: true });
  });

  test("strips trailing slashes", () => {
    const r = resolveSite({ docsSiteUrl: `${PROD}/`, env: {} });
    expect(r.ogUrl).toBe(PROD);
    expect(r.canonicalUrl).toBe(PROD);
  });

  test("dev origin wins over docs.json and is never noindex", () => {
    const r = resolveSite({ docsSiteUrl: PROD, env: {}, devOrigin: "http://localhost:4321/" });
    expect(r).toEqual({
      ogUrl: "http://localhost:4321",
      canonicalUrl: "http://localhost:4321",
      noindex: false,
      isProd: false,
    });
  });

  test("explicit override wins over docs.json and dev origin", () => {
    const r = resolveSite({
      docsSiteUrl: PROD,
      env: { TANGLY_SITE_URL: "https://x.dev" },
      devOrigin: "http://localhost:4321",
    });
    expect(r.ogUrl).toBe("https://x.dev");
    expect(r.canonicalUrl).toBe("https://x.dev");
    expect(r.noindex).toBe(false);
  });

  test("override + preview: og at staging, canonical at prod, noindex", () => {
    const r = resolveSite({
      docsSiteUrl: PROD,
      env: { TANGLY_SITE_URL: "https://staging.x.dev", TANGLY_ENV: "preview" },
    });
    expect(r).toEqual({
      ogUrl: "https://staging.x.dev",
      canonicalUrl: PROD,
      noindex: true,
      isProd: false,
    });
  });

  test("Vercel preview: og at deploy, canonical at prod, noindex", () => {
    const r = resolveSite({
      docsSiteUrl: PROD,
      env: {
        VERCEL: "1",
        VERCEL_URL: "pr-123.vercel.app",
        VERCEL_ENV: "preview",
        VERCEL_PROJECT_PRODUCTION_URL: "x.dev",
      },
    });
    expect(r.ogUrl).toBe("https://pr-123.vercel.app");
    expect(r.canonicalUrl).toBe(PROD);
    expect(r.noindex).toBe(true);
  });

  test("Vercel production uses the committed domain, not the vercel.app URL", () => {
    const r = resolveSite({
      docsSiteUrl: PROD,
      env: { VERCEL: "1", VERCEL_URL: "x.vercel.app", VERCEL_ENV: "production" },
    });
    expect(r.ogUrl).toBe(PROD);
    expect(r.canonicalUrl).toBe(PROD);
    expect(r.noindex).toBe(false);
  });

  test("Netlify deploy-preview: og at deploy, canonical at prod, noindex", () => {
    const r = resolveSite({
      docsSiteUrl: PROD,
      env: {
        NETLIFY: "1",
        DEPLOY_PRIME_URL: "https://dp.netlify.app",
        URL: "https://x.dev",
        CONTEXT: "deploy-preview",
      },
    });
    expect(r.ogUrl).toBe("https://dp.netlify.app");
    expect(r.canonicalUrl).toBe(PROD);
    expect(r.noindex).toBe(true);
  });

  test("Cloudflare Pages (no prod signal) defaults to prod unless TANGLY_ENV=preview", () => {
    const indexed = resolveSite({
      docsSiteUrl: PROD,
      env: { CF_PAGES: "1", CF_PAGES_URL: "https://abc.pages.dev" },
    });
    expect(indexed.noindex).toBe(false);
    expect(indexed.canonicalUrl).toBe(PROD);

    const preview = resolveSite({
      docsSiteUrl: PROD,
      env: { CF_PAGES: "1", CF_PAGES_URL: "https://abc.pages.dev", TANGLY_ENV: "preview" },
    });
    expect(preview.ogUrl).toBe("https://abc.pages.dev");
    expect(preview.canonicalUrl).toBe(PROD);
    expect(preview.noindex).toBe(true);
  });

  test("no URL anywhere resolves to empty bases", () => {
    const r = resolveSite({ env: {} });
    expect(r.ogUrl).toBe("");
    expect(r.canonicalUrl).toBe("");
  });
});
