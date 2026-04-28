import { defineCommand, runMain } from "citty";
import { VERSION } from "../index.js";
import { buildCommand } from "./commands/build.js";
import { checkCommand } from "./commands/check.js";
import { devCommand } from "./commands/dev.js";
import { initCommand } from "./commands/init.js";
import { previewCommand } from "./commands/preview.js";

const main = defineCommand({
  meta: {
    name: "tangly",
    version: VERSION,
    description: "Self-hosted, OSS docs framework. Renders Mintlify projects unmodified.",
  },
  subCommands: {
    dev: devCommand,
    build: buildCommand,
    preview: previewCommand,
    init: initCommand,
    check: checkCommand,
  },
});

export function run(_argv: string[]): void {
  runMain(main);
}
