import { describe, expect, test } from "vitest";
import { expandOpenApiSpec } from "./expand-spec.js";

describe("expandOpenApiSpec — extensions", () => {
  test("parses x-codeSamples", () => {
    const spec = {
      paths: {
        "/users": {
          get: {
            summary: "List users",
            "x-codeSamples": [
              { lang: "typescript", source: "await api.users.list()" },
              { lang: "python", label: "Python (sync)", source: "api.users.list()" },
              { lang: "no-source" },
              "garbage",
            ],
          },
        },
      },
    };
    const out = expandOpenApiSpec(spec);
    expect(out.operations[0].op.codeSamples).toEqual([
      { lang: "typescript", source: "await api.users.list()" },
      { lang: "python", label: "Python (sync)", source: "api.users.list()" },
    ]);
  });

  test("alias x-code-samples is accepted", () => {
    const spec = {
      paths: {
        "/u": {
          get: { "x-code-samples": [{ lang: "go", source: "// go" }] },
        },
      },
    };
    const out = expandOpenApiSpec(spec);
    expect(out.operations[0].op.codeSamples).toEqual([{ lang: "go", source: "// go" }]);
  });

  test("x-hidden marks operation hidden, x-excluded marks excluded", () => {
    const spec = {
      paths: {
        "/a": { get: { "x-hidden": true } },
        "/b": { get: { "x-excluded": true } },
        "/c": { get: {} },
      },
    };
    const out = expandOpenApiSpec(spec);
    const byPath = Object.fromEntries(out.operations.map((o) => [o.op.path, o.op]));
    expect(byPath["/a"].hidden).toBe(true);
    expect(byPath["/b"].excluded).toBe(true);
    expect(byPath["/c"].hidden).toBeUndefined();
    expect(byPath["/c"].excluded).toBeUndefined();
  });

  test("collects securitySchemes referenced by operation.security", () => {
    const spec = {
      paths: {
        "/me": {
          get: { security: [{ HTTPBearer: [] }, { ApiKey: [] }] },
        },
      },
    };
    const out = expandOpenApiSpec(spec);
    expect(out.operations[0].op.security).toEqual(["HTTPBearer", "ApiKey"]);
  });
});
