/**
 * JSON-LD structured data for a single page.
 *
 * One `@graph` per page holding `Organization`, `WebSite`, `WebPage`,
 * `BreadcrumbList` and (for content pages) a `TechArticle`. The site-level
 * nodes carry stable `@id`s that are identical on every page and are
 * *referenced* — never redeclared — by the page-level nodes, so a crawler
 * building an entity map reconciles the whole site to one organization and one
 * website rather than one per URL.
 *
 * Pure and synchronous: every input (origin, dates, nav path) is resolved by
 * the caller, so this is unit-testable and runs once per page at render time
 * with no I/O. Lives in `@tanglydocs/schema` — the leaf both `tangly` and the
 * themes depend on — so the shared head fragment can build the graph without
 * importing `tangly` and cycling the package graph. Same rationale as
 * `resolve-site` and `page-path`.
 */

/** A node reference — `{ "@id": "..." }` pointing at a node in the same graph. */
export interface JsonLdRef {
  "@id": string;
}

export type JsonLdNode = Record<string, unknown> & { "@id": string; "@type": string };

export interface JsonLdGraph {
  "@context": "https://schema.org";
  "@graph": JsonLdNode[];
}

/** Publisher identity. All fields resolved (defaulted) by `resolveOrganization`. */
export interface ResolvedOrganization {
  name: string;
  /** Absolute URL of the organization's home. No trailing slash. */
  url: string;
  /** Absolute URL of the logo image, when one is resolvable. */
  logo?: string;
  sameAs?: string[];
}

/** Raw `seo.organization` from docs.json. */
export interface OrganizationConfig {
  name?: string;
  url?: string;
  logo?: string;
  sameAs?: string[];
}

export interface ResolveOrganizationInput {
  /** docs.json `name`. */
  siteName: string;
  /** Absolute site root (origin + base), no trailing slash. */
  siteRoot: string;
  /** docs.json `seo.organization`. */
  organization?: OrganizationConfig;
  /** docs.json root `sameAs`. */
  sameAs?: string[];
  /**
   * The site logo from docs.json, in order of preference: `logo.light` (or
   * the string form), then `logo.dark`. The first one that resolves to a
   * fetchable URL is used.
   */
  logo?: string | readonly string[];
  /** Absolutize a root-relative asset path against the deploy base + origin. */
  absolutize: (path: string) => string;
}

/**
 * Resolve the Organization node's fields from config, defaulting every one so
 * a project that adds no configuration at all still gets a correct node:
 * name → root `name`, url → the site root, logo → `logo.light` (else
 * `logo.dark`) made absolute, sameAs → root `sameAs`.
 *
 * The logo must be something a crawler can fetch. A `data:` URI is not — it
 * is an inline image, and absolutizing one produces a nonsense path under the
 * site root — so a data URI is skipped in favour of the next candidate, and
 * the logo is omitted when no candidate is a real file.
 */
export function resolveOrganization(input: ResolveOrganizationInput): ResolvedOrganization {
  const org = input.organization ?? {};
  const url = stripTrailingSlash(org.url ?? input.siteRoot);
  const siteLogos = typeof input.logo === "string" ? [input.logo] : (input.logo ?? []);
  const logo = [org.logo, ...siteLogos]
    .filter((candidate): candidate is string => isFetchableAsset(candidate))
    .map((candidate) => input.absolutize(candidate))
    .find((absolute) => /^https?:\/\//i.test(absolute));
  // `seo.organization.sameAs` overrides root `sameAs` outright rather than
  // merging — a project that scopes the organization to a different site
  // (a docs subdomain pointing at the marketing domain) needs to be able to
  // replace the profile list, not append to it.
  const sameAs = dedupe(org.sameAs ?? input.sameAs ?? []);
  return {
    name: org.name ?? input.siteName,
    url,
    ...(logo ? { logo } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

/** Per-page author, from frontmatter. */
export type AuthorInput = string | { name: string; url?: string };

export interface JsonLdSite {
  /** Absolute site root — origin plus any deploy base. No trailing slash. */
  siteRoot: string;
  /** docs.json `name`. */
  name: string;
  /** docs.json `description`. */
  description?: string;
  /** BCP-47 language tag for `inLanguage`. */
  locale: string;
  organization: ResolvedOrganization;
  /**
   * Absolute URL template for the site's own search, containing the literal
   * `{search_term_string}`. Omitted when the site has no search.
   */
  searchUrlTemplate?: string;
}

export interface JsonLdPage {
  /** Absolute canonical URL of this page. Doubles as the WebPage `@id`. */
  url: string;
  /** Page title (the `<title>` / og:title value). */
  title: string;
  description?: string;
  /** Absolute URL of the page's social image, when it has one. */
  image?: string;
  /** Frontmatter `schemaType` — overrides the derived article type. */
  schemaType?: string;
  /** Frontmatter `author`. */
  author?: AuthorInput;
  /**
   * False for pages with no body of their own (index stubs, error pages):
   * they get a plain `WebPage` with no article node.
   */
  hasBody?: boolean;
}

/** One step of the navigation trail, excluding Home and the page itself. */
export interface NavCrumb {
  name: string;
  /** Absolute URL. A crumb with no navigable page of its own omits it. */
  url?: string;
}

export interface JsonLdDates {
  /** ISO 8601. Frontmatter, else the first git commit touching the source. */
  published?: string;
  /** ISO 8601. Frontmatter, else the last git commit touching the source. */
  modified?: string;
}

export interface BuildJsonLdInput {
  site: JsonLdSite;
  page: JsonLdPage;
  navPath: NavCrumb[];
  dates: JsonLdDates;
}

/** Group names that make their pages editorial `Article`s rather than docs. */
const EDITORIAL_GROUP = /^(blog|changelog|release notes|releases|news|updates)$/i;

/**
 * The two site-level nodes — Organization and WebSite. Byte-identical on every
 * page of a site, which is the whole point: every page-level node points at
 * these `@id`s instead of restating the publisher, so a crawler reconciles the
 * site to one entity rather than one per URL.
 */
function siteNodes(site: JsonLdSite): JsonLdNode[] {
  const siteRoot = stripTrailingSlash(site.siteRoot);
  const orgId = organizationId(site.organization);

  const organization: JsonLdNode = {
    "@type": "Organization",
    "@id": orgId,
    name: site.organization.name,
    url: site.organization.url,
  };
  // A plain URL rather than an ImageObject: both are valid schema.org, but a
  // string is the form every validator accepts, and the logo needs no
  // identity of its own.
  if (site.organization.logo) organization.logo = site.organization.logo;
  if (site.organization.sameAs && site.organization.sameAs.length > 0) {
    organization.sameAs = site.organization.sameAs;
  }

  const website: JsonLdNode = {
    "@type": "WebSite",
    "@id": `${siteRoot}/#website`,
    name: site.name,
    url: `${siteRoot}/`,
    publisher: ref(orgId),
    inLanguage: site.locale,
  };
  if (site.description) website.description = site.description;
  if (site.searchUrlTemplate) {
    website.potentialAction = {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: site.searchUrlTemplate,
      },
      "query-input": "required name=search_term_string",
    };
  }

  return [organization, website];
}

/**
 * A graph carrying only the site-level nodes, for a built HTML file that is
 * not a page: the redirect stub Tangly serves at `/` when a project has no
 * root `index` page. It has no content of its own to describe, and its
 * canonical points at another URL — so a WebPage node there would declare an
 * entity for a URL that immediately disclaims itself. The Organization and
 * WebSite still belong: the site root is the most valuable place a crawler
 * can find them.
 */
export function buildSiteJsonLd(site: JsonLdSite): JsonLdGraph | null {
  if (!site.siteRoot) return null;
  return { "@context": "https://schema.org", "@graph": siteNodes(site) };
}

/**
 * Build the page's `@graph`.
 *
 * Returns `null` when the graph cannot be built — which is the correct output,
 * not a failure: without an absolute site origin every `@id` would be a
 * relative string, and a graph of unresolvable identifiers is worse than none.
 */
export function buildJsonLd(input: BuildJsonLdInput): JsonLdGraph | null {
  const { site, page, navPath, dates } = input;
  if (!site.siteRoot || !page.url) return null;

  const siteRoot = stripTrailingSlash(site.siteRoot);
  const pageUrl = page.url;
  const orgId = organizationId(site.organization);
  const websiteId = `${siteRoot}/#website`;
  const breadcrumbId = `${pageUrl}#breadcrumb`;
  const articleId = `${pageUrl}#article`;

  const graph: JsonLdNode[] = [...siteNodes(site)];

  // --- BreadcrumbList -----------------------------------------------------
  // Home is always item 1. Intermediate crumbs are included only when they
  // resolve to a real page: Google treats a non-final ListItem with no `item`
  // as an error, and inventing a URL for a pure grouping header (a sidebar
  // section that is not itself a page) would publish a link that does not
  // exist. Dropping it and renumbering keeps the trail valid and honest.
  const crumbUrls: { name: string; url: string }[] = [{ name: "Home", url: `${siteRoot}/` }];
  for (const crumb of navPath) {
    if (crumb.url) crumbUrls.push({ name: crumb.name, url: crumb.url });
  }
  crumbUrls.push({ name: page.title, url: pageUrl });

  // Dedupe on a trailing-slash-insensitive key: the site root is written
  // `https://host/` as the Home crumb but a home page's own canonical URL may
  // arrive without the slash, and the two must not both list as breadcrumbs.
  const seen = new Set<string>();
  const itemListElement = crumbUrls
    .filter((c) => {
      const key = stripTrailingSlash(c.url);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.url,
    }));

  graph.push({
    "@type": "BreadcrumbList",
    "@id": breadcrumbId,
    itemListElement,
  });

  // --- Person (frontmatter author) ----------------------------------------
  const author = normalizeAuthor(page.author);
  let authorId: string | undefined;
  let authorSummary: JsonLdNode | undefined;
  if (author) {
    // A stable `@id` per author so the same byline across pages reconciles to
    // one entity: their own URL when they have one, otherwise a site-scoped
    // fragment derived from the name.
    authorId = author.url
      ? `${stripTrailingSlash(author.url)}#person`
      : `${siteRoot}/#person-${slugifyName(author.name)}`;
    authorSummary = { "@type": "Person", "@id": authorId, name: author.name };
    graph.push({
      ...authorSummary,
      ...(author.url ? { url: author.url } : {}),
    });
  }

  // --- WebPage ------------------------------------------------------------
  const webPage: JsonLdNode = {
    "@type": "WebPage",
    "@id": pageUrl,
    url: pageUrl,
    name: page.title,
    isPartOf: ref(websiteId),
    breadcrumb: ref(breadcrumbId),
    inLanguage: site.locale,
  };
  if (page.description) webPage.description = page.description;
  if (dates.published) webPage.datePublished = dates.published;
  if (dates.modified) webPage.dateModified = dates.modified;
  graph.push(webPage);

  // --- Article ------------------------------------------------------------
  // A page with no body of its own (an index stub, an error page) is a
  // WebPage and nothing more: there is no article to describe.
  //
  // Author and publisher are written as summaries — `@type`, `@id`, `name`
  // (and the publisher's logo) — rather than bare `{ "@id" }` references.
  // The `@id` still ties them to the full nodes above, so the entity map is
  // unchanged; the inline name is what Article validators (Google's Rich
  // Results among them) read without resolving references across the graph.
  if (page.hasBody !== false) {
    const publisher: JsonLdNode = {
      "@type": "Organization",
      "@id": orgId,
      name: site.organization.name,
      ...(site.organization.logo ? { logo: site.organization.logo } : {}),
    };
    const article: JsonLdNode = {
      "@type": page.schemaType ?? deriveArticleType(navPath),
      "@id": articleId,
      headline: page.title,
      isPartOf: ref(pageUrl),
      mainEntityOfPage: ref(pageUrl),
      author: authorSummary ?? publisher,
      publisher,
      about: ref(orgId),
      inLanguage: site.locale,
    };
    if (page.description) article.description = page.description;
    // An article always carries `datePublished`: when only the modified date
    // is known, the page was published no later than that.
    const published = dates.published ?? dates.modified;
    if (published) article.datePublished = published;
    if (dates.modified) article.dateModified = dates.modified;
    // The page's own social image, else the publisher's logo.
    const image = page.image ?? site.organization.logo;
    if (image) article.image = image;
    graph.push(article);
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

/**
 * Serialise a graph for embedding in `<script type="application/ld+json">`.
 *
 * Escapes `</script` — page titles and descriptions are user content, and a
 * literal `</script>` inside the JSON would close the tag early and spill the
 * rest of the graph into the document as markup. `<\/script` is the same
 * string to a JSON parser, so the escape is free.
 */
export function serializeJsonLd(graph: JsonLdGraph, opts: { pretty?: boolean } = {}): string {
  const json = opts.pretty ? JSON.stringify(graph, null, 2) : JSON.stringify(graph);
  return json.replace(/<\/(script)/gi, "<\\/$1");
}

/** Collect every `@id` declared in the graph, in order. */
export function declaredIds(graph: JsonLdGraph): string[] {
  return graph["@graph"].map((node) => node["@id"]);
}

/**
 * Every `@id` a graph *references* (a `{ "@id": ... }` object nested anywhere
 * under a node) that is not itself declared as a node in the same graph.
 * Empty for a well-formed graph. Used by the build-time self-check and tests.
 */
export function danglingRefs(graph: JsonLdGraph): string[] {
  const declared = new Set(declaredIds(graph));
  const dangling = new Set<string>();

  const visit = (value: unknown, isNodeRoot: boolean): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item, false);
      return;
    }
    if (!value || typeof value !== "object") return;
    const obj = value as Record<string, unknown>;
    const id = obj["@id"];
    // A nested object carrying only `@id` is a reference; one that also
    // declares `@type` with other fields is an inline node (e.g. the logo
    // ImageObject), which declares its own id rather than pointing at one.
    if (!isNodeRoot && typeof id === "string" && Object.keys(obj).length === 1) {
      if (!declared.has(id)) dangling.add(id);
    }
    for (const [key, child] of Object.entries(obj)) {
      if (key === "@id" || key === "@type") continue;
      visit(child, false);
    }
  };

  for (const node of graph["@graph"]) visit(node, true);
  return [...dangling];
}

function ref(id: string): JsonLdRef {
  return { "@id": id };
}

/**
 * The Organization's `@id`: its URL with `/#organization`. The slash form
 * matches the WebSite's `/#website`, and it is the IRI the rest of the web
 * uses for a site-root organization — so a docs site published under the
 * company's own domain names the same entity as the company's main site,
 * instead of a near-identical one (`https://host#organization` and
 * `https://host/#organization` are different identifiers).
 */
function organizationId(organization: ResolvedOrganization): string {
  return `${stripTrailingSlash(organization.url)}/#organization`;
}

/** A logo path a crawler could fetch: anything but empty or a `data:` URI. */
function isFetchableAsset(value: string | undefined): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed !== "" && !/^data:/i.test(trimmed);
}

function deriveArticleType(navPath: NavCrumb[]): string {
  return navPath.some((c) => EDITORIAL_GROUP.test(c.name.trim())) ? "Article" : "TechArticle";
}

function normalizeAuthor(author: AuthorInput | undefined): { name: string; url?: string } | null {
  if (!author) return null;
  if (typeof author === "string") {
    const name = author.trim();
    return name ? { name } : null;
  }
  const name = (author.name ?? "").trim();
  if (!name) return null;
  return { name, ...(author.url ? { url: author.url } : {}) };
}

function slugifyName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "author"
  );
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter((v) => typeof v === "string" && v.trim() !== ""))];
}
