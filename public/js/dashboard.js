// Dashboard JavaScript

let currentSection = 'overview';
let userData = null;

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

async function initializeDashboard() {
    await checkAuthStatus();
    if (!currentUser) {
        window.location.href = '/';
        return;
    }
    
    setupEventListeners();
    await loadUserData();
    await loadDashboardData();
}

function setupEventListeners() {
    // Sidebar navigation
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.dataset.section;
            switchSection(section);
        });
    });
    
    // Profile form
    document.getElementById('profile-form')?.addEventListener('submit', handleProfileUpdate);
    
    // Password form
    document.getElementById('password-form')?.addEventListener('submit', handlePasswordChange);
}

function switchSection(section) {
    // Update active sidebar item
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-section="${section}"]`).classList.add('active');
    
    // Update active section
    document.querySelectorAll('.dashboard-section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(`${section}-section`).classList.add('active');
    
    currentSection = section;
    
    // Load section-specific data
    switch(section) {
        case 'overview':
            loadDashboardData();
            break;
        case 'packages':
            loadUserPackages();
            break;
        case 'payments':
            loadUserPayments();
            break;
        case 'notifications':
            loadUserNotifications();
            break;
    }
}

async function loadUserData() {
    try {
        const response = await apiCall('/api/user/profile');
        userData = response.user;
        updateUserInfo();
    } catch (error) {
        console.error('Failed to load user data:', error);
        showNotification('Kullanıcı bilgileri yüklenemedi', 'error');
    }
}

function updateUserInfo() {
    if (!userData) return;
    
    const userInfoElement = document.getElementById('user-info');
    if (userInfoElement) {
        userInfoElement.textContent = `Merhaba, ${userData.firstName}`;
    }
    
    // Update profile form
    document.getElementById('profile-firstname').value = userData.firstName || '';
    document.getElementById('profile-lastname').value = userData.lastName || '';
    document.getElementById('profile-email').value = userData.email || '';
    document.getElementById('profile-phone').value = userData.phone || '';
    document.getElementById('profile-telegram').value = userData.telegram || '';
    document.getElementById('profile-whatsapp').value = userData.whatsapp || '';
}

async function loadDashboardData() {
    try {
        // Load user packages for overview
        const packagesResponse = await apiCall('/api/user/packages');
        const paymentsResponse = await apiCall('/api/user/payments');
        
        updateOverviewStats(packagesResponse, paymentsResponse);
        updateRecentPackages(packagesResponse.slice(0, 3));
        updateRecentPayments(paymentsResponse.slice(0, 3));
        
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        showNotification('Dashboard verileri yüklenemedi', 'error');
    }
}

function updateOverviewStats(packages, payments) {
    const totalPackages = packages.length;
    const deliveredPdfs = packages.filter(p => p.pdf_delivered).length;
    const totalSpent = payments
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);
    
    document.getElementById('total-packages').textContent = totalPackages;
    document.getElementById('delivered-pdfs').textContent = deliveredPdfs;
    document.getElementById('total-spent').textContent = formatPrice(totalSpent);
    document.getElementById('member-since').textContent = userData ? formatDate(userData.createdAt) : '-';
}

function updateRecentPackages(packages) {
    const container = document.getElementById('recent-packages');
    if (!container) return;
    
    if (packages.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">Henüz paket satın almadınız.</p>';
        return;
    }
    
    container.innerHTML = packages.map(pkg => `
        <div class="package-item">
            <h4>${pkg.package_name}</h4>
            <p>Durum: <span class="package-status ${pkg.payment_status}">${getStatusText(pkg.payment_status)}</span></p>
            <p>Tarih: ${formatDate(pkg.created_at)}</p>
            ${pkg.pdf_delivered ? `<a href="/api/pdf/download/${pkg.pdf_path}" class="btn btn-sm btn-primary">PDF İndir</a>` : ''}
        </div>
    `).join('');
}

function updateRecentPayments(payments) {
    const container = document.getElementById('recent-payments');
    if (!container) return;
    
    if (payments.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">Henüz ödeme yapmadınız.</p>';
        return;
    }
    
    container.innerHTML = payments.map(payment => `
        <div class="payment-item">
            <h4>${payment.package_name}</h4>
            <p>Tutar: ${formatPrice(payment.amount)}</p>
            <p>Durum: <span class="payment-status ${payment.status}">${getStatusText(payment.status)}</span></p>
            <p>Tarih: ${formatDate(payment.created_at)}</p>
        </div>
    `).join('');
}

async function loadUserPackages() {
    try {
        const packages = await apiCall('/api/user/packages');
        renderUserPackages(packages);
    } catch (error) {
        console.error('Failed to load user packages:', error);
        showNotification('Paketler yüklenemedi', 'error');
    }
}

function renderUserPackages(packages) {
    const container = document.getElementById('packages-grid');
    if (!container) return;
    
    if (packages.length === 0) {
        container.innerHTML = `
            <div class="text-center">
                <i class="fas fa-box" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                <h3>Henüz paket satın almadınız</h3>
                <p>İlk paketinizi satın almak için <a href="/">ana sayfaya</a> gidin.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = packages.map(pkg => `
        <div class="package-card">
            <h3>${pkg.package_name}</h3>
            <p>${pkg.description}</p>
            <div class="package-status ${pkg.payment_status}">
                ${getStatusText(pkg.payment_status)}
            </div>
            <div class="package-details">
                <p><strong>Fiyat:</strong> ${formatPrice(pkg.amount)}</p>
                <p><strong>Satın Alma Tarihi:</strong> ${formatDate(pkg.created_at)}</p>
                ${pkg.delivered_at ? `<p><strong>Teslim Tarihi:</strong> ${formatDate(pkg.delivered_at)}</p>` : ''}
            </div>
            <div class="package-actions">
                ${pkg.pdf_delivered ? 
                    `<a href="/api/pdf/download/${pkg.pdf_path}" class="btn btn-primary">
                        <i class="fas fa-download"></i> PDF İndir
                    </a>` : 
                    '<span class="text-muted">PDF hazırlanıyor...</span>'
                }
            </div>
        </div>
    `).join('');
}

async function loadUserPayments() {
    try {
        const payments = await apiCall('/api/user/payments');
        renderUserPayments(payments);
    } catch (error) {
        console.error('Failed to load user payments:', error);
        showNotification('Ödemeler yüklenemedi', 'error');
    }
}

function renderUserPayments(payments) {
    const container = document.getElementById('payments-table-body');
    if (!container) return;
    
    if (payments.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted">
                    Henüz ödeme yapmadınız.
                </td>
            </tr>
        `;
        return;
    }
    
    container.innerHTML = payments.map(payment => `
        <tr>
            <td>${payment.package_name}</td>
            <td>${formatPrice(payment.amount)}</td>
            <td>
                <span class="payment-status ${payment.status}">
                    ${getStatusText(payment.status)}
                </span>
            </td>
            <td>${formatDate(payment.created_at)}</td>
            <td>
                <button class="action-btn view" onclick="viewPaymentDetails('${payment.payment_reference}')" title="Detayları Gör">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function loadUserNotifications() {
    try {
        const response = await apiCall('/api/notifications');
        renderUserNotifications(response.notifications);
        updateNotificationBadge(response.unreadCount);
    } catch (error) {
        console.error('Failed to load notifications:', error);
        showNotification('Bildirimler yüklenemedi', 'error');
    }
}

function renderUserNotifications(notifications) {
    const container = document.getElementById('notifications-container');
    if (!container) return;
    
    if (notifications.length === 0) {
        container.innerHTML = `
            <div class="text-center">
                <i class="fas fa-bell" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                <h3>Henüz bildirim yok</h3>
                <p>Yeni bildirimler burada görünecek.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = notifications.map(notification => `
        <div class="notification-item ${notification.is_read ? '' : 'unread'}" data-id="${notification.id}">
            <div class="notification-header">
                <h4 class="notification-title">${notification.title}</h4>
                <span class="notification-time">${formatDate(notification.created_at)}</span>
            </div>
            <p class="notification-message">${notification.message}</p>
            <div class="notification-type ${notification.type}">
                <i class="fas fa-${getNotificationIcon(notification.type)}"></i>
                ${getNotificationTypeText(notification.type)}
            </div>
            ${!notification.is_read ? `
                <button class="btn btn-sm btn-outline" onclick="markNotificationRead(${notification.id})">
                    Okundu İşaretle
                </button>
            ` : ''}
        </div>
    `).join('');
}

function updateNotificationBadge(count) {
    const badge = document.getElementById('notification-badge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    
    const formData = {
        firstName: document.getElementById('profile-firstname').value,
        lastName: document.getElementById('profile-lastname').value,
        phone: document.getElementById('profile-phone').value,
        telegram: document.getElementById('profile-telegram').value,
        whatsapp: document.getElementById('profile-whatsapp').value
    };
    
    try {
        await apiCall('/api/user/profile', {
            method: 'PUT',
            body: JSON.stringify(formData)
        });
        
        showNotification('Profil başarıyla güncellendi', 'success');
        await loadUserData();
        
    } catch (error) {
        console.error('Profile update failed:', error);
        showNotification('Profil güncellenemedi', 'error');
    }
}

async function handlePasswordChange(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (newPassword !== confirmPassword) {
        showNotification('Yeni şifreler eşleşmiyor', 'error');
        return;
    }
    
    try {
        await apiCall('/api/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({
                currentPassword,
                newPassword
            })
        });
        
        showNotification('Şifre başarıyla değiştirildi', 'success');
        document.getElementById('password-form').reset();
        
    } catch (error) {
        console.error('Password change failed:', error);
        showNotification('Şifre değiştirilemedi', 'error');
    }
}

async function markNotificationRead(notificationId) {
    try {
        await apiCall(`/api/notifications/${notificationId}/read`, {
            method: 'PUT'
        });
        
        // Update UI
        const notificationElement = document.querySelector(`[data-id="${notificationId}"]`);
        if (notificationElement) {
            notificationElement.classList.remove('unread');
            const button = notificationElement.querySelector('button');
            if (button) button.remove();
        }
        
        showNotification('Bildirim okundu olarak işaretlendi', 'success');
        
        // Update badge
        const badge = document.getElementById('notification-badge');
        if (badge) {
            const currentCount = parseInt(badge.textContent) || 0;
            if (currentCount > 1) {
                badge.textContent = currentCount - 1;
            } else {
                badge.style.display = 'none';
            }
        }
        
    } catch (error) {
        console.error('Mark notification read failed:', error);
        showNotification('Bildirim güncellenemedi', 'error');
    }
}

async function markAllNotificationsRead() {
    try {
        await apiCall('/api/notifications/read-all', {
            method: 'PUT'
        });
        
        // Update UI
        document.querySelectorAll('.notification-item').forEach(item => {
            item.classList.remove('unread');
            const button = item.querySelector('button');
            if (button) button.remove();
        });
        
        // Update badge
        const badge = document.getElementById('notification-badge');
        if (badge) {
            badge.style.display = 'none';
        }
        
        showNotification('Tüm bildirimler okundu olarak işaretlendi', 'success');
        
    } catch (error) {
        console.error('Mark all notifications read failed:', error);
        showNotification('Bildirimler güncellenemedi', 'error');
    }
}

function viewPaymentDetails(paymentReference) {
    // Open payment details in new window or modal
    window.open(`/payment/details?ref=${paymentReference}`, '_blank');
}

// Helper functions
function getStatusText(status) {
    const statusMap = {
        'pending': 'Bekliyor',
        'completed': 'Tamamlandı',
        'failed': 'Başarısız',
        'delivered': 'Teslim Edildi'
    };
    return statusMap[status] || status;
}

function getNotificationIcon(type) {
    const iconMap = {
        'info': 'info-circle',
        'success': 'check-circle',
        'warning': 'exclamation-triangle',
        'error': 'times-circle'
    };
    return iconMap[type] || 'info-circle';
}

function getNotificationTypeText(type) {
    const typeMap = {
        'info': 'Bilgi',
        'success': 'Başarı',
        'warning': 'Uyarı',
        'error': 'Hata'
    };
    return typeMap[type] || 'Bilgi';
}

// Export functions for global access
window.markNotificationRead = markNotificationRead;
window.markAllNotificationsRead = markAllNotificationsRead;
window.viewPaymentDetails = viewPaymentDetails;

