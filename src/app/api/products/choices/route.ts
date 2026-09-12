import { NextRequest, NextResponse } from "next/server";
import { parseJsonResponse } from "@/lib/parseJson";
import { askGemini } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { query, searchType } = await req.json();
    if (!query) return NextResponse.json({ error: "Query required" }, { status: 400 });

    const prompt = searchType === "company"
      ? `List the main product categories/types that "${query}" manufactures for electronic components.
Return a JSON array of objects with: name (product line name), model (series identifier), category (product type), description (1-line description).
Return 5-8 main product lines. ONLY valid JSON array, no other text.`
      : `List the main subtypes/variants of "${query}" available from major electronic component brands.
Return a JSON array of objects with: name (variant name), model ("Various"), category ("${query}"), description (1-line description of this variant).
Return 4-6 variants. ONLY valid JSON array, no other text.`;

    const text = await askGemini(prompt, 1024);
    const choices = parseJsonResponse(text);
    return NextResponse.json({ choices });
  } catch (error) {
    console.error("Product choices error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
