const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error
  let error = {
    message: err.message || 'Sunucu hatası',
    status: err.status || 500
  };

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    error = {
      message: 'Doğrulama hatası',
      status: 400,
      details: messages
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = {
      message: 'Geçersiz token',
      status: 401
    };
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      message: 'Token süresi dolmuş',
      status: 401
    };
  }

  // SQLite errors
  if (err.code === 'SQLITE_CONSTRAINT') {
    if (err.message.includes('UNIQUE constraint failed')) {
      error = {
        message: 'Bu kayıt zaten mevcut',
        status: 400
      };
    } else {
      error = {
        message: 'Veritabanı kısıtlaması hatası',
        status: 400
      };
    }
  }

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = {
      message: 'Dosya boyutu çok büyük',
      status: 400
    };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = {
      message: 'Beklenmeyen dosya türü',
      status: 400
    };
  }

  // Rate limit errors
  if (err.status === 429) {
    error = {
      message: 'Çok fazla istek gönderildi',
      status: 429
    };
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production') {
    if (error.status >= 500) {
      error.message = 'Sunucu hatası';
      error.details = undefined;
    }
  }

  res.status(error.status).json({
    error: error.message,
    details: error.details,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  });
};

module.exports = errorHandler;

