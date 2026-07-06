import { useMemo } from 'react';
import { useT } from './useT';
import {
  formatDateISO,
  formatNumber,
  getLocale,
  getWeekdayLabels,
  weekdayFromSqliteDow,
} from '../lib/locale';

export function useLocale() {
  const { t, lang } = useT();
  const locale = getLocale(lang);

  return useMemo(
    () => ({
      t,
      lang,
      locale,
      fmt: (n: number) => formatNumber(n, lang),
      fmtDate: (iso: string, options: Intl.DateTimeFormatOptions) =>
        formatDateISO(iso, options, lang),
      weekdaysShort: () => getWeekdayLabels(lang, 'short'),
      weekdaysLong: () => getWeekdayLabels(lang, 'long'),
      weekdaysNarrow: () => getWeekdayLabels(lang, 'narrow'),
      weekdayFromDow: (dow: number, format: 'short' | 'long' | 'narrow' = 'long') =>
        weekdayFromSqliteDow(dow, lang, format),
    }),
    [t, lang, locale],
  );
}
