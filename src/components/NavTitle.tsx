import { useT } from '../hooks/useT';

type NavKey = 'today' | 'calendar' | 'diary' | 'stats' | 'exercises' | 'login';

const NAV_KEYS: Record<NavKey, string> = {
  today: 'nav.today',
  calendar: 'nav.calendar',
  diary: 'nav.diary',
  exercises: 'nav.exercises',
  stats: 'nav.stats',
  login: 'nav.login',
};

interface Props {
  active: NavKey;
}

/** Header page title — reactive to language changes. */
export default function NavTitle({ active }: Props) {
  const { t } = useT();
  return (
    <span className="truncate text-[15px] font-semibold tracking-tight">
      {t(NAV_KEYS[active])}
    </span>
  );
}
