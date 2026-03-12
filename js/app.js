// ============================================================
// Online Billing System - Main Application Controller
// ============================================================

class App {
    constructor() {
        this.currentPage = null;
        this.currentUser = null;
        this.db = db; // global database instance

        // Module instances
        this.auth = new AuthModule(this.db);
        this.accounting = new AccountingModule(this.db);
        this.inventory = new InventoryModule(this.db);
        this.taxation = new TaxationModule(this.db);
        this.payroll = new PayrollModule(this.db);
        this.banking = new BankingModule(this.db);
        this.reports = new ReportsModule(this.db);
        this.sync = new SyncModule(this.db);
    }

    async init() {
        await this.db.init();
        await this.auth.initDefaultAdmin();

        const session = this.auth.getSession();
        if (session) {
            this.currentUser = session;
            this.showApp();
            this.navigateTo('dashboard');
        } else {
            this.showLogin();
        }

        this.setupGlobalEvents();
    }

    // ---- Authentication ----

    showLogin() {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
        document.getElementById('loginError').textContent = '';
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
        document.getElementById('loginUsername').focus();
    }

    showApp() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appContainer').style.display = 'flex';
        this.updateUserInfo();
        this.updateDateTime();
        this.dateTimeInterval = setInterval(() => this.updateDateTime(), 60000);
    }

    async handleLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errorEl = document.getElementById('loginError');

        if (!username || !password) {
            errorEl.textContent = 'Please enter both username and password';
            return;
        }

        const result = await this.auth.login(username, password);
        if (result.success) {
            this.currentUser = result.user;
            this.showApp();
            this.navigateTo('dashboard');
            this.showToast(`Welcome back, ${result.user.fullName || result.user.username}!`, 'success');
        } else {
            errorEl.textContent = result.message;
        }
    }

    logout() {
        if (!confirm('Are you sure you want to logout?')) return;
        this.auth.logout();
        this.currentUser = null;
        if (this.dateTimeInterval) clearInterval(this.dateTimeInterval);
        this.showLogin();
    }

    updateUserInfo() {
        const el = document.getElementById('currentUserName');
        if (el && this.currentUser) {
            el.textContent = this.currentUser.fullName || this.currentUser.username;
        }
        const roleEl = document.getElementById('currentUserRole');
        if (roleEl && this.currentUser) {
            roleEl.textContent = this.currentUser.role || '';
        }
    }

    updateDateTime() {
        const el = document.getElementById('currentDateTime');
        if (el) {
            const now = new Date();
            el.textContent = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
                now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        }
    }

    // ---- Navigation ----

    navigateTo(page) {
        this.currentPage = page;

        // Update sidebar active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        // Update page title
        const titles = {
            'dashboard': 'Dashboard',
            'accounting': 'Accounting',
            'inventory': 'Inventory Management',
            'taxation': 'GST & Taxation',
            'payroll': 'Payroll Management',
            'banking': 'Banking',
            'reports': 'MIS Reports & Analysis',
            'sync': 'Data Synchronization',
            'users': 'Security & User Management'
        };
        document.getElementById('pageTitle').textContent = titles[page] || page;

        // Render page content
        const mainContent = document.getElementById('mainContent');
        switch (page) {
            case 'dashboard':
                mainContent.innerHTML = this.renderDashboard();
                this.loadDashboard();
                break;
            case 'accounting':
                mainContent.innerHTML = this.accounting.renderPage();
                this.accounting.loadData();
                break;
            case 'inventory':
                mainContent.innerHTML = this.inventory.renderPage();
                this.inventory.loadData();
                break;
            case 'taxation':
                mainContent.innerHTML = this.taxation.renderPage();
                this.taxation.loadData();
                break;
            case 'payroll':
                mainContent.innerHTML = this.payroll.renderPage();
                this.payroll.loadData();
                break;
            case 'banking':
                mainContent.innerHTML = this.banking.renderPage();
                this.banking.loadData();
                break;
            case 'reports':
                mainContent.innerHTML = this.reports.renderPage();
                this.reports.loadData();
                break;
            case 'sync':
                mainContent.innerHTML = this.sync.renderPage();
                this.sync.loadData();
                break;
            case 'users':
                mainContent.innerHTML = this.auth.renderPage();
                this.auth.loadData();
                break;
        }

        this.setupTabEvents();
    }

    // ---- Dashboard ----

    renderDashboard() {
        return `
        <div id="dashboardContent">
            <div class="stats-grid" id="dashStats"></div>
            <div class="dashboard-grid" id="dashDetails"></div>
        </div>`;
    }

    async loadDashboard() {
        const statsEl = document.getElementById('dashStats');
        const detailsEl = document.getElementById('dashDetails');
        if (!statsEl || !detailsEl) return;

        const [ledgers, vouchers, stockItems, employees, bankAccounts, taxEntries] = await Promise.all([
            this.db.getAll('ledgers'),
            this.db.getAll('vouchers'),
            this.db.getAll('stockItems'),
            this.db.getAll('employees'),
            this.db.getAll('bankAccounts'),
            this.db.getAll('taxEntries')
        ]);

        const bankBalance = bankAccounts.reduce((s, a) => s + (a.balance || 0), 0);
        const stockValue = stockItems.reduce((s, i) => s + ((i.currentStock || 0) * (i.rate || 0)), 0);

        // Sales & purchase totals from vouchers
        let salesTotal = 0, purchaseTotal = 0;
        vouchers.forEach(v => {
            if (v.type === 'Sales') {
                salesTotal += v.entries ? v.entries.reduce((s, e) => e.type === 'debit' ? s + e.amount : s, 0) : 0;
            } else if (v.type === 'Purchase') {
                purchaseTotal += v.entries ? v.entries.reduce((s, e) => e.type === 'debit' ? s + e.amount : s, 0) : 0;
            }
        });

        statsEl.innerHTML = `
            <div class="stat-card" onclick="app.navigateTo('accounting')">
                <div class="stat-icon blue">📒</div>
                <div class="stat-info"><h4>${ledgers.length}</h4><p>Ledgers</p></div>
            </div>
            <div class="stat-card" onclick="app.navigateTo('accounting')">
                <div class="stat-icon green">📝</div>
                <div class="stat-info"><h4>${vouchers.length}</h4><p>Vouchers</p></div>
            </div>
            <div class="stat-card" onclick="app.navigateTo('banking')">
                <div class="stat-icon blue">🏦</div>
                <div class="stat-info"><h4>₹${this.formatNumber(bankBalance)}</h4><p>Bank Balance</p></div>
            </div>
            <div class="stat-card" onclick="app.navigateTo('inventory')">
                <div class="stat-icon orange">📦</div>
                <div class="stat-info"><h4>₹${this.formatNumber(stockValue)}</h4><p>Stock Value</p></div>
            </div>
            <div class="stat-card" onclick="app.navigateTo('accounting')">
                <div class="stat-icon green">💰</div>
                <div class="stat-info"><h4>₹${this.formatNumber(salesTotal)}</h4><p>Total Sales</p></div>
            </div>
            <div class="stat-card" onclick="app.navigateTo('accounting')">
                <div class="stat-icon red">🛒</div>
                <div class="stat-info"><h4>₹${this.formatNumber(purchaseTotal)}</h4><p>Total Purchases</p></div>
            </div>
            <div class="stat-card" onclick="app.navigateTo('payroll')">
                <div class="stat-icon blue">👥</div>
                <div class="stat-info"><h4>${employees.length}</h4><p>Employees</p></div>
            </div>
            <div class="stat-card" onclick="app.navigateTo('taxation')">
                <div class="stat-icon orange">📋</div>
                <div class="stat-info"><h4>${taxEntries.length}</h4><p>Tax Entries</p></div>
            </div>`;

        // Recent Vouchers & Low Stock
        const recentVouchers = vouchers.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
        const lowStock = stockItems.filter(i => (i.currentStock || 0) <= (i.reorderLevel || 0) && (i.reorderLevel || 0) > 0);

        detailsEl.innerHTML = `
            <div class="card">
                <div class="card-header"><h3>Recent Vouchers</h3><a href="#" onclick="app.navigateTo('accounting');return false" class="text-link">View All →</a></div>
                <div class="card-body">
                    ${recentVouchers.length ? `<table class="data-table"><thead><tr><th>No.</th><th>Date</th><th>Type</th><th class="amount">Amount</th></tr></thead><tbody>
                        ${recentVouchers.map(v => {
                            const total = v.entries ? v.entries.reduce((s, e) => e.type === 'debit' ? s + e.amount : s, 0) : 0;
                            return `<tr><td>${this.escapeHtml(v.voucherNo)}</td><td>${v.date}</td><td><span class="badge badge-info">${this.escapeHtml(v.type)}</span></td><td class="amount">₹${this.formatNumber(total)}</td></tr>`;
                        }).join('')}</tbody></table>` : '<p class="text-muted">No vouchers yet. Start by creating ledgers and vouchers in Accounting.</p>'}
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h3>Quick Actions</h3></div>
                <div class="card-body">
                    <div class="quick-actions">
                        <button class="btn btn-primary" onclick="app.navigateTo('accounting')">📒 New Voucher</button>
                        <button class="btn btn-secondary" onclick="app.navigateTo('inventory')">📦 Add Stock</button>
                        <button class="btn btn-outline" onclick="app.navigateTo('banking')">🏦 Bank Transaction</button>
                        <button class="btn btn-outline" onclick="app.navigateTo('taxation')">📋 GST Entry</button>
                        <button class="btn btn-outline" onclick="app.navigateTo('payroll')">💼 Process Salary</button>
                        <button class="btn btn-outline" onclick="app.navigateTo('reports')">📊 View Reports</button>
                    </div>
                    ${lowStock.length ? `
                    <div class="mt-2">
                        <h4 class="text-danger">⚠️ Low Stock Alerts (${lowStock.length})</h4>
                        <table class="data-table"><tbody>${lowStock.slice(0, 5).map(i =>
                            `<tr><td>${this.escapeHtml(i.name)}</td><td class="amount text-danger">${i.currentStock} ${this.escapeHtml(i.unit || '')}</td><td class="amount">Reorder: ${i.reorderLevel}</td></tr>`
                        ).join('')}</tbody></table>
                    </div>` : ''}
                </div>
            </div>`;
    }

    // ---- Tab system ----

    setupTabEvents() {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabId = e.target.dataset.tab;
                if (!tabId) return;

                // Deactivate siblings
                e.target.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');

                // Show/hide tab content
                const parent = e.target.closest('.tab-content')?.parentElement || e.target.parentElement.parentElement;
                parent.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
                const target = document.getElementById(tabId);
                if (target) target.classList.add('active');

                // Load tab data if needed
                this.onTabChange(tabId);
            });
        });
    }

    onTabChange(tabId) {
        // Load data for specific tabs when they become active
        const loaders = {
            'report-bs-tab': () => this.reports.loadBalanceSheetReport(),
            'report-pnl-tab': () => this.reports.loadProfitLossReport(),
            'report-cashflow-tab': () => this.reports.loadCashFlowReport(),
            'report-ratio-tab': () => this.reports.loadRatioAnalysis()
        };
        if (loaders[tabId]) loaders[tabId]();
    }

    // ---- Modal system ----

    showModal(title, content, size = '') {
        const modal = document.getElementById('appModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const modalDialog = modal.querySelector('.modal-dialog');

        modalTitle.textContent = title;
        modalBody.innerHTML = content;
        if (size) modalDialog.className = 'modal-dialog ' + size;
        else modalDialog.className = 'modal-dialog';
        modal.classList.add('active');
    }

    closeModal(modalId) {
        if (modalId) {
            const el = document.getElementById(modalId);
            if (el) el.remove();
        } else {
            const modal = document.getElementById('appModal');
            if (modal) modal.classList.remove('active');
        }
    }

    // ---- Toast notifications ----

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        toast.innerHTML = `<span>${icons[type] || 'ℹ️'} ${this.escapeHtml(message)}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // ---- Utility ----

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = String(text ?? '');
        return div.innerHTML;
    }

    formatNumber(num) {
        return Number(num || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // ---- Global Events ----

    setupGlobalEvents() {
        // Sidebar nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                if (page) this.navigateTo(page);
            });
        });

        // Login form
        document.getElementById('loginBtn')?.addEventListener('click', () => this.handleLogin());
        document.getElementById('loginPassword')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
        document.getElementById('loginUsername')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') document.getElementById('loginPassword').focus();
        });

        // Modal close
        document.getElementById('appModal')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) this.closeModal();
        });
        document.querySelector('.modal-close')?.addEventListener('click', () => this.closeModal());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Close any custom modal-overlay first, then fallback to appModal
                const openOverlay = document.querySelector('.modal-overlay.active');
                if (openOverlay && openOverlay.id && openOverlay.id !== 'appModal') {
                    this.closeModal(openOverlay.id);
                } else {
                    this.closeModal();
                }
            }
        });

        // Sidebar toggle for mobile
        document.getElementById('sidebarToggle')?.addEventListener('click', () => {
            document.querySelector('.sidebar')?.classList.toggle('active');
        });

        // Close sidebar when clicking overlay
        document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
            document.querySelector('.sidebar')?.classList.remove('active');
        });
    }
}

// Initialize app when DOM is ready
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new App();
    app.init();
});
