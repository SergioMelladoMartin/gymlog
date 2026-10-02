import { useEffect, useState } from 'react';
import { useT } from '../hooks/useT';
import { NAV_ITEMS, type NavKey } from './navItems';

interface Props {
  active: NavKey | 'profile' | 'settings';
}

function isTextField(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLInputElement) {
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'file', 'color'].includes(el.type);
  }
  return el.matches('textarea, select, [contenteditable="true"]');
}

/**
 * Floating bottom tab bar, iOS style, for phones and tablets (<1024px; the
 * desktop keeps the sidebar). Lives at <body> level in the layout: inside the
 * backdrop-filtered header a `position: fixed` element would be trapped.
 */
export default function TabBar({ active }: Props) {
  const { t } = useT();
  const [typing, setTyping] = useState(false);

  // Slide away while a field has focus: on iOS the fixed bar rides up with
  // the keyboard and would cover the inputs being edited.
  useEffect(() => {
    const onIn = (e: FocusEvent) => { if (isTextField(e.target)) setTyping(true); };
    const onOut = () => { setTimeout(() => setTyping(isTextField(document.activeElement)), 0); };
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, []);

  return (
    <nav
      aria-label={t('nav.main')}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 transition-transform duration-200 ease-out lg:hidden"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)',
        transform: typing ? 'translateY(calc(100% + 1rem))' : undefined,
      }}
    >
      <div
        className="pointer-events-auto mx-auto flex max-w-md items-stretch gap-0.5 rounded-full border border-border p-1.5"
        style={{
          background: 'color-mix(in srgb, var(--color-bg) 88%, transparent)',
          backdropFilter: 'blur(24px) saturate(var(--glass-saturate))',
          WebkitBackdropFilter: 'blur(24px) saturate(var(--glass-saturate))',
          boxShadow: 'var(--shadow-float)',
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === active;
          return (
            <a
              key={item.key}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full px-1 py-1.5 text-[10px] font-semibold leading-none transition-colors ${
                isActive ? 'btn-accent' : 'text-muted active:bg-elevated/70'
              }`}
            >
              {item.icon(22)}
              <span className="max-w-full truncate">{t(item.shortLabelKey ?? item.labelKey)}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
