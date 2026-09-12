/**
 * Enrichment pass — re-check ALL brands and find missing products.
 * For each brand, fetches more subpages (Jina for JS sites, curl for static),
 * shows Claude the EXISTING products and asks for any it missed.
 *
 * Run: npx tsx scripts/enrich-catalog.ts
 * Run one brand: npx tsx scripts/enrich-catalog.ts --brand=Schurter
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

// Load .env.local
for (const file of [".env.local", ".env"]) {
  try {
    const raw = readFileSync(resolve(process.cwd(), file), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}

import { OUR_DEALERS, DEALER_NAMES } from "../src/lib/dealers";
import { readBrandCatalog, writeBrandCatalog, diffCatalogs, BrandCatalog, CatalogProduct } from "../src/lib/catalogStore";
import { askGemini } from "../src/lib/gemini";
import { parseJsonResponse } from "../src/lib/parseJson";

function fetchViaJina(url: string, cap = 40000): string {
  try {
    const text = execSync(
      `curl -sL --max-time 25 "https://r.jina.ai/${url}" -H "X-Return-Format: markdown"`,
      { maxBuffer: 5 * 1024 * 1024, timeout: 30000 }
    ).toString();
    if (text.includes('"code":429')) return "";
    return text.slice(0, cap);
  } catch {
    return "";
  }
}

function fetchViaCurl(url: string, cap = 40000): string {
  try {
    const html = execSync(
      `curl -sL --max-time 15 -H "User-Agent: Mozilla/5.0" "${url}"`,
      { maxBuffer: 5 * 1024 * 1024, timeout: 20000 }
    ).toString();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, cap);
  } catch {
    return "";
  }
}

function fetchMultiplePages(website: string): string {
  const base = website.replace(/\/+$/, "");
  const paths = [
    "", "/products", "/product", "/catalog", "/en/products",
    "/product-list", "/product-center", "/all-products", "/portfolio",
    "/product-catalog", "/series", "/product-line",
  ];
  let content = "";
  for (const p of paths) {
    if (content.length > 60000) break;
    const url = base + p;
    // Try curl first, Jina fallback
    let text = fetchViaCurl(url, 8000);
    if (text.length < 500) {
      text = fetchViaJina(url, 8000);
      if (text.length < 500) continue;
    }
    content += `\n--- PAGE: ${url} ---\n${text}\n`;
    // Small delay for Jina (cross-platform)
    if (text.length > 0) {
      const delay = text.includes("jina") ? 3000 : 500;
      const start = Date.now(); while (Date.now() - start < delay) { /* busy wait */ }
    }
  }
  return content;
}

function buildEnrichPrompt(
  brand: string,
  website: string,
  categories: string[],
  existingMPNs: string[],
  content: string
): string {
  const existingList = existingMPNs.length > 0
    ? `\nALREADY IN OUR DATABASE (${existingMPNs.length} products):\n${existingMPNs.join(", ")}\n`
    : "\nOur database currently has 0 products for this brand.\n";

  return `You are a product catalog enrichment engine. Find ALL products by "${brand}" (${website}) that are MISSING from our existing database.

Product categories for ${brand}: ${categories.join(", ")}
${existingList}

WEBSITE CONTENT:
${content.slice(0, 45000)}

TASK:
1. Look through the website content for ANY product, MPN, part number, series, or model by ${brand}.
2. Compare against the ALREADY IN DATABASE list above.
3. Output ONLY the NEW products that are NOT already in our database. If an MPN is already listed above, DO NOT include it.
4. Also think about product variants — if you see a series like "ABC" and we only have "ABC-01", add "ABC-02", "ABC-03" etc. if they exist.
5. Include FULL Mouser-style specs for each new product.

If you find NO new products beyond what we already have, return {"products":[]}.

OUTPUT — ONLY JSON, no prose, no fences:
{
  "products": [
    {
      "mpn": "<part number>",
      "series": "<series>",
      "category": "<category>",
      "keySpec": "<main spec>",
      "package": "",
      "tempRange": "",
      "output": "",
      "voltage": "",
      "notes": "",
      "sourceUrl": "",
      "specs": {}
    }
  ]
}`;
}

async function enrichBrand(brand: string): Promise<{ added: number; total: number }> {
  const info = OUR_DEALERS[brand as keyof typeof OUR_DEALERS];
  if (!info) return { added: 0, total: 0 };

  const existing = await readBrandCatalog(brand);
  const existingProducts = existing?.products || [];
  const existingMPNs = existingProducts.map(p => p.mpn);
  const categories = info.products.split(",").map(s => s.trim()).filter(Boolean);

  console.log(`  ${brand}: current ${existingProducts.length} products, fetching more pages...`);

  const content = fetchMultiplePages(info.website);
  if (content.length < 500) {
    console.log(`  ${brand}: no website content, skipping`);
    return { added: 0, total: existingProducts.length };
  }

  console.log(`  ${brand}: ${content.length} chars, asking Claude for missing products...`);

  try {
    const prompt = buildEnrichPrompt(brand, info.website, categories, existingMPNs, content);
    const text = await askGemini(prompt, 8192);
    const parsed = parseJsonResponse(text) as { products?: CatalogProduct[] };
    const newProducts = Array.isArray(parsed.products)
      ? parsed.products.filter(p => {
          if (!p.mpn || !p.mpn.trim()) return false;
          // Skip if already exists
          const upper = p.mpn.trim().toUpperCase();
          return !existingMPNs.some(e => e.toUpperCase() === upper);
        })
      : [];

    if (newProducts.length === 0) {
      console.log(`  ${brand}: no new products found`);
      return { added: 0, total: existingProducts.length };
    }

    // Merge new products into existing
    const merged = [...existingProducts, ...newProducts.map(p => ({
      ...p,
      specs: (p.specs && typeof p.specs === "object") ? p.specs : {},
    }))];

    const next: BrandCatalog = {
      brand,
      website: info.website,
      lastFetched: new Date().toISOString(),
      sourceUrls: existing?.sourceUrls || [info.website],
      products: merged,
    };
    await writeBrandCatalog(next);
    console.log(`  ✔ ${brand}: +${newProducts.length} new (total: ${merged.length})`);
    return { added: newProducts.length, total: merged.length };
  } catch (e) {
    console.error(`  ✘ ${brand}: ${(e as Error).message.slice(0, 100)}`);
    return { added: 0, total: existingProducts.length };
  }
}

async function main() {
  const onlyArg = process.argv.find(a => a.startsWith("--brand="));
  const only = onlyArg ? onlyArg.split("=")[1] : null;

  const brands = only ? [only] : [...DEALER_NAMES];

  console.log(`[enrich-catalog] Enriching ${brands.length} brands\n`);

  let totalAdded = 0;
  for (const brand of brands) {
    console.log(`\nEnriching: ${brand}`);
    const { added } = await enrichBrand(brand);
    totalAdded += added;
  }

  console.log(`\n=== ENRICHMENT DONE: +${totalAdded} new products across ${brands.length} brands ===`);
}

main().catch(e => { console.error(e); process.exit(1); });
