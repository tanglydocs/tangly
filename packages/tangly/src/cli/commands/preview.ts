import { resolve } from "node:path";
import { defineCommand } from "citty";
import { loadDotenv } from "../load-env.js";
import { getRuntimeDir } from "../runtime-paths.js";

export const previewCommand = defineCommand({
  meta: {
    name: "preview",
    description: "Serve the built dist/ locally",
  },
  args: {
    port: {
      type: "string",
      description: "Port (default 4321)",
      default: "4321",
    },
    out: {
      type: "string",
      description: "Output directory (default ./dist)",
      default: "./dist",
    },
    root: {
      type: "string",
      description: "Project root (default cwd)",
      default: ".",
    },
  },
  async run({ args }) {
    const userRoot = resolve(args.root);
    const outDir = resolve(userRoot, args.out);
    const port = Number(args.port);

    loadDotenv(userRoot);

    process.env.TANGLY_USER_ROOT = userRoot;
    const runtimeDir = getRuntimeDir();

    const { preview } = (await import("astro")) as typeof import("astro");
    await preview({
      root: runtimeDir,
      outDir,
      server: { port },
    } as never);
  },
});
