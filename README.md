# GroupsApp

Aplicación de mensajería grupal construida con `Next.js`, `Bun`, `Convex` y `Clerk`.

Este archivo explica cómo funciona el repositorio y cómo levantarlo localmente. Las decisiones de producto, arquitectura y dirección del proyecto viven en `GUIDE.md`.

## Stack

- `Next.js` con App Router
- `React`
- `TypeScript`
- `Bun`
- `Convex`
- `Clerk`

## Estructura del repositorio

| Ruta | Propósito |
|------|-----------|
| `app/` | Frontend de Next.js y rutas de la app |
| `app/chat/` | Shell del chat, grupos y administración de miembros |
| `app/signup/` | Alta de usuario con UI propia sobre Clerk |
| `convex/` | Schema, queries, mutations y HTTP actions de Convex |
| `convex/_generated/` | Tipos y bindings generados por Convex |
| `public/` | Assets estáticos |

## Flujo actual de la app

- `/` muestra el login con UI propia y autenticación real con Clerk
- `/signup` crea cuentas nuevas con Clerk
- `/chat` exige sesión y consume datos reactivos desde Convex
- los grupos se persisten en `conversations`
- los miembros y permisos internos se persisten en `conversationMembers`
- el rol interno disponible hoy es `admin` o `member`
- los admins pueden crear grupos, renombrarlos, agregar usuarios por `username`, quitar miembros y cambiar admins

## Variables de entorno

Debes configurar al menos estas variables:

- `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_DEPLOYMENT`
- `NEXT_PUBLIC_CONVEX_SITE_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SIGNING_SECRET`

## Instalación

```bash
bun install
```

## Desarrollo

Levanta Next.js:

```bash
bun run dev
```

Si trabajas sobre `convex/`, asegúrate de tener disponible el entorno de Convex para desarrollo y regenera bindings cuando cambie schema o funciones:

```bash
npx convex codegen
```

## Scripts útiles

```bash
bun run dev
bun run lint
bunx tsc --noEmit
npx convex codegen
```

## Reglas de trabajo en este repo

- usar `bun` para instalar dependencias y correr scripts
- después de cada cambio de código correr lint y tipos
- si solo cambian archivos Markdown o documentación, no hace falta correr lint ni tipos
- si cambias algo dentro de `convex/`, debes correr `npx convex codegen`
- `README.md` documenta cómo usar el repo
- `GUIDE.md` sigue siendo el documento rector del proyecto

## Notas de implementación

- Convex es la fuente de verdad para grupos, membresías y mensajes
- Clerk resuelve autenticación
- la tabla `users` funciona como proyección local de identidad sincronizada desde Clerk
- las invitaciones por `username` dependen de que ese usuario exista en la tabla `users`
- los errores esperados de producto deben resolverse como respuestas controladas, no como excepciones innecesarias de servidor
