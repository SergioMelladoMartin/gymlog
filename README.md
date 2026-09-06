# gymlog

Un tracker de gimnasio minimalista, **sin backend**. La "base de datos" es
literalmente un archivo SQLite de [FitNotes](https://www.fitnotesapp.com/)
(`gymlog.fitnotes`) que corre en el navegador con `sqlite-wasm` + OPFS y se
sincroniza a la carpeta oculta `appData` de tu Google Drive. Es una PWA
instalable y funciona offline.

```
[Google Drive appData]  ←→  [OPFS]  ←→  [sqlite-wasm en un Web Worker]
        sync blob          copia local        consultas en vivo
```

No hay servidor, ni cookies, ni datos en ningún sitio salvo tu propio Drive.

## Stack

- **Astro** (output `static` + adaptador `@astrojs/vercel`, solo `/api/auth/*`
  corre on-demand) + **React** islands (`client:only`)
- **sqlite-wasm** (`@sqlite.org/sqlite-wasm`) sobre OPFS
- **OAuth de Google con backend mínimo en Vercel** (cookie de sesión con
  refresh token cifrado, scope `drive.appdata`) — ver "Sesión y backend" más
  abajo
- **Tailwind v4**, **Recharts** (lazy), **date-fns**
- Desplegado en **Vercel** (push a `main` → producción)

## Desarrollo

Requiere Node ≥ 22.12.

```sh
npm install
npm run dev        # http://localhost:4321
```

En desarrollo se carga un `public/seed.fitnotes` de ejemplo para no tener
que loguearse (en producción ese seed nunca se usa).

| Comando               | Acción                                          |
| :-------------------- | :---------------------------------------------- |
| `npm run dev`         | Servidor de desarrollo                          |
| `npm run build`       | Build estático a `./dist/` + funciones `/api/*` |
| `npm run preview`     | Previsualiza el build                           |
| `npm run test`        | Tests unitarios (vitest)                        |
| `npm run export-json` | Exporta el seed `.fitnotes` a JSON (script)     |

## Variables de entorno

Copia `.env.example` a `.env` y rellena:

```
PUBLIC_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=
AUTH_COOKIE_SECRET=
```

El cliente OAuth necesita el scope **`https://www.googleapis.com/auth/drive.appdata`**
y, en la pantalla de consentimiento, añadir como *usuarios de prueba* a quien
vaya a usar la app (o publicarla) mientras esté en modo testing.

Sin `GOOGLE_CLIENT_SECRET` / `AUTH_COOKIE_SECRET` en el entorno, los endpoints
de `/api/auth/*` responden `500 { error: 'server_not_configured' }` y la UI lo
muestra como un mensaje legible en el login — no hace falta tenerlos para
trabajar en el resto de la app en local.

## Sesión y backend

Desde WP1 la sesión ya no depende de un token de Google Identity Services de
1 hora sin refresh (lo que forzaba a volver a loguearse cada hora y colgaba en
iOS/PWA). Ahora hay un backend mínimo en Vercel (`src/pages/api/auth/*.ts`,
endpoints on-demand dentro de un sitio por lo demás 100% estático) que:

1. Redirige a Google (`/api/auth/start`) pidiendo `access_type=offline` para
   obtener un **refresh token**.
2. En el callback (`/api/auth/callback`) cambia el `code` por tokens, cifra el
   refresh token con **AES-256-GCM** (Web Crypto, clave derivada de
   `AUTH_COOKIE_SECRET` vía SHA-256) y lo guarda en una cookie `HttpOnly`
   (`gymlog_rt`, válida solo bajo `/api/auth`). El perfil (email/nombre/foto)
   se guarda en una cookie legible por JS (`gymlog_profile`).
3. El navegador pide access tokens frescos con `POST /api/auth/token` cuando
   el que tiene en memoria/`localStorage` está a punto de caducar. Si el
   refresh token ya no vale, el endpoint responde `401 { error: 'reauth' }` y
   la app pide login de nuevo (píldora ámbar "Sesión caducada · toca para
   entrar").
4. `POST /api/auth/logout` revoca el refresh token en Google (best-effort) y
   borra las cookies.

**El dato de los entrenos sigue yendo directo navegador → Google Drive** — el
backend de Vercel solo gestiona la sesión (tokens), nunca ve ni toca el
archivo `gymlog.fitnotes`.

### Variables de entorno del backend

| Variable | Qué es |
| :-- | :-- |
| `PUBLIC_GOOGLE_CLIENT_ID` | Client ID de OAuth (público, ya existía) |
| `GOOGLE_CLIENT_SECRET` | Client secret de OAuth — Google Cloud Console → APIs & Services → Credentials |
| `AUTH_COOKIE_SECRET` | ≥32 bytes aleatorios en base64. Generar con `openssl rand -base64 32` |

### URIs de redirección a dar de alta en Google Cloud Console

En el cliente OAuth (mismo que ya tienes, tipo "Web application"), añade en
**Authorized redirect URIs**:

```
https://<tu-dominio-de-producción>/api/auth/callback
https://<tu-dominio-de-preview-en-vercel>/api/auth/callback   (opcional, rama pre)
http://localhost:4321/api/auth/callback
```

### Configuración en Vercel

En el proyecto de Vercel, Settings → Environment Variables, añade
`GOOGLE_CLIENT_SECRET` y `AUTH_COOKIE_SECRET` (marcadas como *secret*) además
de la ya existente `PUBLIC_GOOGLE_CLIENT_ID`, para los entornos Production y
Preview.

## Datos e import/export

- **Importar**: sube tu backup `.fitnotes` (o `.db`/`.sqlite`) desde *Acceso*
  o *Ajustes → Backup*. Se migra el esquema a lo que la app espera y se sube a
  Drive.
- **Exportar**: *Ajustes → Backup → Exportar* descarga un `.fitnotes`
  compatible con la app oficial de FitNotes en Android.
- **Sync**: cada cambio se escribe a OPFS al momento y se sube a Drive con un
  debounce (4 s de inactividad, tope de 20 s), con flag `pending` persistente
  y auto-reparación si una subida falla. Antes de subir se comprueba si Drive
  tiene una copia más nueva que la de partida; si la hay, se descarga y se
  reaplica un journal de operaciones (fuera del SQLite, en `localStorage`)
  para no perder cambios locales. Si el journal no se puede reaplicar con
  garantías, se guarda una copia `gymlog-conflict-<fecha>.fitnotes` en OPFS
  descargable desde Ajustes → Backup. El indicador del header refleja el
  estado (incluido "sesión caducada") y permite forzar la sincronización.

## PWA / offline

`public/sw.js` cachea la shell de la app y los assets; los datos viven en OPFS,
así que la app funciona sin conexión salvo la sincronización con Drive (que
requiere red). Instálala desde *Ajustes → Instalar* o el menú del navegador.
