import { NextRequest, NextResponse } from "next/server";
import { getAllProducts, upsertProduct, genId, getDb } from "@/lib/db";

// GET — list all catalog products (with optional search)
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.toLowerCase() || "";
    const products = getAllProducts() as Record<string, unknown>[];

    if (q) {
      const filtered = products.filter((p) =>
        String(p.company).toLowerCase().includes(q) ||
        String(p.model).toLowerCase().includes(q) ||
        String(p.series).toLowerCase().includes(q)
      );
      return NextResponse.json({ products: filtered });
    }

    return NextResponse.json({ products });
  } catch (error) {
    console.error("Products GET error:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

// POST — add or update a product in the catalog
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { company, model, series, sensing, ipRating, tempRange, output, voltage,
            price, moq, warranty, stock, warehouse, advantages } = body;

    if (!company || !model) {
      return NextResponse.json({ error: "Company and model are required" }, { status: 400 });
    }

    // advantages can be string or array from AI research
    const advStr = Array.isArray(advantages) ? advantages.join(". ") : (advantages || "");

    const id = upsertProduct({
      company, model, series: series || "", sensing: sensing || "", ipRating: ipRating || "",
      tempRange: tempRange || "", output: output || "", voltage: voltage || "",
      price: price || 0, moq: moq || 0, warranty: warranty || "",
      stock: stock || 0, warehouse: warehouse || "", advantages: advStr,
    });

    return NextResponse.json({ id, message: "Product saved" });
  } catch (error) {
    console.error("Products POST error:", error);
    return NextResponse.json({ error: "Failed to save product" }, { status: 500 });
  }
}

// DELETE — remove a product
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    getDb().prepare("DELETE FROM products WHERE id = ?").run(id);
    return NextResponse.json({ message: "Product deleted" });
  } catch (error) {
    console.error("Products DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
