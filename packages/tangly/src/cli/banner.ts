import pc from "picocolors";

export interface BannerOptions {
  version: string;
  projectName: string;
  pageCount: number;
  themeName: string;
  localUrl: string;
  networkUrl?: string;
}

export function printBanner(opts: BannerOptions): void {
  const lines = [
    `  ${pc.cyan("▲")} ${pc.bold("tangly")}  ${pc.dim(`v${opts.version}`)}`,
    `  ${pc.dim("┃")} ${opts.projectName} · ${opts.pageCount} pages · theme: ${opts.themeName}`,
    `  ${pc.dim("┃")}`,
    `  ${pc.dim("┃")} ${pc.bold("Local:")}    ${pc.cyan(opts.localUrl)}`,
  ];
  if (opts.networkUrl) {
    lines.push(`  ${pc.dim("┃")} ${pc.bold("Network:")}  ${pc.cyan(opts.networkUrl)}`);
  }
  lines.push(
    `  ${pc.dim("┃")}`,
    `  ${pc.dim("┃")} ${pc.dim("Press h to show help, q to quit, r to restart")}`,
    "",
  );
  console.log(lines.join("\n"));
}
