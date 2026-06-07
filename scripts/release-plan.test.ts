import { describe, expect, it } from "vitest";
import {
  bumpVersion,
  compareVersions,
  type PlanInputPkg,
  planFromInputs,
  reverseClosure,
} from "./release-plan.ts";

describe("bumpVersion", () => {
  it("patch / minor / major reset correctly", () => {
    expect(bumpVersion("0.1.6", "patch")).toBe("0.1.7");
    expect(bumpVersion("0.1.6", "minor")).toBe("0.2.0");
    expect(bumpVersion("0.1.6", "major")).toBe("1.0.0");
  });

  it("clears any prerelease on a normal bump", () => {
    expect(bumpVersion("0.1.6-rc.2", "patch")).toBe("0.1.7");
  });

  it("prerelease starts then increments the identifier", () => {
    expect(bumpVersion("0.1.6", "prerelease", "rc")).toBe("0.1.7-rc.0");
    expect(bumpVersion("0.1.7-rc.0", "prerelease", "rc")).toBe("0.1.7-rc.1");
    expect(bumpVersion("0.1.7-beta.0", "prerelease", "rc")).toBe("0.1.8-rc.0");
  });

  it("throws on garbage", () => {
    expect(() => bumpVersion("latest", "patch")).toThrow();
  });
});

describe("compareVersions", () => {
  it("orders core versions and ranks release above prerelease", () => {
    expect(compareVersions("0.1.7", "0.1.6")).toBeGreaterThan(0);
    expect(compareVersions("0.1.6", "0.2.0")).toBeLessThan(0);
    expect(compareVersions("0.1.6", "0.1.6")).toBe(0);
    expect(compareVersions("0.1.6", "0.1.6-rc.1")).toBeGreaterThan(0);
  });

  it("sorts a tag list to the highest release", () => {
    const v = ["0.1.6", "0.1.10", "0.1.7", "0.2.0-rc.0"].toSorted(compareVersions);
    expect(v[v.length - 1]).toBe("0.2.0-rc.0");
  });
});

describe("reverseClosure (algorithm)", () => {
  // a (root) <- b <- c (sink). Edges point dependency -> dependent direction
  // via the `dependsOn` lists below.
  const acyclic = { a: [], b: ["a"], c: ["b"] };

  it("a sink pulls in nothing else", () => {
    expect([...reverseClosure(["c"], acyclic)].toSorted()).toEqual(["c"]);
  });

  it("a root pulls in all transitive dependents", () => {
    expect([...reverseClosure(["a"], acyclic)].toSorted()).toEqual(["a", "b", "c"]);
  });

  it("terminates on a cycle and returns the whole cycle", () => {
    const cyclic = { x: ["y"], y: ["x"], z: ["y"] };
    expect([...reverseClosure(["x"], cyclic)].toSorted()).toEqual(["x", "y", "z"]);
  });
});

// Production-matching fixture INCLUDING the real theme-ui <-> tangly runtime
// cycle (theme-ui imports `resolveSite` from tangly/site). This documents the
// actual cascade behavior: patch is surgical; minor/major cascade broadly
// because the cycle ties theme-ui + every leaf theme + tangly together.
const PROD: Record<string, string[]> = {
  schema: [],
  "theme-ui": ["schema", "tangly"], // <-- runtime back-edge => cycle with tangly
  "theme-tang": ["theme-ui"],
  "theme-pith": ["theme-ui"],
  "theme-pip": ["theme-ui"],
  "theme-readable": ["theme-ui"],
  "theme-geist": ["theme-ui"],
  tangly: [
    "schema",
    "theme-ui",
    "theme-tang",
    "theme-pith",
    "theme-pip",
    "theme-readable",
    "theme-geist",
  ],
};
const ORDER = Object.keys(PROD);
const NON_SCHEMA = ORDER.filter((k) => k !== "schema").toSorted();

function inputs(changed: string[], version = "0.1.6"): PlanInputPkg[] {
  return ORDER.map((key) => ({
    key,
    dir: `packages/${key}`,
    name: key === "tangly" ? "tangly" : `@tanglydocs/${key}`,
    oldVersion: version,
    internalDeps: PROD[key]!,
    directlyChanged: changed.includes(key),
  }));
}

describe("planFromInputs (production graph)", () => {
  it("tangly-only patch publishes just tangly (core release)", () => {
    const plan = planFromInputs(inputs(["tangly"]), "patch", "rc");
    expect(plan.publish).toEqual(["tangly"]);
    expect(plan.packages.tangly!.newVersion).toBe("0.1.7");
    expect(plan.packages["theme-tang"]!.publish).toBe(false);
    expect(plan.packages["theme-tang"]!.effectiveVersion).toBe("0.1.6");
    expect(plan.corePublished).toBe(true);
    expect(plan.tag).toBe("v0.1.7");
    expect(plan.distTag).toBe("latest");
  });

  it("a theme PATCH ships solo — cycle is irrelevant for patch", () => {
    const plan = planFromInputs(inputs(["theme-tang"]), "patch", "rc");
    expect(plan.publish).toEqual(["theme-tang"]);
    expect(plan.corePublished).toBe(false);
    expect(plan.tag).toBeNull();
    expect(plan.packages.tangly!.publish).toBe(false);
    expect(plan.packages["theme-tang"]!.newVersion).toBe("0.1.7");
    expect(plan.tanglyVersion).toBe("0.1.6");
  });

  it("a theme MINOR cascades broadly through the cycle (all but schema)", () => {
    const plan = planFromInputs(inputs(["theme-tang"]), "minor", "rc");
    expect([...plan.publish].toSorted()).toEqual(NON_SCHEMA);
    expect(plan.publish).not.toContain("schema");
    expect(plan.packages["theme-tang"]!.newVersion).toBe("0.2.0"); // directly changed -> minor
    expect(plan.packages.tangly!.newVersion).toBe("0.1.7"); // pulled-in dependent -> patch
    expect(plan.packages["theme-ui"]!.newVersion).toBe("0.1.7"); // pulled in via cycle -> patch
    expect(plan.corePublished).toBe(true);
    expect(plan.publish[plan.publish.length - 1]).toBe("tangly"); // tangly published last (topo)
  });

  it("a schema MINOR cascades to the whole graph", () => {
    const plan = planFromInputs(inputs(["schema"]), "minor", "rc");
    expect(new Set(plan.publish)).toEqual(new Set(ORDER));
    expect(plan.packages.schema!.newVersion).toBe("0.2.0");
    expect(plan.packages["theme-ui"]!.newVersion).toBe("0.1.7");
    expect(plan.publish[0]).toBe("schema"); // schema first (topo)
    expect(plan.publish[plan.publish.length - 1]).toBe("tangly"); // tangly last
  });

  it("nothing changed -> empty no-op plan", () => {
    const plan = planFromInputs(inputs([]), "patch", "rc");
    expect(plan.publish).toEqual([]);
    expect(plan.anyPublish).toBe(false);
    expect(plan.corePublished).toBe(false);
    expect(plan.tag).toBeNull();
  });

  it("prerelease bump uses the prerelease dist-tag and does not cascade", () => {
    const plan = planFromInputs(inputs(["theme-tang"]), "prerelease", "rc");
    expect(plan.publish).toEqual(["theme-tang"]);
    expect(plan.distTag).toBe("rc");
    expect(plan.packages["theme-tang"]!.newVersion).toBe("0.1.7-rc.0");
  });
});
