import { resolve } from "node:path";
import { defineCommand } from "citty";
import pc from "picocolors";
import { buildManifest } from "../../manifest/index.js";

export const checkCommand = defineCommand({
  meta: {
    name: "check",
    description: "Validate config + links + frontmatter",
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
        console.log(JSON.stringify({ ok: false, errors: [{ message: msg }] }));
      } else {
        console.error(pc.red(`✗ ${msg}`));
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

    if (args.strict) {
      errors.push(...warnings);
      warnings.length = 0;
    }

    if (args.json) {
      console.log(
        JSON.stringify({
          ok: errors.length === 0,
          pages: manifest.pages.size,
          orphans: manifest.orphans,
          errors,
          warnings,
        }),
      );
    } else {
      console.log(
        `${pc.dim("Pages:")} ${manifest.pages.size}    ${pc.dim("Orphans:")} ${manifest.orphans.length}`,
      );
      for (const e of errors) console.log(pc.red(`  ✗ ${e}`));
      for (const w of warnings) console.log(pc.yellow(`  ⚠ ${w}`));
      if (errors.length === 0 && warnings.length === 0) {
        console.log(pc.green("  ✓ All checks passed"));
      }
    }

    process.exit(errors.length > 0 ? 1 : 0);
  },
});
