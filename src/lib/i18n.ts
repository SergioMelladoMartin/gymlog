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
  'action.loading': 'Cargando…',
  'action.create': 'Crear',
  'action.creating': 'Creando…',
  'action.clear': 'Limpiar',
  'action.openMenu': 'Abrir menú',
  'action.closeMenu': 'Cerrar menú',
  'action.collapseNav': 'Replegar barra',
  'action.expandNav': 'Expandir barra',
  'action.goHome': 'Ir a Hoy',

  'common.user': 'Usuario',
  'common.noData': 'Sin datos.',
  'common.error': 'Error',
  'common.errorCreateExercise': 'Error al crear ejercicio',
  'common.errorImport': 'Error al importar backup',
  'common.errorExport': 'Error al exportar',
  'common.errorSave': 'Error al guardar',
  'common.errorDelete': 'Error al borrar',
  'common.kg': 'kg',
  'common.exercisesShort': 'ej',
  'common.top': 'top',

  // Day view
  'day.todayBadge': 'Hoy',
  'day.prevDay': 'Día anterior',
  'day.nextDay': 'Día siguiente',
  'day.personalRecord': 'Récord personal',
  'day.exercises': 'ejercicios',
  'day.volume': 'volumen',
  'day.startToday': 'Añade un ejercicio para empezar',
  'day.noWorkout': 'Sin entreno este día',
  'day.backToToday': '← volver a hoy',

  // Calendar
  'calendar.prevYear': 'Año anterior',
  'calendar.nextYear': 'Año siguiente',
  'calendar.prevMonth': 'Mes anterior',
  'calendar.nextMonth': 'Mes siguiente',
  'calendar.month': 'Mes',
  'calendar.year': 'Año',
  'calendar.days': 'Días',
  'calendar.volume': 'Volumen',
  'calendar.record': 'Récord',
  'calendar.trainedTooltip': '{date} — {sets} sets{pr}',
  'calendar.restTooltip': '{date} — sin entreno',
  'calendar.prSuffix': ' · récord',

  // Diary
  'diary.history': 'Histórico',
  'diary.title': 'Diario',
  'diary.home': 'Inicio',
  'diary.empty': 'No hay entrenos registrados todavía.',
  'diary.summary': '{ex} ej · {sets} sets · {vol} kg',
  'diary.setTop': '{sets}× · top {weight}×{reps}',
  'diary.newer': 'Más recientes',
  'diary.backHome': 'Volver al inicio',
  'diary.older': 'Más antiguos',

  // Stats
  'stats.subtitle': 'Tu progreso',
  'stats.title': 'Estadísticas',
  'stats.evolution': 'Evolución · {period}',
  'stats.weeks': '{n} semanas',
  'stats.months': '{n} meses',
  'stats.week': 'Semana',
  'stats.month': 'Mes',
  'stats.periodSummary': 'Resumen del periodo',
  'stats.range7d': 'Últimos 7 días',
  'stats.range30d': 'Últimos 30 días',
  'stats.range90d': 'Últimos 90 días',
  'stats.range365d': 'Últimos 12 meses',
  'stats.rangeYear': 'Año en curso',
  'stats.rangeYearNamed': 'Año {year}',
  'stats.rangeAll': 'Todo el histórico',
  'stats.chip7d': '7d',
  'stats.chip30d': '30d',
  'stats.chip90d': '90d',
  'stats.chip1y': '1a',
  'stats.chipYtd': 'YTD',
  'stats.chipAll': 'Todo',
  'stats.metricWorkouts': 'Entrenos',
  'stats.metricVolume': 'Volumen',
  'stats.metricSets': 'Series',
  'stats.metricReps': 'Reps',
  'stats.weeklyDistribution': 'Distribución semanal',
  'stats.volumeByCategory': 'Volumen por categoría',
  'stats.categoryVolume': '{vol} kg · {sets} sets',
  'stats.topExercises': 'Top 10 ejercicios',

  // Exercises
  'exercises.catalog': 'Catálogo',
  'exercises.title': 'Ejercicios',
  'exercises.groups': 'Grupos',
  'exercises.create': 'Crear ejercicio',
  'exercises.newExercise': 'Nuevo ejercicio',
  'exercises.pickGroup': 'Elige un grupo muscular para ver sus ejercicios',
  'exercises.pickGroupShort': 'Elige un grupo muscular',
  'exercises.count': '{n} ejercicios',
  'exercises.searchPlaceholder': 'Buscar ejercicio…',
  'exercises.searchInGroup': 'Buscar en {name}…',
  'exercises.noResults': 'Sin resultados para "{query}"',
  'exercises.emptyGroup': 'Este grupo aún no tiene ejercicios',
  'exercises.backGroups': 'Volver a grupos',
  'exercises.createPlaceholder': 'Ej: Press inclinado (mancuernas)',
  'exercises.createAndOpen': 'Crear y abrir',
  'exercises.createAndSelect': 'Crear y seleccionar',
  'exercises.deleteExercise': 'Borrar ejercicio',
  'exercises.editExercise': 'Editar ejercicio',
  'exercises.viewAll': 'Ver todos los ejercicios ({n})',
  'exercises.muscleGroup': 'Grupo muscular',

  // Exercise detail
  'exercise.sessions': 'Sesiones',
  'exercise.topWeight': 'Top peso',
  'exercise.est1rm': '1RM est.',
  'exercise.progression': 'Progresión',
  'exercise.history': 'Historial',
  'exercise.chartTopSet': 'Top set',
  'exercise.chartVolume': 'Volumen',
  'exercise.chartAll': 'Todo',

  // PR badges
  'pr.weightTitle': 'Peso nuevo desbloqueado',
  'pr.repsTitle': 'Récord de repeticiones',
  'pr.weightLabel': 'W',
  'pr.repsLabel': 'R',

  // Login
  'login.tagline': 'Tus entrenos en tu Google Drive. Sin servidor, sin base de datos, solo tú.',
  'login.google': 'Continuar con Google',
  'login.connecting': 'Conectando…',
  'login.or': 'o',
  'login.uploadHint': 'Sube tu backup .fitnotes',
  'login.uploadCta': 'Subir mi backup .fitnotes a Drive',
  'login.privacy':
    'Con Google: pedimos acceso solo a la carpeta oculta "appdata" de tu Drive. Tus entrenos se guardan en un archivo gymlog.fitnotes compatible con la app FitNotes.',

  // Empty states
  'empty.diary.title': 'Diario vacío',
  'empty.diary.body': 'Cuando registres tu primer entreno aparecerá aquí.',
  'empty.stats.title': 'Sin datos aún',
  'empty.stats.body': 'Registra algunos entrenos para ver estadísticas.',
  'empty.exercises.title': 'Sin ejercicios',
  'empty.exercises.body': 'Crea tu primer ejercicio o importa un backup.',
  'empty.search.title': 'Sin resultados',
  'empty.search.body': 'Prueba con otro término de búsqueda.',

  // Workout logger
  'workout.addExercise': 'Añadir ejercicio',
  'workout.addSet': 'Añadir serie',
  'workout.chooseExercise': 'Elegir ejercicio…',
  'workout.notes': 'Notas del entreno',
  'workout.notesPlaceholder': 'Sensaciones, dolores, nuevos ejercicios…',
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
  'settings.themeAmoled': 'AMOLED',
  'settings.accent': 'Color de acento',
  'settings.accentLime': 'Lima',
  'settings.accentRose': 'Rosa',
  'settings.accentRed': 'Rojo',
  'settings.accentSky': 'Azul',
  'settings.accentViolet': 'Violeta',
  'settings.accentMono': 'Mono',
  'settings.installIos1': '1. Pulsa el botón de Compartir en Safari (el icono con la flecha hacia arriba)',
  'settings.installIos2': '2. Desliza y elige Añadir a pantalla de inicio',
  'settings.installIos3': '3. Pulsa Añadir arriba a la derecha',
  'settings.installAndroid1': '1. Abre el menú ⋮ en Chrome',
  'settings.installAndroid2': '2. Pulsa Instalar aplicación o Añadir a pantalla principal',
  'settings.installDesktop1': '1. Busca el icono de Instalar a la derecha de la barra de direcciones',
  'settings.installDesktop2': '2. Haz click → Instalar',
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
  'settings.danger': 'Zona peligrosa',
  'settings.wipeDrive': 'Borrar backup del Drive',
  'settings.wipeDriveBlurb': 'Elimina para siempre el archivo gymlog.fitnotes de tu Google Drive y tu copia local. Esta acción NO se puede deshacer — si no tienes otro backup, perderás todos tus entrenos.',
  'settings.wipeDriveConfirm': '¿Seguro que quieres borrar el backup? Esto es IRREVERSIBLE. Se perderán todos los entrenos guardados si no tienes otra copia.',
  'settings.wiping': 'Borrando…',
  'settings.wipeDone': 'Backup eliminado',
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
  'action.loading': 'Loading…',
  'action.create': 'Create',
  'action.creating': 'Creating…',
  'action.clear': 'Clear',
  'action.openMenu': 'Open menu',
  'action.closeMenu': 'Close menu',
  'action.collapseNav': 'Collapse sidebar',
  'action.expandNav': 'Expand sidebar',
  'action.goHome': 'Go to Today',

  'common.user': 'User',
  'common.noData': 'No data.',
  'common.error': 'Error',
  'common.errorCreateExercise': 'Failed to create exercise',
  'common.errorImport': 'Failed to import backup',
  'common.errorExport': 'Failed to export',
  'common.errorSave': 'Failed to save',
  'common.errorDelete': 'Failed to delete',
  'common.kg': 'kg',
  'common.exercisesShort': 'ex',
  'common.top': 'top',

  'day.todayBadge': 'Today',
  'day.prevDay': 'Previous day',
  'day.nextDay': 'Next day',
  'day.personalRecord': 'Personal record',
  'day.exercises': 'exercises',
  'day.volume': 'volume',
  'day.startToday': 'Add an exercise to get started',
  'day.noWorkout': 'No workout this day',
  'day.backToToday': '← back to today',

  'calendar.prevYear': 'Previous year',
  'calendar.nextYear': 'Next year',
  'calendar.prevMonth': 'Previous month',
  'calendar.nextMonth': 'Next month',
  'calendar.month': 'Month',
  'calendar.year': 'Year',
  'calendar.days': 'Days',
  'calendar.volume': 'Volume',
  'calendar.record': 'Record',
  'calendar.trainedTooltip': '{date} — {sets} sets{pr}',
  'calendar.restTooltip': '{date} — rest day',
  'calendar.prSuffix': ' · PR',

  'diary.history': 'History',
  'diary.title': 'Diary',
  'diary.home': 'Home',
  'diary.empty': 'No workouts logged yet.',
  'diary.summary': '{ex} ex · {sets} sets · {vol} kg',
  'diary.setTop': '{sets}× · top {weight}×{reps}',
  'diary.newer': 'Newer',
  'diary.backHome': 'Back to start',
  'diary.older': 'Older',

  'stats.subtitle': 'Your progress',
  'stats.title': 'Statistics',
  'stats.evolution': 'Trend · {period}',
  'stats.weeks': '{n} weeks',
  'stats.months': '{n} months',
  'stats.week': 'Week',
  'stats.month': 'Month',
  'stats.periodSummary': 'Period summary',
  'stats.range7d': 'Last 7 days',
  'stats.range30d': 'Last 30 days',
  'stats.range90d': 'Last 90 days',
  'stats.range365d': 'Last 12 months',
  'stats.rangeYear': 'Year to date',
  'stats.rangeYearNamed': 'Year {year}',
  'stats.rangeAll': 'All time',
  'stats.chip7d': '7d',
  'stats.chip30d': '30d',
  'stats.chip90d': '90d',
  'stats.chip1y': '1y',
  'stats.chipYtd': 'YTD',
  'stats.chipAll': 'All',
  'stats.metricWorkouts': 'Workouts',
  'stats.metricVolume': 'Volume',
  'stats.metricSets': 'Sets',
  'stats.metricReps': 'Reps',
  'stats.weeklyDistribution': 'Weekly distribution',
  'stats.volumeByCategory': 'Volume by category',
  'stats.categoryVolume': '{vol} kg · {sets} sets',
  'stats.topExercises': 'Top 10 exercises',

  'exercises.catalog': 'Catalog',
  'exercises.title': 'Exercises',
  'exercises.groups': 'Groups',
  'exercises.create': 'Create exercise',
  'exercises.newExercise': 'New exercise',
  'exercises.pickGroup': 'Pick a muscle group to see its exercises',
  'exercises.pickGroupShort': 'Pick a muscle group',
  'exercises.count': '{n} exercises',
  'exercises.searchPlaceholder': 'Search exercise…',
  'exercises.searchInGroup': 'Search in {name}…',
  'exercises.noResults': 'No results for "{query}"',
  'exercises.emptyGroup': 'This group has no exercises yet',
  'exercises.backGroups': 'Back to groups',
  'exercises.createPlaceholder': 'E.g. Incline press (dumbbells)',
  'exercises.createAndOpen': 'Create and open',
  'exercises.createAndSelect': 'Create and select',
  'exercises.deleteExercise': 'Delete exercise',
  'exercises.editExercise': 'Edit exercise',
  'exercises.editHint': 'Editar nombre y categoría',
  'exercises.viewAll': 'View all exercises ({n})',
  'exercises.muscleGroup': 'Muscle group',

  'exercise.sessions': 'Sessions',
  'exercise.topWeight': 'Top weight',
  'exercise.est1rm': 'Est. 1RM',
  'exercise.progression': 'Progression',
  'exercise.history': 'History',
  'exercise.chartTopSet': 'Top set',
  'exercise.chartVolume': 'Volume',
  'exercise.chartAll': 'All',

  'pr.weightTitle': 'New max weight unlocked',
  'pr.repsTitle': 'Rep record',
  'pr.weightLabel': 'W',
  'pr.repsLabel': 'R',

  'login.tagline': 'Your workouts on your Google Drive. No server, no database — just you.',
  'login.google': 'Continue with Google',
  'login.connecting': 'Connecting…',
  'login.or': 'or',
  'login.uploadHint': 'Upload your .fitnotes backup',
  'login.uploadCta': 'Upload my .fitnotes backup to Drive',
  'login.privacy':
    'With Google we only request access to the hidden "appdata" folder on your Drive. Your workouts are stored in a gymlog.fitnotes file compatible with the FitNotes app.',

  'empty.diary.title': 'Empty diary',
  'empty.diary.body': 'Your first logged workout will show up here.',
  'empty.stats.title': 'No data yet',
  'empty.stats.body': 'Log some workouts to see statistics.',
  'empty.exercises.title': 'No exercises',
  'empty.exercises.body': 'Create your first exercise or import a backup.',
  'empty.search.title': 'No results',
  'empty.search.body': 'Try a different search term.',

  'workout.addExercise': 'Add exercise',
  'workout.addSet': 'Add set',
  'workout.chooseExercise': 'Pick an exercise…',
  'workout.notes': 'Workout notes',
  'workout.notesPlaceholder': 'How did it feel, aches, new exercises…',
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
  'settings.themeAmoled': 'AMOLED',
  'settings.accent': 'Accent color',
  'settings.accentLime': 'Lime',
  'settings.accentRose': 'Rose',
  'settings.accentRed': 'Red',
  'settings.accentSky': 'Sky',
  'settings.accentViolet': 'Violet',
  'settings.accentMono': 'Mono',
  'settings.installIos1': '1. Tap Share in Safari (arrow-up icon)',
  'settings.installIos2': '2. Scroll and choose Add to Home Screen',
  'settings.installIos3': '3. Tap Add in the top-right corner',
  'settings.installAndroid1': '1. Open the ⋮ menu in Chrome',
  'settings.installAndroid2': '2. Tap Install app or Add to Home screen',
  'settings.installDesktop1': '1. Look for the Install icon in the address bar',
  'settings.installDesktop2': '2. Click → Install',
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
  'settings.danger': 'Danger zone',
  'settings.wipeDrive': 'Delete Drive backup',
  'settings.wipeDriveBlurb': 'Permanently removes the gymlog.fitnotes file from your Google Drive and the local copy. This CANNOT be undone — if you don\'t have another backup you will lose every logged workout.',
  'settings.wipeDriveConfirm': 'Are you sure you want to delete the backup? This is IRREVERSIBLE. Every logged workout will be lost if you have no other copy.',
  'settings.wiping': 'Deleting…',
  'settings.wipeDone': 'Backup deleted',
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
