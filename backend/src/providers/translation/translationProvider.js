// =============================================================================
// translationProvider.js — Multilingual Translation Provider using Google Gemini.
// Server-side only. Reads GEMINI_API_KEY from environment variables.
// Returns strictly the translated text without explanations, markdown, or quotes.
// =============================================================================

import config from '../../config/env.js';
import { serviceUnavailable } from '../../utils/errors.js';

export const SUPPORTED_LANGUAGES = [
  'en', // English
  'ta', // Tamil
  'hi', // Hindi
  'ml', // Malayalam
  'kn', // Kannada
  'te', // Telugu
  'bn', // Bengali
  'mr', // Marathi
  'gu', // Gujarati
  'pa', // Punjabi
  'ur', // Urdu
  'or', // Odia
  'as'  // Assamese
];

export const LANGUAGE_LABELS = {
  en: 'English',
  ta: 'Tamil (தமிழ்)',
  hi: 'Hindi (हिन्दी)',
  ml: 'Malayalam (മലയാളം)',
  kn: 'Kannada (ಕನ್ನಡ)',
  te: 'Telugu (తెలుగు)',
  bn: 'Bengali (বাংলা)',
  mr: 'Marathi (मराठी)',
  gu: 'Gujarati (ગુજરાતી)',
  pa: 'Punjabi (ਪੰਜਾਬੀ)',
  ur: 'Urdu (اردو)',
  or: 'Odia (ଓଡ଼ିଆ)',
  as: 'Assamese (অসমীয়া)'
};

export function isLanguageSupported(code) {
  return SUPPORTED_LANGUAGES.includes(String(code || '').toLowerCase());
}

export function supportedLanguages() {
  return SUPPORTED_LANGUAGES;
}

export function translationConfigured() {
  const key = process.env.GEMINI_API_KEY || config.translation?.geminiApiKey;
  return Boolean(key && key.trim());
}

/**
 * Translate text using Google Gemini API
 * Strictly backend/server-side only. Never logs or leaks API keys.
 */
async function translateViaGemini(text, source, target) {
  const apiKey = (process.env.GEMINI_API_KEY || config.translation?.geminiApiKey || '').trim();
  const model = (process.env.GEMINI_MODEL || config.translation?.geminiModel || 'gemini-2.5-flash').trim();

  if (!apiKey) {
    throw serviceUnavailable(
      'Google Gemini API key is not configured in environment variables (GEMINI_API_KEY).',
      'GEMINI_KEY_MISSING'
    );
  }

  const sourceName = LANGUAGE_LABELS[source] || source;
  const targetName = LANGUAGE_LABELS[target] || target;

  const prompt = `You are a professional, accurate translator.
Translate the following text from ${sourceName} (${source}) to ${targetName} (${target}).

STRICT TRANSLATION RULES:
1. Output ONLY the raw translated text.
2. Absolutely NO notes, NO explanation, NO introduction, NO romanized pronunciation.
3. Do NOT wrap the translation in quotation marks.
4. Do NOT use markdown code blocks.
5. Preserve all original paragraphs, line breaks, punctuation, numbers, formatting, and special characters.

Text to translate:
${text}`;

  const primaryModel = (process.env.GEMINI_MODEL || config.translation?.geminiModel || 'gemini-3.5-flash').trim();
  const modelsToTry = [primaryModel, 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-flash-latest'].filter(
    (m, idx, arr) => m && arr.indexOf(m) === idx
  );

  let lastError = null;
  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            topP: 0.95,
            maxOutputTokens: 2048
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        const errMsg = errBody?.error?.message || `Gemini API returned status ${res.status}`;
        console.warn(`[translationProvider:gemini] Model ${model} failed (${res.status}): ${errMsg}`);
        lastError = errMsg;
        // Try next fallback model if 404 (model not found/deprecated) or 503 (busy)
        if (res.status === 404 || res.status === 503) {
          continue;
        }
        throw serviceUnavailable('Translation failed via Google Gemini. Please try again.', 'TRANSLATION_FAILED');
      }

      const data = await res.json();
      const candidate = data?.candidates?.[0];
      const candidateText = candidate?.content?.parts?.[0]?.text;

      if (!candidateText || typeof candidateText !== 'string') {
        throw serviceUnavailable('No translation returned from Google Gemini.', 'TRANSLATION_EMPTY');
      }

      let translated = candidateText.trim();
      if ((translated.startsWith('"') && translated.endsWith('"')) || (translated.startsWith("'") && translated.endsWith("'"))) {
        translated = translated.slice(1, -1).trim();
      }
      return translated;
    } catch (err) {
      clearTimeout(timer);
      if (err.code === 'TRANSLATION_FAILED' || err.code === 'TRANSLATION_EMPTY') {
        throw err;
      }
      console.warn(`[translationProvider:gemini] Model ${model} attempt threw: ${err.message}`);
      lastError = err.message;
    }
  }

  throw serviceUnavailable(`Translation failed via Google Gemini (${lastError || 'Service busy'}). Please try again.`, 'TRANSLATION_FAILED');
}

export async function fetchLibreTranslateLanguages() {
  // Maintained for backward compatibility
  return SUPPORTED_LANGUAGES.map((code) => ({
    code,
    label: LANGUAGE_LABELS[code] || code
  }));
}

export async function translate(text, source = 'en', target = 'ta') {
  const q = String(text || '').trim();
  if (!q) return '';
  const src = source.toLowerCase();
  const tgt = target.toLowerCase();

  if (src === tgt) return q;

  return translateViaGemini(q, src, tgt);
}
