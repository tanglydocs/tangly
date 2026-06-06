/**
 * Humanize an ISO timestamp into "3 days ago" style relative text.
 * Isomorphic: runs at build (frontmatter) and in the browser (live refresh),
 * so it must not import any node-only APIs.
 */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const sec = Math.max(0, Math.floor((now - then) / 1000));
  const day = Math.floor(sec / 86400);

  if (day >= 365) {
    const y = Math.floor(day / 365);
    return `${y} year${y === 1 ? "" : "s"} ago`;
  }
  if (day >= 30) {
    const mo = Math.floor(day / 30);
    return `${mo} month${mo === 1 ? "" : "s"} ago`;
  }
  if (day >= 1) return `${day} day${day === 1 ? "" : "s"} ago`;

  const hr = Math.floor(sec / 3600);
  if (hr >= 1) return `${hr} hour${hr === 1 ? "" : "s"} ago`;

  const min = Math.floor(sec / 60);
  if (min >= 1) return `${min} minute${min === 1 ? "" : "s"} ago`;

  return "just now";
}

/** Compact star count: 1234 -> "1.2k", 980 -> "980". */
export function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}
