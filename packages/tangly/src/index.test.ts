import { expect, test } from "vitest";
import { VERSION } from "./index.js";

test("VERSION is exposed", () => {
  expect(VERSION).toBe("0.0.1");
});
