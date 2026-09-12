/**
 * Builds a BrandCatalog by deep-fetching the dealer's website + searching
 * the web, then asking the LLM to extract a clean structured product list.
 * Called by /api/catalog/refresh and the daily scripts/refresh-catalog job.
 */

import { askGemini } from "@/lib/gemini";
import { parseJsonResponse } from "@/lib/parseJson";
import { fetchDealerFull } from "@/lib/dealerFetch";
import { OUR_DEALERS } from "@/lib/dealers";
import {
  BrandCatalog, CatalogProduct, readBrandCatalog, writeBrandCatalog, diffCatalogs,
} from "@/lib/catalogStore";

function categoryHints(brand: string): string[] {
  const info = OUR_DEALERS[brand as keyof typeof OUR_DEALERS];
  if (!info) return [];
  return info.products.split(",").map((s) => s.trim()).filter(Boolean);
}

function buildExtractionPrompt(
  brand: string,
  website: string,
  corpus: string,
  chunkInfo: { index: number; total: number }
): string {
  return `You are a catalog-extraction engine for Company A. Your job: read the dealer sources below (chunk ${chunkInfo.index + 1}/${chunkInfo.total}) and extract EVERY distinct product, with FULL Mouser-style attribute coverage, for brand "${brand}".

BRAND: ${brand}
WEBSITE: ${website}

DEALER SOURCES:
${corpus}

EXTRACTION RULES
1. Output EVERY distinct product / MPN / part number / series visible in THIS chunk. Do not skip any. Include obscure MPNs too.
2. If a listing shows a series with many variants (e.g. "XYZ-01, XYZ-02..."), output EACH variant as its own row.
3. You MAY additionally include well-known catalog parts of ${brand} that you know exist in its public catalog even if not in this chunk.
4. NEVER output a part from another brand. NEVER invent a fictitious MPN.
5. No upper limit on product count — list everything.

SPEC COVERAGE (Mouser-style)
For each MPN, capture EVERY parametric attribute that applies to that part category. Think like a Mouser product page: all spec table rows.

Examples by category (use whichever keys apply, and ADD more as the datasheet dictates):
• Discrete (Diode/MOSFET/BJT): Vf, If, Vrrm, Vceo, Vce(sat), Vds, Vgs(th), Id (continuous/pulsed), Rds(on), Pd, tr, tf, Qg, Ciss, Coss, Crss, reverse recovery, thermal resistance
• MCU/MPU: core, clock speed, flash, RAM, EEPROM, I/O pins, ADC (bits/channels), DAC, timers, comm interfaces (UART/SPI/I²C/CAN/USB), operating voltage, operating current, sleep current
• Memory: memory type, size, organisation, interface, access time, endurance, retention
• Sensor: measurand, range, accuracy, resolution, sensitivity, interface, supply voltage
• Passive (R/L/C): resistance / inductance / capacitance, tolerance, voltage rating, current rating, temp coefficient, ESR, dielectric
• Connector: number of positions, pitch, current rating, voltage rating, mating cycles, contact plating, mounting
• Relay / Switch: contact form, coil voltage, contact rating (A @ V), insulation resistance, operate/release time, mechanical life
• Fuse / Protection: current rating, voltage rating, breaking capacity, interrupt rating, time-current characteristic
• Opto / LED: wavelength, luminous intensity, viewing angle, forward current, forward voltage
• Power / Regulator: input voltage range, output voltage, output current, efficiency, switching frequency, topology
• ALL: package, mounting (SMD/TH), operating temp range, storage temp, RoHS compliance, AEC-Q qualification, features, applications

DO NOT include: lead time, price, stock/availability, MOQ, RoHS certification dates, distributor-only fields.

Put the 5 most important parametric values in the TOP-LEVEL fields (keySpec, package, tempRange, output, voltage). Put ALL OTHER specs in "specs" as a flat key→short-value map. Keep values short ("50 V", "30 A", "1 MHz"). Use "" when unknown — don't fabricate.

OUTPUT — return ONLY this JSON, no prose:
{
  "products": [
    {
      "mpn": "<exact part number>",
      "series": "<product line/series name>",
      "category": "<product category e.g. 'Schottky Diode', 'ARM Cortex-M0 MCU'>",
      "keySpec": "<headline parametric>",
      "package": "<package / form factor>",
      "tempRange": "<operating temp or ''>",
      "output": "<output/config or ''>",
      "voltage": "<voltage rating or ''>",
      "notes": "<any extra useful note or ''>",
      "sourceUrl": "<URL or '' if knowledge-based>",
      "specs": {
        "<spec label>": "<short value>",
        "<spec label>": "<short value>"
      }
    }
  ]
}`;
}

// Split a corpus into ~25k-char chunks at source boundaries so the LLM sees whole pages.
function chunkCorpus(pages: Array<{ url: string; text: string }>, charLimit = 25000): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const p of pages) {
    const block = `--- SOURCE: ${p.url} ---\n${p.text}\n\n`;
    if (current.length + block.length > charLimit && current.length > 0) {
      chunks.push(current);
      current = "";
    }
    if (block.length > charLimit) {
      // single page is huge — split it hard
      for (let i = 0; i < block.length; i += charLimit) {
        chunks.push(block.slice(i, i + charLimit));
      }
    } else {
      current += block;
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks.length > 0 ? chunks : [""];
}

export interface BuildResult {
  catalog: BrandCatalog;
  added: string[];
  removed: string[];
  sourceCount: number;
}

export async function buildBrandCatalog(brand: string): Promise<BuildResult> {
  const info = OUR_DEALERS[brand as keyof typeof OUR_DEALERS];
  if (!info) throw new Error(`Unknown brand "${brand}"`);

  const hints = categoryHints(brand);
  const pages = await fetchDealerFull(info.website, brand, hints);

  // SINGLE Groq call per brand (token-budget-constrained).
  // Build one dense corpus capped at ~22k chars so the whole request fits comfortably
  // in daily token budget, yet still covers the broadest spread of pages.
  const SINGLE_CALL_CAP = 22000;
  // Priority: keep sitemap-discovered pages first (richest), then the rest.
  // Collapse each page to its first 3500 chars to diversify coverage over many pages.
  const PER_PAGE_SLICE = 3500;
  let corpus = "";
  const sourceUrls: string[] = [];
  for (const p of pages) {
    if (corpus.length >= SINGLE_CALL_CAP) break;
    const block = `--- SOURCE: ${p.url} ---\n${p.text.slice(0, PER_PAGE_SLICE)}\n\n`;
    corpus += block;
    sourceUrls.push(p.url);
  }
  corpus = corpus.slice(0, SINGLE_CALL_CAP);
  console.log(`[catalogBuild] ${brand}: ${pages.length} pages → 1 extraction call (${corpus.length} chars)`);

  let products: CatalogProduct[] = [];
  if (corpus.length > 200) {
    try {
      const prompt = buildExtractionPrompt(brand, info.website, corpus, { index: 0, total: 1 });
      const text = await askGemini(prompt, 6144);
      const parsed = parseJsonResponse(text) as { products?: CatalogProduct[] };
      if (Array.isArray(parsed.products)) {
        products.push(...parsed.products);
        console.log(`[catalogBuild] ${brand}: extracted ${parsed.products.length} products`);
      }
    } catch (e) {
      console.error(`[catalogBuild] ${brand}: extraction failed — ${(e as Error).message}`);
    }
  }

  // De-dupe by MPN, merging specs bags so later chunks can enrich earlier rows.
  const byMpn = new Map<string, CatalogProduct>();
  for (const p of products) {
    if (!p.mpn || !p.mpn.trim()) continue;
    const k = p.mpn.trim().toUpperCase();
    const normalized: CatalogProduct = {
      mpn: p.mpn, series: p.series || "", category: p.category || "",
      keySpec: p.keySpec || "", package: p.package || "",
      tempRange: p.tempRange || "", output: p.output || "",
      voltage: p.voltage || "", notes: p.notes || "",
      sourceUrl: p.sourceUrl || "",
      specs: (p.specs && typeof p.specs === "object") ? { ...p.specs } : {},
    };
    const existing = byMpn.get(k);
    if (!existing) {
      byMpn.set(k, normalized);
    } else {
      // Prefer filled values; merge specs (existing wins on conflict — first-seen stays stable)
      for (const field of ["series","category","keySpec","package","tempRange","output","voltage","notes","sourceUrl"] as const) {
        if (!existing[field] && normalized[field]) existing[field] = normalized[field];
      }
      for (const [k2, v2] of Object.entries(normalized.specs)) {
        if (!existing.specs[k2] && v2) existing.specs[k2] = v2;
      }
    }
  }
  products = Array.from(byMpn.values());

  const prev = await readBrandCatalog(brand);
  const next: BrandCatalog = {
    brand,
    website: info.website,
    lastFetched: new Date().toISOString(),
    sourceUrls: pages.map((p) => p.url),
    products,
  };
  await writeBrandCatalog(next);
  const { added, removed } = diffCatalogs(prev, next);
  return { catalog: next, added, removed, sourceCount: pages.length };
}
