// API 基础配置
const API_BASE_URL = '/api';
let authToken = localStorage.getItem('adminToken');
let currentPage = 'dashboard';
let currentPagination = {
    users: { page: 1, limit: 50 },
    payments: { page: 1, limit: 50 },
    games: { page: 1, limit: 50 },
    spins: { page: 1, limit: 50 },
    payouts: { page: 1, limit: 50 }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initNavigation();
    loadDashboard();
});

// 检查认证
function checkAuth() {
    if (!authToken) {
        window.location.href = '/admin/login.html';
        return;
    }
}

// 显示加载动画
function showLoading() {
    document.getElementById('loading-overlay').classList.add('show');
}

// 隐藏加载动画
function hideLoading() {
    document.getElementById('loading-overlay').classList.remove('show');
}

// API 请求封装
async function apiRequest(endpoint, options = {}) {
    try {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        if (response.status === 401) {
            localStorage.removeItem('adminToken');
            window.location.href = '/admin/login.html';
            return null;
        }

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || '请求失败');
        }

        return data;
    } catch (error) {
        console.error('API 请求错误:', error);
        alert('操作失败: ' + error.message);
        return null;
    }
}

// 导航初始化
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.getAttribute('data-page');
            navigateTo(page);
        });
    });
}

// 页面导航
function navigateTo(page) {
    currentPage = page;
    
    // 更新导航激活状态
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-page') === page) {
            item.classList.add('active');
        }
    });
    
    // 切换页面显示
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    document.getElementById(`${page}-page`).classList.add('active');
    
    // 加载对应数据
    switch(page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'users':
            loadUsers();
            break;
        case 'payments':
            loadPayments();
            break;
        case 'games':
            loadGames();
            break;
        case 'spins':
            loadSpins();
            break;
        case 'payouts':
            loadPayouts();
            break;
    }
}

// 加载仪表板数据
async function loadDashboard() {
    showLoading();
    
    const data = await apiRequest('/admin/dashboard/stats');
    
    if (data && data.success) {
        const stats = data.data;
        
        // 更新统计数据
        document.getElementById('total-users').textContent = formatNumber(stats.total_users);
        document.getElementById('users-24h').textContent = formatNumber(stats.users_last_24h);
        document.getElementById('total-revenue').textContent = formatCurrency(stats.total_revenue);
        document.getElementById('payments-7d').textContent = formatNumber(stats.payments_last_7d);
        document.getElementById('total-games').textContent = formatNumber(stats.total_games_played);
        document.getElementById('total-spins').textContent = formatNumber(stats.total_spins);
        document.getElementById('pending-payouts').textContent = formatNumber(stats.pending_payouts);
        document.getElementById('pending-amount').textContent = formatCurrency(stats.pending_payout_amount);
    }
    
    hideLoading();
}

// 加载用户列表
async function loadUsers(page = 1) {
    showLoading();
    
    currentPagination.users.page = page;
    const { page: p, limit } = currentPagination.users;
    
    const data = await apiRequest(`/admin/users/list?page=${p}&limit=${limit}`);
    
    if (data && data.success) {
        renderUsersTable(data.data.users);
        renderPagination('users', data.data.pagination);
    }
    
    hideLoading();
}

// 渲染用户表格
function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center">暂无数据</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.telegram_id}</td>
            <td>${escapeHtml(user.username || '-')}</td>
            <td>${escapeHtml(user.first_name || '-')}</td>
            <td>${formatCurrency(user.balance)}</td>
            <td>${user.available_spins}</td>
            <td>${user.invite_count}</td>
            <td>${user.total_paid_plays}</td>
            <td>${user.total_free_plays}</td>
            <td>${formatDate(user.created_at)}</td>
            <td>
                <span class="status-badge ${user.is_banned ? 'status-banned' : 'status-active'}">
                    ${user.is_banned ? '已封禁' : '正常'}
                </span>
            </td>
            <td>
                <button class="btn btn-danger btn-small" onclick="banUser('${user.id}', ${!user.is_banned})">
                    ${user.is_banned ? '解封' : '封禁'}
                </button>
            </td>
        </tr>
    `).join('');
}

// 加载支付记录
async function loadPayments(page = 1) {
    showLoading();
    
    currentPagination.payments.page = page;
    const { page: p, limit } = currentPagination.payments;
    
    const data = await apiRequest(`/admin/payments/list?page=${p}&limit=${limit}`);
    
    if (data && data.success) {
        renderPaymentsTable(data.data.payments);
        renderPagination('payments', data.data.pagination);
    }
    
    hideLoading();
}

// 渲染支付表格
function renderPaymentsTable(payments) {
    const tbody = document.getElementById('payments-table-body');
    
    if (payments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">暂无数据</td></tr>';
        return;
    }
    
    tbody.innerHTML = payments.map(payment => `
        <tr>
            <td>${payment.id}</td>
            <td>${escapeHtml(payment.provider_tx_id || '-')}</td>
            <td>${escapeHtml(payment.username || payment.first_name || '-')}</td>
            <td>${formatCurrency(payment.amount)}</td>
            <td>${payment.currency}</td>
            <td>
                <span class="status-badge status-${payment.status}">
                    ${getStatusText(payment.status)}
                </span>
            </td>
            <td>
                <span class="status-badge ${payment.used ? 'status-success' : 'status-pending'}">
                    ${payment.used ? '已使用' : '未使用'}
                </span>
            </td>
            <td>${formatDate(payment.created_at)}</td>
        </tr>
    `).join('');
}

// 加载游戏记录
async function loadGames(page = 1) {
    showLoading();
    
    currentPagination.games.page = page;
    const { page: p, limit } = currentPagination.games;
    
    const data = await apiRequest(`/admin/games/list?page=${p}&limit=${limit}`);
    
    if (data && data.success) {
        renderGamesTable(data.data.games);
        renderPagination('games', data.data.pagination);
    }
    
    hideLoading();
}

// 渲染游戏表格
function renderGamesTable(games) {
    const tbody = document.getElementById('games-table-body');
    
    if (games.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">暂无数据</td></tr>';
        return;
    }
    
    tbody.innerHTML = games.map(game => `
        <tr>
            <td>${game.id}</td>
            <td>${escapeHtml(game.username || game.first_name || '-')}</td>
            <td>
                <span class="status-badge ${game.game_mode === 'paid' ? 'status-success' : 'status-pending'}">
                    ${game.game_mode === 'paid' ? '付费模式' : '免费模式'}
                </span>
            </td>
            <td>
                <span class="status-badge ${game.completed ? 'status-success' : 'status-pending'}">
                    ${game.completed ? '已完成' : '进行中'}
                </span>
            </td>
            <td>${game.earned_spin ? '是' : '否'}</td>
            <td>${formatDate(game.created_at)}</td>
            <td>${game.completed_at ? formatDate(game.completed_at) : '-'}</td>
        </tr>
    `).join('');
}

// 加载抽奖记录
async function loadSpins(page = 1) {
    showLoading();
    
    currentPagination.spins.page = page;
    const { page: p, limit } = currentPagination.spins;
    
    const data = await apiRequest(`/admin/spins/list?page=${p}&limit=${limit}`);
    
    if (data && data.success) {
        renderSpinsTable(data.data.spins);
        renderPagination('spins', data.data.pagination);
    }
    
    hideLoading();
}

// 渲染抽奖表格
function renderSpinsTable(spins) {
    const tbody = document.getElementById('spins-table-body');
    
    if (spins.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">暂无数据</td></tr>';
        return;
    }
    
    tbody.innerHTML = spins.map(spin => `
        <tr>
            <td>${spin.id}</td>
            <td>${escapeHtml(spin.username || spin.first_name || '-')}</td>
            <td><strong>${formatCurrency(spin.prize_amount)}</strong></td>
            <td>
                <span class="status-badge status-${spin.status}">
                    ${getStatusText(spin.status)}
                </span>
            </td>
            <td>${spin.requires_manual_review ? '是' : '否'}</td>
            <td>${spin.reviewed ? '是' : '否'}</td>
            <td>${formatDate(spin.created_at)}</td>
            <td>${spin.completed_at ? formatDate(spin.completed_at) : '-'}</td>
        </tr>
    `).join('');
}

// 加载提现申请
async function loadPayouts(page = 1) {
    showLoading();
    
    currentPagination.payouts.page = page;
    const { page: p, limit } = currentPagination.payouts;
    const status = document.getElementById('payout-status-filter').value;
    
    let url = `/admin/payouts/list?page=${p}&limit=${limit}`;
    if (status) {
        url += `&status=${status}`;
    }
    
    const data = await apiRequest(url);
    
    if (data && data.success) {
        renderPayoutsTable(data.data.payouts);
        renderPagination('payouts', data.data.pagination);
    }
    
    hideLoading();
}

// 渲染提现表格
function renderPayoutsTable(payouts) {
    const tbody = document.getElementById('payouts-table-body');
    
    if (payouts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center">暂无数据</td></tr>';
        return;
    }
    
    tbody.innerHTML = payouts.map(payout => `
        <tr>
            <td>${payout.id}</td>
            <td>${escapeHtml(payout.username || payout.first_name || '-')}</td>
            <td>${formatCurrency(payout.amount)}</td>
            <td>${formatCurrency(payout.fee)}</td>
            <td><strong>${formatCurrency(payout.net_amount)}</strong></td>
            <td>${payout.withdrawal_method}</td>
            <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis;">
                ${escapeHtml(payout.withdrawal_address)}
            </td>
            <td>
                <span class="status-badge status-${payout.status}">
                    ${getStatusText(payout.status)}
                </span>
            </td>
            <td>${formatDate(payout.created_at)}</td>
            <td>
                ${payout.status === 'pending' ? 
                    `<button class="btn btn-success btn-small" onclick="showPayoutModal('${payout.id}')">处理</button>` : 
                    '-'}
            </td>
        </tr>
    `).join('');
}

// 显示提现操作模态框
function showPayoutModal(payoutId) {
    const modal = document.getElementById('payout-modal');
    const modalBody = document.getElementById('payout-modal-body');
    
    modalBody.innerHTML = `
        <div class="form-group">
            <label>提现申请 ID:</label>
            <input type="text" value="${payoutId}" readonly>
        </div>
        <div class="form-group">
            <label>操作:</label>
            <select id="payout-action">
                <option value="approve">批准</option>
                <option value="reject">拒绝</option>
            </select>
        </div>
        <div class="form-group">
            <label>备注:</label>
            <textarea id="payout-notes" placeholder="请输入备注信息..."></textarea>
        </div>
        <div class="modal-footer">
            <button class="btn btn-primary" onclick="handlePayoutAction('${payoutId}')">确认</button>
            <button class="btn" onclick="closePayoutModal()">取消</button>
        </div>
    `;
    
    modal.classList.add('show');
}

// 关闭提现模态框
function closePayoutModal() {
    document.getElementById('payout-modal').classList.remove('show');
}

// 处理提现操作
async function handlePayoutAction(payoutId) {
    const action = document.getElementById('payout-action').value;
    const notes = document.getElementById('payout-notes').value;
    
    if (action === 'approve') {
        const result = await apiRequest('/admin/payouts/approve', {
            method: 'POST',
            body: JSON.stringify({ requestId: payoutId })
        });
        
        if (result && result.success) {
            alert('提现申请已批准');
            closePayoutModal();
            loadPayouts(currentPagination.payouts.page);
        }
    } else if (action === 'reject') {
        if (!notes) {
            alert('拒绝操作需要填写原因');
            return;
        }
        
        // 这里需要添加拒绝的 API
        alert('拒绝功能暂未实现');
    }
}

// 封禁/解封用户
async function banUser(userId, shouldBan) {
    const reason = shouldBan ? prompt('请输入封禁原因:') : null;
    
    if (shouldBan && !reason) {
        return;
    }
    
    const result = await apiRequest('/admin/users/ban', {
        method: 'POST',
        body: JSON.stringify({ userId, reason })
    });
    
    if (result && result.success) {
        alert(shouldBan ? '用户已封禁' : '用户已解封');
        loadUsers(currentPagination.users.page);
    }
}

// 渲染分页
function renderPagination(type, pagination) {
    const container = document.getElementById(`${type}-pagination`);
    const { page, pages, total } = pagination;
    
    container.innerHTML = `
        <button ${page <= 1 ? 'disabled' : ''} onclick="load${capitalizeFirst(type)}(${page - 1})">
            上一页
        </button>
        <span class="page-info">
            第 ${page} / ${pages} 页 (共 ${total} 条)
        </span>
        <button ${page >= pages ? 'disabled' : ''} onclick="load${capitalizeFirst(type)}(${page + 1})">
            下一页
        </button>
    `;
}

// 退出登录
function logout() {
    if (confirm('确定要退出登录吗?')) {
        localStorage.removeItem('adminToken');
        window.location.href = '/admin/login.html';
    }
}

// 工具函数
function formatNumber(num) {
    return new Intl.NumberFormat('zh-CN').format(num || 0);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount || 0);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getStatusText(status) {
    const statusMap = {
        'pending': '待处理',
        'approved': '已批准',
        'processing': '处理中',
        'completed': '已完成',
        'rejected': '已拒绝',
        'success': '成功',
        'failed': '失败'
    };
    return statusMap[status] || status;
}
