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
  - JWT tabanlı kimlik doğrulama
  - bcryptjs ile şifre hashleme
  - Otomatik token yenileme

### 3. Veritabanı (PostgreSQL) ✅
- **Konumu**: `server/db.js`
- **Database Name**: `puff` (eskiden `digitoy`)
- **Tablolar**:
  - `users` (id, email, password_hash, created_at)
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
- **Özellikler**:
  - Her kullanıcı bir pet olabilir
  - İsim ve renk özelleştirme
  - Kalıcı veri saklama
  - **Offline Decay Calculation**: Kullanıcı online değilken bile state'ler azalır

### 5. State Sistemi (Hunger, Mood, Energy) ✅
- **Konumu**: `js/stateManager.js` (yeni dosya)
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
- **Konumu**: `js/food.js` (yeni dosya)
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

### 8. Frontend ve UI ✅
- **Konumu**: `js/views/` klasörü
- **Sayfalar**:
  - `login.js` - Giriş sayfası
  - `register.js` - Kayıt sayfası
  - `customize.js` - Pet özelleştirme
  - `app.js` - Ana uygulama (progress bars, panels)

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

---

## ❌ EKSİK ÖZELLİKLER

### 1. Mini Oyunlar ❌
- **Prompt'ta**: "Mini games (low priority)"
- **Durum**: Hiç başlanmamış
- **Planlanan**:
  - 30-60 saniyelik oyunlar
  - Skor yok
  - Sadece mutluluk etkiler
  - Mood artırmak için

### 2. Resting Mekanizması ❌
- **Durum**: Yok
- **Gereksinimler**:
  - Energy artırmak için mekanizma
  - Sleep/rest state'i
  - Animasyon

### 3. İlerici Fiziksel Efektler ❌
- **Prompt'ta**: "Hızlı sallarsan farklı tepki, yavaş okşarsan farklı tepki"
- **Durum**: Sürükleme mevcut ama hız/ölçek tepkileri belirgin değil
- **Geliştirme**: Farklı hızlarda farklı animasyonlar

### 4. Ses Efektleri ❌
- **Durum**: Yok (opsiyonel olarak belirtilmişti)

### 5. Çoklu Pet Desteği ❌
- **Durum**: Şu an sadece bir pet per user
- **Geliştirme**: Birden fazla pet oluşturulabilir, aralarında geçiş yapılabilir

### 6. Animasyon Çeşitliliği ⚠️
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
│   ├── views/                    # Sayfa kontrolleri ✅
│   │   ├── login.js
│   │   ├── register.js
│   │   ├── customize.js
│   │   └── app.js
│   ├── api.js                    # API client ✅
│   ├── canvas.js                 # Canvas setup ✅
│   ├── input.js                  # Input handling ✅
│   ├── router.js                 # SPA router ✅
│   ├── stateManager.js           # NEW: State sync, decay ✅
│   └── food.js                   # NEW: Food system ✅
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

### Priority 4 - İleriye Dönük ❌
- [ ] Mini oyunlar (mood artırmak için)
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

### v1.0.4 (2026-02-05)
- ✅ State management system tamamlandı
- ✅ Food system (12 yiyecek) tamamlandı
- ✅ Decay system (offline + online) tamamlandı
- ✅ UI improvements (progress bars, panels) tamamlandı
- ✅ Release system (version tags) tamamlandı
- ✅ Database rename (digitoy → puff) tamamlandı
- ✅ Sample .env in release notes eklendi

### Önceki Sürümler
- **v0.2.x**: Physics improvements, state effects
- **v0.1.x**: Basic auth, database, puff creation

---

## 🚀 RELEASE SÜRECİ

### Release Oluşturma
```bash
# Commit changes
git add .
git commit -m "prep: release v1.0.4"

# Create tag
git tag v1.0.4

# Push tag
git push origin main --tags
```

### GitHub Actions Otomasyonu
1. Docker imajlarını build eder
2. Docker Hub'a push eder (`v1.0.4`, `latest`)
3. `release/docker-compose.yml` oluşturur (versioned tags)
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

**Son güncelleme:** 2026-02-05
**Proje durumu:** v1.0.4 Release 🚀
