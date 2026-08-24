// The one list of publishable packages, in TOPOLOGICAL order (deps before
// dependents) — also the npm publish order.
//
// It lives on its own because three scripts need it and a copy that drifts
// fails late and confusingly: the release planner silently omits a package
// (publishing `tangly` against a version that was never pushed), and the
// tarball smokes fail inside `bun pack` with "Failed to resolve workspace
// version". Adding a publishable package means editing this file only.
//
// Private packages (website, template-starter) are deliberately absent: never
// scanned, never published, never cascaded into core.
export interface PkgDef {
  key: string;
  dir: string;
  name: string;
}

export const PUBLISHABLE: readonly PkgDef[] = [
  { key: "schema", dir: "packages/schema", name: "@tanglydocs/schema" },
  { key: "theme-ui", dir: "packages/theme-ui", name: "@tanglydocs/theme-ui" },
  { key: "theme-tang", dir: "packages/theme-tang", name: "@tanglydocs/theme-tang" },
  { key: "theme-pith", dir: "packages/theme-pith", name: "@tanglydocs/theme-pith" },
  { key: "theme-pip", dir: "packages/theme-pip", name: "@tanglydocs/theme-pip" },
  { key: "theme-readable", dir: "packages/theme-readable", name: "@tanglydocs/theme-readable" },
  { key: "theme-geist", dir: "packages/theme-geist", name: "@tanglydocs/theme-geist" },
  { key: "theme-cirrus", dir: "packages/theme-cirrus", name: "@tanglydocs/theme-cirrus" },
  { key: "tangly", dir: "packages/tangly", name: "tangly" },
];

/** Workspace directories, for the scripts that only care about paths. */
export const PUBLISHABLE_DIRS: readonly string[] = PUBLISHABLE.map((p) => p.dir);
