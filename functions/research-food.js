// NutriFlow meal analyzer — Gemini web-research endpoint for unknown foods.
//
// POST { food_name }
// -> { status: "ok", reference: { food, kcal, protein, carb, fat, fibre, source, confidence, notes } }
// or { status: "error", message }
//
// Uses Google Search grounding for evidence. The client treats these values as
// disclosed estimates ("web research"), never as verified references.

const { callGemini, CORS_HEADERS, respond } = require("../lib/gemini");
const { buildResearchPrompt } = require("../lib/researchPrompt");

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

  const food_name = (payload.food_name || "").toString();
  if (!food_name.trim()) {
    return respond(400, { status: "error", message: "food_name is required" });
  }

  try {
    const prompt = buildResearchPrompt(food_name);
    // Google Search grounding is on; responseSchema is omitted (incompatible
    // with the search tool in many Gemini versions). The prompt enforces JSON.
    const reference = await callGemini({ prompt, useSearch: true });
    return respond(200, { status: "ok", reference });
  } catch (err) {
    return respond(err.statusCode || 502, {
      status: "error",
      message: err.message || "Gemini research failed",
    });
  }
};