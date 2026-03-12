// ============================================================
// Online Billing System - Banking Module
// ============================================================

class BankingModule {
    constructor(database) {
        this.db = database;
    }

    // Bank Accounts
    async getBankAccounts() { return await this.db.getAll('bankAccounts'); }
    async getBankAccount(id) { return await this.db.getById('bankAccounts', id); }
    async createBankAccount(data) { return await this.db.add('bankAccounts', data); }
    async updateBankAccount(data) { return await this.db.update('bankAccounts', data); }
    async deleteBankAccount(id) { return await this.db.delete('bankAccounts', id); }

    // Bank Transactions
    async getTransactions(accountId = null) {
        if (accountId) return await this.db.getByIndex('bankTransactions', 'accountId', accountId);
        return await this.db.getAll('bankTransactions');
    }
    async addTransaction(data) {
        const id = await this.db.add('bankTransactions', data);
        // Update account balance
        const account = await this.getBankAccount(data.accountId);
        if (account) {
            if (data.type === 'credit') {
                account.balance = (account.balance || 0) + data.amount;
            } else {
                account.balance = (account.balance || 0) - data.amount;
            }
            await this.updateBankAccount(account);
        }
        return id;
    }
    async deleteTransaction(id) { return await this.db.delete('bankTransactions', id); }

    // Reconciliation
    async getReconciliations(accountId = null) {
        if (accountId) return await this.db.getByIndex('reconciliations', 'accountId', accountId);
        return await this.db.getAll('reconciliations');
    }
    async addReconciliation(data) { return await this.db.add('reconciliations', data); }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = String(text ?? '');
        return div.innerHTML;
    }

    formatCurrency(amount) {
        return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // ---- RENDER ----
    renderPage() {
        return `
        <div class="tabs">
            <button class="tab active" data-tab="bank-accounts-tab">Bank Accounts</button>
            <button class="tab" data-tab="bank-transactions-tab">Transactions</button>
            <button class="tab" data-tab="reconciliation-tab">Bank Reconciliation</button>
            <button class="tab" data-tab="cheque-tab">Cheque Printing</button>
        </div>

        <!-- Bank Accounts -->
        <div id="bank-accounts-tab" class="tab-content active">
            <div class="toolbar">
                <div class="toolbar-right">
                    <button class="btn btn-primary" onclick="app.banking.showAccountModal()">+ Add Bank Account</button>
                </div>
            </div>
            <div class="stats-grid" id="bankAccountsCards"></div>
            <div class="card">
                <div class="card-body">
                    <table class="data-table" id="bankAccountsTable">
                        <thead>
                            <tr>
                                <th>Bank Name</th>
                                <th>Account No</th>
                                <th>Branch</th>
                                <th>IFSC</th>
                                <th>Type</th>
                                <th class="amount">Balance (₹)</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Transactions -->
        <div id="bank-transactions-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-left">
                    <select class="filter-select" id="txnAccountFilter" onchange="app.banking.loadTransactions()">
                        <option value="">All Accounts</option>
                    </select>
                    <select class="filter-select" id="txnTypeFilter" onchange="app.banking.loadTransactions()">
                        <option value="">All Types</option>
                        <option value="credit">Credit</option>
                        <option value="debit">Debit</option>
                    </select>
                    <input type="date" class="filter-select" id="txnFrom" onchange="app.banking.loadTransactions()">
                    <input type="date" class="filter-select" id="txnTo" onchange="app.banking.loadTransactions()">
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-primary" onclick="app.banking.showTransactionModal()">+ Add Transaction</button>
                </div>
            </div>
            <div class="card">
                <div class="card-body">
                    <table class="data-table" id="bankTxnTable">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Account</th>
                                <th>Type</th>
                                <th>Description</th>
                                <th>Reference</th>
                                <th class="amount">Amount (₹)</th>
                                <th class="amount">Balance (₹)</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Reconciliation -->
        <div id="reconciliation-tab" class="tab-content">
            <div class="card">
                <div class="card-header"><h3>Bank Reconciliation Statement</h3></div>
                <div class="card-body">
                    <div class="form-row-3 mb-2">
                        <div class="form-group">
                            <label>Bank Account</label>
                            <select id="reconAccount" onchange="app.banking.loadReconciliation()"></select>
                        </div>
                        <div class="form-group">
                            <label>Statement Date</label>
                            <input type="date" id="reconDate" value="${new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="form-group">
                            <label>Bank Statement Balance (₹)</label>
                            <input type="number" id="reconBankBalance" step="0.01" value="0">
                        </div>
                    </div>
                    <button class="btn btn-primary mb-2" onclick="app.banking.loadReconciliation()">Reconcile</button>
                    <div id="reconContent"></div>
                </div>
            </div>
        </div>

        <!-- Cheque Printing -->
        <div id="cheque-tab" class="tab-content">
            <div class="card">
                <div class="card-header"><h3>Cheque Printing</h3></div>
                <div class="card-body">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Bank Account</label>
                            <select id="chequeAccount"></select>
                        </div>
                        <div class="form-group">
                            <label>Date</label>
                            <input type="date" id="chequeDate" value="${new Date().toISOString().split('T')[0]}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Pay To</label>
                            <input type="text" id="chequePayTo">
                        </div>
                        <div class="form-group">
                            <label>Amount (₹)</label>
                            <input type="number" id="chequeAmount" step="0.01" oninput="app.banking.updateChequePreview()">
                        </div>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" id="chequeBearer"> Account Payee / Crossed</label>
                    </div>
                    <button class="btn btn-primary" onclick="app.banking.printCheque()">🖨️ Print Cheque</button>
                    <div id="chequePreview" class="mt-2" style="border:2px dashed var(--border);padding:30px;max-width:700px;background:#fffff0;font-family:'Courier New',monospace"></div>
                </div>
            </div>
        </div>`;
    }

    async loadData() {
        await this.loadBankAccounts();
        await this.loadAccountDropdowns();
    }

    async loadAccountDropdowns() {
        const accounts = await this.getBankAccounts();
        const options = accounts.map(a => `<option value="${a.id}">${this.escapeHtml(a.bankName)} - ${this.escapeHtml(a.accountNo)}</option>`).join('');

        ['txnAccountFilter', 'reconAccount', 'chequeAccount'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const hasAll = id === 'txnAccountFilter';
                el.innerHTML = (hasAll ? '<option value="">All Accounts</option>' : '') + options;
            }
        });
    }

    async loadBankAccounts() {
        const accounts = await this.getBankAccounts();
        const tbody = document.querySelector('#bankAccountsTable tbody');
        const cards = document.getElementById('bankAccountsCards');

        if (cards) {
            cards.innerHTML = accounts.map(a => `
                <div class="stat-card">
                    <div class="stat-icon blue">🏦</div>
                    <div class="stat-info">
                        <h4>${this.formatCurrency(a.balance || 0)}</h4>
                        <p>${this.escapeHtml(a.bankName)} - ${this.escapeHtml(a.accountNo)}</p>
                    </div>
                </div>`).join('');
        }

        if (tbody) {
            tbody.innerHTML = accounts.length ? accounts.map(a => `
                <tr>
                    <td><strong>${this.escapeHtml(a.bankName)}</strong></td>
                    <td>${this.escapeHtml(a.accountNo)}</td>
                    <td>${this.escapeHtml(a.branch || '-')}</td>
                    <td>${this.escapeHtml(a.ifsc || '-')}</td>
                    <td><span class="badge badge-info">${this.escapeHtml(a.accountType || '-')}</span></td>
                    <td class="amount"><strong>${this.formatCurrency(a.balance || 0)}</strong></td>
                    <td class="actions">
                        <button class="btn btn-sm btn-outline" onclick="app.banking.showAccountModal(${a.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="app.banking.removeAccount(${a.id})">Delete</button>
                    </td>
                </tr>`).join('') : '<tr><td colspan="7" class="text-center text-muted">No bank accounts added</td></tr>';
        }
    }

    async loadTransactions() {
        const accountFilter = document.getElementById('txnAccountFilter')?.value;
        const typeFilter = document.getElementById('txnTypeFilter')?.value;
        const dateFrom = document.getElementById('txnFrom')?.value;
        const dateTo = document.getElementById('txnTo')?.value;

        let txns = await this.getTransactions(accountFilter ? parseInt(accountFilter) : null);
        if (typeFilter) txns = txns.filter(t => t.type === typeFilter);
        if (dateFrom) txns = txns.filter(t => t.date >= dateFrom);
        if (dateTo) txns = txns.filter(t => t.date <= dateTo);
        txns.sort((a, b) => new Date(b.date) - new Date(a.date));

        const accounts = await this.getBankAccounts();
        const accountMap = {};
        accounts.forEach(a => accountMap[a.id] = `${a.bankName} - ${a.accountNo}`);

        const tbody = document.querySelector('#bankTxnTable tbody');
        if (!tbody) return;

        let runningBal = 0;
        tbody.innerHTML = txns.length ? txns.map(t => {
            if (t.type === 'credit') runningBal += t.amount;
            else runningBal -= t.amount;
            return `
            <tr>
                <td>${t.date}</td>
                <td>${this.escapeHtml(accountMap[t.accountId] || '-')}</td>
                <td><span class="badge ${t.type === 'credit' ? 'badge-success' : 'badge-danger'}">${t.type === 'credit' ? 'Credit' : 'Debit'}</span></td>
                <td>${this.escapeHtml(t.description || '-')}</td>
                <td>${this.escapeHtml(t.reference || '-')}</td>
                <td class="amount ${t.type === 'credit' ? 'text-success' : 'text-danger'}"><strong>${t.type === 'credit' ? '+' : '-'}${this.formatCurrency(t.amount)}</strong></td>
                <td class="amount">${this.formatCurrency(Math.abs(runningBal))}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-danger" onclick="app.banking.removeTxn(${t.id})">Delete</button>
                </td>
            </tr>`;
        }).join('') : '<tr><td colspan="8" class="text-center text-muted">No transactions found</td></tr>';
    }

    async loadReconciliation() {
        const accountId = parseInt(document.getElementById('reconAccount')?.value);
        const bankBalance = parseFloat(document.getElementById('reconBankBalance')?.value) || 0;
        const date = document.getElementById('reconDate')?.value;

        if (!accountId) return;

        const account = await this.getBankAccount(accountId);
        const txns = await this.getTransactions(accountId);
        const bookBalance = account?.balance || 0;
        const difference = bankBalance - bookBalance;

        const content = document.getElementById('reconContent');
        if (!content) return;

        // Categorize unmatched transactions
        const unmatched = txns.filter(t => !t.reconciled && t.date <= date);

        content.innerHTML = `
        <div class="recon-panel">
            <div class="recon-column">
                <h4>Book Balance (As per Books)</h4>
                <table class="data-table">
                    <tr><td>Balance as per Books</td><td class="amount"><strong>${this.formatCurrency(bookBalance)}</strong></td></tr>
                    <tr><td>Add: Cheques deposited not cleared</td><td class="amount">${this.formatCurrency(0)}</td></tr>
                    <tr><td>Less: Cheques issued not presented</td><td class="amount">${this.formatCurrency(0)}</td></tr>
                    <tr style="border-top:2px solid #333"><td><strong>Adjusted Book Balance</strong></td><td class="amount"><strong>${this.formatCurrency(bookBalance)}</strong></td></tr>
                </table>
            </div>
            <div class="recon-column">
                <h4>Bank Balance (As per Bank Statement)</h4>
                <table class="data-table">
                    <tr><td>Balance as per Bank Statement</td><td class="amount"><strong>${this.formatCurrency(bankBalance)}</strong></td></tr>
                    <tr style="border-top:2px solid #333"><td><strong>Difference</strong></td><td class="amount"><strong class="${difference === 0 ? 'text-success' : 'text-danger'}">${this.formatCurrency(difference)}</strong></td></tr>
                </table>
            </div>
        </div>
        ${unmatched.length > 0 ? `
        <div class="card mt-2">
            <div class="card-header"><h3>Unreconciled Transactions</h3></div>
            <div class="card-body">
                <table class="data-table">
                    <thead><tr><th>Date</th><th>Description</th><th>Type</th><th class="amount">Amount</th><th>Action</th></tr></thead>
                    <tbody>
                        ${unmatched.map(t => `
                            <tr>
                                <td>${t.date}</td>
                                <td>${this.escapeHtml(t.description || '-')}</td>
                                <td><span class="badge ${t.type === 'credit' ? 'badge-success' : 'badge-danger'}">${t.type}</span></td>
                                <td class="amount">${this.formatCurrency(t.amount)}</td>
                                <td><button class="btn btn-sm btn-success" onclick="app.banking.reconcileTxn(${t.id})">Match</button></td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>` : ''}
        <div class="mt-2">
            <button class="btn btn-success" onclick="app.banking.saveReconciliation(${accountId}, ${bankBalance}, ${bookBalance})">Save Reconciliation</button>
        </div>`;
    }

    async reconcileTxn(txnId) {
        const txn = await this.db.getById('bankTransactions', txnId);
        if (txn) {
            txn.reconciled = true;
            await this.db.update('bankTransactions', txn);
            app.showToast('Transaction reconciled', 'success');
            this.loadReconciliation();
        }
    }

    async saveReconciliation(accountId, bankBalance, bookBalance) {
        await this.addReconciliation({
            accountId,
            date: document.getElementById('reconDate')?.value,
            bankBalance,
            bookBalance,
            difference: bankBalance - bookBalance,
            status: bankBalance === bookBalance ? 'Matched' : 'Unmatched'
        });
        app.showToast('Reconciliation saved', 'success');
    }

    updateChequePreview() {
        const date = document.getElementById('chequeDate')?.value || '';
        const payTo = document.getElementById('chequePayTo')?.value || '';
        const amount = parseFloat(document.getElementById('chequeAmount')?.value) || 0;
        const crossed = document.getElementById('chequeBearer')?.checked;

        const preview = document.getElementById('chequePreview');
        if (preview) {
            preview.innerHTML = `
                ${crossed ? '<div style="position:absolute;font-size:24px;color:#666">A/C PAYEE</div>' : ''}
                <div style="text-align:right;margin-bottom:20px"><strong>Date:</strong> ${this.escapeHtml(date)}</div>
                <div style="margin-bottom:10px"><strong>Pay</strong> ${this.escapeHtml(payTo)} <strong>or Bearer</strong></div>
                <div style="margin-bottom:10px"><strong>Rupees</strong> ${this.numberToWords(amount)} Only</div>
                <div style="text-align:right;font-size:20px"><strong>₹ ${amount.toFixed(2)}</strong></div>`;
        }
    }

    printCheque() {
        const preview = document.getElementById('chequePreview');
        if (!preview || !preview.innerHTML) {
            app.showToast('Fill cheque details first', 'warning');
            return;
        }
        const win = window.open('', '_blank');
        win.document.write(`<html><head><title>Cheque</title></head><body style="padding:40px;font-family:'Courier New',monospace">${preview.innerHTML}</body></html>`);
        win.document.close();
        win.print();
    }

    numberToWords(num) {
        if (num === 0) return 'Zero';
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
            'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

        const convert = (n) => {
            if (n < 20) return ones[n];
            if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
            if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
            if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
            if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
            return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
        };

        return convert(Math.floor(num));
    }

    // Modals
    showAccountModal(accountId = null) {
        const isEdit = accountId !== null;
        const modalHtml = `
        <div class="modal-overlay active" id="bankAccModal">
            <div class="modal">
                <div class="modal-header">
                    <h3>${isEdit ? 'Edit Bank Account' : 'Add Bank Account'}</h3>
                    <button class="modal-close" onclick="app.closeModal('bankAccModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="bankAccEditId" value="${accountId || ''}">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Bank Name</label>
                            <input type="text" id="bankName" placeholder="e.g., State Bank of India">
                        </div>
                        <div class="form-group">
                            <label>Account Number</label>
                            <input type="text" id="bankAccNo">
                        </div>
                    </div>
                    <div class="form-row-3">
                        <div class="form-group">
                            <label>Branch</label>
                            <input type="text" id="bankBranch">
                        </div>
                        <div class="form-group">
                            <label>IFSC Code</label>
                            <input type="text" id="bankIfsc">
                        </div>
                        <div class="form-group">
                            <label>Account Type</label>
                            <select id="bankType">
                                <option value="Current">Current</option>
                                <option value="Savings">Savings</option>
                                <option value="OD">Overdraft</option>
                                <option value="CC">Cash Credit</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Opening Balance (₹)</label>
                        <input type="number" id="bankBalance" value="0" step="0.01">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="app.closeModal('bankAccModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="app.banking.saveAccount()">Save</button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        if (isEdit) this.loadAccountForEdit(accountId);
    }

    async loadAccountForEdit(id) {
        const acc = await this.getBankAccount(id);
        if (!acc) return;
        document.getElementById('bankName').value = acc.bankName || '';
        document.getElementById('bankAccNo').value = acc.accountNo || '';
        document.getElementById('bankBranch').value = acc.branch || '';
        document.getElementById('bankIfsc').value = acc.ifsc || '';
        document.getElementById('bankType').value = acc.accountType || 'Current';
        document.getElementById('bankBalance').value = acc.balance || 0;
    }

    async saveAccount() {
        const id = document.getElementById('bankAccEditId').value;
        const data = {
            bankName: document.getElementById('bankName').value.trim(),
            accountNo: document.getElementById('bankAccNo').value.trim(),
            branch: document.getElementById('bankBranch').value.trim(),
            ifsc: document.getElementById('bankIfsc').value.trim(),
            accountType: document.getElementById('bankType').value,
            balance: parseFloat(document.getElementById('bankBalance').value) || 0
        };

        if (!data.bankName || !data.accountNo) {
            app.showToast('Bank name and account number are required', 'error');
            return;
        }

        try {
            if (id) {
                data.id = parseInt(id);
                const existing = await this.getBankAccount(data.id);
                data.createdAt = existing.createdAt;
                await this.updateBankAccount(data);
            } else {
                await this.createBankAccount(data);
            }
            app.closeModal('bankAccModal');
            app.showToast('Bank account saved', 'success');
            this.loadBankAccounts();
            this.loadAccountDropdowns();
        } catch (e) {
            app.showToast(e.message, 'error');
        }
    }

    async removeAccount(id) {
        if (confirm('Delete this bank account?')) {
            await this.deleteBankAccount(id);
            app.showToast('Account deleted', 'success');
            this.loadBankAccounts();
        }
    }

    showTransactionModal() {
        const today = new Date().toISOString().split('T')[0];
        const modalHtml = `
        <div class="modal-overlay active" id="bankTxnModal">
            <div class="modal">
                <div class="modal-header">
                    <h3>Add Bank Transaction</h3>
                    <button class="modal-close" onclick="app.closeModal('bankTxnModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Bank Account</label>
                            <select id="txnAccount"></select>
                        </div>
                        <div class="form-group">
                            <label>Date</label>
                            <input type="date" id="txnDate" value="${today}">
                        </div>
                    </div>
                    <div class="form-row-3">
                        <div class="form-group">
                            <label>Type</label>
                            <select id="txnType">
                                <option value="credit">Credit (Deposit)</option>
                                <option value="debit">Debit (Withdrawal)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Amount (₹)</label>
                            <input type="number" id="txnAmount" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>Mode</label>
                            <select id="txnMode">
                                <option value="NEFT">NEFT</option>
                                <option value="RTGS">RTGS</option>
                                <option value="IMPS">IMPS</option>
                                <option value="UPI">UPI</option>
                                <option value="Cheque">Cheque</option>
                                <option value="Cash">Cash</option>
                                <option value="DD">Demand Draft</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Description</label>
                            <input type="text" id="txnDesc">
                        </div>
                        <div class="form-group">
                            <label>Reference / Cheque No</label>
                            <input type="text" id="txnRef">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="app.closeModal('bankTxnModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="app.banking.saveTxn()">Save</button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.loadTxnAccountDropdown();
    }

    async loadTxnAccountDropdown() {
        const accounts = await this.getBankAccounts();
        const select = document.getElementById('txnAccount');
        if (select) {
            select.innerHTML = accounts.map(a => `<option value="${a.id}">${this.escapeHtml(a.bankName)} - ${this.escapeHtml(a.accountNo)}</option>`).join('');
        }
    }

    async saveTxn() {
        const data = {
            accountId: parseInt(document.getElementById('txnAccount').value),
            date: document.getElementById('txnDate').value,
            type: document.getElementById('txnType').value,
            amount: parseFloat(document.getElementById('txnAmount').value) || 0,
            mode: document.getElementById('txnMode').value,
            description: document.getElementById('txnDesc').value.trim(),
            reference: document.getElementById('txnRef').value.trim(),
            reconciled: false
        };

        if (!data.amount || data.amount <= 0) {
            app.showToast('Amount must be greater than 0', 'error');
            return;
        }

        try {
            await this.addTransaction(data);
            app.closeModal('bankTxnModal');
            app.showToast('Transaction recorded', 'success');
            this.loadBankAccounts();
            this.loadTransactions();
        } catch (e) {
            app.showToast(e.message, 'error');
        }
    }

    async removeTxn(id) {
        if (confirm('Delete this transaction?')) {
            await this.deleteTransaction(id);
            app.showToast('Transaction deleted', 'success');
            this.loadTransactions();
        }
    }
}
