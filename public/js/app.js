// Global variables
let currentUser = null;
let packages = [];

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Initialize Application
async function initializeApp() {
    setupEventListeners();
    await loadPackages();
    checkAuthStatus();
    setupSmoothScrolling();
    setupMobileMenu();
}

// Setup Event Listeners
function setupEventListeners() {
    // Navigation
    document.getElementById('nav-toggle')?.addEventListener('click', toggleMobileMenu);
    
    // Forms
    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
    document.getElementById('register-form')?.addEventListener('submit', handleRegister);
    document.getElementById('contact-form')?.addEventListener('submit', handleContact);
    
    // Modal close events
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });
    
    // Close notifications
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('notification-close')) {
            e.target.closest('.notification').remove();
        }
    });
}

// Authentication Functions
async function checkAuthStatus() {
    const token = localStorage.getItem('token');
    if (token) {
        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                currentUser = data.user;
                updateUIForLoggedInUser();
            } else {
                localStorage.removeItem('token');
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            localStorage.removeItem('token');
        }
    }
}

function updateUIForLoggedInUser() {
    const navAuth = document.querySelector('.nav-auth');
    if (navAuth && currentUser) {
        navAuth.innerHTML = `
            <span class="user-info">Merhaba, ${currentUser.firstName}</span>
            <a href="/dashboard" class="btn btn-outline">Dashboard</a>
            ${currentUser.isAdmin ? '<a href="/admin" class="btn btn-primary">Admin</a>' : ''}
            <button class="btn btn-outline" onclick="logout()">Çıkış</button>
        `;
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            showNotification('Giriş başarılı!', 'success');
            closeModal('login-modal');
            updateUIForLoggedInUser();
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1000);
        } else {
            showNotification(data.message || 'Giriş başarısız', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Giriş sırasında hata oluştu', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const formData = {
        email: document.getElementById('register-email').value,
        password: document.getElementById('register-password').value,
        firstName: document.getElementById('register-firstname').value,
        lastName: document.getElementById('register-lastname').value,
        phone: document.getElementById('register-phone').value,
        telegram: document.getElementById('register-telegram').value,
        whatsapp: document.getElementById('register-whatsapp').value
    };
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            showNotification('Kayıt başarılı!', 'success');
            closeModal('register-modal');
            updateUIForLoggedInUser();
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1000);
        } else {
            showNotification(data.message || 'Kayıt başarısız', 'error');
        }
    } catch (error) {
        console.error('Register error:', error);
        showNotification('Kayıt sırasında hata oluştu', 'error');
    }
}

async function logout() {
    try {
        const token = localStorage.getItem('token');
        if (token) {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        }
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        localStorage.removeItem('token');
        currentUser = null;
        location.reload();
    }
}

// Package Functions
async function loadPackages() {
    try {
        const response = await fetch('/api/packages');
        if (response.ok) {
            packages = await response.json();
            renderPricingCards();
        }
    } catch (error) {
        console.error('Failed to load packages:', error);
    }
}

function renderPricingCards() {
    const pricingGrid = document.getElementById('pricing-grid');
    if (!pricingGrid || !packages.length) return;
    
    pricingGrid.innerHTML = packages.map((pkg, index) => `
        <div class="pricing-card ${index === 1 ? 'featured' : ''}">
            <h3 class="pricing-name">${pkg.name}</h3>
            <p class="pricing-description">${pkg.description}</p>
            <div class="pricing-price">
                <span class="pricing-currency">₺</span>${pkg.price}
            </div>
            <ul class="pricing-features">
                <li><i class="fas fa-check"></i> PDF Otomatik Teslimi</li>
                <li><i class="fas fa-check"></i> 7/24 Destek</li>
                <li><i class="fas fa-check"></i> Güvenli Ödeme</li>
                <li><i class="fas fa-check"></i> Mobil Uyumlu</li>
            </ul>
            <button class="btn btn-primary btn-full" onclick="purchasePackage(${pkg.id})">
                <i class="fas fa-shopping-cart"></i>
                Satın Al
            </button>
        </div>
    `).join('');
}

async function purchasePackage(packageId) {
    if (!currentUser) {
        showNotification('Satın almak için giriş yapmalısınız', 'warning');
        showLoginModal();
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/payment/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ packageId })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Redirect to payment page
            window.location.href = data.paymentUrl;
        } else {
            showNotification(data.message || 'Ödeme oluşturulamadı', 'error');
        }
    } catch (error) {
        console.error('Purchase error:', error);
        showNotification('Satın alma sırasında hata oluştu', 'error');
    }
}

// Contact Form
async function handleContact(e) {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('contact-name').value,
        email: document.getElementById('contact-email').value,
        message: document.getElementById('contact-message').value
    };
    
    try {
        const response = await fetch('/api/contact', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            showNotification('Mesajınız başarıyla gönderildi!', 'success');
            document.getElementById('contact-form').reset();
        } else {
            const data = await response.json();
            showNotification(data.message || 'Mesaj gönderilemedi', 'error');
        }
    } catch (error) {
        console.error('Contact error:', error);
        showNotification('Mesaj gönderilirken hata oluştu', 'error');
    }
}

// Modal Functions
function showLoginModal() {
    closeAllModals();
    document.getElementById('login-modal').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function showRegisterModal() {
    closeAllModals();
    document.getElementById('register-modal').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('show');
    });
    document.body.style.overflow = '';
}

// Mobile Menu
function setupMobileMenu() {
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', toggleMobileMenu);
    }
}

function toggleMobileMenu() {
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    
    navToggle.classList.toggle('active');
    navMenu.classList.toggle('active');
}

// Smooth Scrolling
function setupSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Notification System
function showNotification(message, type = 'info', title = '') {
    const container = document.getElementById('notification-container');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const iconMap = {
        success: 'fas fa-check',
        error: 'fas fa-times',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info'
    };
    
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="${iconMap[type] || iconMap.info}"></i>
        </div>
        <div class="notification-content">
            ${title ? `<div class="notification-title">${title}</div>` : ''}
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Utility Functions
function formatPrice(price) {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY'
    }).format(price);
}

function formatDate(date) {
    return new Intl.DateTimeFormat('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(new Date(date));
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// API Helper
async function apiCall(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        }
    };
    
    const response = await fetch(endpoint, { ...defaultOptions, ...options });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'API hatası' }));
        throw new Error(error.message || 'API hatası');
    }
    
    return response.json();
}

// Error Handling
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    showNotification('Beklenmeyen bir hata oluştu', 'error');
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    showNotification('Beklenmeyen bir hata oluştu', 'error');
});

// Service Worker Registration (for offline support)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registration successful');
            })
            .catch(function(err) {
                console.log('ServiceWorker registration failed');
            });
    });
}

// Export functions for global access
window.showLoginModal = showLoginModal;
window.showRegisterModal = showRegisterModal;
window.closeModal = closeModal;
window.scrollToSection = scrollToSection;
window.purchasePackage = purchasePackage;
window.logout = logout;

