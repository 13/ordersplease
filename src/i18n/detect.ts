export const SUPPORTED = ['en', 'de'] as const;
export type Locale = (typeof SUPPORTED)[number];
export type LocalePref = Locale | 'auto';
export const FALLBACK: Locale = 'en';

/** Endonyms — shown as-is in Settings, never translated. */
export const LANG_NAMES: Record<Locale, string> = { en: 'English', de: 'Deutsch' };

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (SUPPORTED as readonly string[]).includes(v);
}

/** First supported language among `tags`, matched on the primary subtag. */
export function pickLocale(tags: readonly string[]): Locale {
  for (const tag of tags) {
    const primary = String(tag ?? '').trim().toLowerCase().split('-')[0];
    if (isLocale(primary)) return primary;
  }
  return FALLBACK;
}

/** pickLocale over navigator.languages, with navigator.language as backup. */
export function detectLocale(): Locale {
  const nav = globalThis.navigator as { languages?: readonly string[]; language?: string } | undefined;
  const tags = nav?.languages?.length ? nav.languages : nav?.language ? [nav.language] : [];
  return pickLocale(tags);
}
