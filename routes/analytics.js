const express = require('express');
const db = require('../database/database');
const { adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// All analytics routes require admin middleware
router.use(adminMiddleware);

// Dashboard analytics
router.get('/dashboard', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);

    // User analytics
    const userStats = await getUserAnalytics(days);
    
    // Payment analytics
    const paymentStats = await getPaymentAnalytics(days);
    
    // Package analytics
    const packageStats = await getPackageAnalytics(days);
    
    // Activity analytics
    const activityStats = await getActivityAnalytics(days);

    res.json({
      period: days,
      users: userStats,
      payments: paymentStats,
      packages: packageStats,
      activities: activityStats
    });

  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({
      error: 'Analitik veriler alınamadı',
      message: 'Dashboard analitikleri alınırken hata oluştu'
    });
  }
});

// User analytics
router.get('/users', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);

    // Daily user registrations
    const dailyRegistrations = await db.all(
      `SELECT DATE(created_at) as date, COUNT(*) as count 
       FROM users 
       WHERE created_at >= datetime('now', '-${days} days') 
       GROUP BY DATE(created_at) 
       ORDER BY date`
    );

    // User growth over time
    const userGrowth = await db.all(
      `SELECT DATE(created_at) as date, COUNT(*) as daily_count,
              (SELECT COUNT(*) FROM users WHERE DATE(created_at) <= DATE(u.created_at)) as total_count
       FROM users u
       WHERE created_at >= datetime('now', '-${days} days')
       GROUP BY DATE(created_at)
       ORDER BY date`
    );

    // User activity levels
    const activityLevels = await db.all(
      `SELECT 
         CASE 
           WHEN login_count = 0 THEN 'Inactive'
           WHEN login_count BETWEEN 1 AND 5 THEN 'Low'
           WHEN login_count BETWEEN 6 AND 20 THEN 'Medium'
           ELSE 'High'
         END as activity_level,
         COUNT(*) as user_count
       FROM users 
       WHERE is_active = 1
       GROUP BY activity_level`
    );

    // User retention (users who logged in within last 7 days)
    const retention = await db.get(
      `SELECT 
         COUNT(*) as total_active_users,
         COUNT(CASE WHEN last_login >= datetime('now', '-7 days') THEN 1 END) as active_last_7_days,
         COUNT(CASE WHEN last_login >= datetime('now', '-30 days') THEN 1 END) as active_last_30_days
       FROM users 
       WHERE is_active = 1`
    );

    res.json({
      period: days,
      dailyRegistrations,
      userGrowth,
      activityLevels,
      retention
    });

  } catch (error) {
    console.error('User analytics error:', error);
    res.status(500).json({
      error: 'Kullanıcı analitikleri alınamadı',
      message: 'Kullanıcı analitikleri alınırken hata oluştu'
    });
  }
});

// Payment analytics
router.get('/payments', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);

    // Daily revenue
    const dailyRevenue = await db.all(
      `SELECT DATE(created_at) as date, 
              COUNT(*) as transaction_count,
              SUM(amount) as total_revenue
       FROM payments 
       WHERE status = 'completed' AND created_at >= datetime('now', '-${days} days')
       GROUP BY DATE(created_at) 
       ORDER BY date`
    );

    // Payment method breakdown
    const paymentMethods = await db.all(
      `SELECT payment_method, 
              COUNT(*) as count,
              SUM(amount) as total_amount
       FROM payments 
       WHERE status = 'completed' AND created_at >= datetime('now', '-${days} days')
       GROUP BY payment_method`
    );

    // Payment status breakdown
    const paymentStatus = await db.all(
      `SELECT status, 
              COUNT(*) as count,
              SUM(amount) as total_amount
       FROM payments 
       WHERE created_at >= datetime('now', '-${days} days')
       GROUP BY status`
    );

    // Average order value
    const avgOrderValue = await db.get(
      `SELECT 
         AVG(amount) as avg_amount,
         MIN(amount) as min_amount,
         MAX(amount) as max_amount
       FROM payments 
       WHERE status = 'completed' AND created_at >= datetime('now', '-${days} days')`
    );

    // Revenue by package
    const revenueByPackage = await db.all(
      `SELECT p.name as package_name,
              COUNT(*) as sales_count,
              SUM(pay.amount) as total_revenue,
              AVG(pay.amount) as avg_revenue
       FROM payments pay
       JOIN packages p ON pay.package_id = p.id
       WHERE pay.status = 'completed' AND pay.created_at >= datetime('now', '-${days} days')
       GROUP BY pay.package_id
       ORDER BY total_revenue DESC`
    );

    res.json({
      period: days,
      dailyRevenue,
      paymentMethods,
      paymentStatus,
      avgOrderValue,
      revenueByPackage
    });

  } catch (error) {
    console.error('Payment analytics error:', error);
    res.status(500).json({
      error: 'Ödeme analitikleri alınamadı',
      message: 'Ödeme analitikleri alınırken hata oluştu'
    });
  }
});

// Package analytics
router.get('/packages', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);

    // Package performance
    const packagePerformance = await db.all(
      `SELECT p.name as package_name,
              p.price,
              COUNT(up.id) as total_purchases,
              COUNT(CASE WHEN up.pdf_delivered = 1 THEN 1 END) as delivered_count,
              SUM(up.amount) as total_revenue,
              ROUND(COUNT(CASE WHEN up.pdf_delivered = 1 THEN 1 END) * 100.0 / COUNT(up.id), 2) as delivery_rate
       FROM packages p
       LEFT JOIN user_packages up ON p.id = up.package_id
       WHERE up.created_at >= datetime('now', '-${days} days') OR up.created_at IS NULL
       GROUP BY p.id
       ORDER BY total_revenue DESC`
    );

    // Package sales over time
    const packageSales = await db.all(
      `SELECT DATE(up.created_at) as date,
              p.name as package_name,
              COUNT(*) as sales_count,
              SUM(up.amount) as revenue
       FROM user_packages up
       JOIN packages p ON up.package_id = p.id
       WHERE up.created_at >= datetime('now', '-${days} days')
       GROUP BY DATE(up.created_at), up.package_id
       ORDER BY date, revenue DESC`
    );

    // Most popular packages
    const popularPackages = await db.all(
      `SELECT p.name as package_name,
              COUNT(*) as purchase_count,
              SUM(up.amount) as total_revenue
       FROM user_packages up
       JOIN packages p ON up.package_id = p.id
       WHERE up.created_at >= datetime('now', '-${days} days')
       GROUP BY up.package_id
       ORDER BY purchase_count DESC
       LIMIT 10`
    );

    res.json({
      period: days,
      packagePerformance,
      packageSales,
      popularPackages
    });

  } catch (error) {
    console.error('Package analytics error:', error);
    res.status(500).json({
      error: 'Paket analitikleri alınamadı',
      message: 'Paket analitikleri alınırken hata oluştu'
    });
  }
});

// Activity analytics
router.get('/activities', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);

    // Activity types breakdown
    const activityTypes = await db.all(
      `SELECT activity_type,
              COUNT(*) as count
       FROM user_activities
       WHERE created_at >= datetime('now', '-${days} days')
       GROUP BY activity_type
       ORDER BY count DESC`
    );

    // Daily activity
    const dailyActivity = await db.all(
      `SELECT DATE(created_at) as date,
              COUNT(*) as activity_count,
              COUNT(DISTINCT user_id) as unique_users
       FROM user_activities
       WHERE created_at >= datetime('now', '-${days} days')
       GROUP BY DATE(created_at)
       ORDER BY date`
    );

    // Most active users
    const activeUsers = await db.all(
      `SELECT u.email,
              u.first_name,
              u.last_name,
              COUNT(ua.id) as activity_count,
              MAX(ua.created_at) as last_activity
       FROM user_activities ua
       JOIN users u ON ua.user_id = u.id
       WHERE ua.created_at >= datetime('now', '-${days} days')
       GROUP BY ua.user_id
       ORDER BY activity_count DESC
       LIMIT 20`
    );

    res.json({
      period: days,
      activityTypes,
      dailyActivity,
      activeUsers
    });

  } catch (error) {
    console.error('Activity analytics error:', error);
    res.status(500).json({
      error: 'Aktivite analitikleri alınamadı',
      message: 'Aktivite analitikleri alınırken hata oluştu'
    });
  }
});

// Export analytics data
router.get('/export', async (req, res) => {
  try {
    const { type, period = '30' } = req.query;
    const days = parseInt(period);

    let data = {};

    switch (type) {
      case 'users':
        data = await getUserAnalytics(days);
        break;
      case 'payments':
        data = await getPaymentAnalytics(days);
        break;
      case 'packages':
        data = await getPackageAnalytics(days);
        break;
      case 'activities':
        data = await getActivityAnalytics(days);
        break;
      default:
        return res.status(400).json({
          error: 'Geçersiz export tipi',
          message: 'Desteklenen tipler: users, payments, packages, activities'
        });
    }

    res.json({
      type,
      period: days,
      exportedAt: new Date().toISOString(),
      data
    });

  } catch (error) {
    console.error('Export analytics error:', error);
    res.status(500).json({
      error: 'Veri export edilemedi',
      message: 'Analitik veriler export edilirken hata oluştu'
    });
  }
});

// Helper functions
async function getUserAnalytics(days) {
  const totalUsers = await db.get('SELECT COUNT(*) as count FROM users WHERE is_active = 1');
  const newUsers = await db.get(
    `SELECT COUNT(*) as count FROM users WHERE created_at >= datetime('now', '-${days} days') AND is_active = 1`
  );
  const activeUsers = await db.get(
    `SELECT COUNT(*) as count FROM users WHERE last_login >= datetime('now', '-7 days') AND is_active = 1`
  );

  return {
    total: totalUsers.count || 0,
    new: newUsers.count || 0,
    active: activeUsers.count || 0
  };
}

async function getPaymentAnalytics(days) {
  const totalRevenue = await db.get(
    `SELECT SUM(amount) as total FROM payments WHERE status = 'completed' AND created_at >= datetime('now', '-${days} days')`
  );
  const totalTransactions = await db.get(
    `SELECT COUNT(*) as count FROM payments WHERE status = 'completed' AND created_at >= datetime('now', '-${days} days')`
  );
  const pendingPayments = await db.get(
    `SELECT COUNT(*) as count FROM payments WHERE status = 'pending' AND created_at >= datetime('now', '-${days} days')`
  );

  return {
    revenue: totalRevenue.total || 0,
    transactions: totalTransactions.count || 0,
    pending: pendingPayments.count || 0
  };
}

async function getPackageAnalytics(days) {
  const totalPackages = await db.get('SELECT COUNT(*) as count FROM packages WHERE is_active = 1');
  const totalDeliveries = await db.get(
    `SELECT COUNT(*) as count FROM user_packages WHERE pdf_delivered = 1 AND created_at >= datetime('now', '-${days} days')`
  );
  const pendingDeliveries = await db.get(
    `SELECT COUNT(*) as count FROM user_packages WHERE pdf_delivered = 0 AND payment_status = 'completed' AND created_at >= datetime('now', '-${days} days')`
  );

  return {
    total: totalPackages.count || 0,
    delivered: totalDeliveries.count || 0,
    pending: pendingDeliveries.count || 0
  };
}

async function getActivityAnalytics(days) {
  const totalActivities = await db.get(
    `SELECT COUNT(*) as count FROM user_activities WHERE created_at >= datetime('now', '-${days} days')`
  );
  const uniqueUsers = await db.get(
    `SELECT COUNT(DISTINCT user_id) as count FROM user_activities WHERE created_at >= datetime('now', '-${days} days')`
  );

  return {
    total: totalActivities.count || 0,
    uniqueUsers: uniqueUsers.count || 0
  };
}

module.exports = router;

