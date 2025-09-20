const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../database/database');
const { adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get user notifications
router.get('/', async (req, res) => {
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

    const unreadCount = await db.get(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );

    res.json({
      notifications,
      unreadCount: unreadCount.count || 0,
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

// Mark notification as read
router.put('/:id/read', async (req, res) => {
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
router.put('/read-all', async (req, res) => {
  try {
    const result = await db.run(
      'UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );

    res.json({
      message: 'Tüm bildirimler okundu olarak işaretlendi',
      updatedCount: result.changes
    });

  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({
      error: 'Bildirimler güncellenemedi',
      message: 'Bildirimler güncellenirken hata oluştu'
    });
  }
});

// Delete notification
router.delete('/:id', async (req, res) => {
  try {
    const notificationId = req.params.id;

    const result = await db.run(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, req.user.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Bildirim bulunamadı',
        message: 'Belirtilen bildirim mevcut değil'
      });
    }

    res.json({
      message: 'Bildirim silindi'
    });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      error: 'Bildirim silinemedi',
      message: 'Bildirim silinirken hata oluştu'
    });
  }
});

// Admin: Send notification to user
router.post('/admin/send', [
  adminMiddleware,
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

    let notificationIds = [];

    if (isGlobal) {
      // Send to all active users
      const users = await db.all('SELECT id FROM users WHERE is_active = 1');
      
      for (const user of users) {
        const result = await db.run(
          'INSERT INTO notifications (user_id, title, message, type, is_global, created_by) VALUES (?, ?, ?, ?, ?, ?)',
          [user.id, title, message, type, 1, req.user.id]
        );
        notificationIds.push(result.id);
      }
    } else {
      // Send to specific user
      const result = await db.run(
        'INSERT INTO notifications (user_id, title, message, type, created_by) VALUES (?, ?, ?, ?, ?)',
        [userId, title, message, type, req.user.id]
      );
      notificationIds.push(result.id);
    }

    // Log activity
    await db.run(
      'INSERT INTO user_activities (user_id, activity_type, description, ip_address, user_agent, device_info) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'notification_sent', `Bildirim gönderildi: ${title}`, req.ip, req.get('User-Agent'), req.get('User-Agent')]
    );

    res.json({
      message: 'Bildirim başarıyla gönderildi',
      notificationIds,
      isGlobal: !!isGlobal
    });

  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({
      error: 'Bildirim gönderilemedi',
      message: 'Bildirim gönderilirken hata oluştu'
    });
  }
});

// Admin: Get all notifications
router.get('/admin/all', adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, isRead, isGlobal, userId } = req.query;
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

    if (isGlobal !== undefined) {
      whereClause += ' AND is_global = ?';
      params.push(isGlobal === 'true' ? 1 : 0);
    }

    if (userId) {
      whereClause += ' AND user_id = ?';
      params.push(userId);
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
    console.error('Get admin notifications error:', error);
    res.status(500).json({
      error: 'Bildirimler alınamadı',
      message: 'Admin bildirimleri alınırken hata oluştu'
    });
  }
});

// Admin: Delete notification
router.delete('/admin/:id', adminMiddleware, async (req, res) => {
  try {
    const notificationId = req.params.id;

    const result = await db.run('DELETE FROM notifications WHERE id = ?', [notificationId]);

    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Bildirim bulunamadı',
        message: 'Belirtilen bildirim mevcut değil'
      });
    }

    // Log activity
    await db.run(
      'INSERT INTO user_activities (user_id, activity_type, description, ip_address, user_agent, device_info) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'notification_deleted', `Bildirim silindi: ID ${notificationId}`, req.ip, req.get('User-Agent'), req.get('User-Agent')]
    );

    res.json({
      message: 'Bildirim silindi'
    });

  } catch (error) {
    console.error('Delete admin notification error:', error);
    res.status(500).json({
      error: 'Bildirim silinemedi',
      message: 'Bildirim silinirken hata oluştu'
    });
  }
});

// Admin: Notification statistics
router.get('/admin/statistics', adminMiddleware, async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);

    // Total notifications
    const totalNotifications = await db.get('SELECT COUNT(*) as count FROM notifications');
    
    // Unread notifications
    const unreadNotifications = await db.get('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0');
    
    // Notifications by type
    const notificationsByType = await db.all(
      'SELECT type, COUNT(*) as count FROM notifications GROUP BY type'
    );
    
    // Global vs individual notifications
    const globalVsIndividual = await db.all(
      'SELECT is_global, COUNT(*) as count FROM notifications GROUP BY is_global'
    );
    
    // Daily notifications
    const dailyNotifications = await db.all(
      `SELECT DATE(created_at) as date, COUNT(*) as count 
       FROM notifications 
       WHERE created_at >= datetime('now', '-${days} days')
       GROUP BY DATE(created_at) 
       ORDER BY date`
    );
    
    // Most active notification senders
    const topSenders = await db.all(
      `SELECT u.email, u.first_name, u.last_name, COUNT(*) as sent_count
       FROM notifications n
       JOIN users u ON n.created_by = u.id
       WHERE n.created_at >= datetime('now', '-${days} days')
       GROUP BY n.created_by
       ORDER BY sent_count DESC
       LIMIT 10`
    );

    res.json({
      period: days,
      total: totalNotifications.count || 0,
      unread: unreadNotifications.count || 0,
      byType: notificationsByType,
      globalVsIndividual,
      daily: dailyNotifications,
      topSenders
    });

  } catch (error) {
    console.error('Notification statistics error:', error);
    res.status(500).json({
      error: 'Bildirim istatistikleri alınamadı',
      message: 'Bildirim istatistikleri alınırken hata oluştu'
    });
  }
});

module.exports = router;

