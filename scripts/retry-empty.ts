/**
 * Retry brands that got 0 products — uses Jina Reader (renders JS)
 * + stronger extraction prompt to ensure coverage.
 * Run: npx tsx scripts/retry-empty.ts
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

function buildRetryPrompt(brand: string, website: string, categories: string[], content: string): string {
  const catList = categories.join(", ");
  return `You are a product catalog extraction system for Company A, an authorized dealer.

BRAND: ${brand}
WEBSITE: ${website}
PRODUCT CATEGORIES: ${catList}

SOURCE CONTENT:
${content.slice(0, 45000)}

TASK: Extract EVERY product, part number, MPN, and model from the content above. This brand manufactures ${catList}. Look for:
- Part numbers / MPNs (alphanumeric codes like "SS8050", "RB-1212S", "HAL 815")
- Series names with variants
- Product family names with individual models
- ANY identifiable product reference

If the content mentions series or families but not individual MPNs, list the series as products. If you find category names but no specific parts, list the categories as product lines.

You MUST output at least the product series/families visible in the content. Do NOT return an empty list unless the content truly contains zero product information.

SPECS: For each product, include every specification you can find. Use a "specs" object for detailed parametric data.

OUTPUT — ONLY this JSON, no prose, no fences:
{
  "products": [
    {
      "mpn": "<part number or series name>",
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

async function retryBrand(brand: string): Promise<number> {
  const info = OUR_DEALERS[brand as keyof typeof OUR_DEALERS];
  if (!info) return 0;

  const categories = info.products.split(",").map(s => s.trim()).filter(Boolean);
  const base = info.website.replace(/\/+$/, "");

  // Try multiple URLs via Jina (renders JS) + curl
  const urls = [info.website, base + "/products", base + "/product", base + "/en/products"];
  let content = "";

  for (const url of urls) {
    if (content.length > 5000) break;
    // Try Jina first
    const jina = fetchViaJina(url);
    if (jina.length > 500) {
      content += `\n--- ${url} (jina) ---\n${jina}\n`;
      continue;
    }
    // Fallback to curl
    const curl = fetchViaCurl(url);
    if (curl.length > 500) {
      content += `\n--- ${url} (curl) ---\n${curl}\n`;
    }
  }

  console.log(`  ${brand}: fetched ${content.length} chars from ${urls.length} URLs`);

  if (content.length < 200) {
    console.log(`  ${brand}: no content available, skipping`);
    return 0;
  }

  try {
    const prompt = buildRetryPrompt(brand, info.website, categories, content);
    const text = await askGemini(prompt, 8192);
    const parsed = parseJsonResponse(text) as { products?: CatalogProduct[] };
    const products = Array.isArray(parsed.products) ? parsed.products.filter(p => p.mpn && p.mpn.trim()) : [];

    if (products.length === 0) {
      console.log(`  ${brand}: Claude returned 0 products`);
      return 0;
    }

    // Normalize
    const normalized = products.map(p => ({
      ...p,
      specs: (p.specs && typeof p.specs === "object") ? p.specs : {},
    }));

    const prev = await readBrandCatalog(brand);
    const next: BrandCatalog = {
      brand,
      website: info.website,
      lastFetched: new Date().toISOString(),
      sourceUrls: urls,
      products: normalized,
    };
    await writeBrandCatalog(next);
    const { added } = diffCatalogs(prev, next);
    console.log(`  ✔ ${brand}: ${normalized.length} products (+${added.length})`);
    return normalized.length;
  } catch (e) {
    console.error(`  ✘ ${brand}: ${(e as Error).message.slice(0, 100)}`);
    return 0;
  }
}

async function main() {
  // Find brands with 0 products
  const empty: string[] = [];
  for (const brand of DEALER_NAMES) {
    const cat = await readBrandCatalog(brand);
    if (!cat || cat.products.length === 0) empty.push(brand);
  }

  console.log(`[retry-empty] ${empty.length} brands with 0 products to retry\n`);

  let fixed = 0;
  for (const brand of empty) {
    console.log(`Retrying: ${brand}`);
    const count = await retryBrand(brand);
    if (count > 0) fixed++;
    // Small delay to avoid Jina rate limits
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log(`\nDone. Fixed ${fixed}/${empty.length} brands.`);
}

main().catch(e => { console.error(e); process.exit(1); });
