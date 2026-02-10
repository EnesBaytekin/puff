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

### 12. Minigame System ✅ (YENİ - EN SON)
**Dosyalar:** `js/minigame/` dizini

**Özellikler:**
- **Extensible Minigame Architecture:** Base class pattern ile kolayca yeni oyun eklenebilir
- **Drift & Catch Minigame:** İlk minigame - momentum tabanlı hareket, hedef yakalama
- **Hitbox System:** Puff'ın fiziksel hitbox'ı (0.75 × radius) ile collision detection
- **Wall Bounce:** Kenarlardan sekme (billiard-style physics)
- **Push Force:** Dokunma/tıklama ile itme (küçük kuvvet, momentum birikimi)
- **Target Circle:** Hedef çemberi, progress bar, completion detection
- **Particle Effects:** Hedef tamamlandığında yeşil particle patlaması
- **Energy→Mood Conversion:** Her hedefte 4-5 energy → 4-5 mood dönüşümü
- **Desktop/Mobile Input:** Masaüstünde tıklama, mobilde dokunma ile aynı davranış

**Minigame Mekaniği:**
1. Puff'ı it (touch/click)
2. Puff momentumla hareket eder
3. Puff'ı hedef çemberinin içine tut (3 saniye)
4. Progress bar dolar, hedef tamamlanır
5. Energy→Mood conversion yapılır
6. Yeni hedef spawn olur

**State Sistemi (Minigame ile Entegrasyon):**
- Minigame sırasında **canlı update yok** (sonda bir kere sync)
- Minigame boyunca creature state'i bağımsız çalışır
- StateManager decay loop'u creature'ı update etmez (minigame aktifken)
- Oyun biterinde final state StateManager'a kopyalanır
- Progress bar'lar minigame sırasında creature'den canlı güncellenir

**Dosyalar:**
```
js/minigame/
├── minigame.js           # Base class - tüm minigameler için ortak interface
├── minigameManager.js    # Minigame lifecycle yönetimi (start/end/update/render)
├── driftGame.js          # Drift & Catch minigame implementation
├── driftSolver.js        # Drift oyunu için özel physics solver
├── targetCircle.js       # Hedef çemberi, progress tracking, collision
└── particleEffect.js     # Particle sistemi (completion effects)
```

**Minigame Base Class Interface:**
```javascript
class Minigame {
    start(initialState)        // Oyun başlat
    end()                      // Oyun bitir, state changes return et
    setup()                    // Kaynakları oluştur (override)
    cleanup()                  // Kaynakları temizle (override)
    update(deltaTime)          // Her frame çağrılır (override)
    render(ctx)                // Her frame çiz (override)
    handleInput(type, data)    // Input handling (override)
    getStateChanges()          // Final state deltas (override)
}
```

**Physics System (DriftSolver):**
```javascript
// Hitbox: Puff'ın collision alanı (0.75 × radius)
hitboxRadius = softBody.radius * 0.75;

// Push force: Her tıklamada küçük kuvvet
basePushForce = 0.5;  // Çok küçük, momentum birikimi

// Wall bounce: Kenarlardan sekme
wallBounce = 0.9;  // %90 momentum korunur

// Energy responsiveness
energyMultiplier = 0.3 + energyFactor * 0.7;  // 1-100 energy
// Low energy = yavaş tepki, high energy = hızlı tepki
```

**Target Circle System:**
```javascript
// Hedef completion
requiredDuration = 3000;  // 3 saniye boyunca içinde tut

// Progress tracking
currentDuration += deltaTime;  // Her frame artar
if (currentDuration >= requiredDuration) {
    isCompleted = true;  // Hedef tamamlandı
}

// Collision detection
farthestPointDistance = centerDistance + hitboxRadius;
return farthestPointDistance <= targetRadius;
```

### 13. State Conversion Revamp ✅ (YENİ)
**Dosya:** `js/stateManager.js`

**Yeni Sistem:**
- **Hunger → Energy:** Fast conversion (5-10 dakikada 20 point)
  - `conversionRate = 3` per minute
  - Sadece hunger > energy iken çalışır
  - Otomatik equalization

- **Energy → Mood:** Minigame'de ONLY!
  - Default decay'da YOK
  - Her hedefte 4-5 energy → 4-5 mood
  - 1:1 conversion

- **Decay Rate:** Hepsi 9 saatte 100→1
  - `FULLNESS_DECAY_PER_MIN = 99 / 540`
  - `MOOD_DECAY_PER_MIN = 99 / 540`
  - `ENERGY_DECAY_PER_MIN = 99 / 540`

**Önceki Sistemden Farklar:**
- ❌ Eski: Energy→Mood otomatik conversion vardı
- ✅ Yeni: Energy→Mood sadece minigame'de

- ❌ Eski: Farklı decay rate'ler (6.5-10 saat)
- ✅ Yeni: Hepsi aynı (9 saat)

### 14. Critical Bug Fixes ✅ (YENİ)
**Dosyalar:** `js/stateManager.js`, `js/minigame/`, `js/views/app.js`

**Reference Sharing Bug:**
- **Sorun:** `creature.puffState` ve `stateManager.currentState` aynı objeyi referans gösteriyordu
- **Belirtiler:** Mood sürekli artıyordu (51 → 52 → 54 → 58 → 66 → 82 → 100)
- **Çözüm:** Her state güncellemesinde **yeni obje** oluştur
  ```javascript
  // ❌ YANLIŞ
  this.currentState.mood = newMood;  // Referans paylaşımı

  // ✅ DOĞRU
  this.currentState = {
      hunger: newHunger,
      mood: newMood,
      energy: newEnergy
  };  // Yeni obje
  ```

**Double-Update Bug:**
- **Sorun:** Minigame'de hem canlı update hem de oyun sonu delta vardı
- **Belirtiler:** Mood 2 kez artıyordu (live + end delta)
- **Çözüm:**
  1. Live update'i tamamen kaldır (callback disable)
  2. Minigame sonu delta'si 0 olsun (state zaten sync)
  3. Sadece oyun bitiminde final state kopyala

**Creature Reversion Bug:**
- **Sorun:** Minigame sırasında creature gülerken tekrar ciddileşiyordu
- **Belirtiler:** Mood arttı ama yüz ifadesi değişmiyordu
- **Çözüm:** Minigame aktifken StateManager creature'ı update ETMESİN
  ```javascript
  if (!isMinigameActive) {
      this.appView.creature.updateState(this.currentState);
  }
  ```

### 15. Input Handling Improvements ✅ (YENİ)
**Dosyalar:** `js/input.js`, `js/minigame/driftGame.js`

**Desktop Input:**
- Mouse motion ile itme KALDIRILDI
- Sadece **tıklama anında** itme
- Basılı tutmak işlem yapmaz
- Her tıklama = tek push force

**Mobile Input:**
- Dokunma anında itme (touchstart)
- Parmak hareket ettirmesi ile İTME YOK (touchmove disabled)
- Mobil ve desktop aynı davranış

**Önceki Davranış:**
- ❌ Desktop: Mouse motion ile sürekli itme
- ❌ Mobile: Parmak sürüklerken sürekli itme

**Yeni Davranış:**
- ✅ Desktop: Click = tek itme
- ✅ Mobile: Tap = tek itme

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
├── minigame/            # NEW: Minigame system
│   ├── minigame.js      # Base class for all minigames
│   ├── minigameManager.js  # Minigame lifecycle management
│   ├── driftGame.js     # Drift & Catch minigame
│   ├── driftSolver.js   # Custom physics for drift game
│   ├── targetCircle.js  # Target detection & progress
│   └── particleEffect.js # Particle effects system
├── canvas.js            # Canvas management
├── input.js             # Touch/mouse handling (minigame-aware)
├── api.js               # API client, form clearing on logout
├── router.js            # View routing
├── stateManager.js      # State sync, decay, offline support, conversion
├── food.js              # Food system, drag & drop, effects
├── themeManager.js      # Theme management (light/dark/auto)
├── globalSettings.js    # Global settings panel (all pages)
└── views/
    ├── login.js         # Login view
    ├── register.js      # Registration view
    ├── customize.js     # Puff creation view
    └── app.js           # Main app view, progress bars, minigame toggle
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
- [x] ~~Mini games (mood artırmak için)~~ ✅ TAMAMLANDI
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

### Auth System Complete Redesign (En Son) ✅
**Dosyalar:** `server/db.js`, `server/routes/auth.js`, `js/api.js`, `js/router.js`, `index.html`, `js/views/login.js`, `js/views/register.js`, `js/views/customize.js`, `css/style.css`

**Username-Based Auth:**
- Email sistemi tamamen kaldırıldı, username ile giriş yapılıyor
- Database schema: `email VARCHAR(255)` → `username VARCHAR(20) UNIQUE NOT NULL`
- Username validation: Alphanumeric + underscore, 3-20 characters (`/^[a-zA-Z0-9_]{3,20}$/`)
- JWT payload artık username içeriyor: `{ userId, username }`

**Auth Guards Implementation:**
- `Router.handleNavigationEvent()` method ile navigation guard sistemi
- Protected routes (app, customize): Auth yoksa login'e redirect
- Auth routes (login, register): Auth varsa app/customize'e redirect
- **Critical fix:** Logout sonrası back button protected sayfalara sokmuyor
- **Redirect fix:** Register→customize→app akışı düzeltildi (customize'de çıkıp tekrar girince sorun yok)

**App Rebrand:**
- Title: "Digitoy" → "Puff Pet"
- Tüm UI'da "Puff Pet" olarak güncellendi
- Welcome messages güncellendi

**Login/Register UI Redesign:**
- Mascot emoji'ler (🐱 login, ✨ register, 🎨 customize)
- Card style forms (shadow, border-radius, padding)
- Gradient buttons (lineer gradient, hover effects)
- Better typography (letter-spacing, font-weight)
- Floating animation for mascot (`@keyframes float`)
- Autocomplete attributes (username, current-password, new-password)

**Color Picker Revamp:**
- HSV (3 slider) → Hue-only (1 slider) sistemi
- Fixed saturation: 85%
- Fixed lightness: 78%
- Rainbow gradient slider (hue spectrum)
- Desktop/mobile consistent (browser-native picker yok)

**Animated Puff Preview:**
- Canvas-based preview in customize screen
- Real softbody creature with animations
- Live color update (hue slider değiştikçe)
- Happy state (mood=0, energy=100, hunger=100)

**Physics Improvements:**
- Low energy sluggish behavior (exponential damping)
- Formula: `0.12 * e^(-4 * energyFactor)`
- Energy 0 → 0.12 (çok ağır damping, hemen durur)
- Energy 50 → 0.016 (orta)
- Energy 100 → ~0 (normal)
- Parmağı bıraktığında sallanmadan yavaşça merkeze gider

### Minigame System & State Management Revamp ✅
**Dosyalar:** `js/minigame/`, `js/stateManager.js`, `js/input.js`, `js/views/app.js`

**Minigame System:**
- Extensible minigame architecture (base class pattern)
- Drift & Catch minigame implementation
- Hitbox-based collision detection (0.75 × radius)
- Wall bounce physics (90% momentum conservation)
- Push force system (small force, momentum accumulation)
- Target circle with progress tracking (3 seconds)
- Particle effects on completion
- Energy→Mood conversion (4-5 energy → 4-5 mood per target)
- Desktop/mobile unified input (click/tap = single push)

**State Management Fixes:**
- Reference sharing bug fix (her güncelleme yeni obje)
- Double-update bug fix (live update kaldırıldı)
- Creature reversion bug fix (minigame'de StateManager creature'ı update etmez)
- Decay rate revamp (hepsi 9 saat, 100→1)
- Hunger→Energy fast conversion (3 per minute, 5-10 dakikada 20 point)
- Energy→Mood ONLY in minigame (default decay'da yok)

**Input Handling:**
- Desktop: Mouse motion ile itme KALDIRILDI, sadece tıklama
- Mobile: Parmak hareket ile itme KALDIRILDI, sadece dokunma
- Unified behavior: Tek tık/dokunma = tek itme

**Cache-Busting:**
- HTML script tags versioned (`?v=2`)
- Development'ta cache sorunlarını önler

### UI/UX Complete Redesign ✅
**Dosyalar:** `index.html`, `css/style.css`, `js/views/app.js`, `js/globalSettings.js`

- Modal panel sistemi (overlay backdrop ile)
- Control button layout (top-right: settings/logout, bottom-left: status/food/play)
- Z-index hierarchy (canvas: 998, controls: 999, minigame exit: 1001)
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

### Minigame İçin Önemli Kurallar ⚠️

**1. Reference Sharing Bug:**
```javascript
// ❌ YANLIŞ - Aynı objeyi referans gösterir
this.currentState = otherState;
this.currentState.mood = 50;  // otherState.mood da değişir!

// ✅ DOĞRU - Yeni obje oluştur (deep copy)
this.currentState = {
    hunger: otherState.hunger,
    mood: otherState.mood,
    energy: otherState.energy
};
```

**2. Minigame State Sync:**
```javascript
// ❌ YANLIŞ - Canlı update var
notifyStateChange();  // Her frame'de çağrılır
StateManager.updateUI();  // Creature'ı override eder

// ✅ DOĞRU - Sadece oyun biterinde sync
// Minigame sırasında: creature.puffState güncellenir
// Oyun biterinde: StateManager.currentState = finalState
```

**3. Minigame Input:**
```javascript
// ❌ YANLIŞ - Motion ile itme
handleTouchMove(data) {
    driftSolver.applyPushForce(data.x, data.y);  // Sürekli itme
}

// ✅ DOĞRU - Sadece dokunma/tıklama ile itme
handleTouchStart(data) {
    driftSolver.applyPushForce(data.x, data.y);  // Tek itme
}
handleTouchMove(data) {
    // Hiçbir şey yapma - hareket ile itme yok
}
```

**4. State Conversion:**
```javascript
// ❌ YANLIŞ - Otomatik Energy→Mood
if (energy > 1 && mood < 100) {
    energy -= 1;
    mood += 1;  // Otomatik conversion
}

// ✅ DOĞRU - Sadece minigame'de Energy→Mood
// Default decay'da YOK, minigame'de manual conversion
onTargetCaught() {
    energy -= 4;
    mood += 4;  // Sadece hedef yakalandığında
}
```

**5. Decay Rate:**
```javascript
// Tüm state'ler aynı decay rate (9 saatte 100→1)
FULLNESS_DECAY_PER_MIN = 99 / 540;
MOOD_DECAY_PER_MIN = 99 / 540;
ENERGY_DECAY_PER_MIN = 99 / 540;
```

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
3. State'ler azalmalı (client-side decay, ~0.09 per 30s)
4. 9 saatte 100→1 olmalı

### Food Effect Test
1. Cake yedir (sugar crash)
2. Mood hızla azalmalı (2x decay, 5 dakika)
3. Fish yedir (protein boost)
4. Energy yavaş azalmalı (0.5x decay, 10 dakika)

### Hunger → Energy Conversion Test
1. Hunger > Energy yap (örn: Hunger=80, Energy=30)
2. Birkaç dakika bekle
3. Hunger azalmalı, Energy artmalı (3 per minute)

### Minigame Test (YENİ)
1. Minigame butonuna tıkla
2. Puff'ı it (mouse click veya touch)
3. Puff momentumla hareket etmeli
4. Puff'ı hedef çemberinin içine tut (3 saniye)
5. Progress bar dolumalı
6. Hedef tamamlandıktan sonra:
   - Particle effects
   - Energy azalmalı (4-5)
   - Mood artmalı (4-5)
7. Creature gülmeli (mood arttığı için)
8. Oyun boyunca creature gülmeye devam etmeli (ciddileşmemeli)
9. Oyundan çıkınca mood yüksek kalmalı
10. Progress bar'lar güncel kalmalı

### Minigame Input Test (YENİ)
**Desktop:**
1. Mouse ile tıkla → Puff itmeli
2. Mouse hareket ettir (basılı tutmadan) → Hiçbir şey olmamalı
3. Mouse basılı tut → HİÇBİR ŞEY olmamalı (motion ile itme yok)
4. Birden fazla tıkla → Her tıklamada itmeli

**Mobile:**
1. Ekrana dokun → Puff itmeli
2. Parmak sürükle → Hiçbir şey olmamalı (motion ile itme yok)
3. Birden fazla dokun → Her dokunuşta itmeli

### Minigame Physics Test (YENİ)
1. Puff'ı kenara it → Sekmeli (wall bounce: 90%)
2. Puff'ı hızlı it → Momentum birikmeli
3. Energy düşük olunca (1-10) → Yavaş tepki vermeli
4. Energy yüksek olunca (90-100) → Hızlı tepki vermeli
5. Hedef çemberinden çıkarsa → Progress reset olmalı

### Minigame State Sync Test (YENİ)
1. Minigame başlat → StateManager state'i creature'a kopyalanmalı
2. Minigame sırasında hedef yakala → creature.puffState güncellenmeli
3. Minigame boyunca creature gülmeli → StateManager creature'ı override ETMEMELİ
4. Oyunu bitir → Final state StateManager'a kopyalanmalı
5. Progress bar'lar güncel state'i göstermeli

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

2026-02-09 - v1.1.1
- **Username-Based Auth:** Email sistemi kaldırıldı, username ile kayıt/giriş
- **Auth System Redesign:** App name "Puff Pet" olarak değiştirildi
- **Login/Register UI:** Mascot emoji'ler, card style form, gradient butonlar
- **Auth Guards:** Logout sonrası back button protected sayfalara sokmuyor
- **Redirect Fix:** Register→customize→app akışı düzeltildi
- **Color Picker Revamp:** Hue-only slider, 85% sat / 78% lightness (canlı pastel)
- **Puff Preview:** Customize ekranında animated softbody creature
- **Minigame Center Fix:** Minigame başladığında puff tam ortaya teleport oluyor
- **Physics Improvements:** Low energy sluggish behavior (exponential damping)
- **Minigame System:** Drift & Catch minigame eklendi
- **State Management:** Conversion sistemi revamp edildi
- **Critical Bugs:** Reference sharing, double-update, creature reversion fixlendi
- **Input Handling:** Desktop/mobile unified (click/tap = single push)
- **Decay Rate:** Hepsi 9 saatte 100→1
- **Cache-Busting:** Development cache sorunları çözüldü

2026-02-09 - v1.1.0
- Minigame system ilk versiyonu

2026-02-05 - v1.0.5
- Complete UI/UX redesign (modal panels)
- Dark mode support (light/dark/auto)
- Global settings panel (all pages)
- Auth improvements (form clearing)
- Infrastructure fixes (nginx, docker)
