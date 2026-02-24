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
- **Puff ismi gösterimi (ana ekran)**

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
energy INTEGER DEFAULT 50 CHECK (energy >= 1 AND energy <= 100),
is_sleeping BOOLEAN DEFAULT FALSE
```

**Migration:** `is_sleeping` kolonu otomatik eklenir (eski veriler korunur)

### 2. API Endpoints ✅
**Dosya:** `server/routes/puffs.js`

- `POST /api/puffs/create` - Puff oluşturma
- `GET /api/puffs/mine` - Kullanıcının puff'ını getir (offline decay/recovery ile)
- `PUT /api/puffs/state` - Puff state güncelleme
- `PUT /api/puffs/sleep` - Sleep/wake toggle
- `PUT /api/puffs/color` - Puff rengini güncelleme

**Özellik:** Offline decay/recovery calculation - kullanıcı online olmadığında bile:
- Fullness: 9 saatte 100→1 (her zaman azalır)
- Mood: 9 saatte 100→1 (her zaman azalır)
- Energy:
  - Uyanık: 9 saatte 100→1 (azalır)
  - Uyku: 5 saatte 1→100 (artar!)

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

- **Eating Animation:** Yemek yenirken çiğyme animasyonu

- **Sleep Animation:** Uyku modu görsel efektleri
  - **Kapalı Gözler:** Gözler çizgi şeklinde kapanır (arc)
  - **Nefes Alma:** Yavaş sine wave ile ±3% boy değişimi (3 saniye period)
  - **"z" Particle'ları:** 2 saniyede bir yukarı süzülen "z" harfleri
  - **Breathing Scale:** `breathingScale = 1.0 + Math.sin(time) * 0.03`

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
- **Client-side Decay Loop:** Her 30 saniyede state decay/recovery uygulanır
- **Sleep State:** `isSleeping` flag'i ile uyku takibi
- **Energy Recovery (Uyku):** Uyku modunda enerji artar
- **Fullness → Energy Conversion:** Sadece uyanıkken, fullness > energy iken
- **Immediate Server Sync:** State değişiklikleri anında server'a gönderilir
- **Integer Clamping:** Tüm değerler Math.round() ile integer'a çevrilir

**Decay/Recovery Rates (per minute):**
```javascript
FULLNESS_DECAY_PER_MIN = 99 / 540   // ~0.183 (9 hours)
MOOD_DECAY_PER_MIN = 99 / 540       // ~0.183 (9 hours)
ENERGY_RECOVERY_PER_MIN = 99 / 300  // ~0.33 (5 hours - uyku modunda)
ENERGY_DECAY_PER_MIN = 99 / 540     // ~0.183 (9 hours - uyanık modda)
```

**State Conversion:**
```javascript
// Fullness → Energy (SADECE uyanıkken, fullness > energy iken)
conversionRate = 3; // 3 points per minute

// Uyku modunda: Energy artar, Mood/Fullness azalır
// Uyanık modda: Energy azalır, Mood/Fullness azalır
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
- **Z-index Hierarchy:** Controls (10001) < Overlay (998) < Sleep Overlay (999) < Panels (999)
- **Mobile Responsive:** Mobilde buton textleri gizlenir
- **Sleep Mode Overlay:** Ekran kararma efekti (rgba(0,0,0,0.45))

**Button Layout:**
- **Top-Right:** 🚪 Logout, ⚙️ Settings (sistem ayarları)
- **Bottom-Left:** 📊 Status, 🍽️ Food, **😴 Sleep**, 🎮 Play
  - Sleep butonu ile puff uyutulur/uyandırılır
  - Uyku modunda buton text: "Wake Up"
  - Butonlar overlay'in üstünde kalır (parlak görünür)

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

### 8. Theme System ✅
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

### 9. Settings System ✅ (YENİ - TAB BASED)
**Dosyalar:** `js/globalSettings.js`, `index.html`, `css/style.css`

**Özellikler:**
- **Tab-Based Interface:** Theme ve Password tab'ları
- **Theme Tab:** Light/Dark/Auto mod seçimi
- **Password Tab:** Şifre değiştirme (current password verification ile)
- **Auth-Aware:** Login olmamış kullanıcılar sadece Theme tab'ını görür
- **Global:** Tüm sayfalarda erişilebilir

**Tab Navigation:**
```javascript
// Login olmamış: Sadece Theme tab
// Login olmuş: Theme + Password tabları
```

**Password Change Form:**
- Current password verification
- New password validation (min 6 characters)
- Confirm password matching
- Success/error messages

### 10. Puff Name Display ✅ (YENİ)
**Dosyalar:** `js/views/app.js`, `index.html`, `css/style.css`

**Özellikler:**
- **Dynamic Font Size:** İsim uzunluğuna göre otomatik boyutlandırma
  - 1-5 karakter: 2.5rem
  - 6-10 karakter: 2rem
  - 11-15 karakter: 1.5rem
  - 16+ karakter: 1.2rem
- **Position:** Ana ekranın en üstünde, ortalanmış
- **Visibility:** Sadece ana ekranda görünür (minigame'de gizli)
- **Styling:** Bold, text-shadow, word-break (mobilde)

### 11. Auth System Improvements ✅
**Dosyalar:** `js/api.js`, `index.html`

**Özellikler:**
- **Form Clearing:** Logout olduktan sonra tüm form alanları temizlenir
- **Security:** Password field'ları otomatik temizlenir
- **Auth Pages:** Login/Register/Customize sayfalarında da settings butonu

### 12. Minigame System ✅
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
- **Sleep Constraint:** Uyku modunda minigame başlatılamaz (alert: "Your puff is sleeping!")

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

### 13. State Conversion Revamp ✅
**Dosya:** `js/stateManager.js`

**Yeni Sistem:**
- **Hunger → Energy:** Fast conversion (5-10 dakikada 20 point)
  - `conversionRate = 3` per minute
  - **SADECE uyanıkken çalışır** (uyku modunda devre dışı)
  - Sadece hunger > energy iken çalışır
  - Otomatik equalization

- **Energy → Mood:** Minigame'de ONLY!
  - Default decay'da YOK
  - Her hedefte 4-5 energy → 4-5 mood
  - 1:1 conversion

- **Decay/Recovery Rate:**
  - `FULLNESS_DECAY_PER_MIN = 99 / 540` (9 saat - her zaman azalır)
  - `MOOD_DECAY_PER_MIN = 99 / 540` (9 saat - her zaman azalır)
  - `ENERGY_DECAY_PER_MIN = 99 / 540` (9 saat - uyanık modda azalır)
  - `ENERGY_RECOVERY_PER_MIN = 99 / 300` (5 saat - uyku modunda artar)

### 14. Critical Bug Fixes ✅
**Dosyalar:** `js/stateManager.js`, `js/minigame/`, `js/views/app.js`

**Reference Sharing Bug:**
- **Sorun:** `creature.puffState` ve `stateManager.currentState` aynı objeyi referans gösteriyordu
- **Belirtiler:** Mood sürekli artıyordu (51 → 52 → 54 → 58 → 66 → 82 → 100)
- **Çözüm:** Her state güncellemesinde **yeni obje** oluştur

**Double-Update Bug:**
- **Sorun:** Minigame'de hem canlı update hem de oyun sonu delta vardı
- **Belirtiler:** Mood 2 kez artıyordu (live + end delta)
- **Çözüm:** Live update'i kaldır, sadece oyun bitiminde final state kopyala

**Creature Reversion Bug:**
- **Sorun:** Minigame sırasında creature gülerken tekrar ciddileşiyordu
- **Belirtiler:** Mood arttı ama yüz ifadesi değişmiyordu
- **Çözüm:** Minigame aktifken StateManager creature'ı update ETMESİN

### 15. Release System ✅
**Dosyalar:** `.github/workflows/docker-build.yml`, `docker-compose.release.yml`

**Özellikler:**
- **Version Tags:** Release'da `docker-compose.yml` dosyası versiyon tag'li imajlar içerir
- **Sample .env in Release:** Release notes'ta örnek .env içeriği
- **Single File Release:** Release'da tek `docker-compose.yml` dosyası, direkt kullanıma hazır

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
├── minigame/            # Minigame system
│   ├── minigame.js      # Base class for all minigames
│   ├── minigameManager.js  # Minigame lifecycle management
│   ├── driftGame.js     # Drift & Catch minigame
│   ├── driftSolver.js   # Custom physics for drift game
│   ├── targetCircle.js  # Target detection & progress
│   └── particleEffect.js # Particle effects system
├── canvas.js            # Canvas management
├── input.js             # Touch/mouse handling (minigame-aware)
├── api.js               # API client, password change, sleep state endpoints
├── router.js            # View routing
├── stateManager.js      # State sync, decay/recovery, offline support, sleep state
├── food.js              # Food system, drag & drop, effects
├── themeManager.js      # Theme management (light/dark/auto)
├── globalSettings.js    # Global settings panel (all pages, tab-based)
└── views/
    ├── login.js         # Login view
    ├── register.js      # Registration view
    ├── customize.js     # Puff creation view
    └── app.js           # Main app view, puff name display, minigame toggle
```

### Backend Files

```
server/
├── db.js                # PostgreSQL schema, connection pool (DB: puff)
├── server.js            # Express server, middleware
├── middleware/
│   └── auth.js          # JWT authentication
└── routes/
    ├── auth.js          # Login, register, password change endpoints
    └── puffs.js         # Puff CRUD, state update, offline decay/recovery, color update, sleep toggle
```

---

## Mevcut Durum

### Tamamlanan ✅
1. **Core Physics:** Soft-body creature, realistic interactions
2. **User System:** Login, register, JWT auth, form clearing
3. **Database:** PostgreSQL, persistence, migration support
4. **State System:** Fullness, Mood, Energy ile complete state management
5. **Decay/Recovery System:** Offline/online decay calculation, sleep recovery
6. **Food System:** 12 yiyecek, drag & drop, effects
7. **UI System:** Modal panels, progress bars, responsive, sleep overlay
8. **Theme System:** Dark/light/auto modes, CSS variables
9. **Settings System:** Tab-based panel (Theme + Password)
10. **Puff Name Display:** Dynamic font size, ana ekran
11. **Password Change:** Current password verification ile güvenli değişim
12. **Sleep System:** Uyku/uyandırma, kapalı gözler, nefes alma, "z" particle'ları
13. **Deployment:** Docker, versioned releases, nginx config
14. **Offline Support:** LocalStorage sync, pending changes

### Kısa Vadede Yapılacaklar
- [x] ~~Mini games (mood artırmak için)~~ ✅ TAMAMLANDI
- [x] ~~Resting mechanism (energy artırmak için)~~ ✅ TAMAMLANDI (Sleep System)
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

### v1.1.3 (2026-02-24) - YENİ ✅
**Dosyalar:** `server/db.js`, `server/routes/puffs.js`, `js/api.js`, `js/stateManager.js`, `js/physics/softbody.js`, `js/views/app.js`, `index.html`, `css/style.css`

**Sleep System (Resting Mechanism):**
- **Database:** `is_sleeping` kolonu eklendi (otomatik migration ile eski veriler korunur)
- **Backend API:** `PUT /api/puffs/sleep` endpoint'i eklendi
- **Energy Recovery:** Uyku modunda enerji 5 saatte 1→100 şeklinde lineer artar
- **Offline Recovery:** Logout olunduğunda uyku varsa, login olunca aradaki süre kadar enerji artar
- **Decay Rates Güncellemesi:** Tüm state'ler 9 saatte 100→1 şeklinde normalize edildi
- **State Conversion:** Fullness→Energy conversion SADECE uyanıkken çalışır
- **Sleep Animasyonları:**
  - Kapalı gözler (arc şeklinde çizgi)
  - Nefes alma (±3% boy değişimi, 3 saniyelik sine wave)
  - "z" particle'ları (2 saniyede bir yukarı süzülür)
- **UI Butonu:** Ana ekranda sol altta 😴 Sleep butonu
- **Sleep Overlay:** Ekran kararma efekti (rgba(0,0,0,0.45))
- **Z-Index Hierarchy:** Butonlar overlay'in üstünde kalır (parlak görünür)
- **Minigame Constraint:** Uyku modunda minigame başlatılamaz
- **LocalStorage Sync:** Sleep state'i localStorage'da da tutulur

**CSS Cache Fix:**
- CSS linkine versiyon parametresi eklendi: `css/style.css?v=4`
- Prod'da cache sorunu yaşanıyordu, Cloudflare cache temizlenince düzeldi
- Artık her CSS değişikliğinde versiyon numarası artırılacak

**Kullanım:**
1. Ana ekranda sol altta 😴 Sleep butonuna tıkla
2. Puff uyur: gözleri kapanır, nefes alır, "z" çıkar, ekran kararır
3. Enerji yavaşça artar (5 saatte full)
4. Mood ve Fullness normal azalmaya devam eder
5. Tekrar tıkla → Wake Up ile uyanır

### v1.1.2 (2026-02-22)
**Dosyalar:** `js/views/app.js`, `js/globalSettings.js`, `index.html`, `css/style.css`, `js/api.js`, `server/routes/auth.js`

**Puff Name Display:**
- Ana ekranın en üstünde puff ismi görünüyor
- Dynamic font size (isim uzunluğuna göre)
  - 1-5 karakter: 2.5rem
  - 6-10 karakter: 2rem
  - 11-15 karakter: 1.5rem
  - 16+ karakter: 1.2rem
- Minigame sırasında gizleniyor
- Mobil uyumlu (word-break, responsive)

**Settings Button Layout:**
- Önceden: Settings (sağ üst), Logout (altında)
- Şimdi: Logout (üst), Settings (altında)
- Uzun isimler için butonları taşma önlemi

**Tab-Based Settings System:**
- **Theme Tab:** Light/Dark/Auto mod seçimi
- **Password Tab:** Şifre değiştirme
  - Current password verification
  - New password validation (min 6 chars)
  - Confirm password matching
  - Success/error messages
- Auth-aware visibility (login olmamış kullanıcılar sadece Theme tab'ını görür)
- Clean, modern tab navigation

**Password Change Backend:**
- `POST /api/auth/change-password` endpoint
- Current password verification (bcrypt)
- New password validation
- Same password check
- Secure password hashing

**Color Tab Removed:**
- Renk seçimi artık sadece yeni puff oluştururken (customize ekranında)
- Settings'ten color tab kaldırıldı
- Backend endpoint hala duruyor (ilerde lazım olabilir)

### v1.1.1 (2026-02-09)
- Username-Based Auth (email kaldırıldı)
- Login/Register UI redesign (mascot emoji'ler, gradient butonlar)
- Color picker revamp (hue-only slider, canlı pastel)
- Animated puff preview (customize ekranında)
- Minigame system (Drift & Catch)
- State management revamp
- Critical bug fixes (reference sharing, double-update, creature reversion)
- Input handling improvements
- Physics improvements (low energy sluggish behavior)

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

**Cloudflare Tunnel Kullanımı:**
```yaml
# docker-compose.override.yml
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    command: tunnel run
    environment:
      - TUNNEL_TOKEN=your_token_here
    networks:
      - puff-network
```

**Önemli Not - Cache Management:**
- Prod ortamında CSS/JS değişikliklerinde **Cloudflare cache temizlemek gerekir**
- Dashboard: Caching → Configuration → Purge Everything
- Veya API ile purge edilebilir
- CSS dosyaları `?v=X` query parametresi ile versiyonlanır

### Containers
- `puff-db`: PostgreSQL (port 5432)
- `puff-server`: Express API (port 3000)
- `puff-ui`: Nginx static files (port 8080)
- `cloudflared` (opsiyonel): Cloudflare tunnel (prod)

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
- **Panel States:** `.active` class

---

## Son Güncelleme Tarihi

**2026-02-24 - v1.1.3**
- **Sleep System:** Uyku/uyandırma mekaniği tamamlandı
- **Energy Recovery:** Uyku modunda enerji artar (5 saatte full)
- **Sleep Animasyonlar:** Kapalı gözler, nefes alma, "z" particle'ları
- **UI Button:** Ana ekranda 😴 Sleep butonu
- **Screen Darkening:** Sleep overlay (rgba(0,0,0,0.45))
- **CSS Cache Fix:** Versiyon parametresi eklendi
- **Decay Rates:** Tüm state'ler normalize edildi (9 saat)

**2026-02-22 - v1.1.2**
- **Puff Name Display:** Ana ekranda dynamic font size ile isim gösterimi
- **Settings Layout:** Settings butonu Logout'un altına alındı
- **Tab-Based Settings:** Theme ve Password tab'ları
- **Password Change:** Güvenli şifre değiştirme sistemi
- **Color Tab Removed:** Renk seçimi sadece customize ekranında
