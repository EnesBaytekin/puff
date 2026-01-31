# Puff - Proje Özeti ve Durum Raporu

## Proje Nedir?

Puff, soft-body (yumuşak cisim) fizik tabanlı bir sanal evcil hayvan uygulamasıdır. Browser tabanlı, sakin ve tatmin edici bir dijital oyuncak. Birthday gift olarak başladı, genel web uygulamasına dönüştü.

**Temel Özellikler:**
- Cute, yumuşak vücutlu bir creature (puff)
- Touch/drag ile etkileşim (realistic physics)
- Pet state sistemi: Hunger (Fullness), Mood, Energy
- User login ve custom puff oluşturma
- PostgreSQL database ile persistence

---

## Teknik Stack

- **Frontend:** Vanilla JS, Canvas API
- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL 16
- **Deployment:** Docker, Docker Compose, Nginx reverse proxy
- **Physics:** Custom particle-constraint sistemi (Verlet integration)

---

## Yapılan İşler (Completed)

### 1. Database Schema (Backend)
**Dosya:** `server/db.js`

Puff state'leri eklendi:
```sql
hunger INTEGER DEFAULT 50 CHECK (hunger >= 0 AND hunger <= 100),
mood INTEGER DEFAULT 50 CHECK (mood >= 0 AND mood <= 100),
energy INTEGER DEFAULT 50 CHECK (energy >= 0 AND energy <= 100)
```

### 2. API Endpoint
**Dosya:** `server/routes/puffs.js`

PUT `/api/puffs/state` endpoint - puff state güncelleme

### 3. Physics & Visual Effects
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
  - Mood 0: Sad (downward U / frown)
  - Mood 50: Neutral (flat line)
  - Mood 100: Happy (upward U / smile)
  - Narrow mouth, cute look (radius * 0.1 width)

- **Hunger (Fullness) → Color:**
  - 0 = starving (çok karanlık)
  - 10-25 = hızla açılıyor (logaritmik)
  - 50+ = normal color
  - Logarithmic scale koyu=80 → light=0

**Dosya:** `js/physics/solver.js`

- Dynamic damping: 0.998 (exhausted) → 0.95 (full energy)
- Idle movement delay: 20s (low energy) → 5s (high energy)
- Dynamic idle distance based on energy²

### 4. Input Handling (Touch/Mouse)
**Dosya:** `js/input.js`

- `isTouchOnCanvas()` check - slider vs canvas separation
- Canvas'a dokunursa drag başlat, slider'a dokunursa scroll
- Continuous drag force - energy affects how fast puff follows finger
- Mouse ve touch event handling

### 5. Test Sliders (Geçici)
**Dosyalar:** `index.html`, `js/views/app.js`, `css/style.css`

- 3 slider: Fullness, Mood, Energy
- Validation ve clamping (0-100 range)
- Debounced API update (500ms)
- Mobile UX: 24px thumbs, touch-action: pan-y
- Z-index: 1000 (always on top)
- Min value = 1 (0'da glitch olmasın diye)

**NOT:** Bu sliderlar sadece testing için. Production'da kaldırılacak!

---

## Dosya Yapısı ve Önemli Kodlar

### Frontend Files

```
js/
├── physics/
│   ├── particle.js      # Particle class (x, y, oldx, oldy)
│   ├── constraint.js    # Constraint class (distance constraint)
│   ├── softbody.js      # MAIN: Creature rendering, state effects
│   └── solver.js        # Physics solver, damping, idle movement
├── canvas.js            # Canvas management
├── input.js             # Touch/mouse handling
├── api.js               # API client
├── router.js            # View routing
└── views/
    ├── login.js         # Login view
    ├── register.js      # Registration view
    ├── customize.js     # Puff creation view
    └── app.js           # Main app view + test sliders
```

### Backend Files

```
server/
├── db.js                # PostgreSQL schema, connection pool
├── server.js            # Express server, middleware
├── middleware/
│   └── auth.js          # JWT authentication
└── routes/
    ├── auth.js          # Login, register endpoints
    └── puffs.js         # Puff CRUD + state update
```

---

## Mevcut Sorunlar (Known Issues)

1. **Slider min value:** Son değişiklikte slider min=1 yapıldı ama tam test edilmedi
2. **Slider genel:** Production'da kaldırılacak, o yüzden düzeltmeye gerek yok
3. **Container health:** puff-ui-dev container unhealthy gösteriyor (nginx related muhtemelen)

---

## Yapılacaklar (Future Tasks)

### Short Term
- [ ] Sliderları kaldır (production release öncesi)
- [ ] Actual gameplay mechanics:
  - [ ] Feeding mechanism (hunger artırmak için)
  - [ ] Playing mechanism (mood artırmak için)
  - [ ] Resting mechanism (energy artırmak için)
- [ ] Passive state decay (zamanla azalma: hunger, mood, energy)

### Long Term
- [ ] Save puff state periodically (auto-save)
- [ ] Multiple puffs per user
- [ ] Puff evolution/growth
- [ ] Mini games
- [ ] Sound effects & music
- [ ] Animations (eating, sleeping, playing)

---

## Son Yapılan Değişiklikler (Recent Changes)

### Mood Direction Fix (En son)
**Dosya:** `js/physics/softbody.js` (line 399-419)

Mood direction düzeltildi:
- Mood 0 → Sad (downward U, frown)
- Mood 50 → Neutral (flat)
- Mood 100 → Happy (upward U, smile)

```javascript
if (mood < 50) {
    // Sad - downward curve
} else {
    // Happy - upward curve
}
```

### Slider UX Fix
**Dosyalar:** `index.html`, `js/input.js`, `css/style.css`

- Touch interference fixed (canvas vs slider)
- Larger thumbs (24px)
- `touch-action: pan-y` added
- `isTouchOnCanvas()` check added
- Z-index increased to 1000

### 0-Value Glitch Fix
**Dosya:** `js/views/app.js` (line 75-84)

Value validation ve clamping:
```javascript
const newState = {
    hunger: Math.max(0, Math.min(100, hungerVal)),
    mood: Math.max(0, Math.min(100, moodVal)),
    energy: Math.max(0, Math.min(100, energyVal))
};
```

---

## Deployment

### Development
```bash
docker compose up -d --build
```

### Containers
- `puff-db-dev`: PostgreSQL (port 5432)
- `puff-server-dev`: Express API (port 3000)
- `puff-ui-dev`: Nginx static files (port 8080)

### Access
- App: http://localhost:8080
- API: http://localhost:3000/api
- DB: localhost:5432

---

## Kod Konvansiyonları

- **State naming:** Database'de "hunger" ama UI'da "Fullness" (kullanıcı için daha anlaşılır)
- **Mood:** 0 = çok mutsuz, 100 = çok mutlu
- **Energy:** 0 = exhausted, 100 = full energy
- **Hunger:** 0 = starving (aç), 100 = full (tok)

---

## Test Notes

Mood test etmek için:
1. Slider en sola (1) → Sad face, şişkin şekil
2. Slider orta (50) → Neutral face, normal şekil
3. Slider en sağa (100) → Happy face, normal şekil

Energy test etmek için:
1. Slider en sola (1) → Çok yavaş hareket, yavaş döönme
2. Slider en sağa (100) → Hızlı hareket, normal döönme

Fullness test etmek için:
1. Slider en sola (1) → Çok karanlık renk
2. Slider 50 → Normal renk
3. Slider en sağa (100) → Normal renk (no change)

---

## Docker Compose Notları

- `version` attribute obsolete, uyarı veriyor ama çalışıyor
- Container restart için: `docker compose restart ui` (not puff-ui)
- Full rebuild: `docker compose up -d --build`
- Logs: `docker compose logs -f [service]`

---

## Son Güncelleme Tarihi

2026-01-31 - Mood direction fix, slider UX improvements, min value = 1
