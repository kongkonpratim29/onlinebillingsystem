# Online Billing System

A comprehensive ERP system similar to Tally, built with Node.js, Express, and MySQL.

## Prerequisites

- **Node.js** v14+ (https://nodejs.org)
- **MySQL** 5.7+ or 8.0 (https://dev.mysql.com/downloads/)

## Setup Instructions

### 1. Create the MySQL Database

Open a terminal/command prompt and run:

```bash
mysql -u root -p < server/database.sql
```

This creates the `online_billing_system` database with all required tables and a default admin user.

### 2. Configure Database Connection

Edit `server/.env` and set your MySQL credentials:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=online_billing_system
SERVER_PORT=3000
```

### 3. Install Dependencies

```bash
cd server
npm install
```

### 4. Start the Server

```bash
cd server
npm start
```

### 5. Open the Application

Open your browser and go to:

```
http://localhost:3000
```

### 6. Login

- **Username:** `admin`
- **Password:** `admin123`

## Project Structure

```
online billing system/
├── index.html                  # Frontend entry point
├── css/
│   └── style.css               # Main stylesheet
├── js/
│   ├── database.js             # API client (talks to MySQL backend)
│   ├── app.js                  # Main application controller
│   └── modules/
│       ├── auth.js             # Authentication & Security
│       ├── accounting.js       # Accounting (Ledgers, Vouchers, P&L)
│       ├── inventory.js        # Inventory Management
│       ├── taxation.js         # GST & Taxation
│       ├── payroll.js          # Payroll Management
│       ├── banking.js          # Banking & Reconciliation
│       ├── reports.js          # MIS Reports & Analysis
│       └── sync.js             # Data Synchronization
├── server/
│   ├── package.json            # Node.js dependencies
│   ├── .env                    # Database configuration
│   ├── server.js               # Express server
│   ├── db.js                   # MySQL connection pool
│   ├── database.sql            # MySQL schema (run once)
│   └── routes/
│       └── api.js              # REST API routes
└── README.md
```

## Modules

| Module | Description |
|--------|-------------|
| **Accounting** | Double-entry bookkeeping, 8 voucher types, Balance Sheet, P&L |
| **Inventory** | Stock items, groups, movements, multi-location, reorder alerts |
| **GST & Taxation** | GST entries, calculator, returns (GSTR-1/2A/3B/9), TDS/TCS |
| **Payroll** | Employee management, attendance, salary processing, payslips |
| **Banking** | Bank accounts, transactions, reconciliation, cheque printing |
| **Security** | Role-based access control, audit trail, session management |
| **MIS Reports** | Dashboard, Cash Flow, Ratio Analysis, custom reports |
| **Data Sync** | Export/import JSON, backup & restore |

## Technology Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (SPA)
- **Backend:** Node.js, Express.js
- **Database:** MySQL
- **API:** RESTful JSON API
