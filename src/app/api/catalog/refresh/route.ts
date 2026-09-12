/**
 * Catalog refresh endpoint.
 *   POST /api/catalog/refresh?brand=Rectron         → rebuild one brand
 *   POST /api/catalog/refresh?all=true              → rebuild every stale brand
 *   POST /api/catalog/refresh?all=true&force=true   → rebuild everything
 *
 * The daily job (scripts/refresh-catalog) calls this to keep data/catalog/*.json
 * fresh so the match API serves from disk with zero crawling.
 */

import { NextRequest, NextResponse } from "next/server";
import { buildBrandCatalog } from "@/lib/catalogBuild";
import { readIndex, isStale } from "@/lib/catalogStore";
import { DEALER_NAMES } from "@/lib/dealers";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const oneBrand = searchParams.get("brand");
  const all = searchParams.get("all") === "true";
  const force = searchParams.get("force") === "true";

  if (oneBrand) {
    try {
      const r = await buildBrandCatalog(oneBrand);
      return NextResponse.json({
        ok: true,
        brand: oneBrand,
        productCount: r.catalog.products.length,
        added: r.added,
        removed: r.removed,
        sourcePages: r.sourceCount,
      });
    } catch (e) {
      return NextResponse.json({ ok: false, brand: oneBrand, error: (e as Error).message }, { status: 500 });
    }
  }

  if (!all) {
    return NextResponse.json({ error: "Pass ?brand=<name> or ?all=true" }, { status: 400 });
  }

  const idx = await readIndex();
  const targets = DEALER_NAMES.filter((b) => force || isStale(idx[b]?.lastFetched));

  const report: Array<{ brand: string; ok: boolean; productCount?: number; added?: string[]; removed?: string[]; error?: string }> = [];
  // Sequential to avoid hammering Jina / Groq rate limits
  for (const brand of targets) {
    try {
      const r = await buildBrandCatalog(brand);
      report.push({ brand, ok: true, productCount: r.catalog.products.length, added: r.added, removed: r.removed });
    } catch (e) {
      report.push({ brand, ok: false, error: (e as Error).message });
    }
  }

  return NextResponse.json({ ok: true, refreshedCount: targets.length, skipped: DEALER_NAMES.length - targets.length, report });
}

export async function GET() {
  const idx = await readIndex();
  return NextResponse.json({ index: idx, totalBrands: Object.keys(idx).length });
}
