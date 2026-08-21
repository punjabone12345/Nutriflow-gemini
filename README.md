# NutriFlow Meal Analyzer (external Netlify + Gemini)

Standalone Netlify Functions that do NutriFlow's **Gemini meal reasoning**.
The Base44 app calls these over HTTPS and never touches Base44 LLM / integration
credits for meal analysis. The `GEMINI_API_KEY` lives only in Netlify's
environment — it is never exposed to the frontend.

## Why this exists

NutriFlow must analyze meals with Gemini **without** consuming Base44
AI/LLM/integration credits. The deterministic nutrition calculation still runs
inside the Base44 app (it owns the `IndianFood` evidence database); only the
Gemini reasoning + web-research calls live here.

## Endpoints

### `POST /.netlify/functions/analyze-meal`
Body:
```json
{ "meal_text": "1 plate soya chaap", "candidates": ["..."], "locale": "en-IN", "user_context": { "preferred_language": "en" } }
```
Response:
```json
{ "status": "ok", "interpretation": { "foods": [ { "identifiedFood": "...", "type": "recipe", "ingredients": [...], "questions": [...] } ] } }
```
The interpretation contains **no nutrition numbers** — only identity,
ingredients, portions, and high-impact questions.

### `POST /.netlify/functions/research-food`
Body:
```json
{ "food_name": "gawar phali sabji" }
```
Response:
```json
{ "status": "ok", "reference": { "food": "...", "kcal": 0, "protein": 0, "carb": 0, "fat": 0, "fibre": 0, "source": "...", "confidence": 0.7, "notes": "..." } }
```
Uses Google Search grounding. Treated by the app as a disclosed estimate.

## Deploy

1. Create a new site from this folder (or add it to an existing Netlify site).
2. **Site settings → Environment variables:**
   - `GEMINI_API_KEY` — your Google AI Studio API key (required).
   - `GEMINI_MODEL` — optional. Default `gemini-2.5-flash`. Use
     `gemini-2.5-pro` for higher-quality decomposition of complex dishes (more
     cost / lower rate limits).
3. Deploy. Note the site URL, e.g. `https://your-site.netlify.app`.

## Point the app at it

In the Base44 app, set `VITE_MEAL_ANALYZER_URL` (or edit the placeholder in
`src/lib/mealAnalyzerConfig.js`) to:

```
https://your-site.netlify.app/.netlify/functions/analyze-meal
```

The research URL is derived automatically (it replaces `analyze-meal` with
`research-food`).

## Notes

- CORS is open (`*`) so the Base44-hosted app can call it directly.
- Node 18+ (global `fetch`). No runtime dependencies.
- If the backend is unavailable, the app shows:
  "Nutrition AI is temporarily unavailable. Your meal has not been logged."
  and does **not** silently fall back to any Base44 LLM.
