// =============================================================================
// translationService.js — business logic for translation (calls provider).
// =============================================================================

import { translate, isLanguageSupported, supportedLanguages, LANGUAGE_LABELS } from '../providers/translation/translationProvider.js';
import { badRequest } from '../utils/errors.js';

const LANGUAGE_MAP = {
  english: 'en',
  hindi: 'hi',
  tamil: 'ta',
  telugu: 'te',
  malayalam: 'ml',
  kannada: 'kn',
  bengali: 'bn',
  marathi: 'mr',
  gujarati: 'gu',
  punjabi: 'pa',
  urdu: 'ur',
  odia: 'or',
  assamese: 'as',
  en: 'en',
  hi: 'hi',
  ta: 'ta',
  te: 'te',
  ml: 'ml',
  kn: 'kn',
  bn: 'bn',
  mr: 'mr',
  gu: 'gu',
  pa: 'pa',
  ur: 'ur',
  or: 'or',
  as: 'as'
};

export function resolveCode(lang) {
  if (!lang) return null;
  const key = String(lang).trim().toLowerCase();
  return LANGUAGE_MAP[key] || (isLanguageSupported(key) ? key : null);
}

export async function translateText({ text, sourceLanguage = 'English', targetLanguage = 'Hindi' }) {
  if (!text || !text.trim()) {
    throw badRequest('Please enter text to translate.');
  }

  const src = resolveCode(sourceLanguage) || 'en';
  const tgt = resolveCode(targetLanguage);

  if (!tgt || !isLanguageSupported(tgt)) {
    throw badRequest(`Unsupported language: "${targetLanguage}".`, 'UNSUPPORTED_LANGUAGE');
  }

  if (src === tgt) {
    return {
      success: true,
      translatedText: text,
      sourceLanguage,
      targetLanguage,
      original: text,
      translated: text
    };
  }

  const translated = await translate(text, src, tgt);
  return {
    success: true,
    translatedText: translated,
    sourceLanguage,
    targetLanguage,
    original: text,
    translated
  };
}

export function listLanguages() {
  return supportedLanguages().map((code) => ({ code, label: LANGUAGE_LABELS[code] || code }));
}
