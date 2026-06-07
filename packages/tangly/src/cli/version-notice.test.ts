import { describe, expect, it } from "vitest";
import { isNewer } from "./version-notice.js";

describe("isNewer", () => {
  it("detects newer patch / minor / major", () => {
    expect(isNewer("0.1.6", "0.1.5")).toBe(true);
    expect(isNewer("0.2.0", "0.1.9")).toBe(true);
    expect(isNewer("1.0.0", "0.9.9")).toBe(true);
  });

  it("returns false for equal or older", () => {
    expect(isNewer("0.1.5", "0.1.5")).toBe(false);
    expect(isNewer("0.1.4", "0.1.5")).toBe(false);
    expect(isNewer("0.0.9", "0.1.0")).toBe(false);
  });

  it("ignores prerelease suffixes on either side", () => {
    expect(isNewer("0.1.6-rc.1", "0.1.5")).toBe(true);
    // same base version, one a prerelease → not treated as newer
    expect(isNewer("0.1.5-rc.1", "0.1.5")).toBe(false);
    expect(isNewer("0.1.5", "0.1.5-rc.1")).toBe(false);
  });

  it("treats missing segments as zero", () => {
    expect(isNewer("1", "0.9.9")).toBe(true);
    expect(isNewer("0.1", "0.1.0")).toBe(false);
  });

  it("never throws on garbage; non-numeric latest → false", () => {
    expect(isNewer("latest", "0.1.5")).toBe(false);
    expect(isNewer("not-a-version", "0.1.5")).toBe(false);
  });
});
