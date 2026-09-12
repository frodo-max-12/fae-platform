/**
 * Parse JSON from LLM API responses, stripping markdown code fences if present.
 * Handles truncated JSON responses by attempting to repair common issues.
 */
export function parseJsonResponse(text: string): unknown {
  // Strip markdown fences
  let stripped = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  // Try direct parse first
  try {
    return JSON.parse(stripped);
  } catch {
    // Attempt repairs for truncated JSON
  }

  // Remove trailing incomplete strings/properties
  // Find last complete value (closing bracket, brace, number, or quoted string)
  const lastGoodEnd = Math.max(
    stripped.lastIndexOf("}"),
    stripped.lastIndexOf("]"),
  );

  if (lastGoodEnd > 0) {
    let repaired = stripped.substring(0, lastGoodEnd + 1);

    // Count and balance braces/brackets
    const openBraces = (repaired.match(/{/g) || []).length;
    const closeBraces = (repaired.match(/}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/]/g) || []).length;

    // Add missing closing brackets/braces
    for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += "]";
    for (let i = 0; i < openBraces - closeBraces; i++) repaired += "}";

    try {
      return JSON.parse(repaired);
    } catch {
      // Last resort: try removing the last incomplete item
    }
  }

  // Replace control characters that break JSON
  stripped = stripped.replace(/[\x00-\x1f\x7f]/g, (ch) => {
    if (ch === "\n" || ch === "\r" || ch === "\t") return ch;
    return "";
  });

  try {
    return JSON.parse(stripped);
  } catch {
    throw new Error("Failed to parse LLM response as JSON");
  }
}
