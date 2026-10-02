// Main sections, shared by the desktop sidebar and the mobile tab bar.

import type { ReactElement } from 'react';

export type NavKey = 'today' | 'calendar' | 'diary' | 'exercises' | 'stats';

export interface NavItem {
  key: NavKey;
  href: string;
  labelKey: string;
  /** Shorter label for the tab bar, where width is tight. */
  shortLabelKey?: string;
  icon: (size: number) => ReactElement;
}

function svg(size: number, children: ReactElement) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const NAV_ITEMS: NavItem[] = [
  {
    key: 'today', href: '/', labelKey: 'nav.today',
    icon: (s) => svg(s, <>
      <path d="m6.5 6.5 11 11" /><path d="m21 21-1-1" /><path d="m3 3 1 1" />
      <path d="m18 22 4-4" /><path d="m2 6 4-4" /><path d="m3 10 7-7" /><path d="m14 21 7-7" />
    </>),
  },
  {
    key: 'calendar', href: '/calendar', labelKey: 'nav.calendar',
    icon: (s) => svg(s, <>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" />
    </>),
  },
  {
    key: 'diary', href: '/diary', labelKey: 'nav.diary',
    icon: (s) => svg(s, <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />),
  },
  {
    key: 'exercises', href: '/exercises', labelKey: 'nav.exercises',
    icon: (s) => svg(s, <>
      <path d="M6.5 6.5h11" /><path d="M6.5 17.5h11" />
      <path d="M3 10v4" /><path d="M21 10v4" />
      <path d="M6.5 6.5v11" /><path d="M17.5 6.5v11" />
    </>),
  },
  {
    key: 'stats', href: '/stats', labelKey: 'nav.stats', shortLabelKey: 'nav.statsShort',
    icon: (s) => svg(s, <><path d="M3 3v18h18" /><path d="m7 14 4-4 4 4 5-5" /></>),
  },
];
