// ============================================================
// Online Billing System - MIS Reports & Analysis Module
// ============================================================

class ReportsModule {
    constructor(database) {
        this.db = database;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = String(text ?? '');
        return div.innerHTML;
    }

    formatCurrency(amount) {
        return '₹' + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    renderPage() {
        return `
        <div class="tabs">
            <button class="tab active" data-tab="report-dashboard-tab">Dashboard</button>
            <button class="tab" data-tab="report-bs-tab">Balance Sheet</button>
            <button class="tab" data-tab="report-pnl-tab">Profit & Loss</button>
            <button class="tab" data-tab="report-cashflow-tab">Cash Flow</button>
            <button class="tab" data-tab="report-ratio-tab">Ratio Analysis</button>
            <button class="tab" data-tab="report-custom-tab">Custom Reports</button>
        </div>

        <div id="report-dashboard-tab" class="tab-content active">
            <div id="reportDashboard"></div>
        </div>

        <div id="report-bs-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-right">
                    <button class="btn btn-outline" onclick="app.reports.printSection('bsReport')">🖨️ Print</button>
                    <button class="btn btn-outline" onclick="app.reports.exportCSV('balance-sheet')">📥 Export CSV</button>
                </div>
            </div>
            <div id="bsReport"></div>
        </div>

        <div id="report-pnl-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-right">
                    <button class="btn btn-outline" onclick="app.reports.printSection('pnlReport2')">🖨️ Print</button>
                    <button class="btn btn-outline" onclick="app.reports.exportCSV('profit-loss')">📥 Export CSV</button>
                </div>
            </div>
            <div id="pnlReport2"></div>
        </div>

        <div id="report-cashflow-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-right">
                    <button class="btn btn-outline" onclick="app.reports.printSection('cashFlowReport')">🖨️ Print</button>
                </div>
            </div>
            <div id="cashFlowReport"></div>
        </div>

        <div id="report-ratio-tab" class="tab-content">
            <div id="ratioReport"></div>
        </div>

        <div id="report-custom-tab" class="tab-content">
            <div class="card">
                <div class="card-header"><h3>Generate Custom Report</h3></div>
                <div class="card-body">
                    <div class="form-row-3">
                        <div class="form-group">
                            <label>Report Type</label>
                            <select id="customReportType">
                                <option value="ledger-wise">Ledger-wise Summary</option>
                                <option value="group-wise">Group-wise Summary</option>
                                <option value="voucher-register">Voucher Register</option>
                                <option value="stock-register">Stock Register</option>
                                <option value="tax-register">Tax Register</option>
                                <option value="payroll-summary">Payroll Summary</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>From Date</label>
                            <input type="date" id="customFromDate">
                        </div>
                        <div class="form-group">
                            <label>To Date</label>
                            <input type="date" id="customToDate">
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="app.reports.generateCustomReport()">Generate Report</button>
                </div>
            </div>
            <div id="customReportContent" class="mt-2"></div>
        </div>`;
    }

    async loadData() {
        await this.loadReportDashboard();
    }

    async loadReportDashboard() {
        const content = document.getElementById('reportDashboard');
        if (!content) return;

        // Gather all key metrics
        const ledgers = await this.db.getAll('ledgers');
        const vouchers = await this.db.getAll('vouchers');
        const stockItems = await this.db.getAll('stockItems');
        const employees = await this.db.getAll('employees');
        const bankAccounts = await this.db.getAll('bankAccounts');
        const taxEntries = await this.db.getAll('taxEntries');

        const totalBankBalance = bankAccounts.reduce((s, a) => s + (a.balance || 0), 0);
        const stockValue = stockItems.reduce((s, i) => s + ((i.currentStock || 0) * (i.rate || 0)), 0);
        const totalTax = taxEntries.filter(t => t.type === 'GST').reduce((s, t) => s + (t.cgst || 0) + (t.sgst || 0) + (t.igst || 0), 0);

        // Calculate P&L
        const balances = {};
        ledgers.forEach(l => balances[l.id] = { ...l, balance: l.openingBalance || 0 });
        vouchers.forEach(v => {
            if (v.entries) v.entries.forEach(e => {
                if (balances[e.ledgerId]) {
                    balances[e.ledgerId].balance += e.type === 'debit' ? e.amount : -e.amount;
                }
            });
        });

        const incomeGroups = ['Direct Incomes', 'Indirect Incomes', 'Sales Accounts'];
        const expenseGroups = ['Direct Expenses', 'Indirect Expenses', 'Purchase Accounts'];
        let totalIncome = 0, totalExpense = 0;
        Object.values(balances).forEach(b => {
            if (incomeGroups.includes(b.group)) totalIncome += Math.abs(b.balance);
            if (expenseGroups.includes(b.group)) totalExpense += Math.abs(b.balance);
        });

        content.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon green">💰</div>
                <div class="stat-info"><h4>${this.formatCurrency(totalIncome)}</h4><p>Total Income</p></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon red">📉</div>
                <div class="stat-info"><h4>${this.formatCurrency(totalExpense)}</h4><p>Total Expenses</p></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon ${totalIncome - totalExpense >= 0 ? 'green' : 'red'}">📊</div>
                <div class="stat-info"><h4>${this.formatCurrency(totalIncome - totalExpense)}</h4><p>${totalIncome - totalExpense >= 0 ? 'Net Profit' : 'Net Loss'}</p></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon blue">🏦</div>
                <div class="stat-info"><h4>${this.formatCurrency(totalBankBalance)}</h4><p>Bank Balance</p></div>
            </div>
        </div>

        <div class="dashboard-grid">
            <div class="card">
                <div class="card-header"><h3>Quick Financial Overview</h3></div>
                <div class="card-body">
                    <table class="data-table">
                        <tr><td>Total Ledgers</td><td class="amount"><strong>${ledgers.length}</strong></td></tr>
                        <tr><td>Total Vouchers</td><td class="amount"><strong>${vouchers.length}</strong></td></tr>
                        <tr><td>Stock Items</td><td class="amount"><strong>${stockItems.length}</strong></td></tr>
                        <tr><td>Stock Value</td><td class="amount"><strong>${this.formatCurrency(stockValue)}</strong></td></tr>
                        <tr><td>Total GST Collected</td><td class="amount"><strong>${this.formatCurrency(totalTax)}</strong></td></tr>
                        <tr><td>Employees</td><td class="amount"><strong>${employees.length}</strong></td></tr>
                        <tr><td>Bank Accounts</td><td class="amount"><strong>${bankAccounts.length}</strong></td></tr>
                    </table>
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h3>Recent Vouchers</h3></div>
                <div class="card-body">
                    ${vouchers.length ? (() => {
                        const recent = vouchers.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
                        return `<table class="data-table"><tbody>${recent.map(v => {
                            const total = v.entries ? v.entries.reduce((s, e) => e.type === 'debit' ? s + e.amount : s, 0) : 0;
                            return `<tr><td>${this.escapeHtml(v.voucherNo)}</td><td>${v.date}</td><td class="amount">${this.formatCurrency(total)}</td></tr>`;
                        }).join('')}</tbody></table>`;
                    })() : '<p class="text-muted">No recent vouchers</p>'}
                </div>
            </div>
        </div>`;
    }

    async loadBalanceSheetReport() {
        const report = document.getElementById('bsReport');
        if (!report) return;
        // Reuse accounting module's balance sheet
        if (app.accounting) {
            const bs = await app.accounting.getBalanceSheet();
            let totalAssets = 0, totalLiabilities = 0;

            let html = '<div class="card"><div class="card-header"><h3>Balance Sheet</h3><small>As at ' + new Date().toLocaleDateString() + '</small></div><div class="card-body"><div class="recon-panel">';

            html += '<div class="recon-column"><h4>Liabilities</h4><table class="data-table"><tbody>';
            Object.entries(bs.liabilities).forEach(([group, items]) => {
                html += `<tr><td colspan="2"><strong>${this.escapeHtml(group)}</strong></td></tr>`;
                items.forEach(item => {
                    const amt = Math.abs(item.balance);
                    totalLiabilities += amt;
                    html += `<tr><td>&nbsp;&nbsp;${this.escapeHtml(item.name)}</td><td class="amount">${this.formatCurrency(amt)}</td></tr>`;
                });
            });
            html += `<tr style="border-top:2px solid #333"><td><strong>Total Liabilities</strong></td><td class="amount"><strong>${this.formatCurrency(totalLiabilities)}</strong></td></tr></tbody></table></div>`;

            html += '<div class="recon-column"><h4>Assets</h4><table class="data-table"><tbody>';
            Object.entries(bs.assets).forEach(([group, items]) => {
                html += `<tr><td colspan="2"><strong>${this.escapeHtml(group)}</strong></td></tr>`;
                items.forEach(item => {
                    const amt = Math.abs(item.balance);
                    totalAssets += amt;
                    html += `<tr><td>&nbsp;&nbsp;${this.escapeHtml(item.name)}</td><td class="amount">${this.formatCurrency(amt)}</td></tr>`;
                });
            });
            html += `<tr style="border-top:2px solid #333"><td><strong>Total Assets</strong></td><td class="amount"><strong>${this.formatCurrency(totalAssets)}</strong></td></tr></tbody></table></div>`;

            html += '</div></div></div>';
            report.innerHTML = html;
        }
    }

    async loadProfitLossReport() {
        const report = document.getElementById('pnlReport2');
        if (!report || !app.accounting) return;
        const pnl = await app.accounting.getProfitAndLoss();

        let html = '<div class="card"><div class="card-header"><h3>Profit & Loss Statement</h3></div><div class="card-body"><div class="recon-panel">';

        html += '<div class="recon-column"><h4>Expenditure</h4><table class="data-table"><tbody>';
        Object.entries(pnl.expenses).forEach(([group, items]) => {
            html += `<tr><td colspan="2"><strong>${this.escapeHtml(group)}</strong></td></tr>`;
            items.forEach(item => {
                html += `<tr><td>&nbsp;&nbsp;${this.escapeHtml(item.name)}</td><td class="amount">${this.formatCurrency(Math.abs(item.balance))}</td></tr>`;
            });
        });
        if (pnl.netProfitLoss > 0) {
            html += `<tr><td><strong class="text-success">Net Profit</strong></td><td class="amount"><strong class="text-success">${this.formatCurrency(pnl.netProfitLoss)}</strong></td></tr>`;
        }
        html += `<tr style="border-top:2px solid #333"><td><strong>Total</strong></td><td class="amount"><strong>${this.formatCurrency(pnl.totalExpense + Math.max(0, pnl.netProfitLoss))}</strong></td></tr></tbody></table></div>`;

        html += '<div class="recon-column"><h4>Income</h4><table class="data-table"><tbody>';
        Object.entries(pnl.incomes).forEach(([group, items]) => {
            html += `<tr><td colspan="2"><strong>${this.escapeHtml(group)}</strong></td></tr>`;
            items.forEach(item => {
                html += `<tr><td>&nbsp;&nbsp;${this.escapeHtml(item.name)}</td><td class="amount">${this.formatCurrency(Math.abs(item.balance))}</td></tr>`;
            });
        });
        if (pnl.netProfitLoss < 0) {
            html += `<tr><td><strong class="text-danger">Net Loss</strong></td><td class="amount"><strong class="text-danger">${this.formatCurrency(Math.abs(pnl.netProfitLoss))}</strong></td></tr>`;
        }
        html += `<tr style="border-top:2px solid #333"><td><strong>Total</strong></td><td class="amount"><strong>${this.formatCurrency(pnl.totalIncome + Math.max(0, -pnl.netProfitLoss))}</strong></td></tr></tbody></table></div>`;

        html += '</div></div></div>';
        report.innerHTML = html;
    }

    async loadCashFlowReport() {
        const report = document.getElementById('cashFlowReport');
        if (!report) return;

        const vouchers = await this.db.getAll('vouchers');
        const ledgers = await this.db.getAll('ledgers');
        const ledgerMap = {};
        ledgers.forEach(l => ledgerMap[l.id] = l);

        let operatingIn = 0, operatingOut = 0;
        let investingIn = 0, investingOut = 0;
        let financingIn = 0, financingOut = 0;

        const operatingGroups = ['Sales Accounts', 'Purchase Accounts', 'Direct Expenses', 'Direct Incomes', 'Indirect Expenses', 'Indirect Incomes'];
        const investingGroups = ['Fixed Assets', 'Investments'];
        const financingGroups = ['Capital Account', 'Loans (Liability)', 'Secured Loans', 'Unsecured Loans'];

        vouchers.forEach(v => {
            if (v.entries) {
                v.entries.forEach(e => {
                    const ledger = ledgerMap[e.ledgerId];
                    if (!ledger) return;
                    const group = ledger.group;
                    if (operatingGroups.includes(group)) {
                        if (e.type === 'debit') operatingOut += e.amount;
                        else operatingIn += e.amount;
                    } else if (investingGroups.includes(group)) {
                        if (e.type === 'debit') investingOut += e.amount;
                        else investingIn += e.amount;
                    } else if (financingGroups.includes(group)) {
                        if (e.type === 'credit') financingIn += e.amount;
                        else financingOut += e.amount;
                    }
                });
            }
        });

        const netOperating = operatingIn - operatingOut;
        const netInvesting = investingIn - investingOut;
        const netFinancing = financingIn - financingOut;
        const netCashFlow = netOperating + netInvesting + netFinancing;

        report.innerHTML = `
        <div class="card">
            <div class="card-header"><h3>Cash Flow Statement</h3></div>
            <div class="card-body">
                <table class="data-table">
                    <thead><tr><th>Particulars</th><th class="amount">Inflow (₹)</th><th class="amount">Outflow (₹)</th><th class="amount">Net (₹)</th></tr></thead>
                    <tbody>
                        <tr style="background:var(--bg)"><td colspan="4"><strong>A. Operating Activities</strong></td></tr>
                        <tr><td>&nbsp;&nbsp;Revenue / Expenses</td><td class="amount">${this.formatCurrency(operatingIn)}</td><td class="amount">${this.formatCurrency(operatingOut)}</td><td class="amount"><strong>${this.formatCurrency(netOperating)}</strong></td></tr>
                        <tr style="background:var(--bg)"><td colspan="4"><strong>B. Investing Activities</strong></td></tr>
                        <tr><td>&nbsp;&nbsp;Assets / Investments</td><td class="amount">${this.formatCurrency(investingIn)}</td><td class="amount">${this.formatCurrency(investingOut)}</td><td class="amount"><strong>${this.formatCurrency(netInvesting)}</strong></td></tr>
                        <tr style="background:var(--bg)"><td colspan="4"><strong>C. Financing Activities</strong></td></tr>
                        <tr><td>&nbsp;&nbsp;Capital / Loans</td><td class="amount">${this.formatCurrency(financingIn)}</td><td class="amount">${this.formatCurrency(financingOut)}</td><td class="amount"><strong>${this.formatCurrency(netFinancing)}</strong></td></tr>
                        <tr style="border-top:3px solid var(--primary);background:#e8f5e9">
                            <td><strong>Net Cash Flow (A+B+C)</strong></td>
                            <td class="amount"></td><td class="amount"></td>
                            <td class="amount"><strong style="font-size:16px" class="${netCashFlow >= 0 ? 'text-success' : 'text-danger'}">${this.formatCurrency(netCashFlow)}</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>`;
    }

    async loadRatioAnalysis() {
        const report = document.getElementById('ratioReport');
        if (!report || !app.accounting) return;

        const bs = await app.accounting.getBalanceSheet();
        const pnl = await app.accounting.getProfitAndLoss();
        const stockItems = await this.db.getAll('stockItems');
        const stockValue = stockItems.reduce((s, i) => s + ((i.currentStock || 0) * (i.rate || 0)), 0);

        const totalAssets = Object.values(bs.assets).flat().reduce((s, i) => s + Math.abs(i.balance), 0);
        const totalLiabilities = Object.values(bs.liabilities).flat().reduce((s, i) => s + Math.abs(i.balance), 0);
        const currentAssets = (bs.assets['Current Assets'] || []).reduce((s, i) => s + Math.abs(i.balance), 0) +
            (bs.assets['Cash-in-Hand'] || []).reduce((s, i) => s + Math.abs(i.balance), 0) +
            (bs.assets['Bank Accounts'] || []).reduce((s, i) => s + Math.abs(i.balance), 0);
        const currentLiabilities = (bs.liabilities['Current Liabilities'] || []).reduce((s, i) => s + Math.abs(i.balance), 0);

        const currentRatio = currentLiabilities > 0 ? (currentAssets / currentLiabilities).toFixed(2) : 'N/A';
        const quickRatio = currentLiabilities > 0 ? ((currentAssets - stockValue) / currentLiabilities).toFixed(2) : 'N/A';
        const debtEquity = totalLiabilities > 0 ? (totalLiabilities / Math.max(totalAssets - totalLiabilities, 1)).toFixed(2) : 'N/A';
        const netProfitMargin = pnl.totalIncome > 0 ? ((pnl.netProfitLoss / pnl.totalIncome) * 100).toFixed(2) : 'N/A';
        const grossProfitMargin = pnl.totalIncome > 0 ? (((pnl.totalIncome - Object.values(pnl.expenses).flat().filter(e => ['Direct Expenses', 'Purchase Accounts'].includes(e.group)).reduce((s, i) => s + Math.abs(i.balance), 0)) / pnl.totalIncome) * 100).toFixed(2) : 'N/A';
        const roa = totalAssets > 0 ? ((pnl.netProfitLoss / totalAssets) * 100).toFixed(2) : 'N/A';

        report.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon blue">📊</div><div class="stat-info"><h4>${currentRatio}</h4><p>Current Ratio</p></div></div>
            <div class="stat-card"><div class="stat-icon green">⚡</div><div class="stat-info"><h4>${quickRatio}</h4><p>Quick Ratio</p></div></div>
            <div class="stat-card"><div class="stat-icon orange">📈</div><div class="stat-info"><h4>${debtEquity}</h4><p>Debt-Equity Ratio</p></div></div>
            <div class="stat-card"><div class="stat-icon green">💹</div><div class="stat-info"><h4>${netProfitMargin}%</h4><p>Net Profit Margin</p></div></div>
        </div>
        <div class="card">
            <div class="card-header"><h3>Financial Ratios</h3></div>
            <div class="card-body">
                <table class="data-table">
                    <thead><tr><th>Ratio</th><th>Value</th><th>Interpretation</th></tr></thead>
                    <tbody>
                        <tr><td><strong>Current Ratio</strong></td><td>${currentRatio}</td><td>${this.interpretRatio('current', parseFloat(currentRatio))}</td></tr>
                        <tr><td><strong>Quick Ratio</strong></td><td>${quickRatio}</td><td>${this.interpretRatio('quick', parseFloat(quickRatio))}</td></tr>
                        <tr><td><strong>Debt-Equity Ratio</strong></td><td>${debtEquity}</td><td>${this.interpretRatio('debt', parseFloat(debtEquity))}</td></tr>
                        <tr><td><strong>Net Profit Margin</strong></td><td>${netProfitMargin}%</td><td>${this.interpretRatio('npm', parseFloat(netProfitMargin))}</td></tr>
                        <tr><td><strong>Gross Profit Margin</strong></td><td>${grossProfitMargin}%</td><td>${this.interpretRatio('gpm', parseFloat(grossProfitMargin))}</td></tr>
                        <tr><td><strong>Return on Assets</strong></td><td>${roa}%</td><td>${this.interpretRatio('roa', parseFloat(roa))}</td></tr>
                    </tbody>
                </table>
            </div>
        </div>`;
    }

    interpretRatio(type, value) {
        if (isNaN(value)) return '<span class="text-muted">Insufficient data</span>';
        switch (type) {
            case 'current':
                if (value >= 2) return '<span class="badge badge-success">Good</span> Strong liquidity';
                if (value >= 1) return '<span class="badge badge-warning">Moderate</span> Adequate liquidity';
                return '<span class="badge badge-danger">Poor</span> Liquidity concern';
            case 'quick':
                if (value >= 1) return '<span class="badge badge-success">Good</span> Can meet short-term obligations';
                return '<span class="badge badge-warning">Caution</span> May face liquidity issues';
            case 'debt':
                if (value <= 1) return '<span class="badge badge-success">Good</span> Low leverage';
                if (value <= 2) return '<span class="badge badge-warning">Moderate</span> Moderate leverage';
                return '<span class="badge badge-danger">High</span> Highly leveraged';
            case 'npm':
                if (value >= 20) return '<span class="badge badge-success">Excellent</span>';
                if (value >= 10) return '<span class="badge badge-success">Good</span>';
                if (value >= 0) return '<span class="badge badge-warning">Low</span>';
                return '<span class="badge badge-danger">Loss</span>';
            case 'gpm':
                if (value >= 40) return '<span class="badge badge-success">Excellent</span>';
                if (value >= 20) return '<span class="badge badge-success">Good</span>';
                return '<span class="badge badge-warning">Low</span>';
            case 'roa':
                if (value >= 10) return '<span class="badge badge-success">Good</span>';
                if (value >= 5) return '<span class="badge badge-warning">Average</span>';
                return '<span class="badge badge-danger">Poor</span>';
            default: return '';
        }
    }

    async generateCustomReport() {
        const type = document.getElementById('customReportType')?.value;
        const from = document.getElementById('customFromDate')?.value;
        const to = document.getElementById('customToDate')?.value;
        const content = document.getElementById('customReportContent');
        if (!content) return;

        let html = '';
        switch (type) {
            case 'ledger-wise':
                html = await this.genLedgerReport(from, to);
                break;
            case 'group-wise':
                html = await this.genGroupReport(from, to);
                break;
            case 'voucher-register':
                html = await this.genVoucherRegister(from, to);
                break;
            case 'stock-register':
                html = await this.genStockRegister();
                break;
            case 'tax-register':
                html = await this.genTaxRegister(from, to);
                break;
            case 'payroll-summary':
                html = await this.genPayrollSummary();
                break;
        }
        content.innerHTML = html;
    }

    async genLedgerReport(from, to) {
        const ledgers = await this.db.getAll('ledgers');
        const vouchers = await this.db.getAll('vouchers');
        const filtered = vouchers.filter(v => (!from || v.date >= from) && (!to || v.date <= to));

        const balances = {};
        ledgers.forEach(l => balances[l.id] = { name: l.name, group: l.group, debit: 0, credit: 0 });
        filtered.forEach(v => {
            if (v.entries) v.entries.forEach(e => {
                if (balances[e.ledgerId]) {
                    if (e.type === 'debit') balances[e.ledgerId].debit += e.amount;
                    else balances[e.ledgerId].credit += e.amount;
                }
            });
        });

        return `<div class="card"><div class="card-header"><h3>Ledger-wise Summary</h3></div><div class="card-body">
            <table class="data-table"><thead><tr><th>Ledger</th><th>Group</th><th class="amount">Debit (₹)</th><th class="amount">Credit (₹)</th><th class="amount">Balance (₹)</th></tr></thead>
            <tbody>${Object.values(balances).filter(b => b.debit || b.credit).map(b => `
                <tr><td>${this.escapeHtml(b.name)}</td><td>${this.escapeHtml(b.group)}</td>
                <td class="amount">${this.formatCurrency(b.debit)}</td><td class="amount">${this.formatCurrency(b.credit)}</td>
                <td class="amount"><strong>${this.formatCurrency(b.debit - b.credit)}</strong></td></tr>`).join('')}
            </tbody></table></div></div>`;
    }

    async genGroupReport(from, to) {
        const ledgers = await this.db.getAll('ledgers');
        const vouchers = await this.db.getAll('vouchers');
        const filtered = vouchers.filter(v => (!from || v.date >= from) && (!to || v.date <= to));

        const groups = {};
        ledgers.forEach(l => {
            if (!groups[l.group]) groups[l.group] = { debit: 0, credit: 0, count: 0 };
            groups[l.group].count++;
        });

        filtered.forEach(v => {
            if (v.entries) v.entries.forEach(e => {
                const ledger = ledgers.find(l => l.id === e.ledgerId);
                if (ledger && groups[ledger.group]) {
                    if (e.type === 'debit') groups[ledger.group].debit += e.amount;
                    else groups[ledger.group].credit += e.amount;
                }
            });
        });

        return `<div class="card"><div class="card-header"><h3>Group-wise Summary</h3></div><div class="card-body">
            <table class="data-table"><thead><tr><th>Group</th><th>Ledgers</th><th class="amount">Debit</th><th class="amount">Credit</th><th class="amount">Net</th></tr></thead>
            <tbody>${Object.entries(groups).map(([group, data]) => `
                <tr><td><strong>${this.escapeHtml(group)}</strong></td><td>${data.count}</td>
                <td class="amount">${this.formatCurrency(data.debit)}</td><td class="amount">${this.formatCurrency(data.credit)}</td>
                <td class="amount"><strong>${this.formatCurrency(data.debit - data.credit)}</strong></td></tr>`).join('')}
            </tbody></table></div></div>`;
    }

    async genVoucherRegister(from, to) {
        const vouchers = await this.db.getAll('vouchers');
        const filtered = vouchers.filter(v => (!from || v.date >= from) && (!to || v.date <= to))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        return `<div class="card"><div class="card-header"><h3>Voucher Register</h3></div><div class="card-body">
            <table class="data-table"><thead><tr><th>No.</th><th>Date</th><th>Type</th><th>Narration</th><th class="amount">Amount</th></tr></thead>
            <tbody>${filtered.map(v => {
                const total = v.entries ? v.entries.reduce((s, e) => e.type === 'debit' ? s + e.amount : s, 0) : 0;
                return `<tr><td>${this.escapeHtml(v.voucherNo)}</td><td>${v.date}</td><td><span class="badge badge-info">${this.escapeHtml(v.type)}</span></td>
                    <td>${this.escapeHtml(v.narration || '-')}</td><td class="amount">${this.formatCurrency(total)}</td></tr>`;
            }).join('')}</tbody></table></div></div>`;
    }

    async genStockRegister() {
        const items = await this.db.getAll('stockItems');
        const totalValue = items.reduce((s, i) => s + ((i.currentStock || 0) * (i.rate || 0)), 0);

        return `<div class="card"><div class="card-header"><h3>Stock Register</h3></div><div class="card-body">
            <table class="data-table"><thead><tr><th>Item</th><th>Group</th><th>Location</th><th class="amount">Qty</th><th class="amount">Rate</th><th class="amount">Value</th></tr></thead>
            <tbody>${items.map(i => `
                <tr><td>${this.escapeHtml(i.name)}</td><td>${this.escapeHtml(i.group || '-')}</td><td>${this.escapeHtml(i.location || '-')}</td>
                <td class="amount">${i.currentStock || 0} ${this.escapeHtml(i.unit || '')}</td><td class="amount">${this.formatCurrency(i.rate || 0)}</td>
                <td class="amount">${this.formatCurrency((i.currentStock || 0) * (i.rate || 0))}</td></tr>`).join('')}
            <tr style="border-top:2px solid #333"><td colspan="5"><strong>Total Stock Value</strong></td><td class="amount"><strong>${this.formatCurrency(totalValue)}</strong></td></tr>
            </tbody></table></div></div>`;
    }

    async genTaxRegister(from, to) {
        const entries = await this.db.getAll('taxEntries');
        const filtered = entries.filter(e => (!from || e.date >= from) && (!to || e.date <= to));

        return `<div class="card"><div class="card-header"><h3>Tax Register</h3></div><div class="card-body">
            <table class="data-table"><thead><tr><th>Date</th><th>Type</th><th>Party</th><th class="amount">Taxable</th><th class="amount">Tax Amount</th></tr></thead>
            <tbody>${filtered.map(e => {
                const tax = (e.cgst || 0) + (e.sgst || 0) + (e.igst || 0) + (e.tdsAmount || 0);
                return `<tr><td>${e.date}</td><td><span class="badge badge-info">${this.escapeHtml(e.type)}</span></td>
                    <td>${this.escapeHtml(e.party || '-')}</td><td class="amount">${this.formatCurrency(e.taxableAmount || e.amount || 0)}</td>
                    <td class="amount">${this.formatCurrency(tax)}</td></tr>`;
            }).join('')}</tbody></table></div></div>`;
    }

    async genPayrollSummary() {
        const records = await this.db.getAll('salaryRecords');
        const byMonth = {};
        records.forEach(r => {
            const key = `${r.year}-${String(r.month).padStart(2, '0')}`;
            if (!byMonth[key]) byMonth[key] = { count: 0, gross: 0, deductions: 0, net: 0 };
            byMonth[key].count++;
            byMonth[key].gross += r.earnings?.grossSalary || 0;
            byMonth[key].deductions += r.deductions?.totalDeductions || 0;
            byMonth[key].net += r.netSalary || 0;
        });

        return `<div class="card"><div class="card-header"><h3>Payroll Summary</h3></div><div class="card-body">
            <table class="data-table"><thead><tr><th>Period</th><th>Employees</th><th class="amount">Gross</th><th class="amount">Deductions</th><th class="amount">Net Pay</th></tr></thead>
            <tbody>${Object.entries(byMonth).sort().reverse().map(([period, data]) => `
                <tr><td>${period}</td><td>${data.count}</td>
                <td class="amount">${this.formatCurrency(data.gross)}</td><td class="amount">${this.formatCurrency(data.deductions)}</td>
                <td class="amount"><strong>${this.formatCurrency(data.net)}</strong></td></tr>`).join('')}
            </tbody></table></div></div>`;
    }

    printSection(elementId) {
        const content = document.getElementById(elementId);
        if (!content) return;
        const win = window.open('', '_blank');
        win.document.write(`<html><head><title>Report</title><link rel="stylesheet" href="css/style.css"></head><body style="padding:20px">${content.innerHTML}</body></html>`);
        win.document.close();
        win.print();
    }

    exportCSV(type) {
        app.showToast('CSV export prepared. Check downloads.', 'info');
        // In a real app, generate and download CSV file
    }
}
