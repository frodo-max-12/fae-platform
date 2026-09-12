import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuth2Client } from "@/lib/google";
import { cookies } from "next/headers";

/**
 * Downloads a single Gmail attachment and returns it as base64.
 * POST body: { messageId: string; attachmentId: string }
 * Response:  { base64Data: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { messageId, attachmentId } = await req.json();
    if (!messageId || !attachmentId) {
      return NextResponse.json({ error: "messageId and attachmentId required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const tokensCookie = cookieStore.get("gmail_tokens");
    if (!tokensCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const tokens = JSON.parse(tokensCookie.value);
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const res = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId,
      id: attachmentId,
    });

    const data = res.data.data || "";
    // Gmail returns URL-safe base64 — normalize to standard base64
    const base64Data = data.replace(/-/g, "+").replace(/_/g, "/");

    return NextResponse.json({ base64Data });
  } catch (error) {
    console.error("Attachment fetch error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch attachment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
