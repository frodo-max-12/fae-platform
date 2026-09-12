import { NextRequest, NextResponse } from "next/server";
import { parseJsonResponse } from "@/lib/parseJson";
import { askGemini } from "@/lib/gemini";
import { getCached, setCached } from "@/lib/db";
import { parseAttachment, combineSources } from "@/lib/attachmentParse";
import crypto from "node:crypto";

type InboundAttachment = {
  filename: string;
  mimeType: string;
  base64Data: string;
};

export async function POST(req: NextRequest) {
  try {
    const { emailBody, attachments } = (await req.json()) as {
      emailBody?: string;
      attachments?: InboundAttachment[];
    };

    if (!emailBody && (!attachments || attachments.length === 0)) {
      return NextResponse.json({ error: "Email body or attachments required" }, { status: 400 });
    }

    // ── Parse every attachment to plain text (PDF / Excel / CSV / text) ──
    const parsed = await Promise.all(
      (attachments || []).map(async (a) => {
        try {
          return await parseAttachment(a.filename, a.mimeType, Buffer.from(a.base64Data, "base64"));
        } catch (e) {
          return { filename: a.filename, mimeType: a.mimeType, text: `[parse error: ${(e as Error).message}]` };
        }
      })
    );

    const fullSource = combineSources(emailBody || "", parsed);

    // Cache on the concatenated source
    const cacheKey = "ext:" + crypto.createHash("sha1").update(fullSource).digest("hex");
    const cached = getCached(cacheKey);
    if (cached) return NextResponse.json({ extraction: cached });

    // ── PASS 1: Full FAE-grade extraction ──
    const firstPass = await askGemini(buildExtractionPrompt(fullSource), 4096);
    let extraction = parseJsonResponse(firstPass) as Record<string, unknown>;

    // ── PASS 2: Self-audit — catch missed specs / products / numbers ──
    try {
      const auditPrompt = buildAuditPrompt(fullSource, extraction);
      const auditText = await askGemini(auditPrompt, 2048);
      const audit = parseJsonResponse(auditText) as { missed?: string[]; corrected?: Record<string, unknown> };
      if (audit.corrected && typeof audit.corrected === "object") {
        extraction = { ...extraction, ...audit.corrected };
      }
    } catch (e) {
      console.warn("[extract] audit pass skipped:", (e as Error).message);
    }

    setCached(cacheKey, extraction);
    return NextResponse.json({ extraction });
  } catch (error) {
    console.error("Extract error:", error);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}

function buildExtractionPrompt(source: string): string {
  return `You are a SENIOR Field Application Engineer (FAE) at a components distributor in India. You have 20 years of experience reading customer RFQs, BOMs, and technical inquiries for electronic components. Your job is to extract EVERY requirement with 100% fidelity — nothing missed, nothing invented.

═══════════════════════════════════════════════
SOURCE (email body + any attachments merged):
═══════════════════════════════════════════════
${source.slice(0, 40000)}
═══════════════════════════════════════════════

YOUR MISSION
Extract every distinct product requirement. An "RFQ" may contain one MPN or fifty — you must find all of them. Customers write in many formats; be equally fluent in all:

FORMATS TO HANDLE
1. **Pipe tables**         | Part | Qty | Price |
2. **Markdown tables**     with --- separators
3. **Tab / space tables**  aligned columns
4. **CSV-style sheets**    (attachments)
5. **Key:Value pairs**     Qty: 100, Voltage: 24V
6. **Inline paragraphs**   "we need 500 of the X, rated at Y..."
7. **Bulleted lists**      -, *, •, 1., a.
8. **PDF datasheets**      often have multi-column layouts — read top-to-bottom, left-to-right
9. **Excel BOMs**          (already converted to CSV in source)
10. **Email threads**      with "On Mon, X wrote:" quoted blocks — extract from ALL messages
11. **Shorthand**          24VDC = 24V DC, M18 = M18 thread, NPN NC = NPN normally closed, SMA = DO-214AC

STEP-BY-STEP ANALYSIS (do this mentally, don't output it)
STEP 1 — Scan the entire source. Mark EVERY location where an MPN, quantity, spec, price, or product name appears.
STEP 2 — Identify how many DISTINCT products/line-items the customer is asking about. Each = its own requirement object. A BOM row with 10 parts = 10 requirement objects.
STEP 3 — For each product, gather every specification the customer mentions ANYWHERE in the source. Walk through every table row, every bullet, every sentence.
STEP 4 — Extract customer identity from signature, email header, or salutation.

SPECIFICATIONS TO CAPTURE (when present)
- Product type / category
- Reference MPN (exact)
- Reference manufacturer / brand
- Electrical ratings (voltage, current, power, frequency)
- Key functional spec (sensing distance, Rds(on), capacitance, etc. — varies by category)
- Package / housing / form factor
- IP rating / environmental protection
- Temperature range (operating + storage if given)
- Output type / configuration (PNP/NPN, push-pull, open-drain, etc.)
- Supply voltage
- Quantity (units)
- Target price / budget
- Delivery timeline
- Application / end-use context
- Certifications required (CE, UL, RoHS, AEC-Q100, etc.)
- Mounting / connection type
- Any other non-empty spec

RULES (absolute)
- Preserve the customer's EXACT words — no paraphrasing, no unit conversion.
- If a spec isn't present, use "" (empty string). NEVER invent values.
- Tables: read every single row and every column.
- Threads: walk through every quoted message — customers often refine requirements across replies.
- An RFQ with 5 part numbers returns 5 requirement objects (not 1 merged).
- Every MPN gets its own requirement — even if the customer grouped them.

OUTPUT — return ONLY this JSON, no prose, no markdown fences:
{
  "customerName": "<full name from signature or ''>",
  "customerCompany": "<company or ''>",
  "customerEmail": "<email from header/signature or ''>",
  "summary": "<2-3 sentences: what the customer wants, for what project, under what constraints>",
  "requirements": [
    {
      "id": "req-1",
      "referenceMPN": "<exact MPN or 'General — <product type>'>",
      "referenceCompany": "<brand/manufacturer>",
      "type": "<full product type description>",
      "sensingDistance": "<the KEY parametric spec for this part — use customer's exact words>",
      "ipRating": "<package/protection>",
      "tempRange": "<temp range>",
      "outputType": "<output/config>",
      "supplyVoltage": "<voltage>",
      "quantity": "<qty>",
      "targetPrice": "<price/budget>",
      "deliveryTimeline": "<delivery timeline>",
      "applicationContext": "<where/how it will be used>",
      "additionalNotes": "<every OTHER spec captured (certifications, mounting, freq, thermal, etc.) separated by '; '>"
    }
  ]
}`;
}

function buildAuditPrompt(source: string, firstExtraction: Record<string, unknown>): string {
  return `You are auditing an extraction for completeness. As a senior FAE, you know customers hide requirements in tables, footnotes, and thread replies. Your job: find anything the first pass missed and correct any errors.

SOURCE:
${source.slice(0, 40000)}

FIRST-PASS EXTRACTION:
${JSON.stringify(firstExtraction, null, 2).slice(0, 20000)}

Check:
1. Did we miss any distinct MPN or product line-item? (look for rows not extracted)
2. Did we miss any spec (temp, Vin, Iout, package, cert, mounting) mentioned in the source?
3. Did we misread any number? (quantity, voltage, price)
4. Did we capture the customer identity correctly?
5. Is every requirement's ID unique (req-1, req-2, …)?

If the first extraction is complete and correct, return: {"missed": [], "corrected": {}}

If you find issues, return the CORRECTED FULL extraction (same schema as the first pass) in "corrected". Only include "corrected" when you are making changes.

{
  "missed": ["<short note of what was missing>"],
  "corrected": <full corrected extraction object, OR omit if nothing to fix>
}`;
}
