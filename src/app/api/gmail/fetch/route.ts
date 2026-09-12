import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuth2Client } from "@/lib/google";
import { cookies } from "next/headers";

// ── Smart HTML → readable text converter ──
// Preserves tables, lists, line breaks — not just strip tags
function htmlToReadableText(html: string): string {
  let text = html;

  // Decode HTML entities first
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&rdquo;/gi, '"')
    .replace(/&ldquo;/gi, '"')
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

  // ── Convert HTML tables to pipe-delimited text tables ──
  // Process each <table>...</table> block
  text = text.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, tableInner) => {
    const rows: string[][] = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRegex.exec(tableInner)) !== null) {
      const cells: string[] = [];
      const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
      let cellMatch: RegExpExecArray | null;

      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        // Strip inner HTML tags from cell content
        const cellText = cellMatch[1].replace(/<[^>]*>/g, "").trim();
        cells.push(cellText);
      }

      if (cells.length > 0) rows.push(cells);
    }

    if (rows.length === 0) return "";

    // Find max width per column
    const colCount = Math.max(...rows.map((r) => r.length));
    const colWidths: number[] = Array(colCount).fill(0);
    for (const row of rows) {
      for (let c = 0; c < row.length; c++) {
        colWidths[c] = Math.max(colWidths[c], row[c].length);
      }
    }

    // Build pipe-delimited table
    const lines: string[] = [];
    for (let r = 0; r < rows.length; r++) {
      const line = rows[r].map((cell, c) => cell.padEnd(colWidths[c])).join(" | ");
      lines.push("| " + line + " |");

      // Add separator after first row (header)
      if (r === 0) {
        const sep = colWidths.map((w) => "-".repeat(w)).join(" | ");
        lines.push("| " + sep + " |");
      }
    }

    return "\n" + lines.join("\n") + "\n";
  });

  // ── Convert lists ──
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => {
    const content = inner.replace(/<[^>]*>/g, "").trim();
    return "- " + content + "\n";
  });

  // ── Line breaks and block elements ──
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/h[1-6]>/gi, "\n\n");
  text = text.replace(/<\/tr>/gi, "\n");
  text = text.replace(/<hr[^>]*>/gi, "\n---\n");
  text = text.replace(/<\/blockquote>/gi, "\n");

  // Gmail quote class → thread separator
  text = text.replace(/<div class="gmail_quote"[^>]*>/gi, "\n--- Quoted Message ---\n");

  // Outlook separator
  text = text.replace(/<div id="divRplyFwdMsg"[^>]*>/gi, "\n--- Original Message ---\n");

  // Strip all remaining HTML tags
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<[^>]*>/g, "");

  // Clean up whitespace
  text = text.replace(/[ \t]+/g, " ");           // collapse horizontal space
  text = text.replace(/\n{4,}/g, "\n\n\n");      // max 3 newlines
  text = text.replace(/^\s+$/gm, "");             // blank lines → truly blank

  return text.trim();
}

// ── Recursively extract text/plain and text/html from nested MIME parts ──
interface GmailPart {
  mimeType?: string | null;
  filename?: string | null;
  body?: { data?: string | null; attachmentId?: string | null; size?: number | null } | null;
  parts?: GmailPart[] | null;
}

function extractAttachments(part: GmailPart): Array<{ filename: string; mimeType: string; attachmentId: string; size: number }> {
  const out: Array<{ filename: string; mimeType: string; attachmentId: string; size: number }> = [];
  if (part.filename && part.body?.attachmentId) {
    out.push({
      filename: part.filename,
      mimeType: part.mimeType || "application/octet-stream",
      attachmentId: part.body.attachmentId,
      size: part.body.size || 0,
    });
  }
  if (part.parts) {
    for (const sub of part.parts) out.push(...extractAttachments(sub));
  }
  return out;
}

function extractBodies(part: GmailPart): { plain: string; html: string } {
  let plain = "";
  let html = "";

  if (part.mimeType === "text/plain" && part.body?.data) {
    plain += Buffer.from(part.body.data, "base64").toString("utf-8");
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    html += Buffer.from(part.body.data, "base64").toString("utf-8");
  }

  // Recurse into nested parts (multipart/alternative, multipart/mixed, multipart/related)
  if (part.parts) {
    for (const sub of part.parts) {
      const result = extractBodies(sub);
      if (result.plain) plain += (plain ? "\n" : "") + result.plain;
      if (result.html) html += (html ? "\n" : "") + result.html;
    }
  }

  return { plain, html };
}

export async function POST(req: NextRequest) {
  try {
    const { maxResults = 20, query = "", fetchAll = false } = await req.json();

    const cookieStore = await cookies();
    const tokensCookie = cookieStore.get("gmail_tokens");

    if (!tokensCookie) {
      return NextResponse.json({ error: "Not authenticated. Please sign in with Google." }, { status: 401 });
    }

    const tokens = JSON.parse(tokensCookie.value);
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(tokens);

    // Refresh token if expired
    if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
      cookieStore.set("gmail_tokens", JSON.stringify(credentials), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // List messages — paginate through all pages when fetchAll is set
    // (e.g. for a user-specified date range we want every match, not just one page).
    const messages: { id?: string | null }[] = [];
    const hardCap: number = fetchAll ? 1000 : maxResults;

    const listPage = (token: string | undefined) =>
      gmail.users.messages.list({
        userId: "me",
        maxResults: Math.min(500, hardCap - messages.length),
        q: query || "in:inbox",
        pageToken: token,
      });

    let pageToken: string | undefined = undefined;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const listRes = await listPage(pageToken);
      const batch = listRes.data.messages || [];
      messages.push(...batch);
      const next = listRes.data.nextPageToken;
      pageToken = next ? next : undefined;
      if (!fetchAll) break;
      if (!pageToken) break;
      if (messages.length >= hardCap) break;
    }

    // Fetch full message details
    const emails = await Promise.all(
      messages.slice(0, hardCap).map(async (msg) => {
        const full = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "full",
        });

        const headers = full.data.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

        // ── Extract body — recursively walk MIME tree ──
        let body = "";
        const payload = full.data.payload;

        if (payload) {
          const { plain, html } = extractBodies(payload as GmailPart);

          if (plain && plain.trim().length > 20) {
            // Prefer text/plain — it's already readable, preserves tables customers type
            body = plain;
          } else if (html) {
            // Convert HTML to readable text, preserving tables
            body = htmlToReadableText(html);
          } else if (plain) {
            body = plain;
          }
        }

        const attachmentsMeta = payload ? extractAttachments(payload as GmailPart) : [];

        return {
          id: msg.id,
          from: getHeader("From"),
          subject: getHeader("Subject"),
          date: getHeader("Date"),
          body: body.trim(),
          snippet: full.data.snippet || "",
          attachments: attachmentsMeta,
        };
      })
    );

    return NextResponse.json({ emails });
  } catch (error: unknown) {
    console.error("Gmail fetch error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch emails";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
