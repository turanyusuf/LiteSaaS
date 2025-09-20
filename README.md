# LiteSaaS
hafif, hızlı ve kolay SaaS başlangıç platformu

# Mini SaaS Platformu

Kullanıma hazır, tam özellikli mini SaaS platformu. PDF teslimi, ödeme takibi, kullanıcı yönetimi ve admin paneli ile birlikte gelir.

## 🚀 Özellikler

### ✨ Temel Özellikler
- **Responsive Landing Page** - Modern ve kullanıcı dostu tasarım
- **Kullanıcı Kayıt/Giriş Sistemi** - Güvenli kimlik doğrulama
- **PDF Otomatik Teslimi** - Ödeme sonrası otomatik PDF oluşturma ve teslim
- **Ödeme Takibi** - PayTR, iyzico, PayPal entegrasyonu
- **Admin Paneli** - Kapsamlı yönetim arayüzü
- **Bildirim Sistemi** - E-posta, Telegram, WhatsApp bildirimleri
- **Analitik Raporlar** - Detaylı istatistikler ve grafikler
- **Offline Desteği** - Service Worker ile çevrimdışı kullanım
- **KVKK Uyumlu** - Veri güvenliği ve gizlilik koruması

### 🛡️ Güvenlik
- JWT tabanlı kimlik doğrulama
- Bcrypt ile şifre hashleme
- Rate limiting koruması
- Helmet.js güvenlik middleware
- SQL injection koruması
- XSS koruması
- CSRF koruması

### 📱 Responsive Tasarım
- Mobil uyumlu arayüz
- Tablet ve desktop optimizasyonu
- Modern CSS Grid ve Flexbox
- Touch-friendly etkileşimler

## 🛠️ Kurulum

### Gereksinimler
- Node.js 16+ 
- npm veya yarn
- SQLite (otomatik kurulum)

### Hızlı Başlangıç

1. **Projeyi klonlayın**
```bash
git clone <repository-url>
cd mini-saas-platform
```

2. **Bağımlılıkları yükleyin**
```bash
npm install
```

3. **Ortam değişkenlerini ayarlayın**
```bash
cp env.example .env
# .env dosyasını düzenleyin
```

4. **Kurulum sihirbazını çalıştırın**
```bash
npm run setup
```

5. **Uygulamayı başlatın**
```bash
npm start
```

6. **Tarayıcıda açın**
```
http://localhost:3000
```

### Manuel Kurulum

1. **Ortam değişkenlerini ayarlayın**
```bash
# .env dosyası oluşturun
PORT=3000
NODE_ENV=production
DB_PATH=./database.sqlite
JWT_SECRET=your-super-secret-jwt-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=your-email@gmail.com
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
```

2. **Gerekli klasörleri oluşturun**
```bash
mkdir -p uploads/pdfs uploads/avatars logs
```

3. **Uygulamayı başlatın**
```bash
npm start
```

## 📁 Proje Yapısı

```
mini-saas-platform/
├── public/                # Frontend dosyaları
│   ├── css/               # CSS dosyaları
│   ├── js/                # JavaScript dosyaları
│   ├── images/            # Resim dosyaları
│   ├── index.html         # Ana sayfa
│   ├── dashboard.html     # Kullanıcı dashboard
│   ├── admin.html         # Admin paneli
│   ├── offline.html       # Çevrimdışı sayfa
│   └── sw.js              # Service Worker
├── routes/                # API route'ları
│   ├── auth.js            # Kimlik doğrulama
│   ├── user.js            # Kullanıcı işlemleri
│   ├── admin.js           # Admin işlemleri
│   ├── payment.js         # Ödeme işlemleri
│   ├── pdf.js             # PDF işlemleri
│   ├── analytics.js       # Analitik işlemleri
│   └── notifications.js   # Bildirim işlemleri
├── middleware/            # Middleware dosyaları
│   ├── auth.js            # Kimlik doğrulama middleware
│   └── errorHandler.js    # Hata yönetimi
├── database/              # Veritabanı dosyaları
│   └── database.js        # SQLite bağlantısı
├── uploads/               # Yüklenen dosyalar
├── logs/                  # Log dosyaları
├── server.js              # Ana sunucu dosyası
├── setup.js               # Kurulum sihirbazı
├── package.json           # Proje bağımlılıkları
└── README.md              # Bu dosya
```

## 🔧 Konfigürasyon

### Ortam Değişkenleri

| Değişken | Açıklama | Varsayılan |
|----------|----------|------------|
| `PORT` | Sunucu portu | 3000 |
| `NODE_ENV` | Ortam (development/production) | production |
| `DB_PATH` | Veritabanı dosya yolu | ./database.sqlite |
| `JWT_SECRET` | JWT imzalama anahtarı | - |
| `SMTP_HOST` | SMTP sunucu adresi | - |
| `SMTP_PORT` | SMTP portu | 587 |
| `SMTP_USER` | SMTP kullanıcı adı | - |
| `SMTP_PASS` | SMTP şifresi | - |
| `FROM_EMAIL` | Gönderen e-posta | - |
| `ADMIN_EMAIL` | Admin e-posta | - |
| `ADMIN_PASSWORD` | Admin şifresi | - |

### Ödeme Sağlayıcıları

#### PayTR
```env
PAYMENT_PROVIDER=paytr
PAYTR_MERCHANT_ID=your-merchant-id
PAYTR_MERCHANT_KEY=your-merchant-key
PAYTR_MERCHANT_SALT=your-merchant-salt
```

#### iyzico
```env
PAYMENT_PROVIDER=iyzico
IYZICO_API_KEY=your-api-key
IYZICO_SECRET_KEY=your-secret-key
```

#### PayPal
```env
PAYMENT_PROVIDER=paypal
PAYPAL_CLIENT_ID=your-client-id
PAYPAL_CLIENT_SECRET=your-client-secret
```

## 🚀 Deployment

### Hosting Deployment

1. **Dosyaları yükleyin**
   - Tüm proje dosyalarını public_html klasörüne yükleyin

2. **Node.js ayarlarını yapın**
   - Hosting panelinde Node.js uygulaması oluşturun
   - Port: 3000
   - Start file: server.js

3. **Ortam değişkenlerini ayarlayın**
   - Hosting panelinde environment variables ekleyin

4. **Domain ayarlarını yapın**
   - Domain'i Node.js uygulamasına yönlendirin

### Docker Deployment

1. **Docker image oluşturun**
```bash
docker build -t mini-saas .
```

2. **Container çalıştırın**
```bash
docker run -p 3000:3000 --env-file .env mini-saas
```

3. **Docker Compose ile**
```bash
docker-compose up -d
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Systemd Service

```bash
# Service dosyasını kopyalayın
sudo cp mini-saas.service /etc/systemd/system/

# Service'i etkinleştirin
sudo systemctl enable mini-saas
sudo systemctl start mini-saas
```

## 📊 API Dokümantasyonu

### Kimlik Doğrulama

#### Kullanıcı Kaydı
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "Yusuf",
  "lastName": "TURAN",
  "phone": "+905551234567",
  "telegram": "@username",
  "whatsapp": "+905551234567"
}
```

#### Kullanıcı Girişi
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### Paket İşlemleri

#### Paketleri Listele
```http
GET /api/pdf/packages
Authorization: Bearer <token>
```

#### PDF Oluştur
```http
POST /api/pdf/generate/:packageId
Authorization: Bearer <token>
Content-Type: application/json

{
  "userAnswers": [0, 1, 2, 3, 0]
}
```

### Ödeme İşlemleri

#### Ödeme Oluştur
```http
POST /api/payment/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "packageId": 1
}
```

#### Ödeme Durumu
```http
GET /api/payment/status/:paymentReference
```

### Admin İşlemleri

#### Dashboard İstatistikleri
```http
GET /api/admin/dashboard
Authorization: Bearer <admin-token>
```

#### Kullanıcıları Listele
```http
GET /api/admin/users?page=1&limit=20&search=yusuf
Authorization: Bearer <admin-token>
```

## 🎨 Özelleştirme

### Tema Değiştirme

CSS değişkenlerini düzenleyerek tema renklerini değiştirebilirsiniz:

```css
:root {
    --primary-color: #6366f1;
    --secondary-color: #f59e0b;
    --success-color: #10b981;
    --error-color: #ef4444;
    /* ... diğer renkler */
}
```

### Logo Değiştirme

1. `public/images/` klasörüne logo dosyanızı ekleyin
2. `public/index.html` dosyasında logo referansını güncelleyin

### E-posta Şablonları

E-posta şablonlarını `templates/` klasöründe düzenleyebilirsiniz.

## 🔒 Güvenlik

### Önerilen Güvenlik Ayarları

1. **Güçlü JWT Secret kullanın**
2. **HTTPS kullanın**
3. **Rate limiting ayarlarını yapın**
4. **Düzenli güvenlik güncellemeleri yapın**
5. **Veritabanı yedekleme planı oluşturun**

### KVKK Uyumluluğu

- Kullanıcı verileri şifrelenir
- Veri silme işlemleri loglanır
- Kullanıcı onayları alınır
- Veri işleme politikaları uygulanır

## 🐛 Sorun Giderme

### Yaygın Sorunlar

#### Port Zaten Kullanımda
```bash
# Portu kullanan process'i bulun
lsof -i :3000

# Process'i sonlandırın
kill -9 <PID>
```

#### Veritabanı Bağlantı Hatası
```bash
# Veritabanı dosyasının izinlerini kontrol edin
ls -la database.sqlite

# İzinleri düzeltin
chmod 664 database.sqlite
```

#### E-posta Gönderim Hatası
- SMTP ayarlarını kontrol edin
- Gmail için "App Password" kullanın
- Firewall ayarlarını kontrol edin

### Log Dosyaları

Log dosyaları `logs/` klasöründe saklanır:
- `error.log` - Hata logları
- `access.log` - Erişim logları
- `payment.log` - Ödeme logları

## 📈 Performans Optimizasyonu

### Öneriler

1. **CDN kullanın** - Statik dosyalar için
2. **Redis cache** - Session ve cache için
3. **Database indexing** - Sık kullanılan sorgular için
4. **Image optimization** - Resim dosyaları için
5. **Gzip compression** - Nginx/Apache seviyesinde

### Monitoring

- Uptime monitoring
- Error tracking
- Performance metrics
- User analytics

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📄 Lisans

Bu proje Apache lisansı altında lisanslanmıştır. Detaylar için `LICENSE` dosyasına bakın.

## 📞 Destek

- **Issues**: [GitHub Issues](https://github.com/turanyusuf/LiteSaaS/issues)

## 🙏 Teşekkürler

- Express.js ekibine
- SQLite geliştiricilerine
- Tüm açık kaynak katkıda bulunanlara

---

## Lisans

Bu proje, **LiteSaaS Özel Lisansı** altında sunulmaktadır:

Proje **öğrenme, kişisel geliştirme ve ticari olmayan amaçlarla** serbestçe kullanılabilir, değiştirilebilir ve dağıtılabilir.

Proje, ticari gelir elde etmeyen girişimlerde **kaynak belirtilerek** kullanılabilir.

Eğer proje kullanılarak **ticari gelir** elde edilirse:

Projenin orijinal kaynağı ( LiteSaaS - https://github.com/turanyusuf/LiteSaas ) açıkça belirtilmelidir.

Elde edilen gelir üzerinden **telif/gelir paylaşımı** için proje sahibinden (→ Yusuf TURAN) yazılı izin alınmalıdır.

İzin alınmadan ticari gelir elde edilmesi **lisans ihlali** sayılır.
