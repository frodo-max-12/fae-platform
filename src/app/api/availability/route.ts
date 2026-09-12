import { NextRequest, NextResponse } from "next/server";

const warehouseStock: Record<string, { stock: number; warehouse: string; price: number }> = {
  "PR18-8DP": { stock: 680, warehouse: "the city", price: 780 },
  "NBB8-18GM50": { stock: 450, warehouse: "Mumbai", price: 920 },
  "IF5250": { stock: 200, warehouse: "Delhi", price: 850 },
  "E3Z-D62": { stock: 320, warehouse: "Chennai", price: 1100 },
  "C7080": { stock: 75, warehouse: "the city", price: 3200 },
};

export async function POST(req: NextRequest) {
  try {
    const { productId, quantity } = await req.json();

    await new Promise((r) => setTimeout(r, 500));

    const stockInfo = warehouseStock[productId] || {
      stock: Math.floor(Math.random() * 500) + 100,
      warehouse: "the city",
      price: 780,
    };

    return NextResponse.json({
      inStock: stockInfo.stock >= (quantity || 0),
      stockCount: stockInfo.stock,
      warehouse: stockInfo.warehouse,
      unitPrice: stockInfo.price,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Availability error:", error);
    return NextResponse.json({ error: "Stock check failed" }, { status: 500 });
  }
}
