# Modüler Aksesuar Sistemi - Dokümantasyon

## Sistem Özeti

Puff için tamamen modüler, konfigürasyon tabanlı aksesuar sistemi. Yeni item eklemek için sadece config dosyasını güncellemek yeterli.

## Özellikler

1. **Slot Tabanlı Kategori Sistemi** - Her kategoriden sadece bir item giyilebilir
2. **Offset Pozisyonlama** - Her item Puff'ın yüz merkezine göre konumlandırılır
3. **SVG Asset'ler** - Kaliteli, ölçeklenebilir vektör grafikler
4. **Kolay Ekleme/Çıkarma** - Geliştirici için basit config yapısı
5. **zIndex Desteği** - Katmanlı görüntüleme (şapka → gözlük → baş → yüz sırası)

## Kategoriler ve Slotlar

| Kategori ID | Slot Adı | zIndex | Açıklama |
|------------|-----------|---------|-----------|
| `hats` | `hat` | 10 | Şapkalar, taçlar |
| `glasses` | `glasses` | 20 | Gözlükler |
| `head` | `head` | 30 | Baş aksesuarları (halo, anten) |
| `face` | `face` | 40 | Yüz aksesuarları (sakal, kaş) |

## Mevcut Aksesuarlar

### Şapkalar (Hats)
- **tophat** - Silindir Şapka - Klasik siyah şapka, altın reçineli
- **cap** - Spor Şapka - Mavi takke, vizörlü
- **crown** - Kral Tacı - Altın taç, kırmızı taşlı

### Gözlükler (Glasses)
- **sunglasses** - Güneş Gözlüğü - Siyah lensli güneş gözlüğü
- **nerd** - Nerdel Gözlük - Yuvarlak lensli gözlük

### Baş Aksesuarları (Head)
- **halo** - Halo - Parlayan halka üzerinde
- **antennae** - Biyıklı Anten - Kırmızı küreli iki anten

### Yüz Aksesuarları (Face)
- **mustache** - Sakal Bıyık - Kıvırcık stil sakal
- **eyebrows** - Kaşlar - Kızgın kaşlar

## Yeni Aksesuar Eklemek

### 1. SVG Dosyası Oluştur

Yeni SVG dosyasını ilgili kategori klasörüne koy:
```
assets/accessories/{kategori}/{item-id}.svg
```

**SVG Özellikleri:**
- `viewBox` tanımlı olmalı (örn: `0 0 100 100`)
- `width` ve `height` özellikleri olmalı
- Tercihen gradient'lar ve filtreler kullan
- Ortalanmış çizim (merkez yaklaşık viewBox ortasında)

### 2. Config Dosyasını Güncelle

`assets/accessories/config.json` dosyasına yeni item ekle:

```json
{
  "id": "yeni-item",
  "name": "Yeni İtem Adı",
  "category": "hats",
  "file": "hats/yeni-item.svg",
  "position": { "x": 0, "y": -70 },
  "scale": 0.8,
  "zIndex": 10
}
```

**Parametre Açıklamaları:**

| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| `id` | string | Benzersiz item ID (küçük harf, tire) |
| `name` | string | Görünen isim (Türkçe) |
| `category` | string | Kategori ID (`hats`, `glasses`, `head`, `face`) |
| `file` | string | SVG dosya yolu (kategori klasörüne göre) |
| `position` | object | `{x, y}` offset from face center |
| `scale` | number | Ölçek çarpanı (0.5 - 1.5 arası) |
| `zIndex` | number | Çizim katmanı (kategori ile aynı olmalı) |

### 3. Pozisyon Ayarlama

Position değerleri Puff'ın ana daire merkezine göre:

- **x**: Yatay offset (negatif = sol, pozitif = sağ)
- **y**: Dikey offset (negatif = yukarı, pozitif = aşağı)

**Referans Değerler:**
- Şapkalar: `y: -65` ile `-80` arası
- Gözlükler: `y: -10` ile `-15` arası
- Baş aksesuarları: `y: -70` ile `-90` arası
- Yüz aksesuarları: `y: -30` ile `20` arası

### 4. Ölçek (Scale) Ayarlama

Scale değeri SVG boyutunu çarpar:

- `0.5` - Çok küçük
- `0.8` - Küçük
- `1.0` - Normal
- `1.2` - Büyük
- `1.5` - Çok büyük

**İpucu:** Puff radius'ı ~70px olduğunda, 100px genişliğinde SVG için 0.8 scale iyi çalışır.

## Yeni Kategori Eklemek

1. **Config'a kategori ekle:**
```json
{
  "id": "ears",
  "name": "Kulak Aksesuarları",
  "slot": "ears",
  "zIndex": 25,
  "description": "Kulaklara takılan aksesuarlar"
}
```

2. **Slot sistemini güncelle** (`js/accessory.js`):
```javascript
this.slots = {
    hat: null,
    glasses: null,
    head: null,
    face: null,
    ears: null  // Yeni slot
};
```

3. **Slot mapping ekle** (`js/accessory.js`):
```javascript
this.categorySlotMap = {
    'hats': 'hat',
    'glasses': 'glasses',
    'head': 'head',
    'face': 'face',
    'ears': 'ears'  // Yeni mapping
};
```

4. **Yeni kategori klasörü oluştur:**
```
assets/accessories/ears/
```

## Sistem Mimarisi

### Dosya Yapısı
```
assets/accessories/
├── config.json              # Ana konfigürasyon
├── hats/                   # Şapkalar
│   ├── tophat.svg
│   ├── cap.svg
│   └── crown.svg
├── glasses/                # Gözlükler
│   ├── sunglasses.svg
│   └── nerd.svg
├── head/                   # Baş aksesuarları
│   ├── halo.svg
│   └── antennae.svg
└── face/                   # Yüz aksesuarları
    ├── mustache.svg
    └── eyebrows.svg
```

### Kod Yapısı

1. **AccessoryAssetLoader** (`js/accessoryAssetLoader.js`)
   - Config yükleme
   - Image yükleme ve cacheleme
   - Kategori/item sorgulama

2. **AccessoryRenderer** (`js/accessory.js`)
   - Slot yönetimi
   - Çizim ve render
   - Puff yüz merkezine göre konumlandırma

3. **WardrobeSystem** (`js/wardrobe.js`)
   - UI yönetimi
   - Önizleme puff'ı
   - Kullanıcı etkileşimi

## Render Sırası

Aksesuarlar zIndex sırasına göre çizilir:

1. **zIndex: 10** - Şapkalar (en alt)
2. **zIndex: 20** - Gözlükler
3. **zIndex: 30** - Baş aksesuarları
4. **zIndex: 40** - Yüz aksesuarları (en üst)

## Örnek SVG Template

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="myGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ff6b6b"/>
      <stop offset="100%" stop-color="#ee5a5a"/>
    </linearGradient>
  </defs>

  <!-- Çizim buraya - viewBox ortasına odaklan -->
  <circle cx="50" cy="50" r="40" fill="url(#myGradient)"/>
</svg>
```

## Geliştirme Notları

### İpuçları
- SVG'ler ortalanmış olmalı, merkez point ≈ (50, 50) için 100x100 viewBox
- Gradient'lar kullanarak derinlik kat
- Gölge için SVG filter kullan (`<filter><feDropShadow/></filter>`)
- Scale ile oynayarak doğru boyutu bul
- Position x değerini değiştirerek yatay konum ayarla

### Yaygın Sorunlar

**Sorun:** Aksesuar çok büyük/küçük görünüyor
**Çözüm:** `scale` değerini config'den ayarla

**Sorun:** Aksesuar yanlış yerde
**Çözüm:** `position.x` ve `position.y` değerlerini ayarla

**Sorun:** Aksesuar arkada kalıyor
**Çözüm:** `zIndex` değerini artır (kategori ile aynı olmalı)

**Sorun:** SVG yüklenmiyor
**Çözüm:** Dosya yolu doğru mu kontrol et, category klasöründe olduğundan emin ol

## Test Etme

1. Uygulamayı başlat: `docker compose -f docker-compose.dev.yml up -d --build`
2. Tarayıcıda aç: `http://localhost:8080`
3. Login ol ve puff'ını oluştur
4. Gardırop butonuna tıkla (👕)
5. Kategoriler arasında gezin
6. Item seç ve Wear/Remove butonunu dene
7. Close butonuna bas ve değişiklikleri kaydet

## Sonraki Adımlar

Bu sistem hazır olduğunda, yeni kategoriler ve item eklemek çok kolay olacak. Sadece:
1. SVG dosyasını koy
2. Config'e ekle
3. Test et

---
*Son güncelleme: 2026-02-12*
*Versiyon: 1.0 - Modular Accessory System*
