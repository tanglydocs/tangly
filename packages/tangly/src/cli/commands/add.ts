import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineCommand } from "citty";
import pc from "picocolors";

type Kind = "page" | "snippet" | "changelog";

export const addCommand = defineCommand({
  meta: {
    name: "add",
    description: "Scaffold a new page, snippet, or changelog entry",
  },
  args: {
    type: {
      type: "positional",
      description: "What to add: page | snippet | changelog",
      required: true,
    },
    path: {
      type: "positional",
      description: "Slug or filename (e.g. guides/billing, shared/disclaimer)",
      required: true,
    },
    template: {
      type: "string",
      description: "Use a template from ./templates/",
    },
    "no-nav": {
      type: "boolean",
      description: "Don't auto-insert into docs.json navigation",
      default: false,
    },
    root: {
      type: "string",
      description: "Project root (default cwd)",
      default: ".",
    },
  },
  async run({ args }) {
    const kind = args.type as Kind;
    const userRoot = resolve(args.root);

    if (!["page", "snippet", "changelog"].includes(kind)) {
      console.error(pc.red(`✗ Unknown type "${kind}". Use page | snippet | changelog.`));
      process.exit(1);
    }

    const slug = String(args.path).replace(/\.mdx?$/, "");

    let target: string;
    let body: string;
    if (kind === "page") {
      target = resolve(userRoot, `${slug}.mdx`);
      body = pageTemplate(slug, args.template);
    } else if (kind === "snippet") {
      target = resolve(userRoot, "snippets", `${slug}.mdx`);
      body = snippetTemplate(slug);
    } else {
      // changelog: write under changelog/<slug>.mdx and ensure nav inclusion
      target = resolve(userRoot, "changelog", `${slug}.mdx`);
      body = changelogTemplate(slug);
    }

    if (existsSync(target)) {
      console.error(pc.red(`✗ ${target} already exists`));
      process.exit(1);
    }

    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, body, "utf8");
    console.log(pc.green(`✓ Wrote ${target.replace(userRoot + "/", "")}`));

    if (kind !== "snippet" && !args["no-nav"]) {
      const inserted = tryInsertIntoNav(userRoot, kind === "page" ? slug : `changelog/${slug}`);
      if (inserted) {
        console.log(pc.dim("  → docs.json: added to navigation"));
      } else {
        console.log(pc.dim("  → docs.json: could not auto-insert (add manually under a group)"));
      }
    }
  },
});

function pageTemplate(slug: string, _template?: string): string {
  const title = humanize(slug.split("/").pop() ?? slug);
  return [
    "---",
    `title: ${title}`,
    `description: ${title}`,
    "---",
    "",
    `# ${title}`,
    "",
    "Body content goes here.",
    "",
  ].join("\n");
}

function snippetTemplate(slug: string): string {
  const title = humanize(slug.split("/").pop() ?? slug);
  return [
    `{/* Snippet: ${title} */}`,
    "",
    'Reusable content. Import via `<Snippet file="path/to/me" />`.',
    "",
  ].join("\n");
}

function changelogTemplate(slug: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const version = slug.match(/(\d+\.\d+\.\d+)/)?.[1] ?? "0.0.0";
  return [
    "---",
    `title: ${version}`,
    `description: ${date}`,
    "---",
    "",
    `<Update label="${version}" description="${date}" tags={[]}>`,
    "",
    "## Changes",
    "",
    "- ...",
    "",
    "</Update>",
    "",
  ].join("\n");
}

function humanize(s: string): string {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function tryInsertIntoNav(userRoot: string, slug: string): boolean {
  const path = resolve(userRoot, "docs.json");
  if (!existsSync(path)) return false;
  try {
    const raw = readFileSync(path, "utf8");
    const cfg = JSON.parse(raw) as {
      navigation?: { groups?: Array<{ pages: unknown[] }>; pages?: unknown[] };
    };
    const nav = cfg.navigation;
    if (!nav) return false;
    if (Array.isArray(nav.groups) && nav.groups.length > 0) {
      // Insert into the last group.
      const lastGroup = nav.groups[nav.groups.length - 1]!;
      lastGroup.pages.push(slug);
    } else if (Array.isArray(nav.pages)) {
      nav.pages.push(slug);
    } else {
      return false;
    }
    writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n", "utf8");
    return true;
  } catch {
    return false;
  }
}
