# 3. Variables y runtime

## Archivo de produccion

La EC2 debe tener un archivo `.env.production` basado en `.env.production.example`.

Variables requeridas:

```bash
NEXT_PUBLIC_CONVEX_URL=https://your-production-deployment.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-production-deployment.convex.site
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx
```

Las variables `NEXT_PUBLIC_*` se usan durante el build de Next.js. Por eso, en produccion se debe construir la imagen con:

```bash
docker compose --env-file .env.production build
```

`CLERK_SECRET_KEY` queda disponible en runtime por medio de `env_file` en `docker-compose.yml`.

## Convex

Convex se mantiene como SaaS. Para produccion se debe usar el deployment productivo de Convex y configurar sus variables propias desde Convex, no desde la EC2.

Si una variable es usada por funciones Convex, configurala con:

```bash
npx convex env set NOMBRE_VARIABLE valor
```

## Clerk

Clerk debe tener configurados los dominios de produccion de la app. Cuando se active HTTPS en el ALB, las URLs publicas deben apuntar al dominio final.

## Runtime del contenedor

La imagen usa:

- `bun install --frozen-lockfile` para instalar dependencias.
- `bun run build` para compilar Next.js.
- salida `standalone` de Next.js para reducir el runtime.
- `bun server.js` para iniciar el servidor en `0.0.0.0:3000`.
