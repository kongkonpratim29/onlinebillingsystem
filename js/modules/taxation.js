// ============================================================
// Online Billing System - GST & Taxation Module
// ============================================================

class TaxationModule {
    constructor(database) {
        this.db = database;
        this.gstRates = [0, 5, 12, 18, 28];
        this.taxTypes = ['CGST', 'SGST', 'IGST', 'TDS', 'TCS', 'Cess'];
        this.returnTypes = ['GSTR-1', 'GSTR-2A', 'GSTR-3B', 'GSTR-9', 'GSTR-9C'];
    }

    async getTaxEntries(type = null) {
        if (type) return await this.db.getByIndex('taxEntries', 'type', type);
        return await this.db.getAll('taxEntries');
    }

    async addTaxEntry(data) { return await this.db.add('taxEntries', data); }
    async updateTaxEntry(data) { return await this.db.update('taxEntries', data); }
    async deleteTaxEntry(id) { return await this.db.delete('taxEntries', id); }

    async getGstReturns() { return await this.db.getAll('gstReturns'); }
    async addGstReturn(data) { return await this.db.add('gstReturns', data); }

    // Calculate GST breakdown
    calculateGST(amount, rate, isInterState = false) {
        const taxAmount = (amount * rate) / 100;
        if (isInterState) {
            return { igst: taxAmount, cgst: 0, sgst: 0, total: taxAmount };
        }
        return { igst: 0, cgst: taxAmount / 2, sgst: taxAmount / 2, total: taxAmount };
    }

    // Calculate TDS
    calculateTDS(amount, section, rate) {
        return { section, amount, tdsAmount: (amount * rate) / 100, rate };
    }

    // Get GST summary for period
    async getGSTSummary(fromDate, toDate) {
        const entries = await this.getTaxEntries();
        const filtered = entries.filter(e => {
            if (e.type !== 'GST') return false;
            if (fromDate && e.date < fromDate) return false;
            if (toDate && e.date > toDate) return false;
            return true;
        });

        let totalTaxable = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0, totalCess = 0;
        const rateWise = {};

        filtered.forEach(e => {
            totalTaxable += parseFloat(e.taxableAmount) || 0;
            totalCGST += parseFloat(e.cgst) || 0;
            totalSGST += parseFloat(e.sgst) || 0;
            totalIGST += parseFloat(e.igst) || 0;
            totalCess += parseFloat(e.cess) || 0;

            const rate = parseFloat(e.gstRate) || 0;
            if (!rateWise[rate]) rateWise[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };
            rateWise[rate].taxable += parseFloat(e.taxableAmount) || 0;
            rateWise[rate].cgst += parseFloat(e.cgst) || 0;
            rateWise[rate].sgst += parseFloat(e.sgst) || 0;
            rateWise[rate].igst += parseFloat(e.igst) || 0;
            rateWise[rate].cess += parseFloat(e.cess) || 0;
        });

        return { totalTaxable, totalCGST, totalSGST, totalIGST, totalCess, rateWise, entries: filtered };
    }

    // Get TDS summary
    async getTDSSummary(fromDate, toDate) {
        const entries = await this.getTaxEntries();
        return entries.filter(e => {
            if (e.type !== 'TDS') return false;
            if (fromDate && e.date < fromDate) return false;
            if (toDate && e.date > toDate) return false;
            return true;
        });
    }

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
            <button class="tab active" data-tab="gst-entries-tab">GST Entries</button>
            <button class="tab" data-tab="gst-calculator-tab">GST Calculator</button>
            <button class="tab" data-tab="gst-returns-tab">GST Returns</button>
            <button class="tab" data-tab="gst-summary-tab">GST Summary</button>
            <button class="tab" data-tab="tds-tab">TDS/TCS</button>
        </div>

        <!-- GST Entries -->
        <div id="gst-entries-tab" class="tab-content active">
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="search-box">
                        <span>🔍</span>
                        <input type="text" placeholder="Search entries...">
                    </div>
                    <select class="filter-select" id="gstEntryTypeFilter" onchange="app.taxation.loadGSTEntries()">
                        <option value="">All</option>
                        <option value="sales">Sales</option>
                        <option value="purchase">Purchase</option>
                    </select>
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-outline" onclick="app.taxation.downloadAllGSTEntries()">📥 Download All</button>
                    <button class="btn btn-primary" onclick="app.taxation.showGSTEntryModal()">+ Add GST Entry</button>
                </div>
            </div>
            <div class="card">
                <div class="card-body">
                    <table class="data-table" id="gstEntriesTable">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Invoice No</th>
                                <th>Party</th>
                                <th>GSTIN</th>
                                <th>Type</th>
                                <th class="amount">Taxable (₹)</th>
                                <th class="amount">CGST</th>
                                <th class="amount">SGST</th>
                                <th class="amount">IGST</th>
                                <th class="amount">Total (₹)</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- GST Calculator -->
        <div id="gst-calculator-tab" class="tab-content">
            <div class="card">
                <div class="card-header"><h3>GST Calculator</h3></div>
                <div class="card-body">
                    <div class="form-row-3">
                        <div class="form-group">
                            <label>Amount (₹)</label>
                            <input type="number" id="calcAmount" value="1000" step="0.01" oninput="app.taxation.calcGST()">
                        </div>
                        <div class="form-group">
                            <label>GST Rate (%)</label>
                            <select id="calcRate" onchange="app.taxation.calcGST()">
                                ${this.gstRates.map(r => `<option value="${r}" ${r === 18 ? 'selected' : ''}>${r}%</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Supply Type</label>
                            <select id="calcType" onchange="app.taxation.calcGST()">
                                <option value="intra">Intra-State (CGST + SGST)</option>
                                <option value="inter">Inter-State (IGST)</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" id="calcInclusive" onchange="app.taxation.calcGST()"> Amount is GST Inclusive</label>
                    </div>
                    <div class="summary-row mt-2" id="calcResult"></div>
                </div>
            </div>
        </div>

        <!-- GST Returns -->
        <div id="gst-returns-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-right">
                    <button class="btn btn-primary" onclick="app.taxation.generateReturn()">Generate Return</button>
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h3>GST Return Filing</h3></div>
                <div class="card-body">
                    <div class="form-row-3 mb-2">
                        <div class="form-group">
                            <label>Return Type</label>
                            <select id="returnType">
                                ${this.returnTypes.map(r => `<option value="${r}">${r}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Period From</label>
                            <input type="date" id="returnFrom">
                        </div>
                        <div class="form-group">
                            <label>Period To</label>
                            <input type="date" id="returnTo">
                        </div>
                    </div>
                    <div id="returnPreview"></div>
                </div>
            </div>
            <div class="card mt-2">
                <div class="card-header"><h3>Filed Returns</h3></div>
                <div class="card-body">
                    <table class="data-table" id="filedReturnsTable">
                        <thead>
                            <tr>
                                <th>Return Type</th>
                                <th>Period</th>
                                <th>Filed Date</th>
                                <th class="amount">Tax Liability</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- GST Summary -->
        <div id="gst-summary-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-left">
                    <input type="date" class="filter-select" id="gstSummaryFrom" onchange="app.taxation.loadGSTSummary()">
                    <input type="date" class="filter-select" id="gstSummaryTo" onchange="app.taxation.loadGSTSummary()">
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-outline" onclick="window.print()">🖨️ Print</button>
                </div>
            </div>
            <div id="gstSummaryContent"></div>
        </div>

        <!-- TDS/TCS -->
        <div id="tds-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-right">
                    <button class="btn btn-primary" onclick="app.taxation.showTDSModal()">+ Add TDS Entry</button>
                </div>
            </div>
            <div class="card">
                <div class="card-body">
                    <table class="data-table" id="tdsTable">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Party</th>
                                <th>Section</th>
                                <th class="amount">Amount (₹)</th>
                                <th class="amount">Rate %</th>
                                <th class="amount">TDS (₹)</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>`;
    }

    async loadData() {
        await this.loadGSTEntries();
        this.calcGST();
    }

    async loadGSTEntries() {
        const filter = document.getElementById('gstEntryTypeFilter')?.value;
        let entries = await this.getTaxEntries('GST');
        if (filter) entries = entries.filter(e => e.transType === filter);
        entries.sort((a, b) => new Date(b.date) - new Date(a.date));

        const tbody = document.querySelector('#gstEntriesTable tbody');
        if (!tbody) return;

        tbody.innerHTML = entries.length ? entries.map(e => {
            const total = (parseFloat(e.taxableAmount) || 0) + (parseFloat(e.cgst) || 0) + (parseFloat(e.sgst) || 0) + (parseFloat(e.igst) || 0) + (parseFloat(e.cess) || 0);
            return `
            <tr>
                <td>${e.date}</td>
                <td>${this.escapeHtml(e.invoiceNo || '-')}</td>
                <td>${this.escapeHtml(e.party || '-')}</td>
                <td>${this.escapeHtml(e.gstin || '-')}</td>
                <td><span class="badge badge-info">${this.escapeHtml(e.transType || '-')}</span></td>
                <td class="amount">${this.formatCurrency(e.taxableAmount || 0)}</td>
                <td class="amount">${this.formatCurrency(e.cgst || 0)}</td>
                <td class="amount">${this.formatCurrency(e.sgst || 0)}</td>
                <td class="amount">${this.formatCurrency(e.igst || 0)}</td>
                <td class="amount"><strong>${this.formatCurrency(total)}</strong></td>
                <td class="actions">
                    <button class="btn btn-sm btn-outline" onclick="app.taxation.viewGSTEntry(${e.id})" title="View Details">👁️</button>
                    <button class="btn btn-sm btn-secondary" onclick="app.taxation.downloadInvoicePDF(${e.id})" title="Download Tax Invoice">📄</button>
                    <button class="btn btn-sm btn-danger" onclick="app.taxation.removeEntry(${e.id})" title="Delete">🗑️</button>
                </td>
            </tr>`;
        }).join('') : '<tr><td colspan="11" class="text-center text-muted">No GST entries found</td></tr>';
    }

    calcGST() {
        const amount = parseFloat(document.getElementById('calcAmount')?.value) || 0;
        const rate = parseFloat(document.getElementById('calcRate')?.value) || 0;
        const type = document.getElementById('calcType')?.value || 'intra';
        const inclusive = document.getElementById('calcInclusive')?.checked || false;

        let taxable = amount;
        if (inclusive) {
            taxable = amount / (1 + rate / 100);
        }

        const gst = this.calculateGST(taxable, rate, type === 'inter');
        const totalAmount = taxable + gst.total;

        const result = document.getElementById('calcResult');
        if (result) {
            result.innerHTML = `
                <div class="summary-box"><div class="label">Taxable Amount</div><div class="value">${this.formatCurrency(taxable)}</div></div>
                ${type === 'intra' ? `
                    <div class="summary-box"><div class="label">CGST (${rate / 2}%)</div><div class="value">${this.formatCurrency(gst.cgst)}</div></div>
                    <div class="summary-box"><div class="label">SGST (${rate / 2}%)</div><div class="value">${this.formatCurrency(gst.sgst)}</div></div>
                ` : `
                    <div class="summary-box"><div class="label">IGST (${rate}%)</div><div class="value">${this.formatCurrency(gst.igst)}</div></div>
                `}
                <div class="summary-box"><div class="label">Total Amount</div><div class="value" style="color:var(--primary)">${this.formatCurrency(totalAmount)}</div></div>
            `;
        }
    }

    showGSTEntryModal() {
        const today = new Date().toISOString().split('T')[0];
        const modalHtml = `
        <div class="modal-overlay active" id="gstEntryModal">
            <div class="modal" style="width:700px">
                <div class="modal-header">
                    <h3>Add GST Entry</h3>
                    <button class="modal-close" onclick="app.closeModal('gstEntryModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-row-3">
                        <div class="form-group">
                            <label>Date</label>
                            <input type="date" id="gstDate" value="${today}">
                        </div>
                        <div class="form-group">
                            <label>Transaction Type</label>
                            <select id="gstTransType">
                                <option value="sales">Sales</option>
                                <option value="purchase">Purchase</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Invoice No</label>
                            <input type="text" id="gstInvoiceNo">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Party Name</label>
                            <input type="text" id="gstParty">
                        </div>
                        <div class="form-group">
                            <label>GSTIN</label>
                            <input type="text" id="gstGstin" placeholder="e.g., 29ABCDE1234F1Z5">
                        </div>
                    </div>
                    <div class="form-row-3">
                        <div class="form-group">
                            <label>Taxable Amount (₹)</label>
                            <input type="number" id="gstTaxable" step="0.01" oninput="app.taxation.updateGSTEntry()">
                        </div>
                        <div class="form-group">
                            <label>GST Rate (%)</label>
                            <select id="gstRate" onchange="app.taxation.updateGSTEntry()">
                                ${this.gstRates.map(r => `<option value="${r}" ${r === 18 ? 'selected' : ''}>${r}%</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Supply Type</label>
                            <select id="gstSupplyType" onchange="app.taxation.updateGSTEntry()">
                                <option value="intra">Intra-State</option>
                                <option value="inter">Inter-State</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row-3" id="gstBreakdown">
                        <div class="form-group">
                            <label>CGST (₹)</label>
                            <input type="number" id="gstCGST" step="0.01" readonly>
                        </div>
                        <div class="form-group">
                            <label>SGST (₹)</label>
                            <input type="number" id="gstSGST" step="0.01" readonly>
                        </div>
                        <div class="form-group">
                            <label>IGST (₹)</label>
                            <input type="number" id="gstIGST" step="0.01" readonly>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>HSN/SAC Code</label>
                        <input type="text" id="gstHsn">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="app.closeModal('gstEntryModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="app.taxation.saveGSTEntry()">Save Entry</button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    updateGSTEntry() {
        const taxable = parseFloat(document.getElementById('gstTaxable')?.value) || 0;
        const rate = parseFloat(document.getElementById('gstRate')?.value) || 0;
        const type = document.getElementById('gstSupplyType')?.value || 'intra';

        const gst = this.calculateGST(taxable, rate, type === 'inter');
        if (document.getElementById('gstCGST')) document.getElementById('gstCGST').value = gst.cgst.toFixed(2);
        if (document.getElementById('gstSGST')) document.getElementById('gstSGST').value = gst.sgst.toFixed(2);
        if (document.getElementById('gstIGST')) document.getElementById('gstIGST').value = gst.igst.toFixed(2);
    }

    async saveGSTEntry() {
        const data = {
            type: 'GST',
            date: document.getElementById('gstDate').value,
            transType: document.getElementById('gstTransType').value,
            invoiceNo: document.getElementById('gstInvoiceNo').value.trim(),
            party: document.getElementById('gstParty').value.trim(),
            gstin: document.getElementById('gstGstin').value.trim(),
            taxableAmount: parseFloat(document.getElementById('gstTaxable').value) || 0,
            gstRate: parseFloat(document.getElementById('gstRate').value) || 0,
            supplyType: document.getElementById('gstSupplyType').value,
            cgst: parseFloat(document.getElementById('gstCGST').value) || 0,
            sgst: parseFloat(document.getElementById('gstSGST').value) || 0,
            igst: parseFloat(document.getElementById('gstIGST').value) || 0,
            cess: 0,
            hsn: document.getElementById('gstHsn')?.value.trim() || '',
            totalAmount: (parseFloat(document.getElementById('gstTaxable').value) || 0) + (parseFloat(document.getElementById('gstCGST').value) || 0) + (parseFloat(document.getElementById('gstSGST').value) || 0) + (parseFloat(document.getElementById('gstIGST').value) || 0)
        };

        if (!data.party) {
            app.showToast('Party name is required', 'error');
            return;
        }

        try {
            await this.addTaxEntry(data);
            app.closeModal('gstEntryModal');
            app.showToast('GST entry saved', 'success');
            this.loadGSTEntries();
        } catch (e) {
            app.showToast(e.message, 'error');
        }
    }

    async removeEntry(id) {
        if (confirm('Delete this tax entry?')) {
            await this.deleteTaxEntry(id);
            app.showToast('Entry deleted', 'success');
            this.loadGSTEntries();
        }
    }

    async loadGSTSummary() {
        const from = document.getElementById('gstSummaryFrom')?.value;
        const to = document.getElementById('gstSummaryTo')?.value;
        const summary = await this.getGSTSummary(from, to);
        const content = document.getElementById('gstSummaryContent');
        if (!content) return;

        const totalTax = summary.totalCGST + summary.totalSGST + summary.totalIGST + summary.totalCess;

        let html = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon blue">📊</div>
                <div class="stat-info"><h4>${this.formatCurrency(summary.totalTaxable)}</h4><p>Total Taxable Value</p></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon green">💰</div>
                <div class="stat-info"><h4>${this.formatCurrency(totalTax)}</h4><p>Total Tax</p></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon orange">📋</div>
                <div class="stat-info"><h4>${summary.entries.length}</h4><p>Transactions</p></div>
            </div>
        </div>
        <div class="card">
            <div class="card-header"><h3>Rate-wise GST Summary</h3></div>
            <div class="card-body">
                <table class="data-table">
                    <thead><tr><th>GST Rate</th><th class="amount">Taxable</th><th class="amount">CGST</th><th class="amount">SGST</th><th class="amount">IGST</th><th class="amount">Total Tax</th></tr></thead>
                    <tbody>
                        ${Object.entries(summary.rateWise).map(([rate, data]) => `
                            <tr>
                                <td>${rate}%</td>
                                <td class="amount">${this.formatCurrency(data.taxable)}</td>
                                <td class="amount">${this.formatCurrency(data.cgst)}</td>
                                <td class="amount">${this.formatCurrency(data.sgst)}</td>
                                <td class="amount">${this.formatCurrency(data.igst)}</td>
                                <td class="amount"><strong>${this.formatCurrency(data.cgst + data.sgst + data.igst)}</strong></td>
                            </tr>`).join('')}
                        <tr style="border-top:2px solid #333">
                            <td><strong>Total</strong></td>
                            <td class="amount"><strong>${this.formatCurrency(summary.totalTaxable)}</strong></td>
                            <td class="amount"><strong>${this.formatCurrency(summary.totalCGST)}</strong></td>
                            <td class="amount"><strong>${this.formatCurrency(summary.totalSGST)}</strong></td>
                            <td class="amount"><strong>${this.formatCurrency(summary.totalIGST)}</strong></td>
                            <td class="amount"><strong>${this.formatCurrency(totalTax)}</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>`;
        content.innerHTML = html;
    }

    async generateReturn() {
        const returnType = document.getElementById('returnType')?.value;
        const from = document.getElementById('returnFrom')?.value;
        const to = document.getElementById('returnTo')?.value;

        if (!from || !to) {
            app.showToast('Please select period dates', 'error');
            return;
        }

        const summary = await this.getGSTSummary(from, to);
        const totalTax = summary.totalCGST + summary.totalSGST + summary.totalIGST;

        const preview = document.getElementById('returnPreview');
        if (preview) {
            preview.innerHTML = `
            <div class="card" style="border:2px solid var(--primary)">
                <div class="card-header"><h3>${returnType} - Preview</h3></div>
                <div class="card-body">
                    <div class="form-row">
                        <div><strong>Period:</strong> ${from} to ${to}</div>
                        <div><strong>Transactions:</strong> ${summary.entries.length}</div>
                    </div>
                    <table class="data-table mt-2">
                        <tr><td>Total Taxable Value</td><td class="amount">${this.formatCurrency(summary.totalTaxable)}</td></tr>
                        <tr><td>CGST</td><td class="amount">${this.formatCurrency(summary.totalCGST)}</td></tr>
                        <tr><td>SGST</td><td class="amount">${this.formatCurrency(summary.totalSGST)}</td></tr>
                        <tr><td>IGST</td><td class="amount">${this.formatCurrency(summary.totalIGST)}</td></tr>
                        <tr style="border-top:2px solid #333"><td><strong>Total Tax Liability</strong></td><td class="amount"><strong>${this.formatCurrency(totalTax)}</strong></td></tr>
                    </table>
                    <div class="mt-2">
                        <button class="btn btn-success" onclick="app.taxation.fileReturn('${returnType}', '${from}', '${to}', ${totalTax})">File Return</button>
                    </div>
                </div>
            </div>`;
        }
    }

    async fileReturn(type, from, to, liability) {
        await this.addGstReturn({
            returnType: type,
            periodFrom: from,
            periodTo: to,
            filedDate: new Date().toISOString().split('T')[0],
            taxLiability: liability,
            status: 'Filed'
        });
        app.showToast(`${type} filed successfully`, 'success');
        this.loadFiledReturns();
    }

    async loadFiledReturns() {
        const returns = await this.getGstReturns();
        const tbody = document.querySelector('#filedReturnsTable tbody');
        if (!tbody) return;

        tbody.innerHTML = returns.length ? returns.map(r => `
            <tr>
                <td><strong>${this.escapeHtml(r.returnType)}</strong></td>
                <td>${r.periodFrom} to ${r.periodTo}</td>
                <td>${r.filedDate}</td>
                <td class="amount">${this.formatCurrency(r.taxLiability)}</td>
                <td><span class="badge badge-success">${this.escapeHtml(r.status)}</span></td>
            </tr>`).join('') : '<tr><td colspan="5" class="text-center text-muted">No returns filed yet</td></tr>';
    }

    showTDSModal() {
        const today = new Date().toISOString().split('T')[0];
        const sections = ['194A - Interest', '194C - Contractor', '194H - Commission', '194I - Rent', '194J - Professional',
            '194K - Mutual Fund', '194N - Cash Withdrawal', '194O - E-commerce', '194Q - Purchase'];

        const modalHtml = `
        <div class="modal-overlay active" id="tdsModal">
            <div class="modal">
                <div class="modal-header">
                    <h3>Add TDS Entry</h3>
                    <button class="modal-close" onclick="app.closeModal('tdsModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Date</label>
                            <input type="date" id="tdsDate" value="${today}">
                        </div>
                        <div class="form-group">
                            <label>Party Name</label>
                            <input type="text" id="tdsParty">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>PAN</label>
                            <input type="text" id="tdsPan" placeholder="ABCDE1234F">
                        </div>
                        <div class="form-group">
                            <label>Section</label>
                            <select id="tdsSection">
                                ${sections.map(s => `<option value="${s}">${s}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="form-row-3">
                        <div class="form-group">
                            <label>Amount (₹)</label>
                            <input type="number" id="tdsAmount" step="0.01" oninput="app.taxation.calcTDS()">
                        </div>
                        <div class="form-group">
                            <label>TDS Rate (%)</label>
                            <input type="number" id="tdsRate" value="10" step="0.01" oninput="app.taxation.calcTDS()">
                        </div>
                        <div class="form-group">
                            <label>TDS Amount (₹)</label>
                            <input type="number" id="tdsTdsAmt" step="0.01" readonly>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="app.closeModal('tdsModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="app.taxation.saveTDS()">Save</button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    calcTDS() {
        const amount = parseFloat(document.getElementById('tdsAmount')?.value) || 0;
        const rate = parseFloat(document.getElementById('tdsRate')?.value) || 0;
        const tdsAmt = (amount * rate) / 100;
        if (document.getElementById('tdsTdsAmt')) {
            document.getElementById('tdsTdsAmt').value = tdsAmt.toFixed(2);
        }
    }

    async saveTDS() {
        const data = {
            type: 'TDS',
            date: document.getElementById('tdsDate').value,
            party: document.getElementById('tdsParty').value.trim(),
            pan: document.getElementById('tdsPan').value.trim(),
            section: document.getElementById('tdsSection').value,
            amount: parseFloat(document.getElementById('tdsAmount').value) || 0,
            tdsRate: parseFloat(document.getElementById('tdsRate').value) || 0,
            tdsAmount: parseFloat(document.getElementById('tdsTdsAmt').value) || 0
        };

        if (!data.party) {
            app.showToast('Party name is required', 'error');
            return;
        }

        try {
            await this.addTaxEntry(data);
            app.closeModal('tdsModal');
            app.showToast('TDS entry saved', 'success');
            this.loadTDSEntries();
        } catch (e) {
            app.showToast(e.message, 'error');
        }
    }

    async loadTDSEntries() {
        const entries = await this.getTaxEntries('TDS');
        entries.sort((a, b) => new Date(b.date) - new Date(a.date));

        const tbody = document.querySelector('#tdsTable tbody');
        if (!tbody) return;

        tbody.innerHTML = entries.length ? entries.map(e => `
            <tr>
                <td>${e.date}</td>
                <td>${this.escapeHtml(e.party)}</td>
                <td>${this.escapeHtml(e.section || '-')}</td>
                <td class="amount">${this.formatCurrency(e.amount || 0)}</td>
                <td class="amount">${e.tdsRate || 0}%</td>
                <td class="amount"><strong>${this.formatCurrency(e.tdsAmount || 0)}</strong></td>
                <td class="actions">
                    <button class="btn btn-sm btn-danger" onclick="app.taxation.removeEntry(${e.id})">Delete</button>
                </td>
            </tr>`).join('') : '<tr><td colspan="7" class="text-center text-muted">No TDS entries found</td></tr>';
    }

    // ---- PDF Tax Invoice (Tally ERP style) ----

    numberToWords(num) {
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
            'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

        if (num === 0) return 'Zero';
        const toWords = (n) => {
            if (n < 20) return ones[n];
            if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
            if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + toWords(n % 100) : '');
            if (n < 100000) return toWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + toWords(n % 1000) : '');
            if (n < 10000000) return toWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + toWords(n % 100000) : '');
            return toWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + toWords(n % 10000000) : '');
        };

        const rupees = Math.floor(num);
        const paise = Math.round((num - rupees) * 100);
        let result = 'Rupees ' + toWords(rupees);
        if (paise > 0) result += ' and ' + toWords(paise) + ' Paise';
        return result + ' Only';
    }

    async downloadInvoicePDF(entryId) {
        const entries = await this.getTaxEntries('GST');
        const entry = entries.find(e => e.id === entryId);
        if (!entry) {
            app.showToast('Entry not found', 'error');
            return;
        }

        const e = entry;
        const total = (parseFloat(e.taxableAmount) || 0) + (parseFloat(e.cgst) || 0) + (parseFloat(e.sgst) || 0) + (parseFloat(e.igst) || 0) + (parseFloat(e.cess) || 0);
        const isInterState = e.supplyType === 'inter';
        const invoiceDate = e.date || new Date().toISOString().split('T')[0];
        const invoiceNo = this.escapeHtml(e.invoiceNo || 'INV-' + e.id);
        const partyName = this.escapeHtml(e.party || '');
        const gstin = this.escapeHtml(e.gstin || '-');
        const hsn = this.escapeHtml(e.hsn || '-');
        const transType = (e.transType || 'sales').toLowerCase();
        const invoiceTitle = transType === 'purchase' ? 'Purchase Invoice' : 'Tax Invoice';
        const amountInWords = this.numberToWords(total);

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${invoiceTitle} - ${invoiceNo}</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Tahoma, sans-serif;
    font-size: 12px;
    color: #1a1a1a;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .invoice-container {
    max-width: 800px;
    margin: 0 auto;
    border: 2px solid #1a237e;
  }
  /* Header */
  .inv-header {
    background: linear-gradient(135deg, #1a237e, #283593);
    color: #fff;
    padding: 18px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .inv-header .company-name {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 1px;
  }
  .inv-header .company-sub {
    font-size: 11px;
    opacity: 0.85;
    margin-top: 2px;
  }
  .inv-header .inv-type {
    text-align: right;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    border: 2px solid rgba(255,255,255,0.5);
    padding: 6px 18px;
    border-radius: 4px;
  }
  /* Info row */
  .inv-info {
    display: flex;
    border-bottom: 1px solid #ccc;
  }
  .inv-info .left, .inv-info .right {
    flex: 1;
    padding: 14px 20px;
  }
  .inv-info .right {
    border-left: 1px solid #ccc;
  }
  .inv-info .label {
    font-weight: 600;
    color: #555;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }
  .inv-info .value {
    font-size: 13px;
    font-weight: 600;
    color: #1a237e;
    margin-bottom: 8px;
  }
  /* Addresses */
  .inv-addresses {
    display: flex;
    border-bottom: 1px solid #ccc;
  }
  .inv-addresses .addr {
    flex: 1;
    padding: 14px 20px;
  }
  .inv-addresses .addr + .addr {
    border-left: 1px solid #ccc;
  }
  .addr-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #888;
    margin-bottom: 4px;
    font-weight: 600;
  }
  .addr-name {
    font-size: 14px;
    font-weight: 700;
    color: #1a1a1a;
    margin-bottom: 3px;
  }
  .addr-detail {
    font-size: 12px;
    color: #444;
    line-height: 1.4;
  }
  /* Items table */
  .inv-table {
    width: 100%;
    border-collapse: collapse;
  }
  .inv-table th {
    background: #f0f0f5;
    border-top: 1px solid #ccc;
    border-bottom: 1px solid #ccc;
    padding: 8px 12px;
    text-align: left;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #555;
    font-weight: 700;
  }
  .inv-table th.r, .inv-table td.r {
    text-align: right;
  }
  .inv-table td {
    padding: 10px 12px;
    border-bottom: 1px solid #eee;
    font-size: 12px;
  }
  /* Tax breakdown */
  .tax-section {
    border-top: 1px solid #ccc;
  }
  .tax-row {
    display: flex;
    justify-content: flex-end;
    padding: 5px 20px;
    border-bottom: 1px solid #eee;
  }
  .tax-row .tax-label {
    width: 200px;
    text-align: right;
    padding-right: 20px;
    color: #555;
    font-size: 12px;
  }
  .tax-row .tax-value {
    width: 150px;
    text-align: right;
    font-size: 12px;
    font-weight: 600;
  }
  .tax-row.total {
    background: #f0f0f5;
    border-top: 2px solid #1a237e;
    border-bottom: 2px solid #1a237e;
    padding: 8px 20px;
  }
  .tax-row.total .tax-label,
  .tax-row.total .tax-value {
    font-size: 14px;
    font-weight: 700;
    color: #1a237e;
  }
  /* Amount in words */
  .inv-words {
    padding: 10px 20px;
    border-bottom: 1px solid #ccc;
    font-size: 11px;
    color: #333;
  }
  .inv-words strong {
    color: #1a237e;
  }
  /* Footer */
  .inv-footer {
    display: flex;
    border-top: 1px solid #ccc;
  }
  .inv-footer .left {
    flex: 1;
    padding: 16px 20px;
    font-size: 10px;
    color: #888;
    line-height: 1.6;
  }
  .inv-footer .right {
    width: 250px;
    border-left: 1px solid #ccc;
    padding: 16px 20px;
    text-align: center;
  }
  .inv-footer .right .sig-line {
    border-top: 1px solid #999;
    margin-top: 50px;
    padding-top: 6px;
    font-size: 11px;
    color: #555;
  }
  .inv-footer .right .for-text {
    font-size: 11px;
    font-weight: 600;
    color: #1a237e;
    margin-bottom: 4px;
  }
  /* Print button */
  .print-bar {
    text-align: center;
    padding: 16px;
    background: #f5f5f5;
  }
  .print-bar button {
    padding: 10px 30px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    border-radius: 6px;
    margin: 0 6px;
    transition: all 0.2s;
  }
  .btn-print {
    background: #1a237e;
    color: #fff;
  }
  .btn-close {
    background: #e0e0e0;
    color: #333;
  }
  @media print {
    .print-bar { display: none; }
    body { background: #fff; }
    .invoice-container { border: 2px solid #000; }
  }
</style>
</head>
<body>
  <div class="print-bar">
    <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
    <button class="btn-close" onclick="window.close()">✕ Close</button>
  </div>
  <div class="invoice-container">
    <!-- Header -->
    <div class="inv-header">
      <div>
        <div class="company-name">Online Billing System</div>
        <div class="company-sub">Online Billing &amp; Accounting System</div>
      </div>
      <div class="inv-type">${invoiceTitle}</div>
    </div>

    <!-- Invoice Info -->
    <div class="inv-info">
      <div class="left">
        <div class="label">Invoice Number</div>
        <div class="value">${invoiceNo}</div>
        <div class="label">Invoice Date</div>
        <div class="value">${new Date(invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
      </div>
      <div class="right">
        <div class="label">Place of Supply</div>
        <div class="value">${isInterState ? 'Inter-State' : 'Intra-State (Same State)'}</div>
        <div class="label">Reverse Charge</div>
        <div class="value">No</div>
      </div>
    </div>

    <!-- Addresses -->
    <div class="inv-addresses">
      <div class="addr">
        <div class="addr-title">${transType === 'purchase' ? 'Supplier Details' : 'Billed To'}</div>
        <div class="addr-name">${partyName}</div>
        <div class="addr-detail">GSTIN: ${gstin}</div>
      </div>
      <div class="addr">
        <div class="addr-title">${transType === 'purchase' ? 'Received By' : 'Shipped To'}</div>
        <div class="addr-name">${partyName}</div>
        <div class="addr-detail">GSTIN: ${gstin}</div>
      </div>
    </div>

    <!-- Items Table -->
    <table class="inv-table">
      <thead>
        <tr>
          <th style="width:40px">S.No</th>
          <th>Description of Goods/Services</th>
          <th style="width:80px">HSN/SAC</th>
          <th class="r" style="width:60px">Qty</th>
          <th class="r" style="width:80px">Rate (₹)</th>
          <th class="r" style="width:60px">GST %</th>
          <th class="r" style="width:100px">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td><strong>${transType === 'purchase' ? 'Purchase' : 'Sale'} - ${partyName}</strong></td>
          <td>${hsn}</td>
          <td class="r">1</td>
          <td class="r">${Number(e.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="r">${e.gstRate || 0}%</td>
          <td class="r"><strong>${Number(e.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
        </tr>
      </tbody>
    </table>

    <!-- Tax Breakdown -->
    <div class="tax-section">
      <div class="tax-row">
        <div class="tax-label">Taxable Amount</div>
        <div class="tax-value">₹${Number(e.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>
      ${isInterState ? `
      <div class="tax-row">
        <div class="tax-label">IGST @ ${e.gstRate || 0}%</div>
        <div class="tax-value">₹${Number(e.igst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>
      ` : `
      <div class="tax-row">
        <div class="tax-label">CGST @ ${(e.gstRate || 0) / 2}%</div>
        <div class="tax-value">₹${Number(e.cgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="tax-row">
        <div class="tax-label">SGST @ ${(e.gstRate || 0) / 2}%</div>
        <div class="tax-value">₹${Number(e.sgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>
      `}
      ${(e.cess || 0) > 0 ? `
      <div class="tax-row">
        <div class="tax-label">Cess</div>
        <div class="tax-value">₹${Number(e.cess).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>
      ` : ''}
      <div class="tax-row total">
        <div class="tax-label">Grand Total</div>
        <div class="tax-value">₹${Number(total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>
    </div>

    <!-- Amount in Words -->
    <div class="inv-words">
      <strong>Amount in Words:</strong> ${amountInWords}
    </div>

    <!-- Footer -->
    <div class="inv-footer">
      <div class="left">
        <strong>Terms & Conditions:</strong><br>
        1. Payment is due within 30 days of invoice date.<br>
        2. Interest @ 18% p.a. will be charged on overdue payments.<br>
        3. Subject to local jurisdiction.<br><br>
        <em>This is a computer-generated invoice.</em>
      </div>
      <div class="right">
        <div class="for-text">For Online Billing System</div>
        <div class="sig-line">Authorised Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>`;

        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
        } else {
            app.showToast('Please allow pop-ups to download the invoice', 'warning');
        }
    }

    // ---- View GST Entry Detail ----

    async viewGSTEntry(entryId) {
        const entries = await this.getTaxEntries('GST');
        const e = entries.find(en => en.id === entryId);
        if (!e) { app.showToast('Entry not found', 'error'); return; }

        const total = (parseFloat(e.taxableAmount) || 0) + (parseFloat(e.cgst) || 0) + (parseFloat(e.sgst) || 0) + (parseFloat(e.igst) || 0) + (parseFloat(e.cess) || 0);
        const isInter = e.supplyType === 'inter';
        const amountInWords = this.numberToWords(total);

        const modalHtml = `
        <div class="modal-overlay active" id="viewGSTModal">
            <div class="modal" style="width:800px;max-width:95vw">
                <div class="modal-header" style="background:linear-gradient(135deg,#1a237e,#283593);color:#fff;border-radius:12px 12px 0 0">
                    <h3 style="color:#fff">📋 GST Entry Details</h3>
                    <button class="modal-close" onclick="app.closeModal('viewGSTModal')" style="color:#fff;font-size:22px">&times;</button>
                </div>
                <div class="modal-body" style="padding:0">
                    <!-- Invoice badge -->
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 24px;background:#f8f9fc;border-bottom:1px solid #e3e6ef">
                        <div>
                            <span style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px">Invoice Number</span><br>
                            <strong style="font-size:18px;color:#1a237e">${this.escapeHtml(e.invoiceNo || 'N/A')}</strong>
                        </div>
                        <div style="text-align:right">
                            <span class="badge ${e.transType === 'sales' ? 'badge-success' : 'badge-info'}" style="font-size:13px;padding:6px 16px">${this.escapeHtml((e.transType || '').toUpperCase())}</span>
                        </div>
                    </div>

                    <!-- Key Details Grid -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid #e3e6ef">
                        <div style="padding:16px 24px;border-right:1px solid #e3e6ef">
                            <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Party Name</div>
                            <div style="font-size:15px;font-weight:600">${this.escapeHtml(e.party || '-')}</div>
                        </div>
                        <div style="padding:16px 24px">
                            <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">GSTIN</div>
                            <div style="font-size:15px;font-weight:600;font-family:monospace">${this.escapeHtml(e.gstin || '-')}</div>
                        </div>
                        <div style="padding:16px 24px;border-right:1px solid #e3e6ef;border-top:1px solid #e3e6ef">
                            <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Date</div>
                            <div style="font-size:15px;font-weight:600">${e.date ? new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}</div>
                        </div>
                        <div style="padding:16px 24px;border-top:1px solid #e3e6ef">
                            <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">HSN/SAC Code</div>
                            <div style="font-size:15px;font-weight:600">${this.escapeHtml(e.hsn || '-')}</div>
                        </div>
                    </div>

                    <!-- Tax Breakdown Table -->
                    <div style="padding:20px 24px">
                        <h4 style="margin-bottom:12px;color:#1a237e;font-size:14px">Tax Breakdown</h4>
                        <table style="width:100%;border-collapse:collapse;border:1px solid #e3e6ef;border-radius:8px;overflow:hidden">
                            <thead>
                                <tr style="background:linear-gradient(180deg,#f0f2f8,#e8ecf4)">
                                    <th style="padding:10px 16px;text-align:left;font-size:12px;color:#555;font-weight:700;letter-spacing:0.3px">Component</th>
                                    <th style="padding:10px 16px;text-align:center;font-size:12px;color:#555;font-weight:700">Rate</th>
                                    <th style="padding:10px 16px;text-align:right;font-size:12px;color:#555;font-weight:700">Amount (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="border-bottom:1px solid #f0f0f0">
                                    <td style="padding:10px 16px;font-weight:500">Taxable Value</td>
                                    <td style="padding:10px 16px;text-align:center">—</td>
                                    <td style="padding:10px 16px;text-align:right;font-family:monospace;font-weight:600">${this.formatCurrency(e.taxableAmount || 0)}</td>
                                </tr>
                                ${isInter ? `
                                <tr style="border-bottom:1px solid #f0f0f0;background:#f9fafb">
                                    <td style="padding:10px 16px;font-weight:500">IGST</td>
                                    <td style="padding:10px 16px;text-align:center">${e.gstRate || 0}%</td>
                                    <td style="padding:10px 16px;text-align:right;font-family:monospace;font-weight:600">${this.formatCurrency(e.igst || 0)}</td>
                                </tr>
                                ` : `
                                <tr style="border-bottom:1px solid #f0f0f0;background:#f9fafb">
                                    <td style="padding:10px 16px;font-weight:500">CGST</td>
                                    <td style="padding:10px 16px;text-align:center">${(e.gstRate || 0) / 2}%</td>
                                    <td style="padding:10px 16px;text-align:right;font-family:monospace;font-weight:600">${this.formatCurrency(e.cgst || 0)}</td>
                                </tr>
                                <tr style="border-bottom:1px solid #f0f0f0">
                                    <td style="padding:10px 16px;font-weight:500">SGST</td>
                                    <td style="padding:10px 16px;text-align:center">${(e.gstRate || 0) / 2}%</td>
                                    <td style="padding:10px 16px;text-align:right;font-family:monospace;font-weight:600">${this.formatCurrency(e.sgst || 0)}</td>
                                </tr>
                                `}
                                ${(e.cess || 0) > 0 ? `
                                <tr style="border-bottom:1px solid #f0f0f0;background:#f9fafb">
                                    <td style="padding:10px 16px;font-weight:500">Cess</td>
                                    <td style="padding:10px 16px;text-align:center">—</td>
                                    <td style="padding:10px 16px;text-align:right;font-family:monospace;font-weight:600">${this.formatCurrency(e.cess)}</td>
                                </tr>
                                ` : ''}
                                <tr style="background:linear-gradient(135deg,#1a237e,#283593)">
                                    <td colspan="2" style="padding:12px 16px;font-weight:700;color:#fff;font-size:14px">Grand Total</td>
                                    <td style="padding:12px 16px;text-align:right;font-family:monospace;font-weight:700;color:#fff;font-size:16px">${this.formatCurrency(total)}</td>
                                </tr>
                            </tbody>
                        </table>
                        <div style="margin-top:12px;padding:10px 14px;background:#f8f9fc;border-radius:6px;border-left:3px solid #1a237e;font-size:12px;color:#555">
                            <strong style="color:#1a237e">Amount in Words:</strong> ${amountInWords}
                        </div>
                    </div>
                </div>
                <div class="modal-footer" style="display:flex;justify-content:space-between;align-items:center">
                    <span style="font-size:11px;color:#aaa">Entry ID: #${e.id}</span>
                    <div style="display:flex;gap:8px">
                        <button class="btn btn-outline" onclick="app.closeModal('viewGSTModal')">Close</button>
                        <button class="btn btn-primary" onclick="app.closeModal('viewGSTModal');app.taxation.downloadInvoicePDF(${e.id})">📄 Download Invoice</button>
                    </div>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // ---- Download All GST Entries as PDF ----

    async downloadAllGSTEntries() {
        const filter = document.getElementById('gstEntryTypeFilter')?.value;
        let entries = await this.getTaxEntries('GST');
        if (filter) entries = entries.filter(e => e.transType === filter);
        entries.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (!entries.length) {
            app.showToast('No GST entries to download', 'warning');
            return;
        }

        let totalTaxable = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0, totalCess = 0, grandTotal = 0;
        entries.forEach(e => {
            totalTaxable += parseFloat(e.taxableAmount) || 0;
            totalCGST += parseFloat(e.cgst) || 0;
            totalSGST += parseFloat(e.sgst) || 0;
            totalIGST += parseFloat(e.igst) || 0;
            totalCess += parseFloat(e.cess) || 0;
            grandTotal += (parseFloat(e.taxableAmount) || 0) + (parseFloat(e.cgst) || 0) + (parseFloat(e.sgst) || 0) + (parseFloat(e.igst) || 0) + (parseFloat(e.cess) || 0);
        });

        const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
        const filterText = filter ? (filter === 'sales' ? 'Sales' : 'Purchase') : 'All';

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>GST Entries Report - Online Billing System</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Tahoma, sans-serif;
    font-size: 11px;
    color: #1a1a1a;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .report-container {
    max-width: 1200px;
    margin: 0 auto;
  }
  /* Header */
  .report-header {
    background: linear-gradient(135deg, #1a237e, #283593);
    color: #fff;
    padding: 16px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 8px 8px 0 0;
  }
  .report-header .company { font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
  .report-header .subtitle { font-size: 11px; opacity: 0.8; margin-top: 2px; }
  .report-header .report-title {
    text-align: right;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    border: 2px solid rgba(255,255,255,0.4);
    padding: 6px 16px;
    border-radius: 4px;
  }
  /* Meta info */
  .report-meta {
    display: flex;
    justify-content: space-between;
    padding: 10px 24px;
    background: #f8f9fc;
    border-bottom: 1px solid #e3e6ef;
    font-size: 11px;
    color: #555;
  }
  .report-meta strong { color: #1a237e; }
  /* Table */
  .report-table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #dee2e6;
  }
  .report-table thead th {
    background: linear-gradient(180deg, #f0f2f8, #e4e7f0);
    padding: 8px 10px;
    text-align: left;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #444;
    font-weight: 700;
    border: 1px solid #dee2e6;
    white-space: nowrap;
  }
  .report-table thead th.r { text-align: right; }
  .report-table tbody td {
    padding: 7px 10px;
    border: 1px solid #eee;
    font-size: 11px;
  }
  .report-table tbody td.r {
    text-align: right;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 11px;
  }
  .report-table tbody tr:nth-child(even) { background: #fafbfd; }
  .report-table tbody tr:hover { background: #f0f2f8; }
  .report-table .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 600;
  }
  .badge-sales { background: #e8f5e9; color: #2e7d32; }
  .badge-purchase { background: #e3f2fd; color: #1565c0; }
  /* Total row */
  .report-table tfoot td {
    padding: 10px 10px;
    font-weight: 700;
    font-size: 12px;
    border: 1px solid #dee2e6;
    background: linear-gradient(135deg, #1a237e, #283593);
    color: #fff;
  }
  .report-table tfoot td.r {
    text-align: right;
    font-family: 'Consolas', 'Courier New', monospace;
    color: #fff;
  }
  /* Summary cards */
  .summary-strip {
    display: flex;
    gap: 0;
    border: 1px solid #dee2e6;
    border-top: none;
    border-radius: 0 0 8px 8px;
    overflow: hidden;
  }
  .summary-card {
    flex: 1;
    padding: 12px 16px;
    text-align: center;
    border-right: 1px solid #eee;
  }
  .summary-card:last-child { border-right: none; }
  .summary-card .sc-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #888;
    margin-bottom: 4px;
  }
  .summary-card .sc-value {
    font-size: 14px;
    font-weight: 700;
    color: #1a237e;
    font-family: 'Consolas', monospace;
  }
  /* Footer */
  .report-footer {
    margin-top: 16px;
    padding: 10px 24px;
    font-size: 10px;
    color: #aaa;
    display: flex;
    justify-content: space-between;
  }
  /* Print bar */
  .print-bar {
    text-align: center;
    padding: 14px;
    background: #f5f5f5;
    margin-bottom: 12px;
  }
  .print-bar button {
    padding: 9px 28px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    border-radius: 6px;
    margin: 0 5px;
    transition: all 0.2s;
  }
  .btn-print { background: #1a237e; color: #fff; }
  .btn-close { background: #e0e0e0; color: #333; }
  @media print {
    .print-bar { display: none; }
  }
</style>
</head>
<body>
  <div class="print-bar">
    <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
    <button class="btn-close" onclick="window.close()">✕ Close</button>
  </div>
  <div class="report-container">
    <div class="report-header">
      <div>
        <div class="company">Online Billing System</div>
        <div class="subtitle">Online Billing &amp; Accounting System</div>
      </div>
      <div class="report-title">GST Entries Report</div>
    </div>
    <div class="report-meta">
      <div><strong>Report Type:</strong> ${filterText} Entries &nbsp;|&nbsp; <strong>Total Records:</strong> ${entries.length}</div>
      <div><strong>Generated:</strong> ${today}</div>
    </div>
    <table class="report-table">
      <thead>
        <tr>
          <th style="width:30px">#</th>
          <th>Date</th>
          <th>Invoice No</th>
          <th>Party Name</th>
          <th>GSTIN</th>
          <th>Type</th>
          <th>HSN/SAC</th>
          <th class="r">Taxable (₹)</th>
          <th class="r">CGST (₹)</th>
          <th class="r">SGST (₹)</th>
          <th class="r">IGST (₹)</th>
          <th class="r">Total (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${entries.map((e, i) => {
            const t = (parseFloat(e.taxableAmount) || 0) + (parseFloat(e.cgst) || 0) + (parseFloat(e.sgst) || 0) + (parseFloat(e.igst) || 0) + (parseFloat(e.cess) || 0);
            const badgeClass = e.transType === 'sales' ? 'badge-sales' : 'badge-purchase';
            return `<tr>
              <td>${i + 1}</td>
              <td>${e.date || '-'}</td>
              <td><strong>${this.escapeHtml(e.invoiceNo || '-')}</strong></td>
              <td>${this.escapeHtml(e.party || '-')}</td>
              <td style="font-family:monospace;font-size:10px">${this.escapeHtml(e.gstin || '-')}</td>
              <td><span class="badge ${badgeClass}">${this.escapeHtml((e.transType || '-').toUpperCase())}</span></td>
              <td>${this.escapeHtml(e.hsn || '-')}</td>
              <td class="r">${Number(e.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="r">${Number(e.cgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="r">${Number(e.sgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="r">${Number(e.igst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="r"><strong>${Number(t).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
            </tr>`;
        }).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="7" style="text-align:right">TOTAL</td>
          <td class="r">${Number(totalTaxable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="r">${Number(totalCGST).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="r">${Number(totalSGST).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="r">${Number(totalIGST).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="r">${Number(grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      </tfoot>
    </table>
    <div class="summary-strip">
      <div class="summary-card">
        <div class="sc-label">Total Taxable</div>
        <div class="sc-value">₹${Number(totalTaxable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="summary-card">
        <div class="sc-label">CGST</div>
        <div class="sc-value">₹${Number(totalCGST).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="summary-card">
        <div class="sc-label">SGST</div>
        <div class="sc-value">₹${Number(totalSGST).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="summary-card">
        <div class="sc-label">IGST</div>
        <div class="sc-value">₹${Number(totalIGST).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="summary-card" style="background:#f0f2f8">
        <div class="sc-label">Grand Total</div>
        <div class="sc-value" style="font-size:16px">₹${Number(grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      </div>
    </div>
    <div class="report-footer">
      <div>This is a computer-generated report from Online Billing System.</div>
      <div>Page 1 of 1</div>
    </div>
  </div>
</body>
</html>`;

        const printWindow = window.open('', '_blank', 'width=1100,height=700');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
        } else {
            app.showToast('Please allow pop-ups to download the report', 'warning');
        }
    }
}
