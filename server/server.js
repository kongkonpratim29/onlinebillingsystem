// ============================================================
// Online Billing System - Express Server
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { testConnection } = require('./db');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

// Determine the frontend root directory
const frontendRoot = process.env.PUBLIC_DIR
    ? path.resolve(process.env.PUBLIC_DIR)
    : path.join(__dirname, '..');

console.log('Frontend root:', frontendRoot);
console.log('index.html exists:', fs.existsSync(path.join(frontendRoot, 'index.html')));

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(frontendRoot));

// API routes
app.use('/api', apiRoutes);

// Fallback: serve index.html for SPA
app.get('/', (req, res) => {
    const indexPath = path.join(frontendRoot, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(500).send(
            '<h1>Setup Error</h1>' +
            '<p>index.html not found at: ' + frontendRoot + '</p>' +
            '<p>Files found: ' + JSON.stringify(fs.readdirSync(frontendRoot).slice(0, 20)) + '</p>' +
            '<p>Set PUBLIC_DIR in server/.env to the folder containing index.html</p>' +
            '<p><a href="/api/health">View full diagnostics</a></p>'
        );
    }
});

// Start server
async function start() {
    await testConnection();
    app.listen(PORT, () => {
        console.log(`\n🚀 Online Billing System Server running at http://localhost:${PORT}`);
        console.log(`   Frontend root: ${frontendRoot}`);
        console.log(`   Open this URL in your browser to use the app.\n`);
    });
}

start();
