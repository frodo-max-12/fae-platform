/**
 * Persists wizard progress to the database so Past Inquiries shows
 * inquiries as they flow through the pipeline (intake → extracted → compared → draft → sent).
 * Fire-and-forget — failures don't block the UI.
 */

export type ProgressUpdate = {
  id?: string;
  status?: "intake" | "extracted" | "compared" | "draft" | "sent";
  rawEmail?: string;
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

export async function persistProgress(update: ProgressUpdate): Promise<string | null> {
  try {
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.id || null;
  } catch (e) {
    console.warn("[persistProgress] failed:", (e as Error).message);
    return null;
  }
}
