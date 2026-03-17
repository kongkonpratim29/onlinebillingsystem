// ============================================================
// Online Billing System - Sales Module
// Features: Customers, Quotes, Sales Orders, Invoices,
//           Recurring Invoices, Delivery Challans,
//           Payments Received, Credit Notes
// ============================================================

class SalesModule {
    constructor(database) {
        this.db = database;
        this.paymentTermsOptions = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 90'];
        this.paymentModes = ['Cash', 'Bank Transfer', 'Cheque', 'UPI', 'Card', 'Online'];
        this.frequencies = ['weekly', 'monthly', 'quarterly', 'half-yearly', 'yearly'];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = String(text ?? '');
        return div.innerHTML;
    }

    formatCurrency(amount) {
        return '₹' + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    pdfCurrency(amount) {
        return 'Rs. ' + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    formatDate(dateStr) {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    generateNo(prefix) {
        const ts = Date.now().toString(36).toUpperCase();
        return prefix + '-' + ts;
    }

    // ===== CRUD helpers =====
    async getCustomers() { return await this.db.getAll('customers'); }
    async getCustomer(id) { return await this.db.getById('customers', id); }
    async saveCustomer(data) { return data.id ? await this.db.update('customers', data) : await this.db.add('customers', data); }
    async deleteCustomer(id) { return await this.db.delete('customers', id); }

    async getQuotes() { return await this.db.getAll('quotes'); }
    async getQuote(id) { return await this.db.getById('quotes', id); }
    async saveQuote(data) { return data.id ? await this.db.update('quotes', data) : await this.db.add('quotes', data); }
    async deleteQuote(id) { return await this.db.delete('quotes', id); }

    async getSalesOrders() { return await this.db.getAll('salesOrders'); }
    async getSalesOrder(id) { return await this.db.getById('salesOrders', id); }
    async saveSalesOrder(data) { return data.id ? await this.db.update('salesOrders', data) : await this.db.add('salesOrders', data); }
    async deleteSalesOrder(id) { return await this.db.delete('salesOrders', id); }

    async getInvoices() { return await this.db.getAll('invoices'); }
    async getInvoice(id) { return await this.db.getById('invoices', id); }
    async saveInvoice(data) { return data.id ? await this.db.update('invoices', data) : await this.db.add('invoices', data); }
    async deleteInvoice(id) { return await this.db.delete('invoices', id); }

    async getRecurringInvoices() { return await this.db.getAll('recurringInvoices'); }
    async saveRecurringInvoice(data) { return data.id ? await this.db.update('recurringInvoices', data) : await this.db.add('recurringInvoices', data); }
    async deleteRecurringInvoice(id) { return await this.db.delete('recurringInvoices', id); }

    async getDeliveryChallans() { return await this.db.getAll('deliveryChallans'); }
    async saveDeliveryChallan(data) { return data.id ? await this.db.update('deliveryChallans', data) : await this.db.add('deliveryChallans', data); }
    async deleteDeliveryChallan(id) { return await this.db.delete('deliveryChallans', id); }

    async getPaymentsReceived() { return await this.db.getAll('paymentsReceived'); }
    async savePaymentReceived(data) { return data.id ? await this.db.update('paymentsReceived', data) : await this.db.add('paymentsReceived', data); }
    async deletePaymentReceived(id) { return await this.db.delete('paymentsReceived', id); }

    async getCreditNotes() { return await this.db.getAll('creditNotes'); }
    async saveCreditNote(data) { return data.id ? await this.db.update('creditNotes', data) : await this.db.add('creditNotes', data); }
    async deleteCreditNote(id) { return await this.db.delete('creditNotes', id); }

    // Saved line items catalog
    async getSavedItems() { return await this.db.getAll('salesItems'); }
    async saveSavedItem(data) { return data.id ? await this.db.update('salesItems', data) : await this.db.add('salesItems', data); }
    async deleteSavedItem(id) { return await this.db.delete('salesItems', id); }

    // Auto-save new line items to the catalog after saving any document
    async syncLineItemsToCatalog(items) {
        if (!items || !items.length) return;
        const existing = await this.getSavedItems();
        const existingMap = {};
        existing.forEach(e => existingMap[e.description.toLowerCase().trim()] = e);
        for (const item of items) {
            const desc = (item.description || '').trim();
            if (!desc) continue;
            const key = desc.toLowerCase();
            if (!existingMap[key]) {
                await this.saveSavedItem({ description: desc, rate: item.rate || 0 });
                existingMap[key] = true;
            }
        }
    }

    // ===== RENDER PAGE =====
    renderPage() {
        return `
        <div class="tabs">
            <button class="tab active" data-tab="sales-customers-tab">Customers</button>
            <button class="tab" data-tab="sales-quotes-tab">Quotes</button>
            <button class="tab" data-tab="sales-orders-tab">Sales Orders</button>
            <button class="tab" data-tab="sales-invoices-tab">Invoices</button>
            <button class="tab" data-tab="sales-recurring-tab">Recurring Invoices</button>
            <button class="tab" data-tab="sales-challans-tab">Delivery Challans</button>
            <button class="tab" data-tab="sales-payments-tab">Payments Received</button>
            <button class="tab" data-tab="sales-creditnotes-tab">Credit Notes</button>
        </div>

        <!-- Customers -->
        <div id="sales-customers-tab" class="tab-content active">
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="search-box">
                        <span>🔍</span>
                        <input type="text" id="customerSearch" placeholder="Search customers..." oninput="app.sales.filterTable('customersTable','customerSearch')">
                    </div>
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-primary" onclick="app.sales.showCustomerModal()">+ Add Customer</button>
                </div>
            </div>
            <div class="card"><div class="card-body">
                <table class="data-table" id="customersTable">
                    <thead><tr>
                        <th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th>GSTIN</th><th>Payment Terms</th><th>Status</th><th>Actions</th>
                    </tr></thead>
                    <tbody></tbody>
                </table>
            </div></div>
        </div>

        <!-- Quotes -->
        <div id="sales-quotes-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="search-box">
                        <span>🔍</span>
                        <input type="text" id="quoteSearch" placeholder="Search quotes..." oninput="app.sales.filterTable('quotesTable','quoteSearch')">
                    </div>
                    <select class="filter-select" id="quoteStatusFilter" onchange="app.sales.loadQuotesTable()">
                        <option value="">All Status</option>
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="accepted">Accepted</option>
                        <option value="declined">Declined</option>
                    </select>
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-primary" onclick="app.sales.showQuoteModal()">+ Create Quote</button>
                </div>
            </div>
            <div class="card"><div class="card-body">
                <table class="data-table" id="quotesTable">
                    <thead><tr>
                        <th>Quote #</th><th>Customer</th><th>Date</th><th>Expiry</th><th class="amount">Amount</th><th>Status</th><th>Actions</th>
                    </tr></thead>
                    <tbody></tbody>
                </table>
            </div></div>
        </div>

        <!-- Sales Orders -->
        <div id="sales-orders-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="search-box">
                        <span>🔍</span>
                        <input type="text" id="orderSearch" placeholder="Search orders..." oninput="app.sales.filterTable('ordersTable','orderSearch')">
                    </div>
                    <select class="filter-select" id="orderStatusFilter" onchange="app.sales.loadOrdersTable()">
                        <option value="">All Status</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-primary" onclick="app.sales.showOrderModal()">+ Create Sales Order</button>
                </div>
            </div>
            <div class="card"><div class="card-body">
                <table class="data-table" id="ordersTable">
                    <thead><tr>
                        <th>Order #</th><th>Customer</th><th>Date</th><th>Delivery Date</th><th class="amount">Amount</th><th>Status</th><th>Actions</th>
                    </tr></thead>
                    <tbody></tbody>
                </table>
            </div></div>
        </div>

        <!-- Invoices -->
        <div id="sales-invoices-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="search-box">
                        <span>🔍</span>
                        <input type="text" id="invoiceSearch" placeholder="Search invoices..." oninput="app.sales.filterTable('invoicesTable','invoiceSearch')">
                    </div>
                    <select class="filter-select" id="invoiceStatusFilter" onchange="app.sales.loadInvoicesTable()">
                        <option value="">All Status</option>
                        <option value="unpaid">Unpaid</option>
                        <option value="partial">Partially Paid</option>
                        <option value="paid">Paid</option>
                        <option value="overdue">Overdue</option>
                    </select>
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-primary" onclick="app.sales.showInvoiceModal()">+ Create Invoice</button>
                </div>
            </div>
            <div class="card"><div class="card-body">
                <table class="data-table" id="invoicesTable">
                    <thead><tr>
                        <th>Invoice #</th><th>Customer</th><th>Date</th><th>Due Date</th><th class="amount">Total</th><th class="amount">Paid</th><th class="amount">Balance</th><th>Status</th><th>Actions</th>
                    </tr></thead>
                    <tbody></tbody>
                </table>
            </div></div>
        </div>

        <!-- Recurring Invoices -->
        <div id="sales-recurring-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="search-box">
                        <span>🔍</span>
                        <input type="text" id="recurringSearch" placeholder="Search..." oninput="app.sales.filterTable('recurringTable','recurringSearch')">
                    </div>
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-primary" onclick="app.sales.showRecurringModal()">+ Create Recurring Invoice</button>
                </div>
            </div>
            <div class="card"><div class="card-body">
                <table class="data-table" id="recurringTable">
                    <thead><tr>
                        <th>Profile Name</th><th>Customer</th><th>Frequency</th><th>Next Date</th><th class="amount">Amount</th><th>Status</th><th>Actions</th>
                    </tr></thead>
                    <tbody></tbody>
                </table>
            </div></div>
        </div>

        <!-- Delivery Challans -->
        <div id="sales-challans-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="search-box">
                        <span>🔍</span>
                        <input type="text" id="challanSearch" placeholder="Search challans..." oninput="app.sales.filterTable('challansTable','challanSearch')">
                    </div>
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-primary" onclick="app.sales.showChallanModal()">+ Create Delivery Challan</button>
                </div>
            </div>
            <div class="card"><div class="card-body">
                <table class="data-table" id="challansTable">
                    <thead><tr>
                        <th>Challan #</th><th>Customer</th><th>Date</th><th>Vehicle No</th><th>Status</th><th>Actions</th>
                    </tr></thead>
                    <tbody></tbody>
                </table>
            </div></div>
        </div>

        <!-- Payments Received -->
        <div id="sales-payments-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="search-box">
                        <span>🔍</span>
                        <input type="text" id="paymentSearch" placeholder="Search payments..." oninput="app.sales.filterTable('paymentsTable','paymentSearch')">
                    </div>
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-primary" onclick="app.sales.showPaymentModal()">+ Record Payment</button>
                </div>
            </div>
            <div class="card"><div class="card-body">
                <table class="data-table" id="paymentsTable">
                    <thead><tr>
                        <th>Payment #</th><th>Customer</th><th>Invoice #</th><th>Date</th><th class="amount">Amount</th><th>Mode</th><th>Actions</th>
                    </tr></thead>
                    <tbody></tbody>
                </table>
            </div></div>
        </div>

        <!-- Credit Notes -->
        <div id="sales-creditnotes-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="search-box">
                        <span>🔍</span>
                        <input type="text" id="creditNoteSearch" placeholder="Search credit notes..." oninput="app.sales.filterTable('creditNotesTable','creditNoteSearch')">
                    </div>
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-primary" onclick="app.sales.showCreditNoteModal()">+ Create Credit Note</button>
                </div>
            </div>
            <div class="card"><div class="card-body">
                <table class="data-table" id="creditNotesTable">
                    <thead><tr>
                        <th>Credit Note #</th><th>Customer</th><th>Invoice #</th><th>Date</th><th class="amount">Amount</th><th>Status</th><th>Actions</th>
                    </tr></thead>
                    <tbody></tbody>
                </table>
            </div></div>
        </div>`;
    }

    // ===== LOAD DATA =====
    async loadData() {
        await this.loadCustomersTable();
    }

    filterTable(tableId, searchId) {
        const search = (document.getElementById(searchId)?.value || '').toLowerCase();
        const rows = document.querySelectorAll('#' + tableId + ' tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(search) ? '' : 'none';
        });
    }

    // ===========================
    // CUSTOMERS
    // ===========================
    async loadCustomersTable() {
        const customers = await this.getCustomers();
        const tbody = document.querySelector('#customersTable tbody');
        if (!tbody) return;
        tbody.innerHTML = customers.length ? customers.map(c => `
            <tr>
                <td><strong>${this.escapeHtml(c.name)}</strong></td>
                <td>${this.escapeHtml(c.company || '-')}</td>
                <td>${this.escapeHtml(c.email || '-')}</td>
                <td>${this.escapeHtml(c.phone || '-')}</td>
                <td>${this.escapeHtml(c.gstin || '-')}</td>
                <td>${this.escapeHtml(c.paymentTerms || 'Net 30')}</td>
                <td><span class="badge ${c.active !== 0 ? 'badge-success' : 'badge-danger'}">${c.active !== 0 ? 'Active' : 'Inactive'}</span></td>
                <td class="actions">
                    <button class="btn btn-sm btn-outline" onclick="app.sales.showCustomerModal(${c.id})">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="app.sales.removeCustomer(${c.id})">Delete</button>
                </td>
            </tr>`).join('') : '<tr><td colspan="8" class="text-center text-muted">No customers found</td></tr>';
    }

    showCustomerModal(customerId = null) {
        const isEdit = customerId !== null;
        const html = `
        <div class="modal-overlay active" id="customerModal">
            <div class="modal">
                <div class="modal-header">
                    <h3>${isEdit ? 'Edit Customer' : 'Add Customer'}</h3>
                    <button class="modal-close" onclick="app.closeModal('customerModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="custEditId" value="${customerId || ''}">
                    <div class="form-row">
                        <div class="form-group"><label>Customer Name *</label><input type="text" id="custName" placeholder="Full name"></div>
                        <div class="form-group"><label>Company</label><input type="text" id="custCompany" placeholder="Company name"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Email</label><input type="email" id="custEmail" placeholder="Email"></div>
                        <div class="form-group"><label>Phone</label><input type="text" id="custPhone" placeholder="Phone"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>GSTIN</label><input type="text" id="custGstin" placeholder="GSTIN"></div>
                        <div class="form-group"><label>PAN</label><input type="text" id="custPan" placeholder="PAN"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Payment Terms</label>
                            <select id="custTerms">${this.paymentTermsOptions.map(t => `<option value="${t}">${t}</option>`).join('')}</select>
                        </div>
                        <div class="form-group"><label>Credit Limit (₹)</label><input type="number" id="custCreditLimit" value="0" step="0.01"></div>
                    </div>
                    <div class="form-group"><label>Billing Address</label><textarea id="custBillingAddr" rows="2" placeholder="Billing address"></textarea></div>
                    <div class="form-group"><label>Shipping Address</label><textarea id="custShippingAddr" rows="2" placeholder="Shipping address (leave blank if same as billing)"></textarea></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="app.closeModal('customerModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="app.sales.saveCustomerForm()">Save Customer</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        if (isEdit) this.loadCustomerForEdit(customerId);
    }

    async loadCustomerForEdit(id) {
        const c = await this.getCustomer(id);
        if (!c) return;
        document.getElementById('custName').value = c.name || '';
        document.getElementById('custCompany').value = c.company || '';
        document.getElementById('custEmail').value = c.email || '';
        document.getElementById('custPhone').value = c.phone || '';
        document.getElementById('custGstin').value = c.gstin || '';
        document.getElementById('custPan').value = c.pan || '';
        document.getElementById('custTerms').value = c.paymentTerms || 'Net 30';
        document.getElementById('custCreditLimit').value = c.creditLimit || 0;
        document.getElementById('custBillingAddr').value = c.billingAddress || '';
        document.getElementById('custShippingAddr').value = c.shippingAddress || '';
    }

    async saveCustomerForm() {
        const name = document.getElementById('custName').value.trim();
        if (!name) { app.showToast('Customer name is required', 'error'); return; }
        const data = {
            name,
            company: document.getElementById('custCompany').value.trim(),
            email: document.getElementById('custEmail').value.trim(),
            phone: document.getElementById('custPhone').value.trim(),
            gstin: document.getElementById('custGstin').value.trim(),
            pan: document.getElementById('custPan').value.trim(),
            paymentTerms: document.getElementById('custTerms').value,
            creditLimit: parseFloat(document.getElementById('custCreditLimit').value) || 0,
            billingAddress: document.getElementById('custBillingAddr').value.trim(),
            shippingAddress: document.getElementById('custShippingAddr').value.trim(),
            active: 1
        };
        const editId = document.getElementById('custEditId').value;
        if (editId) data.id = parseInt(editId);
        await this.saveCustomer(data);
        app.closeModal('customerModal');
        await this.loadCustomersTable();
        app.showToast(editId ? 'Customer updated' : 'Customer added', 'success');
    }

    async removeCustomer(id) {
        if (!confirm('Delete this customer?')) return;
        await this.deleteCustomer(id);
        await this.loadCustomersTable();
        app.showToast('Customer deleted', 'success');
    }

    // helper: customer dropdown options
    async customerOptions(selectedId) {
        const customers = await this.getCustomers();
        return customers.filter(c => c.active !== 0).map(c =>
            `<option value="${c.id}" ${c.id == selectedId ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>`
        ).join('');
    }

    // helper: line items editor HTML
    lineItemsEditor(items = []) {
        if (!items || !items.length) items = [{ description: '', qty: 1, rate: 0, amount: 0 }];
        return `
        <div style="margin-bottom:8px">
            <label style="font-weight:600;margin-right:8px">Quick Add from Saved Items:</label>
            <select id="savedItemPicker" onchange="app.sales.pickSavedItem()" style="min-width:250px">
                <option value="">-- Select saved item --</option>
            </select>
        </div>
        <table class="data-table" id="lineItemsTable">
            <thead><tr><th>Description</th><th style="width:80px">Qty</th><th style="width:100px">Rate (₹)</th><th style="width:100px" class="amount">Amount</th><th style="width:40px"></th></tr></thead>
            <tbody>
                ${items.map((it, i) => this.lineItemRow(i, it)).join('')}
            </tbody>
        </table>
        <button class="btn btn-sm btn-outline" onclick="app.sales.addLineItem()" style="margin-top:5px">+ Add Line</button>
        <div class="form-row" style="margin-top:10px">
            <div class="form-group"><label>Discount (₹)</label><input type="number" id="lineDiscount" value="0" step="0.01" oninput="app.sales.recalcTotals()"></div>
            <div class="form-group"><label>GST %</label>
                <select id="lineGstRate" onchange="app.sales.recalcTotals()">
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18" selected>18%</option>
                    <option value="28">28%</option>
                </select>
            </div>
            <div class="form-group"><label>CGST (₹)</label><input type="text" id="lineCgst" value="0.00" readonly></div>
            <div class="form-group"><label>SGST (₹)</label><input type="text" id="lineSgst" value="0.00" readonly></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Subtotal (₹)</label><input type="text" id="lineSubtotal" value="0.00" readonly></div>
            <div class="form-group"><label>Tax Amount (₹)</label><input type="text" id="lineTaxDisplay" value="0.00" readonly></div>
            <div class="form-group"><label><strong>Total (₹)</strong></label><input type="text" id="lineTotal" value="0.00" readonly style="font-weight:bold"></div>
        </div>`;
    }

    // Load saved items into the picker dropdown
    async loadSavedItemsPicker() {
        const picker = document.getElementById('savedItemPicker');
        if (!picker) return;
        const saved = await this.getSavedItems();
        picker.innerHTML = '<option value="">-- Select saved item --</option>' +
            saved.map(s => `<option value="${s.id}" data-desc="${this.escapeHtml(s.description)}" data-rate="${s.rate || 0}">${this.escapeHtml(s.description)} (₹${Number(s.rate||0).toLocaleString('en-IN', {minimumFractionDigits:2})})</option>`).join('');
    }

    // When user picks a saved item from the dropdown, add it as a new line
    pickSavedItem() {
        const picker = document.getElementById('savedItemPicker');
        if (!picker || !picker.value) return;
        const opt = picker.options[picker.selectedIndex];
        const desc = opt.dataset.desc || '';
        const rate = parseFloat(opt.dataset.rate) || 0;
        const tbody = document.querySelector('#lineItemsTable tbody');
        if (!tbody) return;
        tbody.insertAdjacentHTML('beforeend', this.lineItemRow(tbody.rows.length, { description: desc, qty: 1, rate, amount: rate }));
        this.recalcTotals();
        picker.value = '';
    }

    lineItemRow(index, item = {}) {
        return `<tr>
            <td><input type="text" class="li-desc" value="${this.escapeHtml(item.description || '')}" style="width:100%"></td>
            <td><input type="number" class="li-qty" value="${item.qty || 1}" min="0" step="1" oninput="app.sales.recalcTotals()"></td>
            <td><input type="number" class="li-rate" value="${item.rate || 0}" min="0" step="0.01" oninput="app.sales.recalcTotals()"></td>
            <td class="amount li-amount">${this.formatCurrency((item.qty || 1) * (item.rate || 0))}</td>
            <td><button class="btn btn-sm btn-danger" onclick="this.closest('tr').remove();app.sales.recalcTotals()">×</button></td>
        </tr>`;
    }

    addLineItem() {
        const tbody = document.querySelector('#lineItemsTable tbody');
        if (!tbody) return;
        const idx = tbody.rows.length;
        tbody.insertAdjacentHTML('beforeend', this.lineItemRow(idx));
    }

    recalcTotals() {
        let subtotal = 0;
        const rows = document.querySelectorAll('#lineItemsTable tbody tr');
        rows.forEach(row => {
            const qty = parseFloat(row.querySelector('.li-qty')?.value) || 0;
            const rate = parseFloat(row.querySelector('.li-rate')?.value) || 0;
            const amt = qty * rate;
            subtotal += amt;
            const amtCell = row.querySelector('.li-amount');
            if (amtCell) amtCell.textContent = this.formatCurrency(amt);
        });
        const discount = parseFloat(document.getElementById('lineDiscount')?.value) || 0;
        const gstRate = parseFloat(document.getElementById('lineGstRate')?.value) || 0;
        const taxable = subtotal - discount;
        const tax = Math.round(taxable * gstRate / 100 * 100) / 100;
        const cgst = Math.round(tax / 2 * 100) / 100;
        const sgst = Math.round((tax - cgst) * 100) / 100;
        const total = taxable + tax;

        const subtotalEl = document.getElementById('lineSubtotal');
        if (subtotalEl) subtotalEl.value = this.formatCurrency(subtotal);
        const cgstEl = document.getElementById('lineCgst');
        if (cgstEl) cgstEl.value = this.formatCurrency(cgst);
        const sgstEl = document.getElementById('lineSgst');
        if (sgstEl) sgstEl.value = this.formatCurrency(sgst);
        const taxEl = document.getElementById('lineTaxDisplay');
        if (taxEl) taxEl.value = this.formatCurrency(tax);
        const totalEl = document.getElementById('lineTotal');
        if (totalEl) totalEl.value = this.formatCurrency(total);
        return { subtotal, discount, gstRate, tax, total };
    }

    restoreGstRate(subtotal, discount, taxAmount) {
        const gstSelect = document.getElementById('lineGstRate');
        if (!gstSelect) return;
        if (!taxAmount) { gstSelect.value = '0'; this.recalcTotals(); return; }
        const taxable = (subtotal || 0) - (discount || 0);
        if (taxable <= 0) { gstSelect.value = '0'; this.recalcTotals(); return; }
        const derivedRate = Math.round((taxAmount / taxable) * 100);
        const validRates = [0, 5, 12, 18, 28];
        const closest = validRates.reduce((prev, curr) =>
            Math.abs(curr - derivedRate) < Math.abs(prev - derivedRate) ? curr : prev
        );
        gstSelect.value = String(closest);
        this.recalcTotals();
    }

    collectLineItems() {
        const items = [];
        document.querySelectorAll('#lineItemsTable tbody tr').forEach(row => {
            const description = row.querySelector('.li-desc')?.value || '';
            const qty = parseFloat(row.querySelector('.li-qty')?.value) || 0;
            const rate = parseFloat(row.querySelector('.li-rate')?.value) || 0;
            if (description || qty || rate) {
                items.push({ description, qty, rate, amount: qty * rate });
            }
        });
        return items;
    }

    // ===========================
    // QUOTES
    // ===========================
    async loadQuotesTable() {
        const statusFilter = document.getElementById('quoteStatusFilter')?.value || '';
        let quotes = await this.getQuotes();
        if (statusFilter) quotes = quotes.filter(q => q.status === statusFilter);
        quotes.sort((a, b) => new Date(b.date) - new Date(a.date));
        const tbody = document.querySelector('#quotesTable tbody');
        if (!tbody) return;
        tbody.innerHTML = quotes.length ? quotes.map(q => {
            const statusClass = { draft: 'badge-secondary', sent: 'badge-info', accepted: 'badge-success', declined: 'badge-danger' }[q.status] || 'badge-secondary';
            return `<tr>
                <td><strong>${this.escapeHtml(q.quoteNo)}</strong></td>
                <td>${this.escapeHtml(q.customerName || '-')}</td>
                <td>${this.formatDate(q.date)}</td>
                <td>${this.formatDate(q.expiryDate)}</td>
                <td class="amount">${this.formatCurrency(q.totalAmount)}</td>
                <td><span class="badge ${statusClass}">${this.escapeHtml(q.status)}</span></td>
                <td class="actions">
                    <button class="btn btn-sm btn-outline" onclick="app.sales.viewPdf('quote',${q.id})" title="View PDF">📄</button>
                    <button class="btn btn-sm btn-outline" onclick="app.sales.downloadPdf('quote',${q.id})" title="Download PDF">📥 PDF</button>
                    <button class="btn btn-sm btn-outline" onclick="app.sales.showQuoteModal(${q.id})">Edit</button>
                    ${q.status === 'accepted' ? `<button class="btn btn-sm btn-primary" onclick="app.sales.convertQuoteToOrder(${q.id})">→ Order</button>` : ''}
                    <button class="btn btn-sm btn-danger" onclick="app.sales.removeQuote(${q.id})">Delete</button>
                </td>
            </tr>`}).join('') : '<tr><td colspan="7" class="text-center text-muted">No quotes found</td></tr>';
    }

    async showQuoteModal(quoteId = null) {
        const isEdit = quoteId !== null;
        let q = isEdit ? await this.getQuote(quoteId) : null;
        const custOpts = await this.customerOptions(q?.customerId);
        const html = `
        <div class="modal-overlay active" id="quoteModal">
            <div class="modal" style="max-width:800px">
                <div class="modal-header">
                    <h3>${isEdit ? 'Edit Quote' : 'Create Quote'}</h3>
                    <button class="modal-close" onclick="app.closeModal('quoteModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="quoteEditId" value="${quoteId || ''}">
                    <div class="form-row">
                        <div class="form-group"><label>Quote #</label><input type="text" id="quoteNo" value="${q?.quoteNo || this.generateNo('QT')}" ${isEdit ? 'readonly' : ''}></div>
                        <div class="form-group"><label>Customer *</label><select id="quoteCustomer"><option value="">-- Select --</option>${custOpts}</select></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Date</label><input type="date" id="quoteDate" value="${q?.date || new Date().toISOString().slice(0,10)}"></div>
                        <div class="form-group"><label>Expiry Date</label><input type="date" id="quoteExpiry" value="${q?.expiryDate || ''}"></div>
                        <div class="form-group"><label>Status</label>
                            <select id="quoteStatus">
                                <option value="draft" ${q?.status==='draft'?'selected':''}>Draft</option>
                                <option value="sent" ${q?.status==='sent'?'selected':''}>Sent</option>
                                <option value="accepted" ${q?.status==='accepted'?'selected':''}>Accepted</option>
                                <option value="declined" ${q?.status==='declined'?'selected':''}>Declined</option>
                            </select>
                        </div>
                    </div>
                    <h4 style="margin:10px 0 5px">Line Items</h4>
                    ${this.lineItemsEditor(q?.items)}
                    <div class="form-group" style="margin-top:10px"><label>Notes</label><textarea id="quoteNotes" rows="2">${q?.notes || ''}</textarea></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="app.closeModal('quoteModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="app.sales.saveQuoteForm()">Save Quote</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        await this.loadSavedItemsPicker();
        if (q) {
            document.getElementById('lineDiscount').value = q.discount || 0;
            this.restoreGstRate(q.subtotal, q.discount, q.taxAmount);
            this.recalcTotals();
        }
    }

    async saveQuoteForm() {
        const customerId = document.getElementById('quoteCustomer').value;
        if (!customerId) { app.showToast('Please select a customer', 'error'); return; }
        const customer = await this.getCustomer(parseInt(customerId));
        const items = this.collectLineItems();
        const totals = this.recalcTotals();
        // Auto-save line items to catalog
        await this.syncLineItemsToCatalog(items);
        const data = {
            quoteNo: document.getElementById('quoteNo').value.trim(),
            customerId: parseInt(customerId),
            customerName: customer?.name || '',
            date: document.getElementById('quoteDate').value,
            expiryDate: document.getElementById('quoteExpiry').value || null,
            items,
            subtotal: totals.subtotal,
            taxAmount: totals.tax,
            discount: totals.discount,
            totalAmount: totals.total,
            notes: document.getElementById('quoteNotes').value.trim(),
            status: document.getElementById('quoteStatus').value
        };
        const editId = document.getElementById('quoteEditId').value;
        if (editId) data.id = parseInt(editId);
        await this.saveQuote(data);
        app.closeModal('quoteModal');
        await this.loadQuotesTable();
        app.showToast(editId ? 'Quote updated' : 'Quote created', 'success');
    }

    async removeQuote(id) {
        if (!confirm('Delete this quote?')) return;
        await this.deleteQuote(id);
        await this.loadQuotesTable();
        app.showToast('Quote deleted', 'success');
    }

    async convertQuoteToOrder(quoteId) {
        const q = await this.getQuote(quoteId);
        if (!q) return;
        const orderData = {
            orderNo: this.generateNo('SO'),
            quoteId: q.id,
            customerId: q.customerId,
            customerName: q.customerName,
            date: new Date().toISOString().slice(0, 10),
            deliveryDate: null,
            items: q.items,
            subtotal: q.subtotal,
            taxAmount: q.taxAmount,
            discount: q.discount,
            totalAmount: q.totalAmount,
            notes: 'Converted from quote ' + q.quoteNo,
            status: 'confirmed'
        };
        await this.saveSalesOrder(orderData);
        app.showToast('Sales Order created from quote', 'success');
    }

    // ===========================
    // SALES ORDERS
    // ===========================
    async loadOrdersTable() {
        const statusFilter = document.getElementById('orderStatusFilter')?.value || '';
        let orders = await this.getSalesOrders();
        if (statusFilter) orders = orders.filter(o => o.status === statusFilter);
        orders.sort((a, b) => new Date(b.date) - new Date(a.date));
        const tbody = document.querySelector('#ordersTable tbody');
        if (!tbody) return;
        tbody.innerHTML = orders.length ? orders.map(o => {
            const statusClass = { confirmed: 'badge-info', shipped: 'badge-warning', delivered: 'badge-success', cancelled: 'badge-danger' }[o.status] || 'badge-secondary';
            return `<tr>
                <td><strong>${this.escapeHtml(o.orderNo)}</strong></td>
                <td>${this.escapeHtml(o.customerName || '-')}</td>
                <td>${this.formatDate(o.date)}</td>
                <td>${this.formatDate(o.deliveryDate)}</td>
                <td class="amount">${this.formatCurrency(o.totalAmount)}</td>
                <td><span class="badge ${statusClass}">${this.escapeHtml(o.status)}</span></td>
                <td class="actions">
                    <button class="btn btn-sm btn-outline" onclick="app.sales.viewPdf('order',${o.id})" title="View PDF">📄</button>
                    <button class="btn btn-sm btn-outline" onclick="app.sales.downloadPdf('order',${o.id})" title="Download PDF">📥 PDF</button>
                    <button class="btn btn-sm btn-outline" onclick="app.sales.showOrderModal(${o.id})">Edit</button>
                    <button class="btn btn-sm btn-primary" onclick="app.sales.convertOrderToInvoice(${o.id})">→ Invoice</button>
                    <button class="btn btn-sm btn-danger" onclick="app.sales.removeOrder(${o.id})">Delete</button>
                </td>
            </tr>`}).join('') : '<tr><td colspan="7" class="text-center text-muted">No sales orders found</td></tr>';
    }

    async showOrderModal(orderId = null) {
        const isEdit = orderId !== null;
        let o = isEdit ? await this.getSalesOrder(orderId) : null;
        const custOpts = await this.customerOptions(o?.customerId);
        const html = `
        <div class="modal-overlay active" id="orderModal">
            <div class="modal" style="max-width:800px">
                <div class="modal-header">
                    <h3>${isEdit ? 'Edit Sales Order' : 'Create Sales Order'}</h3>
                    <button class="modal-close" onclick="app.closeModal('orderModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="orderEditId" value="${orderId || ''}">
                    <div class="form-row">
                        <div class="form-group"><label>Order #</label><input type="text" id="orderNo" value="${o?.orderNo || this.generateNo('SO')}" ${isEdit ? 'readonly' : ''}></div>
                        <div class="form-group"><label>Customer *</label><select id="orderCustomer"><option value="">-- Select --</option>${custOpts}</select></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Date</label><input type="date" id="orderDate" value="${o?.date || new Date().toISOString().slice(0,10)}"></div>
                        <div class="form-group"><label>Delivery Date</label><input type="date" id="orderDeliveryDate" value="${o?.deliveryDate || ''}"></div>
                        <div class="form-group"><label>Status</label>
                            <select id="orderStatus">
                                <option value="confirmed" ${o?.status==='confirmed'?'selected':''}>Confirmed</option>
                                <option value="shipped" ${o?.status==='shipped'?'selected':''}>Shipped</option>
                                <option value="delivered" ${o?.status==='delivered'?'selected':''}>Delivered</option>
                                <option value="cancelled" ${o?.status==='cancelled'?'selected':''}>Cancelled</option>
                            </select>
                        </div>
                    </div>
                    <h4 style="margin:10px 0 5px">Line Items</h4>
                    ${this.lineItemsEditor(o?.items)}
                    <div class="form-group" style="margin-top:10px"><label>Notes</label><textarea id="orderNotes" rows="2">${o?.notes || ''}</textarea></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="app.closeModal('orderModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="app.sales.saveOrderForm()">Save Order</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        await this.loadSavedItemsPicker();
        if (o) {
            document.getElementById('lineDiscount').value = o.discount || 0;
            this.restoreGstRate(o.subtotal, o.discount, o.taxAmount);
            this.recalcTotals();
        }
    }

    async saveOrderForm() {
        const customerId = document.getElementById('orderCustomer').value;
        if (!customerId) { app.showToast('Please select a customer', 'error'); return; }
        const customer = await this.getCustomer(parseInt(customerId));
        const items = this.collectLineItems();
        const totals = this.recalcTotals();
        await this.syncLineItemsToCatalog(items);
        const data = {
            orderNo: document.getElementById('orderNo').value.trim(),
            customerId: parseInt(customerId),
            customerName: customer?.name || '',
            date: document.getElementById('orderDate').value,
            deliveryDate: document.getElementById('orderDeliveryDate').value || null,
            items,
            subtotal: totals.subtotal,
            taxAmount: totals.tax,
            discount: totals.discount,
            totalAmount: totals.total,
            notes: document.getElementById('orderNotes').value.trim(),
            status: document.getElementById('orderStatus').value
        };
        const editId = document.getElementById('orderEditId').value;
        if (editId) data.id = parseInt(editId);
        await this.saveSalesOrder(data);
        app.closeModal('orderModal');
        await this.loadOrdersTable();
        app.showToast(editId ? 'Order updated' : 'Order created', 'success');
    }

    async removeOrder(id) {
        if (!confirm('Delete this sales order?')) return;
        await this.deleteSalesOrder(id);
        await this.loadOrdersTable();
        app.showToast('Sales order deleted', 'success');
    }

    async convertOrderToInvoice(orderId) {
        const o = await this.getSalesOrder(orderId);
        if (!o) return;
        const invData = {
            invoiceNo: this.generateNo('INV'),
            orderId: o.id,
            customerId: o.customerId,
            customerName: o.customerName,
            date: new Date().toISOString().slice(0, 10),
            dueDate: null,
            items: o.items,
            subtotal: o.subtotal,
            taxAmount: o.taxAmount,
            discount: o.discount,
            totalAmount: o.totalAmount,
            paidAmount: 0,
            notes: 'Generated from order ' + o.orderNo,
            status: 'unpaid'
        };
        await this.saveInvoice(invData);
        app.showToast('Invoice created from order', 'success');
    }

    // ===========================
    // INVOICES
    // ===========================
    async loadInvoicesTable() {
        const statusFilter = document.getElementById('invoiceStatusFilter')?.value || '';
        let invoices = await this.getInvoices();
        // Mark overdue
        const today = new Date().toISOString().slice(0, 10);
        invoices.forEach(inv => {
            if (inv.status === 'unpaid' && inv.dueDate && inv.dueDate < today) inv._overdue = true;
        });
        if (statusFilter === 'overdue') {
            invoices = invoices.filter(i => i._overdue);
        } else if (statusFilter) {
            invoices = invoices.filter(i => i.status === statusFilter);
        }
        invoices.sort((a, b) => new Date(b.date) - new Date(a.date));
        const tbody = document.querySelector('#invoicesTable tbody');
        if (!tbody) return;
        tbody.innerHTML = invoices.length ? invoices.map(inv => {
            const balance = (inv.totalAmount || 0) - (inv.paidAmount || 0);
            let statusLabel = inv.status;
            let statusClass = 'badge-secondary';
            if (inv._overdue) { statusLabel = 'overdue'; statusClass = 'badge-danger'; }
            else if (inv.status === 'paid') statusClass = 'badge-success';
            else if (inv.status === 'partial') statusClass = 'badge-warning';
            else if (inv.status === 'unpaid') statusClass = 'badge-info';
            return `<tr>
                <td><strong>${this.escapeHtml(inv.invoiceNo)}</strong></td>
                <td>${this.escapeHtml(inv.customerName || '-')}</td>
                <td>${this.formatDate(inv.date)}</td>
                <td>${this.formatDate(inv.dueDate)}</td>
                <td class="amount">${this.formatCurrency(inv.totalAmount)}</td>
                <td class="amount">${this.formatCurrency(inv.paidAmount)}</td>
                <td class="amount">${this.formatCurrency(balance)}</td>
                <td><span class="badge ${statusClass}">${this.escapeHtml(statusLabel)}</span></td>
                <td class="actions">
                    <button class="btn btn-sm btn-outline" onclick="app.sales.viewPdf('invoice',${inv.id})" title="View PDF">📄</button>
                    <button class="btn btn-sm btn-outline" onclick="app.sales.downloadPdf('invoice',${inv.id})" title="Download PDF">📥 PDF</button>
                    <button class="btn btn-sm btn-outline" onclick="app.sales.showInvoiceModal(${inv.id})">Edit</button>
                    ${inv.status !== 'paid' ? `<button class="btn btn-sm btn-primary" onclick="app.sales.showPaymentModal(null, ${inv.id})">💰 Pay</button>` : ''}
                    <button class="btn btn-sm btn-danger" onclick="app.sales.removeInvoice(${inv.id})">Delete</button>
                </td>
            </tr>`}).join('') : '<tr><td colspan="9" class="text-center text-muted">No invoices found</td></tr>';
    }

    async showInvoiceModal(invoiceId = null) {
        const isEdit = invoiceId !== null;
        let inv = isEdit ? await this.getInvoice(invoiceId) : null;
        const custOpts = await this.customerOptions(inv?.customerId);
        const html = `
        <div class="modal-overlay active" id="invoiceModal">
            <div class="modal" style="max-width:800px">
                <div class="modal-header">
                    <h3>${isEdit ? 'Edit Invoice' : 'Create Invoice'}</h3>
                    <button class="modal-close" onclick="app.closeModal('invoiceModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="invEditId" value="${invoiceId || ''}">
                    <div class="form-row">
                        <div class="form-group"><label>Invoice #</label><input type="text" id="invNo" value="${inv?.invoiceNo || this.generateNo('INV')}" ${isEdit ? 'readonly' : ''}></div>
                        <div class="form-group"><label>Customer *</label><select id="invCustomer"><option value="">-- Select --</option>${custOpts}</select></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Date</label><input type="date" id="invDate" value="${inv?.date || new Date().toISOString().slice(0,10)}"></div>
                        <div class="form-group"><label>Due Date</label><input type="date" id="invDueDate" value="${inv?.dueDate || ''}"></div>
                        <div class="form-group"><label>Status</label>
                            <select id="invStatus">
                                <option value="unpaid" ${inv?.status==='unpaid'?'selected':''}>Unpaid</option>
                                <option value="partial" ${inv?.status==='partial'?'selected':''}>Partially Paid</option>
                                <option value="paid" ${inv?.status==='paid'?'selected':''}>Paid</option>
                            </select>
                        </div>
                    </div>
                    <h4 style="margin:10px 0 5px">Line Items</h4>
                    ${this.lineItemsEditor(inv?.items)}
                    <div class="form-group" style="margin-top:10px"><label>Notes</label><textarea id="invNotes" rows="2">${inv?.notes || ''}</textarea></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="app.closeModal('invoiceModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="app.sales.saveInvoiceForm()">Save Invoice</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        await this.loadSavedItemsPicker();
        if (inv) {
            document.getElementById('lineDiscount').value = inv.discount || 0;
            this.restoreGstRate(inv.subtotal, inv.discount, inv.taxAmount);
            this.recalcTotals();
        }
    }

    async saveInvoiceForm() {
        const customerId = document.getElementById('invCustomer').value;
        if (!customerId) { app.showToast('Please select a customer', 'error'); return; }
        const customer = await this.getCustomer(parseInt(customerId));
        const items = this.collectLineItems();
        const totals = this.recalcTotals();
        await this.syncLineItemsToCatalog(items);
        const data = {
            invoiceNo: document.getElementById('invNo').value.trim(),
            customerId: parseInt(customerId),
            customerName: customer?.name || '',
            date: document.getElementById('invDate').value,
            dueDate: document.getElementById('invDueDate').value || null,
            items,
            subtotal: totals.subtotal,
            taxAmount: totals.tax,
            discount: totals.discount,
            totalAmount: totals.total,
            paidAmount: 0,
            notes: document.getElementById('invNotes').value.trim(),
            status: document.getElementById('invStatus').value
        };
        const editId = document.getElementById('invEditId').value;
        if (editId) {
            data.id = parseInt(editId);
            const existing = await this.getInvoice(data.id);
            data.paidAmount = existing?.paidAmount || 0;
        }
        await this.saveInvoice(data);
        app.closeModal('invoiceModal');
        await this.loadInvoicesTable();
        app.showToast(editId ? 'Invoice updated' : 'Invoice created', 'success');
    }

    async removeInvoice(id) {
        if (!confirm('Delete this invoice?')) return;
        await this.deleteInvoice(id);
        await this.loadInvoicesTable();
        app.showToast('Invoice deleted', 'success');
    }

    // ===========================
    // RECURRING INVOICES
    // ===========================
    async loadRecurringTable() {
        const recurring = await this.getRecurringInvoices();
        const tbody = document.querySelector('#recurringTable tbody');
        if (!tbody) return;
        tbody.innerHTML = recurring.length ? recurring.map(r => {
            const statusClass = r.status === 'active' ? 'badge-success' : 'badge-secondary';
            return `<tr>
                <td><strong>${this.escapeHtml(r.profileName)}</strong></td>
                <td>${this.escapeHtml(r.customerName || '-')}</td>
                <td>${this.escapeHtml(r.frequency)}</td>
                <td>${this.formatDate(r.nextDate)}</td>
                <td class="amount">${this.formatCurrency(r.totalAmount)}</td>
                <td><span class="badge ${statusClass}">${this.escapeHtml(r.status)}</span></td>
                <td class="actions">
                    <button class="btn btn-sm btn-outline" onclick="app.sales.showRecurringModal(${r.id})">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="app.sales.removeRecurring(${r.id})">Delete</button>
                </td>
            </tr>`}).join('') : '<tr><td colspan="7" class="text-center text-muted">No recurring invoices found</td></tr>';
    }

    async showRecurringModal(recId = null) {
        const isEdit = recId !== null;
        let r = isEdit ? (await this.db.getById('recurringInvoices', recId)) : null;
        const custOpts = await this.customerOptions(r?.customerId);
        const html = `
        <div class="modal-overlay active" id="recurringModal">
            <div class="modal" style="max-width:800px">
                <div class="modal-header">
                    <h3>${isEdit ? 'Edit Recurring Invoice' : 'Create Recurring Invoice'}</h3>
                    <button class="modal-close" onclick="app.closeModal('recurringModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="recEditId" value="${recId || ''}">
                    <div class="form-row">
                        <div class="form-group"><label>Profile Name *</label><input type="text" id="recName" value="${r?.profileName || ''}" placeholder="e.g. Monthly Maintenance"></div>
                        <div class="form-group"><label>Customer *</label><select id="recCustomer"><option value="">-- Select --</option>${custOpts}</select></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Frequency</label>
                            <select id="recFrequency">${this.frequencies.map(f => `<option value="${f}" ${r?.frequency===f?'selected':''}>${f.charAt(0).toUpperCase()+f.slice(1)}</option>`).join('')}</select>
                        </div>
                        <div class="form-group"><label>Start Date</label><input type="date" id="recStart" value="${r?.startDate || new Date().toISOString().slice(0,10)}"></div>
                        <div class="form-group"><label>End Date</label><input type="date" id="recEnd" value="${r?.endDate || ''}"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Status</label>
                            <select id="recStatus">
                                <option value="active" ${r?.status==='active'?'selected':''}>Active</option>
                                <option value="paused" ${r?.status==='paused'?'selected':''}>Paused</option>
                                <option value="stopped" ${r?.status==='stopped'?'selected':''}>Stopped</option>
                            </select>
                        </div>
                    </div>
                    <h4 style="margin:10px 0 5px">Line Items</h4>
                    ${this.lineItemsEditor(r?.items)}
                    <div class="form-group" style="margin-top:10px"><label>Notes</label><textarea id="recNotes" rows="2">${r?.notes || ''}</textarea></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="app.closeModal('recurringModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="app.sales.saveRecurringForm()">Save</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        await this.loadSavedItemsPicker();
        if (r) {
            document.getElementById('lineDiscount').value = r.discount || 0;
            this.restoreGstRate(r.subtotal, r.discount, r.taxAmount);
            this.recalcTotals();
        }
    }

    async saveRecurringForm() {
        const profileName = document.getElementById('recName').value.trim();
        const customerId = document.getElementById('recCustomer').value;
        if (!profileName || !customerId) { app.showToast('Profile name and customer required', 'error'); return; }
        const customer = await this.getCustomer(parseInt(customerId));
        const items = this.collectLineItems();
        const totals = this.recalcTotals();
        await this.syncLineItemsToCatalog(items);
        const startDate = document.getElementById('recStart').value;
        const data = {
            profileName,
            customerId: parseInt(customerId),
            customerName: customer?.name || '',
            frequency: document.getElementById('recFrequency').value,
            startDate,
            endDate: document.getElementById('recEnd').value || null,
            nextDate: startDate,
            items,
            subtotal: totals.subtotal,
            taxAmount: totals.tax,
            discount: totals.discount,
            totalAmount: totals.total,
            notes: document.getElementById('recNotes').value.trim(),
            status: document.getElementById('recStatus').value
        };
        const editId = document.getElementById('recEditId').value;
        if (editId) data.id = parseInt(editId);
        await this.saveRecurringInvoice(data);
        app.closeModal('recurringModal');
        await this.loadRecurringTable();
        app.showToast(editId ? 'Recurring invoice updated' : 'Recurring invoice created', 'success');
    }

    async removeRecurring(id) {
        if (!confirm('Delete this recurring invoice?')) return;
        await this.deleteRecurringInvoice(id);
        await this.loadRecurringTable();
        app.showToast('Recurring invoice deleted', 'success');
    }

    // ===========================
    // DELIVERY CHALLANS
    // ===========================
    async loadChallansTable() {
        const challans = await this.getDeliveryChallans();
        challans.sort((a, b) => new Date(b.date) - new Date(a.date));
        const tbody = document.querySelector('#challansTable tbody');
        if (!tbody) return;
        tbody.innerHTML = challans.length ? challans.map(ch => {
            const statusClass = { pending: 'badge-warning', delivered: 'badge-success', returned: 'badge-danger' }[ch.status] || 'badge-secondary';
            return `<tr>
                <td><strong>${this.escapeHtml(ch.challanNo)}</strong></td>
                <td>${this.escapeHtml(ch.customerName || '-')}</td>
                <td>${this.formatDate(ch.date)}</td>
                <td>${this.escapeHtml(ch.vehicleNo || '-')}</td>
                <td><span class="badge ${statusClass}">${this.escapeHtml(ch.status)}</span></td>
                <td class="actions">
                    <button class="btn btn-sm btn-outline" onclick="app.sales.viewPdf('challan',${ch.id})" title="View PDF">📄</button>
                    <button class="btn btn-sm btn-outline" onclick="app.sales.downloadPdf('challan',${ch.id})" title="Download PDF">📥 PDF</button>
                    <button class="btn btn-sm btn-outline" onclick="app.sales.showChallanModal(${ch.id})">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="app.sales.removeChallan(${ch.id})">Delete</button>
                </td>
            </tr>`}).join('') : '<tr><td colspan="6" class="text-center text-muted">No delivery challans found</td></tr>';
    }

    async showChallanModal(challanId = null) {
        const isEdit = challanId !== null;
        let ch = isEdit ? (await this.db.getById('deliveryChallans', challanId)) : null;
        const custOpts = await this.customerOptions(ch?.customerId);
        const html = `
        <div class="modal-overlay active" id="challanModal">
            <div class="modal" style="max-width:800px">
                <div class="modal-header">
                    <h3>${isEdit ? 'Edit Delivery Challan' : 'Create Delivery Challan'}</h3>
                    <button class="modal-close" onclick="app.closeModal('challanModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="challanEditId" value="${challanId || ''}">
                    <div class="form-row">
                        <div class="form-group"><label>Challan #</label><input type="text" id="challanNo" value="${ch?.challanNo || this.generateNo('DC')}" ${isEdit ? 'readonly' : ''}></div>
                        <div class="form-group"><label>Customer *</label><select id="challanCustomer"><option value="">-- Select --</option>${custOpts}</select></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Date</label><input type="date" id="challanDate" value="${ch?.date || new Date().toISOString().slice(0,10)}"></div>
                        <div class="form-group"><label>Vehicle No</label><input type="text" id="challanVehicle" value="${ch?.vehicleNo || ''}" placeholder="Vehicle number"></div>
                        <div class="form-group"><label>Transporter</label><input type="text" id="challanTransporter" value="${ch?.transporterName || ''}" placeholder="Transporter name"></div>
                    </div>
                    <div class="form-group"><label>Status</label>
                        <select id="challanStatus">
                            <option value="pending" ${ch?.status==='pending'?'selected':''}>Pending</option>
                            <option value="delivered" ${ch?.status==='delivered'?'selected':''}>Delivered</option>
                            <option value="returned" ${ch?.status==='returned'?'selected':''}>Returned</option>
                        </select>
                    </div>
                    <h4 style="margin:10px 0 5px">Items</h4>
                    ${this.lineItemsEditor(ch?.items)}
                    <div class="form-group" style="margin-top:10px"><label>Notes</label><textarea id="challanNotes" rows="2">${ch?.notes || ''}</textarea></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="app.closeModal('challanModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="app.sales.saveChallanForm()">Save Challan</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        await this.loadSavedItemsPicker();
    }

    async saveChallanForm() {
        const customerId = document.getElementById('challanCustomer').value;
        if (!customerId) { app.showToast('Please select a customer', 'error'); return; }
        const customer = await this.getCustomer(parseInt(customerId));
        const items = this.collectLineItems();
        await this.syncLineItemsToCatalog(items);
        const data = {
            challanNo: document.getElementById('challanNo').value.trim(),
            customerId: parseInt(customerId),
            customerName: customer?.name || '',
            date: document.getElementById('challanDate').value,
            items,
            vehicleNo: document.getElementById('challanVehicle').value.trim(),
            transporterName: document.getElementById('challanTransporter').value.trim(),
            notes: document.getElementById('challanNotes').value.trim(),
            status: document.getElementById('challanStatus').value
        };
        const editId = document.getElementById('challanEditId').value;
        if (editId) data.id = parseInt(editId);
        await this.saveDeliveryChallan(data);
        app.closeModal('challanModal');
        await this.loadChallansTable();
        app.showToast(editId ? 'Challan updated' : 'Challan created', 'success');
    }

    async removeChallan(id) {
        if (!confirm('Delete this delivery challan?')) return;
        await this.deleteDeliveryChallan(id);
        await this.loadChallansTable();
        app.showToast('Delivery challan deleted', 'success');
    }

    // ===========================
    // PAYMENTS RECEIVED
    // ===========================
    async loadPaymentsTable() {
        const payments = await this.getPaymentsReceived();
        payments.sort((a, b) => new Date(b.date) - new Date(a.date));
        const invoices = await this.getInvoices();
        const invMap = {};
        invoices.forEach(i => invMap[i.id] = i.invoiceNo);
        const tbody = document.querySelector('#paymentsTable tbody');
        if (!tbody) return;
        tbody.innerHTML = payments.length ? payments.map(p => `<tr>
            <td><strong>${this.escapeHtml(p.paymentNo)}</strong></td>
            <td>${this.escapeHtml(p.customerName || '-')}</td>
            <td>${this.escapeHtml(invMap[p.invoiceId] || '-')}</td>
            <td>${this.formatDate(p.date)}</td>
            <td class="amount">${this.formatCurrency(p.amount)}</td>
            <td>${this.escapeHtml(p.paymentMode || '-')}</td>
            <td class="actions">
                <button class="btn btn-sm btn-outline" onclick="app.sales.showPaymentModal(${p.id})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="app.sales.removePayment(${p.id})">Delete</button>
            </td>
        </tr>`).join('') : '<tr><td colspan="7" class="text-center text-muted">No payments received</td></tr>';
    }

    async showPaymentModal(paymentId = null, preselectedInvoiceId = null) {
        const isEdit = paymentId !== null;
        let p = isEdit ? (await this.db.getById('paymentsReceived', paymentId)) : null;
        const custOpts = await this.customerOptions(p?.customerId);
        const invoices = await this.getInvoices();
        const invOpts = invoices.filter(i => i.status !== 'paid').map(i =>
            `<option value="${i.id}" ${(p?.invoiceId == i.id || preselectedInvoiceId == i.id) ? 'selected' : ''}>${this.escapeHtml(i.invoiceNo)} - ${this.escapeHtml(i.customerName)} (${this.formatCurrency((i.totalAmount||0)-(i.paidAmount||0))})</option>`
        ).join('');
        const html = `
        <div class="modal-overlay active" id="paymentModal">
            <div class="modal">
                <div class="modal-header">
                    <h3>${isEdit ? 'Edit Payment' : 'Record Payment Received'}</h3>
                    <button class="modal-close" onclick="app.closeModal('paymentModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="payEditId" value="${paymentId || ''}">
                    <div class="form-row">
                        <div class="form-group"><label>Payment #</label><input type="text" id="payNo" value="${p?.paymentNo || this.generateNo('PAY')}" ${isEdit ? 'readonly' : ''}></div>
                        <div class="form-group"><label>Date</label><input type="date" id="payDate" value="${p?.date || new Date().toISOString().slice(0,10)}"></div>
                    </div>
                    <div class="form-group"><label>Invoice</label><select id="payInvoice" onchange="app.sales.onPaymentInvoiceChange()"><option value="">-- Select Invoice --</option>${invOpts}</select></div>
                    <div class="form-group"><label>Customer</label><select id="payCustomer"><option value="">-- Select --</option>${custOpts}</select></div>
                    <div class="form-row">
                        <div class="form-group"><label>Amount (₹) *</label><input type="number" id="payAmount" value="${p?.amount || 0}" step="0.01"></div>
                        <div class="form-group"><label>Payment Mode</label>
                            <select id="payMode">${this.paymentModes.map(m => `<option value="${m}" ${p?.paymentMode===m?'selected':''}>${m}</option>`).join('')}</select>
                        </div>
                    </div>
                    <div class="form-group"><label>Reference / Txn No</label><input type="text" id="payRef" value="${p?.reference || ''}" placeholder="Transaction reference"></div>
                    <div class="form-group"><label>Notes</label><textarea id="payNotes" rows="2">${p?.notes || ''}</textarea></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="app.closeModal('paymentModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="app.sales.savePaymentForm()">Save Payment</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        if (preselectedInvoiceId) this.onPaymentInvoiceChange();
    }

    async onPaymentInvoiceChange() {
        const invoiceId = document.getElementById('payInvoice')?.value;
        if (!invoiceId) return;
        const inv = await this.getInvoice(parseInt(invoiceId));
        if (!inv) return;
        const custSelect = document.getElementById('payCustomer');
        if (custSelect) custSelect.value = inv.customerId;
        const balance = (inv.totalAmount || 0) - (inv.paidAmount || 0);
        const amtInput = document.getElementById('payAmount');
        if (amtInput && !amtInput.value) amtInput.value = balance;
    }

    async savePaymentForm() {
        const amount = parseFloat(document.getElementById('payAmount').value) || 0;
        if (amount <= 0) { app.showToast('Amount must be greater than 0', 'error'); return; }
        const invoiceId = document.getElementById('payInvoice').value;
        const customerId = document.getElementById('payCustomer').value;
        let customerName = '';
        if (customerId) {
            const c = await this.getCustomer(parseInt(customerId));
            customerName = c?.name || '';
        }
        const data = {
            paymentNo: document.getElementById('payNo').value.trim(),
            customerId: customerId ? parseInt(customerId) : null,
            customerName,
            invoiceId: invoiceId ? parseInt(invoiceId) : null,
            date: document.getElementById('payDate').value,
            amount,
            paymentMode: document.getElementById('payMode').value,
            reference: document.getElementById('payRef').value.trim(),
            notes: document.getElementById('payNotes').value.trim()
        };
        const editId = document.getElementById('payEditId').value;
        if (editId) data.id = parseInt(editId);

        await this.savePaymentReceived(data);

        // Update invoice paid amount
        if (data.invoiceId) {
            const inv = await this.getInvoice(data.invoiceId);
            if (inv) {
                // Recalculate total paid from all payments for this invoice
                const allPayments = await this.getPaymentsReceived();
                const totalPaid = allPayments
                    .filter(p => p.invoiceId === data.invoiceId)
                    .reduce((s, p) => s + (p.amount || 0), 0);
                inv.paidAmount = totalPaid;
                if (totalPaid >= (inv.totalAmount || 0)) inv.status = 'paid';
                else if (totalPaid > 0) inv.status = 'partial';
                else inv.status = 'unpaid';
                await this.saveInvoice(inv);
            }
        }

        app.closeModal('paymentModal');
        await this.loadPaymentsTable();
        app.showToast(editId ? 'Payment updated' : 'Payment recorded', 'success');
    }

    async removePayment(id) {
        if (!confirm('Delete this payment?')) return;
        const p = await this.db.getById('paymentsReceived', id);
        await this.deletePaymentReceived(id);
        // Recalculate invoice paid amount
        if (p?.invoiceId) {
            const inv = await this.getInvoice(p.invoiceId);
            if (inv) {
                const allPayments = await this.getPaymentsReceived();
                const totalPaid = allPayments
                    .filter(pay => pay.invoiceId === p.invoiceId && pay.id !== id)
                    .reduce((s, pay) => s + (pay.amount || 0), 0);
                inv.paidAmount = totalPaid;
                if (totalPaid >= (inv.totalAmount || 0)) inv.status = 'paid';
                else if (totalPaid > 0) inv.status = 'partial';
                else inv.status = 'unpaid';
                await this.saveInvoice(inv);
            }
        }
        await this.loadPaymentsTable();
        app.showToast('Payment deleted', 'success');
    }

    // ===========================
    // CREDIT NOTES
    // ===========================
    async loadCreditNotesTable() {
        const notes = await this.getCreditNotes();
        notes.sort((a, b) => new Date(b.date) - new Date(a.date));
        const invoices = await this.getInvoices();
        const invMap = {};
        invoices.forEach(i => invMap[i.id] = i.invoiceNo);
        const tbody = document.querySelector('#creditNotesTable tbody');
        if (!tbody) return;
        tbody.innerHTML = notes.length ? notes.map(cn => {
            const statusClass = { open: 'badge-info', applied: 'badge-success', void: 'badge-danger' }[cn.status] || 'badge-secondary';
            return `<tr>
                <td><strong>${this.escapeHtml(cn.creditNoteNo)}</strong></td>
                <td>${this.escapeHtml(cn.customerName || '-')}</td>
                <td>${this.escapeHtml(invMap[cn.invoiceId] || '-')}</td>
                <td>${this.formatDate(cn.date)}</td>
                <td class="amount">${this.formatCurrency(cn.totalAmount)}</td>
                <td><span class="badge ${statusClass}">${this.escapeHtml(cn.status)}</span></td>
                <td class="actions">
                    <button class="btn btn-sm btn-outline" onclick="app.sales.showCreditNoteModal(${cn.id})">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="app.sales.removeCreditNote(${cn.id})">Delete</button>
                </td>
            </tr>`}).join('') : '<tr><td colspan="7" class="text-center text-muted">No credit notes found</td></tr>';
    }

    async showCreditNoteModal(cnId = null) {
        const isEdit = cnId !== null;
        let cn = isEdit ? (await this.db.getById('creditNotes', cnId)) : null;
        const custOpts = await this.customerOptions(cn?.customerId);
        const invoices = await this.getInvoices();
        const invOpts = invoices.map(i =>
            `<option value="${i.id}" ${cn?.invoiceId == i.id ? 'selected' : ''}>${this.escapeHtml(i.invoiceNo)} - ${this.escapeHtml(i.customerName)}</option>`
        ).join('');
        const html = `
        <div class="modal-overlay active" id="creditNoteModal">
            <div class="modal" style="max-width:800px">
                <div class="modal-header">
                    <h3>${isEdit ? 'Edit Credit Note' : 'Create Credit Note'}</h3>
                    <button class="modal-close" onclick="app.closeModal('creditNoteModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="cnEditId" value="${cnId || ''}">
                    <div class="form-row">
                        <div class="form-group"><label>Credit Note #</label><input type="text" id="cnNo" value="${cn?.creditNoteNo || this.generateNo('CN')}" ${isEdit ? 'readonly' : ''}></div>
                        <div class="form-group"><label>Customer *</label><select id="cnCustomer"><option value="">-- Select --</option>${custOpts}</select></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Invoice</label><select id="cnInvoice"><option value="">-- None --</option>${invOpts}</select></div>
                        <div class="form-group"><label>Date</label><input type="date" id="cnDate" value="${cn?.date || new Date().toISOString().slice(0,10)}"></div>
                        <div class="form-group"><label>Status</label>
                            <select id="cnStatus">
                                <option value="open" ${cn?.status==='open'?'selected':''}>Open</option>
                                <option value="applied" ${cn?.status==='applied'?'selected':''}>Applied</option>
                                <option value="void" ${cn?.status==='void'?'selected':''}>Void</option>
                            </select>
                        </div>
                    </div>
                    <h4 style="margin:10px 0 5px">Line Items</h4>
                    ${this.lineItemsEditor(cn?.items)}
                    <div class="form-group" style="margin-top:10px"><label>Reason</label><textarea id="cnReason" rows="2">${cn?.reason || ''}</textarea></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="app.closeModal('creditNoteModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="app.sales.saveCreditNoteForm()">Save Credit Note</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        await this.loadSavedItemsPicker();
        if (cn) {
            document.getElementById('lineDiscount').value = 0;
            this.restoreGstRate(cn.subtotal, 0, cn.taxAmount);
            this.recalcTotals();
        }
    }

    async saveCreditNoteForm() {
        const customerId = document.getElementById('cnCustomer').value;
        if (!customerId) { app.showToast('Please select a customer', 'error'); return; }
        const customer = await this.getCustomer(parseInt(customerId));
        const items = this.collectLineItems();
        const totals = this.recalcTotals();
        await this.syncLineItemsToCatalog(items);
        const data = {
            creditNoteNo: document.getElementById('cnNo').value.trim(),
            customerId: parseInt(customerId),
            customerName: customer?.name || '',
            invoiceId: document.getElementById('cnInvoice').value ? parseInt(document.getElementById('cnInvoice').value) : null,
            date: document.getElementById('cnDate').value,
            items,
            subtotal: totals.subtotal,
            taxAmount: totals.tax,
            totalAmount: totals.total,
            reason: document.getElementById('cnReason').value.trim(),
            status: document.getElementById('cnStatus').value
        };
        const editId = document.getElementById('cnEditId').value;
        if (editId) data.id = parseInt(editId);
        await this.saveCreditNote(data);
        app.closeModal('creditNoteModal');
        await this.loadCreditNotesTable();
        app.showToast(editId ? 'Credit note updated' : 'Credit note created', 'success');
    }

    async removeCreditNote(id) {
        if (!confirm('Delete this credit note?')) return;
        await this.deleteCreditNote(id);
        await this.loadCreditNotesTable();
        app.showToast('Credit note deleted', 'success');
    }

    // ===========================
    // PDF VIEW & DOWNLOAD
    // ===========================

    async viewPdf(type, id) {
        try {
            if (!window.jspdf) { app.showToast('PDF library not loaded. Please check your internet connection and reload.', 'error'); return; }
            const pdfBlob = await this.buildPdf(type, id);
            if (!pdfBlob) return;
            const url = URL.createObjectURL(pdfBlob);
            // Open in a modal with an iframe
            const html = `
        <div class="modal-overlay active" id="pdfViewerModal">
            <div class="modal" style="max-width:900px;height:90vh;display:flex;flex-direction:column">
                <div class="modal-header">
                    <h3>Document Preview</h3>
                    <button class="modal-close" onclick="app.closeModal('pdfViewerModal')">&times;</button>
                </div>
                <div style="flex:1;overflow:hidden">
                    <iframe src="${url}" style="width:100%;height:100%;border:none"></iframe>
                </div>
            </div>
        </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
        } catch (err) {
            console.error('View PDF error:', err);
            app.showToast('Failed to generate PDF: ' + err.message, 'error');
        }
    }

    async downloadPdf(type, id) {
        try {
            if (!window.jspdf) { app.showToast('PDF library not loaded. Please check your internet connection and reload.', 'error'); return; }
            const data = await this.getDocData(type, id);
            if (!data) return;
            const pdfBlob = await this.buildPdf(type, id);
            if (!pdfBlob) return;
            const link = document.createElement('a');
            link.href = URL.createObjectURL(pdfBlob);
            link.download = (data.docNo || type) + '.pdf';
            link.click();
        } catch (err) {
            console.error('Download PDF error:', err);
            app.showToast('Failed to generate PDF: ' + err.message, 'error');
        }
    }

    async getDocData(type, id) {
        let record, docNo, docTitle, dateLabel, dateVal, extraFields = [];
        const customer = {};
        if (type === 'quote') {
            record = await this.getQuote(id);
            if (!record) return null;
            docNo = record.quoteNo;
            docTitle = 'QUOTATION';
            dateLabel = 'Quote Date';
            dateVal = record.date;
            extraFields.push({ label: 'Expiry Date', value: this.formatDate(record.expiryDate) });
            extraFields.push({ label: 'Status', value: (record.status || '').toUpperCase() });
        } else if (type === 'order') {
            record = await this.getSalesOrder(id);
            if (!record) return null;
            docNo = record.orderNo;
            docTitle = 'SALES ORDER';
            dateLabel = 'Order Date';
            dateVal = record.date;
            extraFields.push({ label: 'Delivery Date', value: this.formatDate(record.deliveryDate) });
            extraFields.push({ label: 'Status', value: (record.status || '').toUpperCase() });
        } else if (type === 'invoice') {
            record = await this.getInvoice(id);
            if (!record) return null;
            docNo = record.invoiceNo;
            docTitle = 'TAX INVOICE';
            dateLabel = 'Invoice Date';
            dateVal = record.date;
            extraFields.push({ label: 'Due Date', value: this.formatDate(record.dueDate) });
            extraFields.push({ label: 'Status', value: (record.status || '').toUpperCase() });
        } else if (type === 'challan') {
            record = await this.db.getById('deliveryChallans', id);
            if (!record) return null;
            docNo = record.challanNo;
            docTitle = 'DELIVERY CHALLAN';
            dateLabel = 'Challan Date';
            dateVal = record.date;
            extraFields.push({ label: 'Vehicle No', value: record.vehicleNo || '-' });
            extraFields.push({ label: 'Transporter', value: record.transporterName || '-' });
            extraFields.push({ label: 'Status', value: (record.status || '').toUpperCase() });
        } else { return null; }

        // Load customer details
        if (record.customerId) {
            const c = await this.getCustomer(record.customerId);
            if (c) {
                customer.name = c.name || '';
                customer.company = c.company || '';
                customer.email = c.email || '';
                customer.phone = c.phone || '';
                customer.gstin = c.gstin || '';
                customer.address = c.billingAddress || c.shippingAddress || '';
            }
        }
        if (!customer.name) customer.name = record.customerName || '';

        return { record, docNo, docTitle, dateLabel, dateVal, extraFields, customer };
    }

    async buildPdf(type, id) {
        const data = await this.getDocData(type, id);
        if (!data) { app.showToast('Document not found', 'error'); return null; }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 15;
        const contentW = pageW - margin * 2;
        let y = margin;

        // ── Header Band ──
        doc.setFillColor(26, 35, 126); // Dark indigo
        doc.rect(0, 0, pageW, 38, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text(data.docTitle, margin, 18);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Online Billing System', margin, 28);
        // Doc number on right
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(data.docNo, pageW - margin, 18, { align: 'right' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(data.dateLabel + ': ' + this.formatDate(data.dateVal), pageW - margin, 28, { align: 'right' });

        y = 46;

        // ── Billed To / Document Info ──
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Billed To:', margin, y);
        doc.setFont('helvetica', 'normal');
        y += 5;
        const custLines = [];
        if (data.customer.name) custLines.push(data.customer.name);
        if (data.customer.company) custLines.push(data.customer.company);
        if (data.customer.address) custLines.push(data.customer.address);
        if (data.customer.email) custLines.push('Email: ' + data.customer.email);
        if (data.customer.phone) custLines.push('Phone: ' + data.customer.phone);
        if (data.customer.gstin) custLines.push('GSTIN: ' + data.customer.gstin);
        custLines.forEach(line => {
            doc.text(line, margin, y);
            y += 4;
        });

        // Extra fields on the right side
        let rightY = 46;
        doc.setFont('helvetica', 'bold');
        doc.text('Details:', pageW / 2 + 10, rightY);
        doc.setFont('helvetica', 'normal');
        rightY += 5;
        data.extraFields.forEach(f => {
            doc.text(f.label + ': ' + (f.value || '-'), pageW / 2 + 10, rightY);
            rightY += 4;
        });

        y = Math.max(y, rightY) + 6;

        // ── Line Items Table ──
        let items = data.record.items || [];
        if (typeof items === 'string') { try { items = JSON.parse(items); } catch(e) { items = []; } }
        const tableBody = items.map((item, i) => [
            i + 1,
            item.description || '',
            item.qty || 0,
            this.pdfCurrency(item.rate || 0),
            this.pdfCurrency((item.qty || 0) * (item.rate || 0))
        ]);

        doc.autoTable({
            startY: y,
            head: [['#', 'Description', 'Qty', 'Rate', 'Amount']],
            body: tableBody,
            theme: 'grid',
            headStyles: {
                fillColor: [26, 35, 126],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 9,
                halign: 'center'
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 12 },
                1: { cellWidth: 'auto' },
                2: { halign: 'center', cellWidth: 18 },
                3: { halign: 'right', cellWidth: 30 },
                4: { halign: 'right', cellWidth: 32 }
            },
            styles: { fontSize: 8.5, cellPadding: 3 },
            alternateRowStyles: { fillColor: [245, 245, 255] },
            margin: { left: margin, right: margin }
        });

        y = doc.lastAutoTable.finalY + 6;

        // ── Totals Box ──
        // Compute subtotal from items if not stored (e.g. delivery challans)
        const itemsTotal = items.reduce((s, it) => s + ((it.qty || 0) * (it.rate || 0)), 0);
        const subtotal = data.record.subtotal || itemsTotal;
        const discount = data.record.discount || 0;
        const taxAmount = data.record.taxAmount || 0;
        const totalAmount = data.record.totalAmount || (subtotal - discount + taxAmount);
        const taxable = subtotal - discount;
        const cgst = Math.round(taxAmount / 2 * 100) / 100;
        const sgst = Math.round((taxAmount - cgst) * 100) / 100;
        let gstRate = 0;
        if (taxable > 0) gstRate = Math.round((taxAmount / taxable) * 100);

        const totalsX = pageW - margin - 80;
        const totalsW = 80;

        const drawTotalRow = (label, value, bold) => {
            doc.setFont('helvetica', bold ? 'bold' : 'normal');
            doc.setFontSize(bold ? 10 : 9);
            doc.text(label, totalsX, y);
            doc.text(value, totalsX + totalsW, y, { align: 'right' });
            y += 5;
        };

        drawTotalRow('Subtotal:', this.pdfCurrency(subtotal), false);
        if (discount > 0) drawTotalRow('Discount:', '- ' + this.pdfCurrency(discount), false);
        if (taxAmount > 0) {
            drawTotalRow('Taxable Amount:', this.pdfCurrency(taxable), false);
            drawTotalRow('CGST (' + (gstRate / 2) + '%):', this.pdfCurrency(cgst), false);
            drawTotalRow('SGST (' + (gstRate / 2) + '%):', this.pdfCurrency(sgst), false);
        }
        // Bold line before total
        doc.setDrawColor(26, 35, 126);
        doc.setLineWidth(0.5);
        doc.line(totalsX, y - 1, totalsX + totalsW, y - 1);
        y += 2;
        drawTotalRow('TOTAL:', this.pdfCurrency(totalAmount), true);

        // For invoice: show paid & balance
        if (type === 'invoice') {
            const paid = data.record.paidAmount || 0;
            const balance = totalAmount - paid;
            y += 1;
            drawTotalRow('Paid:', this.pdfCurrency(paid), false);
            doc.setDrawColor(26, 35, 126);
            doc.line(totalsX, y - 1, totalsX + totalsW, y - 1);
            y += 2;
            drawTotalRow('Balance Due:', this.pdfCurrency(balance), true);
        }

        y += 8;

        // ── Amount in Words ──
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Amount in Words:', margin, y);
        doc.setFont('helvetica', 'normal');
        y += 5;
        doc.text(this.numberToWords(totalAmount), margin, y);
        y += 8;

        // ── Notes ──
        const notes = data.record.notes || '';
        if (notes) {
            doc.setFont('helvetica', 'bold');
            doc.text('Notes:', margin, y);
            doc.setFont('helvetica', 'normal');
            y += 5;
            const splitNotes = doc.splitTextToSize(notes, contentW);
            doc.text(splitNotes, margin, y);
            y += splitNotes.length * 4 + 4;
        }

        // ── Footer ──
        const footerY = doc.internal.pageSize.getHeight() - 20;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(margin, footerY, pageW - margin, footerY);
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text('This is a computer-generated document. No signature is required.', pageW / 2, footerY + 5, { align: 'center' });
        doc.text('Generated by Online Billing System', pageW / 2, footerY + 10, { align: 'center' });

        return doc.output('blob');
    }

    // Convert number to Indian words
    numberToWords(num) {
        if (num === 0) return 'Zero Only';
        const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
        const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

        const toWords = (n) => {
            if (n === 0) return '';
            if (n < 20) return ones[n];
            if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
            if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + toWords(n % 100) : '');
            if (n < 100000) return toWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + toWords(n % 1000) : '');
            if (n < 10000000) return toWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + toWords(n % 100000) : '');
            return toWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + toWords(n % 10000000) : '');
        };

        const rupees = Math.floor(Math.abs(num));
        const paise = Math.round((Math.abs(num) - rupees) * 100);
        let result = 'Rupees ' + toWords(rupees);
        if (paise > 0) result += ' and ' + toWords(paise) + ' Paise';
        return result + ' Only';
    }
}
