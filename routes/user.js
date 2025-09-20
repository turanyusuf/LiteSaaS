const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../database/database');

const router = express.Router();

// Get user profile
router.get('/profile', async (req, res) => {
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
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Profil alınamadı',
      message: 'Kullanıcı profili alınırken hata oluştu'
    });
  }
});

// Update user profile
router.put('/profile', [
  body('firstName').optional().trim().isLength({ min: 2 }).withMessage('Ad en az 2 karakter olmalı'),
  body('lastName').optional().trim().isLength({ min: 2 }).withMessage('Soyad en az 2 karakter olmalı'),
  body('phone').optional().isMobilePhone('tr-TR').withMessage('Geçerli bir telefon numarası girin'),
  body('telegram').optional().trim(),
  body('whatsapp').optional().isMobilePhone('tr-TR').withMessage('Geçerli bir WhatsApp numarası girin')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Doğrulama hatası',
        details: errors.array()
      });
    }

    const { firstName, lastName, phone, telegram, whatsapp } = req.body;

    // Build update query
    const updates = [];
    const values = [];

    if (firstName !== undefined) {
      updates.push('first_name = ?');
      values.push(firstName);
    }
    if (lastName !== undefined) {
      updates.push('last_name = ?');
      values.push(lastName);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }
    if (telegram !== undefined) {
      updates.push('telegram = ?');
      values.push(telegram);
    }
    if (whatsapp !== undefined) {
      updates.push('whatsapp = ?');
      values.push(whatsapp);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.user.id);

    await db.run(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Log activity
    await db.run(
      'INSERT INTO user_activities (user_id, activity_type, description, ip_address, user_agent, device_info) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'profile_updated', 'Profil güncellendi', req.ip, req.get('User-Agent'), req.get('User-Agent')]
    );

    res.json({
      message: 'Profil başarıyla güncellendi'
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Profil güncellenemedi',
      message: 'Profil güncellenirken hata oluştu'
    });
  }
});

// Get user packages
router.get('/packages', async (req, res) => {
  try {
    const userPackages = await db.all(
      `SELECT up.*, p.name as package_name, p.description, p.price 
       FROM user_packages up 
       JOIN packages p ON up.package_id = p.id 
       WHERE up.user_id = ? 
       ORDER BY up.created_at DESC`,
      [req.user.id]
    );

    res.json(userPackages);

  } catch (error) {
    console.error('Get user packages error:', error);
    res.status(500).json({
      error: 'Paketler alınamadı',
      message: 'Kullanıcı paketleri alınırken hata oluştu'
    });
  }
});

// Get user payments
router.get('/payments', async (req, res) => {
  try {
    const payments = await db.all(
      `SELECT p.*, pk.name as package_name 
       FROM payments p 
       JOIN packages pk ON p.package_id = pk.id 
       WHERE p.user_id = ? 
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );

    res.json(payments);

  } catch (error) {
    console.error('Get user payments error:', error);
    res.status(500).json({
      error: 'Ödemeler alınamadı',
      message: 'Kullanıcı ödemeleri alınırken hata oluştu'
    });
  }
});

// Get user activities
router.get('/activities', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const activities = await db.all(
      `SELECT * FROM user_activities 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [req.user.id, parseInt(limit), offset]
    );

    const totalCount = await db.get(
      'SELECT COUNT(*) as count FROM user_activities WHERE user_id = ?',
      [req.user.id]
    );

    res.json({
      activities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount.count,
        pages: Math.ceil(totalCount.count / limit)
      }
    });

  } catch (error) {
    console.error('Get user activities error:', error);
    res.status(500).json({
      error: 'Aktiviteler alınamadı',
      message: 'Kullanıcı aktiviteleri alınırken hata oluştu'
    });
  }
});

// Get user notifications
router.get('/notifications', async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'user_id = ?';
    const params = [req.user.id];

    if (unreadOnly === 'true') {
      whereClause += ' AND is_read = 0';
    }

    const notifications = await db.all(
      `SELECT * FROM notifications 
       WHERE ${whereClause}
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const totalCount = await db.get(
      `SELECT COUNT(*) as count FROM notifications WHERE ${whereClause}`,
      params
    );

    res.json({
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount.count,
        pages: Math.ceil(totalCount.count / limit)
      }
    });

  } catch (error) {
    console.error('Get user notifications error:', error);
    res.status(500).json({
      error: 'Bildirimler alınamadı',
      message: 'Kullanıcı bildirimleri alınırken hata oluştu'
    });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', async (req, res) => {
  try {
    const notificationId = req.params.id;

    const result = await db.run(
      'UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [notificationId, req.user.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Bildirim bulunamadı',
        message: 'Belirtilen bildirim mevcut değil'
      });
    }

    res.json({
      message: 'Bildirim okundu olarak işaretlendi'
    });

  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      error: 'Bildirim güncellenemedi',
      message: 'Bildirim güncellenirken hata oluştu'
    });
  }
});

// Mark all notifications as read
router.put('/notifications/read-all', async (req, res) => {
  try {
    await db.run(
      'UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );

    res.json({
      message: 'Tüm bildirimler okundu olarak işaretlendi'
    });

  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({
      error: 'Bildirimler güncellenemedi',
      message: 'Bildirimler güncellenirken hata oluştu'
    });
  }
});

// Delete user account
router.delete('/account', async (req, res) => {
  try {
    // Deactivate user account instead of hard delete
    await db.run('UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.user.id]);

    // Log activity
    await db.run(
      'INSERT INTO user_activities (user_id, activity_type, description, ip_address, user_agent, device_info) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'account_deleted', 'Hesap silindi', req.ip, req.get('User-Agent'), req.get('User-Agent')]
    );

    res.json({
      message: 'Hesabınız başarıyla silindi'
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      error: 'Hesap silinemedi',
      message: 'Hesap silinirken hata oluştu'
    });
  }
});

module.exports = router;

