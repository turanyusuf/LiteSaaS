#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🚀 Mini SaaS Platform Kurulum Sihirbazı - LiteSaaS');
console.log('=====================================\n');

async function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

async function setupEnvironment() {
    console.log('📝 Ortam değişkenleri ayarlanıyor...\n');
    
    const envData = {};
    
    // Server Configuration
    envData.PORT = await askQuestion('Port numarası (varsayılan: 3000): ') || '3000';
    envData.NODE_ENV = await askQuestion('Ortam (development/production) [production]: ') || 'production';
    
    // Database
    envData.DB_PATH = await askQuestion('Veritabanı dosya yolu [./database.sqlite]: ') || './database.sqlite';
    
    // JWT Secret
    const jwtSecret = await askQuestion('JWT Secret (güçlü bir anahtar girin): ');
    if (!jwtSecret) {
        console.log('❌ JWT Secret gerekli!');
        process.exit(1);
    }
    envData.JWT_SECRET = jwtSecret;
    
    // Email Configuration
    console.log('\n📧 E-posta ayarları:');
    envData.SMTP_HOST = await askQuestion('SMTP Host [smtp.gmail.com]: ') || 'smtp.gmail.com';
    envData.SMTP_PORT = await askQuestion('SMTP Port [587]: ') || '587';
    envData.SMTP_USER = await askQuestion('SMTP Kullanıcı adı: ');
    envData.SMTP_PASS = await askQuestion('SMTP Şifre: ');
    envData.FROM_EMAIL = await askQuestion('Gönderen e-posta: ');
    
    // Payment Configuration
    console.log('\n💳 Ödeme ayarları:');
    envData.PAYMENT_PROVIDER = await askQuestion('Ödeme sağlayıcısı (paytr/iyzico/paypal) [paytr]: ') || 'paytr';
    
    if (envData.PAYMENT_PROVIDER === 'paytr') {
        envData.PAYTR_MERCHANT_ID = await askQuestion('PayTR Merchant ID: ');
        envData.PAYTR_MERCHANT_KEY = await askQuestion('PayTR Merchant Key: ');
        envData.PAYTR_MERCHANT_SALT = await askQuestion('PayTR Merchant Salt: ');
    }
    
    // Admin Configuration
    console.log('\n👤 Admin hesabı:');
    envData.ADMIN_EMAIL = await askQuestion('Admin e-posta adresi: ');
    envData.ADMIN_PASSWORD = await askQuestion('Admin şifresi: ');
    
    // Security
    envData.BCRYPT_ROUNDS = await askQuestion('Bcrypt rounds [12]: ') || '12';
    envData.RATE_LIMIT_WINDOW = await askQuestion('Rate limit window (dakika) [15]: ') || '15';
    envData.RATE_LIMIT_MAX = await askQuestion('Rate limit max istek [100]: ') || '100';
    
    // File Upload
    envData.MAX_FILE_SIZE = await askQuestion('Max dosya boyutu (byte) [10485760]: ') || '10485760';
    envData.UPLOAD_PATH = await askQuestion('Upload klasörü [./uploads]: ') || './uploads';
    
    // Frontend URL
    envData.FRONTEND_URL = await askQuestion('Frontend URL [http://localhost:3000]: ') || 'http://localhost:3000';
    
    return envData;
}

function createEnvFile(envData) {
    const envContent = Object.entries(envData)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    
    fs.writeFileSync('.env', envContent);
    console.log('✅ .env dosyası oluşturuldu');
}

function createDirectories() {
    const dirs = [
        'uploads',
        'uploads/pdfs',
        'uploads/avatars',
        'public',
        'public/css',
        'public/js',
        'public/images',
        'logs'
    ];
    
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Klasör oluşturuldu: ${dir}`);
        }
    });
}

function createGitignore() {
    const gitignoreContent = `
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Database
*.sqlite
*.db

# Uploads
uploads/*
!uploads/.gitkeep

# Logs
logs/
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# nyc test coverage
.nyc_output

# Dependency directories
node_modules/
jspm_packages/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# next.js build output
.next

# nuxt.js build output
.nuxt

# vuepress build output
.vuepress/dist

# Serverless directories
.serverless

# FuseBox cache
.fusebox/

# DynamoDB Local files
.dynamodb/

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
    `.trim();
    
    fs.writeFileSync('.gitignore', gitignoreContent);
    console.log('✅ .gitignore dosyası oluşturuldu');
}

function createPackageScripts() {
    const packagePath = 'package.json';
    if (fs.existsSync(packagePath)) {
        const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        
        packageData.scripts = {
            ...packageData.scripts,
            'setup': 'node setup.js',
            'start': 'node server.js',
            'dev': 'nodemon server.js',
            'build': 'echo "Build completed"',
            'test': 'echo "No tests specified"',
            'lint': 'echo "No linter configured"'
        };
        
        fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2));
        console.log('✅ Package.json scriptleri güncellendi');
    }
}

function createDockerFiles() {
    // Dockerfile
    const dockerfileContent = `
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p uploads/pdfs uploads/avatars logs

EXPOSE 3000

USER node

CMD ["npm", "start"]
    `.trim();
    
    fs.writeFileSync('Dockerfile', dockerfileContent);
    console.log('✅ Dockerfile oluşturuldu');
    
    // docker-compose.yml
    const dockerComposeContent = `
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    volumes:
      - ./uploads:/app/uploads
      - ./database.sqlite:/app/database.sqlite
    restart: unless-stopped
    `.trim();
    
    fs.writeFileSync('docker-compose.yml', dockerComposeContent);
    console.log('✅ docker-compose.yml oluşturuldu');
}

function createNginxConfig() {
    const nginxConfig = `
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
    
    location /uploads {
        alias /path/to/your/app/uploads;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
    `.trim();
    
    fs.writeFileSync('nginx.conf', nginxConfig);
    console.log('✅ nginx.conf oluşturuldu');
}

function createSystemdService() {
    const serviceContent = `
[Unit]
Description=Mini SaaS Platform
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/your/app
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
    `.trim();
    
    fs.writeFileSync('mini-saas.service', serviceContent);
    console.log('✅ systemd service dosyası oluşturuldu');
}

async function main() {
    try {
        console.log('🔧 Kurulum başlatılıyor...\n');
        
        // Create directories
        createDirectories();
        
        // Setup environment
        const envData = await setupEnvironment();
        createEnvFile(envData);
        
        // Create configuration files
        createGitignore();
        createPackageScripts();
        createDockerFiles();
        createNginxConfig();
        createSystemdService();
        
        console.log('\n🎉 Kurulum tamamlandı!');
        console.log('\n📋 Sonraki adımlar:');
        console.log('1. npm install - Bağımlılıkları yükleyin');
        console.log('2. npm start - Uygulamayı başlatın');
        console.log('3. http://localhost:3000 - Uygulamayı açın');
        console.log('4. Admin paneline giriş yapın: /admin');
        console.log('\n📚 Dokümantasyon: README.md dosyasını okuyun');
        
    } catch (error) {
        console.error('❌ Kurulum sırasında hata oluştu:', error);
        process.exit(1);
    } finally {
        rl.close();
    }
}

// Run setup if this file is executed directly
if (require.main === module) {
    main();
}

module.exports = { setupEnvironment, createEnvFile, createDirectories };

