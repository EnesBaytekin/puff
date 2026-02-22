# Proje Durumu - Puff

## Orijinal Konsept
Tarayıcıda çalışan, mobil uyumlu, tek kişilik bir **virtual pet / dijital oyuncak**.
- Amaç: Rekabet, skor, süre yok - sakin, tatmin edici bir deneyim
- En önemli özellik: **Cloth/soft-body physics** ile sallanan tatlış bir yaratık
- Her kullanıcının kendi peti olur
- PostgreSQL veritabanında veriler saklanır
- Zamanla azalan state'ler (fullness, mood, energy)
- Yemek sistemi ile bakım

---

## ✅ TAMAMLANAN ÖZELLİKLER

### 1. Soft-Body Physics (MVP) ✅
- **Konumu**: `js/physics/` klasörü
- **Dosyalar**:
  - `particle.js` - Parçacık sistemi
  - `constraint.js` - Kısıtlama/spring sistemi
  - `solver.js` - Fizik çözücü
  - `softbody.js` - Yumuşak vücut yaratık sınıfı

- **Özellikleri**:
  - Nokta tabanlı yapı (particles)
  - Spring/constraint sistemi
  - Ana daire + 6 yörünge dairesi
  - Organik deformasyon (12 deformasyon noktası)
  - Mouse ve dokunmatik destek
  - Sürükle-bırak etkileşimi
  - 60fps smooth animasyon

### 2. Kullanıcı Sistemi ✅
- **Konumu**: `server/routes/auth.js`
- **Özellikler**:
  - Kayıt olma (`POST /api/auth/register`)
  - Giriş yapma (`POST /api/auth/login`)
  - Şifre değiştirme (`POST /api/auth/change-password`)
  - Username-based authentication (email yok)
  - JWT tabanlı kimlik doğrulama
  - bcryptjs ile şifre hashleme

### 3. Veritabanı (PostgreSQL) ✅
- **Konumu**: `server/db.js`
- **Database Name**: `puff`
- **Tablolar**:
  - `users` (id, username, password_hash, created_at)
  - `puffs` (id, user_id, name, color, hunger, mood, energy, created_at, updated_at)
- **Özellikler**:
  - User-Puff ilişkisi (foreign key)
  - CASCADE delete desteği
  - State constraints (hunger, mood, energy: 1-100 arası, INTEGER)

### 4. Pet Yönetimi ✅
- **Konumu**: `server/routes/puffs.js`
- **API Endpoints**:
  - `POST /api/puffs/create` - Pet oluştur (isim + renk)
  - `GET /api/puffs/mine` - Kullanıcının petini getir (offline decay ile)
  - `PUT /api/puffs/state` - Pet state güncelle
  - `PUT /api/puffs/color` - Pet rengini güncelle
- **Özellikler**:
  - Her kullanıcı bir pet olabilir
  - İsim ve renk özelleştirme (sadece oluştururken)
  - Kalıcı veri saklama
  - **Offline Decay Calculation**: Kullanıcı online değilken bile state'ler azalır

### 5. State Sistemi (Hunger, Mood, Energy) ✅
- **Konumu**: `js/stateManager.js`
- **Özellikler**:
  - **3 State**: Fullness (Hunger), Mood, Energy
  - **Client-side Decay Loop**: Her 30 saniyede azalma
  - **Offline Decay**: Sunucu tarafında hesaplanır (GET /api/puffs/mine)
  - **User-specific LocalStorage**: Her kullanıcı için ayrı key
  - **Immediate Server Sync**: State değişikliği anında gönderilir
  - **Offline Support**: İnternet yokken LocalStorage'a kaydeder, sonra sync eder

**Decay Rates (per minute):**
- Fullness: ~0.165/dakika (10 saatte 100→1)
- Mood: ~0.206/dakika (8 saatte 100→1)
- Energy: ~0.254/dakika (6.5 saatte 100→1)

**State Conversion:**
- Fullness > 50 ve Energy < 80 iken: Fullness → Energy dönüşümü
- 2 fullness → 1 energy per minute

### 6. Yemek Sistemi ✅
- **Konumu**: `js/food.js`
- **Özellikler**:
  - **12 Yiyecek**: Apple, Cake, Fish, Cookie, Ice Cream, Donut, Pizza, Sandwich, Burger, Carrot, Banana, Chicken
  - **Drag & Drop**: Mouse ve touch ile sürükle-bırak
  - **Eating Animation**: Çiğeme animasyonu ve particle effects
  - **Food Effects**: Yiyeceklere göre özel efektler

**Yiyecek Listesi:**
| Yiyecek | Fullness | Mood | Energy | Efekt |
|---------|----------|------|--------|-------|
| 🍎 Apple | +15 | +5 | 0 | Yok |
| 🍰 Cake | +25 | +15 | +5 | Sugar Crash (2x mood decay, 5dk) |
| 🐟 Fish | +20 | 0 | +10 | Protein Boost (0.5x energy decay, 10dk) |
| 🍪 Cookie | +10 | +20 | 0 | Mini Crash (1.5x mood decay, 3dk) |
| 🍦 Ice Cream | +15 | +25 | 0 | Brain Freeze (2.5x mood decay, 4dk) |
| 🍩 Donut | +20 | +15 | 0 | Sugar Rush (1.8x mood decay, 4.5dk) |
| 🍕 Pizza | +30 | +10 | +5 | Yok |
| 🥪 Sandwich | +25 | +5 | +15 | Yok |
| 🍔 Burger | +30 | +10 | +10 | Yok |
| 🥕 Carrot | +10 | 0 | +5 | Healthy Snack (0.7x energy decay, 10dk) |
| 🍌 Banana | +15 | +5 | +10 | Yok |
| 🍗 Chicken | +25 | +5 | +15 | Yok |

### 7. UI Sistemi ✅
- **Konumu**: `index.html`, `css/style.css`, `js/views/app.js`
- **Özellikler**:
  - **Progress Bars**: Read-only progress bars (Fullness, Mood, Energy)
  - **Collapsible Panels**: Status panel ve Food panel
  - **Panel Toggle**: Tek panel açık, diğerini otomatik kapatır
  - **Food Panel**: Grid layout, 4 columns
  - **Z-index Fix**: Panel z-index 101, butonların üstünde
  - **Puff Name Display**: Ana ekranın en üstünde, dynamic font size
  - **Button Layout**: Logout (üst), Settings (alt)

### 8. Frontend ve UI ✅
- **Konumu**: `js/views/` klasörü
- **Sayfalar**:
  - `login.js` - Giriş sayfası
  - `register.js` - Kayıt sayfası
  - `customize.js` - Pet özelleştirme (sadece oluştururken)
  - `app.js` - Ana uygulama (progress bars, panels, puff name)

- **Tasarım**:
  - Pastel renk paleti
  - Modern, minimal UI
  - Gradient kullanılmıyor (sade olduğu için)
  - Mobil uyumlu
  - SPA router

### 9. Deployment (Docker) ✅
- **Konumu**: Root directory
- **Dosyalar**:
  - `docker-compose.yml` - Ana konfigürasyon (latest tags)
  - `docker-compose.release.yml` - Release template ({VERSION} placeholder)
  - `docker-compose.dev.yml` - Geliştirme ortamı
  - `Dockerfile.ui` - Frontend docker imajı
  - `Dockerfile.server` - Backend docker imajı
  - `nginx.conf` - Reverse proxy konfigürasyonu
  - `.github/workflows/docker-build.yml` - CI/CD pipeline

**CI/CD Özellikleri:**
- Version tag'li release'lar (`v1.0.0`)
- Release'da `docker-compose.yml` (versioned tags ile)
- Release notes'ta sample .env içeriği
- Automatic Docker Hub push

### 10. Theme System ✅
- **Konumu**: `js/themeManager.js`, `js/globalSettings.js`
- **Özellikler**:
  - Light/Dark/Auto theme desteği
  - CSS custom properties ile renk yönetimi
  - System preference detection
  - Global settings (tüm sayfalarda)

### 11. Settings System ✅ (YENİ - TAB BASED)
- **Konumu**: `js/globalSettings.js`
- **Özellikler**:
  - **Tab-Based Interface**: Theme ve Password tab'ları
  - **Theme Tab**: Light/Dark/Auto mod seçimi
  - **Password Tab**: Şifre değiştirme
  - **Auth-Aware**: Login olmamış kullanıcılar sadece Theme tab'ını görür
  - **Global**: Tüm sayfalarda erişilebilir

### 12. Puff Name Display ✅ (YENİ)
- **Konumu**: `js/views/app.js`
- **Özellikler**:
  - Ana ekranın en üstünde puff ismi gösterimi
  - Dynamic font size (isim uzunluğuna göre)
  - Minigame sırasında gizleniyor
  - Mobil uyumlu

### 13. Minigame System ✅
- **Konumu**: `js/minigame/` dizini
- **Özellikler**:
  - Drift & Catch minigame
  - Energy → Mood conversion
  - Extensible architecture
  - Hitbox collision detection
  - Particle effects

---

## ❌ EKSİK ÖZELLİKLER

### 1. Resting Mekanizması ❌
- **Durum**: Yok
- **Gereksinimler**:
  - Energy artırmak için mekanizma
  - Sleep/rest state'i
  - Animasyon

### 2. İlerici Fiziksel Efektler ❌
- **Prompt'ta**: "Hızlı sallarsan farklı tepki, yavaş okşarsan farklı tepki"
- **Durum**: Sürükleme mevcut ama hız/ölçek tepkileri belirgin değil
- **Geliştirme**: Farklı hızlarda farklı animasyonlar

### 3. Ses Efektleri ❌
- **Durum**: Yok (opsiyonel olarak belirtilmişti)

### 4. Çoklu Pet Desteği ❌
- **Durum**: Şu an sadece bir pet per user
- **Geliştirme**: Birden fazla pet oluşturulabilir, aralarında geçiş yapılabilir

### 5. Animasyon Çeşitliliği ⚠️
- **Mevcut**: Eating animation (chewing)
- **Eksik**: Sleeping animation, playing animation, farklı eating varyasyonları

---

## 📁 DOSYA YAPISI ÖZETİ

```
/home/imns/Files/puff/
├── css/
│   └── style.css                 # Ana stil dosyası
├── js/
│   ├── physics/                  # Fizik motoru ✅
│   │   ├── particle.js
│   │   ├── constraint.js
│   │   ├── solver.js
│   │   └── softbody.js
│   ├── minigame/                 # Minigame sistemi ✅
│   │   ├── minigame.js
│   │   ├── minigameManager.js
│   │   ├── driftGame.js
│   │   ├── driftSolver.js
│   │   ├── targetCircle.js
│   │   └── particleEffect.js
│   ├── views/                    # Sayfa kontrolleri ✅
│   │   ├── login.js
│   │   ├── register.js
│   │   ├── customize.js
│   │   └── app.js
│   ├── api.js                    # API client ✅
│   ├── canvas.js                 # Canvas setup ✅
│   ├── input.js                  # Input handling ✅
│   ├── router.js                 # SPA router ✅
│   ├── stateManager.js           # State sync, decay ✅
│   ├── food.js                   # Food system ✅
│   ├── themeManager.js           # Theme management ✅
│   └── globalSettings.js         # Global settings ✅
├── server/                       # Backend ✅
│   ├── middleware/
│   │   └── auth.js               # JWT middleware ✅
│   ├── routes/
│   │   ├── auth.js               # Auth endpoints ✅
│   │   └── puffs.js              # Pet endpoints + decay ✅
│   ├── db.js                     # Database (name: puff) ✅
│   └── server.js                 # Express server ✅
├── docker-compose.yml            # Docker config (latest) ✅
├── docker-compose.release.yml    # Release template ✅
├── docker-compose.dev.yml        # Dev environment ✅
├── Dockerfile.ui                 # UI Dockerfile ✅
├── Dockerfile.server             # Server Dockerfile ✅
├── nginx.conf                    # Nginx config ✅
├── .github/workflows/
│   └── docker-build.yml          # CI/CD + releases ✅
├── .gitignore                    # Release artifacts ignored ✅
├── index.html                    # Ana HTML ✅
├── package.json                  # Dependencies ✅
├── PROJE-OZET.md                 # Proje özeti ✅
├── PROJE_DURUMU.md               # Bu dosya ✅
└── DEPLOYMENT.md                 # Deployment dokümantasyonu ✅
```

---

## 🎯 ÖNCELİK SIRASI

### Priority 1 - En Önce ✅
- [x] Soft-body physics creature
- [x] Canvas rendering
- [x] Mouse/touch interaction
- [x] Basic UI structure

### Priority 2 - Sonra ✅
- [x] User authentication
- [x] Database setup
- [x] Pet creation and customization

### Priority 3 - Tamamlandı ✅
- [x] Pet states (hunger, mood, energy)
- [x] Besleme mekanizması (12 yiyecek)
- [x] State decay sistemi (offline + online)
- [x] State göstergeleri (progress bars)
- [x] Food effects (sugar crash, protein boost)
- [x] Offline support (LocalStorage + sync)
- [x] Theme system (Light/Dark/Auto)
- [x] Settings system (Tab-based)
- [x] Puff name display
- [x] Password change
- [x] Minigame system

### Priority 4 - İleriye Dönük ❌
- [ ] Resting mechanism (energy artırmak için)
- [ ] Ses efektleri
- [ ] Çoklu pet desteği
- [ ] Sosyal özellikler
- [ ] Puff evolution/growth

---

## 🔧 TEKNİK NOTLAR

### Database
- **PostgreSQL 16** kullanılıyor
- **Database Name**: `puff` (environment variable ile override edilebilir)
- `pg` client ile bağlanıyor
- Docker container içinde çalışıyor
- State constraints: 1-100 arası, INTEGER (decimal yok)

### Authentication
- JWT (JSON Web Tokens)
- Token storage: localStorage
- Middleware: `server/middleware/auth.js`
- User ID extraction: JWT payload'dan
- **Username-based**: Email yok, username ile login

### Physics
- Custom implementation (Matter.js kullanılmadı)
- Particle-based soft-body
- Iterative constraint solver
- Verlet integration
- Energy-based movement speed
- Mood-based shape deformation
- Hunger-based color darkening

### State Management
- **Server-side**: PostgreSQL, offline decay calculation
- **Client-side**: LocalStorage, 30-second decay loop
- **Sync**: Immediate server sync on state changes
- **Offline**: Pending changes tracking, sync when online
- **User-specific**: `puffState_{userId}` key

### Deployment
- Docker Compose ile multi-service
- Nginx reverse proxy
- GitHub Actions CI/CD
- Versioned releases (v1.0.0, etc.)
- Sample .env in release notes

---

## 📝 SON GÜNCELLEMELER

### v1.1.2 (2026-02-22) - YENİ
- ✅ Puff name display (ana ekran, dynamic font size)
- ✅ Settings button layout (Logout üst, Settings alt)
- ✅ Tab-based settings system (Theme + Password)
- ✅ Password change (current password verification)
- ✅ Color tab removed (sadece customize ekranında)

### v1.1.1 (2026-02-09)
- ✅ Username-based auth (email kaldırıldı)
- ✅ Login/Register UI redesign (mascot emoji'ler, gradient butonlar)
- ✅ Color picker revamp (hue-only slider)
- ✅ Animated puff preview (customize ekranında)
- ✅ Minigame system (Drift & Catch)
- ✅ State management revamp
- ✅ Critical bug fixes (reference sharing, double-update, creature reversion)
- ✅ Input handling improvements
- ✅ Physics improvements (low energy sluggish behavior)

### Önceki Sürümler
- **v1.0.x**: Theme system, settings panel, UI improvements
- **v0.2.x**: Physics improvements, state effects
- **v0.1.x**: Basic auth, database, puff creation

---

## 🚀 RELEASE SÜRECİ

### Release Oluşturma
```bash
# Commit changes
git add .
git commit -m "prep: release v1.1.2"

# Create tag
git tag v1.1.2

# Push tag
git push origin main --tags
```

### GitHub Actions Otomasyonu
1. Docker imajlarını build eder
2. Docker Hub'a push eder (`v1.1.2`, `latest`)
3. `release/docker-compose.yml` oluşturur (versioned tags ile)
4. GitHub release oluşturur
5. Release notes'ta sample .env ekler

### Kullanıcı Tarafı
```bash
# Download docker-compose.yml from release
# Create .env file:
cat > .env << EOF
POSTGRES_DB=puff
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret
EOF

# Start application
docker-compose up -d
```

---

Bu dosyayı proje ilerledikçe güncelleyeceğim:
- ✅ = Tamamlandı
- ❌ = Eksik/Başlanmadı
- 🔄 = Devam ediyor
- ⚠️ = Kısmen tamamlandı

**Son güncelleme:** 2026-02-22
**Proje durumu:** v1.1.2 Release 🚀
