# 4. Healthcheck y operacion

## Endpoint

La aplicacion expone:

```text
GET /api/health
```

Respuesta esperada:

```json
{
  "ok": true,
  "service": "groupsapp"
}
```

## Configuracion del Target Group

En el Target Group del ALB:

- Protocol: `HTTP`.
- Port: `3000`.
- Health check path: `/api/health`.
- Success codes: `200`.

## Operacion basica

Ver contenedores:

```bash
docker compose ps
```

Ver logs:

```bash
docker compose logs -f web
```

Reiniciar la app:

```bash
docker compose restart web
```

Reconstruir despues de cambios:

```bash
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
```

## Siguiente mejora recomendada

Cuando el despliegue manual este probado, convertir esta arquitectura a infraestructura como codigo con Terraform o AWS CDK. Para este proyecto, Terraform seria una buena opcion si se quiere independencia del stack de aplicacion; CDK seria buena opcion si se prefiere definir infraestructura con TypeScript.
