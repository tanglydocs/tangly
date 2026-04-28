import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { confirm, intro, isCancel, outro } from "@clack/prompts";
import { convertMintToDocs } from "@tangly/schema";
import { defineCommand } from "citty";
import pc from "picocolors";

export const migrateCommand = defineCommand({
  meta: {
    name: "migrate",
    description: "Migrate a Mintlify project (mint.json) to Tangly (docs.json)",
  },
  args: {
    root: {
      type: "string",
      description: "Project root (default cwd)",
      default: ".",
    },
    yes: {
      type: "boolean",
      description: "Skip confirmation prompts",
      default: false,
    },
    "keep-source": {
      type: "boolean",
      description: "Keep mint.json after migration (default: rename to mint.json.bak)",
      default: false,
    },
  },
  async run({ args }) {
    intro(pc.bgCyan(pc.black(" Tangly migrate ")));

    const userRoot = resolve(args.root);
    const mintPath = resolve(userRoot, "mint.json");
    const docsPath = resolve(userRoot, "docs.json");

    if (!existsSync(mintPath)) {
      console.error(pc.red(`✗ No mint.json found at ${userRoot}`));
      process.exit(1);
    }

    if (existsSync(docsPath)) {
      console.error(pc.red(`✗ docs.json already exists at ${userRoot}`));
      console.error(pc.dim("  Remove it first, or run with --root to a different directory."));
      process.exit(1);
    }

    const mint = JSON.parse(readFileSync(mintPath, "utf8")) as Record<string, unknown>;
    const docs = convertMintToDocs(mint);

    console.log(pc.dim("\nGenerated docs.json preview:\n"));
    console.log(JSON.stringify(docs, null, 2).split("\n").slice(0, 30).join("\n"));
    if (JSON.stringify(docs).length > 1500) console.log(pc.dim("  …"));

    if (!args.yes) {
      const ok = await confirm({
        message: "Write docs.json and back up mint.json?",
        initialValue: true,
      });
      if (isCancel(ok) || !ok) {
        outro(pc.yellow("Migration cancelled."));
        process.exit(0);
      }
    }

    writeFileSync(docsPath, JSON.stringify(docs, null, 2) + "\n", "utf8");
    if (!args["keep-source"]) {
      const bak = resolve(userRoot, "mint.json.bak");
      const { renameSync } = await import("node:fs");
      renameSync(mintPath, bak);
      console.log(pc.dim(`  → mint.json renamed to mint.json.bak`));
    }
    console.log(pc.green(`✓ Wrote ${docsPath}`));

    // Print a quick summary.
    const tabsCount = (docs.navigation.tabs ?? []).length;
    const groupsCount = (docs.navigation.groups ?? []).length;
    console.log(pc.dim(`  Theme: ${docs.theme}  Tabs: ${tabsCount}  Groups: ${groupsCount}`));

    outro(`${pc.green("✓")} Done. Run ${pc.cyan("tangly dev")} to preview.`);
  },
});
