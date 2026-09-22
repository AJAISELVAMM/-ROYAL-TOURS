// ============================================================================
// translationService — multilingual translation against the TourGuard AI backend.
// ============================================================================

import { api } from './api.js';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi (हिन्दी)' },
  { code: 'bn', label: 'Bengali (বাংলা)' },
  { code: 'ur', label: 'Urdu (اردو)' },
  { code: 'ta', label: 'Tamil (தமிழ்)' },
  { code: 'ml', label: 'Malayalam (മലയാളം)' },
  { code: 'kn', label: 'Kannada (ಕನ್ನಡ)' },
  { code: 'te', label: 'Telugu (తెలుగు)' },
  { code: 'mr', label: 'Marathi (मराठी)' },
  { code: 'gu', label: 'Gujarati (ગુજરાતી)' },
  { code: 'pa', label: 'Punjabi (ਪੰਜਾਬੀ)' },
  { code: 'or', label: 'Odia (ଓଡ଼ିଆ)' },
  { code: 'as', label: 'Assamese (অসমীয়া)' }
];

export async function translate(text, targetCode, sourceCode = 'en') {
  if (!text?.trim()) return '';
  if (targetCode === sourceCode) return text;

  const data = await api.post('/translate', {
    text,
    sourceLanguage: sourceCode,
    targetLanguage: targetCode
  });
  return data.translatedText || data.translated || '';
}

export async function getLanguages() {
  try {
    const res = await api.get('/translation/languages');
    if (Array.isArray(res)) return res;
    if (res?.languages && Array.isArray(res.languages)) return res.languages;
    return LANGUAGES;
  } catch {
    return LANGUAGES;
  }
}
