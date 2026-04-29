import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { confirm, intro, isCancel, outro } from "@clack/prompts";
import { convertMintToDocs, MINTLIFY_THEMES, parseDocsJson, safeParseDocsJson } from "@tangly/schema";
import { defineCommand } from "citty";
import pc from "picocolors";

const TANGLY_SCHEMA_URL = "https://tanglydocs.com/schema/docs.json";

/**
 * Migrate a Mintlify project. Two paths:
 *   - Legacy: project has `mint.json`        → full conversion via convertMintToDocs.
 *   - Modern: project has `docs.json`        → validate + lightly massage
 *     ($schema URL, theme alias). Mintlify moved to docs.json mid-2025.
 */
export const migrateCommand = defineCommand({
  meta: {
    name: "migrate",
    description: "Migrate a Mintlify project to Tangly (mint.json or existing docs.json)",
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
      description: "Keep mint.json after legacy migration",
      default: false,
    },
    "keep-theme": {
      type: "boolean",
      description: "Don't auto-swap Mintlify theme name to 'tang'",
      default: false,
    },
  },
  async run({ args }) {
    intro(pc.bgCyan(pc.black(" Tangly migrate ")));

    const userRoot = resolve(args.root);
    const mintPath = resolve(userRoot, "mint.json");
    const docsPath = resolve(userRoot, "docs.json");

    const hasMint = existsSync(mintPath);
    const hasDocs = existsSync(docsPath);

    if (!hasMint && !hasDocs) {
      console.error(pc.red(`✗ No mint.json or docs.json found at ${userRoot}`));
      process.exit(1);
    }

    if (hasMint && hasDocs) {
      console.log(
        pc.yellow(
          `⚠ Both mint.json and docs.json present. Preferring docs.json (Mintlify's current shape).`,
        ),
      );
      console.log(pc.dim(`  mint.json will be left in place.`));
    }

    if (hasDocs) {
      await migrateExistingDocs({
        docsPath,
        userRoot,
        yes: args.yes,
        keepTheme: args["keep-theme"],
      });
    } else {
      await migrateMintJson({
        mintPath,
        docsPath,
        userRoot,
        yes: args.yes,
        keepSource: args["keep-source"],
      });
    }

    outro(`${pc.green("✓")} Done. Run ${pc.cyan("tangly dev")} to preview.`);
  },
});

async function migrateMintJson(opts: {
  mintPath: string;
  docsPath: string;
  userRoot: string;
  yes: boolean;
  keepSource: boolean;
}): Promise<void> {
  const { mintPath, docsPath, userRoot, yes, keepSource } = opts;

  const mint = JSON.parse(readFileSync(mintPath, "utf8")) as Record<string, unknown>;
  const docs = convertMintToDocs(mint);

  console.log(pc.dim("\nGenerated docs.json preview:"));
  console.log(JSON.stringify(docs, null, 2).split("\n").slice(0, 30).join("\n"));
  if (JSON.stringify(docs).length > 1500) console.log(pc.dim("  …"));

  if (!yes) {
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

  if (!keepSource) {
    let bak = resolve(userRoot, "mint.json.bak");
    let n = 1;
    while (existsSync(bak)) {
      bak = resolve(userRoot, `mint.json.bak.${n}`);
      n += 1;
    }
    const { renameSync } = await import("node:fs");
    renameSync(mintPath, bak);
    const bakName = bak.split("/").pop() ?? "mint.json.bak";
    console.log(pc.dim(`  → mint.json renamed to ${bakName}`));
  }
  console.log(pc.green(`✓ Wrote ${docsPath}`));
}

async function migrateExistingDocs(opts: {
  docsPath: string;
  userRoot: string;
  yes: boolean;
  keepTheme: boolean;
}): Promise<void> {
  const { docsPath, yes, keepTheme } = opts;
  const raw = readFileSync(docsPath, "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  // Validate against Tangly's schema first — Tangly accepts every Mintlify
  // field, so this should pass for any well-formed Mintlify docs.json.
  const result = safeParseDocsJson(parsed);
  if (!result.success) {
    console.error(pc.red(`✗ Existing docs.json doesn't validate against Tangly's schema:`));
    console.error(pc.red(result.error.message.split("\n").slice(0, 10).join("\n")));
    console.error(pc.dim(`  Fix the file (or open an issue) and rerun.`));
    process.exit(1);
  }

  // Plan changes.
  const changes: string[] = [];
  const updated: Record<string, unknown> = { ...parsed };

  // 1. $schema → Tangly's schema URL.
  const currentSchema = updated.$schema as string | undefined;
  if (currentSchema !== TANGLY_SCHEMA_URL) {
    changes.push(
      `  $schema  ${pc.dim(currentSchema ?? "(none)")} → ${pc.cyan(TANGLY_SCHEMA_URL)}`,
    );
  }

  // 2. theme: Mintlify theme name aliases to 'tang' unless the user opts
  //    out via --keep-theme. Mintlify themes (mint, maple, palm, …) are
  //    accepted by the schema and Tangly's runtime treats them as 'tang',
  //    but renaming makes intent explicit.
  const currentTheme = updated.theme as string | undefined;
  const isMintlifyTheme = currentTheme && (MINTLIFY_THEMES as readonly string[]).includes(currentTheme);
  if (!keepTheme && isMintlifyTheme && currentTheme !== "tang") {
    changes.push(`  theme    ${pc.dim(currentTheme)} → ${pc.cyan("tang")}`);
  }

  if (changes.length === 0) {
    console.log(pc.green("✓ docs.json already matches Tangly's shape — nothing to migrate."));
    parseDocsJson(parsed); // surfaces any warnings
    return;
  }

  console.log("\nProposed changes:");
  for (const c of changes) console.log(c);

  if (!yes) {
    const ok = await confirm({
      message: "Apply these changes to docs.json?",
      initialValue: true,
    });
    if (isCancel(ok) || !ok) {
      outro(pc.yellow("Migration cancelled."));
      process.exit(0);
    }
  }

  updated.$schema = TANGLY_SCHEMA_URL;
  if (!keepTheme && isMintlifyTheme && currentTheme !== "tang") {
    updated.theme = "tang";
  }

  writeFileSync(docsPath, JSON.stringify(updated, null, 2) + "\n", "utf8");
  console.log(pc.green(`✓ Updated ${docsPath}`));
}
