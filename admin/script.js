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
// Configure session persistence so that closing the tab/window logs the admin out automatically
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION)
    .catch((error) => {
        console.error("Error setting session persistence:", error);
    });

async function getUserIP() {
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        return data.ip || null;
    } catch (err) {
        console.error("IP check failed:", err);
        return null;
    }
}

firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        // Check if OTP has been verified in this session
        if (sessionStorage.getItem('admin_otp_verified') === 'true') {
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('admin-panel').classList.remove('hidden');
            document.getElementById('admin-email').textContent = user.email;
            loadDashboard();
        } else {
            // Check if current IP is trusted
            let isTrusted = false;
            const ip = await getUserIP();
            if (ip) {
                try {
                    const ipSnapshot = await db.collection('trusted_ips')
                        .where('uid', '==', user.uid)
                        .where('ip', '==', ip)
                        .get();
                    if (!ipSnapshot.empty) {
                        isTrusted = true;
                    }
                } catch (e) {
                    console.error("Error checking trusted IP:", e);
                }
            }

            if (isTrusted) {
                sessionStorage.setItem('admin_otp_verified', 'true');
                document.getElementById('login-screen').classList.add('hidden');
                document.getElementById('admin-panel').classList.remove('hidden');
                document.getElementById('admin-email').textContent = user.email;
                loadDashboard();
            } else {
                // Show OTP form and send OTP if not already sent
                document.getElementById('login-screen').classList.remove('hidden');
                document.getElementById('admin-panel').classList.add('hidden');
                document.getElementById('login-form').classList.add('hidden');
                document.getElementById('otp-form').classList.remove('hidden');
                
                // Check if we need to send OTP
                if (!window.otpSentForUid || window.otpSentForUid !== user.uid) {
                    window.otpSentForUid = user.uid;
                    sendLoginOTP(user);
                }
            }
        }
    } else {
        currentUser = null;
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('admin-panel').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('otp-form').classList.add('hidden');
        sessionStorage.removeItem('admin_otp_verified');
        window.otpSentForUid = null;
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

async function sendLoginOTP(user) {
    const email = user.email;
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    // 1. Save to Firestore
    await db.collection('admin_otps').doc(user.uid).set({
        code: otp,
        email: email,
        expiresAt: expiresAt,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });


    // 2. Send via FormSubmit.co
    try {
        const response = await fetch(`https://formsubmit.co/ajax/${email}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                _subject: "Nexus Admin Login - Secure OTP Verification",
                message: `Hello,\n\nA login attempt was made for your Nexus Machinery Solutions Admin account.\n\nYour 6-digit Secure OTP code is: ${otp}\n\nThis code is valid for 5 minutes. If you did not initiate this login, please change your password immediately.`,
                _honeypot: ""
            })
        });
        const resData = await response.json();
        console.log('OTP email sent successfully:', resData);
    } catch (err) {
        console.error('Error sending OTP email:', err);
    }
}

async function handleVerifyOTP(event) {
    event.preventDefault();
    const code = document.getElementById('otp-code').value.trim();
    const errorEl = document.getElementById('otp-error');
    errorEl.textContent = '';

    if (!currentUser) return;

    try {
        const doc = await db.collection('admin_otps').doc(currentUser.uid).get();
        if (!doc.exists) {
            errorEl.textContent = "No OTP code found. Please request a new one.";
            return;
        }

        const data = doc.data();
        const now = new Date();
        const expiresAt = data.expiresAt ? data.expiresAt.toDate() : new Date(0);

        if (now > expiresAt) {
            errorEl.textContent = "OTP has expired. Please click Resend OTP.";
            return;
        }

        if (data.code !== code) {
            errorEl.textContent = "Invalid code. Please try again.";
            return;
        }

        // Success!
        sessionStorage.setItem('admin_otp_verified', 'true');
        
        // Save current IP to trusted_ips
        const ip = await getUserIP();
        if (ip) {
            try {
                const docId = `${currentUser.uid}_${ip.replace(/\./g, '_')}`;
                await db.collection('trusted_ips').doc(docId).set({
                    uid: currentUser.uid,
                    ip: ip,
                    addedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (e) {
                console.error("Failed to save trusted IP:", e);
            }
        }

        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        document.getElementById('admin-email').textContent = currentUser.email;
        loadDashboard();
    } catch (error) {
        console.error("OTP Verification failed:", error);
        errorEl.textContent = "Verification failed: " + error.message;
    }
}

async function resendOTP() {
    const errorEl = document.getElementById('otp-error');
    const successEl = document.getElementById('otp-success');
    errorEl.textContent = '';
    if (successEl) successEl.textContent = '';
    if (!currentUser) return;

    try {
        await sendLoginOTP(currentUser);
        if (successEl) {
            successEl.textContent = "A new OTP code has been sent to your email!";
            setTimeout(() => { successEl.textContent = ''; }, 5000);
        }
    } catch (error) {
        errorEl.textContent = "Failed to resend: " + error.message;
    }
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
        listings: 'Listing Requests',
        'hero-settings': 'Hero Settings'
    };
    document.getElementById('page-title').textContent = titles[tabName] || 'Dashboard';

    if (tabName === 'dashboard') loadDashboard();
    if (tabName === 'bookings') loadBookings();
    if (tabName === 'products') loadProducts();
    if (tabName === 'employees') loadEmployees();
    if (tabName === 'inquiries') loadInquiries();
    if (tabName === 'customers') loadCustomers();
    if (tabName === 'listings') loadListingRequests();
    if (tabName === 'hero-settings') loadHeroSlides();

    // Close mobile sidebar
    document.querySelector('.sidebar').classList.remove('open');
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('open');
}

// ============================================================
// FIRESTORE DATA HELPERS
// ============================================================
async function fetchAllEnquiries() {
    const collections = [
        { name: 'breakdown_enquiries', label: 'Breakdown Service' },
        { name: 'part_enquiries', label: 'Part Enquiry' },
        { name: 'other_service_enquiries', label: 'Other Service' },
        { name: 'automation_enquiries', label: 'Automation Solution' },
        { name: 'general_enquiries', label: 'General Enquiry' }
    ];

    const promises = collections.map(async (col) => {
        try {
            const snapshot = await db.collection(col.name).get();
            return snapshot.docs.map(doc => {
                const data = doc.data();
                let createdAt = '';
                if (data.createdAt) {
                    if (typeof data.createdAt.toDate === 'function') {
                        createdAt = data.createdAt.toDate().toISOString();
                    } else if (data.createdAt instanceof Date) {
                        createdAt = data.createdAt.toISOString();
                    } else {
                        createdAt = String(data.createdAt);
                    }
                }
                
                return {
                    id: doc.id,
                    _collectionName: col.name,
                    customerName: data.name || 'N/A',
                    customerPhone: data.phone || data.contact || 'N/A',
                    customerAddress: data.location || 'N/A',
                    machineType: data.machineType || col.label,
                    serviceType: data.supportType || data.automationType || col.label,
                    preferredDate: data.preferredDate || (createdAt ? new Date(createdAt).toLocaleDateString() : 'N/A'),
                    preferredTime: data.preferredTime || (createdAt ? new Date(createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A'),
                    status: data.status || 'new',
                    priority: data.priority || 'medium',
                    source: data.source || 'Web',
                    issueDescription: data.message || data.description || '',
                    photoUrl: data.photoUrl || null,
                    voiceUrl: data.voiceUrl || null,
                    email: data.email || '',
                    company: data.company || '',
                    createdAt: createdAt
                };
            });
        } catch (err) {
            console.error(`Error fetching collection ${col.name}:`, err);
            return [];
        }
    });

    const results = await Promise.all(promises);
    return results.flat().sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateB - dateA;
    });
}

async function fetchProductInquiries() {
    const collections = [
        { name: 'new_product_enquiries', label: 'New Machine' },
        { name: 'used_product_enquiries', label: 'Pre-Owned Machine' }
    ];

    const promises = collections.map(async (col) => {
        try {
            const snapshot = await db.collection(col.name).get();
            return snapshot.docs.map(doc => {
                const data = doc.data();
                let createdAt = '';
                if (data.createdAt) {
                    if (typeof data.createdAt.toDate === 'function') {
                        createdAt = data.createdAt.toDate().toISOString();
                    } else if (data.createdAt instanceof Date) {
                        createdAt = data.createdAt.toISOString();
                    } else {
                        createdAt = String(data.createdAt);
                    }
                }

                return {
                    id: doc.id,
                    _collectionName: col.name,
                    customerName: data.name || 'N/A',
                    customerPhone: data.phone || data.contact || 'N/A',
                    productName: data.productName || 'N/A',
                    message: data.message || '-',
                    status: data.status || 'new',
                    email: data.email || '',
                    company: data.company || '',
                    createdAt: createdAt
                };
            });
        } catch (err) {
            console.error(`Error fetching collection ${col.name}:`, err);
            return [];
        }
    });

    const results = await Promise.all(promises);
    return results.flat().sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateB - dateA;
    });
}

// ============================================================
// DASHBOARD
// ============================================================
async function loadDashboard() {
    try {
        const [bookings, productsSnapshot, employeesSnapshot, inquiries] = await Promise.all([
            fetchAllEnquiries(),
            db.collection('products').get(),
            db.collection('employees').get(),
            fetchProductInquiries()
        ]);

        const openBookings = bookings.filter(b => b.status === 'new' || b.status === 'open' || b.status === 'accepted' || b.status === 'in_progress');
        const newInquiries = inquiries.filter(i => i.status === 'new');

        document.getElementById('stat-bookings').textContent = openBookings.length;
        document.getElementById('stat-products').textContent = productsSnapshot.size;
        document.getElementById('stat-employees').textContent = employeesSnapshot.size;
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
                            <th>Phone</th>
                            <th>Machine</th>
                            <th>Date</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${recent.map(b => `
                            <tr>
                                <td>${b.customerName}</td>
                                <td>${b.customerPhone}</td>
                                <td>${b.machineType}</td>
                                <td>${b.preferredDate}</td>
                                <td><span class="badge badge-${b.status}">${b.status}</span></td>
                                <td class="action-btns">
                                    <button class="btn btn-small btn-outline" onclick="viewBooking('${b.id}', '${b._collectionName}')">View</button>
                                    ${b.status === 'new' || b.status === 'open' ? `<button class="btn btn-small btn-primary" onclick="viewBooking('${b.id}', '${b._collectionName}')">Assign</button>` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        document.getElementById('recent-bookings').innerHTML = '<p class="no-data">Error loading dashboard: ' + error.message + '</p>';
    }
}

// ============================================================
// BOOKINGS
// ============================================================
async function loadBookings() {
    const container = document.getElementById('bookings-list');
    container.innerHTML = '<p class="loading">Loading...</p>';

    try {
        const bookings = await fetchAllEnquiries();

        const statusFilter = document.getElementById('booking-status-filter').value;
        const typeFilter = document.getElementById('booking-type-filter').value;
        const dateFilter = document.getElementById('booking-date-filter').value;

        let filtered = bookings;

        if (statusFilter) {
            if (statusFilter === 'new') {
                filtered = filtered.filter(b => b.status === 'new' || b.status === 'open');
            } else {
                filtered = filtered.filter(b => b.status === statusFilter);
            }
        }

        if (typeFilter) {
            filtered = filtered.filter(b => b._collectionName === typeFilter);
        }

        if (dateFilter) {
            filtered = filtered.filter(b => {
                let itemDateStr = '';
                if (b.createdAt) {
                    itemDateStr = b.createdAt.substring(0, 10);
                } else if (b.preferredDate && b.preferredDate !== 'N/A') {
                    const parsed = new Date(b.preferredDate);
                    if (!isNaN(parsed.getTime())) {
                        itemDateStr = parsed.toISOString().substring(0, 10);
                    }
                }
                return itemDateStr === dateFilter;
            });
        }

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
                        <th>Assigned To</th>
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
                            <td>${b.assignedToName || '<span style="color:var(--text-muted);">Unassigned</span>'}</td>
                            <td>${b.preferredDate}<br><small>${b.preferredTime}</small></td>
                            <td><span class="badge badge-${b.status}">${b.status}</span></td>
                            <td class="action-btns">
                                <button class="btn btn-small btn-outline" onclick="viewBooking('${b.id}', '${b._collectionName}')">View</button>
                                ${b.status === 'new' || b.status === 'open' ? `<button class="btn btn-small btn-primary" onclick="viewBooking('${b.id}', '${b._collectionName}')">Assign</button>` : ''}
                                ${b.status === 'accepted' ? `<button class="btn btn-small btn-primary" onclick="updateBookingStatus('${b.id}', '${b._collectionName}', 'in_progress')">Start</button>` : ''}
                                ${b.status === 'in_progress' ? `<button class="btn btn-small btn-primary" onclick="updateBookingStatus('${b.id}', '${b._collectionName}', 'completed')">Complete</button>` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading bookings:', error);
        container.innerHTML = '<p class="no-data">Failed to load bookings: ' + error.message + '</p>';
    }
}

async function viewBooking(id, collectionName) {
    try {
        const doc = await db.collection(collectionName).doc(id).get();
        if (!doc.exists) {
            showCustomAlert('Not Found', 'Booking not found', true);
            return;
        }
        const data = doc.data();

        // Convert timestamp
        let createdAt = '';
        if (data.createdAt) {
            if (typeof data.createdAt.toDate === 'function') {
                createdAt = data.createdAt.toDate().toLocaleString();
            } else if (data.createdAt instanceof Date) {
                createdAt = data.createdAt.toLocaleString();
            } else {
                createdAt = String(data.createdAt);
            }
        }

        // Standardize fields
        const b = {
            id: doc.id,
            customerName: data.name || 'N/A',
            customerPhone: data.phone || data.contact || 'N/A',
            customerAddress: data.location || 'N/A',
            mapsLink: data.mapsLink || null,
            machineType: data.machineType || 'N/A',
            serviceType: data.supportType || data.automationType || 'N/A',
            issueDescription: data.message || data.description || 'Not specified',
            preferredDate: data.preferredDate || 'N/A',
            preferredTime: data.preferredTime || 'N/A',
            status: data.status || 'new',
            priority: data.priority || 'medium',
            source: data.source || 'Web',
            photoUrl: data.photoUrl || null,
            voiceUrl: data.voiceUrl || null,
            createdAt: createdAt,
            assignedTo: data.assignedTo || '',
            assignedToName: data.assignedToName || 'Unassigned'
        };

        // Fetch active Service Engineers / technicians for assignment
        const empSnapshot = await db.collection('employees').get();
        const engineers = empSnapshot.docs
            .map(emp => ({ id: emp.id, ...emp.data() }))
            .filter(emp => emp.status === 'active' && (emp.role === 'Service Engineer' || emp.role === 'technician'));

        document.getElementById('booking-detail-content').innerHTML = `
            <div class="form-group"><label>Booking ID</label><p>${b.id}</p></div>
            <div class="form-row">
                <div class="form-group"><label>Customer</label><p>${b.customerName}</p></div>
                <div class="form-group"><label>Phone</label><p>${b.customerPhone}</p></div>
            </div>
            <div class="form-group">
                <label>Address</label>
                <p>${b.customerAddress}</p>
                ${b.mapsLink ? `
                <div style="margin-top: 5px;">
                    <a href="${b.mapsLink}" target="_blank" class="btn btn-small btn-outline" style="text-decoration:none; display:inline-flex; align-items:center; gap:5px; border-color:var(--primary); color:var(--primary); font-weight:600;">
                        <i class="fa-solid fa-map-location-dot"></i> Navigate on Google Maps
                    </a>
                </div>
                ` : ''}
            </div>
            <div class="form-row">
                <div class="form-group"><label>Machine</label><p>${b.machineType}</p></div>
                <div class="form-group"><label>Service</label><p>${b.serviceType}</p></div>
            </div>
            <div class="form-group"><label>Issue/Message</label><p>${b.issueDescription}</p></div>
            <div class="form-row">
                <div class="form-group"><label>Date</label><p>${b.preferredDate}</p></div>
                <div class="form-group"><label>Time</label><p>${b.preferredTime}</p></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Status</label><p><span class="badge badge-${b.status}">${b.status}</span></p></div>
                <div class="form-group"><label>Priority</label><p>${b.priority}</p></div>
            </div>
            <div class="form-group"><label>Source</label><p>${b.source}</p></div>
            <div class="form-group"><label>Created</label><p>${b.createdAt}</p></div>
            
            ${b.photoUrl ? `
            <div class="form-group">
                <label>Photo Attachment</label>
                <div style="margin-top: 5px;">
                    <a href="${b.photoUrl}" target="_blank" class="btn btn-small btn-outline" style="text-decoration:none; display:inline-flex; align-items:center; gap:5px;">
                        <i class="fa-solid fa-image"></i> View Photo
                    </a>
                </div>
                <div style="margin-top: 10px; max-width: 100%;">
                    <img src="${b.photoUrl}" alt="Attachment" style="max-height: 200px; border-radius: 6px; border: 1px solid #ddd;" />
                </div>
            </div>
            ` : ''}
            
            ${b.voiceUrl ? `
            <div class="form-group">
                <label>Voice Description</label>
                <div style="margin-top: 5px;">
                    <audio src="${b.voiceUrl}" controls style="width: 100%; border-radius: 4px;"></audio>
                </div>
            </div>
            ` : ''}

            <div class="form-group" style="margin-top: 15px; border-top: 1px solid var(--border); padding-top: 15px;">
                <label>Assigned Engineer</label>
                <p id="current-assignee-display"><strong>${b.assignedToName}</strong></p>
            </div>
            
            ${b.status !== 'completed' && b.status !== 'cancelled' ? `
                <div class="form-group">
                    <label>Assign/Reassign Service Engineer</label>
                    <div style="display: flex; gap: 0.5rem; margin-top: 5px;">
                        <select id="assign-engineer-select" style="flex: 1; padding: 0.5rem; background: var(--darker); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-family: 'Montserrat', sans-serif;">
                            <option value="">-- Select Service Engineer --</option>
                            ${engineers.map(eng => `<option value="${eng.id}" ${b.assignedTo === eng.id ? 'selected' : ''}>${eng.name}</option>`).join('')}
                        </select>
                        <button class="btn btn-primary btn-small" onclick="assignBooking('${b.id}', '${collectionName}')">Assign</button>
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem; margin-top: 20px;">
                    <button class="btn btn-danger btn-full" onclick="cancelBooking('${b.id}', '${collectionName}')">Cancel / Close Booking</button>
                </div>
            ` : ''}
        `;
        document.getElementById('booking-detail-modal').classList.add('active');
    } catch (error) {
        console.error('Error viewing booking:', error);
        showCustomAlert('Error', 'Failed to load booking details: ' + error.message, true);
    }
}

function closeBookingDetailModal() {
    document.getElementById('booking-detail-modal').classList.remove('active');
}

async function updateBookingStatus(id, collectionName, status) {
    try {
        showLoadingScreen('Updating booking status...');
        await db.collection(collectionName).doc(id).update({
            status: status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showLoadingSuccess('Booking status updated successfully!');
        
        // Reload whichever tab or view is active
        const activeTab = document.querySelector('.nav-item.active').textContent.trim().toLowerCase();
        if (activeTab.includes('dashboard')) {
            loadDashboard();
        } else {
            loadBookings();
        }
    } catch (error) {
        console.error('Error updating booking status:', error);
        showLoadingError('Failed to update booking: ' + error.message);
    }
}

// ============================================================
// PRODUCTS
// ============================================================
async function loadProducts() {
    const container = document.getElementById('products-list');
    container.innerHTML = '<p class="loading">Loading...</p>';

    try {
        const snapshot = await db.collection('products').get();
        const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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
                        <th>Stock</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map(p => `
                        <tr>
                            <td>${p.name || 'N/A'}</td>
                            <td>${p.machineType || 'N/A'}</td>
                            <td>${p.category || 'N/A'}</td>
                            <td>${p.stockCount !== undefined ? p.stockCount : 1}</td>
                            <td><span class="badge badge-${p.status || 'active'}">${p.status || 'active'}</span></td>
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
        console.error('Error loading products:', error);
        container.innerHTML = '<p class="no-data">Failed to load products: ' + error.message + '</p>';
    }
}

let productFilesToUpload = [];
let currentProductImageUrls = [];

function openProductModal(product) {
    document.getElementById('product-modal-title').textContent = product ? 'Edit Product' : 'Add New Product';
    document.getElementById('product-form').reset();
    document.getElementById('product-edit-id').value = '';
    
    productFilesToUpload = [];
    currentProductImageUrls = [];

    if (product) {
        document.getElementById('product-edit-id').value = product.id;
        document.getElementById('product-name').value = product.name || '';
        document.getElementById('product-machine-type').value = product.machineType || '';
        document.getElementById('product-category').value = product.category || '';
        document.getElementById('product-price').value = product.price || 'Contact for Price';
        document.getElementById('product-stock').value = product.stockCount !== undefined ? product.stockCount : 1;
        document.getElementById('product-condition').value = product.condition || '';
        document.getElementById('product-description').value = product.description || '';
        currentProductImageUrls = product.images || [];
    }

    renderProductImagePreviews();
    document.getElementById('product-modal').classList.add('active');
}

function closeProductModal() {
    document.getElementById('product-modal').classList.remove('active');
    productFilesToUpload = [];
    currentProductImageUrls = [];
}

function handleProductFilesSelected(input) {
    const files = Array.from(input.files);
    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            productFilesToUpload.push(file);
        } else {
            showCustomAlert('Invalid File', 'Only images are allowed.', true);
        }
    });
    renderProductImagePreviews();
    input.value = '';
}

function renderProductImagePreviews() {
    const previewGrid = document.getElementById('product-images-preview');
    if (!previewGrid) return;
    previewGrid.innerHTML = '';

    // Render existing image URLs
    currentProductImageUrls.forEach((url, index) => {
        const container = document.createElement('div');
        container.className = 'preview-image-container';

        const img = document.createElement('img');
        img.src = url;
        img.alt = `Existing Product Image ${index + 1}`;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-img-btn';
        removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        removeBtn.onclick = () => {
            currentProductImageUrls.splice(index, 1);
            renderProductImagePreviews();
        };

        container.appendChild(img);
        container.appendChild(removeBtn);
        previewGrid.appendChild(container);
    });

    // Render files to upload
    productFilesToUpload.forEach((file, index) => {
        const container = document.createElement('div');
        container.className = 'preview-image-container';

        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.alt = `New Product Image ${index + 1}`;
        img.onload = () => URL.revokeObjectURL(img.src);

        const badge = document.createElement('span');
        badge.className = 'badge-new-file';
        badge.textContent = 'New';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-img-btn';
        removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        removeBtn.onclick = () => {
            productFilesToUpload.splice(index, 1);
            renderProductImagePreviews();
        };

        container.appendChild(img);
        container.appendChild(badge);
        container.appendChild(removeBtn);
        previewGrid.appendChild(container);
    });

    // Populate hidden field
    document.getElementById('product-images').value = currentProductImageUrls.join(', ');
}

async function uploadProductImage(file, productId) {
    const CLOUD_NAME   = 'dofphhum5';
    const UPLOAD_PRESET = 'ucfof5kx';
    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', 'nexus-products');
    formData.append('public_id', `prod_${productId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);

    const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Cloudinary upload failed (${response.status}): ${errText}`);
    }

    const result = await response.json();
    return result.secure_url;
}

async function handleProductSubmit(event) {
    event.preventDefault();

    const submitBtn = event.target.querySelector('[type="submit"]');
    const editId = document.getElementById('product-edit-id').value;

    submitBtn.disabled = true;
    showLoadingScreen('Saving product & uploading images...');

    try {
        let productId = editId;
        if (!productId) {
            const newDocRef = db.collection('products').doc();
            productId = newDocRef.id;
        }

        const uploadedUrls = [];
        for (const file of productFilesToUpload) {
            try {
                const url = await uploadProductImage(file, productId);
                uploadedUrls.push(url);
            } catch (err) {
                console.error('Failed to upload file:', file.name, err);
                showCustomAlert('Upload Failed', `Failed to upload ${file.name}: ${err.message}. Saving product with remaining images.`, true);
            }
        }

        const finalImages = [...currentProductImageUrls, ...uploadedUrls];

        const data = {
            name: sanitizeText(document.getElementById('product-name').value, 200),
            machineType: sanitizeText(document.getElementById('product-machine-type').value, 50),
            category: sanitizeText(document.getElementById('product-category').value, 20),
            price: sanitizeText(document.getElementById('product-price').value || 'Contact for Price', 50),
            stockCount: parseInt(document.getElementById('product-stock').value) || 0,
            condition: sanitizeText(document.getElementById('product-condition').value, 50),
            description: sanitizeText(document.getElementById('product-description').value, 1000),
            images: finalImages,
            status: 'active',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (editId) {
            await db.collection('products').doc(editId).update(data);
        } else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('products').doc(productId).set(data);
        }

        showLoadingSuccess('Product saved successfully!');
        closeProductModal();
        loadProducts();
    } catch (error) {
        console.error('Error saving product:', error);
        showLoadingError('Failed to save product: ' + error.message);
    } finally {
        submitBtn.disabled = false;
    }
}

async function editProduct(id) {
    try {
        const doc = await db.collection('products').doc(id).get();
        if (!doc.exists) {
            showCustomAlert('Not Found', 'Product not found', true);
            return;
        }
        const product = { id: doc.id, ...doc.data() };
        openProductModal(product);
    } catch (error) {
        console.error('Error loading product:', error);
        showCustomAlert('Error', 'Failed to load product: ' + error.message, true);
    }
}

async function deleteProduct(id) {
    showCustomConfirm(
        'Confirm Delete',
        'Are you sure you want to delete this product?',
        async () => {
            try {
                showLoadingScreen('Deleting product...');
                await db.collection('products').doc(id).delete();
                showLoadingSuccess('Product deleted successfully!');
                loadProducts();
            } catch (error) {
                console.error('Error deleting product:', error);
                showLoadingError('Failed to delete product: ' + error.message);
            }
        }
    );
}

// ============================================================
// EMPLOYEES
// ============================================================
async function loadEmployees() {
    const container = document.getElementById('employees-list');
    container.innerHTML = '<p class="loading">Loading...</p>';

    try {
        const snapshot = await db.collection('employees').get();
        const employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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
                            <td>${e.name || 'N/A'}</td>
                            <td>${e.phone || e.contact || 'N/A'}</td>
                            <td>${e.email || '-'}</td>
                            <td>${e.role || 'Service Engineer'}</td>
                            <td><span class="badge badge-${e.status || 'active'}">${e.status || 'active'}</span></td>
                            <td>${e.jobsCompleted || 0}</td>
                            <td class="action-btns">
                                <button class="btn btn-small btn-outline" onclick="editEmployee('${e.id}')">Edit</button>
                                <button class="btn btn-small ${e.status === 'inactive' ? 'btn-primary' : 'btn-danger'}" onclick="toggleEmployeeStatus('${e.id}', '${e.status || 'active'}')">
                                    ${e.status === 'inactive' ? 'Activate' : 'Deactivate'}
                                </button>
                                <button class="btn btn-small btn-outline" onclick="generateLoginCode('${e.id}', '${e.name}', '${e.role || 'Service Engineer'}')">
                                    <i class="fa-solid fa-key"></i> Code
                                </button>
                                <button class="btn btn-small btn-danger" onclick="deleteEmployee('${e.id}')"><i class="fa-solid fa-trash"></i></button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading employees:', error);
        container.innerHTML = '<p class="no-data">Failed to load employees: ' + error.message + '</p>';
    }
}

function openEmployeeModal(employee) {
    document.getElementById('employee-modal-title').textContent = employee ? 'Edit Employee' : 'Add New Employee';
    document.getElementById('employee-form').reset();
    document.getElementById('employee-edit-id').value = '';

    if (employee) {
        document.getElementById('employee-edit-id').value = employee.id;
        document.getElementById('employee-name').value = employee.name || '';
        document.getElementById('employee-phone').value = employee.phone || employee.contact || '';
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
        showCustomAlert('Invalid Phone', 'Please enter a valid phone number (at least 10 digits).', true);
        return;
    }

    // Validate and clean email
    const emailRaw = document.getElementById('employee-email').value;
    const emailClean = emailRaw.trim() ? sanitizeEmail(emailRaw) : '';
    if (emailRaw.trim() && !emailClean) {
        showCustomAlert('Invalid Email', 'Please enter a valid email address.', true);
        return;
    }

    const data = {
        name: sanitizeText(document.getElementById('employee-name').value, 100),
        phone: phoneClean,
        email: emailClean,
        role: sanitizeText(document.getElementById('employee-role').value, 50),
        skills: skills.map(skill => sanitizeText(skill, 50)),
        status: 'active',
        jobsCompleted: 0,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        showLoadingScreen('Saving employee data...');
        if (editId) {
            await db.collection('employees').doc(editId).update({
                name: data.name,
                phone: data.phone,
                email: data.email,
                role: data.role,
                skills: data.skills,
                updatedAt: data.updatedAt
            });
            showLoadingSuccess('Employee details updated successfully!');
            closeEmployeeModal();
            loadEmployees();
        } else {
            data.status = 'active';
            data.jobsCompleted = 0;
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await db.collection('employees').add(data);
            showLoadingSuccess('Employee created successfully!');
            closeEmployeeModal();
            loadEmployees();
            // Generate code for new employee
            generateLoginCode(docRef.id, data.name, data.role);
        }
    } catch (error) {
        console.error('Error saving employee:', error);
        showLoadingError('Failed to save employee: ' + error.message);
    }
}

async function editEmployee(id) {
    try {
        const doc = await db.collection('employees').doc(id).get();
        if (!doc.exists) {
            showCustomAlert('Not Found', 'Employee not found', true);
            return;
        }
        const employee = { id: doc.id, ...doc.data() };
        openEmployeeModal(employee);
    } catch (error) {
        console.error('Error loading employee:', error);
        showCustomAlert('Error', 'Failed to load employee: ' + error.message, true);
    }
}

async function deleteEmployee(id) {
    showCustomConfirm(
        'Confirm Delete',
        'Are you sure you want to delete this employee?',
        async () => {
            try {
                showLoadingScreen('Deleting employee...');
                await db.collection('employees').doc(id).delete();
                showLoadingSuccess('Employee deleted successfully!');
                loadEmployees();
            } catch (error) {
                console.error('Error deleting employee:', error);
                showLoadingError('Failed to delete employee: ' + error.message);
            }
        }
    );
}

// ============================================================
// INQUIRIES
// ============================================================
async function loadInquiries() {
    const container = document.getElementById('inquiries-list');
    container.innerHTML = '<p class="loading">Loading...</p>';

    try {
        const inquiries = await fetchProductInquiries();

        const searchFilter = document.getElementById('inquiry-search-filter').value.toLowerCase().trim();
        const statusFilter = document.getElementById('inquiry-status-filter').value;

        let filtered = inquiries;

        if (statusFilter) {
            filtered = filtered.filter(i => i.status === statusFilter);
        }

        if (searchFilter) {
            filtered = filtered.filter(i => 
                i.customerName.toLowerCase().includes(searchFilter) || 
                i.productName.toLowerCase().includes(searchFilter) ||
                i.customerPhone.includes(searchFilter)
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = '<p class="no-data">No inquiries match current filters</p>';
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
                    ${filtered.map(i => `
                        <tr>
                            <td>${i.customerName}</td>
                            <td>${i.customerPhone}</td>
                            <td>${i.productName}</td>
                            <td>${i.message}</td>
                            <td>${i.createdAt ? new Date(i.createdAt).toLocaleDateString() : 'N/A'}</td>
                            <td><span class="badge badge-${i.status}">${i.status}</span></td>
                            <td class="action-btns">
                                <button class="btn btn-small btn-outline" onclick="viewInquiry('${i.id}', '${i._collectionName}')">View</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading inquiries:', error);
        container.innerHTML = '<p class="no-data">Failed to load inquiries: ' + error.message + '</p>';
    }
}

async function viewInquiry(id, collectionName) {
    try {
        const doc = await db.collection(collectionName).doc(id).get();
        if (!doc.exists) {
            showCustomAlert('Not Found', 'Inquiry not found', true);
            return;
        }
        const data = doc.data();

        let createdAt = '';
        if (data.createdAt) {
            if (typeof data.createdAt.toDate === 'function') {
                createdAt = data.createdAt.toDate().toLocaleString();
            } else if (data.createdAt instanceof Date) {
                createdAt = data.createdAt.toLocaleString();
            } else {
                createdAt = String(data.createdAt);
            }
        }

        const i = {
            id: doc.id,
            customerName: data.name || 'N/A',
            customerPhone: data.phone || data.contact || 'N/A',
            customerEmail: data.email || 'N/A',
            customerCompany: data.company || 'N/A',
            productName: data.productName || 'N/A',
            message: data.message || 'No message provided',
            status: data.status || 'new',
            internalNotes: data.internalNotes || '',
            createdAt: createdAt
        };

        document.getElementById('inquiry-detail-content').innerHTML = `
            <div class="form-group"><label>Inquiry ID</label><p>${i.id}</p></div>
            <div class="form-row">
                <div class="form-group"><label>Customer Name</label><p>${i.customerName}</p></div>
                <div class="form-group"><label>Phone</label><p>${i.customerPhone}</p></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Email</label><p>${i.customerEmail}</p></div>
                <div class="form-group"><label>Company</label><p>${i.customerCompany}</p></div>
            </div>
            <div class="form-group"><label>Product / Category</label><p><strong>${i.productName}</strong> (${collectionName === 'new_product_enquiries' ? 'New Machine' : 'Pre-Owned Machine'})</p></div>
            <div class="form-group"><label>Customer Message</label><p>${i.message}</p></div>
            <div class="form-group"><label>Created At</label><p>${i.createdAt}</p></div>
            
            <div class="form-group" style="margin-top: 15px; border-top: 1px solid var(--border); padding-top: 15px;">
                <label for="inquiry-status-select">Status</label>
                <select id="inquiry-status-select" style="padding: 0.5rem; background: var(--darker); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-family: 'Montserrat', sans-serif; width: 100%;">
                    <option value="new" ${i.status === 'new' ? 'selected' : ''}>New</option>
                    <option value="contacted" ${i.status === 'contacted' ? 'selected' : ''}>Contacted</option>
                    <option value="responded" ${i.status === 'responded' ? 'selected' : ''}>Responded / Completed</option>
                    <option value="cancelled" ${i.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </div>

            <div class="form-group">
                <label for="inquiry-notes-textarea">Internal Notes</label>
                <textarea id="inquiry-notes-textarea" rows="4" style="width: 100%; padding: 0.5rem; background: var(--darker); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-family: 'Montserrat', sans-serif;" placeholder="Add internal notes about this product enquiry...">${i.internalNotes}</textarea>
            </div>

            <div style="display: flex; gap: 0.5rem; margin-top: 20px;">
                <button class="btn btn-primary btn-full" onclick="updateInquiry('${i.id}', '${collectionName}')">Save Updates</button>
            </div>
        `;
        document.getElementById('inquiry-detail-modal').classList.add('active');
    } catch (error) {
        console.error('Error viewing inquiry:', error);
        showCustomAlert('Error', 'Failed to load inquiry details: ' + error.message, true);
    }
}

function closeInquiryDetailModal() {
    document.getElementById('inquiry-detail-modal').classList.remove('active');
}

async function updateInquiry(id, collectionName) {
    const status = document.getElementById('inquiry-status-select').value;
    const notes = document.getElementById('inquiry-notes-textarea').value.trim();

    try {
        showLoadingScreen('Saving inquiry updates...');
        await db.collection(collectionName).doc(id).update({
            status: status,
            internalNotes: notes,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showLoadingSuccess('Inquiry updated successfully!');
        closeInquiryDetailModal();
        loadInquiries();
    } catch (error) {
        console.error('Error updating inquiry:', error);
        showLoadingError('Failed to save inquiry changes: ' + error.message);
    }
}

// ============================================================
// CUSTOMERS
// ============================================================
async function loadCustomers() {
    const container = document.getElementById('customers-list');
    container.innerHTML = '<p class="loading">Loading...</p>';

    try {
        const [bookings, inquiries] = await Promise.all([
            fetchAllEnquiries(),
            fetchProductInquiries()
        ]);

        const allSubmissions = [...bookings, ...inquiries];
        const customerMap = {};

        allSubmissions.forEach(sub => {
            const rawPhone = sub.customerPhone || '';
            const cleanPhone = rawPhone.replace(/\D/g, ''); // Digits only
            
            if (!cleanPhone || cleanPhone === 'NA' || cleanPhone === 'N/A' || cleanPhone.length < 5) return;

            const subDate = sub.createdAt ? new Date(sub.createdAt) : new Date(0);

            if (!customerMap[cleanPhone]) {
                customerMap[cleanPhone] = {
                    name: sub.customerName !== 'N/A' ? sub.customerName : '',
                    phone: sub.customerPhone,
                    email: sub.email || '',
                    address: sub.customerAddress !== 'N/A' ? sub.customerAddress : '',
                    company: sub.company || '',
                    createdAt: subDate
                };
            } else {
                const existing = customerMap[cleanPhone];
                if (subDate > existing.createdAt) {
                    if (sub.customerName !== 'N/A') existing.name = sub.customerName;
                    if (sub.customerPhone) existing.phone = sub.customerPhone;
                    if (sub.email) existing.email = sub.email;
                    if (sub.customerAddress !== 'N/A') existing.address = sub.customerAddress;
                    if (sub.company) existing.company = sub.company;
                }
                
                if (subDate < existing.createdAt && subDate.getTime() > 0) {
                    existing.createdAt = subDate;
                }
            }
        });

        const nameFilter = document.getElementById('customer-name-filter').value.toLowerCase().trim();
        const phoneFilter = document.getElementById('customer-phone-filter').value.toLowerCase().trim();

        let customers = Object.values(customerMap).sort((a, b) => b.createdAt - a.createdAt);

        if (nameFilter) {
            customers = customers.filter(c => c.name.toLowerCase().includes(nameFilter));
        }
        if (phoneFilter) {
            customers = customers.filter(c => c.phone.replace(/\D/g, '').includes(phoneFilter.replace(/\D/g, '')));
        }

        if (customers.length === 0) {
            container.innerHTML = '<p class="no-data">No customers found</p>';
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
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${customers.map(c => `
                        <tr>
                            <td>${c.name || 'N/A'}</td>
                            <td>${c.phone}</td>
                            <td>${c.email || '-'}</td>
                            <td>${c.address || '-'}</td>
                            <td>${c.company || '-'}</td>
                            <td>${c.createdAt.getTime() > 0 ? c.createdAt.toLocaleDateString() : 'N/A'}</td>
                            <td>
                                <button class="btn btn-small btn-outline" onclick="viewCustomerHistory('${c.phone}')">View History</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading customers:', error);
        container.innerHTML = '<p class="no-data">Failed to load customers: ' + error.message + '</p>';
    }
}

// ============================================================
// ASSIGNMENT AND CANCEL ACTIONS
// ============================================================
async function assignBooking(bookingId, collectionName) {
    const select = document.getElementById('assign-engineer-select');
    const employeeId = select.value;
    if (!employeeId) {
        showCustomAlert('Selection Required', 'Please select a Service Engineer.', true);
        return;
    }

    try {
        showLoadingScreen('Assigning engineer...');
        const empDoc = await db.collection('employees').doc(employeeId).get();
        if (!empDoc.exists) {
            showLoadingError('Selected employee not found.');
            return;
        }
        const empData = empDoc.data();

        await db.collection(collectionName).doc(bookingId).update({
            assignedTo: employeeId,
            assignedToName: empData.name,
            status: 'accepted',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showLoadingSuccess(`Assigned to ${empData.name} successfully!`);
        closeBookingDetailModal();
        
        // Reload whichever tab or view is active
        const activeTab = document.querySelector('.nav-item.active').textContent.trim().toLowerCase();
        if (activeTab.includes('dashboard')) {
            loadDashboard();
        } else {
            loadBookings();
        }
    } catch (error) {
        console.error('Error assigning engineer:', error);
        showLoadingError('Failed to assign: ' + error.message);
    }
}

async function cancelBooking(bookingId, collectionName) {
    showCustomConfirm(
        'Cancel Booking',
        'Are you sure you want to cancel/close this booking?',
        async () => {
            try {
                showLoadingScreen('Cancelling booking...');
                await db.collection(collectionName).doc(bookingId).update({
                    status: 'cancelled',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                showLoadingSuccess('Booking cancelled/closed successfully.');
                closeBookingDetailModal();

                // Reload whichever tab or view is active
                const activeTab = document.querySelector('.nav-item.active').textContent.trim().toLowerCase();
                if (activeTab.includes('dashboard')) {
                    loadDashboard();
                } else {
                    loadBookings();
                }
            } catch (error) {
                console.error('Error cancelling booking:', error);
                showLoadingError('Failed to cancel booking: ' + error.message);
            }
        }
    );
}

// ============================================================
// CUSTOMER HISTORY & OTP CODES
// ============================================================
async function viewCustomerHistory(phone) {
    const modal = document.getElementById('customer-history-modal');
    const content = document.getElementById('customer-history-content');
    content.innerHTML = '<p class="loading">Loading customer history...</p>';
    modal.classList.add('active');

    try {
        const [bookings, inquiries] = await Promise.all([
            fetchAllEnquiries(),
            fetchProductInquiries()
        ]);

        const cleanPhone = phone.replace(/\D/g, '');
        const filterPhone = (num) => String(num).replace(/\D/g, '') === cleanPhone;

        const customerBookings = bookings.filter(b => filterPhone(b.customerPhone));
        const customerInquiries = inquiries.filter(i => filterPhone(i.customerPhone));

        if (customerBookings.length === 0 && customerInquiries.length === 0) {
            content.innerHTML = '<p class="no-data">No history found for this customer.</p>';
            return;
        }

        const customerName = customerBookings[0]?.customerName || customerInquiries[0]?.customerName || 'Customer';
        const customerEmail = customerBookings[0]?.email || customerInquiries[0]?.email || 'N/A';
        const customerCompany = customerBookings[0]?.company || customerInquiries[0]?.company || 'N/A';

        let html = `
            <div style="background: var(--darker); padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem; border: 1px solid var(--border);">
                <h3 style="color: var(--primary); margin-bottom: 0.5rem; font-size: 1.1rem;">${customerName}</h3>
                <p style="font-size: 0.85rem; margin-bottom: 0.25rem;"><strong style="color:var(--text-muted);">Phone:</strong> ${phone}</p>
                <p style="font-size: 0.85rem; margin-bottom: 0.25rem;"><strong style="color:var(--text-muted);">Email:</strong> ${customerEmail}</p>
                <p style="font-size: 0.85rem;"><strong style="color:var(--text-muted);">Company:</strong> ${customerCompany}</p>
            </div>
            
            <h4 style="margin-bottom: 0.75rem; font-size: 1rem;">Service Bookings (${customerBookings.length})</h4>
        `;

        if (customerBookings.length === 0) {
            html += '<p class="no-data" style="padding:1rem; margin-bottom: 1.5rem;">No service bookings</p>';
        } else {
            html += `
                <table style="margin-bottom: 1.5rem;">
                    <thead>
                        <tr>
                            <th>Machine</th>
                            <th>Service</th>
                            <th>Date</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${customerBookings.map(b => `
                            <tr>
                                <td>${b.machineType}</td>
                                <td>${b.serviceType}</td>
                                <td>${b.preferredDate}</td>
                                <td><span class="badge badge-${b.status}">${b.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        html += `<h4 style="margin-bottom: 0.75rem; font-size: 1rem;">Product Inquiries (${customerInquiries.length})</h4>`;

        if (customerInquiries.length === 0) {
            html += '<p class="no-data" style="padding:1rem;">No product inquiries</p>';
        } else {
            html += `
                <table>
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Message</th>
                            <th>Date</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${customerInquiries.map(i => `
                            <tr>
                                <td>${i.productName}</td>
                                <td>${i.message}</td>
                                <td>${i.createdAt ? new Date(i.createdAt).toLocaleDateString() : 'N/A'}</td>
                                <td><span class="badge badge-${i.status}">${i.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        content.innerHTML = html;
    } catch (err) {
        console.error('Error loading history:', err);
        content.innerHTML = '<p class="no-data">Error: ' + err.message + '</p>';
    }
}

function closeCustomerHistoryModal() {
    document.getElementById('customer-history-modal').classList.remove('active');
}

async function toggleEmployeeStatus(id, currentStatus) {
    const newStatus = currentStatus === 'inactive' ? 'active' : 'inactive';
    showCustomConfirm(
        'Toggle Status',
        `Are you sure you want to make this employee ${newStatus}?`,
        async () => {
            try {
                showLoadingScreen('Updating status...');
                await db.collection('employees').doc(id).update({
                    status: newStatus,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                showLoadingSuccess('Status updated successfully!');
                loadEmployees();
            } catch (error) {
                console.error('Error toggling employee status:', error);
                showLoadingError('Failed to toggle status: ' + error.message);
            }
        }
    );
}

async function generateLoginCode(employeeId, name, role) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes validity

    try {
        showLoadingScreen('Generating login code...');
        await db.collection('login_codes').add({
            code: code,
            employeeId: employeeId,
            employeeName: name,
            role: role,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            expiresAt: expiresAt,
            isUsed: false
        });
        showLoadingSuccess('Code generated successfully!');

        document.getElementById('generated-code-display').textContent = code;
        document.getElementById('code-modal').classList.add('active');
    } catch (error) {
        console.error('Error generating login code:', error);
        showLoadingError('Failed to generate code: ' + error.message);
    }
}

function closeCodeModal() {
    document.getElementById('code-modal').classList.remove('active');
}

// ============================================================
// HERO SLIDES
// ============================================================
async function loadHeroSlides() {
    const container = document.getElementById('hero-slides-list');
    container.innerHTML = '<p class="loading">Loading...</p>';

    const category = document.getElementById('hero-category-filter').value;

    try {
        const snapshot = await db.collection('hero_slides').where('category', '==', category).get();
        const slides = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (slides.length === 0) {
            container.innerHTML = '<p class="no-data">No slides found for this category. The main website will use default slides if no custom slides exist.</p>';
            return;
        }

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Image</th>
                        <th>Title</th>
                        <th>Description</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${slides.map(s => `
                        <tr>
                            <td><img src="/${s.imageUrl}" alt="${s.title}" style="height: 50px; border-radius: 4px;"></td>
                            <td>${s.title}</td>
                            <td>${s.description}</td>
                            <td class="action-btns">
                                <button class="btn btn-small btn-outline" onclick="editHeroSlide('${s.id}')">Edit</button>
                                <button class="btn btn-small btn-danger" onclick="deleteHeroSlide('${s.id}')">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading hero slides:', error);
        container.innerHTML = '<p class="no-data">Failed to load hero slides: ' + error.message + '</p>';
    }
}

function openHeroModal(slide) {
    document.getElementById('hero-modal-title').textContent = slide ? 'Edit Hero Slide' : 'Add Hero Slide';
    document.getElementById('hero-form').reset();
    document.getElementById('hero-edit-id').value = '';

    if (slide) {
        document.getElementById('hero-edit-id').value = slide.id;
        document.getElementById('hero-category').value = slide.category || '';
        document.getElementById('hero-image-url').value = slide.imageUrl || '';
        document.getElementById('hero-title').value = slide.title || '';
        document.getElementById('hero-description').value = slide.description || '';
    } else {
        document.getElementById('hero-category').value = document.getElementById('hero-category-filter').value;
    }

    document.getElementById('hero-modal').classList.add('active');
}

function closeHeroModal() {
    document.getElementById('hero-modal').classList.remove('active');
}

window.editHeroSlide = async function(id) {
    try {
        const doc = await db.collection('hero_slides').doc(id).get();
        if (doc.exists) {
            openHeroModal({ id: doc.id, ...doc.data() });
        }
    } catch (error) {
        console.error('Error fetching slide:', error);
    }
};

window.deleteHeroSlide = async function(id) {
    showCustomConfirm(
        'Delete Slide',
        'Are you sure you want to delete this slide?',
        async () => {
            try {
                showLoadingScreen('Deleting hero slide...');
                await db.collection('hero_slides').doc(id).delete();
                showLoadingSuccess('Hero slide deleted successfully!');
                loadHeroSlides();
            } catch (error) {
                console.error('Error deleting slide:', error);
                showLoadingError('Failed to delete slide');
            }
        }
    );
};

async function handleHeroSubmit(event) {
    event.preventDefault();

    const editId = document.getElementById('hero-edit-id').value;
    const data = {
        category: sanitizeText(document.getElementById('hero-category').value, 50),
        imageUrl: sanitizeText(document.getElementById('hero-image-url').value, 500),
        title: sanitizeText(document.getElementById('hero-title').value, 100),
        description: sanitizeText(document.getElementById('hero-description').value, 500),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        showLoadingScreen('Saving hero slide...');
        if (editId) {
            await db.collection('hero_slides').doc(editId).update(data);
        } else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('hero_slides').add(data);
        }
        showLoadingSuccess('Hero slide saved successfully!');
        closeHeroModal();
        
        // Switch the filter to the category that was just saved/edited
        document.getElementById('hero-category-filter').value = data.category;
        loadHeroSlides();
    } catch (error) {
        console.error('Error saving slide:', error);
        showLoadingError('Failed to save slide: ' + error.message);
    }
}

// ============================================================
// LISTING REQUESTS
// ============================================================
async function loadListingRequests() {
    const container = document.getElementById('listings-list');
    container.innerHTML = '<p class="loading">Loading...</p>';

    try {
        const snapshot = await db.collection('listing_requests').orderBy('createdAt', 'desc').get();
        const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const statusFilter = document.getElementById('listing-status-filter').value;
        let filtered = requests;

        if (statusFilter) {
            filtered = filtered.filter(r => r.status === statusFilter);
        }

        if (filtered.length === 0) {
            container.innerHTML = '<p class="no-data">No listing requests found</p>';
            return;
        }

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Seller Name</th>
                        <th>Phone</th>
                        <th>Machine Model</th>
                        <th>Age</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(r => {
                        let dateStr = 'N/A';
                        if (r.createdAt) {
                            dateStr = r.createdAt.toDate ? r.createdAt.toDate().toLocaleDateString() : new Date(r.createdAt).toLocaleDateString();
                        }
                        return `
                        <tr>
                            <td>${r.name || 'N/A'}</td>
                            <td>${r.phone || 'N/A'}</td>
                            <td>${r.machineName || 'N/A'}</td>
                            <td>${r.age || 'N/A'}</td>
                            <td>${dateStr}</td>
                            <td><span class="badge badge-${r.status || 'pending'}">${r.status || 'pending'}</span></td>
                            <td class="action-btns">
                                <button class="btn btn-small btn-outline" onclick="viewListingRequest('${r.id}')">View</button>
                                ${r.status === 'pending' ? `
                                    <button class="btn btn-small btn-primary" onclick="approveListingRequest('${r.id}')">Approve</button>
                                    <button class="btn btn-small btn-danger" onclick="rejectListingRequest('${r.id}')">Reject</button>
                                ` : ''}
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading listing requests:', error);
        container.innerHTML = '<p class="no-data">Failed to load listing requests: ' + error.message + '</p>';
    }
}

async function viewListingRequest(id) {
    try {
        const doc = await db.collection('listing_requests').doc(id).get();
        if (!doc.exists) {
            showCustomAlert('Not Found', 'Listing request not found', true);
            return;
        }
        const r = doc.data();

        let dateStr = 'N/A';
        if (r.createdAt) {
            dateStr = r.createdAt.toDate ? r.createdAt.toDate().toLocaleString() : new Date(r.createdAt).toLocaleString();
        }

        document.getElementById('listing-detail-content').innerHTML = `
            <div class="form-group"><label>Request ID</label><p>${doc.id}</p></div>
            <div class="form-row">
                <div class="form-group"><label>Seller Name</label><p>${r.name || 'N/A'}</p></div>
                <div class="form-group"><label>Company</label><p>${r.company || 'N/A'}</p></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Phone</label><p>${r.phone || 'N/A'}</p></div>
                <div class="form-group"><label>Email</label><p>${r.email || 'N/A'}</p></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Machine Model</label><p>${r.machineName || 'N/A'}</p></div>
                <div class="form-group"><label>Machine Age</label><p>${r.age || 'N/A'}</p></div>
            </div>
            <div class="form-group"><label>Condition Description</label><p>${r.condition || 'N/A'}</p></div>
            <div class="form-row">
                <div class="form-group"><label>Submitted Date</label><p>${dateStr}</p></div>
                <div class="form-group">
                    <label>Status</label>
                    <p><span class="badge badge-${r.status || 'pending'}">${r.status || 'pending'}</span></p>
                </div>
            </div>
            <div class="form-group">
                <label>1% Commission Agreement Status</label>
                <p><span class="badge badge-completed" style="background: rgba(34,197,94,0.2); color: var(--success); font-weight: bold;"><i class="fa-solid fa-circle-check"></i> Agreed (1% commission on sale)</span></p>
            </div>
            
            ${r.imageUrls && r.imageUrls.length > 0 ? `
            <div class="form-group">
                <label style="margin-bottom: 0.5rem; display: block;">Select & Order Images to Publish (${r.imageUrls.length})</label>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-top: 10px;">
                    ${r.imageUrls.map((url, i) => `
                        <div class="admin-image-select-card" style="background: var(--dark); border: 1px solid var(--border); border-radius: 8px; padding: 8px; display: flex; flex-direction: column; gap: 8px; position: relative;">
                            <div style="height: 90px; border-radius: 4px; overflow: hidden; position: relative; border: 1px solid #333;">
                                <a href="${url}" target="_blank">
                                    <img src="${url}" alt="Machine Image ${i+1}" style="width: 100%; height: 100%; object-fit: cover;">
                                </a>
                            </div>
                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                                <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.8rem; cursor: pointer; color: var(--text); font-weight: normal; margin: 0;">
                                    <input type="checkbox" class="img-include-chk" data-url="${url}" checked style="accent-color: var(--primary); cursor: pointer; width: 14px; height: 14px;"> Keep
                                </label>
                                <div style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.8rem;">
                                    <span style="color: var(--text-muted);">Pos:</span>
                                    <input type="number" class="img-order-num" value="${i+1}" min="1" max="100" style="width: 45px; background: var(--darker); border: 1px solid var(--border); color: var(--text); border-radius: 4px; padding: 2px 4px; font-size: 0.8rem; text-align: center;">
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : '<div class="form-group"><label>Uploaded Images</label><p>No images uploaded</p></div>'}

            ${r.status === 'pending' ? `
            <div style="display: flex; gap: 1rem; margin-top: 2rem; border-top: 1px solid var(--border); padding-top: 1.5rem;">
                <button class="btn btn-primary btn-full" onclick="approveListingRequest('${doc.id}')"><i class="fa-solid fa-circle-check"></i> Approve Listing</button>
                <button class="btn btn-danger btn-full" onclick="rejectListingRequest('${doc.id}')"><i class="fa-solid fa-circle-xmark"></i> Reject Listing</button>
            </div>
            ` : ''}
        `;

        document.getElementById('listing-detail-modal').classList.add('active');
    } catch (error) {
        console.error('Error viewing listing request:', error);
        showCustomAlert('Error', 'Failed to load listing request: ' + error.message, true);
    }
}

function closeListingDetailModal() {
    document.getElementById('listing-detail-modal').classList.remove('active');
}

async function approveListingRequest(id) {
    const imageCards = document.querySelectorAll('.admin-image-select-card');
    const approvedImages = [];
    imageCards.forEach(card => {
        const chk = card.querySelector('.img-include-chk');
        const numInput = card.querySelector('.img-order-num');
        if (chk && chk.checked) {
            const url = chk.getAttribute('data-url');
            const order = parseInt(numInput.value, 10) || 1;
            approvedImages.push({ url, order });
        }
    });

    if (approvedImages.length === 0) {
        showCustomAlert('Images Required', 'Please select/keep at least one image to publish this product.', true);
        return;
    }

    // Sort by order number ascending
    approvedImages.sort((a, b) => a.order - b.order);
    const finalImageUrls = approvedImages.map(item => item.url);

    showCustomConfirm(
        'Approve Request',
        'Are you sure you want to approve this request and publish it to the website?',
        async () => {
            try {
                showLoadingScreen('Approving and publishing...');
                const docRef = db.collection('listing_requests').doc(id);
                const doc = await docRef.get();
                if (!doc.exists) {
                    showLoadingError('Listing request not found');
                    return;
                }

                const r = doc.data();

                // Create product document
                const newProductRef = db.collection('products').doc();
                const productData = {
                    name: r.machineName,
                    machineType: 'Other', // default, can be edited
                    category: 'used', // published to Used machines
                    price: 'Contact for Price',
                    stockCount: 1,
                    condition: 'Refurbished', // default, can be edited
                    description: `Pre-Owned ${r.machineName}. Running Age: ${r.age}. Running condition: ${r.condition}. Contact admin for details.`,
                    images: finalImageUrls,
                    status: 'active',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                await db.runTransaction(async (transaction) => {
                    transaction.update(docRef, { 
                        status: 'approved',
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    transaction.set(newProductRef, productData);
                });

                showLoadingSuccess('Listing request approved and published successfully!');
                closeListingDetailModal();
                loadListingRequests();
            } catch (error) {
                console.error('Error approving listing request:', error);
                showLoadingError('Failed to approve listing request: ' + error.message);
            }
        }
    );
}

async function rejectListingRequest(id) {
    showCustomConfirm(
        'Reject Request',
        'Are you sure you want to reject this listing request?',
        async () => {
            try {
                showLoadingScreen('Rejecting request...');
                await db.collection('listing_requests').doc(id).update({
                    status: 'rejected',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                showLoadingSuccess('Listing request rejected.');
                closeListingDetailModal();
                loadListingRequests();
            } catch (error) {
                console.error('Error rejecting listing request:', error);
                showLoadingError('Failed to reject listing request: ' + error.message);
            }
        }
    );
}

// ============================================================
// CUSTOM DIALOGS & LOADING OVERLAYS
// ============================================================
function showCustomAlert(title, message, isError = false) {
    const modalId = 'custom-alert-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-overlay';
        modal.style.zIndex = '99999';
        modal.innerHTML = `
            <div class="modal-content text-center" style="max-width: 400px; padding: 2rem; text-align: center;">
                <div class="custom-alert-icon" style="font-size: 3.5rem; margin-bottom: 1rem;"></div>
                <h3 class="custom-alert-title" style="margin-bottom: 0.5rem; text-transform: uppercase; font-weight: 800;"></h3>
                <p class="custom-alert-message" style="color: var(--text-muted); margin-bottom: 1.5rem; line-height: 1.4; font-size: 0.95rem; font-family: 'Oswald', sans-serif; font-weight: 400;"></p>
                <button class="btn btn-primary btn-full" style="margin: 0; display: inline-flex; justify-content: center;" onclick="closeCustomAlert()">OK</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeCustomAlert();
        });
    }

    const iconEl = modal.querySelector('.custom-alert-icon');
    if (isError) {
        iconEl.innerHTML = '<i class="fa-solid fa-circle-xmark" style="color: #c41221;"></i>';
    } else {
        iconEl.innerHTML = '<i class="fa-solid fa-circle-check" style="color: #22c55e;"></i>';
    }

    modal.querySelector('.custom-alert-title').textContent = title;
    modal.querySelector('.custom-alert-message').textContent = message;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeCustomAlert() {
    const modal = document.getElementById('custom-alert-modal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
}

function showCustomConfirm(title, message, onConfirm) {
    const modalId = 'custom-confirm-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-overlay';
        modal.style.zIndex = '99999';
        modal.innerHTML = `
            <div class="modal-content text-center" style="max-width: 400px; padding: 2rem; text-align: center;">
                <div style="font-size: 3.5rem; margin-bottom: 1rem; color: #f59e0b;">
                    <i class="fa-solid fa-circle-question"></i>
                </div>
                <h3 class="custom-confirm-title" style="margin-bottom: 0.5rem; text-transform: uppercase; font-weight: 800;"></h3>
                <p class="custom-confirm-message" style="color: var(--text-muted); margin-bottom: 1.5rem; line-height: 1.4; font-size: 0.95rem; font-family: 'Oswald', sans-serif; font-weight: 400;"></p>
                <div style="display: flex; gap: 1rem;">
                    <button class="btn btn-outline btn-full" style="margin: 0; flex: 1; display: inline-flex; justify-content: center;" onclick="handleCustomConfirmResponse(false)">Cancel</button>
                    <button class="btn btn-primary btn-full" style="margin: 0; flex: 1; display: inline-flex; justify-content: center;" onclick="handleCustomConfirmResponse(true)">Confirm</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    modal.querySelector('.custom-confirm-title').textContent = title;
    modal.querySelector('.custom-confirm-message').textContent = message;
    window._customConfirmCallback = onConfirm;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function handleCustomConfirmResponse(confirmed) {
    const modal = document.getElementById('custom-confirm-modal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';

    if (confirmed && typeof window._customConfirmCallback === 'function') {
        window._customConfirmCallback();
    }
    window._customConfirmCallback = null;
}

function showLoadingScreen(message) {
    const modalId = 'loading-screen-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-overlay';
        modal.style.zIndex = '999999';
        modal.innerHTML = `
            <div class="modal-content text-center" style="max-width: 320px; padding: 2.5rem; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5rem; text-align: center;">
                <div class="loading-spinner-wrapper">
                    <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 4rem; color: #E31828;"></i>
                </div>
                <div class="loading-success-wrapper hidden">
                    <i class="fa-solid fa-circle-check" style="font-size: 5rem; color: #22c55e;"></i>
                </div>
                <div class="loading-error-wrapper hidden">
                    <i class="fa-solid fa-circle-xmark" style="font-size: 5rem; color: #c41221;"></i>
                </div>
                <h3 class="loading-text" style="margin: 0; font-size: 1.2rem; text-transform: uppercase;">SAVING...</h3>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    // Reset state
    modal.querySelector('.loading-spinner-wrapper').classList.remove('hidden');
    modal.querySelector('.loading-success-wrapper').classList.add('hidden');
    modal.querySelector('.loading-error-wrapper').classList.add('hidden');
    modal.querySelector('.loading-text').textContent = message;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function showLoadingSuccess(successMessage, duration = 2000) {
    const modal = document.getElementById('loading-screen-modal');
    if (!modal) return;
    const spinner = modal.querySelector('.loading-spinner-wrapper');
    const success = modal.querySelector('.loading-success-wrapper');
    const text = modal.querySelector('.loading-text');
    
    if (spinner && success && text) {
        spinner.classList.add('hidden');
        success.classList.remove('hidden');
        text.textContent = successMessage;
    }
    
    setTimeout(() => {
        closeLoadingScreen();
    }, duration);
}

function showLoadingError(errorMessage, duration = 3000) {
    const modal = document.getElementById('loading-screen-modal');
    if (!modal) return;
    const spinner = modal.querySelector('.loading-spinner-wrapper');
    const error = modal.querySelector('.loading-error-wrapper');
    const text = modal.querySelector('.loading-text');
    
    if (spinner && error && text) {
        spinner.classList.add('hidden');
        error.classList.remove('hidden');
        text.textContent = errorMessage;
    }
    
    setTimeout(() => {
        closeLoadingScreen();
    }, duration);
}

function closeLoadingScreen() {
    const modal = document.getElementById('loading-screen-modal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
}
