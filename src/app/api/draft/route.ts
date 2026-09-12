import { NextRequest, NextResponse } from "next/server";
import { parseJsonResponse } from "@/lib/parseJson";
import { askGemini } from "@/lib/gemini";
import { getCached, setCached } from "@/lib/db";
import crypto from "node:crypto";

export async function POST(req: NextRequest) {
  try {
    const { comparison, product, advantages, customerSpecs } = await req.json();
    const cacheKey = "draft:" + crypto.createHash("sha1").update(JSON.stringify({ comparison, product, advantages, customerSpecs })).digest("hex");
    const cached = getCached(cacheKey);
    if (cached) return NextResponse.json(cached);

    const prompt = `You are an email composition agent for a Field Application Engineer at Company A Pvt. Ltd., a premier electronic components distributor in India.

Compose a professional, technically authoritative comparison email using strong engineering language.

Customer requirements: ${JSON.stringify(customerSpecs)}
Product offered: ${JSON.stringify(product)}
Comparison results: ${JSON.stringify(comparison)}
Product advantages: ${advantages}

The email MUST include these sections in order:

1. FORMAL GREETING — Address customer by name professionally
2. REQUIREMENT ACKNOWLEDGMENT — Reference their exact requirement with technical precision
3. PRODUCT INTRODUCTION — Introduce our alternative with confidence, using engineering terminology
4. SPECIFICATION COMPARISON TABLE — This is the MOST IMPORTANT part. Format as a clean ASCII table:

   ┌──────────────────────┬────────────────────────┬────────────────────────┬──────────┐
   │ PARAMETER            │ CUSTOMER REQUIREMENT   │ COMPANY A OFFER  │ STATUS   │
   ├──────────────────────┼────────────────────────┼────────────────────────┼──────────┤
   │ Manufacturer         │ ...                    │ ...                    │ ...      │
   │ Part Number          │ ...                    │ ...                    │ ...      │
   │ (all specs)          │ ...                    │ ...                    │ ...      │
   └──────────────────────┴────────────────────────┴────────────────────────┴──────────┘

   Use box-drawing characters for the table. Include ALL comparison rows.
   Status column: MEETS / EXCEEDS / COMPATIBLE / GAP

5. TECHNICAL ADVANTAGES — Numbered list with strong engineering language:
   - Use terms like "superior thermal dissipation", "enhanced parametric margin", "robust environmental compliance"
   - Highlight technical superiority with specific numbers

6. COMMERCIAL PROPOSAL — Clean summary:
   Product: [company] [model] ([series])
   Quantity: [qty] units
   Unit Price: Rs.[price]
   Total Value: Rs.[total]
   Cost Optimization: Rs.[saving] total saving
   Warranty: [warranty] with local RMA support
   MOQ: [moq] units

7. COST OPTIMIZATION ANALYSIS — Show calculation:
   Customer budget: Rs.X/unit x Qty = Rs.Total
   Company A offering: Rs.Y/unit x Qty = Rs.Total
   Net saving: Rs.Z (percentage%)

8. NEXT STEPS — Offer 5 evaluation samples at no cost

9. PROFESSIONAL SIGN-OFF:
   Warm regards,
   [FAE Name]
   Field Application Engineer
   Company A Pvt. Ltd.
   the city, Maharashtra | www.company-a.example

Use strong, confident technical language throughout. No hedging words like "might" or "could" — use "delivers", "ensures", "guarantees", "optimizes".

Return ONLY valid JSON:
{
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
  } catch (error) {
    console.error("Draft error:", error);
    return NextResponse.json({ error: "Draft generation failed" }, { status: 500 });
  }
}
