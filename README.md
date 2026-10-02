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

- **Astro** (output `static`) + **React** islands (`client:only`)
- **sqlite-wasm** (`@sqlite.org/sqlite-wasm`) sobre OPFS
- **Google Identity Services** (OAuth solo-navegador, scope `drive.appdata`)
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
| `npm run build`       | Build estático a `./dist/`                      |
| `npm run preview`     | Previsualiza el build                           |
| `npm run export-json` | Exporta el seed `.fitnotes` a JSON (script)     |

## Variables de entorno

Crea un `.env` con tu client ID de OAuth de Google:

```
PUBLIC_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
```

El cliente OAuth necesita el scope **`https://www.googleapis.com/auth/drive.appdata`**
y, en la pantalla de consentimiento, añadir como *usuarios de prueba* a quien
vaya a usar la app (o publicarla) mientras esté en modo testing.

## Datos e import/export

- **Importar**: sube tu backup `.fitnotes` (o `.db`/`.sqlite`) desde *Acceso*
  o *Ajustes → Backup*. Se migra el esquema a lo que la app espera y se sube a
  Drive.
- **Exportar**: *Ajustes → Backup → Exportar* descarga un `.fitnotes`
  compatible con la app oficial de FitNotes en Android.
- **Sync**: la app abre siempre desde la copia local (OPFS) y se reconcilia
  con Drive en segundo plano, así que la cobertura no bloquea nada. Cada
  cambio se guarda al momento en el dispositivo y se sube agrupado; sin red
  queda como *pendiente* y se reintenta solo (backoff, `online`, al volver a
  la app). Si una subida llega a Drive pero se pierde la respuesta, el MD5
  la reconoce como propia. Si otro dispositivo subió cambios mientras este
  tenía series sin subir, gana la copia de Drive y la local se aparta en
  *Ajustes* para restaurarla o descargarla.

## PWA / offline

`public/sw.js` cachea la shell de la app y los assets; los datos viven en OPFS,
así que la app funciona sin conexión salvo la sincronización con Drive (que
requiere red). Instálala desde *Ajustes → Instalar* o el menú del navegador.
