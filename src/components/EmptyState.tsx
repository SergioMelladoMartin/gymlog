import { useT } from '../hooks/useT';

export type EmptyVariant = 'workout' | 'diary' | 'stats' | 'exercises' | 'search';

interface Props {
  variant: EmptyVariant;
  title?: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}

function Illustration({ variant }: { variant: EmptyVariant }) {
  const common = 'stroke-current stroke-[1.5] fill-none';
  switch (variant) {
    case 'workout':
      return (
        <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true" className="text-accent/70">
          <rect x="8" y="34" width="12" height="12" rx="3" className={common} fill="currentColor" fillOpacity="0.15" />
          <rect x="60" y="34" width="12" height="12" rx="3" className={common} fill="currentColor" fillOpacity="0.15" />
          <line x1="20" y1="40" x2="60" y2="40" className={common} strokeWidth="3" strokeLinecap="round" />
          <circle cx="40" cy="40" r="28" className={common} strokeOpacity="0.35" strokeDasharray="4 6" />
        </svg>
      );
    case 'diary':
      return (
        <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true" className="text-accent/70">
          <rect x="18" y="12" width="44" height="56" rx="6" className={common} fill="currentColor" fillOpacity="0.08" />
          <line x1="28" y1="28" x2="52" y2="28" className={common} strokeOpacity="0.5" />
          <line x1="28" y1="38" x2="48" y2="38" className={common} strokeOpacity="0.35" />
          <line x1="28" y1="48" x2="44" y2="48" className={common} strokeOpacity="0.25" />
          <circle cx="54" cy="54" r="10" className={common} fill="currentColor" fillOpacity="0.2" />
          <path d="M51 54l2 2 5-5" className={common} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'stats':
      return (
        <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true" className="text-accent/70">
          <line x1="14" y1="62" x2="66" y2="62" className={common} strokeOpacity="0.4" />
          <rect x="18" y="42" width="10" height="20" rx="2" className={common} fill="currentColor" fillOpacity="0.25" />
          <rect x="35" y="28" width="10" height="34" rx="2" className={common} fill="currentColor" fillOpacity="0.4" />
          <rect x="52" y="34" width="10" height="28" rx="2" className={common} fill="currentColor" fillOpacity="0.55" />
          <path d="M18 38 L35 30 L52 36 L66 22" className={common} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'exercises':
      return (
        <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true" className="text-accent/70">
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(0 ${i * 18})`}>
              <circle cx="22" cy="22" r="6" className={common} fill="currentColor" fillOpacity={0.2 - i * 0.05} />
              <line x1="32" y1="22" x2="58" y2="22" className={common} strokeOpacity={0.5 - i * 0.1} />
            </g>
          ))}
        </svg>
      );
    case 'search':
      return (
        <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true" className="text-accent/70">
          <circle cx="36" cy="36" r="18" className={common} fill="currentColor" fillOpacity="0.08" />
          <line x1="48" y1="48" x2="62" y2="62" className={common} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M28 36h16M36 28v16" className={common} strokeOpacity="0.3" strokeLinecap="round" transform="rotate(45 36 36)" />
        </svg>
      );
  }
}

export default function EmptyState({ variant, title, body, action, className = '' }: Props) {
  const { t } = useT();
  const resolvedTitle = title ?? t(`empty.${variant}.title`);
  const resolvedBody = body ?? t(`empty.${variant}.body`);

  return (
    <div className={`empty-state flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-10 text-center ${className}`}>
      <div className="empty-state-icon grid place-items-center rounded-2xl bg-accent-soft p-4">
        <Illustration variant={variant} />
      </div>
      <div className="text-base font-semibold tracking-tight text-fg">{resolvedTitle}</div>
      <p className="max-w-xs text-sm text-muted">{resolvedBody}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
