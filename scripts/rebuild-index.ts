/**
 * Rebuild index.json from the actual JSON brand files on disk.
 * Fixes any corruption from race conditions.
 * Run: npx tsx scripts/rebuild-index.ts
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "data", "catalog");
const files = readdirSync(dir).filter(f => f.endsWith(".json") && f !== "index.json");
const index: Record<string, any> = {};

let total = 0, withP = 0;
for (const f of files) {
  try {
    const raw = readFileSync(join(dir, f), "utf8");
    const cat = JSON.parse(raw);
    if (!cat.brand) continue;
    const count = Array.isArray(cat.products) ? cat.products.length : 0;
    index[cat.brand] = {
      file: `data/catalog/${f}`,
      lastFetched: cat.lastFetched || "",
      productCount: count,
      website: cat.website || "",
    };
    total += count;
    if (count > 0) withP++;
    console.log(`${String(count).padStart(4)} | ${cat.brand}`);
  } catch {}
}

writeFileSync(join(dir, "index.json"), JSON.stringify(index, null, 2), "utf8");
console.log(`\nIndex rebuilt: ${withP}/${files.length} brands with products, ${total} total`);
