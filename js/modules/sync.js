// ============================================================
// Online Billing System - Data Synchronization Module
// ============================================================

class SyncModule {
    constructor(database) {
        this.db = database;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = String(text ?? '');
        return div.innerHTML;
    }

    renderPage() {
        return `
        <div class="tabs">
            <button class="tab active" data-tab="sync-export-tab">Export Data</button>
            <button class="tab" data-tab="sync-import-tab">Import Data</button>
            <button class="tab" data-tab="sync-log-tab">Sync Log</button>
            <button class="tab" data-tab="sync-backup-tab">Backup & Restore</button>
        </div>

        <div id="sync-export-tab" class="tab-content active">
            <div class="card">
                <div class="card-header"><h3>Export Company Data</h3></div>
                <div class="card-body">
                    <p>Export all company data as a JSON file for backup or to transfer to another system.</p>
                    <div class="form-group">
                        <label>Select Stores to Export</label>
                        <div id="exportStoreOptions" class="checkbox-grid"></div>
                    </div>
                    <div class="form-row-2">
                        <button class="btn btn-primary" onclick="app.sync.selectAllStores(true)">Select All</button>
                        <button class="btn btn-outline" onclick="app.sync.selectAllStores(false)">Deselect All</button>
                    </div>
                    <div class="mt-2">
                        <button class="btn btn-primary" onclick="app.sync.exportData()">📤 Export Data</button>
                    </div>
                </div>
            </div>
        </div>

        <div id="sync-import-tab" class="tab-content">
            <div class="card">
                <div class="card-header"><h3>Import Company Data</h3></div>
                <div class="card-body">
                    <div class="alert alert-warning">
                        ⚠️ Importing data will merge with existing data. Duplicate records (same ID) will be overwritten.
                    </div>
                    <div class="form-group">
                        <label>Select Import File (JSON)</label>
                        <input type="file" id="importFile" accept=".json" class="form-control">
                    </div>
                    <div id="importPreview" class="mt-1" style="display:none"></div>
                    <div class="mt-2">
                        <button class="btn btn-primary" onclick="app.sync.importData()">📥 Import Data</button>
                    </div>
                </div>
            </div>
        </div>

        <div id="sync-log-tab" class="tab-content">
            <div class="card">
                <div class="card-header"><h3>Synchronization Log</h3></div>
                <div class="card-body">
                    <div id="syncLogContent"></div>
                </div>
            </div>
        </div>

        <div id="sync-backup-tab" class="tab-content">
            <div class="card">
                <div class="card-header"><h3>Automatic Backup Settings</h3></div>
                <div class="card-body">
                    <div class="form-row-2">
                        <div class="form-group">
                            <label>Auto Backup</label>
                            <select id="autoBackupFreq">
                                <option value="off">Off</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Max Backups to Keep</label>
                            <input type="number" id="maxBackups" value="5" min="1" max="20">
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="app.sync.saveBackupSettings()">Save Settings</button>
                </div>
            </div>
            <div class="card mt-2">
                <div class="card-header"><h3>Manual Backup</h3></div>
                <div class="card-body">
                    <p>Create a full backup of all data right now.</p>
                    <button class="btn btn-primary" onclick="app.sync.createFullBackup()">🗄️ Create Full Backup</button>
                </div>
            </div>
            <div class="card mt-2">
                <div class="card-header"><h3>Restore from Backup</h3></div>
                <div class="card-body">
                    <div class="alert alert-danger">⚠️ Restoring will replace ALL existing data with the backup data. This action cannot be undone!</div>
                    <div class="form-group">
                        <label>Select Backup File</label>
                        <input type="file" id="restoreFile" accept=".json" class="form-control">
                    </div>
                    <button class="btn btn-danger" onclick="app.sync.restoreFromBackup()">♻️ Restore Backup</button>
                </div>
            </div>
        </div>`;
    }

    async loadData() {
        this.renderExportOptions();
        this.setupImportPreview();
        await this.loadSyncLog();
    }

    renderExportOptions() {
        const container = document.getElementById('exportStoreOptions');
        if (!container) return;

        const stores = [
            { key: 'customers', label: 'Customers' },
            { key: 'quotes', label: 'Quotes' },
            { key: 'salesOrders', label: 'Sales Orders' },
            { key: 'invoices', label: 'Invoices' },
            { key: 'recurringInvoices', label: 'Recurring Invoices' },
            { key: 'deliveryChallans', label: 'Delivery Challans' },
            { key: 'paymentsReceived', label: 'Payments Received' },
            { key: 'creditNotes', label: 'Credit Notes' },
            { key: 'salesItems', label: 'Saved Sales Items' },
            { key: 'ledgers', label: 'Ledgers' },
            { key: 'vouchers', label: 'Vouchers' },
            { key: 'stockGroups', label: 'Stock Groups' },
            { key: 'stockItems', label: 'Stock Items' },
            { key: 'stockMovements', label: 'Stock Movements' },
            { key: 'employees', label: 'Employees' },
            { key: 'attendance', label: 'Attendance' },
            { key: 'salaryRecords', label: 'Salary Records' },
            { key: 'bankAccounts', label: 'Bank Accounts' },
            { key: 'bankTransactions', label: 'Bank Transactions' },
            { key: 'users', label: 'Users' },
            { key: 'settings', label: 'Settings' },
            { key: 'companies', label: 'Companies' }
        ];

        container.innerHTML = stores.map(s => `
            <label class="checkbox-label">
                <input type="checkbox" value="${s.key}" checked class="export-store-cb">
                ${this.escapeHtml(s.label)}
            </label>`).join('');
    }

    selectAllStores(select) {
        document.querySelectorAll('.export-store-cb').forEach(cb => cb.checked = select);
    }

    setupImportPreview() {
        const input = document.getElementById('importFile');
        if (input) {
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const data = JSON.parse(ev.target.result);
                        this._importData = data;
                        const preview = document.getElementById('importPreview');
                        if (preview) {
                            const storeNames = Object.keys(data).filter(k => k !== '_meta');
                            const totalRecords = storeNames.reduce((s, k) => s + (Array.isArray(data[k]) ? data[k].length : 0), 0);
                            preview.style.display = 'block';
                            preview.innerHTML = `
                            <div class="card"><div class="card-body">
                                <h4>Import Preview</h4>
                                <p>File: <strong>${this.escapeHtml(file.name)}</strong></p>
                                ${data._meta ? `<p>Exported: ${this.escapeHtml(data._meta.exportDate || 'Unknown')}</p>` : ''}
                                <p>Stores found: <strong>${storeNames.length}</strong> | Total records: <strong>${totalRecords}</strong></p>
                                <table class="data-table"><tbody>${storeNames.map(s => `
                                    <tr><td>${this.escapeHtml(s)}</td><td>${Array.isArray(data[s]) ? data[s].length : 0} records</td></tr>`).join('')}
                                </tbody></table>
                            </div></div>`;
                        }
                    } catch {
                        app.showToast('Invalid JSON file', 'error');
                    }
                };
                reader.readAsText(file);
            });
        }
    }

    async exportData() {
        const checkboxes = document.querySelectorAll('.export-store-cb:checked');
        const stores = Array.from(checkboxes).map(cb => cb.value);

        if (stores.length === 0) {
            app.showToast('Please select at least one data store to export', 'warning');
            return;
        }

        try {
            const allData = await this.db.exportAll();
            const exportData = { _meta: { exportDate: new Date().toISOString(), version: '1.0', type: 'partial' } };
            stores.forEach(s => {
                if (allData[s]) exportData[s] = allData[s];
            });

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `obs-export-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);

            await this.logSync('export', `Exported ${stores.length} stores`);
            app.showToast('Data exported successfully!', 'success');
        } catch (err) {
            app.showToast('Export failed: ' + err.message, 'error');
        }
    }

    async importData() {
        if (!this._importData) {
            app.showToast('Please select a file first', 'warning');
            return;
        }

        if (!confirm('This will merge imported data with existing data. Continue?')) return;

        try {
            const data = this._importData;
            const storeNames = Object.keys(data).filter(k => k !== '_meta');
            let imported = 0;

            for (const store of storeNames) {
                if (Array.isArray(data[store])) {
                    for (const record of data[store]) {
                        try {
                            if (record.id) {
                                const existing = await this.db.getById(store, record.id);
                                if (existing) await this.db.update(store, record);
                                else await this.db.add(store, record);
                            } else {
                                await this.db.add(store, record);
                            }
                            imported++;
                        } catch { /* skip individual record errors */ }
                    }
                }
            }

            await this.logSync('import', `Imported ${imported} records from ${storeNames.length} stores`);
            app.showToast(`Successfully imported ${imported} records!`, 'success');
            this._importData = null;
        } catch (err) {
            app.showToast('Import failed: ' + err.message, 'error');
        }
    }

    async createFullBackup() {
        try {
            const allData = await this.db.exportAll();
            allData._meta = { exportDate: new Date().toISOString(), version: '1.0', type: 'full-backup' };

            const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `obs-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);

            await this.logSync('backup', 'Full backup created');
            app.showToast('Full backup created and downloaded!', 'success');
        } catch (err) {
            app.showToast('Backup failed: ' + err.message, 'error');
        }
    }

    async restoreFromBackup() {
        const input = document.getElementById('restoreFile');
        if (!input?.files?.length) {
            app.showToast('Please select a backup file', 'warning');
            return;
        }

        if (!confirm('WARNING: This will replace ALL existing data. This cannot be undone! Continue?')) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                await this.db.importData(data);
                await this.logSync('restore', 'Data restored from backup');
                app.showToast('Data restored successfully! Refreshing...', 'success');
                setTimeout(() => location.reload(), 1500);
            } catch (err) {
                app.showToast('Restore failed: ' + err.message, 'error');
            }
        };
        reader.readAsText(input.files[0]);
    }

    saveBackupSettings() {
        const freq = document.getElementById('autoBackupFreq')?.value || 'off';
        const max = document.getElementById('maxBackups')?.value || 5;
        localStorage.setItem('tfe_backup_freq', freq);
        localStorage.setItem('tfe_backup_max', max);
        app.showToast('Backup settings saved', 'success');
    }

    async logSync(type, details) {
        await this.db.add('syncLog', {
            type,
            details,
            timestamp: new Date().toISOString(),
            user: app.auth?.currentUser || 'system'
        });
    }

    async loadSyncLog() {
        const content = document.getElementById('syncLogContent');
        if (!content) return;

        const logs = await this.db.getAll('syncLog');
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (logs.length === 0) {
            content.innerHTML = '<p class="text-muted">No sync activity yet</p>';
            return;
        }

        content.innerHTML = `
            <table class="data-table">
                <thead><tr><th>Date/Time</th><th>Type</th><th>Details</th><th>User</th></tr></thead>
                <tbody>${logs.map(log => `
                    <tr>
                        <td>${new Date(log.timestamp).toLocaleString()}</td>
                        <td><span class="badge badge-${log.type === 'export' ? 'success' : log.type === 'import' ? 'info' : log.type === 'backup' ? 'warning' : 'primary'}">${this.escapeHtml(log.type)}</span></td>
                        <td>${this.escapeHtml(log.details)}</td>
                        <td>${this.escapeHtml(typeof log.user === 'string' ? log.user : log.user?.username || 'system')}</td>
                    </tr>`).join('')}
                </tbody>
            </table>`;
    }
}
