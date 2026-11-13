# Plantilla e-commerce · Artículos eléctricos

Tienda online base para artículos eléctricos (cables, enchufes, interruptores, protecciones), pensada para **duplicarse muchas veces en Railway** cambiando solo marca, colores y productos.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/TEMPLATE_CODE)

> Reemplaza `TEMPLATE_CODE` por el código de tu template después de publicarlo (ver [Convertir en Template](#convertir-el-proyecto-en-template-de-railway)).

**Incluye:** tienda pública (catálogo con filtros técnicos, venta por unidad / metro / rollo, kits, carrito, checkout invitado o con cuenta, despacho por comuna o retiro), panel `/admin` (productos, carga masiva Excel/CSV, categorías y atributos, kits, pedidos, clientes, despacho, pagos, usuarios con roles, apariencia y contenido del inicio), pagos Webpay Plus / Mercado Pago / transferencia, SEO y correos.

**Stack:** Next.js 16 (App Router) · TypeScript · PostgreSQL + Prisma 7 · Tailwind CSS 4 · Auth.js · Zod · Vitest + Playwright.

---

## Índice

1. [Correr en local](#correr-en-local)
2. [Cambiar el tema y la marca](#cambiar-el-tema-y-la-marca)
3. [Desplegar en Railway](#desplegar-en-railway)
4. [Duplicar una tienda](#duplicar-una-tienda-nueva)
5. [Convertir en Template de Railway](#convertir-el-proyecto-en-template-de-railway)
6. [Pagos: de pruebas a producción](#pagos-de-pruebas-a-producción)
7. [Variables de entorno](#variables-de-entorno)
8. [Estructura y notas técnicas](#estructura-y-notas-técnicas)

---

## Correr en local

Requisitos: **Node.js 22.12+**. No necesitas Docker (si lo tienes, hay un `docker-compose.yml` alternativo).

```bash
npm install
cp .env.example .env          # completa AUTH_SECRET y ADMIN_PASSWORD
npm run db                    # Postgres local en el puerto 5433 (deja esta terminal abierta)
```

En otra terminal:

```bash
npm run db:deploy             # aplica migraciones
npm run db:seed               # datos de ejemplo + admin (solo si la base está vacía)
npm run dev                   # http://localhost:3000  ·  panel: /admin
```

Para generar `AUTH_SECRET`: `openssl rand -base64 32`.

### Tests

```bash
npm test                      # unidad + integración (usa la base tienda_test de `npm run db`)
npm run build && npm start    # en otra terminal, para las pruebas end-to-end
E2E_BASE_URL=http://localhost:3000 npm run e2e   # Playwright con el Chrome instalado
```

### Reiniciar la base local desde cero

Detén `npm run db`, borra la carpeta `.pgdata` y vuelve a ejecutar `npm run db`, `npm run db:deploy` y `npm run db:seed`.

---

## Cambiar el tema y la marca

Todos los colores, tipografías y radios salen de **`theme.config.ts`**. Ningún componente usa colores fijos (Tailwind no tiene paleta por defecto y ESLint lo bloquea).

| Qué quieres hacer | Dónde |
|---|---|
| Elegir uno de los 3 temas al crear la tienda (Plano, Claro, Cobre) | Variable `THEME_PRESET` |
| Ajustar colores, tipografías, radio, nombre, logo y favicon sin tocar código | `/admin/apariencia` (vista previa en vivo + verificación de contraste AA) |
| Cambiar los valores por defecto o crear un tema nuevo para todas las tiendas | `theme.config.ts` → `themePresets` |
| Activar, ordenar y editar las secciones del inicio | `/admin/inicio` |

Prioridad: `theme.config.ts` → preset elegido → cambios guardados en el admin.

Tokens disponibles (variables CSS): `--color-primary`, `--color-accent`, `--color-bg`, `--color-surface`, `--color-text`, `--color-muted`, `--radius`, `--font-display`, `--font-body`, `--font-mono`. En componentes se usan como clases de Tailwind: `bg-primary`, `text-muted`, `border-border`, `rounded-md`, `font-display`, etc. Para ver los 3 temas lado a lado en desarrollo: `/dev/tema`.

---

## Desplegar en Railway

El proyecto declara su infraestructura en `.railway/railway.ts` (Infrastructure as Code de Railway: servicio web, PostgreSQL, volumen `/data`, build, arranque y healthcheck `/api/health`). Se aplica con `railway config apply`. **Al arrancar**, `scripts/start.ts`:

1. valida las variables de entorno (mensajes claros si falta algo),
2. ejecuta `prisma migrate deploy`,
3. si la base está vacía, crea categorías, atributos, 12 productos de ejemplo y el usuario dueño desde `ADMIN_EMAIL` / `ADMIN_PASSWORD`,
4. inicia Next.js en `$PORT`.

El build **no necesita base de datos** (en Railway no está disponible durante el build).

### Pasos (primera vez, manual)

1. **Nuevo proyecto** en Railway → *Deploy from GitHub repo* → elige este repositorio (y la rama a desplegar en *Settings → Source*).
2. **Agrega PostgreSQL**: en el proyecto, *+ Create → Database → PostgreSQL*.
3. **Variables** del servicio web (*Variables → Raw Editor*):
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   AUTH_SECRET=<openssl rand -base64 32>
   ADMIN_EMAIL=dueno@mitienda.cl
   ADMIN_PASSWORD=<mínimo 8 caracteres>
   STORE_NAME=Mi Tienda
   THEME_PRESET=plano
   ```
4. **Imágenes**: configura las variables `S3_*` **o** agrega un volumen al servicio web (*Settings → Volumes*, ruta `/data`): se usa automáticamente `/data/uploads`.
5. **Dominio**: *Settings → Networking → Generate Domain* (o conecta tu dominio y define `APP_URL`).
6. Despliega. Cuando el healthcheck pase, entra a `https://<tu-dominio>/admin`.

---

## Duplicar una tienda nueva

Con el template publicado, cada tienda nueva es:

1. **Duplicar**: botón *Deploy on Railway* (o *New Project → Template*).
2. **Completar variables**: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `STORE_NAME`, `THEME_PRESET` (y opcionalmente S3, SMTP y pagos). `DATABASE_URL` y `AUTH_SECRET` vienen resueltas por el template.
3. **Listo**: al primer arranque se crea la base, los datos de ejemplo y el usuario dueño. Luego, en `/admin`: cambia logo y colores en *Apariencia*, reemplaza los productos de ejemplo (a mano o con *Carga masiva*), y configura despacho, pagos y datos bancarios.

---

## Convertir el proyecto en Template de Railway

1. Despliega una vez el proyecto completo (servicio web + PostgreSQL) siguiendo los pasos anteriores y verifica que funciona.
2. En el proyecto: *Settings → Generate Template from Project* (o desde [railway.com/compose](https://railway.com/compose)).
3. En el servicio web del template, define las variables:
   | Variable | Valor en el template |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
   | `AUTH_SECRET` | `${{secret(32)}}` (se genera una distinta por tienda) |
   | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `STORE_NAME` | sin valor, marcadas como requeridas |
   | `THEME_PRESET` | `plano` (editable) |
4. Agrega el volumen `/data` al servicio web (si no usarás S3) y activa *Generate Domain*.
5. Publica el template, copia su código y reemplaza `TEMPLATE_CODE` en el botón de este README.

---

## Pagos: de pruebas a producción

Las credenciales viven **solo en variables de entorno**. En `/admin/pagos` activas cada medio, editas sus textos y ves si está en modo pruebas o producción.

| Medio | Pruebas (sandbox) | Producción |
|---|---|---|
| **Webpay Plus** | Sin variables: usa el ambiente de integración de Transbank | `TRANSBANK_ENVIRONMENT=production`, `TRANSBANK_COMMERCE_CODE` y `TRANSBANK_API_KEY` entregados por Transbank tras la validación |
| **Mercado Pago** | `MERCADOPAGO_ACCESS_TOKEN=TEST-…` (credenciales de prueba) | `MERCADOPAGO_ACCESS_TOKEN=APP_USR-…` y `MERCADOPAGO_WEBHOOK_SECRET` |
| **Transferencia** | Siempre disponible | Completa los datos bancarios en `/admin/pagos` |

Los pasos detallados de cada pasarela (tarjetas de prueba, URLs de retorno y webhook) se documentan junto con su implementación.

---

## Variables de entorno

Ver **`.env.example`** (comentado). Resumen:

| Variable | Obligatoria | Uso |
|---|---|---|
| `DATABASE_URL` | Sí | PostgreSQL |
| `AUTH_SECRET` | Sí | Firma de sesiones (≥ 32 caracteres) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | En la primera instalación | Usuario dueño inicial |
| `STORE_NAME`, `THEME_PRESET`, `STORE_CONTACT_EMAIL` | No | Datos iniciales de la tienda |
| `APP_URL` | No | URL pública (con dominio propio) |
| `S3_*` / `UPLOAD_DIR` | No | Almacenamiento de imágenes |
| `TRANSBANK_*`, `MERCADOPAGO_*` | No | Pagos |
| `SMTP_*` | No | Correos (sin SMTP se escriben en el log) |

---

## Estructura y notas técnicas

```
theme.config.ts        Tema por defecto y presets
railway.json           Build, arranque y healthcheck en Railway
prisma/                Schema, migraciones y seed (seed-data/ editable)
scripts/start.ts       Arranque en producción (migraciones + seed + Next)
src/app/(store)/       Tienda pública
src/app/admin/         Panel de administración
src/app/api/           health, auth, media, plantilla de importación, pagos
src/modules/           catalog · cart · checkout · payments · theme · admin · auth · media · email · orders · home
tests/                 unit · integration · e2e
```

- **Render por request**: los datos vienen de la base, así que toda página que lea datos parte con `await connection()` y las lecturas usan `"use cache"` con tags que el admin invalida al guardar. Si una página consulta la base sin `connection()`, el build falla con un mensaje que lo explica (`src/lib/db.ts`).
- **Stock**: se descuenta de forma atómica al crear el pedido (dos compras simultáneas no pueden vender la misma unidad) y se libera si la reserva vence sin pago o el pedido se cancela.
- **Sesiones**: clientes (`/cuenta`) y administradores (`/admin`) usan instancias separadas de Auth.js con cookies distintas.
- **Imágenes**: se normalizan a WebP con `sharp`; los SVG se rechazan por seguridad.
