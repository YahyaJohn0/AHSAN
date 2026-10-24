import { GoogleGenAI, Type } from '@google/genai';

/**
 * Resolves the Google Gemini API key from environment.
 * Supports both standard GEMINI_API_KEY and GOOGLE_API_KEY.
 */
export function getGeminiApiKey(): string | undefined {
  // If GOOGLE_API_KEY is defined and non-empty, prefer it or GEMINI_API_KEY
  const googleKey = process.env.GOOGLE_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  // Prefer standard Google AI Studio key format (AIzaSy...) if present
  if (googleKey && googleKey.startsWith('AIzaSy')) return googleKey;
  if (geminiKey && geminiKey.startsWith('AIzaSy')) return geminiKey;

  // Otherwise return whatever is configured
  return googleKey || geminiKey;
}

let aiClient: GoogleGenAI | null = null;

/**
 * Returns a configured GoogleGenAI instance with the required telemetry header.
 */
export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  return aiClient;
}

export interface GeminiStatus {
  configured: boolean;
  model: string;
  keySource: 'GEMINI_API_KEY' | 'GOOGLE_API_KEY' | 'none';
  status: 'ready' | 'missing_key' | 'error';
  message: string;
}

/**
 * Checks Gemini API configuration and optionally tests connectivity.
 */
export async function checkGeminiStatus(testPing = false): Promise<GeminiStatus> {
  const apiKey = getGeminiApiKey();
  const keySource = process.env.GOOGLE_API_KEY?.trim()
    ? 'GOOGLE_API_KEY'
    : (process.env.GEMINI_API_KEY?.trim() ? 'GEMINI_API_KEY' : 'none');

  if (!apiKey) {
    return {
      configured: false,
      model: 'gemini-3.8-flash',
      keySource: 'none',
      status: 'missing_key',
      message: 'No GEMINI_API_KEY or GOOGLE_API_KEY configured in environment.',
    };
  }

  if (!testPing) {
    return {
      configured: true,
      model: 'gemini-3.8-flash',
      keySource,
      status: 'ready',
      message: `Gemini API key configured via ${keySource}. Ready for AI generation.`,
    };
  }

  try {
    const ai = getGeminiClient();
    if (!ai) throw new Error('Could not instantiate Gemini client');

    const res = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: 'Respond with the word "OK"',
    });

    if (res.text) {
      return {
        configured: true,
        model: 'gemini-3.8-flash',
        keySource,
        status: 'ready',
        message: 'Gemini 3.8 Flash connection verified successfully.',
      };
    }

    return {
      configured: true,
      model: 'gemini-3.8-flash',
      keySource,
      status: 'error',
      message: 'Gemini responded without text output.',
    };
  } catch (err: any) {
    return {
      configured: true,
      model: 'gemini-3.8-flash',
      keySource,
      status: 'error',
      message: err.message || 'Gemini API call failed',
    };
  }
}

export interface GeneratedProductContent {
  name: string;
  shortDescription: string;
  description: string;
  highlights: string[];
  suggestedTags: string[];
}

/**
 * Generates compelling e-commerce product descriptions and highlights
 * for beauty, hair care, vanity organizers, and home essentials.
 */
export async function generateProductContent(params: {
  productName: string;
  category?: string;
  keywords?: string;
  tone?: string;
}): Promise<GeneratedProductContent> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error('Gemini API is not configured. Please supply GEMINI_API_KEY or GOOGLE_API_KEY.');
  }

  const prompt = `You are a luxury e-commerce copywriter specializing in lifestyle products, beauty skincare, hairbrushes/styling tools, vanity organizers, and household essentials for Zamzam Store.
Write high-converting, professional, customer-ready copy for the following product:
- Product Name: ${params.productName}
- Category: ${params.category || 'General Lifestyle'}
- Keywords/Notes: ${params.keywords || 'None'}
- Desired Tone: ${params.tone || 'Elegant, clear, benefit-driven'}

Requirements:
1. shortDescription: A punchy 1-2 sentence hook highlighting the core daily benefit.
2. description: 2-3 engaging, well-formatted paragraphs describing build quality, ease of use, aesthetic appeal, and results.
3. highlights: 4-5 bullet point features (e.g. materials, dimensions, specific advantages).
4. suggestedTags: 3-6 relevant search tags.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          shortDescription: { type: Type.STRING },
          description: { type: Type.STRING },
          highlights: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          suggestedTags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['name', 'shortDescription', 'description', 'highlights', 'suggestedTags'],
      },
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error('Empty response from Gemini API.');
  }

  const parsed = JSON.parse(text) as GeneratedProductContent;
  return parsed;
}
