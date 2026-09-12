/**
 * On-disk catalog cache for the 54 Company A dealer brands.
 * One JSON file per brand at data/catalog/<slug>.json with the structured
 * product list. The match API reads these files instead of hitting Jina
 * on every request — 100× faster and deterministic.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

export interface CatalogProduct {
  mpn: string;
  series: string;
  category: string;
  keySpec: string;    // the headline parametric (e.g. "1A 50V", "8-bit 48MHz")
  package: string;    // package / housing
  tempRange: string;
  output: string;
  voltage: string;
  notes: string;
  sourceUrl: string;  // where we saw it
  // Mouser-style full attribute bag — every other spec we can find on the part.
  // Keys are lower-case human labels (e.g. "rds(on)", "gate charge", "ip rating",
  // "contact rating", "frequency", "memory size"). Values are short strings.
  // EXCLUDES lead time, price, stock, RoHS/REACH dates — those are dealer-specific.
  specs: Record<string, string>;
}

export interface BrandCatalog {
  brand: string;
  website: string;
  lastFetched: string;       // ISO
  sourceUrls: string[];      // pages consulted
  products: CatalogProduct[];
}

export interface CatalogIndexEntry {
  file: string;
  lastFetched: string;
  productCount: number;
  website: string;
}
export type CatalogIndex = Record<string, CatalogIndexEntry>;

const CATALOG_DIR = path.join(process.cwd(), "data", "catalog");
const INDEX_PATH = path.join(CATALOG_DIR, "index.json");
const FRESH_MS = 24 * 60 * 60 * 1000; // 24 h

export function slugify(brand: string): string {
  return brand.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function ensureDir() {
  await fs.mkdir(CATALOG_DIR, { recursive: true });
}

export async function readIndex(): Promise<CatalogIndex> {
  try {
    const raw = await fs.readFile(INDEX_PATH, "utf-8");
    return JSON.parse(raw) as CatalogIndex;
  } catch {
    return {};
  }
}

export async function writeIndex(idx: CatalogIndex): Promise<void> {
  await ensureDir();
  await fs.writeFile(INDEX_PATH, JSON.stringify(idx, null, 2), "utf-8");
}

export async function readBrandCatalog(brand: string): Promise<BrandCatalog | null> {
  const file = path.join(CATALOG_DIR, slugify(brand) + ".json");
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as BrandCatalog;
  } catch {
    return null;
  }
}

export async function writeBrandCatalog(cat: BrandCatalog): Promise<void> {
  await ensureDir();
  const file = path.join(CATALOG_DIR, slugify(cat.brand) + ".json");
  await fs.writeFile(file, JSON.stringify(cat, null, 2), "utf-8");

  const idx = await readIndex();
  idx[cat.brand] = {
    file: path.relative(process.cwd(), file).replace(/\\/g, "/"),
    lastFetched: cat.lastFetched,
    productCount: cat.products.length,
    website: cat.website,
  };
  await writeIndex(idx);
}

export function isStale(iso: string | undefined, maxAgeMs: number = FRESH_MS): boolean {
  if (!iso) return true;
  const age = Date.now() - new Date(iso).getTime();
  return isNaN(age) || age > maxAgeMs;
}

// ── Diff two catalog snapshots — used by refresh to log churn ──
export function diffCatalogs(prev: BrandCatalog | null, next: BrandCatalog): { added: string[]; removed: string[] } {
  const prevSet = new Set((prev?.products || []).map((p) => p.mpn.toUpperCase()));
  const nextSet = new Set(next.products.map((p) => p.mpn.toUpperCase()));
  const added: string[] = [];
  const removed: string[] = [];
  for (const m of nextSet) if (!prevSet.has(m)) added.push(m);
  for (const m of prevSet) if (!nextSet.has(m)) removed.push(m);
  return { added, removed };
}
