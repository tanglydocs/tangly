import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { confirm, intro, isCancel, outro, text } from "@clack/prompts";
import {
  convertMintToDocs,
  formatDocsJsonError,
  formatJsonSyntaxError,
  parseDocsJson,
  safeParseDocsJson,
  TANGLY_THEMES,
} from "@tanglydocs/schema";
import { defineCommand } from "citty";
import pc from "picocolors";
import { VERSION } from "../../index.js";
import { errorFooter, notifyUpdate } from "../version-notice.js";

const TANGLY_SCHEMA_URL = "https://tangly.dev/schema/docs.json";

/**
 * Migrate a project from a legacy docs framework to Tangly. Two paths:
 *   - Legacy: project has `mint.json` → full conversion via convertMintToDocs.
 *   - Modern: project has `docs.json` → validate + update the `$schema` URL.
 *
 * A non-Tangly `theme` value (Mintlify's aspen/maple/…) is rewritten to
 * `tang` — the schema maps those aliases to tang at parse time anyway, so
 * the rewrite is semantics-preserving and makes the file self-describing.
 * Missing `siteUrl` is prompted for interactively (skipped with --yes) so
 * social cards + canonical URLs work without a follow-up `check` round.
 */
export const migrateCommand = defineCommand({
  meta: {
    name: "migrate",
    description: "Migrate a project to Tangly (mint.json or existing docs.json)",
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
  },
  async run({ args }) {
    intro(pc.bgCyan(pc.black(` Tangly migrate v${VERSION} `)));

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
      console.log(pc.yellow(`⚠ Both mint.json and docs.json present. Preferring docs.json.`));
      console.log(pc.dim(`  mint.json will be left in place.`));
    }

    if (hasDocs) {
      await migrateExistingDocs({
        docsPath,
        userRoot,
        yes: args.yes,
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

    await notifyUpdate();
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
  const docs = convertMintToDocs(mint) as Record<string, unknown>;

  // mint.json has no siteUrl equivalent — prompt (interactive only) so
  // social cards + canonical URLs work without a follow-up `check` round.
  if (!docs.siteUrl && !yes) {
    const answer = await text({
      message: "Production site URL? (canonical links + social cards — leave empty to skip)",
      placeholder: "https://docs.example.com",
      validate: (v) =>
        v && !/^https?:\/\/\S+$/.test(v.trim()) ? "Must be an absolute http(s) URL" : undefined,
    });
    if (isCancel(answer)) {
      outro(pc.yellow("Migration cancelled."));
      process.exit(0);
    }
    const siteUrl = (answer ?? "").trim().replace(/\/+$/, "");
    if (siteUrl) docs.siteUrl = siteUrl;
  }

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
}): Promise<void> {
  const { docsPath, yes } = opts;
  const raw = readFileSync(docsPath, "utf8");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    console.error(formatJsonSyntaxError(raw, err, { file: "docs.json" }));
    errorFooter();
    process.exit(1);
  }

  const result = safeParseDocsJson(parsed);
  if (!result.success) {
    console.error(formatDocsJsonError(result.error, { raw, file: "docs.json" }));
    console.error(pc.dim(`\n  Fix the keys above (or open an issue) and rerun.`));
    errorFooter();
    process.exit(1);
  }

  // Plan changes (mutating writes) and notices (informational only).
  const changes: string[] = [];
  const notices: string[] = [];
  const updated: Record<string, unknown> = { ...parsed };

  // 1. $schema → Tangly's schema URL.
  const currentSchema = updated.$schema as string | undefined;
  if (currentSchema !== TANGLY_SCHEMA_URL) {
    changes.push(`  $schema  ${pc.dim(currentSchema ?? "(none)")} → ${pc.cyan(TANGLY_SCHEMA_URL)}`);
  }

  // 2. theme: rewrite non-Tangly values (Mintlify aliases like "aspen") to
  //    "tang". The schema already maps every alias to tang at parse time,
  //    so this only makes the file say what it does.
  const currentTheme = updated.theme as string | undefined;
  const isTanglyTheme = currentTheme && (TANGLY_THEMES as readonly string[]).includes(currentTheme);
  if (currentTheme && !isTanglyTheme) {
    changes.push(`  theme    ${pc.dim(currentTheme)} → ${pc.cyan("tang")}`);
    updated.theme = "tang";
    notices.push(
      `"${currentTheme}" isn't a Tangly theme — alternatives: ${TANGLY_THEMES.join(", ")}`,
    );
  } else if (!currentTheme) {
    notices.push(
      `no theme set — defaulting to "tang". Pick explicitly with: ${TANGLY_THEMES.join(", ")}`,
    );
  }

  // 3. siteUrl: prompt when absent (interactive only). Without it, social
  //    cards and canonical URLs have no absolute base and `check` warns.
  if (!updated.siteUrl && !yes) {
    const answer = await text({
      message: "Production site URL? (canonical links + social cards — leave empty to skip)",
      placeholder: "https://docs.example.com",
      validate: (v) =>
        v && !/^https?:\/\/\S+$/.test(v.trim()) ? "Must be an absolute http(s) URL" : undefined,
    });
    if (isCancel(answer)) {
      outro(pc.yellow("Migration cancelled."));
      process.exit(0);
    }
    const siteUrl = (answer ?? "").trim().replace(/\/+$/, "");
    if (siteUrl) {
      changes.push(`  siteUrl  ${pc.dim("(none)")} → ${pc.cyan(siteUrl)}`);
      updated.siteUrl = siteUrl;
    }
  }

  if (changes.length === 0 && notices.length === 0) {
    console.log(pc.green("✓ docs.json already matches Tangly's shape — nothing to migrate."));
    parseDocsJson(parsed);
    return;
  }

  if (changes.length > 0) {
    console.log("\nProposed changes:");
    for (const c of changes) console.log(c);
  }

  if (notices.length > 0) {
    console.log("\nNotices:");
    for (const n of notices) console.log(`  ${pc.yellow("!")} ${n}`);
  }

  if (changes.length === 0) {
    parseDocsJson(parsed);
    return;
  }

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
  writeFileSync(docsPath, JSON.stringify(updated, null, 2) + "\n", "utf8");
  console.log(pc.green(`✓ Updated ${docsPath}`));
}
