import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { z } from "zod";

// All AI in this app goes through Gemini Flash (model from GEMINI_MODEL).
let ai: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");
  return (ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));
}

export function geminiModel(): string {
  const model = process.env.GEMINI_MODEL;
  if (!model) throw new Error("Missing GEMINI_MODEL");
  return model;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Space calls out for the free tier.
const MIN_GAP_MS = 4000;
let lastCallAt = 0;

// JSON-mode call with a response schema, validated with zod.
// Retries rate limits (429) and server errors (5xx) with exponential backoff.
export async function generateJson<T>(prompt: string, jsonSchema: object, validator: z.ZodType<T>): Promise<T> {
  const maxAttempts = 5;
  for (let attempt = 1; ; attempt++) {
    const wait = lastCallAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();
    try {
      const res = await client().models.generateContent({
        model: geminiModel(),
        contents: prompt,
        config: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      return validator.parse(JSON.parse(res.text ?? ""));
    } catch (e) {
      const status = (e as { status?: number }).status;
      const retryable = status === 429 || (status !== undefined && status >= 500);
      if (!retryable || attempt >= maxAttempts) throw e;
      await sleep(Math.min(60_000, 2000 * 2 ** attempt));
    }
  }
}
