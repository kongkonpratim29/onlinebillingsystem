// ============================================================
// Online Billing System - Authentication & Security Module
// ============================================================

class AuthModule {
    constructor(database) {
        this.db = database;
        this.currentUser = null;
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        this.sessionTimer = null;
    }

    // Called by app.js as initDefaultAdmin()
    async initDefaultAdmin() {
        const userCount = await this.db.count('users');
        if (userCount === 0) {
            await this.db.add('users', {
                username: 'admin',
                password: this.hashPassword('admin123'),
                fullName: 'System Administrator',
                role: 'admin',
                email: 'admin@obs.com',
                active: 1,
                permissions: ['all']
            });
        }
    }

    getSession() {
        return this.currentUser;
    }

    hashPassword(password) {
        // Simple hash for demo - in production use bcrypt/argon2 on server
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'h_' + Math.abs(hash).toString(36) + '_' + password.length;
    }

    async login(username, password) {
        try {
            const user = await this.db.getByIndexOne('users', 'username', username);
            if (!user) {
                await this.logAudit(null, 'LOGIN_FAILED', `Failed login attempt for username: ${username}`);
                return { success: false, message: 'Invalid username or password' };
            }

            if (!user.active) {
                return { success: false, message: 'Account is deactivated. Contact administrator.' };
            }

            if (user.password !== this.hashPassword(password)) {
                await this.logAudit(null, 'LOGIN_FAILED', `Invalid password for user: ${username}`);
                return { success: false, message: 'Invalid username or password' };
            }

            this.currentUser = {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                role: user.role,
                permissions: user.permissions
            };

            this.startSessionTimer();
            await this.logAudit(user.id, 'LOGIN', `User ${username} logged in`);
            return { success: true, user: this.currentUser };
        } catch (err) {
            return { success: false, message: 'Login failed. Please try again.' };
        }
    }

    logout() {
        if (this.sessionTimer) {
            clearTimeout(this.sessionTimer);
        }
        if (this.currentUser) {
            this.logAudit(this.currentUser.id, 'LOGOUT', `User ${this.currentUser.username} logged out`);
        }
        this.currentUser = null;
    }

    startSessionTimer() {
        if (this.sessionTimer) {
            clearTimeout(this.sessionTimer);
        }
        this.sessionTimer = setTimeout(() => {
            this.logout();
            if (typeof app !== 'undefined') {
                app.showLogin();
                app.showToast('Session expired. Please login again.', 'warning');
            }
        }, this.sessionTimeout);
    }

    refreshSession() {
        if (this.currentUser) {
            this.startSessionTimer();
        }
    }

    isLoggedIn() {
        return this.currentUser !== null;
    }

    hasPermission(permission) {
        if (!this.currentUser) return false;
        if (this.currentUser.role === 'admin') return true;
        if (this.currentUser.permissions.includes('all')) return true;
        return this.currentUser.permissions.includes(permission);
    }

    hasRole(role) {
        if (!this.currentUser) return false;
        return this.currentUser.role === role;
    }

    async getUsers() {
        return await this.db.getAll('users');
    }

    async createUser(userData) {
        if (!this.hasPermission('manage_users')) {
            throw new Error('Permission denied');
        }
        userData.password = this.hashPassword(userData.password);
        userData.active = true;
        const id = await this.db.add('users', userData);
        await this.logAudit(this.currentUser.id, 'USER_CREATED', `Created user: ${userData.username}`);
        return id;
    }

    async updateUser(userData) {
        if (!this.hasPermission('manage_users')) {
            throw new Error('Permission denied');
        }
        if (userData.newPassword) {
            userData.password = this.hashPassword(userData.newPassword);
            delete userData.newPassword;
        }
        await this.db.update('users', userData);
        await this.logAudit(this.currentUser.id, 'USER_UPDATED', `Updated user: ${userData.username}`);
    }

    async changePassword(oldPassword, newPassword) {
        const user = await this.db.getById('users', this.currentUser.id);
        if (user.password !== this.hashPassword(oldPassword)) {
            throw new Error('Current password is incorrect');
        }
        user.password = this.hashPassword(newPassword);
        await this.db.update('users', user);
        await this.logAudit(this.currentUser.id, 'PASSWORD_CHANGED', 'Password changed');
    }

    async logAudit(userId, action, details) {
        try {
            await this.db.add('auditTrail', {
                userId: userId,
                action: action,
                details: details,
                timestamp: new Date().toISOString(),
                ipAddress: 'local'
            });
        } catch (e) {
            console.error('Audit log error:', e);
        }
    }

    async getAuditTrail(limit = 100) {
        const all = await this.db.getAll('auditTrail');
        return all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
    }

    renderPage() {
        return this.renderSecurityPage();
    }

    async loadData() {
        await this.loadUsersTable();
        await this.loadAuditTable();
    }

    // Render Security & User Management page
    renderSecurityPage() {
        return `
        <div class="tabs">
            <button class="tab active" data-tab="users-tab">Users</button>
            <button class="tab" data-tab="roles-tab">Roles & Permissions</button>
            <button class="tab" data-tab="audit-tab">Audit Trail</button>
        </div>

        <div id="users-tab" class="tab-content active">
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="search-box">
                        <span>🔍</span>
                        <input type="text" id="userSearch" placeholder="Search users...">
                    </div>
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-primary" onclick="app.auth.showUserModal()">+ Add User</button>
                </div>
            </div>
            <div class="card">
                <div class="card-body">
                    <table class="data-table" id="usersTable">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Full Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>

        <div id="roles-tab" class="tab-content">
            <div class="card">
                <div class="card-header"><h3>Role Permissions Matrix</h3></div>
                <div class="card-body">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Permission</th>
                                <th>Admin</th>
                                <th>Manager</th>
                                <th>Accountant</th>
                                <th>Data Entry</th>
                                <th>Viewer</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.renderPermissionsMatrix()}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div id="audit-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="search-box">
                        <span>🔍</span>
                        <input type="text" id="auditSearch" placeholder="Search audit trail...">
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-body">
                    <table class="data-table" id="auditTable">
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>User</th>
                                <th>Action</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>`;
    }

    renderPermissionsMatrix() {
        const permissions = [
            'View Dashboard', 'Manage Accounting', 'Create Vouchers', 'Manage Inventory',
            'GST & Taxation', 'Payroll Management', 'Banking', 'MIS Reports',
            'User Management', 'Data Sync', 'Backup & Restore'
        ];
        const roles = {
            admin: true,
            manager: [true, true, true, true, true, true, true, true, false, false, false],
            accountant: [true, true, true, false, true, false, true, true, false, false, false],
            dataEntry: [true, false, true, true, false, false, false, false, false, false, false],
            viewer: [true, false, false, false, false, false, false, true, false, false, false]
        };
        return permissions.map((p, i) => `
            <tr>
                <td>${p}</td>
                <td class="text-center">✅</td>
                <td class="text-center">${roles.manager[i] ? '✅' : '❌'}</td>
                <td class="text-center">${roles.accountant[i] ? '✅' : '❌'}</td>
                <td class="text-center">${roles.dataEntry[i] ? '✅' : '❌'}</td>
                <td class="text-center">${roles.viewer[i] ? '✅' : '❌'}</td>
            </tr>`).join('');
    }

    async loadUsersTable() {
        const users = await this.getUsers();
        const tbody = document.querySelector('#usersTable tbody');
        if (!tbody) return;
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${this.escapeHtml(u.username)}</td>
                <td>${this.escapeHtml(u.fullName)}</td>
                <td>${this.escapeHtml(u.email || '-')}</td>
                <td><span class="badge badge-info">${this.escapeHtml(u.role)}</span></td>
                <td><span class="badge ${u.active ? 'badge-success' : 'badge-danger'}">${u.active ? 'Active' : 'Inactive'}</span></td>
                <td class="actions">
                    <button class="btn btn-sm btn-outline" onclick="app.auth.showUserModal(${u.id})">Edit</button>
                    ${u.username !== 'admin' ? `<button class="btn btn-sm btn-danger" onclick="app.auth.toggleUserStatus(${u.id})">
                        ${u.active ? 'Deactivate' : 'Activate'}
                    </button>` : ''}
                </td>
            </tr>`).join('');
    }

    async loadAuditTable() {
        const trails = await this.getAuditTrail();
        const users = await this.getUsers();
        const userMap = {};
        users.forEach(u => userMap[u.id] = u.username);

        const tbody = document.querySelector('#auditTable tbody');
        if (!tbody) return;
        tbody.innerHTML = trails.map(t => `
            <tr>
                <td>${new Date(t.timestamp).toLocaleString()}</td>
                <td>${this.escapeHtml(userMap[t.userId] || 'System')}</td>
                <td><span class="badge badge-info">${this.escapeHtml(t.action)}</span></td>
                <td>${this.escapeHtml(t.details)}</td>
            </tr>`).join('');
    }

    showUserModal(userId = null) {
        const isEdit = userId !== null;
        const content = `
            <input type="hidden" id="userId" value="${userId || ''}">
            <div class="form-group">
                <label>Username</label>
                <input type="text" id="userUsername" ${isEdit ? 'disabled' : ''}>
            </div>
            <div class="form-group">
                <label>${isEdit ? 'New Password (leave blank to keep)' : 'Password'}</label>
                <input type="password" id="userPassword" autocomplete="new-password">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" id="userFullName">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="userEmail">
                </div>
            </div>
            <div class="form-group">
                <label>Role</label>
                <select id="userRole">
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="accountant">Accountant</option>
                    <option value="dataEntry">Data Entry</option>
                    <option value="viewer">Viewer</option>
                </select>
            </div>
            <div style="text-align:right;margin-top:15px">
                <button class="btn btn-outline" onclick="app.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="app.auth.saveUser()">Save User</button>
            </div>`;

        app.showModal(isEdit ? 'Edit User' : 'Add New User', content);

        if (isEdit) {
            this.loadUserForEdit(userId);
        }
    }

    async loadUserForEdit(userId) {
        const user = await this.db.getById('users', userId);
        if (user) {
            document.getElementById('userUsername').value = user.username;
            document.getElementById('userFullName').value = user.fullName;
            document.getElementById('userEmail').value = user.email || '';
            document.getElementById('userRole').value = user.role;
        }
    }

    async saveUser() {
        const userId = document.getElementById('userId').value;
        const username = document.getElementById('userUsername').value.trim();
        const password = document.getElementById('userPassword').value;
        const fullName = document.getElementById('userFullName').value.trim();
        const email = document.getElementById('userEmail').value.trim();
        const role = document.getElementById('userRole').value;

        if (!fullName) {
            app.showToast('Full name is required', 'error');
            return;
        }

        try {
            if (userId) {
                const user = await this.db.getById('users', parseInt(userId));
                user.fullName = fullName;
                user.email = email;
                user.role = role;
                if (password) user.newPassword = password;
                await this.updateUser(user);
            } else {
                if (!username || !password) {
                    app.showToast('Username and password are required', 'error');
                    return;
                }
                await this.createUser({ username, password, fullName, email, role, permissions: [role] });
            }
            app.closeModal();
            app.showToast('User saved successfully', 'success');
            this.loadUsersTable();
        } catch (e) {
            app.showToast(e.message, 'error');
        }
    }

    async toggleUserStatus(userId) {
        const user = await this.db.getById('users', userId);
        user.active = user.active ? 0 : 1;
        await this.db.update('users', user);
        await this.logAudit(this.currentUser.id, 'USER_STATUS_CHANGED',
            `User ${user.username} ${user.active ? 'activated' : 'deactivated'}`);
        app.showToast(`User ${user.active ? 'activated' : 'deactivated'}`, 'success');
        this.loadUsersTable();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
