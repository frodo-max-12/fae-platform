import { NextRequest, NextResponse } from "next/server";
import { getRecentRequests, getRequestStats, createRequest, updateRequest, upsertCustomer, getDb, getRequestById } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const row = getRequestById(id) as Record<string, unknown> | undefined;
      if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
      // Join customer info
      if (row.customerId) {
        const cust = getDb().prepare("SELECT name, email, company FROM customers WHERE id = ?").get(row.customerId) as { name: string; email: string; company: string } | undefined;
        if (cust) {
          row.customerName = cust.name;
          row.customerEmail = cust.email;
          row.customerCompany = cust.company;
        }
      }
      return NextResponse.json({ request: row });
    }

    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");
    const requests = getRecentRequests(limit);
    const stats = getRequestStats();
    return NextResponse.json({ requests, stats });
  } catch (error) {
    console.error("Fetch requests error:", error);
    return NextResponse.json({ requests: [], stats: { total: 0, sent: 0, today: 0, avgTime: 0 } });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      rawEmail,
      status,
      extractedSpecs,
      comparison,
      emailDraft,
      finalEmail,
      sentAt,
      totalTime,
      customerName,
      customerEmail,
      customerCompany,
    } = body as {
      id?: string;
      rawEmail?: string;
      status?: string;
      extractedSpecs?: unknown;
      comparison?: unknown;
      emailDraft?: unknown;
      finalEmail?: string;
      sentAt?: string;
      totalTime?: number;
      customerName?: string;
      customerEmail?: string;
      customerCompany?: string;
    };

    let requestId = id;
    if (!requestId) {
      requestId = createRequest({ rawEmail: rawEmail || "", status: status || "intake" });
    }

    const fields: Record<string, unknown> = {};
    if (status) fields.status = status;
    if (extractedSpecs !== undefined) fields.extractedSpecs = extractedSpecs;
    if (comparison !== undefined) fields.comparison = comparison;
    if (emailDraft !== undefined) fields.emailDraft = emailDraft;
    if (finalEmail !== undefined) fields.finalEmail = finalEmail;
    if (sentAt) fields.sentAt = sentAt;
    if (totalTime !== undefined) fields.totalTime = totalTime;

    if (customerName || customerEmail || customerCompany) {
      const custId = upsertCustomer(customerName || "Unknown", customerEmail || "", customerCompany || "");
      fields.customerId = custId;
    }

    if (Object.keys(fields).length > 0) updateRequest(requestId, fields);

    // Keep rawEmail in sync if supplied on later updates
    if (rawEmail && id) {
      getDb().prepare("UPDATE requests SET rawEmail = ? WHERE id = ?").run(rawEmail, requestId);
    }

    return NextResponse.json({ id: requestId });
  } catch (error) {
    console.error("Save request error:", error);
    return NextResponse.json({ error: "Failed to save progress" }, { status: 500 });
  }
}
