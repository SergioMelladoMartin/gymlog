import { getLang, type Lang } from './i18n';

export function getLocale(lang?: Lang): string {
  const l = lang ?? getLang();
  return l === 'en' ? 'en-US' : 'es-ES';
}

export function formatNumber(n: number, lang?: Lang): string {
  return Math.round(n).toLocaleString(getLocale(lang));
}

export function formatDateISO(
  iso: string,
  options: Intl.DateTimeFormatOptions,
  lang?: Lang,
): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(getLocale(lang), options);
}

/** Monday-based weekday labels starting Monday (index 0 = Mon). */
export function getWeekdayLabels(
  lang: Lang,
  format: 'short' | 'long' | 'narrow',
): string[] {
  const locale = getLocale(lang);
  // 2024-01-01 is a Monday.
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 1 + i);
    let s = d.toLocaleDateString(locale, { weekday: format });
    if (format === 'short') s = s.replace('.', '');
    return s;
  });
}

/** SQLite strftime('%w') order: Sun=0 … Sat=6 → Mon-first array index. */
export function weekdayFromSqliteDow(dow: number, lang: Lang, format: 'short' | 'long' | 'narrow'): string {
  const labels = getWeekdayLabels(lang, format);
  const idx = dow === 0 ? 6 : dow - 1;
  return labels[idx] ?? '';
}

export type ThemeMode = 'dark' | 'light' | 'amoled';

export const THEMES: ThemeMode[] = ['dark', 'light', 'amoled'];

export function themeColor(mode: ThemeMode): string {
  if (mode === 'amoled') return '#000000';
  if (mode === 'light') return '#eef0f5';
  return '#0f0f15';
}
