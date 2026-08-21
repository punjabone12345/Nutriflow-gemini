// Gemini meal-decomposition prompt + JSON schema for NutriFlow.
//
// Gemini DECOMPOSES the meal (identity, ingredients, portions, missing
// high-impact questions). It NEVER outputs nutrition numbers — all arithmetic
// is done later by the deterministic client engine using trusted references.
// The prompt is kept SHORT on purpose: a long prompt makes the flash model
// ramble in free-text fields and time out the function.

const AGENT_SCHEMA = {
  type: "object",
  properties: {
    foods: {
      type: "array",
      items: {
        type: "object",
        properties: {
          originalText: { type: "string" },
          identifiedFood: { type: "string" },
          type: { type: "string", enum: ["single", "dish", "recipe", "product"] },
          quantity: { type: "number" },
          unit: { type: "string" },
          size: { type: "string", enum: ["small", "medium", "large"] },
          estimatedGrams: { type: "number" },
          finishedWeightGrams: { type: "number" },
          indbName: { type: "string" },
          oilImpact: { type: "string", enum: ["none", "low", "medium", "high"] },
          oilLevel: { type: "string", enum: ["low", "medium", "high"] },
          preparation: { type: "string", enum: ["dry", "gravy", "creamy"] },
          confidence: { type: "number" },
          needsResearch: { type: "boolean" },
          productName: { type: "string" },
          sachetCount: { type: "number" },
          servingCount: { type: "number" },
          servingUnit: { type: "string" },
          productLabel: {
            type: "object",
            properties: {
              kcal: { type: "number" }, protein: { type: "number" }, carb: { type: "number" }, fat: { type: "number" }, fibre: { type: "number" },
              perSachetGrams: { type: "number" }, source: { type: "string" },
            },
            required: ["kcal", "protein", "carb", "fat"],
          },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                estimatedGrams: { type: "number" },
                isCookingFat: { type: "boolean" },
                role: { type: "string", enum: ["base", "vegetable", "gravy", "fat", "spice", "other"] },
                state: { type: "string", enum: ["raw", "cooked"] },
              },
              required: ["name", "estimatedGrams", "role"],
            },
          },
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                question: { type: "string" },
                impact: { type: "string", enum: ["high", "medium", "low"] },
                options: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      value: { type: "string" },
                      emoji: { type: "string" },
                    },
                    required: ["label", "value"],
                  },
                },
              },
              required: ["id", "question", "impact"],
            },
          },
        },
        required: ["identifiedFood", "type"],
      },
    },
  },
  required: ["foods"],
};

function buildAgentPrompt(text, candidates, locale) {
  const cand = (candidates || []).slice(0, 40).join(", ") || "(none)";
  return `You are NutriFlow's nutrition AI for INDIAN food. Decompose the user's meal into foods. You NEVER output nutrition numbers (no kcal/protein/carbs/fat/fiber/energy). A deterministic engine does all arithmetic from trusted references. Return ONLY JSON matching the schema — no prose, no comments.

USER MEAL: """${text}"""
DATABASE CANDIDATES (set indbName only on EXACT match): ${cand}

RULES:
1. Split on "and/with/aur/,//+/ke saath". One entry per food.
2. type: "single" (raw/as-is: butter, paneer, rice, curd, banana), "dish" (EXACT DB match → set indbName; oil already included, never ask oil_level), "recipe" (homemade built from ingredients: bhurji, sabji, dal tadka, pyaaz paratha, soya chaap masala, paneer butter masala — list ingredients+grams; cooking-fat line isCookingFat=true, estimatedGrams=0), "product" (branded — fill productLabel from the sachet; engine distributes one sachet across servings, never multiplies by serving count).
3. NEVER substitute a different food: tandoori roti≠parantha; soya chaap≠soya roti/chunks; butter≠icing; pyaaz paratha≠plain paratha; paneer bhurji≠paneer; dal≠Dalma; karela≠karela aloo (unless user said aloo). If exact food unknown → needsResearch=true, type="single".
4. oilImpact: "none" (raw), "low" (light OR exact INDB dish), "medium" (sabji/bhurji/curry/lean-base like dry soya chaap), "high" (fried/rich). For dry soya chaap set medium + ask oil_level+plate_size+preparation. For rich curated (paneer butter masala, soya chaap masala gravy) set low, no oil_level.
5. Questions: ONLY high-impact, max 2 per food, never spices/garnish. ids: oil_level, preparation, plate_size, bowl_size, piece_size, food_type (dal type), frying_method. Ask only what materially changes nutrition AND user didn't state.
6. PORTIONS (food-specific; NEVER 60 for a plate, NEVER 200 for every bowl): plate soya chaap ~220g; sabji/bhurji bowl ~150-180g; dal/rajma/chole bowl ~180-200g; rice bowl ~200g; paneer butter masala bowl ~180g; curd bowl ~200g. "1 plate"→unit:"plate". "1 bowl/katori"→unit:"bowl". "2 roti"→unit:"piece",quantity:2. Gram weight→estimatedGrams (single) or finishedWeightGrams (recipe).
7. confidence 0-1 (identity certainty). needsResearch if not in DB and not reconstructable.

Return ONLY JSON. No nutrition numbers anywhere.`;
}

module.exports = { AGENT_SCHEMA, buildAgentPrompt };
