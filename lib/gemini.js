// Shared Gemini client for the NutriFlow meal-analyzer Netlify functions.
//
// GEMINI_API_KEY lives ONLY in the Netlify environment (Site settings >
// Environment variables). It is never sent to the frontend.
//
// The Gemini model is configured via the GEMINI_MODEL env var (set as a
// secret in Netlify). It is NOT hardcoded here — a literal default would
// trip Netlify's secrets scanner if it matched the secret value.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function respond(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

// Loose JSON extraction: strips code fences and falls back to the first
// balanced {...} block (Gemini with Google Search may wrap or add prose).
function parseJsonLoose(text) {
  if (!text) return null;
  let t = text.trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(t);
  } catch (_) {}
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(t.slice(start, end + 1));
    } catch (_) {}
  }
  return null;
}

async function callGemini({ prompt, responseSchema, useSearch }) {
  if (!GEMINI_API_KEY) {
    const e = new Error("GEMINI_API_KEY is not set on this Netlify function.");
    e.statusCode = 500;
    throw e;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const generationConfig = { responseMimeType: "application/json", maxOutputTokens: 2048 };
  // Gemini's Google Search tool is incompatible with responseSchema in many
  // versions, so when grounding is on we rely on the prompt to enforce JSON.
  if (responseSchema && !useSearch) generationConfig.responseSchema = responseSchema;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig,
  };
  if (useSearch) body.tools = [{ googleSearch: {} }];

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    const e = new Error(`Gemini API error ${res.status}: ${txt.slice(0, 400)}`);
    e.statusCode = 502;
    throw e;
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const textPart = parts.find((p) => typeof p.text === "string");
  if (!textPart?.text) {
    const e = new Error("Gemini returned no content.");
    e.statusCode = 502;
    throw e;
  }
  const parsed = parseJsonLoose(textPart.text);
  if (!parsed) {
    const e = new Error("Gemini returned non-JSON content.");
    e.statusCode = 502;
    throw e;
  }
  return parsed;
}

module.exports = { callGemini, CORS_HEADERS, respond };
