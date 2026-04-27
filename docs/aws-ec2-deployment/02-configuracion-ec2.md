# 2. Configuracion EC2

## Requisitos de la instancia

- AMI recomendada: Amazon Linux 2023 o Ubuntu LTS.
- Arquitectura: `x86_64`.
- Tipo inicial sugerido: `t3.micro` o equivalente disponible en la cuenta estudiantil.
- Disco: minimo 20 GB.

## Paquetes base

Instala Docker y el plugin de Docker Compose segun la distribucion elegida.

En Amazon Linux 2023:

```bash
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
```

Cierra sesion y vuelve a entrar para que el grupo `docker` aplique.

## Despliegue manual

Desde la EC2:

```bash
git clone <repo-url> groupsapp
cd groupsapp
cp .env.production.example .env.production
```

Edita `.env.production` con valores reales de produccion.

Construye y levanta la aplicacion:

```bash
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
```

Verifica:

```bash
docker compose ps
docker compose logs -f web
curl http://127.0.0.1:3000/api/health
```

## Actualizacion manual

```bash
git pull
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
```
