# 1. Arquitectura

## Objetivo

Preparar GroupsApp para producción en AWS usando una instancia EC2 con Docker detrás de un Application Load Balancer.

## Componentes

- Región AWS: `us-east-1`.
- Application Load Balancer público.
- Instancia EC2 con Docker y Docker Compose.
- Contenedor Next.js escuchando en el puerto `3000`.
- Convex SaaS como backend de datos y tiempo real.
- Clerk SaaS como proveedor de autenticación.

## Flujo

```text
Internet
  -> Application Load Balancer :80/:443
  -> EC2 :3000
  -> Contenedor Next.js
  -> Convex SaaS / Clerk SaaS
```

## Security Groups

- ALB:
  - Entrada `80` desde internet.
  - Entrada `443` desde internet cuando exista certificado ACM.
- EC2:
  - Entrada `3000` solo desde el Security Group del ALB.
  - Entrada `22` solo desde tu IP administrativa.
  - Salida a internet para acceder a Convex, Clerk y descargar imagenes/dependencias.

## Nota sobre HTTPS

El TLS debe terminar en el ALB usando AWS Certificate Manager. La aplicación puede correr HTTP interno entre ALB y EC2 mientras el Security Group de EC2 solo acepte tráfico del ALB.
