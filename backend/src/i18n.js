import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPPORTED_LANGUAGES = ['en', 'sv'];
const DEFAULT_LANGUAGE = 'en';

// Load all translations at startup
const translations = {};
for (const lang of SUPPORTED_LANGUAGES) {
  try {
    const filePath = join(__dirname, 'locales', `${lang}.json`);
    translations[lang] = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`Failed to load translations for ${lang}:`, err.message);
    translations[lang] = {};
  }
}

// Get translation for a key in a specific language
export function t(key, lang = DEFAULT_LANGUAGE) {
  const language = SUPPORTED_LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;
  return translations[language]?.[key] || translations[DEFAULT_LANGUAGE]?.[key] || key;
}

// Middleware to extract language from request
export function i18nMiddleware(req, res, next) {
  // Check Accept-Language header or query parameter
  const langParam = req.query.lang;
  const acceptLanguage = req.headers['accept-language']?.split(',')[0]?.split('-')[0];

  req.lang = SUPPORTED_LANGUAGES.includes(langParam)
    ? langParam
    : SUPPORTED_LANGUAGES.includes(acceptLanguage)
      ? acceptLanguage
      : DEFAULT_LANGUAGE;

  // Helper function to get translations
  req.t = (key) => t(key, req.lang);

  next();
}

export { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE };
