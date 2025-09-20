const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

class Database {
  constructor() {
    this.db = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      const dbPath = process.env.DB_PATH || './database.sqlite';
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Veritabanı bağlantı hatası:', err);
          reject(err);
        } else {
          console.log('Veritabanı bağlantısı başarılı');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    const tables = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT,
        telegram TEXT,
        whatsapp TEXT,
        is_active BOOLEAN DEFAULT 1,
        is_admin BOOLEAN DEFAULT 0,
        email_verified BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        login_count INTEGER DEFAULT 0,
        device_info TEXT,
        ip_address TEXT,
        location TEXT
      )`,

      // Packages table
      `CREATE TABLE IF NOT EXISTS packages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        pdf_content TEXT,
        questions TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // User packages (purchases)
      `CREATE TABLE IF NOT EXISTS user_packages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        package_id INTEGER NOT NULL,
        payment_status TEXT DEFAULT 'pending',
        payment_method TEXT,
        payment_reference TEXT,
        amount DECIMAL(10,2) NOT NULL,
        pdf_delivered BOOLEAN DEFAULT 0,
        pdf_path TEXT,
        delivered_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (package_id) REFERENCES packages (id)
      )`,

      // Payments table
      `CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        package_id INTEGER NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency TEXT DEFAULT 'TRY',
        payment_method TEXT NOT NULL,
        payment_reference TEXT UNIQUE,
        status TEXT DEFAULT 'pending',
        provider_response TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (package_id) REFERENCES packages (id)
      )`,

      // User activity log
      `CREATE TABLE IF NOT EXISTS user_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        activity_type TEXT NOT NULL,
        description TEXT,
        ip_address TEXT,
        user_agent TEXT,
        device_info TEXT,
        location TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`,

      // Notifications table
      `CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        is_read BOOLEAN DEFAULT 0,
        is_global BOOLEAN DEFAULT 0,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        read_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (created_by) REFERENCES users (id)
      )`,

      // Analytics table
      `CREATE TABLE IF NOT EXISTS analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATE NOT NULL,
        metric_name TEXT NOT NULL,
        metric_value INTEGER DEFAULT 0,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Settings table
      `CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const table of tables) {
      await this.run(table);
    }

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_user_packages_user_id ON user_packages(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_packages_payment_status ON user_packages(payment_status)',
      'CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)',
      'CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(date)',
      'CREATE INDEX IF NOT EXISTS idx_analytics_metric ON analytics(metric_name)'
    ];

    for (const index of indexes) {
      await this.run(index);
    }

    // Insert default data
    await this.insertDefaultData();
  }

  async insertDefaultData() {
    // Check if admin user exists
    const adminExists = await this.get('SELECT id FROM users WHERE is_admin = 1');
    
    if (!adminExists) {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      
      await this.run(
        `INSERT INTO users (email, password, first_name, last_name, is_admin, email_verified, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [adminEmail, hashedPassword, 'Admin', 'User', 1, 1, 1]
      );
      console.log('✅ Admin kullanıcısı oluşturuldu');
    }

    // Insert default packages
    const packagesExist = await this.get('SELECT id FROM packages LIMIT 1');
    
    if (!packagesExist) {
      const defaultPackages = [
        {
          name: 'Matematik Deneme Paketi 1',
          description: '20 soruluk matematik deneme sınavı',
          price: 29.99,
          questions: JSON.stringify([
            { id: 1, question: '2x + 5 = 15 denkleminin çözümü nedir?', options: ['5', '10', '15', '20'], correct: 0 },
            { id: 2, question: 'Bir sayının 3 katının 7 fazlası 25 ise bu sayı kaçtır?', options: ['6', '7', '8', '9'], correct: 0 },
            { id: 3, question: 'x² - 4x + 3 = 0 denkleminin kökleri toplamı kaçtır?', options: ['2', '3', '4', '5'], correct: 2 },
            { id: 4, question: 'Bir üçgenin iç açıları toplamı kaç derecedir?', options: ['180', '270', '360', '90'], correct: 0 },
            { id: 5, question: '√16 + √25 işleminin sonucu kaçtır?', options: ['7', '8', '9', '10'], correct: 2 }
          ])
        },
        {
          name: 'Türkçe Deneme Paketi 1',
          description: '25 soruluk Türkçe deneme sınavı',
          price: 24.99,
          questions: JSON.stringify([
            { id: 1, question: 'Aşağıdaki kelimelerden hangisi isimdir?', options: ['güzel', 'koşmak', 'kitap', 'hızlı'], correct: 2 },
            { id: 2, question: '"Büyük" kelimesinin zıt anlamlısı nedir?', options: ['küçük', 'geniş', 'uzun', 'yüksek'], correct: 0 },
            { id: 3, question: 'Aşağıdaki cümlelerden hangisi olumludur?', options: ['Gelmedi.', 'Gelmedi mi?', 'Geldi.', 'Gelmesin.'], correct: 2 },
            { id: 4, question: '"Koşmak" fiilinin geçmiş zamanı nedir?', options: ['koştu', 'koşar', 'koşacak', 'koşuyor'], correct: 0 },
            { id: 5, question: 'Aşağıdaki kelimelerden hangisi çoğuldur?', options: ['ev', 'evler', 'evim', 'evde'], correct: 1 }
          ])
        },
        {
          name: 'Genel Kültür Paketi 1',
          description: '30 soruluk genel kültür testi',
          price: 19.99,
          questions: JSON.stringify([
            { id: 1, question: 'Türkiye\'nin başkenti neresidir?', options: ['İstanbul', 'Ankara', 'İzmir', 'Bursa'], correct: 1 },
            { id: 2, question: 'Dünyanın en büyük okyanusu hangisidir?', options: ['Atlas', 'Hint', 'Pasifik', 'Arktik'], correct: 2 },
            { id: 3, question: 'Mona Lisa tablosu kimin eseridir?', options: ['Van Gogh', 'Picasso', 'Da Vinci', 'Michelangelo'], correct: 2 },
            { id: 4, question: 'Türkiye\'nin en uzun nehri hangisidir?', options: ['Sakarya', 'Kızılırmak', 'Fırat', 'Dicle'], correct: 1 },
            { id: 5, question: 'İlk Türk devleti hangisidir?', options: ['Osmanlı', 'Selçuklu', 'Hun', 'Göktürk'], correct: 2 }
          ])
        }
      ];

      for (const pkg of defaultPackages) {
        await this.run(
          `INSERT INTO packages (name, description, price, questions) VALUES (?, ?, ?, ?)`,
          [pkg.name, pkg.description, pkg.price, pkg.questions]
        );
      }
      console.log('✅ Varsayılan paketler oluşturuldu');
    }

    // Insert default settings
    const settingsExist = await this.get('SELECT id FROM settings LIMIT 1');
    
    if (!settingsExist) {
      const defaultSettings = [
        ['site_name', 'Mini SaaS Platform', 'Site adı'],
        ['site_description', 'PDF teslimi ve ödeme takibi için mini SaaS platformu', 'Site açıklaması'],
        ['contact_email', 'info@example.com', 'İletişim e-postası'],
        ['max_file_size', '10485760', 'Maksimum dosya boyutu (byte)'],
        ['allowed_file_types', 'pdf,doc,docx', 'İzin verilen dosya türleri'],
        ['email_verification_required', 'false', 'E-posta doğrulama gerekli mi'],
        ['auto_deliver_pdf', 'true', 'PDF otomatik teslim'],
        ['payment_auto_approve', 'false', 'Ödeme otomatik onay']
      ];

      for (const [key, value, description] of defaultSettings) {
        await this.run(
          `INSERT INTO settings (key, value, description) VALUES (?, ?, ?)`,
          [key, value, description]
        );
      }
      console.log('✅ Varsayılan ayarlar oluşturuldu');
    }
  }

  // Database operation methods
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

module.exports = new Database();

