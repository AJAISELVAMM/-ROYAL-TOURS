// =============================================================================
// translationProvider.js — High-performance Multilingual Translation Provider.
// Multi-tier pipeline:
// 1. In-memory LRU cache (< 1ms)
// 2. High-speed phrase dictionary (< 2ms)
// 3. LibreTranslate / Argos models (if LIBRETRANSLATE_URL configured)
// 4. ML Service (FastAPI translation engine on Render)
// 5. Google Gemini (using valid gemini-2.5-flash / gemini-1.5-flash models)
// 6. MyMemory translation fallback
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

// In-memory cache for ultra-fast repeated queries (max 500 items)
const translationCache = new Map();

function getCachedTranslation(key) {
  return translationCache.get(key) || null;
}

function setCachedTranslation(key, val) {
  if (translationCache.size >= 500) {
    const firstKey = translationCache.keys().next().value;
    translationCache.delete(firstKey);
  }
  translationCache.set(key, val);
}

// Built-in tourist & safety phrases dictionary for instant sub-millisecond translations
const PHRASE_DICTIONARY = {
  'where is the nearest hospital?': {
    ta: 'அருகிலுள்ள மருத்துவமனை எங்குள்ளது?',
    hi: 'निकटतम अस्पताल कहाँ है?',
    te: 'సమీపంలోని ఆసుపత్రి ఎక్కడ ఉంది?',
    ml: 'ഏറ്റവും അടുത്തുള്ള ആശുപത്രി എവിടെയാണ്?',
    kn: 'ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆ ಎಲ್ಲಿದೆ?',
    bn: 'নিকটতম হাসপাতালটি কোথায়?'
  },
  'how much is the fare to the railway station?': {
    ta: 'ரயில் நிலையத்திற்கு கட்டணம் எவ்வளவு?',
    hi: 'रेलवे स्टेशन का किराया कितना है?',
    te: 'రైల్వే స్టేషన్‌కు ఛార్జీ ఎంత?',
    ml: 'റെയിൽവേ സ്റ്റേഷനിലേക്ക് എത്ര രൂപയാണ് ചാർജ്ജ്?',
    kn: 'ರೈಲ್ವೆ ನಿಲ್ದಾಣಕ್ಕೆ ದರ ಎಷ್ಟು?',
    bn: 'রেলওয়ে স্টেশনের ভাড়া কত?'
  },
  'i need immediate police assistance.': {
    ta: 'எனக்கு உடனடியாக காவல் உதவி தேவை.',
    hi: 'मुझे तुरंत पुलिस सहायता चाहिए।',
    te: 'నాకు తక్షణమే పోలీసు సహాయం కావాలి.',
    ml: 'എനിക്ക് അടിയന്തിരമായി പോലീസ് സഹായം വേണം.',
    kn: 'ನನಗೆ ತಕ್ಷಣ ಪೊಲೀಸ್ ನೆರವು ಬೇಕು.',
    bn: 'আমার অবিলম্বে পুলিশি সাহায্য প্রয়োজন।'
  },
  'can you please help me find this address?': {
    ta: 'தயவுசெய்து இந்த முகவரியைக் கண்டுபிடிக்க எனக்கு உதவ முடியுமா?',
    hi: 'क्या आप कृपया मुझे यह पता खोजने में मदद कर सकते हैं?',
    te: 'దయచేసి ఈ చిరునామాను కనుగొనడంలో నాకు సహాయం చేయగలరా?',
    ml: 'ദയവായി ഈ വിലാസം കണ്ടെത്താൻ എന്നെ സഹായിക്കാമോ?',
    kn: 'ದಯವಿಟ್ಟು ಈ ವಿಳಾಸವನ್ನು ಹುಡುಕಲು ನನಗೆ ಸಹಾಯ ಮಾಡುವಿರಾ?',
    bn: 'আপনি কি দয়া করে এই ঠিকানাটি খুঁজে পেতে আমাকে সাহায্য করতে পারেন?'
  },
  'where is the nearest pharmacy or doctor?': {
    ta: 'அருகிலுள்ள மருந்தகம் அல்லது மருத்துவர் எங்குள்ளார்?',
    hi: 'निकटतम फार्मेसी या डॉक्टर कहाँ है?',
    te: 'సమీపంలోని ఫార్మసీ లేదా డాక్టర్ ఎక్కడ ఉన్నారు?',
    ml: 'ഏറ്റവും അടുത്തുള്ള ഫാർമസി അല്ലെങ്കിൽ ഡോക്ടർ എവിടെയാണ്?',
    kn: 'ಹತ್ತಿರದ ಔಷಧಾಲಯ ಅಥವಾ ವೈದ್ಯರು ಎಲ್ಲಿದ್ದಾರೆ?',
    bn: 'নিকটতম ফার্মেসি বা ডাক্তার কোথায়?'
  },
  'is there a vegetarian restaurant nearby?': {
    ta: 'அருகில் சைவ உணவகம் உள்ளதா?',
    hi: 'क्या आस-पास कोई शाकाहारी भोजनालय है?',
    te: 'సమీపంలో శాఖాహార రెస్టారెంట్ ఉందా?',
    ml: 'അടുത്തെവിടെയെങ്കിലും സസ്യഭക്ഷണശാല ഉണ്ടോ?',
    kn: 'ಹತ್ತಿರದಲ್ಲಿ ಸಸ್ಯಾಹಾರಿ ಉಪಾಹಾರ ಗೃಹವಿದೆಯೇ?',
    bn: 'কাছে কি কোনো নিরামিষ রেস্তোরাঁ আছে?'
  },
  'help': {
    ta: 'உதவி',
    hi: 'मदद',
    te: 'సహాయం',
    ml: 'സഹായം',
    kn: 'ಸಹಾಯ',
    bn: 'সাহায্য'
  },
  'hello': {
    ta: 'வணக்கம்',
    hi: 'नमस्ते',
    te: 'నమస్కారం',
    ml: 'നമസ്കാരം',
    kn: 'ನಮಸ್ಕಾರ',
    bn: 'নমস্কার'
  },
  'thank you': {
    ta: 'நன்றி',
    hi: 'धन्यवाद',
    te: 'ధన్యవాదాలు',
    ml: 'നന്ദി',
    kn: 'ಧನ್ಯವಾದಗಳು',
    bn: 'ধন্যবাদ'
  },
  'please': {
    ta: 'தயவுசெய்து',
    hi: 'कृपया',
    te: 'దయచేసి',
    ml: 'ദയവായി',
    kn: 'ದಯವಿಟ್ಟು',
    bn: 'দয়া করে'
  }
};

export function isLanguageSupported(code) {
  return SUPPORTED_LANGUAGES.includes(String(code || '').toLowerCase());
}

export function supportedLanguages() {
  return SUPPORTED_LANGUAGES;
}

export function translationConfigured() {
  return true;
}

/**
 * 1. LibreTranslate / Argos Engine
 */
async function translateViaLibreTranslate(text, source, target) {
  const baseUrl = (process.env.LIBRETRANSLATE_URL || config.translation?.libreTranslateUrl || '').trim();
  if (!baseUrl) return null;

  const url = `${baseUrl.replace(/\/+$/, '')}/translate`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source,
        target,
        format: 'text',
        api_key: process.env.LIBRETRANSLATE_API_KEY || undefined
      }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data?.translatedText) {
        return data.translatedText.trim();
      }
    }
  } catch (err) {
    clearTimeout(timer);
    console.warn(`[translationProvider:libretranslate] ${err.message}`);
  }
  return null;
}

/**
 * 2. ML Service Translation Endpoint
 */
async function translateViaMlService(text, source, target) {
  const mlUrl = (config.mlServiceUrl || process.env.ML_SERVICE_URL || 'https://royal-tours-ml.onrender.com').trim();
  if (!mlUrl) return null;

  const url = `${mlUrl.replace(/\/+$/, '')}/translate`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        sourceLanguage: source,
        targetLanguage: target
      }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data?.translated) {
        return data.translated.trim();
      }
    }
  } catch (err) {
    clearTimeout(timer);
    console.warn(`[translationProvider:ml_service] ${err.message}`);
  }
  return null;
}

/**
 * 3. Google Gemini (Valid Models only)
 */
async function translateViaGemini(text, source, target) {
  const apiKey = (process.env.GEMINI_API_KEY || config.translation?.geminiApiKey || '').trim();
  if (!apiKey) return null;

  const sourceName = LANGUAGE_LABELS[source] || source;
  const targetName = LANGUAGE_LABELS[target] || target;

  const prompt = `You are a professional, accurate translator.
Translate the following text from ${sourceName} (${source}) to ${targetName} (${target}).

STRICT RULES:
1. Output ONLY the raw translated text.
2. Absolutely NO notes, NO explanation, NO introduction, NO romanized pronunciation.
3. Do NOT wrap the translation in quotation marks.
4. Do NOT use markdown code blocks.
5. Preserve all original paragraphs, punctuation, numbers, and formatting.

Text to translate:
${text}`;

  // Valid official Google Gemini models
  const configuredModel = (process.env.GEMINI_MODEL || config.translation?.geminiModel || '').trim();
  const modelsToTry = [
    configuredModel,
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-2.0-flash'
  ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      if (res.ok) {
        const data = await res.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText && typeof candidateText === 'string') {
          let translated = candidateText.trim();
          if ((translated.startsWith('"') && translated.endsWith('"')) || (translated.startsWith("'") && translated.endsWith("'"))) {
            translated = translated.slice(1, -1).trim();
          }
          return translated;
        }
      }
    } catch (err) {
      clearTimeout(timer);
      console.warn(`[translationProvider:gemini:${model}] ${err.message}`);
    }
  }

  return null;
}

/**
 * 4. Free MyMemory Engine Fallback
 */
async function translateViaMyMemory(text, source, target) {
  const langpair = `${source}|${target}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TourGuard-AI/1.0 (Tourist Safety & Translation Assistant)' },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const translated = (data?.responseData?.translatedText || '').trim();
      if (translated && !translated.toLowerCase().includes('my memory') && !translated.startsWith('QUERY LENGTH LIMIT')) {
        return translated;
      }
    }
  } catch (err) {
    clearTimeout(timer);
    console.warn(`[translationProvider:mymemory] ${err.message}`);
  }
  return null;
}

export async function fetchLibreTranslateLanguages() {
  return SUPPORTED_LANGUAGES.map((code) => ({
    code,
    label: LANGUAGE_LABELS[code] || code
  }));
}

/**
 * Master translate function with instant fallback and caching
 */
export async function translate(text, source = 'en', target = 'ta') {
  const q = String(text || '').trim();
  if (!q) return '';
  const src = source.toLowerCase();
  const tgt = target.toLowerCase();

  if (src === tgt) return q;

  // 1. Check cache
  const cacheKey = `${src}:${tgt}:${q}`;
  const cached = getCachedTranslation(cacheKey);
  if (cached) return cached;

  // 2. Check phrase dictionary for instant response
  const lowerQ = q.toLowerCase();
  if (PHRASE_DICTIONARY[lowerQ]?.[tgt]) {
    const dictMatch = PHRASE_DICTIONARY[lowerQ][tgt];
    setCachedTranslation(cacheKey, dictMatch);
    return dictMatch;
  }

  // 3. Try LibreTranslate (if configured)
  const libreResult = await translateViaLibreTranslate(q, src, tgt);
  if (libreResult) {
    setCachedTranslation(cacheKey, libreResult);
    return libreResult;
  }

  // 4. Try ML Service
  const mlResult = await translateViaMlService(q, src, tgt);
  if (mlResult) {
    setCachedTranslation(cacheKey, mlResult);
    return mlResult;
  }

  // 5. Try Google Gemini
  const geminiResult = await translateViaGemini(q, src, tgt);
  if (geminiResult) {
    setCachedTranslation(cacheKey, geminiResult);
    return geminiResult;
  }

  // 6. Try MyMemory
  const myMemoryResult = await translateViaMyMemory(q, src, tgt);
  if (myMemoryResult) {
    setCachedTranslation(cacheKey, myMemoryResult);
    return myMemoryResult;
  }

  // If all online services fail or time out, return the original text with warning
  throw serviceUnavailable('Translation service is temporarily busy. Please try again in a moment.', 'TRANSLATION_TIMEOUT');
}
