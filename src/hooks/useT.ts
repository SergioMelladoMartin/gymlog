import { useEffect, useState } from 'react';
import { getLang, onLangChange, t as translate, type Lang } from '../lib/i18n';

/**
 * Subscribes the calling component to the current language and returns a
 * stable `t(key, vars?)` helper. Re-renders on toggle so strings swap
 * without a page reload.
 */
export function useT(): { t: (key: string, vars?: Record<string, string | number>) => string; lang: Lang } {
  const [lang, setLang] = useState<Lang>(() => getLang());
  useEffect(() => onLangChange(setLang), []);
  return { t: translate, lang };
}
