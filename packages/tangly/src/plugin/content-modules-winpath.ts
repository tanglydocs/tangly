/**
 * Windows cross-drive fix for Astro's content layer (issue #6).
 *
 * Tangly runs Astro with `root` pointing at the runtime shipped inside the
 * installed `tangly` package, while the user's docs live at `TANGLY_USER_ROOT`.
 * When those are on *different drives* — e.g. a global install on `C:\` but a
 * project on `E:\` — Astro's glob loader can't express the content path
 * relative to `root` (there is no relative path across Windows drives), so it
 * stores the absolute drive-letter path (`E:/project/.../page.mdx`) as the
 * deferred-module `fileName`.
 *
 * At render time Astro resolves that entry with `new URL(fileName, root)`. A
 * leading `E:` is parsed as a URL *scheme*, not a drive, so the result is a
 * non-`file:` URL and `fileURLToPath` throws `ERR_INVALID_URL_SCHEME` — the
 * page renders blank with no body. (Reported on `api-reference/overview` with
 * project on `E:\` and a global `tangly` on `C:\`.)
 *
 * The generated `.astro/content-modules.mjs` looks like:
 *
 *   export default new Map([
 *     ["E:/project/docs/overview.mdx", () => import(
 *       "astro:content-layer-deferred-module?...&fileName=E%3A%2Fproject%2Fdocs%2Foverview.mdx&astroContentModuleFlag=true")],
 *   ]);
 *
 * We rewrite only the `fileName=` query value inside each deferred `import(...)`
 * specifier from a drive-letter path to a `file://` URL. `new URL(fileUrl,
 * root)` then ignores the base and `fileURLToPath` succeeds. The Map *key* is
 * left untouched — it must keep matching `entry.filePath` from the data store,
 * which the runtime uses to look the module up.
 *
 * Inert everywhere else: on POSIX and on same-drive Windows the stored fileName
 * is a relative path, so the drive-letter guard never matches.
 */

/** Matches an absolute Windows drive-letter path, e.g. `E:/...` or `E:\...`. */
const DRIVE_LETTER = /^[A-Za-z]:[/\\]/;

/**
 * Turn an absolute Windows drive-letter path into a `file://` URL, percent-
 * encoding each path segment. We build the URL string by hand rather than via
 * `new URL("file:///" + path)` because URL-significant characters that are
 * legal in filenames — `#` (fragment), `?` (query) — would otherwise be parsed
 * as URL syntax and truncate the path (`E:/a#b.mdx` → `file:///E:/a`). The
 * drive segment (`E:`) is kept literal; `fileURLToPath` decodes the rest.
 */
function driveLetterPathToFileUrl(path: string): string {
  const norm = path.replace(/\\/g, "/");
  const slash = norm.indexOf("/");
  const drive = norm.slice(0, slash); // "E:"
  const rest = norm.slice(slash + 1); // "a#b.mdx" / "dir/file.mdx"
  const encoded = rest.split("/").map(encodeURIComponent).join("/");
  return `file:///${drive}/${encoded}`;
}

/**
 * Rewrite drive-letter `fileName=` params in a content-modules.mjs body to
 * `file://` URLs. Returns the input unchanged when nothing matched.
 */
export function rewriteContentModulesDrivePaths(code: string): string {
  return code.replace(/fileName=([^&"']+)/g, (whole, encoded: string) => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(encoded);
    } catch {
      return whole;
    }
    if (!DRIVE_LETTER.test(decoded)) return whole;
    return `fileName=${encodeURIComponent(driveLetterPathToFileUrl(decoded))}`;
  });
}

/** True when `id` points at Astro's generated content-modules.mjs. */
export function isContentModulesId(id: string): boolean {
  return id.replace(/\\/g, "/").endsWith("/.astro/content-modules.mjs");
}
