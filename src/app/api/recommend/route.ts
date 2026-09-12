import { NextRequest, NextResponse } from "next/server";
import { parseJsonResponse } from "@/lib/parseJson";
import { askGemini } from "@/lib/gemini";
import { OUR_DEALERS } from "@/lib/dealers";

export async function POST(req: NextRequest) {
  try {
    const { extractedSpecs } = await req.json();

    if (!extractedSpecs) {
      return NextResponse.json({ error: "Extracted specs are required" }, { status: 400 });
    }

    const brandList = Object.keys(OUR_DEALERS).join(", ");

    const prompt = `You are a product recommendation engine for Company A (India), an authorized ECIA/NEDA distributor.

Customer requirements:
${JSON.stringify(extractedSpecs, null, 2)}

Recommend top 3 alternatives SOLELY from Company A's authorized brands: ${brandList}.
If no suitable match exists across these brands, return [] and nothing else.

Priority: (1) exact MPN match, (2) same make, (3) best-fit on technical specs.

For EACH product return these fields:
- company, model, series, sensing, ipRating, tempRange, output, voltage
- price (INR), moq, warranty, advantages
- matchScore (0-100)
- reasoning (1 sentence)
- specMatches: object with boolean for each spec showing if it meets/exceeds requirement:
  { sensing: true/false, ipRating: true/false, tempRange: true/false, output: true/false, voltage: true/false, price: true/false, warranty: true/false }

Do NOT include any leadTime or delivery-timeline field.
Return ONLY valid JSON array of up to 3 objects sorted by matchScore desc. No other text.`;

    const text = await askGemini(prompt, 2048);
    const recommendations = parseJsonResponse(text);

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("Recommend error:", error);
    return NextResponse.json({ error: "Recommendation failed" }, { status: 500 });
  }
}
