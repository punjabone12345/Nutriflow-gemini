// Gemini web-research prompt for foods absent from local evidence.
// Uses Google Search grounding; returns per-100g nutrition from trusted
// sources. These are ESTIMATES, clearly disclosed as "web research" by the
// client engine — never treated as verified references.

const RESEARCH_SCHEMA = {
  type: "object",
  properties: {
    food: { type: "string" },
    kcal: { type: "number" },
    protein: { type: "number" },
    carb: { type: "number" },
    fat: { type: "number" },
    fibre: { type: "number" },
    source: { type: "string" },
    confidence: { type: "number" },
    notes: { type: "string" },
  },
  required: ["kcal", "protein", "carb", "fat"],
};

function buildResearchPrompt(name) {
  return `You are a nutrition research assistant. Find reliable per-100g nutrition (as eaten, cooked unless the food is raw) for the Indian food: "${name}".
Compare multiple trusted sources (IFCT / NIN / USDA / manufacturer labels / reputable nutrition databases). Normalise to per 100 g.
Respond with ONLY a JSON object, no prose, with exactly these fields:
{
  "food": "<canonical name>",
  "kcal": <number>,
  "protein": <grams number>,
  "carb": <grams number>,
  "fat": <grams number>,
  "fibre": <grams number>,
  "source": "<the source you trusted, e.g. IFCT 2017 / USDA / label>",
  "confidence": <0-1 number>,
  "notes": "<brief; pick the most common Indian homemade/restaurant preparation if ambiguous and say so here>"
}
If you cannot find evidence, still return the JSON but set confidence low (e.g. 0.3) and explain in notes. Never invent precise values to look confident.`;
}

module.exports = { RESEARCH_SCHEMA, buildResearchPrompt };