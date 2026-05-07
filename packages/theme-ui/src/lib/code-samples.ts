/**
 * Generate language-specific code samples from an OpenAPI operation.
 *
 * The orchestrator (EndpointPanel) builds these for the configured
 * `api.codeSamples.languages` list, then the client-side hoist swaps
 * any tab the page overrides via <RequestExample>.
 *
 * Generators are deliberately simple: produce idiomatic-but-readable
 * snippets. Don't try to reproduce every SDK convention; users who need
 * that author their own example via <RequestExample>.
 */

export type AuthMethod = "bearer" | "basic" | "key" | "none";

export interface SampleParam {
  name: string;
  in?: string;
  required?: boolean;
  example?: unknown;
  schema?: { type?: string; example?: unknown };
}

export interface SampleInputs {
  method: string;
  path: string;
  baseUrl: string;
  parameters?: SampleParam[];
  requestBody?: {
    content?: Record<string, { example?: unknown; schema?: unknown }>;
  };
  auth?: { method: AuthMethod; name?: string };
  prefill?: boolean;
  defaults?: "required" | "all";
}

export interface Sample {
  lang: string;
  label: string;
  source: string;
}

export type SampleGenerator = (i: SampleInputs) => Sample;

const GENERATORS: Record<string, SampleGenerator> = {
  curl: generateCurl,
  bash: generateCurl,
  shell: generateCurl,
  typescript: generateTypeScript,
  ts: generateTypeScript,
  javascript: generateTypeScript,
  js: generateTypeScript,
  python: generatePython,
  py: generatePython,
  go: generateGo,
};

export function generateSample(lang: string, i: SampleInputs): Sample {
  const gen = GENERATORS[lang.toLowerCase()] ?? generateCurl;
  return gen(i);
}

export function knownLanguage(lang: string): boolean {
  return Object.hasOwn(GENERATORS, lang.toLowerCase());
}

// ---------------------------------------------------------------------------
// helpers

function buildUrl(i: SampleInputs): { url: string; query: Array<[string, string]> } {
  let path = i.path;
  const query: Array<[string, string]> = [];
  for (const p of selectParams(i)) {
    const value = stringifyExample(p);
    if (p.in === "path") {
      path = path.replace(`{${p.name}}`, encodeURIComponent(value));
    } else if (p.in === "query") {
      query.push([p.name, value]);
    }
  }
  const base = (i.baseUrl ?? "").replace(/\/+$/, "");
  return { url: `${base}${path}`, query };
}

function selectParams(i: SampleInputs): SampleParam[] {
  const all = i.parameters ?? [];
  if (i.defaults === "all") return all;
  return all.filter((p) => p.required);
}

function stringifyExample(p: SampleParam): string {
  if (p.example !== undefined) return String(p.example);
  if (p.schema?.example !== undefined) return String(p.schema.example);
  // Fallback: a typed placeholder so the snippet compiles in spirit.
  switch (p.schema?.type) {
    case "integer":
    case "number":
      return "0";
    case "boolean":
      return "true";
    default:
      return p.name.toUpperCase();
  }
}

function bodyExample(i: SampleInputs): unknown | undefined {
  const content = i.requestBody?.content;
  if (!content) return undefined;
  const json = content["application/json"];
  if (!json) return undefined;
  if (json.example !== undefined) return json.example;
  return undefined;
}

function authHeader(auth?: SampleInputs["auth"]): { name: string; value: string } | undefined {
  if (!auth || auth.method === "none") return undefined;
  switch (auth.method) {
    case "bearer":
      return { name: "Authorization", value: "Bearer YOUR_API_KEY" };
    case "basic":
      return { name: "Authorization", value: "Basic <base64(user:pass)>" };
    case "key":
      return { name: auth.name ?? "X-API-Key", value: "YOUR_API_KEY" };
  }
}

// ---------------------------------------------------------------------------
// generators

export function generateCurl(i: SampleInputs): Sample {
  const { url, query } = buildUrl(i);
  const qs = query.length
    ? "?" + query.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")
    : "";
  const lines: string[] = [`curl --request ${i.method.toUpperCase()} \\`, `  --url "${url}${qs}"`];
  const ah = authHeader(i.auth);
  if (ah) lines.push(`  --header "${ah.name}: ${ah.value}"`);
  const body = bodyExample(i);
  if (body !== undefined) {
    lines.push(`  --header "Content-Type: application/json"`);
    lines.push(`  --data '${JSON.stringify(body)}'`);
  }
  // Append continuation backslashes to all but last
  const joined = lines
    .map((l, idx) => (idx < lines.length - 1 && !l.endsWith("\\") ? `${l} \\` : l))
    .join("\n");
  return { lang: "curl", label: "cURL", source: joined };
}

export function generateTypeScript(i: SampleInputs): Sample {
  const { url, query } = buildUrl(i);
  const qs = query.length
    ? `?${query.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`
    : "";
  const ah = authHeader(i.auth);
  const body = bodyExample(i);
  const headers: Record<string, string> = {};
  if (ah) headers[ah.name] = ah.value;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const init: string[] = [`  method: "${i.method.toUpperCase()}"`];
  if (Object.keys(headers).length > 0) {
    init.push(`  headers: ${JSON.stringify(headers, null, 2).replace(/\n/g, "\n  ")}`);
  }
  if (body !== undefined) init.push(`  body: JSON.stringify(${JSON.stringify(body)})`);

  const src = [
    `const res = await fetch("${url}${qs}", {`,
    init.join(",\n") + ",",
    `});`,
    `const data = await res.json();`,
  ].join("\n");
  return { lang: "typescript", label: "TypeScript", source: src };
}

export function generatePython(i: SampleInputs): Sample {
  const { url, query } = buildUrl(i);
  const ah = authHeader(i.auth);
  const body = bodyExample(i);
  const headers: Record<string, string> = {};
  if (ah) headers[ah.name] = ah.value;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const lines: string[] = [`import requests`, ``];
  if (query.length) {
    lines.push(`params = {`);
    for (const [k, v] of query) lines.push(`    "${k}": "${v}",`);
    lines.push(`}`);
  }
  if (Object.keys(headers).length > 0) {
    lines.push(`headers = {`);
    for (const [k, v] of Object.entries(headers)) lines.push(`    "${k}": "${v}",`);
    lines.push(`}`);
  }
  if (body !== undefined) {
    lines.push(`payload = ${JSON.stringify(body)}`);
  }
  const args: string[] = [`"${url}"`];
  if (query.length) args.push(`params=params`);
  if (Object.keys(headers).length > 0) args.push(`headers=headers`);
  if (body !== undefined) args.push(`json=payload`);
  lines.push(``, `r = requests.${i.method.toLowerCase()}(${args.join(", ")})`);
  lines.push(`r.raise_for_status()`);
  lines.push(`data = r.json()`);
  return { lang: "python", label: "Python", source: lines.join("\n") };
}

export function generateGo(i: SampleInputs): Sample {
  const { url, query } = buildUrl(i);
  const qs = query.length ? `?${query.map(([k, v]) => `${k}=${v}`).join("&")}` : "";
  const ah = authHeader(i.auth);
  const body = bodyExample(i);

  const lines: string[] = [
    `package main`,
    ``,
    `import (`,
    `    "fmt"`,
    `    "io"`,
    `    "net/http"`,
  ];
  if (body !== undefined) lines.push(`    "strings"`);
  lines.push(`)`, ``, `func main() {`);
  if (body !== undefined) {
    lines.push(`    body := strings.NewReader(\`${JSON.stringify(body)}\`)`);
    lines.push(`    req, _ := http.NewRequest("${i.method.toUpperCase()}", "${url}${qs}", body)`);
  } else {
    lines.push(`    req, _ := http.NewRequest("${i.method.toUpperCase()}", "${url}${qs}", nil)`);
  }
  if (ah) lines.push(`    req.Header.Set("${ah.name}", "${ah.value}")`);
  if (body !== undefined) lines.push(`    req.Header.Set("Content-Type", "application/json")`);
  lines.push(
    `    resp, _ := http.DefaultClient.Do(req)`,
    `    defer resp.Body.Close()`,
    `    out, _ := io.ReadAll(resp.Body)`,
    `    fmt.Println(string(out))`,
    `}`,
  );
  return { lang: "go", label: "Go", source: lines.join("\n") };
}
