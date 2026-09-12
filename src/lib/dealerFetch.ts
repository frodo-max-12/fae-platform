/**
 * Live dealer content fetcher.
 *
 * Uses two free Jina endpoints:
 *   r.jina.ai/<url>        → render a specific URL as markdown
 *   s.jina.ai/<query>      → web search, returns top hits rendered as markdown
 *
 * For product matching we combine three signals per brand:
 *   1. Landing page (r.jina)
 *   2. Deep-crawl catalog links harvested from the landing markdown (r.jina)
 *   3. Guessed common catalog paths (/products, /catalog, /portfolio, ...) (r.jina)
 *   4. Web search for "<brand> <category> products" (s.jina) — pulls real
 *      parametric pages Jina wouldn't reach from the root.
 *
 * This gives the matching LLM the depth it needs to cite real MPNs.
 */

const READER_BASE = "https://r.jina.ai/";
const SEARCH_BASE = "https://s.jina.ai/";
const PER_PAGE_CHAR_CAP = 15000;
const FETCH_TIMEOUT_MS = 20000;
const MAX_DEEP_PAGES = 120;        // was 10 — go exhaustive
const MAX_SITEMAP_URLS = 400;      // cap sitemap URLs harvested per brand
const BFS_PARALLEL = 6;             // concurrent fetches

// Common catalog path guesses appended to each dealer root
const GUESSED_PATHS = [
  "/products", "/product", "/catalog", "/catalogue", "/portfolio",
  "/series", "/en/products", "/en/product", "/product-catalog",
  "/product-center", "/product-list", "/product-line", "/all-products"
];

const CATALOG_HINTS = [
  "product", "products", "catalog", "catalogue", "portfolio", "series",
  "parametric", "search", "selector", "datasheet", "browse", "category",
  "categories", "range", "lineup", "family", "families", "line-up",
  "diode", "mosfet", "transistor", "ic", "mcu", "memory", "sensor",
  "connector", "relay", "switch", "led", "display", "capacitor", "resistor"
];

export async function fetchDealerPage(url: string, cap: number = PER_PAGE_CHAR_CAP): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(READER_BASE + url, {
      signal: ctrl.signal,
      headers: { "X-Return-Format": "markdown" },
    });
    if (!r.ok) return "";
    const text = await r.text();
    return text.slice(0, cap);
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
}

export async function webSearch(query: string, cap: number = PER_PAGE_CHAR_CAP): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(SEARCH_BASE + encodeURIComponent(query), {
      signal: ctrl.signal,
      headers: { "X-Return-Format": "markdown" },
    });
    if (!r.ok) return "";
    const text = await r.text();
    return text.slice(0, cap);
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
}

function harvestCatalogLinks(markdown: string, rootUrl: string): string[] {
  let host = "";
  try { host = new URL(rootUrl).host.replace(/^www\./, ""); } catch { return []; }

  const urls = new Set<string>();
  const linkRe = /\]\((https?:\/\/[^)\s]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(markdown)) !== null) {
    const u = m[1].replace(/[),.]+$/, "");
    try {
      const parsed = new URL(u);
      if (parsed.host.replace(/^www\./, "") !== host) continue;
      const path = parsed.pathname.toLowerCase();
      if (path === "/" || path === "") continue;
      if (/\.(pdf|jpg|jpeg|png|gif|svg|zip|mp4|webp)$/i.test(path)) continue;
      const hit = CATALOG_HINTS.some((h) => path.includes(h));
      if (!hit) continue;
      urls.add(parsed.toString());
    } catch { /* skip */ }
  }
  return Array.from(urls);
}

// ── Fetch raw (non-Jina) XML/text for sitemap parsing ──
async function fetchRawText(url: string, cap = 500000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) return "";
    const text = await r.text();
    return text.slice(0, cap);
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
}

// ── Extract all <loc>…</loc> URLs from sitemap XML; recurse into sitemap-indexes ──
async function harvestSitemap(rootUrl: string): Promise<string[]> {
  let host = "";
  try { host = new URL(rootUrl).host.replace(/^www\./, ""); } catch { return []; }
  const base = rootUrl.replace(/\/+$/, "");
  const urls = new Set<string>();
  const seenSitemaps = new Set<string>();

  async function loadSitemap(smUrl: string, depth: number): Promise<void> {
    if (depth > 2 || seenSitemaps.has(smUrl) || urls.size >= MAX_SITEMAP_URLS) return;
    seenSitemaps.add(smUrl);
    const xml = await fetchRawText(smUrl);
    if (!xml) return;
    const locs = Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((m) => m[1]);
    for (const loc of locs) {
      if (urls.size >= MAX_SITEMAP_URLS) break;
      if (/\.xml(\.gz)?$/i.test(loc)) {
        await loadSitemap(loc, depth + 1);
        continue;
      }
      try {
        const p = new URL(loc);
        if (p.host.replace(/^www\./, "") !== host) continue;
        const path = p.pathname.toLowerCase();
        if (/\.(pdf|jpg|jpeg|png|gif|svg|zip|mp4|webp|css|js)$/i.test(path)) continue;
        // keep product-ish URLs OR anything if no hint-filtering would leave us empty
        const hit = CATALOG_HINTS.some((h) => path.includes(h));
        if (hit || /\d/.test(path)) urls.add(p.toString()); // product pages often have digits
      } catch { /* skip */ }
    }
  }

  // Try robots.txt first
  const robots = await fetchRawText(base + "/robots.txt", 20000);
  const smFromRobots = Array.from(robots.matchAll(/Sitemap:\s*(\S+)/gi)).map((m) => m[1]);
  const candidates = [
    ...smFromRobots,
    base + "/sitemap.xml",
    base + "/sitemap_index.xml",
    base + "/sitemap-index.xml",
    base + "/product-sitemap.xml",
  ];
  for (const sm of candidates) {
    if (urls.size >= MAX_SITEMAP_URLS) break;
    await loadSitemap(sm, 0);
  }
  return Array.from(urls);
}

// ── Fetch URLs in bounded-concurrency batches ──
async function fetchBatch(urls: string[]): Promise<Array<{ url: string; text: string }>> {
  const out: Array<{ url: string; text: string }> = [];
  for (let i = 0; i < urls.length; i += BFS_PARALLEL) {
    const slice = urls.slice(i, i + BFS_PARALLEL);
    const r = await Promise.all(slice.map(async (u) => ({ url: u, text: await fetchDealerPage(u) })));
    for (const p of r) if (p.text.length > 300) out.push(p);
  }
  return out;
}

// ── Deep catalog fetch for ONE dealer: sitemap + landing + guessed paths + 1-hop BFS ──
export async function fetchDealerDeep(rootUrl: string): Promise<Array<{ url: string; text: string }>> {
  const pages: Array<{ url: string; text: string }> = [];

  // 1. Landing page
  const landing = await fetchDealerPage(rootUrl);
  if (landing && landing.length >= 100) pages.push({ url: rootUrl, text: landing });

  // 2. Sitemap-driven URLs (most authoritative for "every product")
  const sitemapUrls = await harvestSitemap(rootUrl);

  // 3. Landing-harvested + guessed paths
  const rootBase = rootUrl.replace(/\/+$/, "");
  const guessedUrls = GUESSED_PATHS.map((p) => rootBase + p);
  const harvested = landing ? harvestCatalogLinks(landing, rootUrl) : [];

  // Seed set: sitemap first (it's the richest), then guessed, then harvested
  const seen = new Set<string>([rootUrl]);
  const seed: string[] = [];
  for (const u of [...sitemapUrls, ...guessedUrls, ...harvested]) {
    if (!seen.has(u)) { seen.add(u); seed.push(u); }
    if (seed.length >= MAX_DEEP_PAGES) break;
  }
  if (seed.length === 0) return pages;

  // 4. Fetch seed batch
  const firstPass = await fetchBatch(seed);
  pages.push(...firstPass);

  // 5. One more hop: harvest links from the first batch to dig into sub-catalogs
  if (pages.length < MAX_DEEP_PAGES) {
    const more = new Set<string>();
    for (const p of firstPass) {
      for (const link of harvestCatalogLinks(p.text, rootUrl)) {
        if (!seen.has(link)) { seen.add(link); more.add(link); }
        if (more.size + pages.length >= MAX_DEEP_PAGES) break;
      }
      if (more.size + pages.length >= MAX_DEEP_PAGES) break;
    }
    if (more.size > 0) {
      const secondPass = await fetchBatch(Array.from(more));
      pages.push(...secondPass);
    }
  }

  return pages;
}

// ── Search the web for authoritative catalog pages (s.jina.ai) ──
export async function fetchDealerSearchContext(
  brand: string,
  domain: string,
  categoryHints: string[]
): Promise<Array<{ url: string; text: string }>> {
  const cat = categoryHints.filter(Boolean).slice(0, 3).join(" ");
  const queries = [
    `${brand} ${cat} products MPN part number`,
    `site:${domain} ${cat} products`,
    `${brand} ${cat} series datasheet`,
  ];
  const results = await Promise.all(queries.map(async (q) => ({ url: `search:${q}`, text: await webSearch(q) })));
  return results.filter((r) => r.text.length > 300);
}

// ── Full context for a brand-locked match: deep-crawl + web search ──
export async function fetchDealerFull(
  rootUrl: string,
  brand: string,
  categoryHints: string[]
): Promise<Array<{ url: string; text: string }>> {
  let domain = "";
  try { domain = new URL(rootUrl).host.replace(/^www\./, ""); } catch { domain = rootUrl; }

  const [deep, search] = await Promise.all([
    fetchDealerDeep(rootUrl),
    fetchDealerSearchContext(brand, domain, categoryHints),
  ]);
  return [...deep, ...search];
}

// ── Legacy single-page entry-point (AI-mode, multi-brand) ──
export async function fetchMany(urls: string[]): Promise<Array<{ url: string; text: string }>> {
  const deep = await Promise.all(urls.map((u) => fetchDealerDeep(u)));
  const flat = deep.flat();
  return flat.filter((r) => r.text.length > 100);
}
