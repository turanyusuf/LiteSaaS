const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;
const { body, validationResult } = require('express-validator');
const db = require('../database/database');
const { adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get all packages
router.get('/packages', async (req, res) => {
  try {
    const packages = await db.all('SELECT * FROM packages WHERE is_active = 1 ORDER BY created_at DESC');
    
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

// Get package by ID
router.get('/packages/:id', async (req, res) => {
  try {
    const packageId = req.params.id;
    const pkg = await db.get('SELECT * FROM packages WHERE id = ? AND is_active = 1', [packageId]);
    
    if (!pkg) {
      return res.status(404).json({
        error: 'Paket bulunamadı',
        message: 'Belirtilen paket mevcut değil'
      });
    }
    
    // Parse questions
    pkg.questions = pkg.questions ? JSON.parse(pkg.questions) : [];
    
    res.json(pkg);
  } catch (error) {
    console.error('Get package error:', error);
    res.status(500).json({
      error: 'Paket alınamadı',
      message: 'Paket alınırken hata oluştu'
    });
  }
});

// Generate PDF for package
router.post('/generate/:packageId', [
  body('userAnswers').isArray().withMessage('Kullanıcı cevapları gerekli')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Doğrulama hatası',
        details: errors.array()
      });
    }

    const { packageId } = req.params;
    const { userAnswers } = req.body;
    
    // Get package
    const pkg = await db.get('SELECT * FROM packages WHERE id = ? AND is_active = 1', [packageId]);
    if (!pkg) {
      return res.status(404).json({
        error: 'Paket bulunamadı',
        message: 'Belirtilen paket mevcut değil'
      });
    }
    
    // Parse questions
    const questions = pkg.questions ? JSON.parse(pkg.questions) : [];
    
    // Generate PDF
    const pdfBuffer = await generatePDF(pkg, questions, userAnswers, req.user);
    
    // Save PDF to file
    const fileName = `package_${packageId}_user_${req.user.id}_${Date.now()}.pdf`;
    const filePath = path.join(__dirname, '../uploads/pdfs', fileName);
    
    await fs.writeFile(filePath, pdfBuffer);
    
    // Update user package record
    await db.run(
      'UPDATE user_packages SET pdf_delivered = 1, pdf_path = ?, delivered_at = CURRENT_TIMESTAMP WHERE user_id = ? AND package_id = ?',
      [fileName, req.user.id, packageId]
    );
    
    // Log activity
    await db.run(
      'INSERT INTO user_activities (user_id, activity_type, description, ip_address, user_agent, device_info) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'pdf_generated', `PDF oluşturuldu: ${pkg.name}`, req.ip, req.get('User-Agent'), req.get('User-Agent')]
    );
    
    res.json({
      message: 'PDF başarıyla oluşturuldu',
      fileName,
      downloadUrl: `/uploads/pdfs/${fileName}`
    });
    
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      error: 'PDF oluşturulamadı',
      message: 'PDF oluşturulurken hata oluştu'
    });
  }
});

// Download PDF
router.get('/download/:fileName', async (req, res) => {
  try {
    const fileName = req.params.fileName;
    const filePath = path.join(__dirname, '../uploads/pdfs', fileName);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        error: 'Dosya bulunamadı',
        message: 'İstenen PDF dosyası mevcut değil'
      });
    }
    
    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Send file
    const fileBuffer = await fs.readFile(filePath);
    res.send(fileBuffer);
    
  } catch (error) {
    console.error('PDF download error:', error);
    res.status(500).json({
      error: 'PDF indirilemedi',
      message: 'PDF indirilirken hata oluştu'
    });
  }
});

// Get user's PDFs
router.get('/user-pdfs', async (req, res) => {
  try {
    const userPackages = await db.all(
      `SELECT up.*, p.name as package_name, p.description 
       FROM user_packages up 
       JOIN packages p ON up.package_id = p.id 
       WHERE up.user_id = ? AND up.pdf_delivered = 1 
       ORDER BY up.delivered_at DESC`,
      [req.user.id]
    );
    
    res.json(userPackages);
  } catch (error) {
    console.error('Get user PDFs error:', error);
    res.status(500).json({
      error: 'PDF\'ler alınamadı',
      message: 'Kullanıcı PDF\'leri alınırken hata oluştu'
    });
  }
});

// Admin: Create new package
router.post('/admin/packages', [
  adminMiddleware,
  body('name').trim().isLength({ min: 3 }).withMessage('Paket adı en az 3 karakter olmalı'),
  body('description').trim().isLength({ min: 10 }).withMessage('Açıklama en az 10 karakter olmalı'),
  body('price').isFloat({ min: 0 }).withMessage('Geçerli bir fiyat girin'),
  body('questions').isArray().withMessage('Sorular gerekli')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Doğrulama hatası',
        details: errors.array()
      });
    }

    const { name, description, price, questions } = req.body;
    
    const result = await db.run(
      'INSERT INTO packages (name, description, price, questions) VALUES (?, ?, ?, ?)',
      [name, description, price, JSON.stringify(questions)]
    );
    
    // Log activity
    await db.run(
      'INSERT INTO user_activities (user_id, activity_type, description, ip_address, user_agent, device_info) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'package_created', `Yeni paket oluşturuldu: ${name}`, req.ip, req.get('User-Agent'), req.get('User-Agent')]
    );
    
    res.status(201).json({
      message: 'Paket başarıyla oluşturuldu',
      packageId: result.id
    });
    
  } catch (error) {
    console.error('Create package error:', error);
    res.status(500).json({
      error: 'Paket oluşturulamadı',
      message: 'Paket oluşturulurken hata oluştu'
    });
  }
});

// Admin: Update package
router.put('/admin/packages/:id', [
  adminMiddleware,
  body('name').optional().trim().isLength({ min: 3 }),
  body('description').optional().trim().isLength({ min: 10 }),
  body('price').optional().isFloat({ min: 0 }),
  body('questions').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Doğrulama hatası',
        details: errors.array()
      });
    }

    const packageId = req.params.id;
    const { name, description, price, questions, is_active } = req.body;
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (price !== undefined) {
      updates.push('price = ?');
      values.push(price);
    }
    if (questions !== undefined) {
      updates.push('questions = ?');
      values.push(JSON.stringify(questions));
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active);
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(packageId);
    
    const result = await db.run(
      `UPDATE packages SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Paket bulunamadı',
        message: 'Belirtilen paket mevcut değil'
      });
    }
    
    // Log activity
    await db.run(
      'INSERT INTO user_activities (user_id, activity_type, description, ip_address, user_agent, device_info) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'package_updated', `Paket güncellendi: ID ${packageId}`, req.ip, req.get('User-Agent'), req.get('User-Agent')]
    );
    
    res.json({
      message: 'Paket başarıyla güncellendi'
    });
    
  } catch (error) {
    console.error('Update package error:', error);
    res.status(500).json({
      error: 'Paket güncellenemedi',
      message: 'Paket güncellenirken hata oluştu'
    });
  }
});

// Admin: Delete package
router.delete('/admin/packages/:id', adminMiddleware, async (req, res) => {
  try {
    const packageId = req.params.id;
    
    // Check if package has any purchases
    const purchases = await db.get('SELECT COUNT(*) as count FROM user_packages WHERE package_id = ?', [packageId]);
    
    if (purchases.count > 0) {
      // Soft delete - just deactivate
      await db.run('UPDATE packages SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [packageId]);
    } else {
      // Hard delete
      await db.run('DELETE FROM packages WHERE id = ?', [packageId]);
    }
    
    // Log activity
    await db.run(
      'INSERT INTO user_activities (user_id, activity_type, description, ip_address, user_agent, device_info) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'package_deleted', `Paket silindi: ID ${packageId}`, req.ip, req.get('User-Agent'), req.get('User-Agent')]
    );
    
    res.json({
      message: 'Paket başarıyla silindi'
    });
    
  } catch (error) {
    console.error('Delete package error:', error);
    res.status(500).json({
      error: 'Paket silinemedi',
      message: 'Paket silinirken hata oluştu'
    });
  }
});

// PDF Generation Function
async function generatePDF(packageData, questions, userAnswers, user) {
  let browser;
  
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Calculate score
    let correctAnswers = 0;
    const results = questions.map((question, index) => {
      const userAnswer = userAnswers[index];
      const isCorrect = userAnswer === question.correct;
      if (isCorrect) correctAnswers++;
      
      return {
        question: question.question,
        userAnswer: question.options[userAnswer] || 'Cevaplanmadı',
        correctAnswer: question.options[question.correct],
        isCorrect
      };
    });
    
    const score = Math.round((correctAnswers / questions.length) * 100);
    
    // Generate HTML content
    const htmlContent = generatePDFHTML(packageData, results, score, user);
    
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });
    
    return pdfBuffer;
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Generate PDF HTML
function generatePDFHTML(packageData, results, score, user) {
  const currentDate = new Date().toLocaleDateString('tr-TR');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {
                font-family: 'Arial', sans-serif;
                line-height: 1.6;
                color: #333;
                margin: 0;
                padding: 20px;
            }
            .header {
                text-align: center;
                border-bottom: 3px solid #6366f1;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }
            .header h1 {
                color: #6366f1;
                margin: 0;
                font-size: 28px;
            }
            .header p {
                margin: 5px 0;
                color: #666;
            }
            .user-info {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 30px;
            }
            .user-info h3 {
                margin: 0 0 10px 0;
                color: #333;
            }
            .score-section {
                text-align: center;
                background: linear-gradient(135deg, #6366f1, #8b5cf6);
                color: white;
                padding: 30px;
                border-radius: 12px;
                margin-bottom: 30px;
            }
            .score-number {
                font-size: 48px;
                font-weight: bold;
                margin: 0;
            }
            .score-label {
                font-size: 18px;
                margin: 5px 0 0 0;
            }
            .results-section h3 {
                color: #333;
                border-bottom: 2px solid #e5e7eb;
                padding-bottom: 10px;
            }
            .question-item {
                margin-bottom: 20px;
                padding: 15px;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                background: #fafafa;
            }
            .question-text {
                font-weight: bold;
                margin-bottom: 10px;
                color: #333;
            }
            .answer {
                margin: 5px 0;
                padding: 5px 10px;
                border-radius: 4px;
            }
            .correct-answer {
                background: #d1fae5;
                color: #065f46;
                border-left: 4px solid #10b981;
            }
            .incorrect-answer {
                background: #fee2e2;
                color: #991b1b;
                border-left: 4px solid #ef4444;
            }
            .user-answer {
                background: #dbeafe;
                color: #1e40af;
                border-left: 4px solid #3b82f6;
            }
            .footer {
                margin-top: 40px;
                text-align: center;
                color: #666;
                font-size: 12px;
                border-top: 1px solid #e5e7eb;
                padding-top: 20px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>${packageData.name}</h1>
            <p>Test Sonuç Raporu</p>
            <p>Oluşturulma Tarihi: ${currentDate}</p>
        </div>
        
        <div class="user-info">
            <h3>Kullanıcı Bilgileri</h3>
            <p><strong>Ad Soyad:</strong> ${user.first_name} ${user.last_name}</p>
            <p><strong>E-posta:</strong> ${user.email}</p>
            <p><strong>Test Tarihi:</strong> ${currentDate}</p>
        </div>
        
        <div class="score-section">
            <h2 class="score-number">${score}%</h2>
            <p class="score-label">Başarı Oranı</p>
            <p>${results.filter(r => r.isCorrect).length} / ${results.length} Doğru Cevap</p>
        </div>
        
        <div class="results-section">
            <h3>Detaylı Sonuçlar</h3>
            ${results.map((result, index) => `
                <div class="question-item">
                    <div class="question-text">${index + 1}. ${result.question}</div>
                    <div class="answer user-answer">
                        <strong>Sizin Cevabınız:</strong> ${result.userAnswer}
                    </div>
                    <div class="answer ${result.isCorrect ? 'correct-answer' : 'incorrect-answer'}">
                        <strong>Doğru Cevap:</strong> ${result.correctAnswer}
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="footer">
            <p>Bu rapor ${packageData.name} testi için otomatik olarak oluşturulmuştur.</p>
            <p>Mini SaaS Platform - ${currentDate}</p>
        </div>
    </body>
    </html>
  `;
}

module.exports = router;

