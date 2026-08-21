// NutriFlow meal analyzer — Gemini decomposition endpoint.
//
// POST { meal_text, candidates, locale, user_context }
// -> { status: "ok", interpretation: {...decomposition, no nutrition...} }
// or { status: "error", message }
//
// The deterministic nutrition calculation stays in the Base44 app (it owns the
// IndianFood evidence database). This function only does the Gemini reasoning.

const { callGemini, CORS_HEADERS, respond } = require("../lib/gemini");
const { buildAgentPrompt, AGENT_SCHEMA } = require("../lib/prompt");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return respond(405, { status: "error", message: "Method not allowed" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (_) {
    return respond(400, { status: "error", message: "Invalid JSON body" });
  }

  const meal_text = (payload.meal_text || "").toString();
  if (!meal_text.trim()) {
    return respond(400, { status: "error", message: "meal_text is required" });
  }
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const locale = payload.locale || "en-IN";

  try {
    const prompt = buildAgentPrompt(meal_text, candidates, locale);
    const interpretation = await callGemini({
      prompt,
      responseSchema: AGENT_SCHEMA,
      useSearch: false,
    });
    return respond(200, { status: "ok", interpretation });
  } catch (err) {
    return respond(err.statusCode || 502, {
      status: "error",
      message: err.message || "Gemini analysis failed",
    });
  }
};