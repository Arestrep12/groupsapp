# Tareas Para AWS + Convex

## 1. Integración segura Clerk + Convex

- Estado: completada.
- Descripción: usar el JWT template `convex` de Clerk, enviar el token desde el cliente y validar identidad en Convex con `ctx.auth.getUserIdentity()`.

## 2. Archivos con Convex Storage

- Estado: completada.
- Descripción: agregar soporte de adjuntos usando Convex Storage, metadata de archivos y asociación con mensajes.

## 3. Preparación de despliegue en AWS

- Estado: completada.
- Descripción: target definido como EC2 con Docker detrás de Application Load Balancer en `us-east-1`, manteniendo Convex como SaaS. Se agregó configuración de build/runtime, variables de producción, healthcheck y documentación en `docs/aws-ec2-deployment/`.

## 4. Separación de ambientes

- Estado: pendiente.
- Descripción: documentar y configurar ambientes de desarrollo, staging y producción para Clerk, Convex y Next.js.

## 5. Endurecimiento de producción

- Estado: pendiente.
- Descripción: quitar seeds automáticos de producción, mejorar paginación, manejo de errores, límites y observabilidad.

## 6. Modelo distribuido de mensajería

- Estado: pendiente.
- Descripción: completar no leídos, presencia, adjuntos, conversaciones directas y permisos más explícitos.
