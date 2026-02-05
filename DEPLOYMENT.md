# Puff - Docker Deployment Guide

## Quick Start (Production)

### Prerequisites
- Docker
- Docker Compose

### Step 1: Get docker-compose.yml

Download `docker-compose.yml` from the [latest GitHub Release](https://github.com/enesbaytekin/puff/releases/latest)

**Note:** Release'daki docker-compose.yml dosyası versiyon tag'li Docker imajları kullanır (örn: `v1.0.4`)

### Step 2: Create Environment File

Create a `.env` file in the same directory as `docker-compose.yml`:

```env
# Database Configuration
POSTGRES_DB=puff
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here

# JWT Secret (CHANGE THIS!)
JWT_SECRET=your_jwt_secret_here
```

**Generate secure passwords:**
```bash
# Generate database password
openssl rand -base64 32

# Generate JWT secret
openssl rand -hex 32
```

### Step 3: Deploy with Docker Compose

```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f
```

### Step 4: Access Application

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
docker-compose -f docker-compose.dev.yml exec db psql -U postgres -d puff

# Run SQL commands
\dt                    -- List tables
SELECT * FROM users;   -- Query users
SELECT * FROM puffs;   -- Query puffs
\q                     -- Quit
```

## Available Docker Images

- **Frontend UI**: `enesbaytekin/puff-ui:latest`
- **Backend Server**: `enesbaytekin/puff-server:latest`

### Versioned Images (Releases)

Release'lar versioned tag'ler ile oluşturulur:
- `enesbaytekin/puff-ui:v1.0.4`
- `enesbaytekin/puff-server:v1.0.4`

### Pull Images Manually

```bash
# Latest version
docker pull enesbaytekin/puff-ui:latest
docker pull enesbaytekin/puff-server:latest

# Specific version
docker pull enesbaytekin/puff-ui:v1.0.4
docker pull enesbaytekin/puff-server:v1.0.4
```

## Container Architecture

```
┌─────────────────────────────────────────────────────────┐
│                       Nginx (UI)                        │
│                    Port 80 (Public)                     │
│              enesbaytekin/puff-ui:{VERSION}             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ├──► /api/* ──────────────────┐
                     │                             │
                     │                             ▼
                     │                   ┌─────────────────────┐
                     │                   │   Express Server    │
                     │                   │     Port 3000       │
                     │                   │  puff-server:{VERS} │
                     │                   └──────────┬──────────┘
                     │                              │
                     │                              ▼
                     │                   ┌─────────────────────┐
                     │                   │    PostgreSQL       │
                     │                   │     Port 5432       │
                     │                   │    postgres:16      │
                     │                   │     Database:       │
                     │                   │       "puff"        │
                     │                   └─────────────────────┘
                     │
                     └──► /* (Static files)
```

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `POSTGRES_DB` | Database name | `puff` | No |
| `POSTGRES_USER` | Database user | `postgres` | No |
| `POSTGRES_PASSWORD` | Database password | - | **Yes** |
| `JWT_SECRET` | JWT signing secret | - | **Yes** |
| `PORT` | Server port | `3000` | No |

**Note:** Database name changed from `digitoy` to `puff` in v1.0.4

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
# Add to docker-compose.yml
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
docker-compose exec db \
  pg_dump -U postgres puff > backup.sql

# Restore
docker-compose exec -T db \
  psql -U postgres puff < backup.sql
```

### 4. Monitor Logs

```bash
# Real-time logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Specific service
docker-compose logs -f server
```

### 5. Update to Latest Version

```bash
# Pull new images
docker-compose pull

# Restart with new images
docker-compose up -d

# Remove old images
docker image prune -a
```

### 6. Check Puff State

Database'de puff state'lerini görüntüle:

```bash
docker-compose exec db psql -U postgres -d puff -c \
  "SELECT name, hunger, mood, energy, updated_at FROM puffs;"
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs

# Check container status
docker-compose ps
```

### Database Connection Issues

```bash
# Check if database is healthy
docker-compose exec db pg_isready

# Restart database
docker-compose restart db
```

### Reset Everything

```bash
# Stop and remove containers, volumes
docker-compose down -v

# Start fresh
docker-compose up -d
```

### State Decay Not Working

```bash
# Check server logs for decay calculation
docker-compose logs server | grep decay

# Check last update time
docker-compose exec db psql -U postgres -d puff -c \
  "SELECT name, hunger, mood, energy, updated_at FROM puffs;"
```

### LocalStorage Issues

Browser console'da kontrol et:

```javascript
// Check localStorage
console.log(localStorage.getItem('puffState_YOUR_USER_ID'));

// Clear localStorage (reset)
localStorage.clear();
```

## CI/CD Pipeline

Images are automatically built and pushed to Docker Hub when:

### Release Workflow (.github/workflows/docker-build.yml)

**Triggers:**
- Version tags pushed (e.g., `v1.0.4`)

**Actions:**
1. Extract version from tag
2. Build and push UI image (`enesbaytekin/puff-ui:v1.0.4`)
3. Build and push Server image (`enesbaytekin/puff-server:v1.0.4`)
4. Generate `release/docker-compose.yml` with version tags
5. Create GitHub Release with:
   - `docker-compose.yml` (versioned)
   - Sample .env content in release notes

### Manual Release Process

```bash
# 1. Commit all changes
git add .
git commit -m "prep: release v1.0.4"

# 2. Create version tag
git tag v1.0.4

# 3. Push tag to GitHub
git push origin main --tags
```

GitHub Actions otomatik olarak:
- Docker imajlarını build eder
- Docker Hub'a push eder
- Release oluşturur
- docker-compose.yml dosyasını release'a ekler

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

## Project Features

### State Management
- **3 States**: Fullness (Hunger), Mood, Energy
- **Decay System**: Zamanla azalır (offline calculation)
- **Offline Support**: LocalStorage sync
- **Immediate Sync**: State değişiklikleri anında server'a

### Food System
- **12 Foods**: Apple, Cake, Fish, Cookie, Ice Cream, Donut, Pizza, Sandwich, Burger, Carrot, Banana, Chicken
- **Food Effects**: Sugar crash, protein boost, etc.
- **Drag & Drop**: Mouse ve touch ile besleme

### Decay Rates
- Fullness: ~10 saatte 100→1
- Mood: ~8 saatte 100→1
- Energy: ~6.5 saatte 100→1

## Support

For issues or questions:
- GitHub Issues: https://github.com/enesbaytekin/puff/issues
- Docker Hub: https://hub.docker.com/r/enesbaytekin/puff-ui

## Version History

### v1.0.4 (2026-02-05)
- ✅ State management system
- ✅ Food system (12 foods)
- ✅ Decay system (offline + online)
- ✅ UI improvements (progress bars, panels)
- ✅ Release system (version tags)
- ✅ Database rename (digitoy → puff)

### Previous Versions
- v0.2.x: Physics improvements, state effects
- v0.1.x: Basic auth, database, puff creation
