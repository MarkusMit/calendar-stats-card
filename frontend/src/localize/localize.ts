import en from '../translations/en.json';
import de from '../translations/de.json';

type TranslationDict = Record<string, unknown>;

const translations: Record<string, TranslationDict> = {
  en,
  de,
};

export function localize(key: string, language: string): string {
  const dict = translations[language] ?? translations['en'];
  const fallback = translations['en']!;
  const parts = key.split('.');

  let current: unknown = dict;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      current = undefined;
      break;
    }
    current = (current as Record<string, unknown>)[part];
  }

  if (typeof current === 'string') return current;

  // Try fallback language
  let fallbackCurrent: unknown = fallback;
  for (const part of parts) {
    if (fallbackCurrent == null || typeof fallbackCurrent !== 'object') {
      fallbackCurrent = undefined;
      break;
    }
    fallbackCurrent = (fallbackCurrent as Record<string, unknown>)[part];
  }

  if (typeof fallbackCurrent === 'string') return fallbackCurrent;

  return key;
}
