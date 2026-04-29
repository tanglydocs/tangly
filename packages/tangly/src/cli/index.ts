import { defineCommand, runMain } from "citty";
import { VERSION } from "../index.js";
import { addCommand } from "./commands/add.js";
import { buildCommand } from "./commands/build.js";
import { checkCommand } from "./commands/check.js";
import { devCommand } from "./commands/dev.js";
import { ejectCommand } from "./commands/eject.js";
import { initCommand } from "./commands/init.js";
import { migrateCommand } from "./commands/migrate.js";
import { previewCommand } from "./commands/preview.js";

const main = defineCommand({
  meta: {
    name: "tangly",
    version: VERSION,
    description: "Self-hosted, open-source docs framework.",
  },
  subCommands: {
    dev: devCommand,
    build: buildCommand,
    preview: previewCommand,
    init: initCommand,
    check: checkCommand,
    add: addCommand,
    migrate: migrateCommand,
    eject: ejectCommand,
  },
});

export function run(_argv: string[]): void {
  runMain(main);
}
