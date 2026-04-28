import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { intro, isCancel, outro, select, text } from "@clack/prompts";
import { defineCommand } from "citty";
import pc from "picocolors";

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description: "Scaffold a new Tangly project",
  },
  args: {
    dir: {
      type: "positional",
      description: "Target directory (default current)",
      required: false,
      default: ".",
    },
  },
  async run({ args }) {
    intro(pc.bgCyan(pc.black(" Tangly ")));

    const dir = resolve(args.dir);
    if (existsSync(resolve(dir, "docs.json"))) {
      console.error(pc.red(`✗ docs.json already exists at ${dir}`));
      process.exit(1);
    }

    const name = await text({
      message: "Project name?",
      placeholder: "My Docs",
      validate: (v) => (v && v.length > 0 ? undefined : "Required"),
    });
    if (isCancel(name)) process.exit(1);

    const template = await select({
      message: "Template",
      options: [
        { value: "basic", label: "Basic (hello world)" },
        { value: "api", label: "API (with OpenAPI)" },
      ],
    });
    if (isCancel(template)) process.exit(1);

    mkdirSync(dir, { recursive: true });

    const config = {
      $schema: "https://tanglydocs.com/schema/docs.json",
      name,
      theme: "tang",
      colors: { primary: "#0ea5e9" },
      navigation: {
        groups: [{ group: "Get Started", pages: ["introduction"] }],
      },
    };
    writeFileSync(resolve(dir, "docs.json"), JSON.stringify(config, null, 2), "utf8");

    writeFileSync(
      resolve(dir, "introduction.mdx"),
      [
        "---",
        "title: Introduction",
        `description: Welcome to ${name}`,
        "---",
        "",
        `# ${name}`,
        "",
        "Welcome to your new Tangly docs site.",
        "",
        "<Note>",
        "  Edit `introduction.mdx` to get started.",
        "</Note>",
        "",
      ].join("\n"),
      "utf8",
    );

    outro(`${pc.green("✓")} Project scaffolded at ${pc.cyan(dir)}`);
    console.log(pc.dim(`Run \`tangly dev\` from ${dir} to start.`));
  },
});
