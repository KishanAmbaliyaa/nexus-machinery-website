// ============================================================
// NEXUS ADMIN PANEL - MAIN JAVASCRIPT
// ============================================================

let currentUser = null;

// ============================================================
// SECURITY SANITIZATION UTILITIES
// ============================================================
function sanitizeText(input, maxLength = 500) {
    if (input === null || input === undefined) return '';
    let clean = String(input).trim();
    clean = clean.replace(/<[^>]*>/g, ''); // Strip HTML tags
    clean = clean.replace(/[<>"'`\\{}\[\];|&^]/g, ''); // Strip dangerous injection characters
    clean = clean.replace(/javascript\s*:/gi, '');
    clean = clean.replace(/data\s*:/gi, '');
    // eslint-disable-next-line no-control-regex
    clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    return clean.substring(0, maxLength);
}

function sanitizePhone(input) {
    if (!input) return '';
    return String(input).replace(/\D/g, '').substring(0, 15);
}

function sanitizeEmail(input) {
    if (!input || String(input).trim() === '') return '';
    const clean = sanitizeText(String(input), 254).toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(clean) ? clean : '';
}

// ============================================================
// AUTH
// ============================================================
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        document.getElementById('admin-email').textContent = user.email;
        loadDashboard();
    } else {
        currentUser = null;
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('admin-panel').classList.add('hidden');
    }
});

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';

    try {
        await firebase.auth().signInWithEmailAndPassword(email, password);
    } catch (error) {
        errorEl.textContent = error.message;
    }
}

function handleLogout() {
    firebase.auth().signOut();
}

// ============================================================
// NAVIGATION
// ============================================================
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    document.getElementById(`tab-${tabName}`).classList.add('active');
    event.currentTarget.classList.add('active');

    const titles = {
        dashboard: 'Dashboard',
        bookings: 'Service Bookings',
        products: 'Product Listings',
        employees: 'Employees',
        inquiries: 'Product Inquiries',
        customers: 'Customers',
    };
    document.getElementById('page-title').textContent = titles[tabName] || 'Dashboard';

    if (tabName === 'dashboard') loadDashboard();
    if (tabName === 'bookings') loadBookings();
    if (tabName === 'products') loadProducts();
    if (tabName === 'employees') loadEmployees();
    if (tabName === 'inquiries') loadInquiries();
    if (tabName === 'customers') loadCustomers();

    // Close mobile sidebar
    document.querySelector('.sidebar').classList.remove('open');
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('open');
}

// ============================================================
// DASHBOARD
// ============================================================
async function loadDashboard() {
    try {
        const [bookings, products, employees, inquiries] = await Promise.all([
            fetch(`${SERVICE_API}/bookings`).then(r => r.json()),
            fetch(`${SELLING_API}/products`).then(r => r.json()),
            fetch(`${SERVICE_API}/employees`).then(r => r.json()),
            fetch(`${SELLING_API}/inquiries`).then(r => r.json()),
        ]);

        const openBookings = bookings.filter(b => b.status === 'open' || b.status === 'accepted');
        const newInquiries = inquiries.filter(i => i.status === 'new');

        document.getElementById('stat-bookings').textContent = openBookings.length;
        document.getElementById('stat-products').textContent = products.length;
        document.getElementById('stat-employees').textContent = employees.length;
        document.getElementById('stat-inquiries').textContent = newInquiries.length;

        // Recent bookings table
        const recent = bookings.slice(0, 5);
        if (recent.length === 0) {
            document.getElementById('recent-bookings').innerHTML = '<p class="no-data">No bookings yet</p>';
        } else {
            document.getElementById('recent-bookings').innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Customer</th>
                            <th>Machine</th>
                            <th>Date</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${recent.map(b => `
                            <tr>
                                <td>${b.customerName}</td>
                                <td>${b.machineType}</td>
                                <td>${b.preferredDate}</td>
                                <td><span class="badge badge-${b.status}">${b.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
    } catch (error) {
        document.getElementById('recent-bookings').innerHTML = '<p class="no-data">Could not connect to backend. Make sure both servers are running.</p>';
    }
}

// ============================================================
// BOOKINGS
// ============================================================
async function loadBookings() {
    const container = document.getElementById('bookings-list');
    container.innerHTML = '<p class="loading">Loading...</p>';

    try {
        const response = await fetch(`${SERVICE_API}/bookings`);
        const bookings = await response.json();

        const filter = document.getElementById('booking-status-filter').value;
        const filtered = filter ? bookings.filter(b => b.status === filter) : bookings;

        if (filtered.length === 0) {
            container.innerHTML = '<p class="no-data">No bookings found</p>';
            return;
        }

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Customer</th>
                        <th>Phone</th>
                        <th>Machine</th>
                        <th>Service</th>
                        <th>Date & Time</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(b => `
                        <tr>
                            <td>${b.customerName}</td>
                            <td>${b.customerPhone}</td>
                            <td>${b.machineType}</td>
                            <td>${b.serviceType}</td>
                            <td>${b.preferredDate}<br><small>${b.preferredTime}</small></td>
                            <td><span class="badge badge-${b.status}">${b.status}</span></td>
                            <td class="action-btns">
                                <button class="btn btn-small btn-outline" onclick="viewBooking('${b.id}')">View</button>
                                ${b.status === 'open' ? `<button class="btn btn-small btn-primary" onclick="updateBookingStatus('${b.id}', 'accepted')">Accept</button>` : ''}
                                ${b.status === 'accepted' ? `<button class="btn btn-small btn-primary" onclick="updateBookingStatus('${b.id}', 'in_progress')">Start</button>` : ''}
                                ${b.status === 'in_progress' ? `<button class="btn btn-small btn-primary" onclick="updateBookingStatus('${b.id}', 'completed')">Complete</button>` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        container.innerHTML = '<p class="no-data">Failed to load bookings. Is the service backend running?</p>';
    }
}

async function viewBooking(id) {
    try {
        const response = await fetch(`${SERVICE_API}/bookings/${id}`);
        const b = await response.json();

        document.getElementById('booking-detail-content').innerHTML = `
            <div class="form-group"><label>Booking ID</label><p>${b.id}</p></div>
            <div class="form-row">
                <div class="form-group"><label>Customer</label><p>${b.customerName}</p></div>
                <div class="form-group"><label>Phone</label><p>${b.customerPhone}</p></div>
            </div>
            <div class="form-group"><label>Address</label><p>${b.customerAddress}</p></div>
            <div class="form-row">
                <div class="form-group"><label>Machine</label><p>${b.machineType}</p></div>
                <div class="form-group"><label>Service</label><p>${b.serviceType}</p></div>
            </div>
            <div class="form-group"><label>Issue</label><p>${b.issueDescription || 'Not specified'}</p></div>
            <div class="form-row">
                <div class="form-group"><label>Date</label><p>${b.preferredDate}</p></div>
                <div class="form-group"><label>Time</label><p>${b.preferredTime}</p></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Status</label><p><span class="badge badge-${b.status}">${b.status}</span></p></div>
                <div class="form-group"><label>Priority</label><p>${b.priority}</p></div>
            </div>
            <div class="form-group"><label>Source</label><p>${b.source}</p></div>
            <div class="form-group"><label>Created</label><p>${new Date(b.createdAt).toLocaleString()}</p></div>
        `;
        document.getElementById('booking-detail-modal').classList.add('active');
    } catch (error) {
        alert('Failed to load booking details');
    }
}

function closeBookingDetailModal() {
    document.getElementById('booking-detail-modal').classList.remove('active');
}

async function updateBookingStatus(id, status) {
    try {
        await fetch(`${SERVICE_API}/bookings/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        loadBookings();
    } catch (error) {
        alert('Failed to update booking');
    }
}

// ============================================================
// PRODUCTS
// ============================================================
async function loadProducts() {
    const container = document.getElementById('products-list');
    container.innerHTML = '<p class="loading">Loading...</p>';

    try {
        const response = await fetch(`${SELLING_API}/products`);
        const products = await response.json();

        if (products.length === 0) {
            container.innerHTML = '<p class="no-data">No products listed yet. Click "Add Product" to get started.</p>';
            return;
        }

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Stock</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map(p => `
                        <tr>
                            <td>${p.name}</td>
                            <td>${p.machineType}</td>
                            <td>${p.category}</td>
                            <td>${p.price}</td>
                            <td>${p.stockCount}</td>
                            <td><span class="badge badge-${p.status}">${p.status}</span></td>
                            <td class="action-btns">
                                <button class="btn btn-small btn-outline" onclick="editProduct('${p.id}')">Edit</button>
                                <button class="btn btn-small btn-danger" onclick="deleteProduct('${p.id}')">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        container.innerHTML = '<p class="no-data">Failed to load products. Is the selling backend running?</p>';
    }
}

function openProductModal(product) {
    document.getElementById('product-modal-title').textContent = product ? 'Edit Product' : 'Add New Product';
    document.getElementById('product-form').reset();
    document.getElementById('product-edit-id').value = '';

    if (product) {
        document.getElementById('product-edit-id').value = product.id;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-machine-type').value = product.machineType;
        document.getElementById('product-category').value = product.category;
        document.getElementById('product-price').value = product.price;
        document.getElementById('product-stock').value = product.stockCount;
        document.getElementById('product-condition').value = product.condition || '';
        document.getElementById('product-description').value = product.description || '';
        document.getElementById('product-images').value = (product.images || []).join(', ');
    }

    document.getElementById('product-modal').classList.add('active');
}

function closeProductModal() {
    document.getElementById('product-modal').classList.remove('active');
}

async function handleProductSubmit(event) {
    event.preventDefault();

    const editId = document.getElementById('product-edit-id').value;
    const imagesRaw = document.getElementById('product-images').value;
    const images = imagesRaw ? imagesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

    const data = {
        name: sanitizeText(document.getElementById('product-name').value, 200),
        machineType: sanitizeText(document.getElementById('product-machine-type').value, 50),
        category: sanitizeText(document.getElementById('product-category').value, 20),
        price: sanitizeText(document.getElementById('product-price').value || 'Contact for Price', 50),
        stockCount: parseInt(document.getElementById('product-stock').value) || 0,
        condition: sanitizeText(document.getElementById('product-condition').value, 50),
        description: sanitizeText(document.getElementById('product-description').value, 1000),
        images: images.map(img => sanitizeText(img, 500)),
    };

    try {
        if (editId) {
            await fetch(`${SELLING_API}/products/${editId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
        } else {
            await fetch(`${SELLING_API}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
        }
        closeProductModal();
        loadProducts();
    } catch (error) {
        alert('Failed to save product');
    }
}

async function editProduct(id) {
    try {
        const response = await fetch(`${SELLING_API}/products/${id}`);
        const product = await response.json();
        openProductModal(product);
    } catch (error) {
        alert('Failed to load product');
    }
}

async function deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
        await fetch(`${SELLING_API}/products/${id}`, { method: 'DELETE' });
        loadProducts();
    } catch (error) {
        alert('Failed to delete product');
    }
}

// ============================================================
// EMPLOYEES
// ============================================================
async function loadEmployees() {
    const container = document.getElementById('employees-list');
    container.innerHTML = '<p class="loading">Loading...</p>';

    try {
        const response = await fetch(`${SERVICE_API}/employees`);
        const employees = await response.json();

        if (employees.length === 0) {
            container.innerHTML = '<p class="no-data">No employees added yet. Click "Add Employee" to get started.</p>';
            return;
        }

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Jobs Done</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${employees.map(e => `
                        <tr>
                            <td>${e.name}</td>
                            <td>${e.phone}</td>
                            <td>${e.email || '-'}</td>
                            <td>${e.role}</td>
                            <td><span class="badge badge-${e.status}">${e.status}</span></td>
                            <td>${e.jobsCompleted || 0}</td>
                            <td class="action-btns">
                                <button class="btn btn-small btn-outline" onclick="editEmployee('${e.id}')">Edit</button>
                                <button class="btn btn-small btn-danger" onclick="deleteEmployee('${e.id}')">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        container.innerHTML = '<p class="no-data">Failed to load employees. Is the service backend running?</p>';
    }
}

function openEmployeeModal(employee) {
    document.getElementById('employee-modal-title').textContent = employee ? 'Edit Employee' : 'Add New Employee';
    document.getElementById('employee-form').reset();
    document.getElementById('employee-edit-id').value = '';

    if (employee) {
        document.getElementById('employee-edit-id').value = employee.id;
        document.getElementById('employee-name').value = employee.name;
        document.getElementById('employee-phone').value = employee.phone;
        document.getElementById('employee-email').value = employee.email || '';
        document.getElementById('employee-role').value = employee.role || 'technician';
        document.getElementById('employee-skills').value = (employee.skills || []).join(', ');
    }

    document.getElementById('employee-modal').classList.add('active');
}

function closeEmployeeModal() {
    document.getElementById('employee-modal').classList.remove('active');
}

async function handleEmployeeSubmit(event) {
    event.preventDefault();

    const editId = document.getElementById('employee-edit-id').value;
    const skillsRaw = document.getElementById('employee-skills').value;
    const skills = skillsRaw ? skillsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

    // Validate and clean phone number
    const phoneClean = sanitizePhone(document.getElementById('employee-phone').value);
    if (phoneClean.length < 10) {
        alert('Please enter a valid phone number (at least 10 digits).');
        return;
    }

    // Validate and clean email
    const emailRaw = document.getElementById('employee-email').value;
    const emailClean = emailRaw.trim() ? sanitizeEmail(emailRaw) : '';
    if (emailRaw.trim() && !emailClean) {
        alert('Please enter a valid email address.');
        return;
    }

    const data = {
        name: sanitizeText(document.getElementById('employee-name').value, 100),
        phone: phoneClean,
        email: emailClean,
        role: sanitizeText(document.getElementById('employee-role').value, 50),
        skills: skills.map(skill => sanitizeText(skill, 50)),
    };

    try {
        if (editId) {
            await fetch(`${SERVICE_API}/employees/${editId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
        } else {
            await fetch(`${SERVICE_API}/employees`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
        }
        closeEmployeeModal();
        loadEmployees();
    } catch (error) {
        alert('Failed to save employee');
    }
}

async function editEmployee(id) {
    try {
        const response = await fetch(`${SERVICE_API}/employees/${id}`);
        const employee = await response.json();
        openEmployeeModal(employee);
    } catch (error) {
        alert('Failed to load employee');
    }
}

async function deleteEmployee(id) {
    if (!confirm('Are you sure you want to delete this employee?')) return;

    try {
        await fetch(`${SERVICE_API}/employees/${id}`, { method: 'DELETE' });
        loadEmployees();
    } catch (error) {
        alert('Failed to delete employee');
    }
}

// ============================================================
// INQUIRIES
// ============================================================
async function loadInquiries() {
    const container = document.getElementById('inquiries-list');
    container.innerHTML = '<p class="loading">Loading...</p>';

    try {
        const response = await fetch(`${SELLING_API}/inquiries`);
        const inquiries = await response.json();

        if (inquiries.length === 0) {
            container.innerHTML = '<p class="no-data">No inquiries yet</p>';
            return;
        }

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Customer</th>
                        <th>Phone</th>
                        <th>Product</th>
                        <th>Message</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${inquiries.map(i => `
                        <tr>
                            <td>${i.customerName}</td>
                            <td>${i.customerPhone}</td>
                            <td>${i.productName}</td>
                            <td>${i.message || '-'}</td>
                            <td>${new Date(i.createdAt).toLocaleDateString()}</td>
                            <td><span class="badge badge-${i.status}">${i.status}</span></td>
                            <td class="action-btns">
                                ${i.status === 'new' ? `<button class="btn btn-small btn-primary" onclick="markInquiryResponded('${i.id}')">Mark Responded</button>` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        container.innerHTML = '<p class="no-data">Failed to load inquiries. Is the selling backend running?</p>';
    }
}

async function markInquiryResponded(id) {
    try {
        await fetch(`${SELLING_API}/inquiries/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'responded' }),
        });
        loadInquiries();
    } catch (error) {
        alert('Failed to update inquiry');
    }
}

// ============================================================
// CUSTOMERS
// ============================================================
async function loadCustomers() {
    const container = document.getElementById('customers-list');
    container.innerHTML = '<p class="loading">Loading...</p>';

    try {
        const response = await fetch(`${SERVICE_API}/customers`);
        const customers = await response.json();

        if (customers.length === 0) {
            container.innerHTML = '<p class="no-data">No customers yet. Customers are created automatically when bookings are made.</p>';
            return;
        }

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Email</th>
                        <th>Address</th>
                        <th>Company</th>
                        <th>Since</th>
                    </tr>
                </thead>
                <tbody>
                    ${customers.map(c => `
                        <tr>
                            <td>${c.name}</td>
                            <td>${c.phone}</td>
                            <td>${c.email || '-'}</td>
                            <td>${c.address || '-'}</td>
                            <td>${c.company || '-'}</td>
                            <td>${new Date(c.createdAt).toLocaleDateString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        container.innerHTML = '<p class="no-data">Failed to load customers. Is the service backend running?</p>';
    }
}
