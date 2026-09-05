import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../hooks/useT';

type NavKey = 'today' | 'calendar' | 'diary' | 'exercises' | 'stats';

interface Item { key: NavKey; href: string; labelKey: string; icon: JSX.Element }

const ITEMS: Item[] = [
  {
    key: 'today', href: '/', labelKey: 'tab.today',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6.5 6.5 11 11" /><path d="m21 21-1-1" /><path d="m3 3 1 1" />
        <path d="m18 22 4-4" /><path d="m2 6 4-4" /><path d="m3 10 7-7" /><path d="m14 21 7-7" />
      </svg>
    ),
  },
  {
    key: 'calendar', href: '/calendar', labelKey: 'tab.calendar',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" />
      </svg>
    ),
  },
  {
    key: 'diary', href: '/diary', labelKey: 'tab.diary',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      </svg>
    ),
  },
  {
    key: 'exercises', href: '/exercises', labelKey: 'tab.exercises',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 6.5h11" /><path d="M6.5 17.5h11" />
        <path d="M3 10v4" /><path d="M21 10v4" />
        <path d="M6.5 6.5v11" /><path d="M17.5 6.5v11" />
      </svg>
    ),
  },
  {
    key: 'stats', href: '/stats', labelKey: 'tab.stats',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" /><path d="m7 14 4-4 4 4 5-5" />
      </svg>
    ),
  },
];

interface Props {
  active: NavKey;
}

/**
 * Fixed bottom tab bar, mobile only (<1024px). Rendered through a portal at
 * <body> level — the header uses `glass-bar` (backdrop-filter), which turns
 * it into a containing block for descendant `position: fixed` elements, so
 * a fixed bar declared inside it would be trapped there instead of pinned
 * to the viewport. See the note in global.css.
 */
export default function BottomNav({ active }: Props) {
  const { t } = useT();
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    document.addEventListener('astro:after-swap', update);
    document.addEventListener('astro:page-load', update);
    window.addEventListener('pageshow', update);
    return () => {
      mq.removeEventListener('change', update);
      document.removeEventListener('astro:after-swap', update);
      document.removeEventListener('astro:page-load', update);
      window.removeEventListener('pageshow', update);
    };
  }, []);

  if (!mounted || isDesktop) return null;

  return createPortal(
    <nav
      className="glass-bar fixed inset-x-0 bottom-0 z-40 border-t border-border/60"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label={t('nav.today')}
    >
      <div className="mx-auto flex max-w-3xl items-stretch justify-around px-1">
        {ITEMS.map((item) => {
          const isActive = item.key === active;
          return (
            <a
              key={item.key}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition ${
                isActive ? 'text-fg' : 'text-muted'
              }`}
            >
              <span className={`relative grid place-items-center rounded-xl px-3 py-1 ${isActive ? 'accent-glow text-accent' : ''}`}>
                {item.icon}
              </span>
              <span className="truncate">{t(item.labelKey)}</span>
              <span
                className="h-1 w-1 rounded-full bg-accent transition-opacity"
                style={{ opacity: isActive ? 1 : 0 }}
                aria-hidden="true"
              />
            </a>
          );
        })}
      </div>
    </nav>,
    document.body,
  );
}
