/**
 * Converts attachments (PDF, Excel, CSV, plain text) to LLM-ready plain text.
 * Called by /api/gmail/attachment and /api/extract when the user uploads files
 * or when a Gmail message has attachments.
 */

import * as XLSX from "xlsx";

type ParsedAttachment = { filename: string; mimeType: string; text: string };

export async function parseAttachment(
  filename: string,
  mimeType: string,
  buffer: Buffer
): Promise<ParsedAttachment> {
  const name = filename.toLowerCase();
  const mt = (mimeType || "").toLowerCase();

  // ── PDF ──
  if (mt.includes("pdf") || name.endsWith(".pdf")) {
    try {
      const mod = await import("pdf-parse");
      const pdfParse = (mod as unknown as { default?: (b: Buffer) => Promise<{ text: string }> }).default ?? (mod as unknown as (b: Buffer) => Promise<{ text: string }>);
      const result = await pdfParse(buffer);
      return { filename, mimeType, text: result.text || "" };
    } catch (e) {
      return { filename, mimeType, text: `[PDF parse error: ${(e as Error).message}]` };
    }
  }

  // ── Excel (.xlsx / .xls) ──
  if (
    mt.includes("spreadsheet") ||
    mt.includes("excel") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".xlsm")
  ) {
    try {
      const wb = XLSX.read(buffer, { type: "buffer" });
      const parts: string[] = [];
      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
        if (csv.trim()) parts.push(`--- Sheet: ${sheetName} ---\n${csv}`);
      }
      return { filename, mimeType, text: parts.join("\n\n") };
    } catch (e) {
      return { filename, mimeType, text: `[Excel parse error: ${(e as Error).message}]` };
    }
  }

  // ── CSV ──
  if (mt.includes("csv") || name.endsWith(".csv")) {
    return { filename, mimeType, text: buffer.toString("utf-8") };
  }

  // ── Plain text / Markdown / JSON ──
  if (
    mt.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".json")
  ) {
    return { filename, mimeType, text: buffer.toString("utf-8") };
  }

  // ── Unknown: skip ──
  return { filename, mimeType, text: `[Unsupported attachment: ${filename} (${mimeType})]` };
}

export function combineSources(
  emailBody: string,
  attachments: ParsedAttachment[]
): string {
  const parts: string[] = [];
  if (emailBody && emailBody.trim()) {
    parts.push("=== EMAIL BODY ===\n" + emailBody.trim());
  }
  for (const a of attachments) {
    if (a.text && a.text.trim()) {
      parts.push(`=== ATTACHMENT: ${a.filename} (${a.mimeType}) ===\n${a.text.trim()}`);
    }
  }
  return parts.join("\n\n");
}
