import { describe, expect, test } from "vitest";
import { isContentModulesId, rewriteContentModulesDrivePaths } from "./content-modules-winpath.js";

// The exact map body Astro emits when the project (E:\) and the runtime (C:\)
// are on different Windows drives — taken from the issue #6 error log.
const CROSS_DRIVE = `
export default new Map([
["E:/project/Github/docs-poultry/api-reference/overview.mdx", () => import("astro:content-layer-deferred-module?astro%3Acontent-layer-deferred-module=&fileName=E%3A%2Fproject%2FGithub%2Fdocs-poultry%2Fapi-reference%2Foverview.mdx&astroContentModuleFlag=true")],
["E:/project/Github/docs-poultry/index.mdx", () => import("astro:content-layer-deferred-module?astro%3Acontent-layer-deferred-module=&fileName=E%3A%2Fproject%2FGithub%2Fdocs-poultry%2Findex.mdx&astroContentModuleFlag=true")]]);
`;

describe("rewriteContentModulesDrivePaths", () => {
  test("rewrites drive-letter fileName params to file:// URLs", () => {
    const out = rewriteContentModulesDrivePaths(CROSS_DRIVE);
    // fileName now decodes to a file:// URL that `new URL(x, root)` accepts.
    const param = out.match(/fileName=([^&"']+)/)?.[1] ?? "";
    expect(decodeURIComponent(param)).toBe(
      "file:///E:/project/Github/docs-poultry/api-reference/overview.mdx",
    );
    expect(out).not.toContain("fileName=E%3A");
  });

  test("leaves the Map key (entry.filePath) untouched", () => {
    const out = rewriteContentModulesDrivePaths(CROSS_DRIVE);
    // The lookup key must still match the data store's stored filePath.
    expect(out).toContain('["E:/project/Github/docs-poultry/api-reference/overview.mdx", () =>');
  });

  test("the rewritten fileName survives new URL(fileName, root) cross-drive", () => {
    const out = rewriteContentModulesDrivePaths(CROSS_DRIVE);
    const param = out.match(/fileName=([^&"']+)/)?.[1] ?? "";
    const fileName = decodeURIComponent(param);
    // Mirror Astro: resolve against a root on a *different* drive.
    const root = "file:///C:/Users/quader/AppData/Roaming/npm/node_modules/tangly/runtime/";
    expect(() => new URL(fileName, root)).not.toThrow();
    expect(new URL(fileName, root).protocol).toBe("file:");
  });

  test("percent-encodes URL-significant chars so the path is not truncated", () => {
    // `#` and `%` are legal in filenames; a naive `new URL("file:///"+path)`
    // would treat `#b.mdx` as a fragment and drop it. Round-trip the rewritten
    // value exactly as Astro does (URLSearchParams decode → new URL(_, root))
    // and assert the full path survives. pathname is asserted (not
    // fileURLToPath) so it's platform-independent on the POSIX CI runners.
    const raw = "E:/docs/a#b%c.mdx";
    const input = `import("astro:content-layer-deferred-module?fileName=${encodeURIComponent(raw)}&astroContentModuleFlag=true")`;
    const out = rewriteContentModulesDrivePaths(input);
    const param = decodeURIComponent(out.match(/fileName=([^&"']+)/)?.[1] ?? "");
    const resolved = new URL(param, "file:///C:/runtime/");
    expect(resolved.protocol).toBe("file:");
    expect(resolved.hash).toBe(""); // nothing leaked into a fragment
    expect(decodeURIComponent(resolved.pathname)).toBe("/E:/docs/a#b%c.mdx");
  });

  test("is inert on POSIX-style relative fileNames (no drive letter)", () => {
    const posix = `["api-reference/overview.mdx", () => import("astro:content-layer-deferred-module?fileName=api-reference%2Foverview.mdx&astroContentModuleFlag=true")]`;
    expect(rewriteContentModulesDrivePaths(posix)).toBe(posix);
  });

  test("isContentModulesId matches POSIX and Windows ids", () => {
    expect(isContentModulesId("/home/x/runtime/.astro/content-modules.mjs")).toBe(true);
    expect(isContentModulesId("C:\\Users\\q\\tangly\\runtime\\.astro\\content-modules.mjs")).toBe(
      true,
    );
    expect(isContentModulesId("/home/x/runtime/.astro/data-store.json")).toBe(false);
  });
});
