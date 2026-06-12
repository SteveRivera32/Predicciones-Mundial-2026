# Arena Mundial — versión pública (~10 000 usuarios)

Carpeta **independiente** de la quiniela privada (`/PrediccionesMundial/`). Nada aquí modifica el código ni el servidor de tus amigos.

## URLs

| Versión | Ruta | Puerto API |
|---------|------|------------|
| Privada (amigos) | `/PrediccionesMundial/` | `8787` |
| Pública (arena) | `/ArenaMundial/login/` → `/ArenaMundial/app/` | `8788` |

## Diferencias clave

| | Privada | Arena (pública) |
|---|---------|-----------------|
| Usuarios | Lista fija + PIN | Registro con usuario/contraseña |
| Login | Overlay dentro de la app | Página propia |
| Sincronización | WebSocket + estado completo a todos | **Sin broadcast** |
| Tus cambios | Todos ven el refresh | Solo tú; rankings/oficial se consultan cada ~45 s |
| Datos | `server/data/state.json` | `ArenaMundial/server/data/arena.db` (SQLite) |

## Desarrollo

```bash
# Quiniela privada (como siempre)
npm run dev:all

# Arena pública (API :8788 + Vite :5174)
npm run dev:arena
```

Abre http://localhost:5174/ArenaMundial/login/

El **primer usuario registrado** es admin (puede publicar resultados oficiales vía API).

## Producción

En la VM necesitas **dos procesos** (internamente 8787 y 8788; el visitante solo ve `tivotabo.com`):

```bash
npm run build && npm start                 # privada → 8787
npm run build:arena && npm run server:arena  # arena   → 8788
```

Nginx debe enviar `/ArenaMundial/` y `/api/arena/` al puerto **8788**. Ver `deploy/nginx-tivotabo.conf.example`.

Sirve `dist-arena/` desde el proceso arena. Mismo dominio que la quiniela privada; puerto 80/443 en nginx, no hace falta abrir 8788 al exterior.

## Variables de entorno

| Variable | Default | Uso |
|----------|---------|-----|
| `ARENA_PORT` | `8788` | Puerto API |
| `ARENA_DATA_DIR` | `ArenaMundial/server/data` | SQLite y datos |
| `ARENA_MAX_USERS` | `10000` | Cupo máximo |
| `ARENA_JWT_SECRET` | *(dev)* | **Obligatorio cambiar en prod** |
| `ARENA_COOKIE_DOMAIN` | *(vacío)* | En prod con `www` y sin `www`: `.tivotabo.com` (1 cuenta por dispositivo) |
| `ARENA_SHARED_CACHE_MS` | `30000` | Cache servidor para oficial/rankings |
| `ARENA_KICKOFF_CHECK_MS` | `60000` | Revisión auto-inicio al llegar kickoff |

## Resultados oficiales (manual)

El **admin** publica marcadores desde la quiniela (panel resultado oficial) o con script:

```bash
# México 2-0 Sudáfrica (fase de grupos, id gg-A-0)
npm run arena:set-official -- gg-A-0 2 0
```

Al **kickoff** de cada partido, el servidor Arena pone el partido **en juego (0-0)** solo. El marcador final lo confirmas tú.

## Próximos pasos (UI completa)

La interfaz de predicciones aún es un **shell**. Para portar la quiniela completa:

1. Reutilizar módulos de `src/` vía alias `@shared` (torneo, puntuación, reglas…).
2. Sustituir `sync.js` por `ArenaMundial/src/api.js` (ya hecho).
3. Copiar/adaptar vistas de `app.js` sin admin de participantes ni WebSocket.
4. Rankings: calcular en servidor con cache o paginar client-side solo top 100.

## API (prefijo `/api/arena`)

- `POST /auth/register`, `/auth/login`, `/auth/logout`
- `GET /auth/me`
- `GET|PUT /me/predictions` — solo el usuario autenticado
- `GET /official`, `GET /rankings` — lectura compartida cacheada
- `PUT /admin/official` — admin
