# Puff - Proje Özeti ve Durum Raporu

## Proje Nedir?

Puff, soft-body (yumuşak cisim) fizik tabanlı bir sanal evcil hayvan uygulamasıdır. Browser tabanlı, sakin ve tatmin edici bir dijital oyuncak. Birthday gift olarak başladı, genel web uygulamasına dönüştü.

**Temel Özellikler:**
- Cute, yumuşak vücutlu bir creature (puff)
- Touch/drag ile etkileşim (realistic physics)
- State sistemi: Fullness (Hunger), Mood, Energy - zamanla azalır
- Yemek sistemi: 12 farklı yiyecek, sürükle-bırak ile besleme
- User login ve custom puff oluşturma
- PostgreSQL database ile persistence
- Offline support ile client-side state sync
- **Dark mode desteği (Light/Dark/Auto)**
- **Modern UI/UX (modal panels, responsive)**

---

## Teknik Stack

- **Frontend:** Vanilla JS, Canvas API, CSS Variables
- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL 16
- **Deployment:** Docker, Docker Compose, Nginx reverse proxy
- **Physics:** Custom particle-constraint sistemi (Verlet integration)
- **State Management:** LocalStorage + server sync, offline decay
- **Theme System:** CSS custom properties, system preference detection

---

## Yapılan İşler (Completed)

### 1. Database Schema (Backend) ✅
**Dosya:** `server/db.js`

Puff state'leri database'e eklendi:
```sql
hunger INTEGER DEFAULT 50 CHECK (hunger >= 1 AND hunger <= 100),
mood INTEGER DEFAULT 50 CHECK (mood >= 1 AND mood <= 100),
energy INTEGER DEFAULT 50 CHECK (energy >= 1 AND energy <= 100)
```

### 2. API Endpoints ✅
**Dosya:** `server/routes/puffs.js`

- `POST /api/puffs/create` - Puff oluşturma
- `GET /api/puffs/mine` - Kullanıcının puff'ını getir (offline decay ile)
- `PUT /api/puffs/state` - Puff state güncelleme

**Özellik:** Offline decay calculation - kullanıcı online olmadığında bile state'ler zamanla azalır:
- Fullness: ~10 saatte 100→1
- Mood: ~8 saatte 100→1
- Energy: ~6.5 saatte 100→1

### 3. Physics & Visual Effects ✅
**Dosya:** `js/physics/softbody.js`

- **Energy → Movement Speed:** Düşük enerji = yavaş hareket, yüksek enerji = hızlı
  - Rotation: 5% - 100% speed
  - Movement scale: 0.002 - 0.12
  - Drag strength: 0.01 - 0.8 (parmağı takip etme hızı)

- **Mood → Shape (Şişkolama):** Düşük mood = yanlara genişleyen, aşağıya squish olmuş şekil
  - Horizontal expansion: `moodFactor * 0.3 * cos²(angle)`
  - Vertical shrink: `moodFactor * 0.15 * sin²(angle)`
  - Smooth transition, keskin köşe yok

- **Mood → Mouth Expression:**
  - Mood 1: Sad (downward U / frown)
  - Mood 50: Neutral (flat line)
  - Mood 100: Happy (upward U / smile)
  - Narrow mouth, cute look (radius * 0.1 width)

- **Hunger (Fullness) → Color:**
  - 1 = starving (çok karanlık)
  - 10-25 = hızla açılıyor (logaritmik)
  - 50+ = normal color
  - Logarithmic scale koyu=80 → light=0

- **Eating Animation:** Yemek yenirken çiğeme animasyonu

**Dosya:** `js/physics/solver.js`

- Dynamic damping: 0.998 (exhausted) → 0.95 (full energy)
- Idle movement delay: 20s (low energy) → 5s (high energy)
- Dynamic idle distance based on energy²

### 4. Input Handling (Touch/Mouse) ✅
**Dosya:** `js/input.js`

- Continuous drag force - energy affects how fast puff follows finger
- Mouse ve touch event handling
- Canvas interaction separation

### 5. State Management System ✅
**Dosya:** `js/stateManager.js`

**Özellikler:**
- **User-specific LocalStorage:** Her kullanıcı için ayrı storage key (`puffState_{userId}`)
- **Offline Support:** Online/offline detection, pending changes tracking
- **Client-side Decay Loop:** Her 30 saniyede state decay uygulanır
- **Fullness → Energy Conversion:** Fullness > 50 ve Energy < 80 iken otomatik dönüşüm
- **Immediate Server Sync:** State değişiklikleri anında server'a gönderilir
- **Integer Clamping:** Tüm değerler Math.round() ile integer'a çevrilir

**Decay Rates (per minute):**
```javascript
FULLNESS_DECAY_PER_MIN = 99 / 600  // ~0.165 (10 hours to minimum)
MOOD_DECAY_PER_MIN = 99 / 480      // ~0.206 (8 hours to minimum)
ENERGY_DECAY_PER_MIN = 99 / 390     // ~0.254 (6.5 hours to minimum)
```

**State Conversion:**
```javascript
// Fullness → Energy (when fullness > 50 and energy < 80)
conversionAmount = 2; // 2 fullness → 1 energy per minute
```

### 6. Food System ✅
**Dosya:** `js/food.js`

**Özellikler:**
- **12 Farklı Yiyecek:**
  - Normal foods: Apple, Fish, Pizza, Sandwich, Burger, Carrot, Banana, Chicken
  - Sweet foods: Cake, Cookie, Ice Cream, Donut (crash effect!)

- **Drag & Drop:** Mouse ve touch ile yemek sürükle-bırak
- **Eating Animation:** Yemek yenirken particle effects
- **Food Effects:** Yiyeceklerin özel etkileri

**Food List:**
| Food | Emoji | Fullness | Mood | Energy | Effect |
|------|-------|----------|------|--------|--------|
| Apple | 🍎 | +15 | +5 | 0 | None |
| Cake | 🍰 | +25 | +15 | +5 | Sugar Crash (2x mood decay, 5min) |
| Fish | 🐟 | +20 | 0 | +10 | Protein Boost (0.5x energy decay, 10min) |
| Cookie | 🍪 | +10 | +20 | 0 | Mini Crash (1.5x mood decay, 3min) |
| Ice Cream | 🍦 | +15 | +25 | 0 | Brain Freeze (2.5x mood decay, 4min) |
| Donut | 🍩 | +20 | +15 | 0 | Sugar Rush (1.8x mood decay, 4.5min) |
| Pizza | 🍕 | +30 | +10 | +5 | None |
| Sandwich | 🥪 | +25 | +5 | +15 | None |
| Burger | 🍔 | +30 | +10 | +10 | None |
| Carrot | 🥕 | +10 | 0 | +5 | Healthy Snack (0.7x energy decay, 10min) |
| Banana | 🍌 | +15 | +5 | +10 | None |
| Chicken | 🍗 | +25 | +5 | +15 | None |

**Food Effects System:**
```javascript
// Example: Sugar Crash
{
    type: 'mood_decay',
    multiplier: 2.0,      // 2x mood decay
    duration: 300000,     // 5 minutes
    name: 'Sugar Crash'
}
```

### 7. UI System ✅ (YENİLENMİŞ)
**Dosyalar:** `index.html`, `css/style.css`, `js/views/app.js`, `js/globalSettings.js`

**Özellikler:**
- **Modal Panel System:** Overlay backdrop ile modern panel tasarımı
- **Control Buttons:** Touch-optimized, responsive butonlar
- **Progress Bars:** Read-only progress bars (Fullness, Mood, Energy)
- **Panel Management:** Tek panel açık, diğerini otomatik kapatır
- **Z-index Hierarchy:** Controls (100) < Overlay (998) < Panels (999)
- **Mobile Responsive:** Mobilde buton textleri gizlenir

**Button Layout:**
- **Top-Right:** ⚙️ Settings, 🚪 Logout (sistem ayarları)
- **Bottom-Left:** 📊 Status, 🍽️ Food (oyunla ilgili butonlar)

**Progress Bar System:**
```html
<div class="status-item">
    <div class="status-label">
        <span>🍖️</span>
        <span>Fullness</span>
    </div>
    <div class="progress-bar">
        <div class="progress-fill hunger-fill" id="hunger-bar"></div>
    </div>
</div>
```

### 8. Theme System ✅ (YENİ)
**Dosyalar:** `js/themeManager.js`, `js/globalSettings.js`, `css/style.css`

**Özellikler:**
- **Dark Mode:** Full dark mode desteği
- **Light Mode:** Default light theme
- **Auto Mode:** Sistem tercihini otomatik algılar
- **CSS Variables:** Tüm renkler CSS custom properties ile yönetilir
- **Global Settings:** Tüm sayfalarda (login, register, customize, app) erişilebilir

**Theme Seçenekleri:**
- ☀️ **Light:** Açık tema (bej/krem tonlar)
- 🌙 **Dark:** Koyu tema (koyu mavi/mor tonlar)
- 🔄 **Auto:** Sistem tercihini takip eder

**CSS Variables:**
```css
:root {
    --bg-color: #f5f0e6;
    --text-color: #2d2d2d;
    --panel-bg: rgba(255, 255, 255, 0.98);
    /* ... more variables */
}

body.theme-dark {
    --bg-color: #1a1a2e;
    --text-color: #e0e0e0;
    --panel-bg: rgba(30, 30, 50, 0.98);
    /* ... more variables */
}
```

### 9. Auth System Improvements ✅ (YENİ)
**Dosyalar:** `js/api.js`, `index.html`

**Özellikler:**
- **Form Clearing:** Logout olduktan sonra tüm form alanları temizlenir
- **Security:** Email/Password field'ları otomatik temizlenir
- **Auth Pages:** Login/Register/Customize sayfalarında da settings butonu

### 10. Release System ✅
**Dosyalar:** `.github/workflows/docker-build.yml`, `docker-compose.release.yml`

**Özellikler:**
- **Version Tags:** Release'da `docker-compose.yml` dosyası versiyon tag'li imajlar içerir
- **Sample .env in Release:** Release notes'ta örnek .env içeriği
- **Single File Release:** Release'da tek `docker-compose.yml` dosyası, direkt kullanıma hazır

**Release Process:**
```bash
git tag v1.0.4
git push origin v1.0.4
```

GitHub Actions:
1. Docker imajlarını build eder ve push eder (`v1.0.4`, `latest`)
2. `release/docker-compose.yml` oluşturur (versioned tags ile)
3. GitHub release oluşturur, sample .env içeriği ekler

### 11. Infrastructure Fixes ✅
**Dosyalar:** `nginx.conf`, `docker-compose.*.yml`

**Özellikler:**
- **Nginx Configuration:** Service name kullanımı (`server:3000` yerine container name)
- **Docker Compose:** Sadece 2 dosya (dev ve release)
- **Network Configuration:** Tüm servisler aynı network'te (`puff-network`)
- **Database Name:** `digitoy` → `puff` (tüm configuration'larda)

---

## Dosya Yapısı ve Önemli Kodlar

### Frontend Files

```
js/
├── physics/
│   ├── particle.js      # Particle class (x, y, oldx, oldy)
│   ├── constraint.js    # Constraint class (distance constraint)
│   ├── softbody.js      # MAIN: Creature rendering, state effects, eating animation
│   └── solver.js        # Physics solver, damping, idle movement
├── canvas.js            # Canvas management
├── input.js             # Touch/mouse handling
├── api.js               # API client, form clearing on logout
├── router.js            # View routing
├── stateManager.js      # State sync, decay, offline support
├── food.js              # Food system, drag & drop, effects
├── themeManager.js      # NEW: Theme management (light/dark/auto)
├── globalSettings.js    # NEW: Global settings panel (all pages)
└── views/
    ├── login.js         # Login view
    ├── register.js      # Registration view
    ├── customize.js     # Puff creation view
    └── app.js           # Main app view, progress bars, panel toggle
```

### Backend Files

```
server/
├── db.js                # PostgreSQL schema, connection pool (DB: puff)
├── server.js            # Express server, middleware
├── middleware/
│   └── auth.js          # JWT authentication
└── routes/
    ├── auth.js          # Login, register endpoints
    └── puffs.js         # Puff CRUD, state update, offline decay
```

---

## Mevcut Durum

### Tamamlanan ✅
1. **Core Physics:** Soft-body creature, realistic interactions
2. **User System:** Login, register, JWT auth, form clearing
3. **Database:** PostgreSQL, persistence
4. **State System:** Fullness, Mood, Energy ile complete state management
5. **Decay System:** Offline/online decay calculation
6. **Food System:** 12 yiyecek, drag & drop, effects
7. **UI System:** Modal panels, progress bars, responsive
8. **Theme System:** Dark/light/auto modes, CSS variables
9. **Settings System:** Global settings panel, all pages
10. **Deployment:** Docker, versioned releases, nginx config
11. **Offline Support:** LocalStorage sync, pending changes

### Kısa Vadede Yapılacaklar
- [ ] Mini games (mood artırmak için)
- [ ] Resting mechanism (energy artırmak için)
- [ ] Animation improvements (more eating variations)
- [ ] Sound effects & music (optional)
- [ ] Multiple puffs per user

### Uzun Vadede Yapılacaklar
- [ ] Puff evolution/growth system
- [ ] Social features (visit other puffs)
- [ ] achievements/milestones
- [ ] mobile app (React Native or PWA)

---

## Son Yapılan Değişiklikler (Recent Changes)

### UI/UX Complete Redesign (En Son) ✅
**Dosyalar:** `index.html`, `css/style.css`, `js/views/app.js`, `js/globalSettings.js`

- Modal panel sistemi (overlay backdrop ile)
- Control button layout (top-right: settings/logout, bottom-left: status/food)
- Z-index hierarchy (controls: 100 < overlay: 998 < panels: 999)
- Touch-optimized butonlar (user-select: none, touch-action: manipulation)
- Responsive tasarım (mobile'da buton text'leri gizlenir)
- Close button ve overlay click-to-close özellikleri

### Dark Mode & Theme System ✅
**Dosyalar:** `js/themeManager.js`, `js/globalSettings.js`, `css/style.css`

- Light/Dark/Auto theme desteği
- CSS custom properties ile renk yönetimi
- Sistem tercihini otomatik algılama
- Global settings panel (tüm sayfalarda erişilebilir)
- Auth sayfalarında da theme değiştirme

### Auth System Improvements ✅
**Dosyalar:** `js/api.js`, `index.html`

- Logout sonrası form alanlarını temizleme
- Login/Register/Customize sayfalarında settings butonu
- Auth page controls (sağ üstte)

### Infrastructure Fixes ✅
**Dosyalar:** `nginx.conf`, `docker-compose.*.yml`

- Nginx upstream config (service name kullanımı)
- Docker compose cleanup (sadece dev ve release)
- Network configuration consistency
- API function name fix (`API.getPuff()` → `API.getMyPuff()`)

### Database & Release System ✅
**Dosyalar:** `server/db.js`, `.github/workflows/docker-build.yml`

- Database name change: `digitoy` → `puff`
- Release system with version tags
- Sample .env in release notes
- Single file release

---

## Deployment

### Development
```bash
docker compose -f docker-compose.dev.yml up -d --build
```

### Production (Release)
```bash
# Download docker-compose.yml from GitHub Release
# Create .env file
docker-compose up -d
```

### Containers
- `puff-db`: PostgreSQL (port 5432)
- `puff-server`: Express API (port 3000)
- `puff-ui`: Nginx static files (port 8080)

### Access
- App: http://localhost:8080
- API: http://localhost:8080/api
- DB: localhost:5432

---

## Kod Konvansiyonları

- **State naming:** Database'de "hunger" ama UI'da "Fullness" (kullanıcı için daha anlaşılır)
- **Mood:** 1 = çok mutsuz, 100 = çok mutlu
- **Energy:** 1 = exhausted, 100 = full energy
- **Hunger:** 1 = starving (aç), 100 = full (tok)
- **Database Name:** `puff` (eskiden `digitoy`)
- **Integer Values:** Tüm state değerleri integer (1-100), decimal yok
- **Theme Classes:** `theme-light`, `theme-dark` (body element)
- **Panel States:** `.active` class (`.open` kullanılmıyor artık)

---

## Test Notes

### Theme Test
1. Settings paneli aç
2. Light/Dark/Auto modları arasında geçiş yap
3. Tüm sayfalarda (login/register/customize/app) test et
4. System preference değişimini test et (Auto mode)

### Decay Test
1. Puff state'lerini 100 yap
2. 30 saniye bekle
3. State'ler azalmalı (client-side decay)
4. Sayfayı yenile
5. Offline decay uygulanmış olmalı

### Food Effect Test
1. Cake yedir (sugar crash)
2. Mood hızla azalmalı (2x decay, 5 dakika)
3. Fish yedir (protein boost)
4. Energy yavaş azalmalı (0.5x decay, 10 dakika)

### Fullness → Energy Conversion Test
1. Fullness > 50, Energy < 80 yap
2. Birkaç decay cycle bekle (30sn * 2-3)
3. Fullness azalmalı, Energy artmalı

### Offline Test
1. Uygulamayı aç
2. Internet'i kes
3. Yemek yedir (state değişikliği)
4. LocalStorage'a kaydolmalı, pending changes eklenmeli
5. Internet'i aç
6. Pending changes server'a sync olmalı

### Form Clearing Test
1. Login ol
2. Logout yap
3. Email/password field'ları temizlenmeli
4. Browser back/forward yap
5. Field'lar hala temiz olmalı

---

## Docker Compose Notları

- **Database Name:** `puff` (environment variable ile override edilebilir)
- **Version Tags:** Release'da `v1.0.0` gibi specific tags
- **Latest Tags:** Development'ta `latest` tag kullanılır
- **Container Names:** `puff-db`, `puff-server`, `puff-ui`
- **Network:** `puff-network` (tüm servisler aynı network'te)
- **Compose Files:** Sadece 2 dosya (dev ve release)

---

## Son Güncelleme Tarihi

2026-02-05 - v1.0.5
- Complete UI/UX redesign (modal panels)
- Dark mode support (light/dark/auto)
- Global settings panel (all pages)
- Auth improvements (form clearing)
- Infrastructure fixes (nginx, docker)
