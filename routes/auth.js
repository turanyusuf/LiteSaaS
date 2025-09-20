const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../database/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Register
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Geçerli bir e-posta adresi girin'),
  body('password').isLength({ min: 6 }).withMessage('Şifre en az 6 karakter olmalı'),
  body('firstName').trim().isLength({ min: 2 }).withMessage('Ad en az 2 karakter olmalı'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Soyad en az 2 karakter olmalı'),
  body('phone').optional().isMobilePhone('tr-TR').withMessage('Geçerli bir telefon numarası girin')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Doğrulama hatası',
        details: errors.array()
      });
    }

    const { email, password, firstName, lastName, phone, telegram, whatsapp } = req.body;

    // Check if user already exists
    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({
        error: 'Kullanıcı zaten mevcut',
        message: 'Bu e-posta adresi ile zaten kayıt olunmuş'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const result = await db.run(
      `INSERT INTO users (email, password, first_name, last_name, phone, telegram, whatsapp, ip_address, device_info) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        email, 
        hashedPassword, 
        firstName, 
        lastName, 
        phone || null, 
        telegram || null, 
        whatsapp || null,
        req.ip,
        req.get('User-Agent')
      ]
    );

    // Log activity
    await db.run(
      'INSERT INTO user_activities (user_id, activity_type, description, ip_address, user_agent, device_info) VALUES (?, ?, ?, ?, ?, ?)',
      [result.id, 'register', 'Kullanıcı kaydı', req.ip, req.get('User-Agent'), req.get('User-Agent')]
    );

    // Generate token
    const token = jwt.sign(
      { userId: result.id, email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Kayıt başarılı',
      token,
      user: {
        id: result.id,
        email,
        firstName,
        lastName,
        phone,
        telegram,
        whatsapp
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      error: 'Kayıt hatası',
      message: 'Kayıt sırasında bir hata oluştu'
    });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Geçerli bir e-posta adresi girin'),
  body('password').notEmpty().withMessage('Şifre gerekli')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Doğrulama hatası',
        details: errors.array()
      });
    }

    const { email, password } = req.body;

    // Get user
    const user = await db.get(
      'SELECT id, email, password, first_name, last_name, is_active, is_admin, email_verified FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      return res.status(401).json({
        error: 'Giriş hatası',
        message: 'E-posta veya şifre hatalı'
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        error: 'Hesap deaktif',
        message: 'Hesabınız deaktif durumda'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Giriş hatası',
        message: 'E-posta veya şifre hatalı'
      });
    }

    // Update login info
    await db.run(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP, login_count = login_count + 1, ip_address = ?, device_info = ? WHERE id = ?',
      [req.ip, req.get('User-Agent'), user.id]
    );

    // Log activity
    await db.run(
      'INSERT INTO user_activities (user_id, activity_type, description, ip_address, user_agent, device_info) VALUES (?, ?, ?, ?, ?, ?)',
      [user.id, 'login', 'Kullanıcı girişi', req.ip, req.get('User-Agent'), req.get('User-Agent')]
    );

    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Giriş başarılı',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        isAdmin: user.is_admin,
        emailVerified: user.email_verified
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Giriş hatası',
      message: 'Giriş sırasında bir hata oluştu'
    });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.get(
      `SELECT id, email, first_name, last_name, phone, telegram, whatsapp, 
              is_admin, email_verified, created_at, last_login, login_count 
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({
        error: 'Kullanıcı bulunamadı'
      });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        telegram: user.telegram,
        whatsapp: user.whatsapp,
        isAdmin: user.is_admin,
        emailVerified: user.email_verified,
        createdAt: user.created_at,
        lastLogin: user.last_login,
        loginCount: user.login_count
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Kullanıcı bilgisi alınamadı',
      message: 'Kullanıcı bilgisi alınırken hata oluştu'
    });
  }
});

// Logout (client-side token removal)
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    // Log activity
    await db.run(
      'INSERT INTO user_activities (user_id, activity_type, description, ip_address, user_agent, device_info) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'logout', 'Kullanıcı çıkışı', req.ip, req.get('User-Agent'), req.get('User-Agent')]
    );

    res.json({
      message: 'Çıkış başarılı'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Çıkış hatası',
      message: 'Çıkış sırasında hata oluştu'
    });
  }
});

// Change password
router.post('/change-password', [
  authMiddleware,
  body('currentPassword').notEmpty().withMessage('Mevcut şifre gerekli'),
  body('newPassword').isLength({ min: 6 }).withMessage('Yeni şifre en az 6 karakter olmalı')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Doğrulama hatası',
        details: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Get current password
    const user = await db.get('SELECT password FROM users WHERE id = ?', [req.user.id]);
    
    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        error: 'Şifre hatası',
        message: 'Mevcut şifre hatalı'
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await db.run('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
                 [hashedNewPassword, req.user.id]);

    // Log activity
    await db.run(
      'INSERT INTO user_activities (user_id, activity_type, description, ip_address, user_agent, device_info) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'password_change', 'Şifre değiştirildi', req.ip, req.get('User-Agent'), req.get('User-Agent')]
    );

    res.json({
      message: 'Şifre başarıyla değiştirildi'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Şifre değiştirme hatası',
      message: 'Şifre değiştirilirken hata oluştu'
    });
  }
});

module.exports = router;

