// ============================================================
// Online Billing System - MySQL API Database Layer
// All data is persisted in MySQL via the Express backend.
// This class provides the same interface as the old IndexedDB
// layer so all frontend modules work without changes.
// ============================================================

const API_BASE = '/api';

class Database {
    constructor() {
        this.ready = false;
    }

    async init() {
        // Test the API connection
        try {
            const res = await fetch(`${API_BASE}/users/count`);
            if (!res.ok) throw new Error('API not reachable');
            this.ready = true;
        } catch (err) {
            console.error('Database API connection failed:', err.message);
            console.error('Make sure the backend server is running (cd server && npm start)');
            throw err;
        }
    }

    // ---- Generic CRUD (same interface as before) ----

    async add(storeName, data) {
        const body = { ...data };
        delete body.id; // Let MySQL auto-increment
        const res = await fetch(`${API_BASE}/${storeName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Add failed');
        }
        const result = await res.json();
        return result.id;
    }

    async update(storeName, data) {
        const id = data.id;
        if (!id) throw new Error('Cannot update without an id');
        const res = await fetch(`${API_BASE}/${storeName}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Update failed');
        }
        return id;
    }

    async delete(storeName, id) {
        const res = await fetch(`${API_BASE}/${storeName}/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Delete failed');
        }
    }

    async getById(storeName, id) {
        const res = await fetch(`${API_BASE}/${storeName}/${id}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data || null;
    }

    async getAll(storeName) {
        const res = await fetch(`${API_BASE}/${storeName}`);
        if (!res.ok) return [];
        return await res.json();
    }

    async getByIndex(storeName, indexName, value) {
        const res = await fetch(`${API_BASE}/${storeName}/index/${indexName}/${encodeURIComponent(value)}`);
        if (!res.ok) return [];
        return await res.json();
    }

    async getByIndexOne(storeName, indexName, value) {
        const res = await fetch(`${API_BASE}/${storeName}/index-one/${indexName}/${encodeURIComponent(value)}`);
        if (!res.ok) return null;
        return await res.json();
    }

    async count(storeName) {
        const res = await fetch(`${API_BASE}/${storeName}/count`);
        if (!res.ok) return 0;
        const data = await res.json();
        return data.count;
    }

    async clear(storeName) {
        const res = await fetch(`${API_BASE}/${storeName}/all`, { method: 'DELETE' });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Clear failed');
        }
    }

    // Export all data for backup/sync
    async exportAll() {
        const res = await fetch(`${API_BASE}/export/all`);
        if (!res.ok) throw new Error('Export failed');
        return await res.json();
    }

    // Import data from backup/sync
    async importData(data) {
        const res = await fetch(`${API_BASE}/import/all`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Import failed');
        return await res.json();
    }
}

const db = new Database();
