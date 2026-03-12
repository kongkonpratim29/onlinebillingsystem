-- ============================================================
-- Online Billing System - MySQL Database Schema
-- 
-- For LOCAL setup:    mysql -u root -p < database.sql
-- For HOSTINGER:      Import via phpMyAdmin (skip the CREATE/USE DATABASE lines)
--                     Comment out or remove the 2 lines below before importing
-- ============================================================

CREATE DATABASE IF NOT EXISTS online_billing_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE online_billing_system;

-- ---- Users ----
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    fullName VARCHAR(255),
    role VARCHAR(50) DEFAULT 'viewer',
    email VARCHAR(255),
    active TINYINT(1) DEFAULT 1,
    permissions JSON,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_role (role)
) ENGINE=InnoDB;

-- ---- Ledgers ----
CREATE TABLE IF NOT EXISTS ledgers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    `group` VARCHAR(100),
    type VARCHAR(50),
    openingBalance DECIMAL(15,2) DEFAULT 0.00,
    address TEXT,
    gstin VARCHAR(20),
    pan VARCHAR(20),
    phone VARCHAR(30),
    email VARCHAR(255),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_group (`group`),
    INDEX idx_type (type)
) ENGINE=InnoDB;

-- ---- Vouchers ----
CREATE TABLE IF NOT EXISTS vouchers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(50),
    date DATE,
    voucherNo VARCHAR(50),
    narration TEXT,
    entries JSON,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_type (type),
    INDEX idx_date (date),
    INDEX idx_voucherNo (voucherNo)
) ENGINE=InnoDB;

-- ---- Stock Groups ----
CREATE TABLE IF NOT EXISTS stockGroups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    parent VARCHAR(255),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name)
) ENGINE=InnoDB;

-- ---- Stock Items ----
CREATE TABLE IF NOT EXISTS stockItems (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    `group` VARCHAR(100),
    unit VARCHAR(30),
    location VARCHAR(100),
    currentStock DECIMAL(15,3) DEFAULT 0,
    rate DECIMAL(15,2) DEFAULT 0.00,
    reorderLevel DECIMAL(15,3) DEFAULT 0,
    hsnCode VARCHAR(20),
    gstRate DECIMAL(5,2) DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_group (`group`),
    INDEX idx_location (location)
) ENGINE=InnoDB;

-- ---- Stock Movements ----
CREATE TABLE IF NOT EXISTS stockMovements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    itemId INT,
    date DATE,
    type VARCHAR(20),
    quantity DECIMAL(15,3) DEFAULT 0,
    rate DECIMAL(15,2) DEFAULT 0.00,
    location VARCHAR(100),
    reference VARCHAR(100),
    narration TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_itemId (itemId),
    INDEX idx_date (date),
    INDEX idx_type (type)
) ENGINE=InnoDB;

-- ---- Employees ----
CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empId VARCHAR(50) UNIQUE,
    name VARCHAR(255),
    department VARCHAR(100),
    designation VARCHAR(100),
    dateOfJoining DATE,
    basicSalary DECIMAL(15,2) DEFAULT 0,
    hra DECIMAL(15,2) DEFAULT 0,
    da DECIMAL(15,2) DEFAULT 0,
    specialAllowance DECIMAL(15,2) DEFAULT 0,
    otherAllowance DECIMAL(15,2) DEFAULT 0,
    pfEnabled TINYINT(1) DEFAULT 1,
    esiEnabled TINYINT(1) DEFAULT 1,
    pan VARCHAR(20),
    bankAccount VARCHAR(30),
    bankName VARCHAR(100),
    ifsc VARCHAR(20),
    phone VARCHAR(30),
    email VARCHAR(255),
    address TEXT,
    active TINYINT(1) DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_empId (empId),
    INDEX idx_department (department)
) ENGINE=InnoDB;

-- ---- Attendance ----
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employeeId INT,
    date DATE,
    status VARCHAR(20),
    inTime TIME,
    outTime TIME,
    remarks TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_employeeId (employeeId),
    INDEX idx_date (date)
) ENGINE=InnoDB;

-- ---- Salary Records ----
CREATE TABLE IF NOT EXISTS salaryRecords (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employeeId INT,
    employeeName VARCHAR(255),
    empId VARCHAR(50),
    month INT,
    year INT,
    earnings JSON,
    deductions JSON,
    netSalary DECIMAL(15,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'processed',
    processedDate DATE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_employeeId (employeeId),
    INDEX idx_month (month),
    INDEX idx_year (year)
) ENGINE=InnoDB;

-- ---- Bank Accounts ----
CREATE TABLE IF NOT EXISTS bankAccounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bankName VARCHAR(255),
    accountNo VARCHAR(50) UNIQUE,
    ifsc VARCHAR(20),
    branch VARCHAR(255),
    accountType VARCHAR(50),
    balance DECIMAL(15,2) DEFAULT 0,
    openingBalance DECIMAL(15,2) DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_accountNo (accountNo)
) ENGINE=InnoDB;

-- ---- Bank Transactions ----
CREATE TABLE IF NOT EXISTS bankTransactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    accountId INT,
    date DATE,
    type VARCHAR(20),
    amount DECIMAL(15,2) DEFAULT 0,
    description TEXT,
    reference VARCHAR(100),
    paymentMode VARCHAR(30),
    chequeNo VARCHAR(30),
    reconciled TINYINT(1) DEFAULT 0,
    reconciledDate DATE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_accountId (accountId),
    INDEX idx_date (date)
) ENGINE=InnoDB;

-- ---- Reconciliations ----
CREATE TABLE IF NOT EXISTS reconciliations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    accountId INT,
    date DATE,
    bankBalance DECIMAL(15,2) DEFAULT 0,
    bookBalance DECIMAL(15,2) DEFAULT 0,
    difference DECIMAL(15,2) DEFAULT 0,
    data JSON,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_accountId (accountId)
) ENGINE=InnoDB;

-- ---- Tax Entries ----
CREATE TABLE IF NOT EXISTS taxEntries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(20),
    subType VARCHAR(30),
    transType VARCHAR(20),
    supplyType VARCHAR(20),
    date DATE,
    invoiceNo VARCHAR(50),
    party VARCHAR(255),
    gstin VARCHAR(20),
    hsn VARCHAR(50),
    taxableAmount DECIMAL(15,2) DEFAULT 0,
    cgst DECIMAL(15,2) DEFAULT 0,
    sgst DECIMAL(15,2) DEFAULT 0,
    igst DECIMAL(15,2) DEFAULT 0,
    cess DECIMAL(15,2) DEFAULT 0,
    totalAmount DECIMAL(15,2) DEFAULT 0,
    gstRate DECIMAL(5,2) DEFAULT 0,
    period VARCHAR(20),
    tdsSection VARCHAR(20),
    tdsRate DECIMAL(5,2) DEFAULT 0,
    tdsAmount DECIMAL(15,2) DEFAULT 0,
    amount DECIMAL(15,2) DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_type (type),
    INDEX idx_period (period),
    INDEX idx_date (date)
) ENGINE=InnoDB;

-- ---- GST Returns ----
CREATE TABLE IF NOT EXISTS gstReturns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    returnType VARCHAR(20),
    period VARCHAR(20),
    status VARCHAR(20) DEFAULT 'draft',
    filingDate DATE,
    data JSON,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_returnType (returnType),
    INDEX idx_period (period)
) ENGINE=InnoDB;

-- ---- Audit Trail ----
CREATE TABLE IF NOT EXISTS auditTrail (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT,
    action VARCHAR(100),
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    ipAddress VARCHAR(50),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_userId (userId),
    INDEX idx_action (action),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB;

-- ---- Sync Log ----
CREATE TABLE IF NOT EXISTS syncLog (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(50),
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user VARCHAR(255),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB;

-- ---- Companies ----
CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    address TEXT,
    gstin VARCHAR(20),
    pan VARCHAR(20),
    phone VARCHAR(30),
    email VARCHAR(255),
    data JSON,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name)
) ENGINE=InnoDB;

-- ---- Settings ----
CREATE TABLE IF NOT EXISTS settings (
    `key` VARCHAR(100) PRIMARY KEY,
    value JSON,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Default admin user is created automatically by the frontend auth module on first run.
