import { NextRequest, NextResponse } from "next/server";
import { parseJsonResponse } from "@/lib/parseJson";
import { askGemini } from "@/lib/gemini";
import { fetchMany, fetchDealerFull } from "@/lib/dealerFetch";
import { getCached, setCached } from "@/lib/db";
import { OUR_DEALERS } from "@/lib/dealers";
import { readBrandCatalog, isStale, BrandCatalog } from "@/lib/catalogStore";
import { buildBrandCatalog } from "@/lib/catalogBuild";
import crypto from "node:crypto";

/**
 * FAE matching engine — two modes:
 *   mode="brand"  → search only the make the user picked (granularity="all" merges every MPN
 *                    into one LLM call against that brand; "each" per-MPN).
 *   mode="ai"     → LLM picks from 54 dealer brands, per requirement.
 *
 * Every result set is sorted so the top entry is the closest-to-100% fit — the FAE sees
 * the perfect match first, then graceful degradations below it.
 */

function hashKey(obj: unknown): string {
  return crypto.createHash("sha1").update(JSON.stringify(obj)).digest("hex");
}

type Match = {
  company: string; model: string; series: string;
  sensing: string; ipRating: string; tempRange: string;
  output: string; voltage: string; price: number;
  moq: number; warranty: string; advantages: string;
  matchScore: number; reasoning: string;
  specMatches?: Record<string, boolean>;
};

type MatchTier = "MPN_EXACT" | "MPN_XREF" | "BRAND_LOCKED" | "SPECS" | "NO_MATCH";
type MatchResult = {
  tier: MatchTier;
  matches: Match[];
  noMatchReason?: string;
};

// ─── Keyword-based brand picker for AI mode (no LLM — instant) ───
function pickBrands(r: Record<string, string>): string[] {
  const hay = Object.values(r).join(" ").toLowerCase();
  const hintBrand = (r.referenceCompany || "").toLowerCase().trim();

  const scored: Array<{ brand: string; score: number }> = [];
  for (const [brand, info] of Object.entries(OUR_DEALERS)) {
    let score = 0;
    if (hintBrand && brand.toLowerCase().includes(hintBrand)) score += 100;
    for (const keyword of info.products.toLowerCase().split(/[,\s]+/)) {
      if (keyword.length >= 4 && hay.includes(keyword)) score += 10;
    }
    if (score > 0) scored.push({ brand, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 2).map((s) => s.brand);
}

function sortMatches(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
}

// ─── LLM prompt builder — shared between modes. Always push for a 100% entry at [0]. ───
function buildMatchPrompt(
  requirements: Array<Record<string, string>>,
  corpus: string,
  locked: { brand: string; website: string } | null
): string {
  const lock = locked
    ? `You are SEARCHING ONLY within the Company A-authorised make "${locked.brand}" (${locked.website}).
${locked.brand} is a real manufacturer with a PUBLIC PRODUCT CATALOG — Company A is their authorised dealer, so you may and SHOULD draw on your knowledge of ${locked.brand}'s catalog in addition to the fetched sources. The rule is: every MPN you return must be a REAL ${locked.brand} part — either (a) present in the sources below, or (b) a well-known catalog part of ${locked.brand} that you know exists (series, family, MPN). You MUST propose at least one candidate unless ${locked.brand}'s published product range genuinely does not cover this customer category at all. NEVER output a part from another brand. NEVER invent a fictitious MPN.`
    : `You are scanning across Company A' 54 authorised dealer brands. Pick the best cross-brand alternates. Every MPN must be a real catalog part of the cited brand.`;

  const schema = `{
  "results": [
    {
      "requirementId": "<id from the requirement>",
      "tier": "MPN_EXACT" | "MPN_XREF" | "BRAND_LOCKED" | "SPECS" | "NO_MATCH",
      "matches": [
        {
          "company": "<brand>", "model": "<MPN>", "series": "<product line>",
          "sensing": "<the key parametric spec>", "ipRating": "<package/rating>",
          "tempRange": "<temp range>", "output": "<output/config>",
          "voltage": "<voltage>",
          "price": <number in INR>, "moq": <integer>, "warranty": "<string>",
          "advantages": "<2-3 selling points>",
          "matchScore": <0-100>,
          "reasoning": "<1-2 sentence FAE note>",
          "specMatches": {
            "sensing": <bool>, "ipRating": <bool>, "tempRange": <bool>,
            "output": <bool>, "voltage": <bool>, "price": <bool>, "warranty": <bool>
          }
        }
      ],
      "noMatchReason": "<set ONLY when matches=[]>"
    }
  ]
}`;

  return `You are Company A' senior FAE product-matching engine.

${lock}

ABSOLUTE RULES
1. Your #1 priority: for every requirement, if a product exists that meets 100% of the customer specs, it MUST appear at matches[0] with matchScore=100.
2. Follow matches[0] with up to 4 alternates at lower matchScore (90, 85, 80, 75…) — the FAE needs fallbacks when stock/budget/MOQ fails.
3. The dealer sources below may be (a) a structured catalog listing (lines formatted "MPN | SERIES | CATEGORY | KEY SPEC | PACKAGE | TEMP | OUTPUT | VOLTAGE | NOTES") built from our on-disk brand catalog JSON, or (b) raw web pages. In either case, every MPN you return MUST be a real catalog part of the cited brand. Prefer MPNs from the structured catalog rows verbatim. If brand-locked and a structured catalog is present, choose ONLY from its rows.
4. matchScore reflects REAL spec compliance (sensing, IP/package, temp, output, voltage, price vs target). Fill specMatches with true/false per spec — this is what the UI renders.
5. If truly nothing fits, return tier="NO_MATCH" and matches=[] with noMatchReason. Never fake a match.
6. Sort matches DESC by matchScore.

CUSTOMER REQUIREMENTS (${requirements.length}):
${JSON.stringify(requirements, null, 2)}

DEALER SOURCES (live-fetched):
${corpus}

Return ONLY this JSON — no prose, no markdown fences:
${schema}`;
}

async function callLLMBatch(
  requirements: Array<Record<string, string>>,
  pages: Array<{ url: string; text: string }>,
  locked: { brand: string; website: string } | null
): Promise<Record<string, MatchResult>> {
  const corpus = pages
    .map((p) => `--- SOURCE: ${p.url} ---\n${p.text}`)
    .join("\n\n")
    .slice(0, 60000);

  const prompt = buildMatchPrompt(requirements, corpus, locked);
  const text = await askGemini(prompt, 4096);
  const parsed = parseJsonResponse(text) as { results?: Array<{ requirementId: string } & MatchResult> };

  const out: Record<string, MatchResult> = {};
  for (const r of requirements) {
    out[r.id] = { tier: "NO_MATCH", matches: [], noMatchReason: "No response from matcher." };
  }
  for (const row of parsed.results || []) {
    const matches = Array.isArray(row.matches) ? sortMatches(row.matches) : [];
    out[row.requirementId] = {
      tier: (row.tier as MatchTier) || (matches.length > 0 ? "SPECS" : "NO_MATCH"),
      matches: matches.slice(0, 5),
      ...(matches.length === 0 ? { noMatchReason: row.noMatchReason || "No matching product found." } : {}),
    };
  }
  return out;
}

// ─── Load brand catalog from disk; rebuild lazily if missing ───
async function loadOrBuildCatalog(brand: string): Promise<BrandCatalog | null> {
  let cat = await readBrandCatalog(brand);
  if (!cat) {
    // First-ever hit for this brand — build now
    try {
      const r = await buildBrandCatalog(brand);
      cat = r.catalog;
    } catch (e) {
      console.error(`[match] buildBrandCatalog("${brand}") failed:`, (e as Error).message);
      return null;
    }
  }
  return cat;
}

function catalogAsCorpus(cat: BrandCatalog): Array<{ url: string; text: string }> {
  // Present the on-disk catalog to the LLM as one source. Core columns as a pipe table,
  // plus the Mouser-style specs bag appended per row so the matcher sees EVERY attribute.
  const header = `BRAND: ${cat.brand}\nWEBSITE: ${cat.website}\nPRODUCT COUNT: ${cat.products.length}\n\nEach row: MPN | SERIES | CATEGORY | KEY SPEC | PACKAGE | TEMP | OUTPUT | VOLTAGE | NOTES\nThen "SPECS:" followed by every additional parametric attribute for that MPN.`;
  const rows = cat.products.map((p) => {
    const core = [p.mpn, p.series, p.category, p.keySpec, p.package, p.tempRange, p.output, p.voltage, p.notes]
      .map((v) => (v || "").toString().replace(/\|/g, "/"))
      .join(" | ");
    const specEntries = p.specs && typeof p.specs === "object"
      ? Object.entries(p.specs).filter(([, v]) => v && String(v).trim()).map(([k, v]) => `${k}=${v}`)
      : [];
    return specEntries.length > 0 ? `${core}\n  SPECS: ${specEntries.join("; ")}` : core;
  });
  return [{ url: `catalog://${cat.brand}`, text: [header, ...rows].join("\n")  }];
}

// ─── Mode: Brand-locked ───
async function matchBrandLocked(
  requirements: Array<Record<string, string>>,
  brand: string,
  granularity: "all" | "each"
): Promise<Record<string, MatchResult>> {
  const dealer = OUR_DEALERS[brand as keyof typeof OUR_DEALERS];
  if (!dealer) {
    const empty: Record<string, MatchResult> = {};
    for (const r of requirements) empty[r.id] = { tier: "NO_MATCH", matches: [], noMatchReason: `Unknown brand "${brand}".` };
    return empty;
  }

  // Prefer the on-disk catalog — fast, deterministic, no crawl.
  const cat = await loadOrBuildCatalog(brand);
  let pages: Array<{ url: string; text: string }>;
  if (cat && cat.products.length > 0) {
    pages = catalogAsCorpus(cat);
  } else {
    // Fallback: live fetch (old path)
    pages = await fetchMany([dealer.website]);
  }

  if (pages.length === 0) {
    const empty: Record<string, MatchResult> = {};
    for (const r of requirements) empty[r.id] = { tier: "NO_MATCH", matches: [], noMatchReason: `${brand} catalog unavailable.` };
    return empty;
  }

  if (granularity === "all") {
    const key = "brand:" + brand + ":all:" + hashKey(requirements);
    const cached = getCached(key) as Record<string, MatchResult> | null;
    if (cached) return cached;
    const result = await callLLMBatch(requirements, pages, { brand, website: dealer.website });
    setCached(key, result);
    return result;
  }

  // granularity === "each" — one LLM call per requirement, parallel
  const results = await Promise.all(
    requirements.map(async (r) => {
      const key = "brand:" + brand + ":each:" + hashKey(r);
      const cached = getCached(key) as Record<string, MatchResult> | null;
      if (cached) return { id: r.id, map: cached };
      const map = await callLLMBatch([r], pages, { brand, website: dealer.website });
      setCached(key, map);
      return { id: r.id, map };
    })
  );
  const out: Record<string, MatchResult> = {};
  for (const { id, map } of results) {
    out[id] = map[id] || { tier: "NO_MATCH", matches: [], noMatchReason: "No result." };
  }
  return out;
}

// ─── Mode: AI search across 54 brands ───
async function matchAI(r: Record<string, string>): Promise<MatchResult> {
  const key = "ai:" + hashKey(r);
  const cached = getCached(key) as MatchResult | null;
  if (cached) return cached;

  const brands = pickBrands(r);
  if (brands.length === 0) {
    return { tier: "NO_MATCH", matches: [], noMatchReason: "No relevant Company A dealer brand identified for this requirement." };
  }

  // Prefer on-disk catalogs for the picked brands; fall back to live fetch only if none exist.
  const pages: Array<{ url: string; text: string }> = [];
  for (const b of brands) {
    const cat = await readBrandCatalog(b);
    if (cat && cat.products.length > 0) pages.push(...catalogAsCorpus(cat));
  }
  if (pages.length === 0) {
    const urls = brands.map((b) => OUR_DEALERS[b as keyof typeof OUR_DEALERS].website);
    const live = await fetchMany(urls);
    pages.push(...live);
  }
  if (pages.length === 0) {
    return { tier: "NO_MATCH", matches: [], noMatchReason: "Dealer catalogs unavailable." };
  }
  const map = await callLLMBatch([r], pages, null);
  const result = map[r.id] || { tier: "NO_MATCH", matches: [], noMatchReason: "No response." };
  setCached(key, result);
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      requirements: Array<Record<string, string>>;
      mode?: "brand" | "ai";
      brand?: string;
      granularity?: "all" | "each";
    };
    const { requirements, mode = "ai", brand, granularity = "each" } = body;

    if (!requirements || requirements.length === 0) {
      return NextResponse.json({ error: "Requirements are required" }, { status: 400 });
    }

    let batchMatches: Record<string, MatchResult>;

    if (mode === "brand") {
      if (!brand) {
        return NextResponse.json({ error: "brand is required when mode='brand'" }, { status: 400 });
      }
      batchMatches = await matchBrandLocked(requirements, brand, granularity);
    } else {
      const results = await Promise.all(
        requirements.map(async (r) => {
          try {
            return { id: r.id, result: await matchAI(r) };
          } catch (e) {
            return { id: r.id, result: { tier: "NO_MATCH" as const, matches: [], noMatchReason: `Matching failed: ${(e as Error).message}` } };
          }
        })
      );
      batchMatches = {};
      for (const { id, result } of results) batchMatches[id] = result;
    }

    return NextResponse.json({ batchMatches, mode, brand: brand || null, granularity });
  } catch (error) {
    console.error("Product match error:", error);
    return NextResponse.json({ error: "Matching failed" }, { status: 500 });
  }
}
