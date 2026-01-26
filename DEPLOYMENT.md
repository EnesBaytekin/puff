# Digitoy - Docker Deployment Guide

## Quick Start (Production)

### Prerequisites
- Docker
- Docker Compose

### Step 1: Create Environment File

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and set secure values:

```env
# Database Configuration
POSTGRES_DB=digitoy
POSTGRES_USER=postgres
POSTGRES_PASSWORD=CHANGE_THIS_SECURE_PASSWORD

# JWT Secret (CHANGE THIS!)
JWT_SECRET=CHANGE_THIS_SUPER_SECRET_JWT_KEY
```

### Step 2: Deploy with Docker Compose

```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Step 3: Access Application

- **Application**: http://localhost
- **API**: http://localhost/api

## Local Development

### Start Development Environment

```bash
# Build and start all services
docker-compose -f docker-compose.dev.yml up --build

# Run in background
docker-compose -f docker-compose.dev.yml up -d
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.dev.yml logs -f

# Specific service
docker-compose -f docker-compose.dev.yml logs -f server
docker-compose -f docker-compose.dev.yml logs -f ui
docker-compose -f docker-compose.dev.yml logs -f db
```

### Stop Services

```bash
docker-compose -f docker-compose.dev.yml down
```

### Database Access

```bash
# Connect to PostgreSQL
docker-compose -f docker-compose.dev.yml exec db psql -U postgres -d digitoy

# Run SQL commands
\dt                    -- List tables
SELECT * FROM users;   -- Query users
SELECT * FROM puffs;   -- Query puffs
\q                     -- Quit
```

## Available Docker Images

- **Frontend UI**: `enesbaytekin/puff-ui:latest`
- **Backend Server**: `enesbaytekin/puff-server:latest`

### Pull Images Manually

```bash
docker pull enesbaytekin/puff-ui:latest
docker pull enesbaytekin/puff-server:latest
```

## Container Architecture

```
┌─────────────────────────────────────────────────────────┐
│                       Nginx (UI)                        │
│                    Port 80 (Public)                     │
│         enesbaytekin/puff-ui:latest                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ├──► /api/* ──────────────────┐
                     │                             │
                     │                             ▼
                     │                   ┌─────────────────────┐
                     │                   │   Express Server    │
                     │                   │     Port 3000       │
                     │                   │  puff-server:latest │
                     │                   └──────────┬──────────┘
                     │                              │
                     │                              ▼
                     │                   ┌─────────────────────┐
                     │                   │    PostgreSQL       │
                     │                   │     Port 5432       │
                     │                   │    postgres:16      │
                     │                   └─────────────────────┘
                     │
                     └──► /* (Static files)
```

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `POSTGRES_DB` | Database name | `digitoy` | No |
| `POSTGRES_USER` | Database user | `postgres` | No |
| `POSTGRES_PASSWORD` | Database password | - | **Yes** |
| `JWT_SECRET` | JWT signing secret | - | **Yes** |
| `PORT` | Server port | `3000` | No |

## Production Tips

### 1. Use Strong Passwords

Generate secure passwords:

```bash
# Generate password
openssl rand -base64 32

# Generate JWT secret
openssl rand -hex 32
```

### 2. Enable HTTPS (Recommended)

Use Traefik or Nginx reverse proxy for HTTPS:

```yaml
# Add to docker-compose.prod.yml
reverse-proxy:
  image: traefik:v2.10
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
    - ./traefik.yml:/etc/traefik/traefik.yml
```

### 3. Backup Database

```bash
# Backup
docker-compose -f docker-compose.prod.yml exec db \
  pg_dump -U postgres digitoy > backup.sql

# Restore
docker-compose -f docker-compose.prod.yml exec -T db \
  psql -U postgres digitoy < backup.sql
```

### 4. Monitor Logs

```bash
# Real-time logs
docker-compose -f docker-compose.prod.yml logs -f

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100

# Specific service
docker-compose -f docker-compose.prod.yml logs -f server
```

### 5. Update to Latest Version

```bash
# Pull new images
docker-compose -f docker-compose.prod.yml pull

# Restart with new images
docker-compose -f docker-compose.prod.yml up -d

# Remove old images
docker image prune -a
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Check container status
docker-compose -f docker-compose.prod.yml ps
```

### Database Connection Issues

```bash
# Check if database is healthy
docker-compose -f docker-compose.prod.yml exec db pg_isready

# Restart database
docker-compose -f docker-compose.prod.yml restart db
```

### Reset Everything

```bash
# Stop and remove containers, volumes
docker-compose -f docker-compose.prod.yml down -v

# Start fresh
docker-compose -f docker-compose.prod.yml up -d
```

## CI/CD Pipeline

Images are automatically built and pushed to Docker Hub when:

1. **Push to main**: Builds `latest` and `main` tags
2. **Tagged release (v*)**: Builds versioned tags and creates GitHub Release
3. **Pull requests**: Builds but doesn't push (for testing)

### GitHub Actions Workflow

- File: `.github/workflows/docker-build.yml`
- Triggers: Push to main, tags, pull requests
- Actions: Build, test, push to Docker Hub, create releases

### Manual Image Build

```bash
# Build UI image
docker build -f Dockerfile.ui -t enesbaytekin/puff-ui:latest .

# Build Server image
docker build -f Dockerfile.server -t enesbaytekin/puff-server:latest .

# Push to Docker Hub
docker push enesbaytekin/puff-ui:latest
docker push enesbaytekin/puff-server:latest
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/enesbaytekin/puff/issues
- Docker Hub: https://hub.docker.com/r/enesbaytekin/puff-ui
