import { NextRequest, NextResponse } from "next/server";
import { parseJsonResponse } from "@/lib/parseJson";
import { askGemini } from "@/lib/gemini";
import { getCached, setCached } from "@/lib/db";
import crypto from "node:crypto";

const MOUSER_STYLE_RULES = `Build a Mouser Electronics-style parametric comparison.
- The rows list is DYNAMIC: pick every parameter that is meaningful for the product category
  (e.g. for MOSFETs: Rds(on), Vds, Id, Qg, Gate Charge, Package, Vgs(th); for MCUs: Core, Flash, RAM,
  IO count, ADC channels, Clock speed, Package; for Relays: Contact Form, Contact Rating, Coil Voltage,
  Operate Time, Mechanical life, Dielectric strength; for Displays: Resolution, Diagonal, Interface,
  Brightness, Touch, Viewing angle; etc.).
- First rows MUST be: Manufacturer, Part Number / MPN, Product Category.
- Last rows MUST be: Unit Price (INR), Warranty.
- Include every spec the customer mentioned, plus every spec on the reference or our product that is
  relevant for a design-in decision.
- Minimum 10 rows when data supports it — cover the full parametric table like Mouser.
- DO NOT include lead time, delivery timeline, availability, or stock rows anywhere.
- For each row: spec, customerNeed, ourValue, verdict (MEETS|EXCEEDS|GAP|CLOSE|COMPATIBLE|APP-SAFE), note.
- totalSaving = quantity * max(0, customerTargetPrice - ourPrice).
- overallScore = 100 * (rows with verdict in {MEETS,EXCEEDS,COMPATIBLE,APP-SAFE}) / totalRows.`;

export async function POST(req: NextRequest) {
  try {
    const { customerSpecs, productSpecs, generateDraft } = await req.json();

    if (!customerSpecs || !productSpecs) {
      return NextResponse.json({ error: "Both specs are required" }, { status: 400 });
    }

    const cacheKey = "cmp:" + crypto.createHash("sha1").update(JSON.stringify({ customerSpecs, productSpecs, generateDraft: !!generateDraft })).digest("hex");
    const cached = getCached(cacheKey);
    if (cached) return NextResponse.json(cached);

    if (generateDraft) {
      const prompt = `You are a product comparison and email drafting engine for the company — an authorized ECIA/NEDA distributor of electronic components.

TASK 1 — SPEC COMPARISON:
Customer requirements / reference product:
${JSON.stringify(customerSpecs, null, 2)}

Our product offering (Company A authorized brand):
${JSON.stringify(productSpecs, null, 2)}

${MOUSER_STYLE_RULES}

TASK 2 — EMAIL DRAFT:
Compose a professional, technically authoritative email. No hedging — use "delivers", "ensures", "guarantees", "optimizes".

The email body MUST include a clean ASCII spec comparison table using box-drawing characters:

   ┌──────────────────────┬────────────────────────┬────────────────────────┬──────────┐
   │ PARAMETER            │ CUSTOMER REQUIREMENT   │ COMPANY A OFFER  │ STATUS   │
   ├──────────────────────┼────────────────────────┼────────────────────────┼──────────┤
   (every comparison row from TASK 1 here — NO lead time row)
   └──────────────────────┴────────────────────────┴────────────────────────┴──────────┘

Include: formal greeting, requirement acknowledgment, product introduction, comparison table, numbered technical advantages, commercial proposal summary, cost optimization calculation, offer 5 evaluation samples, sign-off from the company. Do NOT mention lead time or delivery timeline anywhere.

Return ONLY valid JSON:
{
  "rows": [{ "spec": "", "customerNeed": "", "ourValue": "", "verdict": "", "note": "" }],
  "totalSaving": 0,
  "overallScore": 0,
  "emailDraft": {
    "subject": "Technical Evaluation & Commercial Proposal — [our product] vs [reference] | Company A",
    "body": "...",
    "to": "${customerSpecs?.customerName || ""}",
    "cc": ""
  }
}`;

      const text = await askGemini(prompt, 2048);
      const result = parseJsonResponse(text);
      setCached(cacheKey, result);
      return NextResponse.json(result);
    }

    const prompt = `You are a product comparison engine for electronic components, working like Mouser Electronics' parametric comparison tool.

Customer requirements / reference product:
${JSON.stringify(customerSpecs, null, 2)}

Our product offering (Company A authorized brand):
${JSON.stringify(productSpecs, null, 2)}

${MOUSER_STYLE_RULES}

For each row:
- spec: specification name
- customerNeed: customer requirement or reference product value
- ourValue: what Company A offers
- verdict: one of MEETS | EXCEEDS | GAP | CLOSE | COMPATIBLE | APP-SAFE
- note: brief explanation (or empty string)

Return ONLY valid JSON:
{
  "rows": [{ "spec": "", "customerNeed": "", "ourValue": "", "verdict": "", "note": "" }],
  "totalSaving": 0,
  "overallScore": 0
}`;

    const text = await askGemini(prompt, 2048);
    const comparison = parseJsonResponse(text);
    setCached(cacheKey, comparison);
    return NextResponse.json(comparison);
  } catch (error) {
    console.error("Compare error:", error);
    return NextResponse.json({ error: "Comparison failed" }, { status: 500 });
  }
}
