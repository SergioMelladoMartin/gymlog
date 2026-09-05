# gymlog · Spec de mejoras (septiembre 2026)

Rama de trabajo: `pre` (preview en Vercel). Producción sigue en `main`.

## 0. Reglas globales (leer antes de tocar nada)

1. **El formato de la base de datos NO cambia.** El fichero `gymlog.fitnotes` debe
   seguir siendo importable por la app FitNotes de Android tal cual. Prohibido:
   crear tablas nuevas, añadir columnas, renombrar, cambiar tipos, tocar
   `android_metadata`. Los índices `gymlog_idx_*` que ya existen se mantienen y no
   se añaden más. Cualquier estado auxiliar (journal de operaciones, metadatos de
   sync, versión) vive **fuera** del SQLite: `localStorage`, OPFS en un fichero
   aparte, o un segundo fichero en Drive appdata.
2. **`<meta name="theme-color">` se queda fijo** en `#0f0f15`. No hacerlo dinámico.
3. Stack fijo: Astro 6 + React 19 islands + Tailwind v4 + sqlite-wasm. No añadir
   librerías de UI (nada de shadcn, framer-motion, headless-ui…). Animaciones con
   CSS. Si hace falta una utilidad pequeña, escribirla.
4. Idioma de la UI por defecto: español. Todo texto nuevo pasa por `t()` de
   `src/lib/i18n.ts` con clave ES y EN.
5. Mantener el sistema de diseño “liquid glass” de `src/styles/global.css`
   (tokens `--color-*`, utilidades `card`, `glass`, `btn-accent`…). Extenderlo, no
   sustituirlo. Respetar `prefers-reduced-motion` y `prefers-reduced-transparency`.
6. Cada paquete de trabajo termina con `npm run build` en verde y **un commit**
   (o pocos) en la rama `pre` con mensaje `feat(...)`/`fix(...)` en español,
   terminado en `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
   No hacer push: lo hace el orquestador.
7. No borrar ni reescribir código que no toque el paquete asignado. Si algo del
   spec choca con el código real, prioriza no romper y deja una nota en el commit.

---

## WP1 · Sesión persistente (backend mínimo) + fiabilidad de sync

### 1.1 Contexto

Hoy la auth es Google Identity Services solo-navegador (`src/lib/auth.ts`): tokens
de 1 h, sin refresh token, renovación silenciosa que falla en iOS/PWA. Resultado:
login cada hora y timeouts de 12 s. Además hay un bug: casi toda la sync comprueba
`isSignedIn()` (token en caché válido) y abandona si no lo hay, en vez de
renovar. Con el token caducado y sin cambios pendientes la app nunca vuelve a
pedir token: la carga inicial se salta Drive, el sondeo de 2 min no hace nada y la
píldora sigue en verde.

### 1.2 Backend en Vercel (Astro server endpoints)

- `astro.config.mjs`: pasar a `output: 'static'` **con** adaptador
  `@astrojs/vercel` (ya instalado) y marcar solo los endpoints de API como
  `export const prerender = false`. Las páginas siguen siendo estáticas y el SW
  sigue funcionando igual. Comprobar que el build genera funciones solo para
  `/api/*`.
- Endpoints en `src/pages/api/auth/`:
  - `start.ts` (GET): genera `state` aleatorio (cookie httpOnly corta, 10 min) y
    redirige a `https://accounts.google.com/o/oauth2/v2/auth` con
    `response_type=code`, `access_type=offline`, `prompt=consent` solo la primera
    vez (parámetro `?force=1`), `include_granted_scopes=true`, scopes
    `https://www.googleapis.com/auth/drive.appdata openid email profile`,
    `redirect_uri = <origin>/api/auth/callback`. Acepta `?next=` (solo rutas
    internas, validar que empieza por `/` y no por `//`).
  - `callback.ts` (GET): valida `state`, intercambia `code` por tokens en
    `https://oauth2.googleapis.com/token` con `GOOGLE_CLIENT_ID` +
    `GOOGLE_CLIENT_SECRET`. Verifica que `scope` incluye `drive.appdata`. Obtiene
    el perfil de `https://www.googleapis.com/oauth2/v3/userinfo`. Cifra el
    `refresh_token` con AES-256-GCM (Web Crypto, clave derivada de
    `AUTH_COOKIE_SECRET` vía SHA-256) y lo guarda en cookie `gymlog_rt`:
    `HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=400 días`. Guarda el
    perfil (email, name, picture) en cookie legible por JS `gymlog_profile`
    (no HttpOnly, `SameSite=Lax`, mismo Max-Age). Redirige a `next` o `/`.
  - `token.ts` (POST): lee y descifra `gymlog_rt`, pide un access token nuevo con
    `grant_type=refresh_token`, devuelve JSON `{ access_token, expires_in }`.
    Si Google responde `invalid_grant` → borra cookies y responde 401
    `{ error: 'reauth' }`. Nunca devuelve el refresh token.
  - `logout.ts` (POST): revoca el refresh token en
    `https://oauth2.googleapis.com/revoke` (best-effort), borra ambas cookies,
    responde 204.
  - Todos los endpoints: `Cache-Control: no-store`. Si falta alguna env var,
    responder 500 con JSON `{ error: 'server_not_configured' }` y un mensaje
    claro; la app debe mostrarlo en el login sin colgarse.
- Variables de entorno (documentar en README y en `.env.example` nuevo):
  `PUBLIC_GOOGLE_CLIENT_ID` (ya existe), `GOOGLE_CLIENT_SECRET`,
  `AUTH_COOKIE_SECRET` (≥32 bytes aleatorios, base64). Comando sugerido para
  generarlo: `openssl rand -base64 32`.
- Seguridad: no loguear tokens; comparar `state` en tiempo constante o al menos
  con igualdad estricta tras decodificar; rechazar `redirect_uri` distinto al
  propio origen (construirlo siempre desde `Astro.url.origin`, nunca del query).

### 1.3 Nuevo `src/lib/auth.ts`

- Elimina la carga del script GIS y `initTokenClient`.
- `signIn(next?)`: `window.location.assign('/api/auth/start?next=...')`.
- `getAccessToken()`: devuelve el token en memoria si le quedan >60 s; si no,
  `POST /api/auth/token` con `credentials: 'same-origin'`, timeout 8 s, cachea
  `{token, expiresAt}` en memoria **y** en `localStorage` (clave `gymlog:auth`,
  misma forma que hoy para no romper `getCurrentUser`). Serializa llamadas
  concurrentes (una sola petición en vuelo). Si el endpoint devuelve 401
  `reauth` → lanza `AuthExpiredError` (clase exportada) y limpia la caché local.
- `hasSession()`: true si existe cookie `gymlog_profile` o perfil en
  localStorage. Sustituye a `isSignedIn()` en todos los sitios donde la
  pregunta real es “¿este usuario ha iniciado sesión alguna vez?”. Mantener
  `isSignedIn()` exportado como alias de `hasSession()` para no romper imports.
- `getCurrentUser()`: lee `gymlog_profile` (JSON en cookie, URL-encoded) y cae a
  localStorage.
- `signOut()`: `POST /api/auth/logout`, limpia memoria y localStorage.
- Renovación proactiva: `setTimeout` a 2 min de la expiración y en
  `visibilitychange→visible` si quedan <5 min. Ya no depende de cookies de
  terceros, así que no hace falta el `Promise.race` de 12 s.
- Borrar `reconsent()`; donde `drive.ts` lo usaba ante un 403, redirigir a
  `/api/auth/start?force=1&next=<ruta actual>`.

### 1.4 Arreglos en `src/lib/sqlite.ts` y `src/lib/drive.ts`

- Sustituir todos los `isSignedIn()` que bloquean sync por `hasSession()`.
  Concretamente: paso 1b y paso 2 de `loadDatabase`, `pullRemoteIfNewer`,
  `flushToDrive` (que ya no bloquea, mantenerlo así).
- Si `getAccessToken` lanza `AuthExpiredError`: estado de sync nuevo
  `'reauth'` (añadir a `SyncState`). La píldora lo muestra en ámbar con texto
  “Sesión caducada · toca para entrar” y al tocar llama a `signIn(location.pathname+search)`.
- **Debounce de subida**: `markDirty()` escribe en OPFS inmediatamente (para no
  perder nada) pero programa el push a Drive con 4 s de inactividad (cada nueva
  mutación reinicia el temporizador; tope duro de 20 s desde la primera mutación
  pendiente). `pagehide`, `visibilitychange→hidden`, navegación Astro
  (`astro:before-preparation`) y el tap de la píldora fuerzan el flush
  inmediato. `flushNow()`/`scheduleSync(true)` siguen siendo inmediatos.
- **Detección de conflicto antes de subir**: antes del PATCH, `GET` de metadatos
  (`fields=modifiedTime,size`) y comparar con `LS_REMOTE_META`. Si Drive es más
  nuevo que la base de la que partimos → descargar remoto, abrirlo, **reaplicar
  el journal local** (ver siguiente punto) y subir el resultado. Si el journal
  está vacío o falla la reaplicación, no perder nada: guardar la copia local
  como `gymlog-conflict-<fecha>.fitnotes` en OPFS y ofrecer descargarla desde
  Ajustes → Backup (“Copia de conflicto disponible”).
- **Journal de operaciones (fuera del SQLite)**: en `queries.ts`, cada mutación
  (`createSet`, `updateSet`, `deleteSet`, `duplicateSet`, `copySetsFromDate`,
  `createExercise`, `updateExercise`, `deleteExercise`, `setWorkoutComment`)
  añade una entrada `{op, table, payload, ts}` a un array en
  `localStorage['gymlog-ops-journal']`. Se vacía cuando el push confirma. La
  reaplicación se hace con SQL idempotente sobre el remoto fresco (inserts con
  los mismos valores; updates/deletes por `_id` solo si la fila existe). Cap de
  2000 entradas; si se supera, descartar journal y caer al camino “copia de
  conflicto”.
- Claves locales por usuario: prefijar con el email del perfil las claves
  `gymlog-drive-file-id`, `gymlog-drive-meta`, `gymlog-last-sync`,
  `gymlog-sync-pending`, `gymlog-ops-journal` y el nombre del fichero OPFS
  (`gymlog-<emailSanitizado>.fitnotes`). Al arrancar, si existe el fichero OPFS
  antiguo `gymlog.fitnotes` y no el nuevo, renombrarlo/copiarlo (migración única).
- Timeouts: `DRIVE_TIMEOUT_MS` a 20 s para GET de metadatos y 45 s para
  subidas (los ficheros pueden pasar de 1 MB).
- `SyncStatus.tsx`: estados `idle | dirty | syncing | error | reauth | offline`.
  Mostrar el texto también en móvil (ahora se oculta con `hidden sm:inline`),
  abreviado (“hace 3 min”, “subiendo…”, “sin subir”, “entrar”).
- `LoginView.tsx`: el botón “Continuar con Google” llama a `signIn('/')`. La
  subida de backup exige sesión: si no la hay, guarda el fichero en OPFS como
  `pending-import.fitnotes`, lanza `signIn('/login?import=1')` y al volver lo
  importa. Mostrar el error `server_not_configured` con texto legible.
- `useDatabase.ts`: con `status === 'empty'` redirigir a `/login` solo si
  `!hasSession()`.
- Tests mínimos: añadir `vitest` como devDependency y tests unitarios para
  el journal (aplicar/vaciar), el debounce (con timers falsos) y el cifrado
  AES-GCM de la cookie (round-trip). Script `npm test`.
- README: sección nueva “Sesión y backend” explicando las 3 env vars, las URIs
  de redirección a dar de alta en Google Cloud Console
  (`https://<dominio>/api/auth/callback` y `http://localhost:4321/api/auth/callback`)
  y que el dato de entrenos sigue yendo navegador→Drive sin pasar por Vercel.

---

## WP2 · PWA, limpieza técnica, diálogos e i18n

- **Fuente autoalojada**: descargar Inter variable (woff2, latín) a
  `public/fonts/`, `@font-face` en `global.css` con `font-display: swap`, quitar
  los `<link>` a rsms.me, añadir `.woff2` al precache del SW y subir
  `CACHE_VERSION` a `gymlog-v4`.
- **Iconos PWA**: generar desde `public/favicon.svg` (con un script Node único
  en `scripts/gen-icons.mjs` usando `sharp` como devDependency, o a mano si no
  hay red) `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` (fondo
  `#0f0f15`, logo al 60 %), `apple-touch-icon.png` (180). Actualizar manifest
  (`purpose: "any"` / `"maskable"`) y `Layout.astro` (`apple-touch-icon`,
  `apple-mobile-web-app-title`, `apple-mobile-web-app-status-bar-style=black-translucent`).
  **No tocar `theme-color`.**
- **Componente `ConfirmDialog`** (`src/components/ui/ConfirmDialog.tsx`) y hook
  `useConfirm()` que devuelve `Promise<boolean>`: hoja modal en `glass-float`,
  botón destructivo en `danger`, cierra con Escape y clic fuera, foco atrapado.
  Componente `Toast` (`src/components/ui/Toast.tsx`) con cola global
  (`toast.success/error/info`) para sustituir `alert()`. Reemplazar **todos** los
  `alert(` y `window.confirm(` de `src/components/**`.
- **i18n completo**: pasar por `t()` todos los textos fijos de `DayView`,
  `ExercisesView`, `StatsView`, `CalendarView`, `DiaryView`, `LoginView`,
  `ProfileView`, `ExerciseDetailView`, `ExerciseList`, `SettingsView`
  (instrucciones de instalación) y el `navTitle` de `Layout.astro` (resolver en
  cliente con un pequeño script o dejar que el island lo pinte). Las fechas con
  `toLocaleDateString` deben usar el locale del idioma activo
  (`useT()` expone `lang`; añadir helper `getLocale()` en `i18n.ts`).
- **Tipos muertos**: eliminar `GymlogData`, `Settings`, `AccentKey` y el comentario
  de cabecera obsoleto de `src/lib/types.ts`. `BodyWeight` se queda si
  `queries.ts` lo usa.
- Actualizar dependencias dentro de la misma major (`npm update`), no saltar a
  Astro 7.
- `.gitignore`: quitar las líneas sueltas `favicon.svg`, `manifest.webmanifest`,
  `sw.js` (están trackeados y confunden).

---

## WP3 · Estética A: navegación, “Hoy”, series, descanso, récords

- **Tab bar inferior en móvil** (`<1024px`): componente `BottomNav.tsx` fijo
  abajo, `glass-bar`, 5 pestañas (Hoy, Calendario, Diario, Ejercicios, Stats),
  icono + etiqueta 10 px, pestaña activa con punto acento y `accent-glow`,
  respeta `env(safe-area-inset-bottom)`. `main` recibe `padding-bottom` para no
  quedar tapado. La hamburguesa y el drawer se mantienen solo para
  Ajustes/Perfil, o mejor: el avatar del usuario pasa a la cabecera (arriba a la
  derecha, junto a la píldora) y abre un menú pequeño con Perfil, Ajustes,
  Salir. En desktop no cambia nada (sidebar).
- **Hero de “Hoy”** (`DayView.tsx`): bloque grande con día de la semana en
  `section-title`, número del día a 48 px en 700 tabular, mes al lado; a la
  derecha un anillo SVG de progreso semanal (días entrenados esta semana / 7, o
  sobre objetivo configurable en localStorage `gymlog-weekly-goal`, por defecto 4).
  Las 3 stats (ejercicios, series, volumen) pasan a `stat-tile` en fila. Botón
  flotante (FAB) “+” en la esquina inferior derecha en móvil, por encima del tab
  bar, que abre el selector de ejercicio.
- **Tarjetas de ejercicio en el logger** (`WorkoutLogger.tsx`): franja de 3 px
  del color de categoría en el borde izquierdo (`border-left` con el hex de
  `category_color`), nombre en 600, las series como **chips** horizontales con
  scroll (`80 kg × 8`), chip activo con borde acento, badge de PR pequeño sobre el
  chip. Tocar un chip abre la edición inline como ahora. Mantener QuickAdd debajo.
- **Temporizador de descanso**: componente `RestTimer.tsx` anclado sobre el tab
  bar (móvil) o abajo a la derecha (desktop): anillo circular con cuenta atrás,
  presets 60/90/120/180 s recordados en localStorage, botón +30 s, vibración al
  terminar y `Notification` opcional si el usuario dio permiso. Se arranca solo
  al añadir una serie si el usuario tiene activado “auto” (toggle en el propio
  timer). Sustituye el texto plano de tiempo desde la última serie.
- **Toast de récord**: al registrar un PR mostrar toast desde arriba
  “🏆 Nuevo récord · Press Banca · 80 kg × 6” con el `pr-shine` existente y una
  pequeña lluvia de 12 partículas CSS (sin librería), 2,5 s, respeta
  `prefers-reduced-motion`. Reutilizar el `Toast` de WP2.

---

## WP4 · Estética B: hojas modales, login, skeletons, tipografía, gráficas, modo claro

- **`BottomSheet.tsx`** genérico: aparece desde abajo en móvil (arrastrable para
  cerrar con umbral 80 px, asa superior), centrado como modal en desktop.
  Migrar a él: selector de ejercicio, formulario de nuevo ejercicio,
  `ConfirmDialog` (WP2) en móvil, menú del avatar (WP3).
- **Login**: aurora más intensa, logo con animación de entrada (escala + blur),
  frase corta, botón Google como CTA principal, el texto largo sobre appdata en
  un `<details>` “¿Cómo funciona?”. El bloque de “subir backup” pasa a enlace
  secundario.
- **Skeletons**: componente `Skeleton.tsx` (bloques con shimmer) y estados de
  carga con la forma real de cada vista (Hoy, Calendario, Diario, Ejercicios,
  Stats, Perfil) en vez del spinner. El spinner solo queda para acciones.
- **Micro-interacciones**: `active:scale-[0.97]` en todos los botones e items
  tocables, transición de altura al expandir/plegar series (grid-template-rows
  0fr→1fr), `transition` en hover de tarjetas. Nada de esto si
  `prefers-reduced-motion`.
- **Tipografía numérica**: fuente `Geist` (o `Instrument Sans` si Geist no está
  disponible offline) autoalojada solo para cifras grandes (`--font-display`),
  700 tabular, en hero, stat-tiles, perfil y stats. Inter sigue en cuerpo.
- **Gráficas** (`ExerciseChart.tsx`, `StatsTrendChart.tsx`): área con degradado
  bajo la línea (acento → transparente), puntos solo en hover/activo, eje Y sin
  rejilla o rejilla punteada muy suave, tooltip en `glass`, animación de entrada
  suave. Colores desde tokens CSS (leer `getComputedStyle` del acento).
- **Modo claro**: subir presencia de la aurora (acento 38 %, violeta 22 %, cian
  22 %), tarjetas `rgba(255,255,255,0.58)` con `saturate(1.8)`, borde
  `rgba(16,16,40,0.12)`, y un tinte muy leve del acento en `--color-bg`
  (`color-mix(in srgb, #eef0f5 96%, var(--color-accent))`). Revisar contraste AA
  de `--color-muted` sobre tarjetas.

---

## Orden de ejecución

WP1 → WP2 → WP3 → WP4, cada uno en serie sobre la rama `pre`. WP3 y WP4 dependen
de los componentes `Toast`/`ConfirmDialog` de WP2.
