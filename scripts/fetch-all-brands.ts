/**
 * Fetch EVERY product from ALL 54 Company A dealer brands.
 * Primary: Website crawling (Jina Reader for JS sites, curl for static).
 * Then: Claude Haiku extracts products from the crawled content.
 * Products are MERGED — existing products are NEVER lost.
 *
 * Usage:
 *   npx tsx scripts/fetch-all-brands.ts              → fetch all brands
 *   npx tsx scripts/fetch-all-brands.ts --empty      → only brands with 0 products
 *   npx tsx scripts/fetch-all-brands.ts --low 10     → brands with < 10 products
 *   npx tsx scripts/fetch-all-brands.ts --brand "Knitter-Switch"  → one brand
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync, spawn } from "node:child_process";
import { resolve, join } from "node:path";

// ── Load .env.local ──
for (const file of [".env.local", ".env"]) {
  try {
    const raw = readFileSync(resolve(process.cwd(), file), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}

// ── All 54 Company A dealer brands + product page hints for problematic sites ──
const BRANDS: Record<string, { website: string; products: string; productPages?: string[] }> = {
  "Schurter":             { website: "https://www.schurter.com", products: "Fuses, IEC Connectors, Circuit Breakers, Switches, EMC filters, Input Systems", productPages: ["https://www.schurter.com/en/products-and-solutions/catalog"] },
  "SETfuse":              { website: "https://www.setfuse.com", products: "Thermal cutoffs, Over-temperature protection, PTC, TVS, Varistors" },
  "Nanjing Electric":     { website: "https://www.ntcshiheng.com", products: "NTC Thermistor, PTC Thermistor, Varistor, Temperature sensors" },
  "Cooltron":             { website: "https://www.cooltron.com", products: "AC & DC fans/blowers, EC Axial Fan" },
  "MEGA":                 { website: "https://cnmegatech.com", products: "AC & DC Axial fan, AC & DC Blowers, EC Axial Fan" },
  "CDIL":                 { website: "https://www.cdil.com", products: "Diodes, Transistors, Rectifiers, Regulators, MOSFET, TRIAC, SCR", productPages: ["https://www.cdil.com/products"] },
  "Rectron":              { website: "https://www.rectron.com", products: "TVS Diode, Bridge Rectifier, ESD Diode, Schottky Diode, MOSFET" },
  "Diotec":               { website: "https://diotec.com", products: "Schottky Diode, SiC Schottky, Zener, Transistor, MOSFET", productPages: ["https://diotec.com/en/products.html", "https://diotec.com/en/products/diodes.html", "https://diotec.com/en/products/transistors.html", "https://diotec.com/en/products/rectifier-diodes.html"] },
  "SMC Diode Solutions":  { website: "https://www.smc-diodes.com", products: "Diodes, Rectifiers, MOSFET, ESD Protection, Thyristor", productPages: ["https://www.smc-diodes.com/products.html"] },
  "Goford Semiconductor": { website: "http://gofordsemi.com", products: "Trench MOSFET, Planar MOSFET, Super Junction MOSFET" },
  "NexGen Power":         { website: "https://www.nexgenpowersystems.com", products: "GaN transistors, GaN power ICs", productPages: ["https://www.nexgenpowersystems.com/products/"] },
  "HY Group":             { website: "https://www.hygroup.com.tw", products: "Rectifier, Bridge Rectifier, TVS Diode, Zener Diode, MOSFET", productPages: ["https://www.hygroup.com.tw/en/product"] },
  "UTC Unisonic":         { website: "https://en.unisonic.com.tw", products: "Power Management ICs, Transistors, MOSFET, IGBT, TRIAC, SCR, Diode" },
  "Knitter-Switch":       { website: "https://www.knitter-switch.com", products: "Toggle, Pushbutton, Tact, Slide, Rotary, Rocker, DIP, Keylock Switches", productPages: ["https://www.knitter-switch.com/en/products-2/", "https://knitter-switch.com/en/product-category/toggle_switches", "https://knitter-switch.com/en/product-category/pushbutton-switches-illuminated-2", "https://knitter-switch.com/en/product-category/tact-multifunction-switches", "https://knitter-switch.com/en/product-category/rocker-switches", "https://knitter-switch.com/en/product-category/slide-switches", "https://knitter-switch.com/en/product-category/rotary-thumbwheel-switches", "https://knitter-switch.com/en/product-category/dip-switches", "https://knitter-switch.com/en/product-category/keylock-switches"] },
  "Diptronics":           { website: "http://www.dip.com.tw", products: "DIP, TACT, Rotary, Slide Switches", productPages: ["http://www.dip.com.tw/en/product.php"] },
  "Zhejiang Jinja":       { website: "http://www.jinjiaelc.com", products: "USB-C, Phone jack, RJ45, USB, DC Power Jack", productPages: ["http://www.jinjiaelc.com/product.html"] },
  "Greenconn":            { website: "https://www.greenconn.com", products: "Board-to-board, wire-to-board, I/O connectors" },
  "Anyconn":              { website: "https://www.anyconn.tw", products: "Board-to-board, Terminal block, I/O connector" },
  "Amphenol":             { website: "https://www.amphenol-in.com", products: "Board-to-Board, Circular, IC sockets, I/O connector" },
  "Degson":               { website: "https://www.degson.com", products: "Terminal Blocks, Circular Connectors, Din-Rail TB" },
  "Phoenix Contact":      { website: "https://www.phoenixcontact.com", products: "PCB connectors, Terminal blocks, Cables", productPages: ["https://www.phoenixcontact.com/en-us/products"] },
  "Antenk":               { website: "https://www.antenk.com", products: "PCB Connectors, Battery holders, Pin Headers" },
  "KLS Electronic":       { website: "https://www.klsele.com", products: "Switches, Connectors, Antennas, Ethernet" },
  "TE Connectivity":      { website: "https://www.te.com", products: "Connectors, Relays, Sensors, Cable, Antennas" },
  "Ze Ming Lang Xi":      { website: "https://www.micro-transformer.com", products: "Current transformer", productPages: ["https://www.micro-transformer.com/products/"] },
  "3L Coils":             { website: "https://www.3lcoils.com", products: "Inductors, Power choke, Wireless charger coils", productPages: ["https://www.3lcoils.com/products/"] },
  "Coilmaster":           { website: "https://www.coilmaster.com.tw", products: "Automotive inductor, Power inductor", productPages: ["https://www.coilmaster.com.tw/en/product"] },
  "Jackcon":              { website: "https://www.jackcon.com.tw", products: "Aluminum Electrolytic, Ceramic, Film Capacitor", productPages: ["https://www.jackcon.com.tw/en/product/"] },
  "PSA":                  { website: "http://www.pdc.com.tw", products: "MLCC, Chip Resistor, Inductor" },
  "Hokuriku":             { website: "https://www.hdk.co.jp", products: "Chip Resistor, NTC Thermistor, Resistor", productPages: ["https://www.hdk.co.jp/english/products/index_e.htm"] },
  "Song Chuan":           { website: "https://songchuanusa.com", products: "Electromechanical Relays, Relay Sockets" },
  "Hongfa":               { website: "https://www.hongfa.com", products: "Relays, EV contactor, Current Sensors" },
  "Standex Electronics":  { website: "https://standexelectronics.com", products: "Relays, Optocoupler, Reed Switches" },
  "GigaDevice":           { website: "https://www.gigadevice.com", products: "Flash Memory, 32-bit MCU, Power, Motor Drivers" },
  "Intelligent Memory":   { website: "https://www.intelligentmemory.com", products: "DRAM, NAND Flash" },
  "Fudan Micro":          { website: "https://www.fm-chips.com", products: "EEPROM, SPI NOR/NAND Flash, Microcontroller" },
  "Netsol":               { website: "http://www.netsol.co.kr", products: "STT-MRAM, Asynchronous SRAM", productPages: ["http://www.netsol.co.kr/en/product/"] },
  "Megawin":              { website: "https://www.megawin.com", products: "8051 & ARM Cortex-M0+ MCU", productPages: ["https://www.megawin.com/en/product/"] },
  "Weltrend":             { website: "http://www.weltrend.com", products: "USB PD, MCU, Motor Driver, PMIC" },
  "CXW":                  { website: "https://www.cxwic.net", products: "USB PD, DC/DC Converter, PMIC" },
  "Silergy":              { website: "https://www.silergy.com", products: "Battery mgmt, DC-DC, AC-DC, Motor driver", productPages: ["https://www.silergy.com/products/"] },
  "Clafpower":            { website: "https://www.clafpower.com", products: "DC-DC, AC-DC converters" },
  "SGMicro":              { website: "https://www.sg-micro.com", products: "LDO, Amplifier, LED driver, Comparator", productPages: ["https://www.sg-micro.com/product"] },
  "Novosens":             { website: "https://www.novosns.com", products: "CAN tx, Amplifiers, Gate Drivers, Pressure sensors" },
  "TDK (Micronas)":       { website: "https://www.micronas.tdk.com", products: "Hall Sensors, Angle sensor, Current Sensing ICs" },
  "Taimi":                { website: "https://www.uttransducer.com", products: "Ceramic Pressure, Ultrasonic sensor" },
  "Indie Semiconductor":  { website: "https://www.indiesemi.com", products: "Wireless Charging, Lighting, ADAS" },
  "Socle Technology":     { website: "https://www.socle-tech.com", products: "Wi-Fi & BLE Module, Sensor modules", productPages: ["https://www.socle-tech.com/product.php"] },
  "Sonytek":              { website: "https://www.sonytek.com", products: "LCD, TFT Display, Touch Panel", productPages: ["https://www.sonytek.com/products.html"] },
  "DWIN":                 { website: "https://www.dwin-global.com", products: "HMI LCD Modules, TFT LCD with RTP/CTP" },
  "Kingstate":            { website: "https://www.kingstate.com.tw", products: "Piezo / Magnetic Buzzer, Speaker, Microphone", productPages: ["https://www.kingstate.com.tw/en/product/"] },
  "Seoul Semiconductor":  { website: "https://www.seoulsemicon.com", products: "Automotive & Indoor/Outdoor LEDs", productPages: ["https://www.seoulsemicon.com/en/product/"] },
  "Dapu":                 { website: "https://www.dptel.com", products: "RTC, Ethernet PHY, Crystal Oscillator", productPages: ["https://www.dptel.com/products/"] },
  "Arduino":              { website: "https://www.arduino.cc", products: "Project Kits for Robotics" },
};

// ──────────────────── Helpers ────────────────────

const CATALOG_DIR = join(process.cwd(), "data", "catalog");
const INDEX_PATH = join(CATALOG_DIR, "index.json");

function slugify(b: string): string {
  return b.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

interface CatalogProduct {
  mpn: string; series: string; category: string; keySpec: string; package: string;
  tempRange: string; output: string; voltage: string; notes: string; sourceUrl: string;
  specs: Record<string, string>;
}
interface BrandCatalog {
  brand: string; website: string; lastFetched: string; sourceUrls: string[];
  products: CatalogProduct[];
}

function readCatalog(brand: string): BrandCatalog | null {
  try { return JSON.parse(readFileSync(join(CATALOG_DIR, slugify(brand) + ".json"), "utf8")); }
  catch { return null; }
}

function writeCatalog(cat: BrandCatalog) {
  mkdirSync(CATALOG_DIR, { recursive: true });
  writeFileSync(join(CATALOG_DIR, slugify(cat.brand) + ".json"), JSON.stringify(cat, null, 2), "utf8");
  let idx: Record<string, unknown> = {};
  try { idx = JSON.parse(readFileSync(INDEX_PATH, "utf8")); } catch {}
  idx[cat.brand] = { file: `data/catalog/${slugify(cat.brand)}.json`, lastFetched: cat.lastFetched, productCount: cat.products.length, website: cat.website };
  writeFileSync(INDEX_PATH, JSON.stringify(idx, null, 2), "utf8");
}

// ──────────────────── Website Fetching ────────────────────

function htmlToText(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s{2,}/g, " ").trim();
}

function fetchCurl(url: string, cap = 30000): string {
  try {
    return htmlToText(execSync(`curl -sL --max-time 15 -H "User-Agent: Mozilla/5.0" "${url}"`,
      { maxBuffer: 5 * 1024 * 1024, timeout: 20000 }).toString()).slice(0, cap);
  } catch { return ""; }
}

function fetchJina(url: string, cap = 40000): string {
  try {
    const t = execSync(`curl -sL --max-time 25 "https://r.jina.ai/${url}" -H "X-Return-Format: markdown"`,
      { maxBuffer: 5 * 1024 * 1024, timeout: 30000 }).toString();
    if (t.includes('"code":429')) return "";
    return t.slice(0, cap);
  } catch { return ""; }
}

function crawlBrandWebsite(brand: string, info: { website: string; products: string; productPages?: string[] }): { content: string; pages: number } {
  const CAP = 80000;
  let content = "";
  let pages = 0;

  // 1. Fetch landing page via Jina (handles JS)
  console.log(`    → Fetching landing page...`);
  const landing = fetchJina(info.website, 15000);
  if (landing.length > 500) { content += landing + "\n"; pages++; }

  // 2. Fetch explicit product pages (brand-specific URLs we know work)
  if (info.productPages) {
    for (const url of info.productPages) {
      if (content.length >= CAP) break;
      console.log(`    → Fetching ${url.replace(info.website, '...')}...`);
      const page = fetchJina(url, 12000);
      if (page.length > 300) { content += `\n--- PAGE: ${url} ---\n${page}\n`; pages++; }
    }
  }

  // 3. Try common product page paths
  const base = info.website.replace(/\/+$/, "");
  const paths = ["/products", "/products-2", "/product", "/en/products", "/en/product",
    "/catalog", "/product-list", "/product-center", "/all-products"];
  for (const p of paths) {
    if (content.length >= CAP) break;
    const url = base + p;
    // Skip if we already fetched this via productPages
    if (info.productPages?.some(pp => pp.includes(p))) continue;
    const page = fetchJina(url, 8000);
    if (page.length > 500) { content += `\n--- PAGE: ${url} ---\n${page}\n`; pages++; }
  }

  // 4. Deep crawl: extract category links from content and follow them
  if (content.length < 10000) {
    console.log(`    → Deep crawling category links...`);
    const domain = new URL(info.website).hostname;
    const linkRe = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
    const seen = new Set<string>();
    let m;
    while ((m = linkRe.exec(content)) !== null) {
      const url = m[2];
      if (!url.includes(domain) || seen.has(url)) continue;
      if (/product|categor|series/i.test(url) && !/#/.test(url)) {
        seen.add(url);
      }
    }
    for (const url of Array.from(seen).slice(0, 10)) {
      if (content.length >= CAP) break;
      const page = fetchJina(url, 6000);
      if (page.length > 300) { content += `\n--- SUBPAGE: ${url} ---\n${page}\n`; pages++; }
    }
  }

  return { content: content.slice(0, CAP), pages };
}

// ──────────────────── LLM Extraction ────────────────────

function callClaude(prompt: string): Promise<string> {
  // Cap prompt to 50K to avoid stdin EOF errors on very large prompts
  const cappedPrompt = prompt.slice(0, 50000);
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p", "--model", "claude-haiku-4-5-20251001", "--output-format", "text"], {
      stdio: ["pipe", "pipe", "pipe"], timeout: 120000,
    });
    let stdout = "", stderr = "";
    child.stdout.on("data", (c: Buffer) => { stdout += c.toString(); });
    child.stderr.on("data", (c: Buffer) => { stderr += c.toString(); });
    child.on("error", (err) => reject(new Error(`CLI failed: ${err.message}`)));
    child.on("close", (code) => {
      if (code !== 0) { reject(new Error(`CLI exited ${code}: ${stderr.slice(0, 300)}`)); return; }
      const text = stdout.trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      if (!text) { reject(new Error("Empty response")); return; }
      resolve(text);
    });
    child.stdin.write(cappedPrompt);
    child.stdin.end();
  });
}

async function callGroq(prompt: string, maxTokens = 8192): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not set");

  // Try multiple models in order of preference
  const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"];
  let lastErr = "";

  for (const model of models) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt.slice(0, 25000) }],
          max_tokens: maxTokens,
          temperature: 0.2,
          response_format: { type: "json_object" },
        }),
      });

      if (r.status === 429) {
        lastErr = `Groq ${model} rate limited`;
        console.log(`    → ${lastErr}, trying next model...`);
        continue;
      }
      if (!r.ok) {
        lastErr = `Groq ${model} HTTP ${r.status}`;
        continue;
      }

      const data = await r.json() as { choices?: { message?: { content?: string } }[] };
      const text = data?.choices?.[0]?.message?.content;
      if (!text) { lastErr = `Groq ${model} empty`; continue; }
      console.log(`    → Groq ${model} responded`);
      return text;
    } catch (e) {
      lastErr = (e as Error).message;
    }
  }
  throw new Error(`All Groq models failed: ${lastErr}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function callLLM(prompt: string): Promise<string> {
  // Try Claude CLI first (with retry), fall back to Groq
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`    → Retrying Claude CLI (attempt ${attempt + 1})...`);
        await sleep(5000);
      }
      return await callClaude(prompt);
    } catch (e) {
      const msg = (e as Error).message.slice(0, 80);
      if (attempt === 0) console.log(`    → Claude CLI failed (${msg}), retrying...`);
      else console.log(`    → Claude CLI retry failed (${msg}), trying Groq...`);
    }
  }
  return await callGroq(prompt);
}

function parseJson(text: string): unknown {
  // Strip markdown fences
  let clean = text.replace(/^```(?:json)?\s*\n?/gi, "").replace(/\n?```\s*$/gi, "").trim();
  try { return JSON.parse(clean); } catch {}
  // Try extracting JSON object
  const m = clean.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch {}
    // Try fixing truncated JSON — close any open arrays/objects
    let fixed = m[0];
    // Count open braces/brackets
    const opens = (fixed.match(/\{/g) || []).length;
    const closes = (fixed.match(/\}/g) || []).length;
    const openBr = (fixed.match(/\[/g) || []).length;
    const closeBr = (fixed.match(/\]/g) || []).length;
    // Remove trailing comma if any
    fixed = fixed.replace(/,\s*$/, "");
    // Close unclosed brackets/braces
    for (let i = 0; i < openBr - closeBr; i++) fixed += "]";
    for (let i = 0; i < opens - closes; i++) fixed += "}";
    try { return JSON.parse(fixed); } catch {}
  }
  throw new Error("Could not parse JSON");
}

function buildPrompt(brand: string, info: { website: string; products: string }, websiteContent: string): string {
  return `You are a product catalog database for electronic components. Your job is to output a JSON catalog.

BRAND: "${brand}" (${info.website})
PRODUCT CATEGORIES: ${info.products}

${websiteContent.length > 1000 ? `Here is content crawled from their website. Use it to identify product series, model numbers, and part numbers. ALSO use your own knowledge of ${brand}'s product line to fill in any products not visible in the crawled content.

WEBSITE CONTENT:
${websiteContent.slice(0, 70000)}` : `Their website was not accessible. Use your knowledge of ${brand}'s complete product catalog.`}

YOUR TASK:
Output a COMPLETE JSON catalog of ${brand} products. Combine what you see on the website WITH your knowledge of this manufacturer.

RULES:
1. List EVERY product series and individual MPN you know for ${brand}.
2. If the website shows series names (e.g. "MTA series"), list the series AND at least 3-5 individual part numbers per series.
3. Cover ALL categories: ${info.products}
4. Include full specs for each product.
5. Only ${brand} products — no other brands.
6. DO NOT say "I cannot find products" — you KNOW this manufacturer. Output what you know.
7. Output ONLY valid JSON — no prose, no explanation, no markdown fences.

JSON FORMAT:
{"products":[{"mpn":"<part number>","series":"<series>","category":"<e.g. Toggle Switch>","keySpec":"<headline spec>","package":"<package>","tempRange":"","output":"","voltage":"","notes":"","sourceUrl":"","specs":{"<spec>":"<value>"}}]}

Output the JSON now:`;
}

// ──────────────────── Fetch + Merge ────────────────────

async function fetchBrand(brand: string, info: { website: string; products: string; productPages?: string[] }): Promise<{ count: number; added: number; pages: number }> {
  // Step 1: Crawl website
  const { content, pages } = crawlBrandWebsite(brand, info);
  console.log(`    → Got ${content.length} chars from ${pages} pages`);

  // Step 2: Ask Claude to extract products from website content
  const prompt = buildPrompt(brand, info, content);
  console.log(`    → Asking LLM to extract products...`);
  const raw = await callLLM(prompt);
  const parsed = parseJson(raw) as { products?: CatalogProduct[] };

  if (!Array.isArray(parsed.products) || parsed.products.length === 0) {
    throw new Error(`No products extracted (response: ${raw.slice(0, 100)})`);
  }

  // De-dupe
  const byMpn = new Map<string, CatalogProduct>();
  for (const p of parsed.products) {
    if (!p.mpn?.trim()) continue;
    const k = p.mpn.trim().toUpperCase();
    if (!byMpn.has(k)) {
      byMpn.set(k, {
        mpn: p.mpn, series: p.series || "", category: p.category || "",
        keySpec: p.keySpec || "", package: p.package || "",
        tempRange: p.tempRange || "", output: p.output || "",
        voltage: p.voltage || "", notes: p.notes || "",
        sourceUrl: p.sourceUrl || "",
        specs: (p.specs && typeof p.specs === "object") ? { ...p.specs } : {},
      });
    }
  }

  // Merge — NEVER lose existing products
  const prev = readCatalog(brand);
  const merged = new Map<string, CatalogProduct>();
  if (prev) {
    for (const p of prev.products) merged.set(p.mpn.trim().toUpperCase(), p);
  }
  let addedCount = 0;
  for (const [k, p] of byMpn) {
    if (!merged.has(k)) addedCount++;
    merged.set(k, p);
  }

  const catalog: BrandCatalog = {
    brand, website: info.website,
    lastFetched: new Date().toISOString(),
    sourceUrls: [info.website, ...(info.productPages || [])],
    products: Array.from(merged.values()),
  };
  writeCatalog(catalog);
  return { count: catalog.products.length, added: addedCount, pages };
}

// ──────────────────── Main ────────────────────

async function main() {
  const args = process.argv.slice(2);
  const emptyOnly = args.includes("--empty");
  const lowIdx = args.indexOf("--low");
  const lowThreshold = lowIdx >= 0 ? parseInt(args[lowIdx + 1]) || 10 : 0;
  const brandIdx = args.indexOf("--brand");
  const onlyBrand = brandIdx >= 0 ? args[brandIdx + 1] : null;

  let brands = Object.entries(BRANDS);

  if (onlyBrand) {
    brands = brands.filter(([b]) => b.toLowerCase() === onlyBrand.toLowerCase());
    if (brands.length === 0) { console.error(`Brand "${onlyBrand}" not found`); process.exit(1); }
  } else if (emptyOnly) {
    brands = brands.filter(([b]) => {
      const cat = readCatalog(b);
      return !cat || cat.products.length === 0;
    });
  } else if (lowThreshold > 0) {
    brands = brands.filter(([b]) => {
      const cat = readCatalog(b);
      return !cat || cat.products.length < lowThreshold;
    });
  }

  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║  Company A Catalog Fetch — ${String(brands.length).padEnd(3)} brands to process             ║`);
  console.log(`╚══════════════════════════════════════════════════════╝\n`);

  let succeeded = 0, failed = 0, totalProducts = 0, totalAdded = 0;

  for (let i = 0; i < brands.length; i++) {
    const [brand, info] = brands[i];
    const progress = `[${i + 1}/${brands.length}]`;
    console.log(`\n${progress} ── ${brand} ──`);

    try {
      const result = await fetchBrand(brand, info);
      succeeded++;
      totalProducts += result.count;
      totalAdded += result.added;
      console.log(`    ✔ ${result.count} products (+${result.added} new) from ${result.pages} pages`);
    } catch (e) {
      failed++;
      console.log(`    ✘ FAILED: ${(e as Error).message.slice(0, 100)}`);
    }
  }

  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║  DONE                                                ║`);
  console.log(`║  Succeeded: ${String(succeeded).padEnd(5)} Failed: ${String(failed).padEnd(22)}║`);
  console.log(`║  Total products: ${String(totalProducts).padEnd(13)} New added: ${String(totalAdded).padEnd(10)}║`);
  console.log(`╚══════════════════════════════════════════════════════╝\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
