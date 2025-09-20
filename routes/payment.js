const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const db = require('../database/database');
const { adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Create payment
router.post('/create', [
  body('packageId').isInt().withMessage('Geçerli bir paket ID girin')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Doğrulama hatası',
        details: errors.array()
      });
    }

    const { packageId } = req.body;
    const userId = req.user.id;

    // Get package
    const pkg = await db.get('SELECT * FROM packages WHERE id = ? AND is_active = 1', [packageId]);
    if (!pkg) {
      return res.status(404).json({
        error: 'Paket bulunamadı',
        message: 'Belirtilen paket mevcut değil'
      });
    }

    // Check if user already has this package
    const existingPurchase = await db.get(
      'SELECT * FROM user_packages WHERE user_id = ? AND package_id = ?',
      [userId, packageId]
    );

    if (existingPurchase) {
      return res.status(400).json({
        error: 'Paket zaten satın alınmış',
        message: 'Bu paketi daha önce satın almışsınız'
      });
    }

    // Generate payment reference
    const paymentReference = `PAY_${Date.now()}_${userId}_${packageId}`;

    // Create payment record
    const paymentResult = await db.run(
      `INSERT INTO payments (user_id, package_id, amount, payment_method, payment_reference, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, packageId, pkg.price, 'paytr', paymentReference, 'pending']
    );

    // Create user package record
    await db.run(
      `INSERT INTO user_packages (user_id, package_id, payment_status, payment_reference, amount) 
       VALUES (?, ?, ?, ?, ?)`,
      [userId, packageId, 'pending', paymentReference, pkg.price]
    );

    // Log activity
    await db.run(
      'INSERT INTO user_activities (user_id, activity_type, description, ip_address, user_agent, device_info) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, 'payment_created', `Ödeme oluşturuldu: ${pkg.name} - ${pkg.price}₺`, req.ip, req.get('User-Agent'), req.get('User-Agent')]
    );

    // For demo purposes, simulate payment success
    // In production, integrate with actual payment provider
    const paymentUrl = await createPaymentUrl(pkg, paymentReference, req.user);

    res.json({
      message: 'Ödeme oluşturuldu',
      paymentReference,
      paymentUrl,
      amount: pkg.price,
      packageName: pkg.name
    });

  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({
      error: 'Ödeme oluşturulamadı',
      message: 'Ödeme oluşturulurken hata oluştu'
    });
  }
});

// Payment callback (for payment providers)
router.post('/callback', async (req, res) => {
  try {
    const { payment_reference, status, transaction_id } = req.body;

    if (!payment_reference) {
      return res.status(400).json({
        error: 'Geçersiz callback',
        message: 'Payment reference gerekli'
      });
    }

    // Get payment record
    const payment = await db.get(
      'SELECT * FROM payments WHERE payment_reference = ?',
      [payment_reference]
    );

    if (!payment) {
      return res.status(404).json({
        error: 'Ödeme bulunamadı',
        message: 'Belirtilen ödeme kaydı mevcut değil'
      });
    }

    // Update payment status
    const newStatus = status === 'success' ? 'completed' : 'failed';
    await db.run(
      'UPDATE payments SET status = ?, provider_response = ?, updated_at = CURRENT_TIMESTAMP WHERE payment_reference = ?',
      [newStatus, JSON.stringify(req.body), payment_reference]
    );

    // Update user package status
    await db.run(
      'UPDATE user_packages SET payment_status = ? WHERE payment_reference = ?',
      [newStatus, payment_reference]
    );

    if (newStatus === 'completed') {
      // Auto-deliver PDF if enabled
      const autoDeliver = await db.get("SELECT value FROM settings WHERE key = 'auto_deliver_pdf'");
      
      if (autoDeliver && autoDeliver.value === 'true') {
        // Trigger PDF generation
        await deliverPDF(payment.user_id, payment.package_id);
      }

      // Log activity
      await db.run(
        'INSERT INTO user_activities (user_id, activity_type, description, ip_address, user_agent, device_info) VALUES (?, ?, ?, ?, ?, ?)',
        [payment.user_id, 'payment_completed', `Ödeme tamamlandı: ${payment_reference}`, req.ip, req.get('User-Agent'), req.get('User-Agent')]
      );

      // Send notification
      await sendPaymentNotification(payment.user_id, payment.package_id, 'success');
    } else {
      // Log failed payment
      await db.run(
        'INSERT INTO user_activities (user_id, activity_type, description, ip_address, user_agent, device_info) VALUES (?, ?, ?, ?, ?, ?)',
        [payment.user_id, 'payment_failed', `Ödeme başarısız: ${payment_reference}`, req.ip, req.get('User-Agent'), req.get('User-Agent')]
      );
    }

    res.json({
      message: 'Callback işlendi',
      status: newStatus
    });

  } catch (error) {
    console.error('Payment callback error:', error);
    res.status(500).json({
      error: 'Callback işlenemedi',
      message: 'Ödeme callback\'i işlenirken hata oluştu'
    });
  }
});

// Get payment status
router.get('/status/:paymentReference', async (req, res) => {
  try {
    const { paymentReference } = req.params;

    const payment = await db.get(
      `SELECT p.*, up.payment_status, up.pdf_delivered, pk.name as package_name 
       FROM payments p 
       JOIN user_packages up ON p.payment_reference = up.payment_reference
       JOIN packages pk ON p.package_id = pk.id
       WHERE p.payment_reference = ?`,
      [paymentReference]
    );

    if (!payment) {
      return res.status(404).json({
        error: 'Ödeme bulunamadı',
        message: 'Belirtilen ödeme kaydı mevcut değil'
      });
    }

    res.json({
      paymentReference: payment.payment_reference,
      status: payment.status,
      amount: payment.amount,
      packageName: payment.package_name,
      pdfDelivered: payment.pdf_delivered,
      createdAt: payment.created_at,
      updatedAt: payment.updated_at
    });

  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({
      error: 'Ödeme durumu alınamadı',
      message: 'Ödeme durumu alınırken hata oluştu'
    });
  }
});

// Get user payments
router.get('/user-payments', async (req, res) => {
  try {
    const payments = await db.all(
      `SELECT p.*, pk.name as package_name, up.payment_status, up.pdf_delivered 
       FROM payments p 
       JOIN packages pk ON p.package_id = pk.id
       JOIN user_packages up ON p.payment_reference = up.payment_reference
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

// Admin: Get all payments
router.get('/admin/payments', adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const params = [];

    if (status) {
      whereClause += ' AND p.status = ?';
      params.push(status);
    }

    if (search) {
      whereClause += ' AND (u.email LIKE ? OR pk.name LIKE ? OR p.payment_reference LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const payments = await db.all(
      `SELECT p.*, u.email, u.first_name, u.last_name, pk.name as package_name, up.payment_status, up.pdf_delivered 
       FROM payments p 
       JOIN users u ON p.user_id = u.id
       JOIN packages pk ON p.package_id = pk.id
       JOIN user_packages up ON p.payment_reference = up.payment_reference
       WHERE ${whereClause}
       ORDER BY p.created_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const totalCount = await db.get(
      `SELECT COUNT(*) as count 
       FROM payments p 
       JOIN users u ON p.user_id = u.id
       JOIN packages pk ON p.package_id = pk.id
       WHERE ${whereClause}`,
      params
    );

    res.json({
      payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount.count,
        pages: Math.ceil(totalCount.count / limit)
      }
    });

  } catch (error) {
    console.error('Get admin payments error:', error);
    res.status(500).json({
      error: 'Ödemeler alınamadı',
      message: 'Admin ödemeleri alınırken hata oluştu'
    });
  }
});

// Admin: Update payment status
router.put('/admin/payments/:id', [
  adminMiddleware,
  body('status').isIn(['pending', 'completed', 'failed', 'refunded']).withMessage('Geçerli bir durum seçin')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Doğrulama hatası',
        details: errors.array()
      });
    }

    const paymentId = req.params.id;
    const { status } = req.body;

    // Get payment
    const payment = await db.get('SELECT * FROM payments WHERE id = ?', [paymentId]);
    if (!payment) {
      return res.status(404).json({
        error: 'Ödeme bulunamadı',
        message: 'Belirtilen ödeme kaydı mevcut değil'
      });
    }

    // Update payment
    await db.run(
      'UPDATE payments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, paymentId]
    );

    // Update user package
    await db.run(
      'UPDATE user_packages SET payment_status = ? WHERE payment_reference = ?',
      [status, payment.payment_reference]
    );

    // If payment completed, deliver PDF
    if (status === 'completed') {
      await deliverPDF(payment.user_id, payment.package_id);
    }

    // Log activity
    await db.run(
      'INSERT INTO user_activities (user_id, activity_type, description, ip_address, user_agent, device_info) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'payment_updated', `Ödeme durumu güncellendi: ${payment.payment_reference} -> ${status}`, req.ip, req.get('User-Agent'), req.get('User-Agent')]
    );

    res.json({
      message: 'Ödeme durumu güncellendi'
    });

  } catch (error) {
    console.error('Update payment error:', error);
    res.status(500).json({
      error: 'Ödeme güncellenemedi',
      message: 'Ödeme güncellenirken hata oluştu'
    });
  }
});

// Payment statistics
router.get('/admin/statistics', adminMiddleware, async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);

    // Total payments
    const totalPayments = await db.get(
      'SELECT COUNT(*) as count, SUM(amount) as total FROM payments WHERE status = "completed"'
    );

    // Recent payments
    const recentPayments = await db.get(
      `SELECT COUNT(*) as count, SUM(amount) as total 
       FROM payments 
       WHERE status = "completed" AND created_at >= datetime('now', '-${days} days')`
    );

    // Payment status breakdown
    const statusBreakdown = await db.all(
      'SELECT status, COUNT(*) as count, SUM(amount) as total FROM payments GROUP BY status'
    );

    // Daily payments for chart
    const dailyPayments = await db.all(
      `SELECT DATE(created_at) as date, COUNT(*) as count, SUM(amount) as total 
       FROM payments 
       WHERE status = "completed" AND created_at >= datetime('now', '-${days} days')
       GROUP BY DATE(created_at) 
       ORDER BY date`
    );

    // Top packages
    const topPackages = await db.all(
      `SELECT pk.name, COUNT(*) as sales, SUM(p.amount) as revenue 
       FROM payments p 
       JOIN packages pk ON p.package_id = pk.id 
       WHERE p.status = "completed" 
       GROUP BY p.package_id 
       ORDER BY sales DESC 
       LIMIT 5`
    );

    res.json({
      total: {
        payments: totalPayments.count || 0,
        revenue: totalPayments.total || 0
      },
      recent: {
        payments: recentPayments.count || 0,
        revenue: recentPayments.total || 0
      },
      statusBreakdown,
      dailyPayments,
      topPackages
    });

  } catch (error) {
    console.error('Payment statistics error:', error);
    res.status(500).json({
      error: 'İstatistikler alınamadı',
      message: 'Ödeme istatistikleri alınırken hata oluştu'
    });
  }
});

// Helper Functions
async function createPaymentUrl(packageData, paymentReference, user) {
  // For demo purposes, return a mock payment URL
  // In production, integrate with actual payment provider (PayTR, iyzico, etc.)
  
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl}/payment/success?ref=${paymentReference}`;
}

async function deliverPDF(userId, packageId) {
  try {
    // Get package
    const pkg = await db.get('SELECT * FROM packages WHERE id = ?', [packageId]);
    if (!pkg) return;

    // Generate PDF (simplified version for auto-delivery)
    const fileName = `package_${packageId}_user_${userId}_${Date.now()}.pdf`;
    
    // Update user package record
    await db.run(
      'UPDATE user_packages SET pdf_delivered = 1, pdf_path = ?, delivered_at = CURRENT_TIMESTAMP WHERE user_id = ? AND package_id = ?',
      [fileName, userId, packageId]
    );

    // Log activity
    await db.run(
      'INSERT INTO user_activities (user_id, activity_type, description, ip_address, user_agent, device_info) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, 'pdf_auto_delivered', `PDF otomatik teslim edildi: ${pkg.name}`, 'system', 'system', 'system']
    );

  } catch (error) {
    console.error('PDF delivery error:', error);
  }
}

async function sendPaymentNotification(userId, packageId, type) {
  try {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    const pkg = await db.get('SELECT * FROM packages WHERE id = ?', [packageId]);

    if (!user || !pkg) return;

    let title, message;

    if (type === 'success') {
      title = 'Ödeme Başarılı!';
      message = `${pkg.name} paketi için ödemeniz başarıyla tamamlandı. PDF dosyanız hazırlanıyor.`;
    } else {
      title = 'Ödeme Başarısız';
      message = `${pkg.name} paketi için ödemeniz tamamlanamadı. Lütfen tekrar deneyin.`;
    }

    // Create notification
    await db.run(
      'INSERT INTO notifications (user_id, title, message, type, created_by) VALUES (?, ?, ?, ?, ?)',
      [userId, title, message, type, 1] // Admin user ID
    );

  } catch (error) {
    console.error('Send notification error:', error);
  }
}

module.exports = router;

