/**
 * Shared LLM helper — Groq only.
 * Groq Llama 3.3 70B Versatile delivers fast, high-quality JSON. Retries up to 5x
 * with exponential backoff on transient failures. No silent fallback — if Groq
 * can't be reached, we throw so the caller can see the real reason.
 *
 * Env is read LAZILY on each call so CLI scripts (e.g. scripts/refresh-catalog.ts)
 * that load .env.local AFTER importing this module still work correctly.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MAX_ATTEMPTS = 5;

function groqKey(): string { return process.env.GROQ_API_KEY || ""; }
function groqModel(): string { return process.env.GROQ_MODEL || "llama-3.3-70b-versatile"; }

async function callGroqOnce(prompt: string, maxTokens: number): Promise<string> {
  const key = groqKey();
  const model = groqModel();
  if (!key) throw new Error("GROQ_API_KEY not set — put it in .env.local");

  const r = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Groq ${model} HTTP ${r.status}: ${body.slice(0, 300)}`);
  }

  const data = await r.json();
  const text: string | undefined = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Groq ${model} returned empty response`);
  return text;
}

export async function askGemini(prompt: string, maxTokens = 1024): Promise<string> {
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= GROQ_MAX_ATTEMPTS; attempt++) {
    try {
      const text = await callGroqOnce(prompt, maxTokens);
      if (attempt > 1) console.log(`[Groq] ${groqModel()} responded on attempt ${attempt}`);
      return text;
    } catch (e) {
      lastErr = e as Error;
      const msg = lastErr.message;
      console.log(`[Groq] attempt ${attempt}/${GROQ_MAX_ATTEMPTS} failed: ${msg}`);
      // Don't retry auth/config errors
      if (msg.includes("GROQ_API_KEY") || msg.includes("HTTP 401") || msg.includes("HTTP 403")) break;
      if (attempt < GROQ_MAX_ATTEMPTS) {
        const delay = 1500 * attempt; // 1.5s, 3s, 4.5s, 6s
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw new Error(`Groq failed after ${GROQ_MAX_ATTEMPTS} attempts. Last error: ${lastErr?.message}`);
}
