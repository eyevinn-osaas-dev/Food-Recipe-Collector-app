// Internationalization module
const SUPPORTED_LANGUAGES = ['en', 'sv'];
const DEFAULT_LANGUAGE = 'en';
const STORAGE_KEY = 'recipe-vault-lang';

let currentLanguage = DEFAULT_LANGUAGE;
let translations = {};

// Get nested value from object using dot notation
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Initialize i18n - load saved language preference and translations
export async function initI18n() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
    currentLanguage = saved;
  } else {
    // Try to detect browser language
    const browserLang = navigator.language?.split('-')[0];
    if (browserLang && SUPPORTED_LANGUAGES.includes(browserLang)) {
      currentLanguage = browserLang;
    }
  }

  await loadTranslations(currentLanguage);
  return currentLanguage;
}

// Load translations for a language
async function loadTranslations(lang) {
  try {
    const response = await fetch(`locales/${lang}.json`);
    translations = await response.json();
  } catch (err) {
    console.error(`Failed to load translations for ${lang}:`, err);
    // Fallback to English
    if (lang !== DEFAULT_LANGUAGE) {
      await loadTranslations(DEFAULT_LANGUAGE);
    }
  }
}

// Get translation by key (supports dot notation like "hero.title")
export function t(key, params = {}) {
  let value = getNestedValue(translations, key);

  if (value === undefined) {
    console.warn(`Missing translation for key: ${key}`);
    return key;
  }

  // Replace placeholders like {name} with values from params
  if (typeof value === 'string' && Object.keys(params).length > 0) {
    Object.entries(params).forEach(([param, val]) => {
      value = value.replace(new RegExp(`\\{${param}\\}`, 'g'), val);
    });
  }

  return value;
}

// Change language
export async function setLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    console.error(`Unsupported language: ${lang}`);
    return false;
  }

  currentLanguage = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  await loadTranslations(lang);

  // Update HTML lang attribute
  document.documentElement.lang = lang;

  return true;
}

// Get current language
export function getCurrentLanguage() {
  return currentLanguage;
}

// Get supported languages
export function getSupportedLanguages() {
  return SUPPORTED_LANGUAGES;
}
