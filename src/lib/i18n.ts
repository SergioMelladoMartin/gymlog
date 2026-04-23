// Minimal i18n for the app. Not every string is covered — just the ones
// that most directly shape the user journey. Defaults to Spanish since
// that's how the owner and his girlfriend are using it; English is the
// "switch me" option in Settings.

export type Lang = 'es' | 'en';

const LS_KEY = 'gymlog-lang';

type Dict = Record<string, string>;

const ES: Dict = {
  // Nav + layout
  'nav.today': 'Hoy',
  'nav.calendar': 'Calendario',
  'nav.diary': 'Diario',
  'nav.exercises': 'Ejercicios',
  'nav.stats': 'Estadísticas',
  'nav.login': 'Acceso',
  'nav.settings': 'Ajustes',
  'nav.profile': 'Perfil',

  // Generic
  'action.save': 'Guardar',
  'action.saving': 'Guardando…',
  'action.cancel': 'Cancelar',
  'action.close': 'Cerrar',
  'action.delete': 'Borrar',
  'action.deleting': 'Borrando…',
  'action.edit': 'Editar',
  'action.back': 'Volver',
  'action.confirm': 'Confirmar',
  'action.add': 'Añadir',
  'action.duplicate': 'Duplicar',
  'action.retry': 'Reintentar',

  // Workout logger
  'workout.addExercise': 'Añadir ejercicio',
  'workout.addSet': 'Añadir serie',
  'workout.chooseExercise': 'Elegir ejercicio…',
  'workout.noExercisesTitle': 'Hoy toca empezar 💪',
  'workout.noExercisesBody': 'Añade el primer ejercicio cuando estés listo.',
  'workout.copyYesterday': 'Repetir último entreno',
  'workout.copyYesterdayHint': 'Copiar series de {date}',
  'workout.copying': 'Copiando…',
  'workout.notes': 'Notas del entreno',
  'workout.notesPlaceholder': 'Sensaciones, dolores, nuevos ejercicios…',
  'workout.restTimer': 'Tiempo desde la última serie',
  'workout.newPr': '¡Nueva marca personal!',
  'workout.history': 'histórico →',
  'workout.noSetsYet': 'Sin series aún',
  'workout.confirmDeleteSet': '¿Borrar esta serie?',
  'workout.sets': 'sets',
  'workout.series': 'series',
  'workout.serie': 'serie',

  // Fields
  'field.weight': 'Peso · kg',
  'field.reps': 'Reps',
  'field.duration': 'Duración',
  'field.durationMMSS': 'Duración · mm:ss',
  'field.distanceKm': 'Distancia · km (opcional)',
  'field.km': 'km',

  // Settings
  'settings.title': 'Ajustes',
  'settings.appearance': 'Apariencia',
  'settings.theme': 'Tema',
  'settings.themeDark': 'Oscuro',
  'settings.themeLight': 'Claro',
  'settings.accent': 'Color de acento',
  'settings.language': 'Idioma',
  'settings.install': 'Instalar app',
  'settings.installCta': 'Instalar',
  'settings.installBlurb':
    'Instala gymlog como app nativa. Se abrirá en su propia ventana sin barra del navegador.',
  'settings.backup': 'Backup',
  'settings.backupBlurb':
    'Reemplaza tu base de datos con un archivo .fitnotes. El nuevo archivo también se subirá a tu Drive.',
  'settings.import': 'Importar backup .fitnotes',
  'settings.importing': 'Importando…',
  'settings.export': 'Exportar backup',
  'settings.exporting': 'Preparando…',
  'settings.signOut': 'Cerrar sesión',

  // Profile
  'profile.title': 'Perfil',
  'profile.days': 'Días',
  'profile.sets': 'Sets',
  'profile.exercises': 'Ejercicios',
  'profile.volume': 'Volumen',
  'profile.firstWorkout': 'Primer entreno',
  'profile.lastWorkout': 'Último entreno',
  'profile.streak': 'Racha',
  'profile.streakWeeks': '{n} sem',
  'profile.streakWeek': '{n} sem',
  'profile.connectedGoogle': 'Conectado con Google',
  'profile.register': 'Registro',

  // Sync
  'sync.synced': 'Sincronizado',
  'sync.syncing': 'Subiendo…',
  'sync.dirty': 'Cambios sin subir',
  'sync.error': 'Error al sincronizar',
  'sync.offline': 'Sin conexión',
  'sync.justNow': 'ahora',
  'sync.minAgo': 'hace {n} min',
  'sync.hourAgo': 'hace {n} h',

  // Onboarding
  'onb.step1Title': 'Bienvenido a gymlog',
  'onb.step1Body':
    'Registra tus series, pesos y reps. Cada día es una nueva página en blanco — empieza con "Añadir ejercicio".',
  'onb.step2Title': 'Tus récords son tuyos',
  'onb.step2Body':
    'Cuando bates tu peso máximo, tu 1RM estimado o tu número de reps a un peso, gymlog lo detecta y te lo celebra con una medallita.',
  'onb.step3Title': 'En tu Drive, siempre',
  'onb.step3Body':
    'Tus datos viven en tu Google Drive (carpeta oculta). Puedes usar gymlog en el móvil y en el ordenador y verás lo mismo.',
  'onb.skip': 'Saltar',
  'onb.next': 'Siguiente',
  'onb.start': 'Empezar',
};

const EN: Dict = {
  'nav.today': 'Today',
  'nav.calendar': 'Calendar',
  'nav.diary': 'Diary',
  'nav.exercises': 'Exercises',
  'nav.stats': 'Stats',
  'nav.login': 'Sign in',
  'nav.settings': 'Settings',
  'nav.profile': 'Profile',

  'action.save': 'Save',
  'action.saving': 'Saving…',
  'action.cancel': 'Cancel',
  'action.close': 'Close',
  'action.delete': 'Delete',
  'action.deleting': 'Deleting…',
  'action.edit': 'Edit',
  'action.back': 'Back',
  'action.confirm': 'Confirm',
  'action.add': 'Add',
  'action.duplicate': 'Duplicate',
  'action.retry': 'Retry',

  'workout.addExercise': 'Add exercise',
  'workout.addSet': 'Add set',
  'workout.chooseExercise': 'Pick an exercise…',
  'workout.noExercisesTitle': 'Fresh start 💪',
  'workout.noExercisesBody': 'Add your first exercise when you are ready.',
  'workout.copyYesterday': 'Repeat last workout',
  'workout.copyYesterdayHint': 'Copy sets from {date}',
  'workout.copying': 'Copying…',
  'workout.notes': 'Workout notes',
  'workout.notesPlaceholder': 'How did it feel, aches, new exercises…',
  'workout.restTimer': 'Time since your last set',
  'workout.newPr': 'New personal record!',
  'workout.history': 'history →',
  'workout.noSetsYet': 'No sets yet',
  'workout.confirmDeleteSet': 'Delete this set?',
  'workout.sets': 'sets',
  'workout.series': 'sets',
  'workout.serie': 'set',

  'field.weight': 'Weight · kg',
  'field.reps': 'Reps',
  'field.duration': 'Duration',
  'field.durationMMSS': 'Duration · mm:ss',
  'field.distanceKm': 'Distance · km (optional)',
  'field.km': 'km',

  'settings.title': 'Settings',
  'settings.appearance': 'Appearance',
  'settings.theme': 'Theme',
  'settings.themeDark': 'Dark',
  'settings.themeLight': 'Light',
  'settings.accent': 'Accent color',
  'settings.language': 'Language',
  'settings.install': 'Install app',
  'settings.installCta': 'Install',
  'settings.installBlurb':
    'Install gymlog as a native app. It opens in its own window without the browser bar.',
  'settings.backup': 'Backup',
  'settings.backupBlurb':
    'Replace your database with a .fitnotes file. The new file will also be uploaded to your Drive.',
  'settings.import': 'Import .fitnotes backup',
  'settings.importing': 'Importing…',
  'settings.export': 'Export backup',
  'settings.exporting': 'Preparing…',
  'settings.signOut': 'Sign out',

  'profile.title': 'Profile',
  'profile.days': 'Days',
  'profile.sets': 'Sets',
  'profile.exercises': 'Exercises',
  'profile.volume': 'Volume',
  'profile.firstWorkout': 'First workout',
  'profile.lastWorkout': 'Last workout',
  'profile.streak': 'Streak',
  'profile.streakWeeks': '{n} wk',
  'profile.streakWeek': '{n} wk',
  'profile.connectedGoogle': 'Connected with Google',
  'profile.register': 'Log',

  'sync.synced': 'Synced',
  'sync.syncing': 'Uploading…',
  'sync.dirty': 'Unsaved changes',
  'sync.error': 'Sync error',
  'sync.offline': 'Offline',
  'sync.justNow': 'just now',
  'sync.minAgo': '{n} min ago',
  'sync.hourAgo': '{n} h ago',

  'onb.step1Title': 'Welcome to gymlog',
  'onb.step1Body':
    'Log your sets, weights and reps. Each day starts blank — tap "Add exercise" to begin.',
  'onb.step2Title': 'Your records, yours',
  'onb.step2Body':
    'When you beat your top weight, your estimated 1RM or your reps at a given weight, gymlog spots it and marks it with a medal.',
  'onb.step3Title': 'On your Drive, always',
  'onb.step3Body':
    'Your data lives in a hidden folder of your Google Drive. You can use gymlog on your phone and your desktop and see the same sets everywhere.',
  'onb.skip': 'Skip',
  'onb.next': 'Next',
  'onb.start': 'Get started',
};

const DICTS: Record<Lang, Dict> = { es: ES, en: EN };

let current: Lang = 'es';
const listeners = new Set<(l: Lang) => void>();

if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem(LS_KEY) as Lang | null;
    if (stored === 'es' || stored === 'en') current = stored;
  } catch {}
}

export function getLang(): Lang {
  return current;
}

export function setLang(next: Lang): void {
  current = next;
  try { localStorage.setItem(LS_KEY, next); } catch {}
  try { document.documentElement.setAttribute('lang', next); } catch {}
  for (const l of listeners) l(next);
}

export function onLangChange(fn: (l: Lang) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const dict = DICTS[current] ?? ES;
  let s = dict[key] ?? ES[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  }
  return s;
}
