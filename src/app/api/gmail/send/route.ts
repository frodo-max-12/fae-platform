import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuth2Client } from "@/lib/google";
import { cookies } from "next/headers";

function createRawEmail(to: string, cc: string, subject: string, body: string, from: string) {
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    cc ? `Cc: ${cc}` : "",
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
  ].filter(Boolean);

  const raw = Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return raw;
}

export async function POST(req: NextRequest) {
  try {
    const { to, cc, subject, body } = await req.json();

    if (!to || !subject || !body) {
      return NextResponse.json({ error: "Missing required fields: to, subject, body" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const tokensCookie = cookieStore.get("gmail_tokens");
    const userCookie = cookieStore.get("gmail_user");

    if (!tokensCookie) {
      return NextResponse.json({ error: "Not authenticated. Please sign in with Google." }, { status: 401 });
    }

    const tokens = JSON.parse(tokensCookie.value);
    const user = userCookie ? JSON.parse(userCookie.value) : { email: "me" };

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(tokens);

    // Refresh if needed
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

    const raw = createRawEmail(to, cc || "", subject, body, user.email);

    const result = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    return NextResponse.json({
      success: true,
      messageId: result.data.id,
      sentAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("Gmail send error:", error);
    const message = error instanceof Error ? error.message : "Failed to send email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
