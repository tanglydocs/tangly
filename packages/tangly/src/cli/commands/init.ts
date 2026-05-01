import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { intro, isCancel, outro, select, text } from "@clack/prompts";
import { defineCommand } from "citty";
import pc from "picocolors";
import { readExistingConfig, scaffoldFromDir } from "../init-from-dir.js";
import { applyTemplate, listTemplates } from "../templates.js";

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description: "Scaffold a new Tangly project",
  },
  args: {
    dir: {
      type: "positional",
      description: "Target directory (default current)",
      required: false,
      default: ".",
    },
    from: {
      type: "string",
      description:
        "Path to an existing folder of `.md`/`.mdx` files. Synthesizes a docs.json by walking the tree (folders → groups). Idempotent — re-run merges new files into the existing nav.",
    },
    template: {
      type: "string",
      description: "Template to scaffold from. Defaults to `starter`.",
    },
    name: {
      type: "string",
      description: "Project name. Skips the interactive prompt when provided.",
    },
  },
  async run({ args }) {
    intro(pc.bgCyan(pc.black(" Tangly ")));

    const dir = resolve(args.dir);

    // --from <dir>: walk an existing markdown folder and synthesize docs.json.
    if (args.from) {
      const src = resolve(args.from);
      if (!existsSync(src)) {
        console.error(pc.red(`✗ --from path not found: ${src}`));
        process.exit(1);
      }
      const existing = readExistingConfig(dir);
      const { config, summary } = scaffoldFromDir({ src, existingConfig: existing });
      mkdirSync(dir, { recursive: true });
      writeFileSync(resolve(dir, "docs.json"), JSON.stringify(config, null, 2), "utf8");
      const verb = existing ? "Merged" : "Generated";
      outro(
        `${pc.green("✓")} ${verb} docs.json with ${summary.pages} pages across ${summary.groups} groups.`,
      );
      console.log(pc.dim("Review docs.json and run `tangly dev` from the docs root to start."));
      return;
    }

    if (existsSync(resolve(dir, "docs.json"))) {
      console.error(pc.red(`✗ docs.json already exists at ${dir}`));
      process.exit(1);
    }

    const templates = listTemplates();
    if (templates.length === 0) {
      console.error(
        pc.red("✗ No templates bundled. Did `bun run scripts/bundle-templates.ts` run?"),
      );
      process.exit(1);
    }

    let name: string;
    if (args.name) {
      name = args.name;
    } else {
      const prompted = await text({
        message: "Project name?",
        placeholder: "My Docs",
        validate: (v) => (v && v.length > 0 ? undefined : "Required"),
      });
      if (isCancel(prompted)) process.exit(1);
      name = prompted as string;
    }

    let templateName = args.template;
    if (!templateName) {
      if (templates.length === 1) {
        templateName = templates[0]!.name;
      } else {
        const picked = await select({
          message: "Template",
          options: templates.map((t) => ({
            value: t.name,
            label: t.label,
            hint: t.description,
          })),
        });
        if (isCancel(picked)) process.exit(1);
        templateName = picked as string;
      }
    }

    const result = await applyTemplate({ template: templateName, dir, name });

    outro(
      `${pc.green("✓")} Scaffolded ${pc.cyan(templateName)} at ${pc.cyan(dir)} (${result.written.length} files)`,
    );
    if (result.skipped.length > 0) {
      console.log(pc.yellow(`  Skipped existing: ${result.skipped.join(", ")}`));
    }
    console.log(pc.dim(`Run \`tangly dev\` from ${dir} to start.`));
  },
});
