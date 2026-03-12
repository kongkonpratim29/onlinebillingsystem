// ============================================================
// Online Billing System - Express Server
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { testConnection } = require('./db');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files from parent directory
app.use(express.static(path.join(__dirname, '..')));

// API routes
app.use('/api', apiRoutes);

// Fallback: serve index.html for SPA
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Start server
async function start() {
    await testConnection();
    app.listen(PORT, () => {
        console.log(`\n🚀 Online Billing System Server running at http://localhost:${PORT}`);
        console.log(`   Open this URL in your browser to use the app.\n`);
    });
}

start();
