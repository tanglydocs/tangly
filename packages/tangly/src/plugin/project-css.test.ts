import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  discoverProjectCss,
  injectProjectCssImport,
  partitionTailwindEntries,
  PROJECT_CSS_ID,
  projectCssModule,
} from "./project-css.js";

let root: string;
const touch = (rel: string) => {
  const full = join(root, rel);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, "/* x */");
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "tangly-project-css-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("discoverProjectCss", () => {
  test("finds root and nested css in sorted path order", () => {
    for (const f of ["z.css", "custom.css", "styles/b.css", "styles/a.css", "global.css"]) touch(f);
    const rels = discoverProjectCss(root).map((f) => f.slice(resolve(root).length + 1));
    expect(rels).toEqual(["custom.css", "global.css", "styles/a.css", "styles/b.css", "z.css"]);
  });

  test("skips build output, deps, dot dirs, static asset dirs and the theme override", () => {
    touch("keep.css");
    for (const f of [
      "node_modules/x/a.css",
      "dist/a.css",
      ".tangly/a.css",
      ".astro/a.css",
      "public/a.css",
      "static/a.css",
      "assets/a.css",
      "images/a.css",
      "logo/a.css",
      "theme/styles/theme.css",
      "sub/node_modules/a.css",
      "notcss.txt",
    ])
      touch(f);
    const rels = discoverProjectCss(root).map((f) => f.slice(resolve(root).length + 1));
    expect(rels).toEqual(["keep.css"]);
  });

  test("keeps nested dirs named like static dirs and other theme css", () => {
    touch("guides/assets/a.css");
    touch("theme/styles/extra.css");
    const rels = discoverProjectCss(root).map((f) => f.slice(resolve(root).length + 1));
    expect(rels).toEqual(["guides/assets/a.css", "theme/styles/extra.css"]);
  });

  test("missing root yields nothing", () => {
    expect(discoverProjectCss(join(root, "nope"))).toEqual([]);
  });
});

describe("projectCssModule / injectProjectCssImport", () => {
  test("emits one @import per file in order", () => {
    expect(projectCssModule(["/a/b.css", "/a/c.css"])).toBe(
      '@import "/a/b.css";\n@import "/a/c.css";\n',
    );
  });

  test("appends the import to shells that import the theme css, once", () => {
    const shell = 'import "@tanglydocs/theme/theme.css";\nimport "./prose.css";\n';
    const out = injectProjectCssImport(shell);
    expect(out.endsWith(`import "${PROJECT_CSS_ID}";\n`)).toBe(true);
    expect(injectProjectCssImport(out)).toBe(out);
  });

  test("leaves other modules alone", () => {
    const other = 'import "./x.css";\n';
    expect(injectProjectCssImport(other)).toBe(other);
  });
});

describe("partitionTailwindEntries", () => {
  test("skips files that import tailwindcss themselves", () => {
    writeFileSync(join(root, "a.css"), '@import "tailwindcss";\n.x{}');
    writeFileSync(join(root, "b.css"), ".y{}");
    const { ok, skipped } = partitionTailwindEntries([join(root, "a.css"), join(root, "b.css")]);
    expect(skipped).toEqual([join(root, "a.css")]);
    expect(ok).toEqual([join(root, "b.css")]);
  });
});
