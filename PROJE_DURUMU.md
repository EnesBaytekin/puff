# Proje Durumu - Digitoy (Puff)

## Orijinal Konsept
Tarayıcıda çalışan, mobil uyumlu, tek kişilik bir **virtual pet / dijital oyuncak**.
- Amaç: Rekabet, skor, süre yok - sakin, tatmin edici bir deneyim
- En önemli özellik: **Cloth/soft-body physics** ile sallanan tatlış bir yaratık
- Her kullanıcının kendi peti olur
- PostgreSQL veritabanında veriler saklanır

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
- **Tablolar**:
  - `users` (id, email, password_hash, created_at)
  - `puffs` (id, user_id, name, color, created_at, updated_at)
- **Özellikler**:
  - User-Puff ilişkisi (foreign key)
  - CASCADE delete desteği

### 4. Pet Yönetimi ✅
- **Konumu**: `server/routes/puffs.js`
- **API Endpoints**:
  - `POST /api/puffs/create` - Pet oluştur (isim + renk)
  - `GET /api/puffs/mine` - Kullanıcının petini getir
- **Özellikler**:
  - Her kullanıcı bir pet olabilir
  - İsim ve renk özelleştirme
  - Kalıcı veri saklama

### 5. Frontend ve UI ✅
- **Konumu**: `js/views/` klasörü
- **Sayfalar**:
  - `login.js` - Giriş sayfası
  - `register.js` - Kayıt sayfası
  - `customize.js` - Pet özelleştirme
  - `app.js` - Ana uygulama

- **Tasarım**:
  - Pastel renk paleti
  - Modern, minimal UI
  - Gradient kullanılmıyor (sade olduğu için)
  - Mobil uyumlu
  - SPA router

### 6. Deployment (Docker) ✅
- **Konumu**: Root directory
- **Dosyalar**:
  - `docker-compose.yml` - Ana konfigürasyon
  - `docker-compose.dev.yml` - Geliştirme ortamı
  - `docker-compose.prod.yml` - Prodüksiyon ortamı
  - `Dockerfile.ui` - Frontend docker imajı
  - `Dockerfile.server` - Backend docker imajı
  - `nginx.conf` - Reverse proxy konfigürasyonu
  - `.github/workflows/` - CI/CD pipeline

---

## ❌ EKSİK ÖZELLİKLER

### 1. Pet Durumları (Hunger, Mood, Energy) ❌
- **Prompt'ta**: "Pet states (hunger, mood, energy)"
- **Durum**: Veritabanında tablo yok, kod yok
- **Gereksinimler**:
  - Veritabanı şeması güncellemesi
  - State değişim mantığı
  - Zaman bazlı azalma
  - UI göstergeleri

### 2. Mini Oyunlar ❌
- **Prompt'ta**: "Mini games (low priority)"
- **Durum**: Hiç başlanmamış
- **Planlanan**:
  - 30-60 saniyelik oyunlar
  - Skor yok
  - Sadece mutluluk etkiler

### 3. Besleme Mekaniği ❌
- **Prompt'ta**: "Yemek verme - ekranda bir şey sürükleyip pete ver"
- **Durum**: Yok
- **Gereksinimler**:
  - Yemek objesi
  - Sürükle-bırak mekanikası
  - Petin yemeği içine alması
  - Fiziksel şekil değişimi

### 4. Pet'in Ölümü/Yası ❌
- **Prompt'ta**: "Pet never dies, neglect only affects behavior"
- **Durum**: Implementasyon gerekmiyor (pet ölmüyor)
- **Not**: Bu özellik için ilave kod gerekli olabilir (ihmal edilince davranış değişimi)

### 5. İlerici Fiziksel Efektler ❌
- **Prompt'ta**: "Hızlı sallarsan farklı tepki, yavaş okşarsan farklı tepki"
- **Durum**: Sürükleme mevcut ama hız/ölçek tepkileri belirgin değil
- **Geliştirme**: Farklı hızlarda farklı animasyonlar

### 6. Ses Efektleri ❌
- **Durum**: Yok (opsiyonel olarak belirtilmişti)

### 7. Çoklu Pet Desteği ❌
- **Durum**: Şu an sadece bir pet per user
- **Geliştirme**: Birden fazla pet oluşturulabilir, aralarında geçiş yapılabilir

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
│   └── router.js                 # SPA router ✅
├── server/                       # Backend ✅
│   ├── middleware/
│   │   └── auth.js               # JWT middleware ✅
│   ├── routes/
│   │   ├── auth.js               # Auth endpoints ✅
│   │   └── puffs.js              # Pet endpoints ✅
│   ├── db.js                     # Database ✅
│   └── server.js                 # Express server ✅
├── docker-compose.yml            # Docker config ✅
├── docker-compose.dev.yml        # Dev environment ✅
├── docker-compose.prod.yml       # Prod environment ✅
├── Dockerfile.ui                 # UI Dockerfile ✅
├── Dockerfile.server             # Server Dockerfile ✅
├── nginx.conf                    # Nginx config ✅
├── .env.example                  # Environment variables ✅
├── DEPLOYMENT.md                 # Deployment dokümantasyonu ✅
├── index.html                    # Ana HTML ✅
└── package.json                  # Dependencies ✅
```

---

## 🎯 ÖNCELİK SIRASI (Prompt'a göre)

### Priority 1 - En Önce ✅
- [x] Soft-body physics creature
- [x] Canvas rendering
- [x] Mouse/touch interaction
- [x] Basic UI structure

### Priority 2 - Sonra ✅
- [x] User authentication
- [x] Database setup
- [x] Pet creation and customization

### Priority 3 - Şimdi Yapılacaklar ❌
- [ ] Pet states (hunger, mood, energy)
- [ ] Besleme mekanizması
- [ ] State değişimleri UI göstergeleri
- [ ] Neglect etkileri (davranış değişimi)

### Priority 4 - İleriye Dönük ❌
- [ ] Mini oyunlar
- [ ] Ses efektleri
- [ ] Çoklu pet desteği
- [ ] Sosyal özellikler

---

## 🔧 TEKNİK NOTLAR

### Database
- **PostgreSQL** kullanılıyor (SQLite'den vazgeçildi)
- `pg` client ile bağlanıyor
- Docker container içinde çalışıyor

### Authentication
- JWT (JSON Web Tokens)
- Token storage: localStorage
- Middleware: `server/middleware/auth.js`

### Physics
- Custom implementation (Matter.js kullanılmadı)
- Particle-based soft-body
- Iterative constraint solver

### Deployment
- Docker Compose ile multi-service
- Nginx reverse proxy
- GitHub Actions CI/CD

---

## 📝 GÜNCELLEMELER

Bu dosyayı proje ilerledikçe güncelleyeceğim:
- ✅ = Tamamlandı
- ❌ = Eksik/Başlanmadı
- 🔄 = Devam ediyor

Son güncelleme: 2025-01-30
