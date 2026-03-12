// ============================================================
// Online Billing System - Payroll Management Module
// ============================================================

class PayrollModule {
    constructor(database) {
        this.db = database;
        this.departments = ['Administration', 'Finance', 'Sales', 'Marketing', 'IT', 'HR', 'Operations', 'Production'];
        this.designations = ['Manager', 'Senior Executive', 'Executive', 'Assistant', 'Intern', 'Director', 'VP', 'Team Lead'];
    }

    // Employees
    async getEmployees() { return await this.db.getAll('employees'); }
    async getEmployee(id) { return await this.db.getById('employees', id); }
    async createEmployee(data) { return await this.db.add('employees', data); }
    async updateEmployee(data) { return await this.db.update('employees', data); }
    async deleteEmployee(id) { return await this.db.delete('employees', id); }

    // Attendance
    async getAttendance(employeeId = null) {
        if (employeeId) return await this.db.getByIndex('attendance', 'employeeId', employeeId);
        return await this.db.getAll('attendance');
    }
    async markAttendance(data) { return await this.db.add('attendance', data); }

    // Salary Records
    async getSalaryRecords(employeeId = null) {
        if (employeeId) return await this.db.getByIndex('salaryRecords', 'employeeId', employeeId);
        return await this.db.getAll('salaryRecords');
    }
    async addSalaryRecord(data) { return await this.db.add('salaryRecords', data); }

    // Calculate salary
    calculateSalary(employee, workingDays, presentDays) {
        const basic = employee.basicSalary || 0;
        const hra = employee.hra || 0;
        const da = employee.da || 0;
        const specialAllowance = employee.specialAllowance || 0;
        const otherAllowance = employee.otherAllowance || 0;

        const grossSalary = basic + hra + da + specialAllowance + otherAllowance;
        const perDaySalary = grossSalary / (workingDays || 30);
        const earnedGross = perDaySalary * presentDays;

        // Deductions
        const pfRate = employee.pfApplicable ? 12 : 0;
        const esiRate = earnedGross <= 21000 ? 0.75 : 0;

        const pf = (basic * pfRate) / 100;
        const esi = (earnedGross * esiRate) / 100;
        const professionalTax = earnedGross > 15000 ? 200 : (earnedGross > 10000 ? 150 : 0);
        const tds = employee.tdsAmount || 0;
        const otherDeductions = employee.otherDeductions || 0;

        const totalDeductions = pf + esi + professionalTax + tds + otherDeductions;
        const netSalary = earnedGross - totalDeductions;

        // Employer contributions
        const employerPF = pf;
        const employerESI = earnedGross <= 21000 ? (earnedGross * 3.25) / 100 : 0;

        return {
            earnings: {
                basic: (basic / (workingDays || 30)) * presentDays,
                hra: (hra / (workingDays || 30)) * presentDays,
                da: (da / (workingDays || 30)) * presentDays,
                specialAllowance: (specialAllowance / (workingDays || 30)) * presentDays,
                otherAllowance: (otherAllowance / (workingDays || 30)) * presentDays,
                grossSalary: earnedGross
            },
            deductions: {
                pf, esi, professionalTax, tds, otherDeductions,
                totalDeductions
            },
            employer: { pf: employerPF, esi: employerESI },
            netSalary,
            workingDays,
            presentDays,
            lop: workingDays - presentDays
        };
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
            <button class="tab active" data-tab="employees-tab">Employees</button>
            <button class="tab" data-tab="attendance-tab">Attendance</button>
            <button class="tab" data-tab="salary-process-tab">Process Salary</button>
            <button class="tab" data-tab="payslip-tab">Payslips</button>
            <button class="tab" data-tab="payroll-reports-tab">Reports</button>
        </div>

        <!-- Employees -->
        <div id="employees-tab" class="tab-content active">
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="search-box">
                        <span>🔍</span>
                        <input type="text" id="empSearch" placeholder="Search employees..." oninput="app.payroll.filterEmployees()">
                    </div>
                    <select class="filter-select" id="empDeptFilter" onchange="app.payroll.filterEmployees()">
                        <option value="">All Departments</option>
                        ${this.departments.map(d => `<option value="${d}">${d}</option>`).join('')}
                    </select>
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-primary" onclick="app.payroll.showEmployeeModal()">+ Add Employee</button>
                </div>
            </div>
            <div class="card">
                <div class="card-body">
                    <table class="data-table" id="employeesTable">
                        <thead>
                            <tr>
                                <th>Emp ID</th>
                                <th>Name</th>
                                <th>Department</th>
                                <th>Designation</th>
                                <th class="amount">Gross Salary</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Attendance -->
        <div id="attendance-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-left">
                    <input type="date" class="filter-select" id="attDate" value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-primary" onclick="app.payroll.markBulkAttendance()">Mark Attendance</button>
                </div>
            </div>
            <div class="card">
                <div class="card-body" id="attendanceContent"></div>
            </div>
        </div>

        <!-- Process Salary -->
        <div id="salary-process-tab" class="tab-content">
            <div class="card">
                <div class="card-header"><h3>Salary Processing</h3></div>
                <div class="card-body">
                    <div class="form-row-3">
                        <div class="form-group">
                            <label>Month</label>
                            <select id="salaryMonth">
                                ${['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => 
                                    `<option value="${i + 1}" ${i === new Date().getMonth() ? 'selected' : ''}>${m}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Year</label>
                            <input type="number" id="salaryYear" value="${new Date().getFullYear()}">
                        </div>
                        <div class="form-group">
                            <label>Working Days</label>
                            <input type="number" id="workingDays" value="30">
                        </div>
                    </div>
                    <button class="btn btn-primary mt-1" onclick="app.payroll.processSalary()">Process Salary</button>
                    <div id="salaryProcessResult" class="mt-2"></div>
                </div>
            </div>
        </div>

        <!-- Payslips -->
        <div id="payslip-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-left">
                    <select class="filter-select" id="payslipEmployee">
                        <option value="">Select Employee</option>
                    </select>
                    <select class="filter-select" id="payslipMonth">
                        ${['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => 
                            `<option value="${i + 1}">${m}</option>`).join('')}
                    </select>
                    <input type="number" class="filter-select" id="payslipYear" value="${new Date().getFullYear()}" style="width:100px">
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-primary" onclick="app.payroll.generatePayslip()">Generate Payslip</button>
                    <button class="btn btn-outline" onclick="app.payroll.printPayslip()">🖨️ Print</button>
                </div>
            </div>
            <div id="payslipContent"></div>
        </div>

        <!-- Reports -->
        <div id="payroll-reports-tab" class="tab-content">
            <div class="toolbar">
                <div class="toolbar-left">
                    <select class="filter-select" id="prMonth">
                        ${['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => 
                            `<option value="${i + 1}" ${i === new Date().getMonth() ? 'selected' : ''}>${m}</option>`).join('')}
                    </select>
                    <input type="number" class="filter-select" id="prYear" value="${new Date().getFullYear()}" style="width:100px">
                    <button class="btn btn-primary" onclick="app.payroll.loadPayrollReport()">Generate Report</button>
                </div>
            </div>
            <div id="payrollReportContent"></div>
        </div>`;
    }

    async loadData() {
        await this.loadEmployeesTable();
        await this.loadEmployeeDropdowns();
    }

    async loadEmployeeDropdowns() {
        const employees = await this.getEmployees();
        const select = document.getElementById('payslipEmployee');
        if (select) {
            select.innerHTML = '<option value="">Select Employee</option>' +
                employees.map(e => `<option value="${e.id}">${this.escapeHtml(e.empId)} - ${this.escapeHtml(e.name)}</option>`).join('');
        }
    }

    async loadEmployeesTable() {
        const employees = await this.getEmployees();
        const tbody = document.querySelector('#employeesTable tbody');
        if (!tbody) return;

        tbody.innerHTML = employees.length ? employees.map(e => {
            const gross = (e.basicSalary || 0) + (e.hra || 0) + (e.da || 0) + (e.specialAllowance || 0) + (e.otherAllowance || 0);
            return `
            <tr>
                <td><strong>${this.escapeHtml(e.empId)}</strong></td>
                <td>${this.escapeHtml(e.name)}</td>
                <td>${this.escapeHtml(e.department || '-')}</td>
                <td>${this.escapeHtml(e.designation || '-')}</td>
                <td class="amount">${this.formatCurrency(gross)}</td>
                <td><span class="badge ${e.active !== false ? 'badge-success' : 'badge-danger'}">${e.active !== false ? 'Active' : 'Inactive'}</span></td>
                <td class="actions">
                    <button class="btn btn-sm btn-outline" onclick="app.payroll.showEmployeeModal(${e.id})">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="app.payroll.removeEmployee(${e.id})">Delete</button>
                </td>
            </tr>`;
        }).join('') : '<tr><td colspan="7" class="text-center text-muted">No employees found</td></tr>';
    }

    filterEmployees() {
        const search = (document.getElementById('empSearch')?.value || '').toLowerCase();
        const dept = document.getElementById('empDeptFilter')?.value || '';
        const rows = document.querySelectorAll('#employeesTable tbody tr');
        rows.forEach(row => {
            const name = (row.cells[1]?.textContent || '').toLowerCase();
            const d = row.cells[2]?.textContent || '';
            row.style.display = (!search || name.includes(search)) && (!dept || d === dept) ? '' : 'none';
        });
    }

    showEmployeeModal(empId = null) {
        const isEdit = empId !== null;
        const modalHtml = `
        <div class="modal-overlay active" id="empModal">
            <div class="modal" style="width:750px;max-height:90vh">
                <div class="modal-header">
                    <h3>${isEdit ? 'Edit Employee' : 'Add Employee'}</h3>
                    <button class="modal-close" onclick="app.closeModal('empModal')">&times;</button>
                </div>
                <div class="modal-body" style="max-height:65vh;overflow-y:auto">
                    <input type="hidden" id="empEditId" value="${empId || ''}">
                    <h4 class="mb-1">Personal Details</h4>
                    <div class="form-row-3">
                        <div class="form-group">
                            <label>Employee ID</label>
                            <input type="text" id="empEmpId" placeholder="EMP001">
                        </div>
                        <div class="form-group">
                            <label>Full Name</label>
                            <input type="text" id="empName">
                        </div>
                        <div class="form-group">
                            <label>Date of Joining</label>
                            <input type="date" id="empDoj">
                        </div>
                    </div>
                    <div class="form-row-3">
                        <div class="form-group">
                            <label>Department</label>
                            <select id="empDept">
                                ${this.departments.map(d => `<option value="${d}">${d}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Designation</label>
                            <select id="empDesig">
                                ${this.designations.map(d => `<option value="${d}">${d}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>PAN</label>
                            <input type="text" id="empPan" placeholder="ABCDE1234F">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="empEmail">
                        </div>
                        <div class="form-group">
                            <label>Phone</label>
                            <input type="tel" id="empPhone">
                        </div>
                    </div>

                    <h4 class="mt-2 mb-1">Salary Structure</h4>
                    <div class="form-row-3">
                        <div class="form-group">
                            <label>Basic Salary (₹)</label>
                            <input type="number" id="empBasic" value="0" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>HRA (₹)</label>
                            <input type="number" id="empHRA" value="0" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>DA (₹)</label>
                            <input type="number" id="empDA" value="0" step="0.01">
                        </div>
                    </div>
                    <div class="form-row-3">
                        <div class="form-group">
                            <label>Special Allowance (₹)</label>
                            <input type="number" id="empSpecial" value="0" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>Other Allowance (₹)</label>
                            <input type="number" id="empOther" value="0" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>TDS per Month (₹)</label>
                            <input type="number" id="empTDS" value="0" step="0.01">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label><input type="checkbox" id="empPF" checked> PF Applicable</label>
                        </div>
                        <div class="form-group">
                            <label>Bank Account No</label>
                            <input type="text" id="empBankAcc">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="app.closeModal('empModal')">Cancel</button>
                    <button class="btn btn-primary" onclick="app.payroll.saveEmployee()">Save</button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        if (isEdit) this.loadEmployeeForEdit(empId);
    }

    async loadEmployeeForEdit(id) {
        const emp = await this.getEmployee(id);
        if (!emp) return;
        document.getElementById('empEmpId').value = emp.empId || '';
        document.getElementById('empName').value = emp.name || '';
        document.getElementById('empDoj').value = emp.doj || '';
        document.getElementById('empDept').value = emp.department || '';
        document.getElementById('empDesig').value = emp.designation || '';
        document.getElementById('empPan').value = emp.pan || '';
        document.getElementById('empEmail').value = emp.email || '';
        document.getElementById('empPhone').value = emp.phone || '';
        document.getElementById('empBasic').value = emp.basicSalary || 0;
        document.getElementById('empHRA').value = emp.hra || 0;
        document.getElementById('empDA').value = emp.da || 0;
        document.getElementById('empSpecial').value = emp.specialAllowance || 0;
        document.getElementById('empOther').value = emp.otherAllowance || 0;
        document.getElementById('empTDS').value = emp.tdsAmount || 0;
        document.getElementById('empPF').checked = emp.pfApplicable !== false;
        document.getElementById('empBankAcc').value = emp.bankAccount || '';
    }

    async saveEmployee() {
        const id = document.getElementById('empEditId').value;
        const data = {
            empId: document.getElementById('empEmpId').value.trim(),
            name: document.getElementById('empName').value.trim(),
            doj: document.getElementById('empDoj').value,
            department: document.getElementById('empDept').value,
            designation: document.getElementById('empDesig').value,
            pan: document.getElementById('empPan').value.trim(),
            email: document.getElementById('empEmail').value.trim(),
            phone: document.getElementById('empPhone').value.trim(),
            basicSalary: parseFloat(document.getElementById('empBasic').value) || 0,
            hra: parseFloat(document.getElementById('empHRA').value) || 0,
            da: parseFloat(document.getElementById('empDA').value) || 0,
            specialAllowance: parseFloat(document.getElementById('empSpecial').value) || 0,
            otherAllowance: parseFloat(document.getElementById('empOther').value) || 0,
            tdsAmount: parseFloat(document.getElementById('empTDS').value) || 0,
            pfApplicable: document.getElementById('empPF').checked,
            bankAccount: document.getElementById('empBankAcc').value.trim(),
            active: true
        };

        if (!data.name || !data.empId) {
            app.showToast('Employee ID and Name are required', 'error');
            return;
        }

        try {
            if (id) {
                data.id = parseInt(id);
                const existing = await this.getEmployee(data.id);
                data.createdAt = existing.createdAt;
                await this.updateEmployee(data);
            } else {
                await this.createEmployee(data);
            }
            app.closeModal('empModal');
            app.showToast('Employee saved', 'success');
            this.loadEmployeesTable();
            this.loadEmployeeDropdowns();
        } catch (e) {
            app.showToast(e.message, 'error');
        }
    }

    async removeEmployee(id) {
        if (confirm('Delete this employee?')) {
            await this.deleteEmployee(id);
            app.showToast('Employee deleted', 'success');
            this.loadEmployeesTable();
        }
    }

    async loadAttendance() {
        const date = document.getElementById('attDate')?.value || new Date().toISOString().split('T')[0];
        const employees = await this.getEmployees();
        const attendance = await this.getAttendance();
        const todayAtt = {};
        attendance.filter(a => a.date === date).forEach(a => todayAtt[a.employeeId] = a.status);

        const content = document.getElementById('attendanceContent');
        if (!content) return;

        content.innerHTML = `
            <table class="data-table">
                <thead><tr><th>Emp ID</th><th>Name</th><th>Department</th><th>Status</th></tr></thead>
                <tbody>
                    ${employees.filter(e => e.active !== false).map(e => `
                        <tr>
                            <td>${this.escapeHtml(e.empId)}</td>
                            <td>${this.escapeHtml(e.name)}</td>
                            <td>${this.escapeHtml(e.department || '-')}</td>
                            <td>
                                <select class="filter-select att-status" data-emp-id="${e.id}">
                                    <option value="present" ${todayAtt[e.id] === 'present' ? 'selected' : ''}>Present</option>
                                    <option value="absent" ${todayAtt[e.id] === 'absent' ? 'selected' : ''}>Absent</option>
                                    <option value="halfday" ${todayAtt[e.id] === 'halfday' ? 'selected' : ''}>Half Day</option>
                                    <option value="leave" ${todayAtt[e.id] === 'leave' ? 'selected' : ''}>Leave</option>
                                </select>
                            </td>
                        </tr>`).join('')}
                </tbody>
            </table>`;
    }

    async markBulkAttendance() {
        const date = document.getElementById('attDate')?.value;
        if (!date) return;

        const selects = document.querySelectorAll('.att-status');
        for (const sel of selects) {
            const employeeId = parseInt(sel.dataset.empId);
            const status = sel.value;
            await this.markAttendance({ employeeId, date, status });
        }
        app.showToast('Attendance marked for all employees', 'success');
    }

    async processSalary() {
        const month = parseInt(document.getElementById('salaryMonth').value);
        const year = parseInt(document.getElementById('salaryYear').value);
        const workingDays = parseInt(document.getElementById('workingDays').value) || 30;

        const employees = await this.getEmployees();
        const attendance = await this.getAttendance();
        const result = document.getElementById('salaryProcessResult');
        if (!result) return;

        let totalNet = 0, totalGross = 0, totalPF = 0;
        const records = [];

        let html = `<table class="data-table"><thead><tr>
            <th>Employee</th><th class="amount">Gross</th><th class="amount">Deductions</th>
            <th class="amount">Net Salary</th><th>Days</th></tr></thead><tbody>`;

        for (const emp of employees) {
            if (emp.active === false) continue;

            // Count present days for the month
            const monthAtt = attendance.filter(a => {
                const d = new Date(a.date);
                return a.employeeId === emp.id && d.getMonth() + 1 === month && d.getFullYear() === year;
            });
            const presentDays = monthAtt.filter(a => a.status === 'present').length +
                monthAtt.filter(a => a.status === 'halfday').length * 0.5;

            const effectiveDays = presentDays || workingDays; // If no attendance marked, assume full
            const calc = this.calculateSalary(emp, workingDays, effectiveDays);

            totalGross += calc.earnings.grossSalary;
            totalNet += calc.netSalary;
            totalPF += calc.deductions.pf;

            records.push({ employee: emp, calculation: calc, month, year });

            html += `<tr>
                <td>${this.escapeHtml(emp.name)}</td>
                <td class="amount">${this.formatCurrency(calc.earnings.grossSalary)}</td>
                <td class="amount">${this.formatCurrency(calc.deductions.totalDeductions)}</td>
                <td class="amount"><strong>${this.formatCurrency(calc.netSalary)}</strong></td>
                <td>${effectiveDays}/${workingDays}</td>
            </tr>`;
        }

        html += `<tr style="border-top:2px solid #333">
            <td><strong>Total</strong></td>
            <td class="amount"><strong>${this.formatCurrency(totalGross)}</strong></td>
            <td class="amount"><strong>${this.formatCurrency(totalGross - totalNet)}</strong></td>
            <td class="amount"><strong>${this.formatCurrency(totalNet)}</strong></td>
            <td></td></tr></tbody></table>`;

        html += `<div class="mt-2"><button class="btn btn-success" onclick="app.payroll.confirmProcessSalary()">Confirm & Save Salary Records</button></div>`;

        result.innerHTML = html;
        this._pendingRecords = records;
    }

    async confirmProcessSalary() {
        if (!this._pendingRecords) return;
        for (const rec of this._pendingRecords) {
            await this.addSalaryRecord({
                employeeId: rec.employee.id,
                empId: rec.employee.empId,
                name: rec.employee.name,
                month: rec.month,
                year: rec.year,
                ...rec.calculation
            });
        }
        app.showToast(`Salary processed for ${this._pendingRecords.length} employees`, 'success');
        this._pendingRecords = null;
    }

    async generatePayslip() {
        const empId = parseInt(document.getElementById('payslipEmployee')?.value);
        const month = parseInt(document.getElementById('payslipMonth')?.value);
        const year = parseInt(document.getElementById('payslipYear')?.value);

        if (!empId) {
            app.showToast('Please select an employee', 'error');
            return;
        }

        const records = await this.getSalaryRecords(empId);
        const record = records.find(r => r.month === month && r.year === year);
        const emp = await this.getEmployee(empId);

        const content = document.getElementById('payslipContent');
        if (!content) return;

        if (!record) {
            content.innerHTML = '<div class="empty-state"><h3>No salary record found</h3><p>Process salary first for this month</p></div>';
            return;
        }

        const months = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        content.innerHTML = `
        <div class="payslip" id="payslipPrint">
            <div class="payslip-header">
                <h2>Online Billing System</h2>
                <p>Payslip for ${months[month]} ${year}</p>
            </div>
            <div class="payslip-details">
                <div class="item"><span>Employee ID:</span><strong>${this.escapeHtml(emp?.empId || record.empId)}</strong></div>
                <div class="item"><span>Name:</span><strong>${this.escapeHtml(emp?.name || record.name)}</strong></div>
                <div class="item"><span>Department:</span><strong>${this.escapeHtml(emp?.department || '-')}</strong></div>
                <div class="item"><span>Designation:</span><strong>${this.escapeHtml(emp?.designation || '-')}</strong></div>
                <div class="item"><span>Working Days:</span><strong>${record.workingDays}</strong></div>
                <div class="item"><span>Present Days:</span><strong>${record.presentDays}</strong></div>
                <div class="item"><span>LOP Days:</span><strong>${record.lop || 0}</strong></div>
                <div class="item"><span>PAN:</span><strong>${this.escapeHtml(emp?.pan || '-')}</strong></div>
            </div>
            <table class="payslip-table">
                <tr style="background:var(--bg)"><td><strong>Earnings</strong></td><td class="amount"><strong>Amount (₹)</strong></td>
                    <td><strong>Deductions</strong></td><td class="amount"><strong>Amount (₹)</strong></td></tr>
                <tr>
                    <td>Basic Salary</td><td class="amount">${this.formatCurrency(record.earnings?.basic || 0)}</td>
                    <td>Provident Fund</td><td class="amount">${this.formatCurrency(record.deductions?.pf || 0)}</td>
                </tr>
                <tr>
                    <td>HRA</td><td class="amount">${this.formatCurrency(record.earnings?.hra || 0)}</td>
                    <td>ESI</td><td class="amount">${this.formatCurrency(record.deductions?.esi || 0)}</td>
                </tr>
                <tr>
                    <td>DA</td><td class="amount">${this.formatCurrency(record.earnings?.da || 0)}</td>
                    <td>Professional Tax</td><td class="amount">${this.formatCurrency(record.deductions?.professionalTax || 0)}</td>
                </tr>
                <tr>
                    <td>Special Allowance</td><td class="amount">${this.formatCurrency(record.earnings?.specialAllowance || 0)}</td>
                    <td>TDS</td><td class="amount">${this.formatCurrency(record.deductions?.tds || 0)}</td>
                </tr>
                <tr>
                    <td>Other Allowance</td><td class="amount">${this.formatCurrency(record.earnings?.otherAllowance || 0)}</td>
                    <td>Other Deductions</td><td class="amount">${this.formatCurrency(record.deductions?.otherDeductions || 0)}</td>
                </tr>
                <tr style="border-top:2px solid var(--primary);background:var(--bg)">
                    <td><strong>Gross Salary</strong></td><td class="amount"><strong>${this.formatCurrency(record.earnings?.grossSalary || 0)}</strong></td>
                    <td><strong>Total Deductions</strong></td><td class="amount"><strong>${this.formatCurrency(record.deductions?.totalDeductions || 0)}</strong></td>
                </tr>
            </table>
            <div style="text-align:right;padding:12px;background:var(--primary);color:white;border-radius:var(--radius-sm)">
                <strong>Net Salary: ${this.formatCurrency(record.netSalary || 0)}</strong>
            </div>
        </div>`;
    }

    printPayslip() {
        const content = document.getElementById('payslipPrint');
        if (!content) {
            app.showToast('Generate a payslip first', 'warning');
            return;
        }
        const win = window.open('', '_blank');
        win.document.write(`<html><head><title>Payslip</title><link rel="stylesheet" href="css/style.css"></head><body style="padding:20px">${content.innerHTML}</body></html>`);
        win.document.close();
        win.print();
    }

    async loadPayrollReport() {
        const month = parseInt(document.getElementById('prMonth')?.value);
        const year = parseInt(document.getElementById('prYear')?.value);
        const allRecords = await this.getSalaryRecords();
        const records = allRecords.filter(r => r.month === month && r.year === year);

        const content = document.getElementById('payrollReportContent');
        if (!content) return;

        if (records.length === 0) {
            content.innerHTML = '<div class="empty-state"><h3>No records found</h3><p>Process salary for this month first</p></div>';
            return;
        }

        let totalGross = 0, totalDeductions = 0, totalNet = 0, totalPF = 0, totalESI = 0;
        records.forEach(r => {
            totalGross += r.earnings?.grossSalary || 0;
            totalDeductions += r.deductions?.totalDeductions || 0;
            totalNet += r.netSalary || 0;
            totalPF += r.deductions?.pf || 0;
            totalESI += r.deductions?.esi || 0;
        });

        const months = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        content.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon blue">👥</div><div class="stat-info"><h4>${records.length}</h4><p>Employees</p></div></div>
            <div class="stat-card"><div class="stat-icon green">💰</div><div class="stat-info"><h4>${this.formatCurrency(totalGross)}</h4><p>Total Gross</p></div></div>
            <div class="stat-card"><div class="stat-icon orange">📉</div><div class="stat-info"><h4>${this.formatCurrency(totalDeductions)}</h4><p>Total Deductions</p></div></div>
            <div class="stat-card"><div class="stat-icon blue">💵</div><div class="stat-info"><h4>${this.formatCurrency(totalNet)}</h4><p>Total Net Pay</p></div></div>
        </div>
        <div class="card">
            <div class="card-header"><h3>Payroll Register - ${months[month]} ${year}</h3></div>
            <div class="card-body">
                <table class="data-table">
                    <thead><tr><th>Employee</th><th class="amount">Basic</th><th class="amount">Gross</th><th class="amount">PF</th><th class="amount">ESI</th><th class="amount">Other Ded.</th><th class="amount">Net Pay</th></tr></thead>
                    <tbody>
                        ${records.map(r => `<tr>
                            <td>${this.escapeHtml(r.name || '-')}</td>
                            <td class="amount">${this.formatCurrency(r.earnings?.basic || 0)}</td>
                            <td class="amount">${this.formatCurrency(r.earnings?.grossSalary || 0)}</td>
                            <td class="amount">${this.formatCurrency(r.deductions?.pf || 0)}</td>
                            <td class="amount">${this.formatCurrency(r.deductions?.esi || 0)}</td>
                            <td class="amount">${this.formatCurrency((r.deductions?.professionalTax || 0) + (r.deductions?.tds || 0))}</td>
                            <td class="amount"><strong>${this.formatCurrency(r.netSalary || 0)}</strong></td>
                        </tr>`).join('')}
                        <tr style="border-top:2px solid #333">
                            <td><strong>Total</strong></td>
                            <td></td>
                            <td class="amount"><strong>${this.formatCurrency(totalGross)}</strong></td>
                            <td class="amount"><strong>${this.formatCurrency(totalPF)}</strong></td>
                            <td class="amount"><strong>${this.formatCurrency(totalESI)}</strong></td>
                            <td></td>
                            <td class="amount"><strong>${this.formatCurrency(totalNet)}</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>`;
    }
}
