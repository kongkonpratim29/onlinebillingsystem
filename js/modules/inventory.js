// ============================================================
// Online Billing System - Inventory Management Module
// ============================================================

class InventoryModule {
    constructor(database) {
        this.db = database;
        this.units = ['Nos', 'Pcs', 'Kgs', 'Ltrs', 'Mtrs', 'Box', 'Bags', 'Dzn', 'Pair', 'Set', 'Ton', 'Sqft', 'Sqmtr'];
        this.locations = ['Main Warehouse', 'Branch Office', 'Godown 1', 'Godown 2'];
    }

    async init() {
        const groupCount = await this.db.count('stockGroups');
        if (groupCount === 0) {
            const defaults = ['Primary', 'Raw Materials', 'Finished Goods', 'Semi-Finished Goods', 'Consumables', 'Packing Materials'];
            for (const name of defaults) {
                await this.db.add('stockGroups', { name, parent: name === 'Primary' ? null : 'Primary' });
            }
        }
    }

    // Stock Groups
    async getStockGroups() { return await this.db.getAll('stockGroups'); }
    async createStockGroup(data) { return await this.db.add('stockGroups', data); }
    async updateStockGroup(data) { return await this.db.update('stockGroups', data); }
    async deleteStockGroup(id) { return await this.db.delete('stockGroups', id); }

    // Stock Items
    async getStockItems() { return await this.db.getAll('stockItems'); }
    async getStockItem(id) { return await this.db.getById('stockItems', id); }
    async createStockItem(data) { return await this.db.add('stockItems', data); }
    async updateStockItem(data) { return await this.db.update('stockItems', data); }
    async deleteStockItem(id) { return await this.db.delete('stockItems', id); }

    // Stock Movements
    async getMovements(itemId = null) {
        if (itemId) return await this.db.getByIndex('stockMovements', 'itemId', itemId);
        return await this.db.getAll('stockMovements');
    }

    async addMovement(data) {
        const id = await this.db.add('stockMovements', data);
        // Update stock quantity
        const item = await this.getStockItem(data.itemId);
        if (item) {
            if (data.type === 'in') {
                item.currentStock = (item.currentStock || 0) + data.quantity;
            } else {
                item.currentStock = (item.currentStock || 0) - data.quantity;
            }
            await this.updateStockItem(item);
        }
        return id;
    }

    // Calculate stock value
    async calculateStockValue() {
        const items = await this.getStockItems();
        return items.reduce((total, item) => {
            return total + ((item.currentStock || 0) * (item.rate || 0));
        }, 0);
    }

    // Get low stock items
    async getLowStockItems() {
        const items = await this.getStockItems();
        return items.filter(i => (i.currentStock || 0) <= (i.reorderLevel || 0) && i.reorderLevel > 0);
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
            <button class="tab active" data-tab="stock-items-tab">Stock Items</button>
            <button class="tab" data-tab="stock-groups-tab">Stock Groups</button>
            <button class="tab" data-tab="stock-movement-tab">Stock Movements</button>
            <button class="tab" data-tab="stock-summary-tab">Stock Summary</button>
            <button class="tab" data-tab="reorder-tab">Reorder Levels</button>
        </div>

        <!-- Stock Items -->
        <div id="stock-items-tab" class="tab-content active">
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="search-box">
                        <span>🔍</span>
                        <input type="text" id="stockSearch" placeholder="Search stock items..." oninput="app.inventory.filterItems()">
                    </div>
                    <select class="filter-select" id="stockGroupFilter" onchange="app.inventory.filterItems()">
                        <option value="">All Groups</option>
                    </select>
                    <select class="filter-select" id="stockLocationFilter" onchange="app.inventory.filterItems()">
                        <option value="">All Locations</option>
                        ${this.locations.map(l => `<option value="${l}">${l}</option>`).join('')}
                    </select>
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-primary" onclick="app.inventory.showItemModal()">+ Add Stock Item</button>
                </div>
            </div>
            <div class="card">
                <div class="card-body">
                    <table class="data-table" id="stockItemsTable">
                        <thead>
                            <tr>
                                <th>Item Name</th>
                                <th>Group</th>
                                <th>Location</th>
                                <th>Unit</th>
                                <th class="amount">Rate (₹)</th>
                                <th class="amount">Stock Qty</th>
                                <th class="amount">Value (₹)</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Stock Groups -->
        <div id="stock-groups-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-right">
                    <button class="btn btn-primary" onclick="app.inventory.showGroupModal()">+ Add Group</button>
                </div>
            </div>
            <div class="card">
                <div class="card-body">
                    <table class="data-table" id="stockGroupsTable">
                        <thead>
                            <tr>
                                <th>Group Name</th>
                                <th>Parent Group</th>
                                <th>Items Count</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Stock Movements -->
        <div id="stock-movement-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-left">
                    <select class="filter-select" id="movementItemFilter" onchange="app.inventory.loadMovements()">
                        <option value="">All Items</option>
                    </select>
                    <select class="filter-select" id="movementTypeFilter" onchange="app.inventory.loadMovements()">
                        <option value="">All Types</option>
                        <option value="in">Stock In</option>
                        <option value="out">Stock Out</option>
                    </select>
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-primary" onclick="app.inventory.showMovementModal()">+ Record Movement</button>
                </div>
            </div>
            <div class="card">
                <div class="card-body">
                    <table class="data-table" id="movementsTable">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Item</th>
                                <th>Type</th>
                                <th>Quantity</th>
                                <th class="amount">Rate (₹)</th>
                                <th class="amount">Value (₹)</th>
                                <th>Batch</th>
                                <th>Remarks</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Stock Summary -->
        <div id="stock-summary-tab" class="tab-content">
            <div id="stockSummaryContent"></div>
        </div>

        <!-- Reorder Levels -->
        <div id="reorder-tab" class="tab-content">
            <div class="card">
                <div class="card-header"><h3>Items Below Reorder Level</h3></div>
                <div class="card-body" id="reorderContent"></div>
            </div>
        </div>`;
    }

    async loadData() {
        await this.loadStockItemsTable();
        await this.loadGroupFilter();
        await this.loadItemFilter();
    }

    async loadGroupFilter() {
        const groups = await this.getStockGroups();
        const select = document.getElementById('stockGroupFilter');
        if (select) {
            const options = groups.map(g => `<option value="${this.escapeHtml(g.name)}">${this.escapeHtml(g.name)}</option>`).join('');
            select.innerHTML = '<option value="">All Groups</option>' + options;
        }
    }

    async loadItemFilter() {
        const items = await this.getStockItems();
        const select = document.getElementById('movementItemFilter');
        if (select) {
            const options = items.map(i => `<option value="${i.id}">${this.escapeHtml(i.name)}</option>`).join('');
            select.innerHTML = '<option value="">All Items</option>' + options;
        }
    }

    async loadStockItemsTable() {
        const items = await this.getStockItems();
        const tbody = document.querySelector('#stockItemsTable tbody');
        if (!tbody) return;

        tbody.innerHTML = items.length ? items.map(i => {
            const value = (i.currentStock || 0) * (i.rate || 0);
            const isLow = i.reorderLevel && (i.currentStock || 0) <= i.reorderLevel;
            return `
            <tr>
                <td><strong>${this.escapeHtml(i.name)}</strong></td>
                <td>${this.escapeHtml(i.group || '-')}</td>
                <td>${this.escapeHtml(i.location || '-')}</td>
                <td>${this.escapeHtml(i.unit || '-')}</td>
                <td class="amount">${this.formatCurrency(i.rate || 0)}</td>
                <td class="amount">${i.currentStock || 0}</td>
                <td class="amount"><strong>${this.formatCurrency(value)}</strong></td>
                <td>${isLow ? '<span class="badge badge-danger">Low Stock</span>' : '<span class="badge badge-success">OK</span>'}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-outline" onclick="app.inventory.showItemModal(${i.id})">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="app.inventory.removeItem(${i.id})">Delete</button>
                </td>
            </tr>`;
        }).join('') : '<tr><td colspan="9" class="text-center text-muted">No stock items found</td></tr>';
    }

    filterItems() {
        const search = (document.getElementById('stockSearch')?.value || '').toLowerCase();
        const group = document.getElementById('stockGroupFilter')?.value || '';
        const location = document.getElementById('stockLocationFilter')?.value || '';
        const rows = document.querySelectorAll('#stockItemsTable tbody tr');
        rows.forEach(row => {
            const name = row.cells[0]?.textContent.toLowerCase() || '';
            const grp = row.cells[1]?.textContent || '';
            const loc = row.cells[2]?.textContent || '';
            const match = (!search || name.includes(search)) && (!group || grp === group) && (!location || loc === location);
            row.style.display = match ? '' : 'none';
        });
    }

    async loadStockGroupsTable() {
        const groups = await this.getStockGroups();
        const items = await this.getStockItems();
        const tbody = document.querySelector('#stockGroupsTable tbody');
        if (!tbody) return;

        tbody.innerHTML = groups.map(g => {
            const count = items.filter(i => i.group === g.name).length;
            return `
            <tr>
                <td><strong>${this.escapeHtml(g.name)}</strong></td>
                <td>${this.escapeHtml(g.parent || '-')}</td>
                <td>${count}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-outline" onclick="app.inventory.showGroupModal(${g.id})">Edit</button>
                    ${g.name !== 'Primary' ? `<button class="btn btn-sm btn-danger" onclick="app.inventory.removeGroup(${g.id})">Delete</button>` : ''}
                </td>
            </tr>`;
        }).join('');
    }

    async loadMovements() {
        const itemFilter = document.getElementById('movementItemFilter')?.value;
        const typeFilter = document.getElementById('movementTypeFilter')?.value;

        let movements = await this.getMovements(itemFilter ? parseInt(itemFilter) : null);
        if (typeFilter) movements = movements.filter(m => m.type === typeFilter);
        movements.sort((a, b) => new Date(b.date) - new Date(a.date));

        const items = await this.getStockItems();
        const itemMap = {};
        items.forEach(i => itemMap[i.id] = i.name);

        const tbody = document.querySelector('#movementsTable tbody');
        if (!tbody) return;

        tbody.innerHTML = movements.length ? movements.map(m => `
            <tr>
                <td>${m.date}</td>
                <td>${this.escapeHtml(itemMap[m.itemId] || 'Unknown')}</td>
                <td><span class="badge ${m.type === 'in' ? 'badge-success' : 'badge-danger'}">${m.type === 'in' ? 'Stock In' : 'Stock Out'}</span></td>
                <td>${m.quantity}</td>
                <td class="amount">${this.formatCurrency(m.rate || 0)}</td>
                <td class="amount">${this.formatCurrency((m.quantity || 0) * (m.rate || 0))}</td>
                <td>${this.escapeHtml(m.batch || '-')}</td>
                <td>${this.escapeHtml(m.remarks || '-')}</td>
            </tr>`).join('') : '<tr><td colspan="8" class="text-center text-muted">No movements found</td></tr>';
    }

    async loadStockSummary() {
        const items = await this.getStockItems();
        const groups = await this.getStockGroups();
        const totalValue = await this.calculateStockValue();

        const content = document.getElementById('stockSummaryContent');
        if (!content) return;

        // Group summary
        const groupSummary = {};
        items.forEach(i => {
            const g = i.group || 'Ungrouped';
            if (!groupSummary[g]) groupSummary[g] = { count: 0, value: 0, qty: 0 };
            groupSummary[g].count++;
            groupSummary[g].qty += (i.currentStock || 0);
            groupSummary[g].value += (i.currentStock || 0) * (i.rate || 0);
        });

        let html = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon blue">📦</div>
                <div class="stat-info"><h4>${items.length}</h4><p>Total Items</p></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon green">💰</div>
                <div class="stat-info"><h4>${this.formatCurrency(totalValue)}</h4><p>Total Stock Value</p></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon orange">📁</div>
                <div class="stat-info"><h4>${groups.length}</h4><p>Stock Groups</p></div>
            </div>
        </div>
        <div class="card">
            <div class="card-header"><h3>Group-wise Stock Summary</h3></div>
            <div class="card-body">
                <table class="data-table">
                    <thead><tr><th>Group</th><th>Items</th><th class="amount">Total Qty</th><th class="amount">Value (₹)</th></tr></thead>
                    <tbody>
                        ${Object.entries(groupSummary).map(([group, data]) => `
                            <tr>
                                <td><strong>${this.escapeHtml(group)}</strong></td>
                                <td>${data.count}</td>
                                <td class="amount">${data.qty}</td>
                                <td class="amount">${this.formatCurrency(data.value)}</td>
                            </tr>`).join('')}
                        <tr style="border-top:2px solid #333">
                            <td><strong>Total</strong></td>
                            <td><strong>${items.length}</strong></td>
                            <td class="amount"><strong>${items.reduce((s, i) => s + (i.currentStock || 0), 0)}</strong></td>
                            <td class="amount"><strong>${this.formatCurrency(totalValue)}</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>`;
        content.innerHTML = html;
    }

    async loadReorderReport() {
        const lowItems = await this.getLowStockItems();
        const content = document.getElementById('reorderContent');
        if (!content) return;

        if (lowItems.length === 0) {
            content.innerHTML = '<div class="empty-state"><h3>All stock levels are adequate</h3><p>No items are below their reorder level</p></div>';
            return;
        }

        content.innerHTML = `
            <table class="data-table">
                <thead><tr><th>Item</th><th>Group</th><th class="amount">Current Stock</th><th class="amount">Reorder Level</th><th class="amount">Shortage</th><th>Actions</th></tr></thead>
                <tbody>
                    ${lowItems.map(i => `
                        <tr>
                            <td><strong>${this.escapeHtml(i.name)}</strong></td>
                            <td>${this.escapeHtml(i.group || '-')}</td>
                            <td class="amount text-danger"><strong>${i.currentStock || 0}</strong></td>
                            <td class="amount">${i.reorderLevel || 0}</td>
                            <td class="amount text-danger">${(i.reorderLevel || 0) - (i.currentStock || 0)}</td>
                            <td><button class="btn btn-sm btn-primary" onclick="app.inventory.showMovementModal(${i.id}, 'in')">Stock In</button></td>
                        </tr>`).join('')}
                </tbody>
            </table>`;
    }

    // Modals
    showItemModal(itemId = null) {
        const isEdit = itemId !== null;
        const modalHtml = `
        <div class="modal-overlay active" id="itemModal">
            <div class="modal">
                <div class="modal-header">
                    <h3>${isEdit ? 'Edit Stock Item' : 'Add Stock Item'}</h3>
                    <button class="modal-close" onclick="app.closeModal('itemModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="itemEditId" value="${itemId || ''}">
                    <div class="form-group">
                        <label>Item Name</label>
                        <input type="text" id="itemName" placeholder="Enter item name">
                    </div>
                    <div class="form-row-3">
                        <div class="form-group">
                            <label>Stock Group</label>
                            <select id="itemGroup"></select>
                        </div>
                        <div class="form-group">
                            <label>Unit</label>
                            <select id="itemUnit">
                                ${this.units.map(u => `<option value="${u}">${u}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Location</label>
                            <select id="itemLocation">
                                ${this.locations.map(l => `<option value="${l}">${l}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="form-row-3">
                        <div class="form-group">
                            <label>Rate (₹)</label>
                            <input type="number" id="itemRate" value="0" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>Opening Stock</label>
                            <input type="number" id="itemStock" value="0">
                        </div>
                        <div class="form-group">
                            <label>Reorder Level</label>
                            <input type="number" id="itemReorder" value="0">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>HSN/SAC Code</label>
                            <input type="text" id="itemHsn" placeholder="HSN/SAC code">
                        </div>
                        <div class="form-group">
                            <label>GST Rate (%)</label>
                            <select id="itemGst">
                                <option value="0">0%</option>
                                <option value="5">5%</option>
                                <option value="12">12%</option>
                                <option value="18" selected>18%</option>
                                <option value="28">28%</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="itemDescription" placeholder="Item description"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="app.closeModal('itemModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="app.inventory.saveItem()">Save Item</button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.loadGroupDropdown();
        if (isEdit) this.loadItemForEdit(itemId);
    }

    async loadGroupDropdown() {
        const groups = await this.getStockGroups();
        const select = document.getElementById('itemGroup');
        if (select) {
            select.innerHTML = groups.map(g => `<option value="${this.escapeHtml(g.name)}">${this.escapeHtml(g.name)}</option>`).join('');
        }
    }

    async loadItemForEdit(id) {
        const item = await this.getStockItem(id);
        if (item) {
            document.getElementById('itemName').value = item.name;
            if (document.getElementById('itemGroup')) document.getElementById('itemGroup').value = item.group || '';
            if (document.getElementById('itemUnit')) document.getElementById('itemUnit').value = item.unit || 'Nos';
            if (document.getElementById('itemLocation')) document.getElementById('itemLocation').value = item.location || '';
            document.getElementById('itemRate').value = item.rate || 0;
            document.getElementById('itemStock').value = item.currentStock || 0;
            document.getElementById('itemReorder').value = item.reorderLevel || 0;
            if (document.getElementById('itemHsn')) document.getElementById('itemHsn').value = item.hsn || '';
            if (document.getElementById('itemGst')) document.getElementById('itemGst').value = item.gstRate || '18';
            if (document.getElementById('itemDescription')) document.getElementById('itemDescription').value = item.description || '';
        }
    }

    async saveItem() {
        const id = document.getElementById('itemEditId').value;
        const data = {
            name: document.getElementById('itemName').value.trim(),
            group: document.getElementById('itemGroup')?.value || '',
            unit: document.getElementById('itemUnit')?.value || 'Nos',
            location: document.getElementById('itemLocation')?.value || '',
            rate: parseFloat(document.getElementById('itemRate').value) || 0,
            currentStock: parseFloat(document.getElementById('itemStock').value) || 0,
            reorderLevel: parseFloat(document.getElementById('itemReorder').value) || 0,
            hsn: document.getElementById('itemHsn')?.value.trim() || '',
            gstRate: parseFloat(document.getElementById('itemGst')?.value) || 18,
            description: document.getElementById('itemDescription')?.value.trim() || ''
        };

        if (!data.name) {
            app.showToast('Item name is required', 'error');
            return;
        }

        try {
            if (id) {
                data.id = parseInt(id);
                const existing = await this.getStockItem(data.id);
                data.createdAt = existing.createdAt;
                await this.updateStockItem(data);
            } else {
                await this.createStockItem(data);
            }
            app.closeModal('itemModal');
            app.showToast('Stock item saved successfully', 'success');
            this.loadStockItemsTable();
        } catch (e) {
            app.showToast(e.message, 'error');
        }
    }

    async removeItem(id) {
        if (confirm('Delete this stock item?')) {
            await this.deleteStockItem(id);
            app.showToast('Item deleted', 'success');
            this.loadStockItemsTable();
        }
    }

    showGroupModal(groupId = null) {
        const isEdit = groupId !== null;
        const modalHtml = `
        <div class="modal-overlay active" id="groupModal">
            <div class="modal" style="width:400px">
                <div class="modal-header">
                    <h3>${isEdit ? 'Edit Group' : 'Add Stock Group'}</h3>
                    <button class="modal-close" onclick="app.closeModal('groupModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="groupEditId" value="${groupId || ''}">
                    <div class="form-group">
                        <label>Group Name</label>
                        <input type="text" id="groupName">
                    </div>
                    <div class="form-group">
                        <label>Parent Group</label>
                        <select id="groupParent"></select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="app.closeModal('groupModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="app.inventory.saveGroup()">Save</button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.loadParentGroupDropdown(groupId);
    }

    async loadParentGroupDropdown(excludeId = null) {
        const groups = await this.getStockGroups();
        const select = document.getElementById('groupParent');
        if (select) {
            select.innerHTML = '<option value="">None (Primary)</option>' +
                groups.filter(g => g.id !== excludeId).map(g => `<option value="${this.escapeHtml(g.name)}">${this.escapeHtml(g.name)}</option>`).join('');
        }
        if (excludeId) {
            const group = await this.db.getById('stockGroups', excludeId);
            if (group) {
                document.getElementById('groupName').value = group.name;
                select.value = group.parent || '';
            }
        }
    }

    async saveGroup() {
        const id = document.getElementById('groupEditId').value;
        const name = document.getElementById('groupName').value.trim();
        const parent = document.getElementById('groupParent')?.value || null;

        if (!name) {
            app.showToast('Group name is required', 'error');
            return;
        }

        try {
            if (id) {
                await this.updateStockGroup({ id: parseInt(id), name, parent });
            } else {
                await this.createStockGroup({ name, parent });
            }
            app.closeModal('groupModal');
            app.showToast('Group saved', 'success');
            this.loadStockGroupsTable();
            this.loadGroupFilter();
        } catch (e) {
            app.showToast(e.message, 'error');
        }
    }

    async removeGroup(id) {
        if (confirm('Delete this stock group?')) {
            await this.deleteStockGroup(id);
            app.showToast('Group deleted', 'success');
            this.loadStockGroupsTable();
        }
    }

    async showMovementModal(presetItemId = null, presetType = null) {
        const items = await this.getStockItems();
        const modalHtml = `
        <div class="modal-overlay active" id="movementModal">
            <div class="modal">
                <div class="modal-header">
                    <h3>Record Stock Movement</h3>
                    <button class="modal-close" onclick="app.closeModal('movementModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Stock Item</label>
                            <select id="movItemId">
                                ${items.map(i => `<option value="${i.id}" ${presetItemId === i.id ? 'selected' : ''}>${this.escapeHtml(i.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Type</label>
                            <select id="movType">
                                <option value="in" ${presetType === 'in' ? 'selected' : ''}>Stock In</option>
                                <option value="out" ${presetType === 'out' ? 'selected' : ''}>Stock Out</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row-3">
                        <div class="form-group">
                            <label>Date</label>
                            <input type="date" id="movDate" value="${new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="form-group">
                            <label>Quantity</label>
                            <input type="number" id="movQty" value="1" min="1">
                        </div>
                        <div class="form-group">
                            <label>Rate (₹)</label>
                            <input type="number" id="movRate" value="0" step="0.01">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Batch No.</label>
                            <input type="text" id="movBatch" placeholder="Optional">
                        </div>
                        <div class="form-group">
                            <label>Remarks</label>
                            <input type="text" id="movRemarks" placeholder="Optional">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="app.closeModal('movementModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="app.inventory.saveMovement()">Save</button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    async saveMovement() {
        const data = {
            itemId: parseInt(document.getElementById('movItemId').value),
            type: document.getElementById('movType').value,
            date: document.getElementById('movDate').value,
            quantity: parseFloat(document.getElementById('movQty').value) || 0,
            rate: parseFloat(document.getElementById('movRate').value) || 0,
            batch: document.getElementById('movBatch')?.value.trim() || '',
            remarks: document.getElementById('movRemarks')?.value.trim() || ''
        };

        if (!data.quantity || data.quantity <= 0) {
            app.showToast('Quantity must be greater than 0', 'error');
            return;
        }

        try {
            await this.addMovement(data);
            app.closeModal('movementModal');
            app.showToast('Movement recorded', 'success');
            this.loadStockItemsTable();
            this.loadMovements();
        } catch (e) {
            app.showToast(e.message, 'error');
        }
    }
}
