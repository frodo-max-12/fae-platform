import { NextRequest, NextResponse } from "next/server";
import { parseJsonResponse } from "@/lib/parseJson";
import { askGemini } from "@/lib/gemini";
import { OUR_DEALERS } from "@/lib/dealers";

function dealerList() {
  return Object.entries(OUR_DEALERS)
    .map(([brand, info]) => `- ${brand} (${info.website}) — ${info.products}`)
    .join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const { query, searchType } = await req.json();
    if (!query) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 });
    }

    const dealers = dealerList();
    const fieldSpec = `- company: manufacturer (MUST be one of Company A's authorized brands)
- model: exact part number
- series: product series name
- sensing: key spec / rating
- ipRating: package or housing
- tempRange: operating temperature range
- output: output or configuration
- voltage: voltage rating
- price: unit price in INR (realistic)
- moq: minimum order quantity
- warranty: warranty period
- stock: estimated availability (number)
- warehouse: likely Indian warehouse (the city/Mumbai/Delhi/Chennai/Bengaluru)
- advantages: 2-3 key selling points

Do NOT include any leadTime or delivery-timeline field.`;

    let prompt = "";
    if (searchType === "company") {
      prompt = `You are a product research agent for Company A (the city), an authorized ECIA/NEDA distributor.

Company A's authorized brands:
${dealers}

Research the brand "${query}" (must be one of Company A's authorized brands) and return their most popular electronic components available through Company A in India.

Return a JSON array of 5-10 products with these fields:
${fieldSpec}

Return ONLY valid JSON array, no other text.`;
    } else if (searchType === "mpn") {
      prompt = `You are a product research agent for Company A.

Company A's authorized brands:
${dealers}

Research MPN "${query}". Identify manufacturer; the manufacturer MUST be one of Company A's authorized brands above — otherwise return an empty array [].

Return a JSON array (max 5 entries incl. variants) with:
${fieldSpec}

Return ONLY valid JSON array.`;
    } else {
      prompt = `You are a product research agent for Company A.

Company A's authorized brands:
${dealers}

Research products of type "${query}" sourced ONLY from Company A's authorized brands listed above.

Return a JSON array (5-10 items) with:
${fieldSpec}

Return ONLY valid JSON array.`;
    }

    const text = await askGemini(prompt, 4096);
    const products = parseJsonResponse(text);
    return NextResponse.json({ products });
  } catch (error) {
    console.error("Product research error:", error);
    return NextResponse.json({ error: "Research failed" }, { status: 500 });
  }
}
