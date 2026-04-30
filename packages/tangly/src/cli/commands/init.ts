import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { intro, isCancel, outro, select, text } from "@clack/prompts";
import { defineCommand } from "citty";
import pc from "picocolors";
import { readExistingConfig, scaffoldFromDir } from "../init-from-dir.js";

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
      writeTanglyignoreIfAbsent(dir);
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

    const name = await text({
      message: "Project name?",
      placeholder: "My Docs",
      validate: (v) => (v && v.length > 0 ? undefined : "Required"),
    });
    if (isCancel(name)) process.exit(1);

    const template = await select({
      message: "Template",
      options: [
        { value: "basic", label: "Basic (hello world)" },
        { value: "api", label: "API (with OpenAPI)" },
      ],
    });
    if (isCancel(template)) process.exit(1);

    mkdirSync(dir, { recursive: true });

    const config = {
      $schema: "https://tanglydocs.com/schema/docs.json",
      name,
      theme: "tang",
      colors: { primary: "#0ea5e9" },
      navigation: {
        groups: [{ group: "Get Started", pages: ["introduction"] }],
      },
    };
    writeFileSync(resolve(dir, "docs.json"), JSON.stringify(config, null, 2), "utf8");

    writeFileSync(
      resolve(dir, "introduction.mdx"),
      [
        "---",
        "title: Introduction",
        `description: Welcome to ${name}`,
        "---",
        "",
        `# ${name}`,
        "",
        "Welcome to your new Tangly docs site.",
        "",
        "<Note>",
        "  Edit `introduction.mdx` to get started.",
        "</Note>",
        "",
      ].join("\n"),
      "utf8",
    );

    writeTanglyignoreIfAbsent(dir);

    outro(`${pc.green("✓")} Project scaffolded at ${pc.cyan(dir)}`);
    console.log(pc.dim(`Run \`tangly dev\` from ${dir} to start.`));
  },
});

/**
 * Drop a starter `.tanglyignore` so it's discoverable. Build copies every
 * file under the project root (minus baseline + .gitignore + .tanglyignore)
 * — this nudges users to extend the exclusion list.
 */
function writeTanglyignoreIfAbsent(dir: string): void {
  const path = resolve(dir, ".tanglyignore");
  if (existsSync(path)) return;
  writeFileSync(
    path,
    [
      "# .tanglyignore — files to exclude from the build output.",
      "# Additive to .gitignore (no need to repeat node_modules/, dist/, etc.).",
      "# Syntax: same as .gitignore.",
      "#",
      "# Examples:",
      "# scripts/",
      "# *.draft.txt",
      "",
    ].join("\n"),
    "utf8",
  );
}
