/**
 * Daily catalog refresh — rebuild every stale brand JSON.
 * Schedule with Windows Task Scheduler or cron:
 *   npx tsx scripts/refresh-catalog.ts
 * Use --force to rebuild every brand regardless of freshness.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local manually (tsx doesn't auto-load like Next.js runtime does)
for (const file of [".env.local", ".env"]) {
  try {
    const raw = readFileSync(resolve(process.cwd(), file), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}

import { DEALER_NAMES } from "../src/lib/dealers";
import { buildBrandCatalog } from "../src/lib/catalogBuild";
import { readIndex, isStale } from "../src/lib/catalogStore";

async function main() {
  const force = process.argv.includes("--force");
  const onlyArg = process.argv.find((a) => a.startsWith("--brand="));
  const only = onlyArg ? onlyArg.split("=")[1] : null;

  const idx = await readIndex();
  const brands = only
    ? [only]
    : DEALER_NAMES.filter((b) => force || isStale(idx[b]?.lastFetched));

  console.log(`[refresh-catalog] ${brands.length}/${DEALER_NAMES.length} brands to rebuild`);

  let totalAdded = 0, totalRemoved = 0, failed = 0;
  for (const brand of brands) {
    try {
      const r = await buildBrandCatalog(brand);
      totalAdded += r.added.length;
      totalRemoved += r.removed.length;
      console.log(`✔ ${brand}: ${r.catalog.products.length} products (+${r.added.length} / -${r.removed.length}) from ${r.sourceCount} pages`);
    } catch (e) {
      failed += 1;
      console.error(`✘ ${brand}: ${(e as Error).message}`);
    }
  }

  console.log(`\nDone. +${totalAdded} / -${totalRemoved} MPNs across ${brands.length - failed} brands (${failed} failed).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
