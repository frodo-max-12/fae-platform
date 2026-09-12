/**
 * SSE endpoint for live catalog refresh progress.
 *   GET /api/catalog/refresh/stream?force=true  → stream brand-by-brand progress
 *   GET /api/catalog/refresh/stream             → only stale brands
 *
 * Sends events:
 *   { type: "start",    total, brands }
 *   { type: "progress", brand, index, total, status, productCount?, added?, removed?, error? }
 *   { type: "done",     total, succeeded, failed, totalProducts }
 */

import { NextRequest } from "next/server";
import { buildBrandCatalog } from "@/lib/catalogBuild";
import { readIndex, isStale } from "@/lib/catalogStore";
import { DEALER_NAMES } from "@/lib/dealers";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "true";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const idx = await readIndex();
        const brands = DEALER_NAMES.filter((b) => force || isStale(idx[b]?.lastFetched));

        send({ type: "start", total: brands.length, brands });

        if (brands.length === 0) {
          send({ type: "done", total: 0, succeeded: 0, failed: 0, totalProducts: 0 });
          controller.close();
          return;
        }

        let succeeded = 0;
        let failed = 0;
        let totalProducts = 0;

        for (let i = 0; i < brands.length; i++) {
          const brand = brands[i];
          send({
            type: "progress",
            brand,
            index: i,
            total: brands.length,
            status: "fetching",
          });

          try {
            const r = await buildBrandCatalog(brand);
            succeeded++;
            totalProducts += r.catalog.products.length;
            send({
              type: "progress",
              brand,
              index: i,
              total: brands.length,
              status: "done",
              productCount: r.catalog.products.length,
              added: r.added.length,
              removed: r.removed.length,
            });
          } catch (e) {
            failed++;
            send({
              type: "progress",
              brand,
              index: i,
              total: brands.length,
              status: "error",
              error: (e as Error).message,
            });
          }
        }

        send({ type: "done", total: brands.length, succeeded, failed, totalProducts });
      } catch (e) {
        send({ type: "error", error: (e as Error).message });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
