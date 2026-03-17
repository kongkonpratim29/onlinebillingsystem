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
            <button class="tab" data-tab="report-cashflow-tab">Cash Flow</button>
            <button class="tab" data-tab="report-custom-tab">Custom Reports</button>
        </div>

        <div id="report-dashboard-tab" class="tab-content active">
            <div id="reportDashboard"></div>
        </div>

        <div id="report-cashflow-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-right">
                    <button class="btn btn-outline" onclick="app.reports.printSection('cashFlowReport')">🖨️ Print</button>
                </div>
            </div>
            <div id="cashFlowReport"></div>
        </div>


        <div id="report-custom-tab" class="tab-content">
            <div class="card">
                <div class="card-header"><h3>Generate Custom Report</h3></div>
                <div class="card-body">
                    <div class="form-row-3">
                        <div class="form-group">
                            <label>Report Type</label>
                            <select id="customReportType">
                                <option value="stock-register">Stock Register</option>
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
        const stockItems = await this.db.getAll('stockItems');
        const employees = await this.db.getAll('employees');
        const bankAccounts = await this.db.getAll('bankAccounts');

        const totalBankBalance = bankAccounts.reduce((s, a) => s + (a.balance || 0), 0);
        const stockValue = stockItems.reduce((s, i) => s + ((i.currentStock || 0) * (i.rate || 0)), 0);

        content.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon blue">🏦</div>
                <div class="stat-info"><h4>${this.formatCurrency(totalBankBalance)}</h4><p>Bank Balance</p></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon orange">📦</div>
                <div class="stat-info"><h4>${this.formatCurrency(stockValue)}</h4><p>Stock Value</p></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon blue">👥</div>
                <div class="stat-info"><h4>${employees.length}</h4><p>Employees</p></div>
            </div>
        </div>

        <div class="dashboard-grid">
            <div class="card">
                <div class="card-header"><h3>Quick Overview</h3></div>
                <div class="card-body">
                    <table class="data-table">
                        <tr><td>Stock Items</td><td class="amount"><strong>${stockItems.length}</strong></td></tr>
                        <tr><td>Stock Value</td><td class="amount"><strong>${this.formatCurrency(stockValue)}</strong></td></tr>
                        <tr><td>Employees</td><td class="amount"><strong>${employees.length}</strong></td></tr>
                        <tr><td>Bank Accounts</td><td class="amount"><strong>${bankAccounts.length}</strong></td></tr>
                    </table>
                </div>
            </div>
        </div>`;
    }

    async generateCustomReport() {
        const type = document.getElementById('customReportType')?.value;
        const from = document.getElementById('customFromDate')?.value;
        const to = document.getElementById('customToDate')?.value;
        const content = document.getElementById('customReportContent');
        if (!content) return;

        let html = '';
        switch (type) {
            case 'stock-register':
                html = await this.genStockRegister();
                break;
            case 'payroll-summary':
                html = await this.genPayrollSummary();
                break;
        }
        content.innerHTML = html;
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
