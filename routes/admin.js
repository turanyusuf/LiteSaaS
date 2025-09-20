const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../database/database');
const { adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// All admin routes require admin middleware
router.use(adminMiddleware);

// Dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    // User statistics
    const totalUsers = await db.get('SELECT COUNT(*) as count FROM users WHERE is_active = 1');
    const newUsersToday = await db.get(
      'SELECT COUNT(*) as count FROM users WHERE DATE(created_at) = DATE("now") AND is_active = 1'
    );
    const newUsersThisWeek = await db.get(
      'SELECT COUNT(*) as count FROM users WHERE created_at >= datetime("now", "-7 days") AND is_active = 1'
    );

    // Payment statistics
    const totalRevenue = await db.get(
      'SELECT SUM(amount) as total FROM payments WHERE status = "completed"'
    );
    const todayRevenue = await db.get(
      'SELECT SUM(amount) as total FROM payments WHERE DATE(created_at) = DATE("now") AND status = "completed"'
    );
    const pendingPayments = await db.get(
      'SELECT COUNT(*) as count FROM payments WHERE status = "pending"'
    );

    // Package statistics
    const totalPackages = await db.get('SELECT COUNT(*) as count FROM packages WHERE is_active = 1');
    const totalDeliveries = await db.get(
      'SELECT COUNT(*) as count FROM user_packages WHERE pdf_delivered = 1'
    );

    // Recent activities
    const recentActivities = await db.all(
      `SELECT ua.*, u.email, u.first_name, u.last_name 
       FROM user_activities ua 
       JOIN users u ON ua.user_id = u.id 
       ORDER BY ua.created_at DESC 
       LIMIT 10`
    );

    // Recent payments
    const recentPayments = await db.all(
      `SELECT p.*, u.email, u.first_name, u.last_name, pk.name as package_name 
       FROM payments p 
       JOIN users u ON p.user_id = u.id 
       JOIN packages pk ON p.package_id = pk.id 
       ORDER BY p.created_at DESC 
       LIMIT 10`
    );

    res.json({
      users: {
        total: totalUsers.count || 0,
        newToday: newUsersToday.count || 0,
        newThisWeek: newUsersThisWeek.count || 0
      },
      payments: {
        totalRevenue: totalRevenue.total || 0,
        todayRevenue: todayRevenue.total || 0,
        pending: pendingPayments.count || 0
      },
      packages: {
        total: totalPackages.count || 0,
        deliveries: totalDeliveries.count || 0
      },
      recentActivities,
      recentPayments
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      error: 'Dashboard verileri alınamadı',
      message: 'Dashboard verileri alınırken hata oluştu'
    });
  }
});

// User management
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (status === 'active') {
      whereClause += ' AND is_active = 1';
    } else if (status === 'inactive') {
      whereClause += ' AND is_active = 0';
    }

    const users = await db.all(
      `SELECT id, email, first_name, last_name, phone, telegram, whatsapp, 
              is_active, is_admin, email_verified, created_at, last_login, login_count 
       FROM users 
       WHERE ${whereClause}
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const totalCount = await db.get(
      `SELECT COUNT(*) as count FROM users WHERE ${whereClause}`,
      params
    );

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount.count,
        pages: Math.ceil(totalCount.count / limit)
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      error: 'Kullanıcılar alınamadı',
      message: 'Kullanıcılar alınırken hata oluştu'
    });
  }
});

// Get user details
router.get('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await db.get(
      `SELECT id, email, first_name, last_name, phone, telegram, whatsapp, 
              is_active, is_admin, email_verified, created_at, last_login, login_count, 
              ip_address, device_info 
       FROM users WHERE id = ?`,
      [userId]
    );

    if (!user) {
      return res.status(404).json({
        error: 'Kullanıcı bulunamadı',
        message: 'Belirtilen kullanıcı mevcut değil'
      });
    }

    // Get user packages
    const userPackages = await db.all(
      `SELECT up.*, p.name as package_name, p.description 
       FROM user_packages up 
       JOIN packages p ON up.package_id = p.id 
       WHERE up.user_id = ? 
       ORDER BY up.created_at DESC`,
      [userId]
    );

    // Get user activities
    const userActivities = await db.all(
      `SELECT * FROM user_activities 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 20`,
      [userId]
    );

    // Get user payments
    const userPayments = await db.all(
      `SELECT p.*, pk.name as package_name 
       FROM payments p 
       JOIN packages pk ON p.package_id = pk.id 
       WHERE p.user_id = ? 
       ORDER BY p.created_at DESC`,
      [userId]
    );

    res.json({
      user,
      packages: userPackages,
      activities: userActivities,
      payments: userPayments
    });

  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({
      error: 'Kullanıcı detayları alınamadı',
      message: 'Kullanıcı detayları alınırken hata oluştu'
    });
  }
});

// Update user
router.put('/users/:id', [
  body('firstName').optional().trim().isLength({ min: 2 }),
  body('lastName').optional().trim().isLength({ min: 2 }),
  body('email').optional().isEmail(),
  body('phone').optional().isMobilePhone('tr-TR'),
  body('isActive').optional().isBoolean(),
  body('isAdmin').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Doğrulama hatası',
        details: errors.array()
      });
    }

    const userId = req.params.id;
    const { firstName, lastName, email, phone, telegram, whatsapp, isActive, isAdmin } = req.body;

    // Check if user exists
    const existingUser = await db.get('SELECT id FROM users WHERE id = ?', [userId]);
    if (!existingUser) {
      return res.status(404).json({
        error: 'Kullanıcı bulunamadı',
        message: 'Belirtilen kullanıcı mevcut değil'
      });
    }

    // Check email uniqueness if email is being updated
    if (email) {
      const emailExists = await db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
      if (emailExists) {
        return res.status(400).json({
          error: 'E-posta zaten kullanımda',
          message: 'Bu e-posta adresi başka bir kullanıcı tarafından kullanılıyor'
        });
      }
    }

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
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
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
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(isActive);
    }
    if (isAdmin !== undefined) {
      updates.push('is_admin = ?');
      values.push(isAdmin);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    await db.run(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Log activity
    await db.run(
      'INSERT INTO user_activities (user_id, activity_type, description, ip_address, user_agent, device_info) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'user_updated', `Kullanıcı güncellendi: ID ${userId}`, req.ip, req.get('User-Agent'), req.get('User-Agent')]
    );

    res.json({
      message: 'Kullanıcı başarıyla güncellendi'
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      error: 'Kullanıcı güncellenemedi',
      message: 'Kullanıcı güncellenirken hata oluştu'
    });
  }
});

// Delete user (soft delete)
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    // Check if user exists
    const existingUser = await db.get('SELECT id, is_admin FROM users WHERE id = ?', [userId]);
    if (!existingUser) {
      return res.status(404).json({
        error: 'Kullanıcı bulunamadı',
        message: 'Belirtilen kullanıcı mevcut değil'
      });
    }

    // Prevent deleting admin users
    if (existingUser.is_admin) {
      return res.status(400).json({
        error: 'Admin kullanıcı silinemez',
        message: 'Admin yetkisine sahip kullanıcılar silinemez'
      });
    }

    // Soft delete - deactivate user
    await db.run('UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [userId]);

    // Log activity
    await db.run(
      'INSERT INTO user_activities (user_id, activity_type, description, ip_address, user_agent, device_info) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'user_deleted', `Kullanıcı silindi: ID ${userId}`, req.ip, req.get('User-Agent'), req.get('User-Agent')]
    );

    res.json({
      message: 'Kullanıcı başarıyla silindi'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      error: 'Kullanıcı silinemedi',
      message: 'Kullanıcı silinirken hata oluştu'
    });
  }
});

// Package management
router.get('/packages', async (req, res) => {
  try {
    const packages = await db.all(
      'SELECT * FROM packages ORDER BY created_at DESC'
    );

    // Parse questions for each package
    const packagesWithQuestions = packages.map(pkg => ({
      ...pkg,
      questions: pkg.questions ? JSON.parse(pkg.questions) : []
    }));

    res.json(packagesWithQuestions);

  } catch (error) {
    console.error('Get packages error:', error);
    res.status(500).json({
      error: 'Paketler alınamadı',
      message: 'Paketler alınırken hata oluştu'
    });
  }
});

// Settings management
router.get('/settings', async (req, res) => {
  try {
    const settings = await db.all('SELECT * FROM settings ORDER BY key');
    res.json(settings);

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      error: 'Ayarlar alınamadı',
      message: 'Ayarlar alınırken hata oluştu'
    });
  }
});

// Update settings
router.put('/settings', [
  body('settings').isArray().withMessage('Ayarlar array olmalı')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Doğrulama hatası',
        details: errors.array()
      });
    }

    const { settings } = req.body;

    for (const setting of settings) {
      await db.run(
        'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
        [setting.value, setting.key]
      );
    }

    // Log activity
    await db.run(
      'INSERT INTO user_activities (user_id, activity_type, description, ip_address, user_agent, device_info) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'settings_updated', 'Sistem ayarları güncellendi', req.ip, req.get('User-Agent'), req.get('User-Agent')]
    );

    res.json({
      message: 'Ayarlar başarıyla güncellendi'
    });

  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      error: 'Ayarlar güncellenemedi',
      message: 'Ayarlar güncellenirken hata oluştu'
    });
  }
});

// Send notification to user
router.post('/notifications/send', [
  body('userId').optional().isInt(),
  body('title').trim().isLength({ min: 3 }).withMessage('Başlık en az 3 karakter olmalı'),
  body('message').trim().isLength({ min: 10 }).withMessage('Mesaj en az 10 karakter olmalı'),
  body('type').isIn(['info', 'success', 'warning', 'error']).withMessage('Geçerli bir tip seçin'),
  body('isGlobal').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Doğrulama hatası',
        details: errors.array()
      });
    }

    const { userId, title, message, type, isGlobal } = req.body;

    if (!isGlobal && !userId) {
      return res.status(400).json({
        error: 'Kullanıcı ID gerekli',
        message: 'Global bildirim değilse kullanıcı ID gerekli'
      });
    }

    if (isGlobal) {
      // Send to all active users
      const users = await db.all('SELECT id FROM users WHERE is_active = 1');
      
      for (const user of users) {
        await db.run(
          'INSERT INTO notifications (user_id, title, message, type, is_global, created_by) VALUES (?, ?, ?, ?, ?, ?)',
          [user.id, title, message, type, 1, req.user.id]
        );
      }
    } else {
      // Send to specific user
      await db.run(
        'INSERT INTO notifications (user_id, title, message, type, created_by) VALUES (?, ?, ?, ?, ?)',
        [userId, title, message, type, req.user.id]
      );
    }

    // Log activity
    await db.run(
      'INSERT INTO user_activities (user_id, activity_type, description, ip_address, user_agent, device_info) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'notification_sent', `Bildirim gönderildi: ${title}`, req.ip, req.get('User-Agent'), req.get('User-Agent')]
    );

    res.json({
      message: 'Bildirim başarıyla gönderildi'
    });

  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({
      error: 'Bildirim gönderilemedi',
      message: 'Bildirim gönderilirken hata oluştu'
    });
  }
});

// Get all notifications
router.get('/notifications', async (req, res) => {
  try {
    const { page = 1, limit = 20, type, isRead } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const params = [];

    if (type) {
      whereClause += ' AND type = ?';
      params.push(type);
    }

    if (isRead !== undefined) {
      whereClause += ' AND is_read = ?';
      params.push(isRead === 'true' ? 1 : 0);
    }

    const notifications = await db.all(
      `SELECT n.*, u.email, u.first_name, u.last_name, 
              creator.email as creator_email, creator.first_name as creator_first_name, creator.last_name as creator_last_name
       FROM notifications n 
       LEFT JOIN users u ON n.user_id = u.id
       LEFT JOIN users creator ON n.created_by = creator.id
       WHERE ${whereClause}
       ORDER BY n.created_at DESC 
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
    console.error('Get notifications error:', error);
    res.status(500).json({
      error: 'Bildirimler alınamadı',
      message: 'Bildirimler alınırken hata oluştu'
    });
  }
});

// System logs
router.get('/logs', async (req, res) => {
  try {
    const { page = 1, limit = 50, type, userId } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const params = [];

    if (type) {
      whereClause += ' AND activity_type = ?';
      params.push(type);
    }

    if (userId) {
      whereClause += ' AND user_id = ?';
      params.push(userId);
    }

    const logs = await db.all(
      `SELECT ua.*, u.email, u.first_name, u.last_name 
       FROM user_activities ua 
       LEFT JOIN users u ON ua.user_id = u.id
       WHERE ${whereClause}
       ORDER BY ua.created_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const totalCount = await db.get(
      `SELECT COUNT(*) as count FROM user_activities WHERE ${whereClause}`,
      params
    );

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount.count,
        pages: Math.ceil(totalCount.count / limit)
      }
    });

  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({
      error: 'Loglar alınamadı',
      message: 'Sistem logları alınırken hata oluştu'
    });
  }
});

module.exports = router;

