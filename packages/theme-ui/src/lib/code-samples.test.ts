import { describe, expect, test } from "vitest";
import {
  generateCurl,
  generatePython,
  generateSample,
  generateTypeScript,
} from "./code-samples.js";

const baseInputs = {
  method: "get",
  path: "/v4/data/network/{network_code}",
  baseUrl: "https://api.openelectricity.org.au",
  parameters: [
    { name: "network_code", in: "path", required: true, example: "NEM" },
    { name: "metric", in: "query", required: true, schema: { type: "string" } },
    { name: "page", in: "query", required: false, schema: { type: "integer" } },
  ],
  auth: { method: "bearer" } as const,
  defaults: "required" as const,
};

describe("code-samples", () => {
  test("curl emits method, headers, and inlines required-only params by default", () => {
    const s = generateCurl(baseInputs);
    expect(s.source).toContain("curl --request GET");
    expect(s.source).toContain("https://api.openelectricity.org.au/v4/data/network/NEM");
    expect(s.source).toContain("metric=METRIC");
    expect(s.source).not.toContain("page=");
    expect(s.source).toContain("Authorization: Bearer YOUR_API_KEY");
  });

  test("typescript uses fetch() with inferred headers", () => {
    const s = generateTypeScript(baseInputs);
    expect(s.lang).toBe("typescript");
    expect(s.source).toMatch(/await fetch\(/);
    expect(s.source).toContain('"Authorization": "Bearer YOUR_API_KEY"');
  });

  test("python uses requests with explicit params + headers", () => {
    const s = generatePython(baseInputs);
    expect(s.source).toContain("import requests");
    expect(s.source).toContain("requests.get");
    expect(s.source).toContain('"metric": "METRIC"');
    expect(s.source).toContain('"Authorization": "Bearer YOUR_API_KEY"');
  });

  test("defaults: 'all' includes optional params", () => {
    const s = generateCurl({ ...baseInputs, defaults: "all" });
    expect(s.source).toContain("page=0");
  });

  test("generateSample dispatches alias languages (ts, py)", () => {
    const ts = generateSample("ts", baseInputs);
    expect(ts.lang).toBe("typescript");
    const py = generateSample("py", baseInputs);
    expect(py.lang).toBe("python");
  });

  test("unknown language falls back to curl", () => {
    const s = generateSample("kotlin", baseInputs);
    expect(s.lang).toBe("curl");
  });
});
