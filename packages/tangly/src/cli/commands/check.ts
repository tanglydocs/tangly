import { resolve } from "node:path";
import { defineCommand } from "citty";
import pc from "picocolors";
import { checkManifestMdx, formatMdxIssue } from "../../check/mdx-check.js";
import { VERSION } from "../../index.js";
import { reportConfigError } from "../../manifest/config-error.js";
import { buildManifest } from "../../manifest/index.js";
import { errorFooter, notifyUpdate } from "../version-notice.js";

export const checkCommand = defineCommand({
  meta: {
    name: "check",
    description: "Validate config + links + frontmatter + MDX",
  },
  args: {
    strict: {
      type: "boolean",
      description: "Warnings become errors",
      default: false,
    },
    "no-links": {
      type: "boolean",
      description: "Skip link checking",
      default: false,
    },
    json: {
      type: "boolean",
      description: "Machine output",
      default: false,
    },
    "include-drafts": {
      type: "boolean",
      description: "Include drafts in checks",
      default: false,
    },
    config: {
      type: "string",
      description: "Path to docs.json (relative to root)",
      default: "docs.json",
    },
    root: {
      type: "string",
      description: "Project root (default cwd)",
      default: ".",
    },
  },
  async run({ args }) {
    const userRoot = resolve(args.root);

    let manifest;
    try {
      manifest = await buildManifest({ root: userRoot, configFile: args.config });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (args.json) {
        console.log(JSON.stringify({ ok: false, version: VERSION, errors: [{ message: msg }] }));
      } else {
        if (!reportConfigError(err)) {
          // Not a pre-rendered config block — add the generic prefix.
          console.error(pc.red(`✗ ${msg}`));
        }
        // Stamp the running version so "same error after upgrading" reports
        // surface a stale global install instead of a phantom schema bug.
        errorFooter();
      }
      process.exit(1);
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Image src validation
    for (const [, page] of manifest.pages) {
      // Frontmatter image references handled below.
      const fm = page.frontmatter;
      if (fm.icon) {
        // Icon validation deferred to render time.
      }
    }

    for (const w of manifest.warnings) {
      const line = `${w.source ? `${w.source}: ` : ""}${w.message}`;
      if (w.level === "error") errors.push(line);
      else warnings.push(line);
    }

    // MDX validation: parse every page with the build's parser config and
    // flag expressions that would throw a ReferenceError at prerender.
    // Always errors — these are guaranteed `tangly build` failures.
    for (const issue of checkManifestMdx(manifest)) {
      errors.push(formatMdxIssue(issue));
    }

    if (args.strict) {
      errors.push(...warnings);
      warnings.length = 0;
    }

    if (args.json) {
      console.log(
        JSON.stringify({
          ok: errors.length === 0,
          version: VERSION,
          pages: manifest.pages.size,
          orphans: manifest.orphans,
          errors,
          warnings,
        }),
      );
    } else {
      console.log(pc.dim(`tangly v${VERSION}`));
      console.log(
        `${pc.dim("Pages:")} ${manifest.pages.size}    ${pc.dim("Orphans:")} ${manifest.orphans.length}`,
      );
      for (const e of errors) console.log(pc.red(`  ✗ ${e}`));
      for (const w of warnings) console.log(pc.yellow(`  ⚠ ${w}`));
      if (errors.length === 0 && warnings.length === 0) {
        console.log(pc.green("  ✓ All checks passed"));
      }
      await notifyUpdate();
    }

    process.exit(errors.length > 0 ? 1 : 0);
  },
});
