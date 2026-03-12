// ============================================================
// Online Billing System - API Routes
// Generic CRUD routes matching the frontend Database interface
// ============================================================

const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Valid table names (whitelist to prevent SQL injection)
const VALID_TABLES = new Set([
    'users', 'ledgers', 'vouchers', 'stockGroups', 'stockItems',
    'stockMovements', 'employees', 'attendance', 'salaryRecords',
    'bankAccounts', 'bankTransactions', 'reconciliations', 'taxEntries',
    'gstReturns', 'auditTrail', 'syncLog', 'companies', 'settings'
]);

// Columns that hold JSON data and need parsing/stringifying
const JSON_COLUMNS = {
    users: ['permissions'],
    vouchers: ['entries'],
    salaryRecords: ['earnings', 'deductions'],
    reconciliations: ['data'],
    gstReturns: ['data'],
    companies: ['data'],
    settings: ['value']
};

// Known columns per table for insert/update operations
const TABLE_COLUMNS = {
    users: ['username', 'password', 'fullName', 'role', 'email', 'active', 'permissions'],
    ledgers: ['name', 'group', 'type', 'openingBalance', 'address', 'gstin', 'pan', 'phone', 'email'],
    vouchers: ['type', 'date', 'voucherNo', 'narration', 'entries'],
    stockGroups: ['name', 'parent'],
    stockItems: ['name', 'group', 'unit', 'location', 'currentStock', 'rate', 'reorderLevel', 'hsnCode', 'gstRate'],
    stockMovements: ['itemId', 'date', 'type', 'quantity', 'rate', 'location', 'reference', 'narration'],
    employees: ['empId', 'name', 'department', 'designation', 'dateOfJoining', 'basicSalary', 'hra', 'da', 'specialAllowance', 'otherAllowance', 'pfEnabled', 'esiEnabled', 'pan', 'bankAccount', 'bankName', 'ifsc', 'phone', 'email', 'address', 'active'],
    attendance: ['employeeId', 'date', 'status', 'inTime', 'outTime', 'remarks'],
    salaryRecords: ['employeeId', 'employeeName', 'empId', 'month', 'year', 'earnings', 'deductions', 'netSalary', 'status', 'processedDate'],
    bankAccounts: ['bankName', 'accountNo', 'ifsc', 'branch', 'accountType', 'balance', 'openingBalance'],
    bankTransactions: ['accountId', 'date', 'type', 'amount', 'description', 'reference', 'paymentMode', 'chequeNo', 'reconciled', 'reconciledDate'],
    reconciliations: ['accountId', 'date', 'bankBalance', 'bookBalance', 'difference', 'data'],
    taxEntries: ['type', 'subType', 'transType', 'supplyType', 'date', 'invoiceNo', 'party', 'gstin', 'hsn', 'taxableAmount', 'cgst', 'sgst', 'igst', 'cess', 'totalAmount', 'gstRate', 'period', 'tdsSection', 'tdsRate', 'tdsAmount', 'amount'],
    gstReturns: ['returnType', 'period', 'status', 'filingDate', 'data'],
    auditTrail: ['userId', 'action', 'details', 'timestamp', 'ipAddress'],
    syncLog: ['type', 'details', 'timestamp', 'user'],
    companies: ['name', 'address', 'gstin', 'pan', 'phone', 'email', 'data'],
    settings: ['key', 'value']
};

// Validate table name
function validateTable(tableName) {
    if (!VALID_TABLES.has(tableName)) {
        throw new Error('Invalid table name');
    }
    return tableName;
}

// Parse JSON columns in a row
function parseRow(tableName, row) {
    if (!row) return row;
    const jsonCols = JSON_COLUMNS[tableName] || [];
    const parsed = { ...row };
    for (const col of jsonCols) {
        if (parsed[col] && typeof parsed[col] === 'string') {
            try { parsed[col] = JSON.parse(parsed[col]); } catch (e) { /* keep as-is */ }
        }
    }
    return parsed;
}

// Prepare data for insert/update - extract known columns, stringify JSON
function prepareData(tableName, data) {
    const columns = TABLE_COLUMNS[tableName];
    if (!columns) throw new Error('Unknown table: ' + tableName);

    const jsonCols = JSON_COLUMNS[tableName] || [];
    const fields = [];
    const values = [];

    for (const col of columns) {
        if (data[col] !== undefined) {
            fields.push(col === 'group' ? '`group`' : col === 'key' ? '`key`' : col);
            let val = data[col];
            if (jsonCols.includes(col) && typeof val !== 'string' && val !== null) {
                val = JSON.stringify(val);
            }
            values.push(val);
        }
    }

    return { fields, values };
}

// ---- Export/Import (registered BEFORE dynamic :table routes) ----

// GET /api/export/all - Export all data
router.get('/export/all', async (req, res) => {
    try {
        const data = {};
        for (const table of VALID_TABLES) {
            const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
            data[table] = rows.map(r => parseRow(table, r));
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/import/all - Import data
router.post('/import/all', async (req, res) => {
    try {
        const data = req.body;
        let imported = 0;
        for (const [table, records] of Object.entries(data)) {
            if (!VALID_TABLES.has(table) || !Array.isArray(records)) continue;
            for (const record of records) {
                try {
                    if (record.id) {
                        const [existing] = await pool.query(`SELECT id FROM \`${table}\` WHERE id = ?`, [record.id]);
                        const { fields, values } = prepareData(table, record);
                        if (existing.length > 0) {
                            const setClause = fields.map(f => `${f} = ?`).join(', ');
                            values.push(record.id);
                            await pool.query(`UPDATE \`${table}\` SET ${setClause} WHERE id = ?`, values);
                        } else {
                            const placeholders = values.map(() => '?').join(', ');
                            await pool.query(`INSERT INTO \`${table}\` (${fields.join(', ')}) VALUES (${placeholders})`, values);
                        }
                        imported++;
                    }
                } catch (e) { /* skip individual errors */ }
            }
        }
        res.json({ success: true, imported });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---- CRUD Endpoints ----

// GET /api/:table - Get all records
router.get('/:table', async (req, res) => {
    try {
        const table = validateTable(req.params.table);
        const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
        res.json(rows.map(r => parseRow(table, r)));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET /api/:table/count - Count records
router.get('/:table/count', async (req, res) => {
    try {
        const table = validateTable(req.params.table);
        const [rows] = await pool.query(`SELECT COUNT(*) as count FROM \`${table}\``);
        res.json({ count: rows[0].count });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET /api/:table/index/:column/:value - Get by index (multiple)
router.get('/:table/index/:column/:value', async (req, res) => {
    try {
        const table = validateTable(req.params.table);
        const column = req.params.column;
        // Validate column exists in table
        const validCols = TABLE_COLUMNS[table];
        if (!validCols || !validCols.includes(column)) {
            return res.status(400).json({ error: 'Invalid column' });
        }
        const colName = column === 'group' ? '`group`' : column === 'key' ? '`key`' : column;
        const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE ${colName} = ?`, [req.params.value]);
        res.json(rows.map(r => parseRow(table, r)));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET /api/:table/index-one/:column/:value - Get by index (single)
router.get('/:table/index-one/:column/:value', async (req, res) => {
    try {
        const table = validateTable(req.params.table);
        const column = req.params.column;
        const validCols = TABLE_COLUMNS[table];
        if (!validCols || !validCols.includes(column)) {
            return res.status(400).json({ error: 'Invalid column' });
        }
        const colName = column === 'group' ? '`group`' : column === 'key' ? '`key`' : column;
        const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE ${colName} = ? LIMIT 1`, [req.params.value]);
        res.json(rows.length ? parseRow(table, rows[0]) : null);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET /api/:table/:id - Get by ID
router.get('/:table/:id', async (req, res) => {
    try {
        const table = validateTable(req.params.table);
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
        const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [id]);
        res.json(rows.length ? parseRow(table, rows[0]) : null);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST /api/:table - Add record
router.post('/:table', async (req, res) => {
    try {
        const table = validateTable(req.params.table);

        // Special handling for settings table (uses `key` as primary key)
        if (table === 'settings') {
            const data = req.body;
            const value = typeof data.value === 'string' ? data.value : JSON.stringify(data.value);
            await pool.query(
                'INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?',
                [data.key, value, value]
            );
            return res.json({ id: data.key });
        }

        const { fields, values } = prepareData(table, req.body);
        if (fields.length === 0) return res.status(400).json({ error: 'No valid fields provided' });

        const placeholders = values.map(() => '?').join(', ');
        const sql = `INSERT INTO \`${table}\` (${fields.join(', ')}) VALUES (${placeholders})`;
        const [result] = await pool.query(sql, values);
        res.json({ id: result.insertId });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT /api/:table/:id - Update record
router.put('/:table/:id', async (req, res) => {
    try {
        const table = validateTable(req.params.table);
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

        const { fields, values } = prepareData(table, req.body);
        if (fields.length === 0) return res.status(400).json({ error: 'No valid fields provided' });

        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const sql = `UPDATE \`${table}\` SET ${setClause} WHERE id = ?`;
        values.push(id);
        await pool.query(sql, values);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /api/:table/all - Clear all records
router.delete('/:table/all', async (req, res) => {
    try {
        const table = validateTable(req.params.table);
        await pool.query(`DELETE FROM \`${table}\``);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /api/:table/:id - Delete record
router.delete('/:table/:id', async (req, res) => {
    try {
        const table = validateTable(req.params.table);
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
        await pool.query(`DELETE FROM \`${table}\` WHERE id = ?`, [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
