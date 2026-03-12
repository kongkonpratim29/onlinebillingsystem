// ============================================================
// Online Billing System - Accounting Module
// ============================================================

class AccountingModule {
    constructor(database) {
        this.db = database;
        this.ledgerGroups = [
            'Capital Account', 'Current Assets', 'Current Liabilities',
            'Direct Expenses', 'Direct Incomes', 'Fixed Assets',
            'Indirect Expenses', 'Indirect Incomes', 'Investments',
            'Loans (Liability)', 'Loans & Advances (Asset)',
            'Purchase Accounts', 'Sales Accounts',
            'Secured Loans', 'Unsecured Loans',
            'Sundry Creditors', 'Sundry Debtors',
            'Bank Accounts', 'Cash-in-Hand',
            'Duties & Taxes', 'Provisions', 'Reserves & Surplus',
            'Suspense Account', 'Branch / Divisions'
        ];
        this.voucherTypes = [
            'Payment', 'Receipt', 'Contra', 'Journal',
            'Sales', 'Purchase', 'Credit Note', 'Debit Note'
        ];
    }

    async init() {
        const ledgerCount = await this.db.count('ledgers');
        if (ledgerCount === 0) {
            // Create default ledgers
            const defaults = [
                { name: 'Cash', group: 'Cash-in-Hand', type: 'Asset', openingBalance: 0 },
                { name: 'Profit & Loss A/c', group: 'Primary', type: 'Revenue', openingBalance: 0 },
                { name: 'Capital Account', group: 'Capital Account', type: 'Liability', openingBalance: 0 }
            ];
            for (const ledger of defaults) {
                await this.db.add('ledgers', ledger);
            }
        }
    }

    // Ledger CRUD
    async createLedger(data) {
        return await this.db.add('ledgers', data);
    }

    async updateLedger(data) {
        return await this.db.update('ledgers', data);
    }

    async deleteLedger(id) {
        return await this.db.delete('ledgers', id);
    }

    async getLedgers() {
        return await this.db.getAll('ledgers');
    }

    async getLedgersByGroup(group) {
        return await this.db.getByIndex('ledgers', 'group', group);
    }

    // Voucher CRUD
    async createVoucher(data) {
        data.voucherNo = await this.generateVoucherNo(data.type);
        const id = await this.db.add('vouchers', data);
        await app.security.logAudit(app.security.currentUser?.id, 'VOUCHER_CREATED',
            `${data.type} voucher #${data.voucherNo} created`);
        return id;
    }

    async updateVoucher(data) {
        return await this.db.update('vouchers', data);
    }

    async deleteVoucher(id) {
        return await this.db.delete('vouchers', id);
    }

    async getVouchers(type = null) {
        if (type) {
            return await this.db.getByIndex('vouchers', 'type', type);
        }
        return await this.db.getAll('vouchers');
    }

    async generateVoucherNo(type) {
        const vouchers = await this.getVouchers(type);
        const prefix = type.substring(0, 3).toUpperCase();
        const num = vouchers.length + 1;
        return `${prefix}-${String(num).padStart(5, '0')}`;
    }

    // Financial Calculations
    async getBalanceSheet() {
        const ledgers = await this.getLedgers();
        const vouchers = await this.getVouchers();

        const balances = {};
        ledgers.forEach(l => {
            balances[l.id] = {
                name: l.name,
                group: l.group,
                type: l.type,
                balance: l.openingBalance || 0
            };
        });

        vouchers.forEach(v => {
            if (v.entries) {
                v.entries.forEach(e => {
                    if (balances[e.ledgerId]) {
                        if (e.type === 'debit') {
                            balances[e.ledgerId].balance += e.amount;
                        } else {
                            balances[e.ledgerId].balance -= e.amount;
                        }
                    }
                });
            }
        });

        const assets = {};
        const liabilities = {};
        const assetGroups = ['Current Assets', 'Fixed Assets', 'Investments', 'Cash-in-Hand',
            'Bank Accounts', 'Loans & Advances (Asset)', 'Sundry Debtors'];
        const liabilityGroups = ['Capital Account', 'Current Liabilities', 'Loans (Liability)',
            'Secured Loans', 'Unsecured Loans', 'Sundry Creditors', 'Reserves & Surplus',
            'Provisions', 'Duties & Taxes'];

        Object.values(balances).forEach(b => {
            if (assetGroups.includes(b.group)) {
                if (!assets[b.group]) assets[b.group] = [];
                assets[b.group].push(b);
            } else if (liabilityGroups.includes(b.group)) {
                if (!liabilities[b.group]) liabilities[b.group] = [];
                liabilities[b.group].push(b);
            }
        });

        return { assets, liabilities, balances };
    }

    async getProfitAndLoss() {
        const ledgers = await this.getLedgers();
        const vouchers = await this.getVouchers();

        const balances = {};
        ledgers.forEach(l => {
            balances[l.id] = {
                name: l.name,
                group: l.group,
                balance: 0
            };
        });

        vouchers.forEach(v => {
            if (v.entries) {
                v.entries.forEach(e => {
                    if (balances[e.ledgerId]) {
                        if (e.type === 'debit') {
                            balances[e.ledgerId].balance += e.amount;
                        } else {
                            balances[e.ledgerId].balance -= e.amount;
                        }
                    }
                });
            }
        });

        const incomeGroups = ['Direct Incomes', 'Indirect Incomes', 'Sales Accounts'];
        const expenseGroups = ['Direct Expenses', 'Indirect Expenses', 'Purchase Accounts'];

        const incomes = {};
        const expenses = {};

        Object.values(balances).forEach(b => {
            if (incomeGroups.includes(b.group)) {
                if (!incomes[b.group]) incomes[b.group] = [];
                incomes[b.group].push(b);
            } else if (expenseGroups.includes(b.group)) {
                if (!expenses[b.group]) expenses[b.group] = [];
                expenses[b.group].push(b);
            }
        });

        const totalIncome = Object.values(incomes).flat().reduce((s, i) => s + Math.abs(i.balance), 0);
        const totalExpense = Object.values(expenses).flat().reduce((s, i) => s + Math.abs(i.balance), 0);
        const netProfitLoss = totalIncome - totalExpense;

        return { incomes, expenses, totalIncome, totalExpense, netProfitLoss };
    }

    async getReceivables() {
        const debtors = await this.getLedgersByGroup('Sundry Debtors');
        const vouchers = await this.getVouchers();
        return this.calculateOutstanding(debtors, vouchers, 'debit');
    }

    async getPayables() {
        const creditors = await this.getLedgersByGroup('Sundry Creditors');
        const vouchers = await this.getVouchers();
        return this.calculateOutstanding(creditors, vouchers, 'credit');
    }

    calculateOutstanding(ledgers, vouchers, entryType) {
        const outstanding = [];
        ledgers.forEach(l => {
            let balance = l.openingBalance || 0;
            vouchers.forEach(v => {
                if (v.entries) {
                    v.entries.forEach(e => {
                        if (e.ledgerId === l.id) {
                            if (e.type === entryType) balance += e.amount;
                            else balance -= e.amount;
                        }
                    });
                }
            });
            if (Math.abs(balance) > 0) {
                outstanding.push({ ...l, outstanding: Math.abs(balance) });
            }
        });
        return outstanding;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    // ---- RENDER METHODS ----

    renderPage() {
        return `
        <div class="tabs">
            <button class="tab active" data-tab="ledgers-tab">Ledgers</button>
            <button class="tab" data-tab="vouchers-tab">Vouchers</button>
            <button class="tab" data-tab="daybook-tab">Day Book</button>
            <button class="tab" data-tab="balancesheet-tab">Balance Sheet</button>
            <button class="tab" data-tab="pnl-tab">Profit & Loss</button>
            <button class="tab" data-tab="receivables-tab">Receivables</button>
            <button class="tab" data-tab="payables-tab">Payables</button>
        </div>

        <!-- Ledgers Tab -->
        <div id="ledgers-tab" class="tab-content active">
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="search-box">
                        <span>🔍</span>
                        <input type="text" id="ledgerSearch" placeholder="Search ledgers..." oninput="app.accounting.filterLedgers()">
                    </div>
                    <select class="filter-select" id="ledgerGroupFilter" onchange="app.accounting.filterLedgers()">
                        <option value="">All Groups</option>
                        ${this.ledgerGroups.map(g => `<option value="${g}">${g}</option>`).join('')}
                    </select>
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-primary" onclick="app.accounting.showLedgerModal()">+ Create Ledger</button>
                </div>
            </div>
            <div class="card">
                <div class="card-body">
                    <table class="data-table" id="ledgersTable">
                        <thead>
                            <tr>
                                <th>Ledger Name</th>
                                <th>Group</th>
                                <th>Type</th>
                                <th class="amount">Opening Balance</th>
                                <th class="amount">Current Balance</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Vouchers Tab -->
        <div id="vouchers-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-left">
                    <select class="filter-select" id="voucherTypeFilter" onchange="app.accounting.loadVouchersTable()">
                        <option value="">All Types</option>
                        ${this.voucherTypes.map(t => `<option value="${t}">${t}</option>`).join('')}
                    </select>
                    <input type="date" class="filter-select" id="voucherDateFrom" onchange="app.accounting.loadVouchersTable()">
                    <input type="date" class="filter-select" id="voucherDateTo" onchange="app.accounting.loadVouchersTable()">
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-primary" onclick="app.accounting.showVoucherModal()">+ Create Voucher</button>
                </div>
            </div>
            <div class="card">
                <div class="card-body">
                    <table class="data-table" id="vouchersTable">
                        <thead>
                            <tr>
                                <th>Voucher No</th>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Narration</th>
                                <th class="amount">Amount (₹)</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Day Book Tab -->
        <div id="daybook-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-left">
                    <label>Date: </label>
                    <input type="date" class="filter-select" id="daybookDate" value="${new Date().toISOString().split('T')[0]}" onchange="app.accounting.loadDayBook()">
                </div>
            </div>
            <div class="card">
                <div class="card-body" id="daybookContent"></div>
            </div>
        </div>

        <!-- Balance Sheet Tab -->
        <div id="balancesheet-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-right">
                    <button class="btn btn-outline" onclick="app.accounting.printReport('balanceSheetReport')">🖨️ Print</button>
                </div>
            </div>
            <div class="card" id="balanceSheetReport"></div>
        </div>

        <!-- P&L Tab -->
        <div id="pnl-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-right">
                    <button class="btn btn-outline" onclick="app.accounting.printReport('pnlReport')">🖨️ Print</button>
                </div>
            </div>
            <div class="card" id="pnlReport"></div>
        </div>

        <!-- Receivables Tab -->
        <div id="receivables-tab" class="tab-content">
            <div class="card">
                <div class="card-header"><h3>Outstanding Receivables</h3></div>
                <div class="card-body" id="receivablesContent"></div>
            </div>
        </div>

        <!-- Payables Tab -->
        <div id="payables-tab" class="tab-content">
            <div class="card">
                <div class="card-header"><h3>Outstanding Payables</h3></div>
                <div class="card-body" id="payablesContent"></div>
            </div>
        </div>`;
    }

    async loadData() {
        await this.loadLedgersTable();
    }

    async loadLedgersTable() {
        const ledgers = await this.getLedgers();
        const vouchers = await this.getVouchers();
        const tbody = document.querySelector('#ledgersTable tbody');
        if (!tbody) return;

        // Calculate current balances
        const currentBalances = {};
        ledgers.forEach(l => currentBalances[l.id] = l.openingBalance || 0);
        vouchers.forEach(v => {
            if (v.entries) {
                v.entries.forEach(e => {
                    if (currentBalances[e.ledgerId] !== undefined) {
                        if (e.type === 'debit') currentBalances[e.ledgerId] += e.amount;
                        else currentBalances[e.ledgerId] -= e.amount;
                    }
                });
            }
        });

        tbody.innerHTML = ledgers.map(l => `
            <tr>
                <td><strong>${this.escapeHtml(l.name)}</strong></td>
                <td>${this.escapeHtml(l.group)}</td>
                <td><span class="badge badge-info">${this.escapeHtml(l.type || '-')}</span></td>
                <td class="amount">${this.formatCurrency(l.openingBalance || 0)}</td>
                <td class="amount"><strong>${this.formatCurrency(currentBalances[l.id] || 0)}</strong></td>
                <td class="actions">
                    <button class="btn btn-sm btn-outline" onclick="app.accounting.showLedgerModal(${l.id})">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="app.accounting.removeLedger(${l.id})">Delete</button>
                </td>
            </tr>`).join('');
    }

    filterLedgers() {
        const search = (document.getElementById('ledgerSearch')?.value || '').toLowerCase();
        const group = document.getElementById('ledgerGroupFilter')?.value || '';
        const rows = document.querySelectorAll('#ledgersTable tbody tr');
        rows.forEach(row => {
            const name = row.cells[0]?.textContent.toLowerCase() || '';
            const grp = row.cells[1]?.textContent || '';
            const matchSearch = !search || name.includes(search);
            const matchGroup = !group || grp === group;
            row.style.display = (matchSearch && matchGroup) ? '' : 'none';
        });
    }

    async loadVouchersTable() {
        const typeFilter = document.getElementById('voucherTypeFilter')?.value;
        const dateFrom = document.getElementById('voucherDateFrom')?.value;
        const dateTo = document.getElementById('voucherDateTo')?.value;

        let vouchers = await this.getVouchers(typeFilter || null);

        if (dateFrom) vouchers = vouchers.filter(v => v.date >= dateFrom);
        if (dateTo) vouchers = vouchers.filter(v => v.date <= dateTo);

        vouchers.sort((a, b) => new Date(b.date) - new Date(a.date));

        const tbody = document.querySelector('#vouchersTable tbody');
        if (!tbody) return;

        tbody.innerHTML = vouchers.length ? vouchers.map(v => {
            const total = v.entries ? v.entries.reduce((s, e) => e.type === 'debit' ? s + e.amount : s, 0) : 0;
            return `
            <tr>
                <td><strong>${this.escapeHtml(v.voucherNo)}</strong></td>
                <td>${v.date}</td>
                <td><span class="badge badge-info">${this.escapeHtml(v.type)}</span></td>
                <td>${this.escapeHtml(v.narration || '-')}</td>
                <td class="amount"><strong>${this.formatCurrency(total)}</strong></td>
                <td class="actions">
                    <button class="btn btn-sm btn-outline" onclick="app.accounting.viewVoucher(${v.id})">View</button>
                    <button class="btn btn-sm btn-danger" onclick="app.accounting.removeVoucher(${v.id})">Delete</button>
                </td>
            </tr>`;
        }).join('') : '<tr><td colspan="6" class="text-center text-muted">No vouchers found</td></tr>';
    }

    async loadDayBook() {
        const date = document.getElementById('daybookDate')?.value || new Date().toISOString().split('T')[0];
        const vouchers = await this.getVouchers();
        const dayVouchers = vouchers.filter(v => v.date === date);
        const ledgers = await this.getLedgers();
        const ledgerMap = {};
        ledgers.forEach(l => ledgerMap[l.id] = l.name);

        const content = document.getElementById('daybookContent');
        if (!content) return;

        if (dayVouchers.length === 0) {
            content.innerHTML = '<div class="empty-state"><h3>No transactions</h3><p>No vouchers found for this date</p></div>';
            return;
        }

        let html = '<table class="data-table"><thead><tr><th>Voucher</th><th>Particulars</th><th class="amount">Debit (₹)</th><th class="amount">Credit (₹)</th></tr></thead><tbody>';
        dayVouchers.forEach(v => {
            if (v.entries) {
                v.entries.forEach((e, i) => {
                    html += `<tr>
                        ${i === 0 ? `<td rowspan="${v.entries.length}"><strong>${this.escapeHtml(v.voucherNo)}</strong><br><small>${this.escapeHtml(v.type)}</small></td>` : ''}
                        <td>${this.escapeHtml(ledgerMap[e.ledgerId] || 'Unknown')}</td>
                        <td class="amount">${e.type === 'debit' ? this.formatCurrency(e.amount) : ''}</td>
                        <td class="amount">${e.type === 'credit' ? this.formatCurrency(e.amount) : ''}</td>
                    </tr>`;
                });
            }
        });
        html += '</tbody></table>';
        content.innerHTML = html;
    }

    async loadBalanceSheet() {
        const bs = await this.getBalanceSheet();
        const report = document.getElementById('balanceSheetReport');
        if (!report) return;

        let totalAssets = 0, totalLiabilities = 0;

        let html = '<div class="card-header"><h3>Balance Sheet</h3></div><div class="card-body"><div class="recon-panel">';

        // Liabilities
        html += '<div class="recon-column"><h4>Liabilities & Capital</h4><table class="data-table"><tbody>';
        Object.entries(bs.liabilities).forEach(([group, items]) => {
            html += `<tr><td colspan="2"><strong>${this.escapeHtml(group)}</strong></td></tr>`;
            items.forEach(item => {
                const amt = Math.abs(item.balance);
                totalLiabilities += amt;
                html += `<tr><td>&nbsp;&nbsp;${this.escapeHtml(item.name)}</td><td class="amount">${this.formatCurrency(amt)}</td></tr>`;
            });
        });
        html += `<tr style="border-top:2px solid #333"><td><strong>Total</strong></td><td class="amount"><strong>${this.formatCurrency(totalLiabilities)}</strong></td></tr>`;
        html += '</tbody></table></div>';

        // Assets
        html += '<div class="recon-column"><h4>Assets</h4><table class="data-table"><tbody>';
        Object.entries(bs.assets).forEach(([group, items]) => {
            html += `<tr><td colspan="2"><strong>${this.escapeHtml(group)}</strong></td></tr>`;
            items.forEach(item => {
                const amt = Math.abs(item.balance);
                totalAssets += amt;
                html += `<tr><td>&nbsp;&nbsp;${this.escapeHtml(item.name)}</td><td class="amount">${this.formatCurrency(amt)}</td></tr>`;
            });
        });
        html += `<tr style="border-top:2px solid #333"><td><strong>Total</strong></td><td class="amount"><strong>${this.formatCurrency(totalAssets)}</strong></td></tr>`;
        html += '</tbody></table></div>';

        html += '</div></div>';
        report.innerHTML = html;
    }

    async loadProfitAndLoss() {
        const pnl = await this.getProfitAndLoss();
        const report = document.getElementById('pnlReport');
        if (!report) return;

        let html = '<div class="card-header"><h3>Profit & Loss Account</h3></div><div class="card-body"><div class="recon-panel">';

        // Expenses
        html += '<div class="recon-column"><h4>Expenses</h4><table class="data-table"><tbody>';
        Object.entries(pnl.expenses).forEach(([group, items]) => {
            html += `<tr><td colspan="2"><strong>${this.escapeHtml(group)}</strong></td></tr>`;
            items.forEach(item => {
                html += `<tr><td>&nbsp;&nbsp;${this.escapeHtml(item.name)}</td><td class="amount">${this.formatCurrency(Math.abs(item.balance))}</td></tr>`;
            });
        });
        if (pnl.netProfitLoss > 0) {
            html += `<tr><td><strong class="text-success">Net Profit</strong></td><td class="amount"><strong class="text-success">${this.formatCurrency(pnl.netProfitLoss)}</strong></td></tr>`;
        }
        html += `<tr style="border-top:2px solid #333"><td><strong>Total</strong></td><td class="amount"><strong>${this.formatCurrency(pnl.totalExpense + (pnl.netProfitLoss > 0 ? pnl.netProfitLoss : 0))}</strong></td></tr>`;
        html += '</tbody></table></div>';

        // Incomes
        html += '<div class="recon-column"><h4>Incomes</h4><table class="data-table"><tbody>';
        Object.entries(pnl.incomes).forEach(([group, items]) => {
            html += `<tr><td colspan="2"><strong>${this.escapeHtml(group)}</strong></td></tr>`;
            items.forEach(item => {
                html += `<tr><td>&nbsp;&nbsp;${this.escapeHtml(item.name)}</td><td class="amount">${this.formatCurrency(Math.abs(item.balance))}</td></tr>`;
            });
        });
        if (pnl.netProfitLoss < 0) {
            html += `<tr><td><strong class="text-danger">Net Loss</strong></td><td class="amount"><strong class="text-danger">${this.formatCurrency(Math.abs(pnl.netProfitLoss))}</strong></td></tr>`;
        }
        html += `<tr style="border-top:2px solid #333"><td><strong>Total</strong></td><td class="amount"><strong>${this.formatCurrency(pnl.totalIncome + (pnl.netProfitLoss < 0 ? Math.abs(pnl.netProfitLoss) : 0))}</strong></td></tr>`;
        html += '</tbody></table></div>';

        html += '</div></div>';
        report.innerHTML = html;
    }

    async loadReceivables() {
        const receivables = await this.getReceivables();
        const content = document.getElementById('receivablesContent');
        if (!content) return;

        if (receivables.length === 0) {
            content.innerHTML = '<div class="empty-state"><h3>No Outstanding Receivables</h3></div>';
            return;
        }

        const total = receivables.reduce((s, r) => s + r.outstanding, 0);
        let html = `<table class="data-table"><thead><tr><th>Party Name</th><th class="amount">Outstanding (₹)</th></tr></thead><tbody>`;
        receivables.forEach(r => {
            html += `<tr><td>${this.escapeHtml(r.name)}</td><td class="amount">${this.formatCurrency(r.outstanding)}</td></tr>`;
        });
        html += `<tr style="border-top:2px solid #333"><td><strong>Total Receivables</strong></td><td class="amount"><strong>${this.formatCurrency(total)}</strong></td></tr>`;
        html += '</tbody></table>';
        content.innerHTML = html;
    }

    async loadPayables() {
        const payables = await this.getPayables();
        const content = document.getElementById('payablesContent');
        if (!content) return;

        if (payables.length === 0) {
            content.innerHTML = '<div class="empty-state"><h3>No Outstanding Payables</h3></div>';
            return;
        }

        const total = payables.reduce((s, r) => s + r.outstanding, 0);
        let html = `<table class="data-table"><thead><tr><th>Party Name</th><th class="amount">Outstanding (₹)</th></tr></thead><tbody>`;
        payables.forEach(r => {
            html += `<tr><td>${this.escapeHtml(r.name)}</td><td class="amount">${this.formatCurrency(r.outstanding)}</td></tr>`;
        });
        html += `<tr style="border-top:2px solid #333"><td><strong>Total Payables</strong></td><td class="amount"><strong>${this.formatCurrency(total)}</strong></td></tr>`;
        html += '</tbody></table>';
        content.innerHTML = html;
    }

    // Modals
    showLedgerModal(ledgerId = null) {
        const isEdit = ledgerId !== null;
        const modalHtml = `
        <div class="modal-overlay active" id="ledgerModal">
            <div class="modal">
                <div class="modal-header">
                    <h3>${isEdit ? 'Edit Ledger' : 'Create New Ledger'}</h3>
                    <button class="modal-close" onclick="app.closeModal('ledgerModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="ledgerEditId" value="${ledgerId || ''}">
                    <div class="form-group">
                        <label>Ledger Name</label>
                        <input type="text" id="ledgerName" placeholder="Enter ledger name">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Under Group</label>
                            <select id="ledgerGroup">
                                ${this.ledgerGroups.map(g => `<option value="${g}">${g}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Type</label>
                            <select id="ledgerType">
                                <option value="Asset">Asset</option>
                                <option value="Liability">Liability</option>
                                <option value="Income">Income</option>
                                <option value="Expense">Expense</option>
                                <option value="Revenue">Revenue</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Opening Balance (₹)</label>
                            <input type="number" id="ledgerBalance" value="0" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>GSTIN</label>
                            <input type="text" id="ledgerGstin" placeholder="Optional">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Address</label>
                        <textarea id="ledgerAddress" placeholder="Optional"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="app.closeModal('ledgerModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="app.accounting.saveLedger()">Save Ledger</button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        if (isEdit) this.loadLedgerForEdit(ledgerId);
    }

    async loadLedgerForEdit(id) {
        const ledger = await this.db.getById('ledgers', id);
        if (ledger) {
            document.getElementById('ledgerName').value = ledger.name;
            document.getElementById('ledgerGroup').value = ledger.group;
            document.getElementById('ledgerType').value = ledger.type || 'Asset';
            document.getElementById('ledgerBalance').value = ledger.openingBalance || 0;
            if (document.getElementById('ledgerGstin')) document.getElementById('ledgerGstin').value = ledger.gstin || '';
            if (document.getElementById('ledgerAddress')) document.getElementById('ledgerAddress').value = ledger.address || '';
        }
    }

    async saveLedger() {
        const id = document.getElementById('ledgerEditId').value;
        const data = {
            name: document.getElementById('ledgerName').value.trim(),
            group: document.getElementById('ledgerGroup').value,
            type: document.getElementById('ledgerType').value,
            openingBalance: parseFloat(document.getElementById('ledgerBalance').value) || 0,
            gstin: document.getElementById('ledgerGstin')?.value.trim() || '',
            address: document.getElementById('ledgerAddress')?.value.trim() || ''
        };

        if (!data.name) {
            app.showToast('Ledger name is required', 'error');
            return;
        }

        try {
            if (id) {
                data.id = parseInt(id);
                const existing = await this.db.getById('ledgers', data.id);
                data.createdAt = existing.createdAt;
                await this.updateLedger(data);
            } else {
                await this.createLedger(data);
            }
            app.closeModal('ledgerModal');
            app.showToast('Ledger saved successfully', 'success');
            this.loadLedgersTable();
        } catch (e) {
            app.showToast(e.message, 'error');
        }
    }

    async removeLedger(id) {
        if (confirm('Are you sure you want to delete this ledger?')) {
            await this.deleteLedger(id);
            app.showToast('Ledger deleted', 'success');
            this.loadLedgersTable();
        }
    }

    async showVoucherModal() {
        const ledgers = await this.getLedgers();
        const ledgerOptions = ledgers.map(l => `<option value="${l.id}">${this.escapeHtml(l.name)}</option>`).join('');

        const modalHtml = `
        <div class="modal-overlay active" id="voucherModal">
            <div class="modal" style="width:800px">
                <div class="modal-header">
                    <h3>Create Voucher</h3>
                    <button class="modal-close" onclick="app.closeModal('voucherModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-row-3">
                        <div class="form-group">
                            <label>Voucher Type</label>
                            <select id="voucherType">
                                ${this.voucherTypes.map(t => `<option value="${t}">${t}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Date</label>
                            <input type="date" id="voucherDate" value="${new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="form-group">
                            <label>Reference</label>
                            <input type="text" id="voucherRef" placeholder="Reference no.">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Narration</label>
                        <input type="text" id="voucherNarration" placeholder="Description of transaction">
                    </div>
                    <h4 class="mt-2 mb-1">Entries</h4>
                    <div id="voucherEntries">
                        <div class="voucher-entry-row">
                            <select class="entry-ledger">${ledgerOptions}</select>
                            <select class="entry-type"><option value="debit">Debit</option><option value="credit">Credit</option></select>
                            <input type="number" class="entry-amount" placeholder="Amount" step="0.01">
                            <span></span>
                            <button class="btn btn-sm btn-danger" onclick="this.closest('.voucher-entry-row').remove();app.accounting.updateVoucherTotals()">✕</button>
                        </div>
                        <div class="voucher-entry-row">
                            <select class="entry-ledger">${ledgerOptions}</select>
                            <select class="entry-type"><option value="debit">Debit</option><option value="credit" selected>Credit</option></select>
                            <input type="number" class="entry-amount" placeholder="Amount" step="0.01">
                            <span></span>
                            <button class="btn btn-sm btn-danger" onclick="this.closest('.voucher-entry-row').remove();app.accounting.updateVoucherTotals()">✕</button>
                        </div>
                    </div>
                    <button class="btn btn-sm btn-outline mt-1" onclick="app.accounting.addVoucherEntry()">+ Add Entry</button>
                    <div class="summary-row mt-2">
                        <div class="summary-box"><div class="label">Total Debit</div><div class="value" id="totalDebit">₹0.00</div></div>
                        <div class="summary-box"><div class="label">Total Credit</div><div class="value" id="totalCredit">₹0.00</div></div>
                        <div class="summary-box"><div class="label">Difference</div><div class="value" id="voucherDiff">₹0.00</div></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="app.closeModal('voucherModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="app.accounting.saveVoucher()">Save Voucher</button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Add amount change listeners
        document.querySelectorAll('.entry-amount').forEach(inp => {
            inp.addEventListener('input', () => this.updateVoucherTotals());
        });
    }

    addVoucherEntry() {
        const ledgers = document.querySelector('.entry-ledger')?.innerHTML || '';
        const row = document.createElement('div');
        row.className = 'voucher-entry-row';
        row.innerHTML = `
            <select class="entry-ledger">${ledgers}</select>
            <select class="entry-type"><option value="debit">Debit</option><option value="credit">Credit</option></select>
            <input type="number" class="entry-amount" placeholder="Amount" step="0.01" oninput="app.accounting.updateVoucherTotals()">
            <span></span>
            <button class="btn btn-sm btn-danger" onclick="this.closest('.voucher-entry-row').remove();app.accounting.updateVoucherTotals()">✕</button>`;
        document.getElementById('voucherEntries').appendChild(row);
    }

    updateVoucherTotals() {
        const rows = document.querySelectorAll('.voucher-entry-row');
        let totalDebit = 0, totalCredit = 0;
        rows.forEach(row => {
            const type = row.querySelector('.entry-type')?.value;
            const amount = parseFloat(row.querySelector('.entry-amount')?.value) || 0;
            if (type === 'debit') totalDebit += amount;
            else totalCredit += amount;
        });
        const debitEl = document.getElementById('totalDebit');
        const creditEl = document.getElementById('totalCredit');
        const diffEl = document.getElementById('voucherDiff');
        if (debitEl) debitEl.textContent = this.formatCurrency(totalDebit);
        if (creditEl) creditEl.textContent = this.formatCurrency(totalCredit);
        if (diffEl) {
            const diff = totalDebit - totalCredit;
            diffEl.textContent = this.formatCurrency(Math.abs(diff));
            diffEl.style.color = diff === 0 ? 'var(--success)' : 'var(--danger)';
        }
    }

    async saveVoucher() {
        const type = document.getElementById('voucherType').value;
        const date = document.getElementById('voucherDate').value;
        const narration = document.getElementById('voucherNarration').value.trim();
        const reference = document.getElementById('voucherRef')?.value.trim() || '';

        const entries = [];
        const rows = document.querySelectorAll('.voucher-entry-row');

        let totalDebit = 0, totalCredit = 0;
        rows.forEach(row => {
            const ledgerId = parseInt(row.querySelector('.entry-ledger')?.value);
            const entryType = row.querySelector('.entry-type')?.value;
            const amount = parseFloat(row.querySelector('.entry-amount')?.value) || 0;
            if (amount > 0) {
                entries.push({ ledgerId, type: entryType, amount });
                if (entryType === 'debit') totalDebit += amount;
                else totalCredit += amount;
            }
        });

        if (entries.length < 2) {
            app.showToast('At least 2 entries are required', 'error');
            return;
        }

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            app.showToast('Debit and Credit must be equal', 'error');
            return;
        }

        try {
            await this.createVoucher({ type, date, narration, reference, entries });
            app.closeModal('voucherModal');
            app.showToast('Voucher created successfully', 'success');
            this.loadVouchersTable();
        } catch (e) {
            app.showToast(e.message, 'error');
        }
    }

    async viewVoucher(id) {
        const voucher = await this.db.getById('vouchers', id);
        if (!voucher) return;

        const ledgers = await this.getLedgers();
        const ledgerMap = {};
        ledgers.forEach(l => ledgerMap[l.id] = l.name);

        let entriesHtml = '';
        let totalDebit = 0, totalCredit = 0;
        if (voucher.entries) {
            voucher.entries.forEach(e => {
                if (e.type === 'debit') totalDebit += e.amount;
                else totalCredit += e.amount;
                entriesHtml += `<tr>
                    <td>${this.escapeHtml(ledgerMap[e.ledgerId] || 'Unknown')}</td>
                    <td class="amount">${e.type === 'debit' ? this.formatCurrency(e.amount) : ''}</td>
                    <td class="amount">${e.type === 'credit' ? this.formatCurrency(e.amount) : ''}</td>
                </tr>`;
            });
        }

        const modalHtml = `
        <div class="modal-overlay active" id="viewVoucherModal">
            <div class="modal" style="width:700px">
                <div class="modal-header">
                    <h3>Voucher: ${this.escapeHtml(voucher.voucherNo)}</h3>
                    <button class="modal-close" onclick="app.closeModal('viewVoucherModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-row-3 mb-2">
                        <div><strong>Type:</strong> ${this.escapeHtml(voucher.type)}</div>
                        <div><strong>Date:</strong> ${voucher.date}</div>
                        <div><strong>Ref:</strong> ${this.escapeHtml(voucher.reference || '-')}</div>
                    </div>
                    <div class="mb-2"><strong>Narration:</strong> ${this.escapeHtml(voucher.narration || '-')}</div>
                    <table class="data-table">
                        <thead><tr><th>Ledger</th><th class="amount">Debit (₹)</th><th class="amount">Credit (₹)</th></tr></thead>
                        <tbody>${entriesHtml}</tbody>
                        <tfoot><tr style="border-top:2px solid #333"><td><strong>Total</strong></td>
                            <td class="amount"><strong>${this.formatCurrency(totalDebit)}</strong></td>
                            <td class="amount"><strong>${this.formatCurrency(totalCredit)}</strong></td>
                        </tr></tfoot>
                    </table>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="app.closeModal('viewVoucherModal')">Close</button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    async removeVoucher(id) {
        if (confirm('Are you sure you want to delete this voucher?')) {
            await this.deleteVoucher(id);
            app.showToast('Voucher deleted', 'success');
            this.loadVouchersTable();
        }
    }

    formatCurrency(amount) {
        return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    printReport(elementId) {
        const content = document.getElementById(elementId);
        if (!content) return;
        const win = window.open('', '_blank');
        win.document.write(`<html><head><title>Report</title><link rel="stylesheet" href="css/style.css"></head><body style="padding:20px">${content.innerHTML}</body></html>`);
        win.document.close();
        win.print();
    }
}
