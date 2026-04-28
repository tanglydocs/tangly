import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { confirm, intro, isCancel, outro } from "@clack/prompts";
import { defineCommand } from "citty";
import pc from "picocolors";
import { getRuntimeDir } from "../runtime-paths.js";

export const ejectCommand = defineCommand({
  meta: {
    name: "eject",
    description: "Materialize the synthesized Astro project into your repo",
  },
  args: {
    root: {
      type: "string",
      description: "Project root (default cwd)",
      default: ".",
    },
    out: {
      type: "string",
      description: "Eject destination (default ./.tangly)",
      default: "./.tangly",
    },
    yes: {
      type: "boolean",
      description: "Skip confirmation",
      default: false,
    },
  },
  async run({ args }) {
    intro(pc.bgYellow(pc.black(" Tangly eject ")));

    const userRoot = resolve(args.root);
    const target = resolve(userRoot, args.out);

    if (existsSync(target)) {
      console.error(pc.red(`✗ ${target} already exists`));
      process.exit(1);
    }

    console.log(pc.dim("Eject is irreversible:"));
    console.log(pc.dim(`  • Materializes the Tangly runtime to ${args.out}/`));
    console.log(pc.dim("  • Replaces ‘tangly’ in dependencies with raw Astro deps"));
    console.log(pc.dim("  • You manage astro.config.mjs and integrations from then on"));

    if (!args.yes) {
      const ok = await confirm({
        message: "Eject?",
        initialValue: false,
      });
      if (isCancel(ok) || !ok) {
        outro(pc.yellow("Eject cancelled."));
        process.exit(0);
      }
    }

    const runtimeDir = getRuntimeDir();
    await mkdir(target, { recursive: true });
    await cp(runtimeDir, target, { recursive: true });

    // Patch the materialized astro.config.mjs to remove the env-var
    // requirement and point at this user root.
    const configPath = resolve(target, "astro.config.mjs");
    if (existsSync(configPath)) {
      let body = readFileSync(configPath, "utf8");
      body = body.replace(
        /const userRoot = process\.env\.TANGLY_USER_ROOT;[\s\S]*?\}\s*\n/,
        `const userRoot = ${JSON.stringify(userRoot)};\n`,
      );
      writeFileSync(configPath, body, "utf8");
    }

    // Update package.json: drop tangly, add astro deps directly.
    const pkgPath = resolve(userRoot, "package.json");
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        scripts?: Record<string, string>;
      };
      const deps = pkg.dependencies ?? {};
      const devDeps = pkg.devDependencies ?? {};
      delete deps.tangly;
      delete devDeps.tangly;
      const astroDeps = {
        astro: "^6",
        "@astrojs/mdx": "^5",
        "@tailwindcss/vite": "^4",
        tailwindcss: "^4",
        "remark-gfm": "^4",
        "rehype-shiki": "^0.0.9",
        "rehype-slug": "^6",
        "rehype-autolink-headings": "^7",
        "rehype-katex": "^7",
        "remark-math": "^6",
      };
      pkg.dependencies = { ...deps, ...astroDeps };
      pkg.devDependencies = devDeps;
      pkg.scripts ??= {};
      pkg.scripts.dev = `astro dev --root ${args.out}`;
      pkg.scripts.build = `astro build --root ${args.out}`;
      pkg.scripts.preview = `astro preview --root ${args.out}`;
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
      console.log(pc.dim("  → package.json: tangly replaced with astro deps"));
    }

    outro(
      `${pc.green("✓")} Ejected to ${args.out}/. Run ${pc.cyan("bun install")} then ${pc.cyan("bun run dev")}.`,
    );
  },
});
