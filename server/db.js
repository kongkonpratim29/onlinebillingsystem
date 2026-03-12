// ============================================================
// Online Billing System - MySQL Connection Pool
// ============================================================

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'online_billing_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test connection on startup
async function testConnection() {
    try {
        const conn = await pool.getConnection();
        console.log('✅ MySQL connected successfully to', process.env.DB_NAME || 'online_billing_system');
        conn.release();
    } catch (err) {
        console.error('❌ MySQL connection failed:', err.message);
        console.error('   Make sure MySQL is running and the database exists.');
        console.error('   Run: mysql -u root -p < database.sql');
        process.exit(1);
    }
}

module.exports = { pool, testConnection };
