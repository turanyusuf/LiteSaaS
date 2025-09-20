const jwt = require('jsonwebtoken');
const db = require('../database/database');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                  req.cookies?.token || 
                  req.query?.token;

    if (!token) {
      return res.status(401).json({ 
        error: 'Erişim reddedildi', 
        message: 'Token bulunamadı' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    
    // Get user from database
    const user = await db.get(
      'SELECT id, email, first_name, last_name, is_active, is_admin, email_verified FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!user) {
      return res.status(401).json({ 
        error: 'Erişim reddedildi', 
        message: 'Kullanıcı bulunamadı' 
      });
    }

    if (!user.is_active) {
      return res.status(401).json({ 
        error: 'Hesap deaktif', 
        message: 'Hesabınız deaktif durumda' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Geçersiz token', 
        message: 'Token geçersiz veya süresi dolmuş' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token süresi dolmuş', 
        message: 'Lütfen tekrar giriş yapın' 
      });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      error: 'Sunucu hatası', 
      message: 'Kimlik doğrulama sırasında hata oluştu' 
    });
  }
};

const adminMiddleware = (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ 
      error: 'Yetkisiz erişim', 
      message: 'Bu işlem için admin yetkisi gerekli' 
    });
  }
  next();
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                  req.cookies?.token || 
                  req.query?.token;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
      const user = await db.get(
        'SELECT id, email, first_name, last_name, is_active, is_admin, email_verified FROM users WHERE id = ?',
        [decoded.userId]
      );
      
      if (user && user.is_active) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Optional auth - continue without user
    next();
  }
};

module.exports = {
  authMiddleware,
  adminMiddleware,
  optionalAuth
};

