import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import matter from "gray-matter";

export interface InitFromDirOptions {
  src: string;
  existingConfig?: Record<string, unknown> | undefined;
}

interface ScannedPage {
  slug: string;
  title: string;
  group: string;
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "_site", ".vercel", ".next"]);

export interface ScaffoldedConfig {
  $schema: string;
  name: string;
  theme: string;
  colors: { primary: string };
  navigation: { groups: { group: string; pages: string[] }[] };
}

export function scaffoldFromDir(opts: InitFromDirOptions): {
  config: ScaffoldedConfig;
  summary: { pages: number; groups: number };
} {
  const pages: ScannedPage[] = [];
  walk(opts.src, opts.src, pages);

  const groupOrder: string[] = [];
  const groupMap = new Map<string, string[]>();
  for (const p of pages) {
    const groupName = p.group || "Introduction";
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, []);
      groupOrder.push(groupName);
    }
    groupMap.get(groupName)!.push(p.slug);
  }

  const introIdx = groupOrder.indexOf("Introduction");
  if (introIdx > 0) {
    groupOrder.splice(introIdx, 1);
    groupOrder.unshift("Introduction");
  }

  const groups = groupOrder.map((g) => ({
    group: g,
    pages: dedupePreserveOrder(groupMap.get(g) ?? []),
  }));

  const baseConfig: ScaffoldedConfig = {
    $schema: "https://tanglydocs.com/schema/docs.json",
    name: deriveName(opts.src),
    theme: "tang",
    colors: { primary: "#0ea5e9" },
    navigation: { groups },
  };

  if (opts.existingConfig) {
    return {
      config: mergeConfigs(opts.existingConfig, baseConfig),
      summary: { pages: pages.length, groups: groups.length },
    };
  }

  return {
    config: baseConfig,
    summary: { pages: pages.length, groups: groups.length },
  };
}

function walk(root: string, dir: string, out: ScannedPage[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name.startsWith(".")) continue;
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      walk(root, full, out);
      continue;
    }
    if (!stats.isFile()) continue;
    if (!/\.(md|mdx)$/i.test(name)) continue;

    const rel = relative(root, full).split(sep).join("/");
    const slug = rel.replace(/\.(md|mdx)$/i, "");
    const isReadme = /^readme$/i.test(slug.split("/").pop() ?? "");
    const folder = slug.includes("/") ? slug.split("/")[0]! : "";

    const title = readPageTitle(full) ?? humanize(name.replace(/\.(md|mdx)$/i, ""));

    out.push({
      slug: isReadme && folder === "" ? "introduction" : slug,
      title: isReadme && folder === "" ? "Introduction" : title,
      group: humanize(folder),
    });
  }
}

function readPageTitle(file: string): string | null {
  try {
    const raw = readFileSync(file, "utf8");
    const parsed = matter(raw);
    if (typeof parsed.data?.title === "string") return parsed.data.title;
    const m = /^#\s+(.+?)\s*$/m.exec(parsed.content);
    if (m?.[1]) return m[1];
  } catch {
    /* swallow */
  }
  return null;
}

function humanize(s: string): string {
  if (!s) return "";
  return s
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function deriveName(dir: string): string {
  const base = dir.split(sep).filter(Boolean).pop() ?? "Docs";
  return humanize(base);
}

function dedupePreserveOrder(slugs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of slugs) {
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/**
 * Merge new groups into existing config. PRESERVES the existing navigation
 * shape — tabs, pages, anchors, dropdowns, versions, languages, OpenAPI,
 * templates, and metadata are all kept verbatim. New groups are only
 * appended into a top-level `navigation.groups` list (creating it if
 * absent), and existing groups gain any newly-seen pages at the end.
 *
 * This intentionally never touches tabbed navigation: if the user already
 * has tabs/pages/anchors, we just leave them alone and append our new
 * groups under the root.
 */
function mergeConfigs(
  existing: Record<string, unknown>,
  fresh: ScaffoldedConfig,
): ScaffoldedConfig {
  const cloned = JSON.parse(JSON.stringify(existing)) as Record<string, unknown>;
  const navigation =
    (cloned.navigation as Record<string, unknown> | undefined) ?? {};
  cloned.navigation = navigation;

  const existingGroups = Array.isArray(navigation.groups)
    ? (navigation.groups as { group: string; pages: string[] }[])
    : [];
  const freshGroups = fresh.navigation?.groups ?? [];

  const merged: { group: string; pages: string[] }[] = [];
  const seenGroupNames = new Set<string>();

  for (const eg of existingGroups) {
    seenGroupNames.add(eg.group);
    const fg = freshGroups.find((g) => g.group === eg.group);
    if (!fg) {
      merged.push(eg);
      continue;
    }
    const existingPages = new Set(
      eg.pages.filter((p): p is string => typeof p === "string"),
    );
    const additions = fg.pages.filter((p) => !existingPages.has(p));
    merged.push({
      group: eg.group,
      pages: [...eg.pages, ...additions],
    });
  }
  for (const fg of freshGroups) {
    if (seenGroupNames.has(fg.group)) continue;
    merged.push(fg);
  }

  navigation.groups = merged;
  return cloned as unknown as ScaffoldedConfig;
}

export function readExistingConfig(target: string): Record<string, unknown> | undefined {
  const path = join(target, "docs.json");
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
