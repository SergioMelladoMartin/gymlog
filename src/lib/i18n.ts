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
  'workout.noExercisesTitle': 'Toca empezar',
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
  'sync.reauth': 'Sesión caducada · toca para entrar',

  // Auth / login errors
  'auth.serverNotConfigured':
    'El servidor no está configurado todavía (faltan variables de entorno). Avisa al administrador.',
  'auth.error.state_mismatch': 'No se pudo verificar el inicio de sesión. Inténtalo de nuevo.',
  'auth.error.token_exchange_failed': 'Google rechazó el intercambio de credenciales. Inténtalo de nuevo.',
  'auth.error.missing_scope':
    'Faltan permisos de Drive. Marca la casilla de acceso a "appdata" al iniciar sesión con Google.',
  'auth.error.generic': 'No se pudo iniciar sesión. Inténtalo de nuevo.',
  'login.connecting': 'Conectando…',

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

  // Relative dates (shared by ExerciseList, WorkoutLogger picker…)
  'rel.today': 'hoy',
  'rel.yesterday': 'ayer',
  'rel.daysAgo': 'hace {n}d',
  'rel.weeksAgo': 'hace {n}sem',
  'rel.monthsAgo': 'hace {n}m',
  'rel.yearsAgo': 'hace {n}a',

  // Day view
  'day.prevDay': 'Día anterior',
  'day.nextDay': 'Día siguiente',
  'day.pr': 'Récord personal',
  'day.statExercises': 'ejercicios',
  'day.statSets': 'sets',
  'day.statVolume': 'volumen',
  'day.startBelow': 'Empieza tu entreno abajo',
  'day.noWorkout': 'Sin entreno este día',
  'day.backToToday': '← volver a hoy',
  'day.loading': 'Cargando…',

  // Exercises (list + catalog)
  'exercises.groups': 'Grupos',
  'exercises.catalog': 'Catálogo',
  'exercises.chooseGroup': 'Elige un grupo muscular para ver sus ejercicios',
  'exercises.countSingular': '{n} ejercicio',
  'exercises.countPlural': '{n} ejercicios',
  'exercises.viewAll': 'Ver todos los ejercicios ({n})',
  'exercises.searchPlaceholder': 'Buscar ejercicio…',
  'exercises.clear': 'Limpiar',
  'exercises.all': 'Todos',
  'exercises.noResults': 'Sin resultados para tu búsqueda.',

  // Exercise (single) — create/delete/detail
  'exercise.createBtn': 'Crear ejercicio',
  'exercise.namePlaceholder': 'Ej: Press inclinado (mancuernas)',
  'exercise.muscleGroup': 'Grupo muscular',
  'exercise.creating': 'Creando…',
  'exercise.createAndOpen': 'Crear y abrir',
  'exercise.createAndSelect': 'Crear y seleccionar',
  'exercise.new': 'Nuevo ejercicio',
  'exercise.errorCreate': 'Error al crear ejercicio',
  'exercise.confirmDeleteTitle': 'Borrar ejercicio',
  'exercise.confirmDeleteWithSets':
    '¿Borrar "{name}"? También se eliminarán {count} {unit}. Esta acción no se puede deshacer.',
  'exercise.confirmDeletePlain': '¿Borrar "{name}"? Esta acción no se puede deshacer.',
  'exercise.setRegistered': 'serie registrada',
  'exercise.setsRegistered': 'series registradas',
  'exercise.errorDelete': 'Error al borrar',
  'exercise.errorSave': 'Error al guardar',
  'exercise.sessions': 'Sesiones',
  'exercise.topWeight': 'Top peso',
  'exercise.oneRM': '1RM est.',
  'exercise.progression': 'Progresión',
  'exercise.history': 'Historial',

  // Stats
  'stats.yourProgress': 'Tu progreso',
  'stats.evolution': 'Evolución',
  'stats.weeks': '{n} semanas',
  'stats.months': '{n} meses',
  'stats.week': 'Semana',
  'stats.month': 'Mes',
  'stats.metric.workouts': 'Entrenos',
  'stats.metric.volume': 'Volumen',
  'stats.metric.sets': 'Series',
  'stats.metric.reps': 'Reps',
  'stats.summary': 'Resumen del periodo',
  'stats.range.all': 'Todo el histórico',
  'stats.range.7d': 'Últimos 7 días',
  'stats.range.30d': 'Últimos 30 días',
  'stats.range.90d': 'Últimos 90 días',
  'stats.range.365d': 'Últimos 12 meses',
  'stats.range.yearCurrent': 'Año en curso',
  'stats.range.year': 'Año {year}',
  'stats.chip.year': '1a',
  'stats.chip.all': 'Todo',
  'stats.weeklyDistribution': 'Distribución semanal',
  'stats.volumeByCategory': 'Volumen por categoría',
  'stats.noData': 'Sin datos.',
  'stats.noDataPeriod': 'Sin datos en este periodo.',
  'stats.top10': 'Top 10 ejercicios',

  'weekday.full.mon': 'Lunes', 'weekday.full.tue': 'Martes', 'weekday.full.wed': 'Miércoles',
  'weekday.full.thu': 'Jueves', 'weekday.full.fri': 'Viernes', 'weekday.full.sat': 'Sábado', 'weekday.full.sun': 'Domingo',
  'weekday.letter.mon': 'L', 'weekday.letter.tue': 'M', 'weekday.letter.wed': 'X',
  'weekday.letter.thu': 'J', 'weekday.letter.fri': 'V', 'weekday.letter.sat': 'S', 'weekday.letter.sun': 'D',

  // Calendar
  'calendar.prevYear': 'Año anterior',
  'calendar.nextYear': 'Año siguiente',
  'calendar.prevMonth': 'Mes anterior',
  'calendar.nextMonth': 'Mes siguiente',
  'calendar.month': 'Mes',
  'calendar.year': 'Año',
  'calendar.days': 'Días',
  'calendar.record': 'Récord',
  'calendar.weekdaysShort': 'Lu,Ma,Mi,Ju,Vi,Sá,Do',
  'calendar.weekLetters': 'Lu,Mi,Vi,Do',
  'calendar.tooltipTrained': '{date} — {sets} sets',
  'calendar.tooltipPr': ' · récord',
  'calendar.tooltipNone': '{date} — sin entreno',

  // Diary
  'diary.historic': 'Histórico',
  'diary.home': 'Inicio',
  'diary.noWorkouts': 'No hay entrenos registrados todavía.',
  'diary.summary': '{ex} ej · {sets} sets · {vol} kg',
  'diary.top': 'top',
  'diary.newer': 'Más recientes',
  'diary.backHome': 'Volver al inicio',
  'diary.older': 'Más antiguos',

  // Login extras
  'login.tagline': 'Tus entrenos en tu Google Drive. Sin servidor, sin base de datos, solo tú.',
  'login.continueGoogle': 'Continuar con Google',
  'login.or': 'o',
  'login.uploadBackup': 'Subir mi backup .fitnotes a Drive',
  'login.appdataInfo':
    'Con Google: pedimos acceso solo a la carpeta oculta "appdata" de tu Drive. Tus entrenos se guardan en un archivo {file} compatible con la app FitNotes.',
  'login.usernameFallback': 'Usuario',
  'login.howItWorks': '¿Cómo funciona?',
  'login.uploadBackupLink': '¿Tienes un backup .fitnotes? Súbelo aquí',
  'sheet.close': 'Cerrar',
  'sheet.dragHandle': 'Arrastra o pulsa Escape para cerrar',

  // Settings — install instructions
  'settings.installIosStep1': 'Pulsa el botón de Compartir en Safari (el icono con la flecha hacia arriba)',
  'settings.installIosStep2': 'Desliza y elige Añadir a pantalla de inicio',
  'settings.installIosStep3': 'Pulsa Añadir arriba a la derecha',
  'settings.installAndroidStep1': 'Abre el menú ⋮ en Chrome',
  'settings.installAndroidStep2': 'Pulsa Instalar aplicación o Añadir a pantalla principal',
  'settings.installDesktopStep1':
    'Busca el icono de Instalar a la derecha de la barra de direcciones (parece una pantalla con flecha)',
  'settings.installDesktopStep2': 'Haz click → Instalar',
  'settings.errorImportDefault': 'Error al importar backup',
  'settings.errorExportDefault': 'Error al exportar',
  'settings.errorWipeDefault': 'Error',

  // Workout logger — picker, editing, PR badges
  'workout.added': 'Añadido',
  'workout.addSetAria': 'Añadir set',
  'workout.editSet': 'Editar set',
  'workout.edit': 'Editar',
  'workout.deleteSet': 'Eliminar set',
  'workout.delete': 'Eliminar',
  'picker.backToGroups': 'Volver a grupos',
  'picker.searchInGroup': 'Buscar en {group}…',
  'picker.chooseGroup': 'Elige un grupo muscular',
  'picker.exerciseCountAbbrev': '{n} ejerc',
  'picker.noResultsFor': 'Sin resultados para "{q}"',
  'picker.groupEmpty': 'Este grupo aún no tiene ejercicios',
  'picker.createQuoted': '+ Crear "{name}"',
  'picker.createGeneric': '+ Crear nuevo ejercicio',
  'picker.resultCountSingular': '{n} resultado',
  'picker.resultCountPlural': '{n} resultados',
  'pr.weightUnlocked': 'Peso nuevo desbloqueado',
  'pr.repsRecord': 'Récord de repeticiones',

  // Bottom tab bar (mobile)
  'tab.today': 'Hoy',
  'tab.calendar': 'Calendario',
  'tab.diary': 'Diario',
  'tab.exercises': 'Ejercicios',
  'tab.stats': 'Stats',

  // Avatar menu (mobile header)
  'menu.profile': 'Perfil',
  'menu.settings': 'Ajustes',
  'menu.logout': 'Salir',
  'menu.openUserMenu': 'Abrir menú de usuario',

  // Day hero / weekly goal ring
  'day.weekProgress': '{done} de {goal} días esta semana',
  'day.weekGoalLabel': 'Objetivo semanal',
  'day.addExercise': 'Añadir ejercicio',

  // Rest timer
  'timer.rest': 'Descanso',
  'timer.auto': 'Auto',
  'timer.autoHint': 'Inicia solo al añadir una serie',
  'timer.plus30': '+30 s',
  'timer.reset': 'Reiniciar',
  'timer.skip': 'Saltar',
  'timer.done': '¡Descanso terminado!',
  'timer.start': 'Iniciar temporizador',

  // PR toast
  'toast.newRecord': '🏆 Nuevo récord',
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
  'workout.noExercisesTitle': 'Let’s start',
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
  'sync.reauth': 'Session expired · tap to sign in',

  'auth.serverNotConfigured':
    'The server isn\'t configured yet (missing environment variables). Contact the administrator.',
  'auth.error.state_mismatch': 'Could not verify the sign-in attempt. Please try again.',
  'auth.error.token_exchange_failed': 'Google rejected the credential exchange. Please try again.',
  'auth.error.missing_scope':
    'Missing Drive permissions. Tick the "appdata" access checkbox when signing in with Google.',
  'auth.error.generic': 'Could not sign in. Please try again.',
  'login.connecting': 'Connecting…',

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

  'rel.today': 'today',
  'rel.yesterday': 'yesterday',
  'rel.daysAgo': '{n}d ago',
  'rel.weeksAgo': '{n}w ago',
  'rel.monthsAgo': '{n}mo ago',
  'rel.yearsAgo': '{n}y ago',

  'day.prevDay': 'Previous day',
  'day.nextDay': 'Next day',
  'day.pr': 'Personal record',
  'day.statExercises': 'exercises',
  'day.statSets': 'sets',
  'day.statVolume': 'volume',
  'day.startBelow': 'Start your workout below',
  'day.noWorkout': 'No workout this day',
  'day.backToToday': '← back to today',
  'day.loading': 'Loading…',

  'exercises.groups': 'Groups',
  'exercises.catalog': 'Catalog',
  'exercises.chooseGroup': 'Pick a muscle group to see its exercises',
  'exercises.countSingular': '{n} exercise',
  'exercises.countPlural': '{n} exercises',
  'exercises.viewAll': 'View all exercises ({n})',
  'exercises.searchPlaceholder': 'Search exercise…',
  'exercises.clear': 'Clear',
  'exercises.all': 'All',
  'exercises.noResults': 'No results for your search.',

  'exercise.createBtn': 'Create exercise',
  'exercise.namePlaceholder': 'E.g. Incline press (dumbbells)',
  'exercise.muscleGroup': 'Muscle group',
  'exercise.creating': 'Creating…',
  'exercise.createAndOpen': 'Create and open',
  'exercise.createAndSelect': 'Create and select',
  'exercise.new': 'New exercise',
  'exercise.errorCreate': 'Could not create exercise',
  'exercise.confirmDeleteTitle': 'Delete exercise',
  'exercise.confirmDeleteWithSets':
    'Delete "{name}"? {count} {unit} will also be deleted. This cannot be undone.',
  'exercise.confirmDeletePlain': 'Delete "{name}"? This cannot be undone.',
  'exercise.setRegistered': 'logged set',
  'exercise.setsRegistered': 'logged sets',
  'exercise.errorDelete': 'Could not delete',
  'exercise.errorSave': 'Could not save',
  'exercise.sessions': 'Sessions',
  'exercise.topWeight': 'Top weight',
  'exercise.oneRM': 'Est. 1RM',
  'exercise.progression': 'Progression',
  'exercise.history': 'History',

  'stats.yourProgress': 'Your progress',
  'stats.evolution': 'Trend',
  'stats.weeks': '{n} weeks',
  'stats.months': '{n} months',
  'stats.week': 'Week',
  'stats.month': 'Month',
  'stats.metric.workouts': 'Workouts',
  'stats.metric.volume': 'Volume',
  'stats.metric.sets': 'Sets',
  'stats.metric.reps': 'Reps',
  'stats.summary': 'Period summary',
  'stats.range.all': 'All time',
  'stats.range.7d': 'Last 7 days',
  'stats.range.30d': 'Last 30 days',
  'stats.range.90d': 'Last 90 days',
  'stats.range.365d': 'Last 12 months',
  'stats.range.yearCurrent': 'Current year',
  'stats.range.year': 'Year {year}',
  'stats.chip.year': '1y',
  'stats.chip.all': 'All',
  'stats.weeklyDistribution': 'Weekly distribution',
  'stats.volumeByCategory': 'Volume by category',
  'stats.noData': 'No data.',
  'stats.noDataPeriod': 'No data for this period.',
  'stats.top10': 'Top 10 exercises',

  'weekday.full.mon': 'Monday', 'weekday.full.tue': 'Tuesday', 'weekday.full.wed': 'Wednesday',
  'weekday.full.thu': 'Thursday', 'weekday.full.fri': 'Friday', 'weekday.full.sat': 'Saturday', 'weekday.full.sun': 'Sunday',
  'weekday.letter.mon': 'M', 'weekday.letter.tue': 'T', 'weekday.letter.wed': 'W',
  'weekday.letter.thu': 'T', 'weekday.letter.fri': 'F', 'weekday.letter.sat': 'S', 'weekday.letter.sun': 'S',

  'calendar.prevYear': 'Previous year',
  'calendar.nextYear': 'Next year',
  'calendar.prevMonth': 'Previous month',
  'calendar.nextMonth': 'Next month',
  'calendar.month': 'Month',
  'calendar.year': 'Year',
  'calendar.days': 'Days',
  'calendar.record': 'Record',
  'calendar.weekdaysShort': 'Mo,Tu,We,Th,Fr,Sa,Su',
  'calendar.weekLetters': 'Mo,We,Fr,Su',
  'calendar.tooltipTrained': '{date} — {sets} sets',
  'calendar.tooltipPr': ' · record',
  'calendar.tooltipNone': '{date} — no workout',

  'diary.historic': 'History',
  'diary.home': 'Home',
  'diary.noWorkouts': 'No workouts logged yet.',
  'diary.summary': '{ex} ex · {sets} sets · {vol} kg',
  'diary.top': 'top',
  'diary.newer': 'Newer',
  'diary.backHome': 'Back to start',
  'diary.older': 'Older',

  'login.tagline': 'Your workouts in your Google Drive. No server, no database, just you.',
  'login.continueGoogle': 'Continue with Google',
  'login.or': 'or',
  'login.uploadBackup': 'Upload my .fitnotes backup to Drive',
  'login.appdataInfo':
    'With Google: we only ask for access to the hidden "appdata" folder in your Drive. Your workouts are saved in a file {file} compatible with the FitNotes app.',
  'login.usernameFallback': 'User',
  'login.howItWorks': 'How does this work?',
  'login.uploadBackupLink': 'Have a .fitnotes backup? Upload it here',
  'sheet.close': 'Close',
  'sheet.dragHandle': 'Drag or press Escape to close',

  'settings.installIosStep1': 'Tap the Share button in Safari (the icon with an upward arrow)',
  'settings.installIosStep2': 'Scroll and choose Add to Home Screen',
  'settings.installIosStep3': 'Tap Add in the top right',
  'settings.installAndroidStep1': 'Open the ⋮ menu in Chrome',
  'settings.installAndroidStep2': 'Tap Install app or Add to Home screen',
  'settings.installDesktopStep1':
    'Look for the Install icon to the right of the address bar (it looks like a screen with an arrow)',
  'settings.installDesktopStep2': 'Click it → Install',
  'settings.errorImportDefault': 'Could not import backup',
  'settings.errorExportDefault': 'Could not export',
  'settings.errorWipeDefault': 'Error',

  'workout.added': 'Added',
  'workout.addSetAria': 'Add set',
  'workout.editSet': 'Edit set',
  'workout.edit': 'Edit',
  'workout.deleteSet': 'Delete set',
  'workout.delete': 'Delete',
  'picker.backToGroups': 'Back to groups',
  'picker.searchInGroup': 'Search in {group}…',
  'picker.chooseGroup': 'Pick a muscle group',
  'picker.exerciseCountAbbrev': '{n} ex',
  'picker.noResultsFor': 'No results for "{q}"',
  'picker.groupEmpty': 'This group has no exercises yet',
  'picker.createQuoted': '+ Create "{name}"',
  'picker.createGeneric': '+ Create new exercise',
  'picker.resultCountSingular': '{n} result',
  'picker.resultCountPlural': '{n} results',
  'pr.weightUnlocked': 'New max weight unlocked',
  'pr.repsRecord': 'Rep record',

  // Bottom tab bar (mobile)
  'tab.today': 'Today',
  'tab.calendar': 'Calendar',
  'tab.diary': 'Diary',
  'tab.exercises': 'Exercises',
  'tab.stats': 'Stats',

  // Avatar menu (mobile header)
  'menu.profile': 'Profile',
  'menu.settings': 'Settings',
  'menu.logout': 'Sign out',
  'menu.openUserMenu': 'Open user menu',

  // Day hero / weekly goal ring
  'day.weekProgress': '{done} of {goal} days this week',
  'day.weekGoalLabel': 'Weekly goal',
  'day.addExercise': 'Add exercise',

  // Rest timer
  'timer.rest': 'Rest',
  'timer.auto': 'Auto',
  'timer.autoHint': 'Starts on its own when you log a set',
  'timer.plus30': '+30 s',
  'timer.reset': 'Reset',
  'timer.skip': 'Skip',
  'timer.done': 'Rest done!',
  'timer.start': 'Start timer',

  // PR toast
  'toast.newRecord': '🏆 New record',
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

/** BCP-47 locale for the active language — feed this to toLocaleDateString /
 * toLocaleString instead of hardcoding 'es-ES' everywhere. */
export function getLocale(lang: Lang = current): string {
  return lang === 'en' ? 'en-US' : 'es-ES';
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
