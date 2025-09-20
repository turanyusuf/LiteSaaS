// Admin Panel JavaScript

let currentSection = 'dashboard';
let currentPage = 1;
let currentFilters = {};

// Initialize Admin Panel
document.addEventListener('DOMContentLoaded', function() {
    initializeAdmin();
});

async function initializeAdmin() {
    await checkAuthStatus();
    if (!currentUser || !currentUser.isAdmin) {
        window.location.href = '/';
        return;
    }
    
    setupEventListeners();
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
    
    // Search and filter inputs
    document.getElementById('user-search')?.addEventListener('input', debounce(loadUsers, 300));
    document.getElementById('user-status-filter')?.addEventListener('change', loadUsers);
    document.getElementById('payment-search')?.addEventListener('input', debounce(loadPayments, 300));
    document.getElementById('payment-status-filter')?.addEventListener('change', loadPayments);
    document.getElementById('analytics-period')?.addEventListener('change', loadAnalytics);
    
    // Forms
    document.getElementById('create-package-form')?.addEventListener('submit', handleCreatePackage);
    document.getElementById('send-notification-form')?.addEventListener('submit', handleSendNotification);
    document.getElementById('settings-form')?.addEventListener('submit', handleSaveSettings);
    
    // Global notification checkbox
    document.getElementById('is-global-notification')?.addEventListener('change', function() {
        const userGroup = document.getElementById('user-selection-group');
        if (userGroup) {
            userGroup.style.display = this.checked ? 'none' : 'block';
        }
    });
}

function switchSection(section) {
    // Update active sidebar item
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-section="${section}"]`).classList.add('active');
    
    // Update active section
    document.querySelectorAll('.admin-section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(`${section}-section`).classList.add('active');
    
    currentSection = section;
    
    // Load section-specific data
    switch(section) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'users':
            loadUsers();
            break;
        case 'packages':
            loadPackages();
            break;
        case 'payments':
            loadPayments();
            break;
        case 'notifications':
            loadNotifications();
            break;
        case 'analytics':
            loadAnalytics();
            break;
        case 'settings':
            loadSettings();
            break;
        case 'logs':
            loadLogs();
            break;
    }
}

async function loadDashboardData() {
    try {
        const response = await apiCall('/api/admin/dashboard');
        updateDashboardStats(response);
        updateRecentActivities(response.recentActivities);
        updateRecentPayments(response.recentPayments);
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        showNotification('Dashboard verileri yüklenemedi', 'error');
    }
}

function updateDashboardStats(data) {
    document.getElementById('total-users').textContent = data.users.total;
    document.getElementById('new-users-today').textContent = `+${data.users.newToday} bugün`;
    document.getElementById('total-revenue').textContent = formatPrice(data.payments.totalRevenue);
    document.getElementById('today-revenue').textContent = `${formatPrice(data.payments.todayRevenue)} bugün`;
    document.getElementById('total-packages').textContent = data.packages.total;
    document.getElementById('total-deliveries').textContent = `${data.packages.deliveries} teslim`;
    document.getElementById('pending-payments').textContent = data.payments.pending;
}

function updateRecentActivities(activities) {
    const container = document.getElementById('recent-activities');
    if (!container) return;
    
    if (activities.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">Henüz aktivite yok.</p>';
        return;
    }
    
    container.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon">
                <i class="fas fa-${getActivityIcon(activity.activity_type)}"></i>
            </div>
            <div class="activity-content">
                <h4>${activity.description}</h4>
                <p>${activity.email} - ${formatDate(activity.created_at)}</p>
            </div>
        </div>
    `).join('');
}

function updateRecentPayments(payments) {
    const container = document.getElementById('recent-payments');
    if (!container) return;
    
    if (payments.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">Henüz ödeme yok.</p>';
        return;
    }
    
    container.innerHTML = payments.map(payment => `
        <div class="payment-item">
            <h4>${payment.package_name}</h4>
            <p>${payment.email} - ${formatPrice(payment.amount)}</p>
            <p>Durum: <span class="payment-status ${payment.status}">${getStatusText(payment.status)}</span></p>
            <p>Tarih: ${formatDate(payment.created_at)}</p>
        </div>
    `).join('');
}

async function loadUsers() {
    try {
        const search = document.getElementById('user-search')?.value || '';
        const status = document.getElementById('user-status-filter')?.value || '';
        
        const params = new URLSearchParams({
            page: currentPage,
            limit: 20,
            ...(search && { search }),
            ...(status && { status })
        });
        
        const response = await apiCall(`/api/admin/users?${params}`);
        renderUsers(response.users);
        renderPagination(response.pagination, 'users');
    } catch (error) {
        console.error('Failed to load users:', error);
        showNotification('Kullanıcılar yüklenemedi', 'error');
    }
}

function renderUsers(users) {
    const container = document.getElementById('users-table-body');
    if (!container) return;
    
    if (users.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted">
                    Kullanıcı bulunamadı.
                </td>
            </tr>
        `;
        return;
    }
    
    container.innerHTML = users.map(user => `
        <tr>
            <td>
                <div class="user-info-cell">
                    <div class="user-avatar">
                        ${user.first_name.charAt(0)}${user.last_name.charAt(0)}
                    </div>
                    <div class="user-details">
                        <h4>${user.first_name} ${user.last_name}</h4>
                        <p>${user.email}</p>
                    </div>
                </div>
            </td>
            <td>${user.email}</td>
            <td>
                <span class="status-badge ${user.is_active ? 'active' : 'inactive'}">
                    ${user.is_active ? 'Aktif' : 'Pasif'}
                </span>
                ${user.is_admin ? '<span class="status-badge admin">Admin</span>' : ''}
            </td>
            <td>${formatDate(user.created_at)}</td>
            <td>${user.last_login ? formatDate(user.last_login) : 'Hiç giriş yapmamış'}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view" onclick="viewUserDetails(${user.id})" title="Detayları Gör">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn edit" onclick="editUser(${user.id})" title="Düzenle">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${!user.is_admin ? `
                        <button class="action-btn delete" onclick="deleteUser(${user.id})" title="Sil">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

async function loadPackages() {
    try {
        const response = await apiCall('/api/admin/packages');
        renderAdminPackages(response);
    } catch (error) {
        console.error('Failed to load packages:', error);
        showNotification('Paketler yüklenemedi', 'error');
    }
}

function renderAdminPackages(packages) {
    const container = document.getElementById('admin-packages-grid');
    if (!container) return;
    
    if (packages.length === 0) {
        container.innerHTML = `
            <div class="text-center">
                <i class="fas fa-box" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                <h3>Henüz paket yok</h3>
                <p>İlk paketinizi oluşturmak için yukarıdaki butona tıklayın.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = packages.map(pkg => `
        <div class="package-card">
            <h3>${pkg.name}</h3>
            <p>${pkg.description}</p>
            <div class="package-details">
                <p><strong>Fiyat:</strong> ${formatPrice(pkg.price)}</p>
                <p><strong>Durum:</strong> 
                    <span class="status-badge ${pkg.is_active ? 'active' : 'inactive'}">
                        ${pkg.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                </p>
                <p><strong>Oluşturulma:</strong> ${formatDate(pkg.created_at)}</p>
            </div>
            <div class="package-actions">
                <button class="btn btn-sm btn-outline" onclick="editPackage(${pkg.id})">
                    <i class="fas fa-edit"></i> Düzenle
                </button>
                <button class="btn btn-sm btn-outline" onclick="deletePackage(${pkg.id})">
                    <i class="fas fa-trash"></i> Sil
                </button>
            </div>
        </div>
    `).join('');
}

async function loadPayments() {
    try {
        const search = document.getElementById('payment-search')?.value || '';
        const status = document.getElementById('payment-status-filter')?.value || '';
        
        const params = new URLSearchParams({
            page: currentPage,
            limit: 20,
            ...(search && { search }),
            ...(status && { status })
        });
        
        const response = await apiCall(`/api/admin/payments?${params}`);
        renderAdminPayments(response.payments);
        renderPagination(response.pagination, 'payments');
    } catch (error) {
        console.error('Failed to load payments:', error);
        showNotification('Ödemeler yüklenemedi', 'error');
    }
}

function renderAdminPayments(payments) {
    const container = document.getElementById('payments-table-body');
    if (!container) return;
    
    if (payments.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted">
                    Ödeme bulunamadı.
                </td>
            </tr>
        `;
        return;
    }
    
    container.innerHTML = payments.map(payment => `
        <tr>
            <td>
                <div class="user-info-cell">
                    <div class="user-avatar">
                        ${payment.first_name.charAt(0)}${payment.last_name.charAt(0)}
                    </div>
                    <div class="user-details">
                        <h4>${payment.first_name} ${payment.last_name}</h4>
                        <p>${payment.email}</p>
                    </div>
                </div>
            </td>
            <td>${payment.package_name}</td>
            <td>${formatPrice(payment.amount)}</td>
            <td>
                <span class="payment-status ${payment.status}">
                    ${getStatusText(payment.status)}
                </span>
            </td>
            <td>${formatDate(payment.created_at)}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view" onclick="viewPaymentDetails('${payment.payment_reference}')" title="Detayları Gör">
                        <i class="fas fa-eye"></i>
                    </button>
                    <select onchange="updatePaymentStatus('${payment.payment_reference}', this.value)">
                        <option value="pending" ${payment.status === 'pending' ? 'selected' : ''}>Bekleyen</option>
                        <option value="completed" ${payment.status === 'completed' ? 'selected' : ''}>Tamamlandı</option>
                        <option value="failed" ${payment.status === 'failed' ? 'selected' : ''}>Başarısız</option>
                    </select>
                </div>
            </td>
        </tr>
    `).join('');
}

async function loadNotifications() {
    try {
        const response = await apiCall('/api/notifications/admin/all');
        renderAdminNotifications(response.notifications);
    } catch (error) {
        console.error('Failed to load notifications:', error);
        showNotification('Bildirimler yüklenemedi', 'error');
    }
}

function renderAdminNotifications(notifications) {
    const container = document.getElementById('admin-notifications-container');
    if (!container) return;
    
    if (notifications.length === 0) {
        container.innerHTML = `
            <div class="text-center">
                <i class="fas fa-bell" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                <h3>Henüz bildirim yok</h3>
                <p>Gönderilen bildirimler burada görünecek.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = notifications.map(notification => `
        <div class="notification-item">
            <div class="notification-header">
                <h4 class="notification-title">${notification.title}</h4>
                <span class="notification-time">${formatDate(notification.created_at)}</span>
            </div>
            <p class="notification-message">${notification.message}</p>
            <div class="notification-meta">
                <span class="notification-type ${notification.type}">
                    ${getNotificationTypeText(notification.type)}
                </span>
                <span class="notification-recipient">
                    ${notification.is_global ? 'Tüm kullanıcılar' : notification.email || 'Bilinmeyen kullanıcı'}
                </span>
                <span class="notification-read-status">
                    ${notification.is_read ? 'Okundu' : 'Okunmadı'}
                </span>
            </div>
            <div class="notification-actions">
                <button class="btn btn-sm btn-outline" onclick="deleteNotification(${notification.id})">
                    <i class="fas fa-trash"></i> Sil
                </button>
            </div>
        </div>
    `).join('');
}

async function loadAnalytics() {
    try {
        const period = document.getElementById('analytics-period')?.value || '30';
        const response = await apiCall(`/api/analytics/dashboard?period=${period}`);
        
        updateUserAnalytics(response.users);
        updatePaymentAnalytics(response.payments);
        updatePackageAnalytics(response.packages);
        updateActivityAnalytics(response.activities);
    } catch (error) {
        console.error('Failed to load analytics:', error);
        showNotification('Analitikler yüklenemedi', 'error');
    }
}

function updateUserAnalytics(data) {
    const container = document.getElementById('user-analytics');
    if (!container) return;
    
    container.innerHTML = `
        <div class="analytics-item">
            <span class="analytics-item-label">Toplam Kullanıcı</span>
            <span class="analytics-item-value">${data.total}</span>
        </div>
        <div class="analytics-item">
            <span class="analytics-item-label">Yeni Kullanıcı</span>
            <span class="analytics-item-value">${data.new}</span>
        </div>
        <div class="analytics-item">
            <span class="analytics-item-label">Aktif Kullanıcı</span>
            <span class="analytics-item-value">${data.active}</span>
        </div>
    `;
}

function updatePaymentAnalytics(data) {
    const container = document.getElementById('payment-analytics');
    if (!container) return;
    
    container.innerHTML = `
        <div class="analytics-item">
            <span class="analytics-item-label">Toplam Gelir</span>
            <span class="analytics-item-value">${formatPrice(data.revenue)}</span>
        </div>
        <div class="analytics-item">
            <span class="analytics-item-label">Toplam İşlem</span>
            <span class="analytics-item-value">${data.transactions}</span>
        </div>
        <div class="analytics-item">
            <span class="analytics-item-label">Bekleyen Ödeme</span>
            <span class="analytics-item-value">${data.pending}</span>
        </div>
    `;
}

function updatePackageAnalytics(data) {
    const container = document.getElementById('package-analytics');
    if (!container) return;
    
    container.innerHTML = `
        <div class="analytics-item">
            <span class="analytics-item-label">Toplam Paket</span>
            <span class="analytics-item-value">${data.total}</span>
        </div>
        <div class="analytics-item">
            <span class="analytics-item-label">Teslim Edilen</span>
            <span class="analytics-item-value">${data.delivered}</span>
        </div>
        <div class="analytics-item">
            <span class="analytics-item-label">Bekleyen Teslim</span>
            <span class="analytics-item-value">${data.pending}</span>
        </div>
    `;
}

function updateActivityAnalytics(data) {
    const container = document.getElementById('activity-analytics');
    if (!container) return;
    
    container.innerHTML = `
        <div class="analytics-item">
            <span class="analytics-item-label">Toplam Aktivite</span>
            <span class="analytics-item-value">${data.total}</span>
        </div>
        <div class="analytics-item">
            <span class="analytics-item-label">Benzersiz Kullanıcı</span>
            <span class="analytics-item-value">${data.uniqueUsers}</span>
        </div>
    `;
}

async function loadSettings() {
    try {
        const response = await apiCall('/api/admin/settings');
        renderSettings(response);
    } catch (error) {
        console.error('Failed to load settings:', error);
        showNotification('Ayarlar yüklenemedi', 'error');
    }
}

function renderSettings(settings) {
    const container = document.getElementById('settings-grid');
    if (!container) return;
    
    container.innerHTML = settings.map(setting => `
        <div class="setting-item">
            <label for="setting-${setting.key}">${setting.description || setting.key}</label>
            <input 
                type="text" 
                id="setting-${setting.key}" 
                name="${setting.key}" 
                value="${setting.value || ''}"
                data-original-value="${setting.value || ''}"
            >
        </div>
    `).join('');
}

async function loadLogs() {
    try {
        const type = document.getElementById('log-type-filter')?.value || '';
        const userId = document.getElementById('log-user-filter')?.value || '';
        
        const params = new URLSearchParams({
            page: currentPage,
            limit: 50,
            ...(type && { type }),
            ...(userId && { userId })
        });
        
        const response = await apiCall(`/api/admin/logs?${params}`);
        renderLogs(response.logs);
        renderPagination(response.pagination, 'logs');
    } catch (error) {
        console.error('Failed to load logs:', error);
        showNotification('Loglar yüklenemedi', 'error');
    }
}

function renderLogs(logs) {
    const container = document.getElementById('logs-container');
    if (!container) return;
    
    if (logs.length === 0) {
        container.innerHTML = `
            <div class="text-center">
                <i class="fas fa-list" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                <h3>Henüz log yok</h3>
                <p>Sistem logları burada görünecek.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = logs.map(log => `
        <div class="log-item">
            <div class="log-icon ${log.activity_type}">
                <i class="fas fa-${getActivityIcon(log.activity_type)}"></i>
            </div>
            <div class="log-content">
                <h4>${log.description}</h4>
                <p>${log.email || 'Sistem'} - ${log.ip_address} - ${log.user_agent}</p>
            </div>
            <div class="log-time">${formatDate(log.created_at)}</div>
        </div>
    `).join('');
}

// Modal Functions
function showCreatePackageModal() {
    closeAllModals();
    document.getElementById('create-package-modal').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function showSendNotificationModal() {
    closeAllModals();
    document.getElementById('send-notification-modal').classList.add('show');
    document.body.style.overflow = 'hidden';
    loadUsersForNotification();
}

async function loadUsersForNotification() {
    try {
        const response = await apiCall('/api/admin/users?limit=100');
        const select = document.getElementById('notification-user');
        if (select) {
            select.innerHTML = '<option value="">Kullanıcı seçin...</option>' +
                response.users.map(user => 
                    `<option value="${user.id}">${user.first_name} ${user.last_name} (${user.email})</option>`
                ).join('');
        }
    } catch (error) {
        console.error('Failed to load users for notification:', error);
    }
}

// Form Handlers
async function handleCreatePackage(e) {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('package-name').value,
        description: document.getElementById('package-description').value,
        price: parseFloat(document.getElementById('package-price').value),
        questions: collectQuestions()
    };
    
    try {
        await apiCall('/api/pdf/admin/packages', {
            method: 'POST',
            body: JSON.stringify(formData)
        });
        
        showNotification('Paket başarıyla oluşturuldu', 'success');
        closeModal('create-package-modal');
        document.getElementById('create-package-form').reset();
        loadPackages();
        
    } catch (error) {
        console.error('Create package failed:', error);
        showNotification('Paket oluşturulamadı', 'error');
    }
}

async function handleSendNotification(e) {
    e.preventDefault();
    
    const isGlobal = document.getElementById('is-global-notification').checked;
    const formData = {
        title: document.getElementById('notification-title').value,
        message: document.getElementById('notification-message').value,
        type: document.getElementById('notification-type').value,
        isGlobal: isGlobal,
        ...(isGlobal ? {} : { userId: parseInt(document.getElementById('notification-user').value) })
    };
    
    try {
        await apiCall('/api/notifications/admin/send', {
            method: 'POST',
            body: JSON.stringify(formData)
        });
        
        showNotification('Bildirim başarıyla gönderildi', 'success');
        closeModal('send-notification-modal');
        document.getElementById('send-notification-form').reset();
        loadNotifications();
        
    } catch (error) {
        console.error('Send notification failed:', error);
        showNotification('Bildirim gönderilemedi', 'error');
    }
}

async function handleSaveSettings(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const settings = Array.from(formData.entries()).map(([key, value]) => ({ key, value }));
    
    try {
        await apiCall('/api/admin/settings', {
            method: 'PUT',
            body: JSON.stringify({ settings })
        });
        
        showNotification('Ayarlar başarıyla kaydedildi', 'success');
        
    } catch (error) {
        console.error('Save settings failed:', error);
        showNotification('Ayarlar kaydedilemedi', 'error');
    }
}

// Action Functions
async function updatePaymentStatus(paymentReference, status) {
    try {
        await apiCall(`/api/admin/payments/${paymentReference}`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        
        showNotification('Ödeme durumu güncellendi', 'success');
        loadPayments();
        
    } catch (error) {
        console.error('Update payment status failed:', error);
        showNotification('Ödeme durumu güncellenemedi', 'error');
    }
}

async function deleteUser(userId) {
    if (!confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) return;
    
    try {
        await apiCall(`/api/admin/users/${userId}`, {
            method: 'DELETE'
        });
        
        showNotification('Kullanıcı başarıyla silindi', 'success');
        loadUsers();
        
    } catch (error) {
        console.error('Delete user failed:', error);
        showNotification('Kullanıcı silinemedi', 'error');
    }
}

async function deletePackage(packageId) {
    if (!confirm('Bu paketi silmek istediğinizden emin misiniz?')) return;
    
    try {
        await apiCall(`/api/pdf/admin/packages/${packageId}`, {
            method: 'DELETE'
        });
        
        showNotification('Paket başarıyla silindi', 'success');
        loadPackages();
        
    } catch (error) {
        console.error('Delete package failed:', error);
        showNotification('Paket silinemedi', 'error');
    }
}

async function deleteNotification(notificationId) {
    if (!confirm('Bu bildirimi silmek istediğinizden emin misiniz?')) return;
    
    try {
        await apiCall(`/api/notifications/admin/${notificationId}`, {
            method: 'DELETE'
        });
        
        showNotification('Bildirim başarıyla silindi', 'success');
        loadNotifications();
        
    } catch (error) {
        console.error('Delete notification failed:', error);
        showNotification('Bildirim silinemedi', 'error');
    }
}

// Helper Functions
function collectQuestions() {
    const questions = [];
    const questionItems = document.querySelectorAll('.question-item');
    
    questionItems.forEach((item, index) => {
        const questionText = item.querySelector('.question-text input').value;
        const options = Array.from(item.querySelectorAll('.option-item input[type="text"]')).map(input => input.value);
        const correctIndex = Array.from(item.querySelectorAll('.option-item input[type="radio"]')).findIndex(radio => radio.checked);
        
        if (questionText && options.length >= 2 && correctIndex >= 0) {
            questions.push({
                id: index + 1,
                question: questionText,
                options: options,
                correct: correctIndex
            });
        }
    });
    
    return questions;
}

function addQuestion() {
    const container = document.getElementById('questions-container');
    const questionCount = container.children.length;
    
    const questionHtml = `
        <div class="question-item">
            <div class="question-header">
                <span class="question-number">Soru ${questionCount + 1}</span>
                <button type="button" class="remove-question" onclick="removeQuestion(this)">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="question-text">
                <input type="text" placeholder="Soru metnini girin" required>
            </div>
            <div class="options">
                <div class="option-item">
                    <input type="radio" name="correct-${questionCount}" value="0" required>
                    <input type="text" placeholder="Seçenek 1" required>
                </div>
                <div class="option-item">
                    <input type="radio" name="correct-${questionCount}" value="1" required>
                    <input type="text" placeholder="Seçenek 2" required>
                </div>
                <div class="option-item">
                    <input type="radio" name="correct-${questionCount}" value="2" required>
                    <input type="text" placeholder="Seçenek 3" required>
                </div>
                <div class="option-item">
                    <input type="radio" name="correct-${questionCount}" value="3" required>
                    <input type="text" placeholder="Seçenek 4" required>
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', questionHtml);
}

function removeQuestion(button) {
    button.closest('.question-item').remove();
}

function getActivityIcon(activityType) {
    const iconMap = {
        'login': 'sign-in-alt',
        'register': 'user-plus',
        'payment': 'credit-card',
        'pdf_generated': 'file-pdf',
        'profile_updated': 'user-edit',
        'password_change': 'key'
    };
    return iconMap[activityType] || 'circle';
}

function renderPagination(pagination, type) {
    const container = document.getElementById(`${type}-pagination`);
    if (!container) return;
    
    const { page, pages, total } = pagination;
    
    let paginationHtml = '';
    
    // Previous button
    paginationHtml += `
        <button ${page <= 1 ? 'disabled' : ''} onclick="changePage(${page - 1}, '${type}')">
            <i class="fas fa-chevron-left"></i>
        </button>
    `;
    
    // Page numbers
    for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) {
        paginationHtml += `
            <button class="${i === page ? 'active' : ''}" onclick="changePage(${i}, '${type}')">
                ${i}
            </button>
        `;
    }
    
    // Next button
    paginationHtml += `
        <button ${page >= pages ? 'disabled' : ''} onclick="changePage(${page + 1}, '${type}')">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    container.innerHTML = paginationHtml;
}

function changePage(newPage, type) {
    currentPage = newPage;
    switch(type) {
        case 'users':
            loadUsers();
            break;
        case 'payments':
            loadPayments();
            break;
        case 'logs':
            loadLogs();
            break;
    }
}

function exportAnalytics() {
    const period = document.getElementById('analytics-period')?.value || '30';
    window.open(`/api/analytics/export?type=all&period=${period}`, '_blank');
}

// Export functions for global access
window.showCreatePackageModal = showCreatePackageModal;
window.showSendNotificationModal = showSendNotificationModal;
window.addQuestion = addQuestion;
window.removeQuestion = removeQuestion;
window.updatePaymentStatus = updatePaymentStatus;
window.deleteUser = deleteUser;
window.deletePackage = deletePackage;
window.deleteNotification = deleteNotification;
window.changePage = changePage;
window.exportAnalytics = exportAnalytics;

