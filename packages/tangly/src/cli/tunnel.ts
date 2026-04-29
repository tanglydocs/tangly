import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Resolve a path to a usable cloudflared binary.
 *
 * 1. `cloudflared` on $PATH (Homebrew/system install).
 * 2. Cached at `~/.tangly/bin/cloudflared`.
 * 3. Otherwise return null — caller prompts the user to install.
 */
export function findCloudflaredBin(): string | null {
  try {
    const probe = spawnSync("cloudflared", ["--version"], {
      timeout: 3000,
      stdio: "ignore",
    });
    if (probe.status === 0) return "cloudflared";
  } catch {
    /* fall through */
  }
  const cached = join(homedir(), ".tangly", "bin", "cloudflared");
  if (existsSync(cached)) return cached;
  return null;
}

/**
 * Spawn cloudflared in quick-tunnel mode pointing at our dev server URL.
 * Returns the child process and a Promise resolving to the public URL.
 */
export function startCloudflaredTunnel(opts: { bin: string; localUrl: string }): {
  child: ReturnType<typeof spawn>;
  url: Promise<string>;
} {
  const child = spawn(opts.bin, ["tunnel", "--url", opts.localUrl], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let resolveUrl: (url: string) => void = () => {};
  const url = new Promise<string>((r) => {
    resolveUrl = r;
  });

  const URL_RE = /https?:\/\/[a-z0-9-]+\.trycloudflare\.com/i;
  const onChunk = (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    const match = URL_RE.exec(text);
    if (match) resolveUrl(match[0]);
  };

  child.stdout?.on("data", onChunk);
  child.stderr?.on("data", onChunk);

  return { child, url };
}
