/* ============================================================
   NEXUS MACHINERY SOLUTIONS — UNIFIED WEBSITE SCRIPT v3
   Merged: Service Website + Selling Website

   SECURITY: Full input sanitization applied on all user data.
   See SECURITY_GUIDE.txt for the complete threat model.
============================================================ */

'use strict';

// ============================================================
// 0. SECURITY — INPUT SANITIZATION & VALIDATION MODULE
//    All user input passes through these functions before
//    being sent to Firebase or rendered in the DOM.
// ============================================================

/**
 * WHAT THIS PREVENTS:
 *  - XSS (Cross-Site Scripting): strips <script>, <img onerror=>, etc.
 *  - Stored XSS: malicious HTML stored in Firestore and rendered in admin app
 *  - NoSQL Injection: forces values to plain strings (not objects/arrays)
 *  - Null byte injection: removes \x00 which can confuse some parsers
 *  - Oversized payloads: enforces per-field length limits
 *
 * NOTE on Firestore SQL injection:
 *  Firestore is NOT a SQL database — there is no "SQL query" to inject into.
 *  However, storing <script> tags in text fields is still dangerous because
 *  when the admin app displays them, it can execute that script (Stored XSS).
 *  This sanitizer prevents that entirely.
 */

/**
 * Sanitizes a plain text field.
 * Strips all HTML, script tags, and dangerous characters.
 * @param {*}      input     - Raw user input (any type)
 * @param {number} maxLength - Hard character limit for this field
 * @returns {string} Clean, safe string
 */
function sanitizeText(input, maxLength = 500) {
    // 1. Reject null / undefined / non-string → return empty string
    if (input === null || input === undefined) return '';

    // 2. Force to string — prevents object/array injection into Firestore
    //    e.g., attacker sending {"$gt":""} as a value is converted to "[object Object]"
    //    which is then further stripped by the rules below
    let clean = String(input);

    // 3. Trim leading/trailing whitespace
    clean = clean.trim();

    // 4. Strip ALL HTML tags — <script>alert(1)</script> → alert(1)
    //    This also removes: <img>, <iframe>, <svg>, <object>, etc.
    clean = clean.replace(/<[^>]*>/g, '');

    // 5. Remove characters commonly used in injection attacks:
    //    < > are already gone but double-check
    //    " ' ` allow attribute injection
    //    { } [ ] are NoSQL/JSON injection vectors
    //    ; can terminate statements
    //    \ starts escape sequences
    //    | & ^ are shell/operator injection characters
    clean = clean.replace(/[<>"'`\\{}\[\];|&^]/g, '');

    // 6. Remove URL javascript: protocol (prevents href/src injection)
    //    e.g., javascript:alert(1) → alert(1)
    clean = clean.replace(/javascript\s*:/gi, '');
    clean = clean.replace(/data\s*:/gi, '');
    clean = clean.replace(/vbscript\s*:/gi, '');

    // 7. Remove null bytes (\x00) — can bypass some string checks
    //    Remove other non-printable control characters
    // eslint-disable-next-line no-control-regex
    clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // 8. Collapse multiple whitespace characters into a single space
    clean = clean.replace(/\s+/g, ' ');

    // 9. Hard length limit — prevents database storage abuse
    clean = clean.substring(0, maxLength);

    return clean;
}

/**
 * Validates and sanitizes a phone number.
 * Only accepts valid Indian mobile numbers (10 digits, starts with 6-9).
 * @param {*} input - Raw phone number from form
 * @returns {string|null} - Sanitized digits, or null if invalid
 */
function sanitizePhone(input) {
    if (!input) return null;

    // Strip everything except digits
    const digits = String(input).replace(/\D/g, '');

    // Must be exactly 10 digits AND start with 6, 7, 8, or 9
    // This matches all valid Indian mobile number prefixes
    if (!/^[6-9]\d{9}$/.test(digits)) return null;

    return digits;
}

/**
 * Validates and sanitizes an email address.
 * Email is optional in our forms, so empty string is valid.
 * @param {*} input - Raw email from form
 * @returns {string|null} - Sanitized email, empty string if blank, null if bad format
 */
function sanitizeEmail(input) {
    if (!input || String(input).trim() === '') return ''; // Optional field — blank is OK

    // Sanitize first (removes any injection chars)
    const clean = sanitizeText(String(input), 254).toLowerCase(); // RFC 5321 max

    // Standard email regex — rejects anything that is not a valid email format
    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(clean)) return null; // null = invalid format

    return clean;
}

/**
 * Runs all sanitization on a complete data object before sending to Firebase.
 * Mutates and returns a clean copy.
 * @throws {Error} with code INVALID_PHONE or INVALID_EMAIL if validation fails
 */
function sanitizeFormData(data) {
    // Work on a clean copy — never mutate the original
    const safe = {};

    // Field length limits (per field type)
    const limits = {
        name:     100,   // Person name
        company:  150,   // Company name
        location: 300,   // Address
        message:  1000,  // Free-form message
        type:     50,    // Internal enum values
        machineType:    50,
        supportType:    50,
        automationType: 50,
        productName:    200,
        timestamp:      50
    };

    // Copy and sanitize all text fields
    for (const [key, value] of Object.entries(data)) {
        if (key === 'phone') continue; // Handle separately below
        if (key === 'email') continue; // Handle separately below
        if (key === 'latitude' || key === 'longitude') {
            safe[key] = value ? parseFloat(value) : null;
            continue;
        }
        const limit = limits[key] || 500;
        safe[key] = sanitizeText(value, limit);
    }

    // Validate phone number (REQUIRED in all our forms)
    if (data.phone !== undefined) {
        const cleanPhone = sanitizePhone(data.phone);
        if (cleanPhone === null) {
            throw new Error('INVALID_PHONE');
        }
        safe.phone = cleanPhone;
    }

    // Validate email (OPTIONAL — but if provided, must be valid format)
    if (data.email !== undefined) {
        const cleanEmail = sanitizeEmail(data.email);
        if (cleanEmail === null) {
            throw new Error('INVALID_EMAIL');
        }
        safe.email = cleanEmail;
    }

    return safe;
}

/**
 * Safe DOM text setter — ALWAYS use this instead of .innerHTML for user data.
 * Uses textContent which NEVER parses HTML, so stored XSS cannot execute.
 */
function safeSetText(elementId, text) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = sanitizeText(String(text), 500);
}

// ============================================================
// SPAM PROTECTION — COOLDOWN SYSTEM
// After submitting, blocks same form for COOLDOWN_MINUTES.
// Uses localStorage (browser-side Layer 1 protection).
// ============================================================
const COOLDOWN_MINUTES = 15;
const MAX_SUBMISSIONS_IN_WINDOW = 3;

function checkSpamCooldown(formType) {
    try {
        const key = `nms_cd_${formType}`;
        const submitsStr = localStorage.getItem(key);
        if (!submitsStr) return { blocked: false };

        let submits = JSON.parse(submitsStr);
        if (!Array.isArray(submits)) submits = [];

        const now = Date.now();
        const windowMs = COOLDOWN_MINUTES * 60 * 1000;
        submits = submits.filter(ts => (now - ts) < windowMs);

        localStorage.setItem(key, JSON.stringify(submits));

        if (submits.length >= MAX_SUBMISSIONS_IN_WINDOW) {
            const oldest = Math.min(...submits);
            const remainingMs = windowMs - (now - oldest);
            const remainingMins = Math.ceil(remainingMs / 60000);
            return { blocked: true, minutes: remainingMins };
        }
    } catch (e) {
        return { blocked: false };
    }
    return { blocked: false };
}

function recordSubmission(formType) {
    try {
        const key = `nms_cd_${formType}`;
        const submitsStr = localStorage.getItem(key);
        let submits = [];
        if (submitsStr) {
            try {
                submits = JSON.parse(submitsStr);
                if (!Array.isArray(submits)) submits = [];
            } catch (e) {
                submits = [];
            }
        }
        submits.push(Date.now());
        localStorage.setItem(key, JSON.stringify(submits));
    } catch (e) {
        // Ignore
    }
}

// ============================================================
// 1. STATE
// ============================================================
let selectedMachineType = '';
let selectedSupportType = '';
let selectedAutomationType = '';
let currentProductName = '';
let currentProductCategory = '';

// Voice recording state per prefix
const recorderState = {};

// ============================================================
// 2. TRUST SIGNALS — SCROLL ANIMATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.trust-item').forEach((item, i) => {
        item.style.transitionDelay = `${i * 0.15}s`;
        observer.observe(item);
    });
});

// ============================================================
// 3. GLOBAL HEADER MENU
// ============================================================
function toggleGlobalMenu() {
    const hamburger = document.querySelector('.hamburger');
    const overlay = document.getElementById('global-menu-overlay');
    hamburger.classList.toggle('active');
    overlay.classList.toggle('active');
}

// ============================================================
// 4. HERO SHOWCASE SLIDESHOW (DYNAMIC WITH FIREBASE)
// ============================================================
let heroSlidesData = {
    service: [],
    products: [],
    automation: []
};
let isHeroAutoSwitchingCategories = true;
let currentHeroCategory = 'service';
let currentHeroImageIndex = 0;
let isInitialHeroLoad = true;
let isHeroDropdownOpen = false;
const categoryOrder = ['service', 'products', 'automation'];
const categoryNames = {
    service: 'SERVICES',
    products: 'NEW AND USED PRODUCTS',
    automation: 'AUTOMATION SOLUTIONS'
};

function getDefaultSlides(category) {
    if (category === 'service') {
        return [
            { category: 'service', imageUrl: 'Images/service-3.png', title: 'MACHINE BREAKDOWN SERVICE', description: 'Expert diagnostic and repair services for all machine types including Turning Machines, VMC, HMC, VTL, and Double Column. Restoring precision and minimizing downtime.' },
            { category: 'service', imageUrl: 'Images/service-1.png', title: 'SPINDLE SERVICE', description: 'Expert repair and maintenance of belt drive and integrated spindles for smooth performance and long-lasting reliability.' },
            { category: 'service', imageUrl: 'Images/service-2.png', title: 'TURRET SERVICE', description: 'Professional turret and live turret repair and maintenance for smooth and reliable operation.' },
            { category: 'service', imageUrl: 'Images/part-1.png', title: 'MACHINE PART SERVICE', description: 'High-quality replacement parts and professional repair services for rotary cylinders, hydraulic components, and angle heads.' }
        ];
    } else if (category === 'products') {
        return [
            { category: 'products', imageUrl: 'Images/CNC.png', title: 'NEW & USED PRODUCT', description: 'Premium CNC, VMC, HMC, and VTL machines — new and certified pre-owned. Browse our selection and enquire for pricing.' }
        ];
    } else {
        return [
            { category: 'automation', imageUrl: 'Images/auto-1.png', title: 'AUTOMATION SOLUTION', description: 'Complete industrial automation systems — Pick & Place, Robotic arm integration, and Gantry systems customized for your production lines.' },
            { category: 'automation', imageUrl: 'Images/auto-2.png', title: 'ROBOTIC ARM INTEGRATION', description: 'Advanced robotic arms designed for high-speed precision tasks and maximum efficiency.' },
            { category: 'automation', imageUrl: 'Images/auto-3.png', title: 'CUSTOM GANTRY SYSTEMS', description: 'Robust gantry solutions tailored for heavy payload manipulation and wide area coverage.' },
            { category: 'automation', imageUrl: 'Images/auto-4.png', title: 'SMART CONVEYORS', description: 'Intelligent conveyor belts optimized for automated quality checks and sorting.' },
            { category: 'automation', imageUrl: 'Images/auto-5.png', title: 'FULL LINE AUTOMATION', description: 'End-to-end factory automation setups ensuring seamless continuous production with minimal downtime.' }
        ];
    }
}

function useDefaultHeroSlides() {
    heroSlidesData.service = getDefaultSlides('service');
    heroSlidesData.products = getDefaultSlides('products');
    heroSlidesData.automation = getDefaultSlides('automation');
    updateHeroDisplay();
}

async function fetchHeroSlides() {
    try {
        if (!window._firebase || !window._nexusDB) {
            console.warn("Firebase not initialized. Using default hero slides.");
            useDefaultHeroSlides();
            return;
        }

        const snapshot = await window._firebase.getDocs(window._firebase.collection(window._nexusDB, 'hero_slides'));
        if (snapshot.empty) {
            console.log("No hero slides in Firebase. Using defaults.");
            useDefaultHeroSlides();
        } else {
            heroSlidesData = { service: [], products: [], automation: [] };
            snapshot.forEach(doc => {
                const data = doc.data();
                if (heroSlidesData[data.category]) {
                    heroSlidesData[data.category].push(data);
                }
            });
            
            if (heroSlidesData.service.length === 0) heroSlidesData.service = getDefaultSlides('service');
            if (heroSlidesData.products.length === 0) heroSlidesData.products = getDefaultSlides('products');
            if (heroSlidesData.automation.length === 0) heroSlidesData.automation = getDefaultSlides('automation');
            
            updateHeroDisplay();
        }
    } catch (error) {
        console.error("Error fetching hero slides:", error);
        useDefaultHeroSlides();
    }
}

function toggleHeroDropdown() {
    const btn = document.querySelector('.category-dropdown-btn');
    const list = document.getElementById('hero-dropdown-list');
    
    isHeroDropdownOpen = btn ? !btn.classList.contains('open') : false;
    
    if(btn) btn.classList.toggle('open');
    if(list) list.classList.toggle('open');
}

window.toggleHeroDropdown = toggleHeroDropdown;

function resetToHome() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Call switchTab to reset everything to default 'service' state
    if (typeof switchTab === 'function') switchTab('service');
    
    // Forcefully re-enable auto-switching since switchTab disabled it
    isHeroAutoSwitchingCategories = true;
    currentHeroImageIndex = 0; // Ensure we start at the very first image
    
    updateHeroDisplay();
}

window.resetToHome = resetToHome;

function selectHeroCategory(category) {
    isHeroDropdownOpen = false;
    isHeroAutoSwitchingCategories = false;
    
    const list = document.getElementById('hero-dropdown-list');
    const btn = document.querySelector('.category-dropdown-btn');
    if(list) list.classList.remove('open');
    if(btn) btn.classList.remove('open');
    
    if (typeof switchTab === 'function') {
        switchTab(category);
    } else {
        isHeroAutoSwitchingCategories = false;
        currentHeroCategory = category;
        currentHeroImageIndex = 0;
        updateHeroDropdownText(categoryNames[category]);
        updateHeroDisplay();
    }
}

window.selectHeroCategory = selectHeroCategory;

function updateHeroDropdownText(text) {
    const span = document.getElementById('hero-current-category');
    if (!span || span.textContent === text) return;
    
    // Calculate width of CURRENT text for erase animation
    span.style.width = 'auto';
    const currentWidth = span.offsetWidth;
    span.style.setProperty('--target-width', currentWidth + 'px');
    span.style.setProperty('--steps', span.textContent.length);
    
    // Start erase animation on current text
    span.classList.remove('typing');
    span.classList.add('erasing');
    
    // Wait for erase to finish before typing new text
    setTimeout(() => {
        span.classList.remove('erasing');
        span.textContent = text;
        
        span.style.width = 'auto';
        const newWidth = span.offsetWidth;
        span.style.setProperty('--target-width', newWidth + 'px');
        span.style.setProperty('--steps', text.length);
        
        void span.offsetWidth; // Trigger reflow
        span.classList.add('typing');
    }, 450); // 400ms is the erase animation duration
}

function rotateHeroShowcase() {
    if (isHeroDropdownOpen) return; // Pause auto-rotation when dropdown is open

    if (isHeroAutoSwitchingCategories) {
        // Auto switch category
        let currentCategoryIndex = categoryOrder.indexOf(currentHeroCategory);
        currentCategoryIndex = (currentCategoryIndex + 1) % categoryOrder.length;
        currentHeroCategory = categoryOrder[currentCategoryIndex];
        currentHeroImageIndex = 0;
        
        updateHeroDropdownText(categoryNames[currentHeroCategory]);
    } else {
        // Cycle through images in the locked category
        const slides = heroSlidesData[currentHeroCategory];
        if (slides && slides.length > 1) {
            currentHeroImageIndex = (currentHeroImageIndex + 1) % slides.length;
        }
    }
    
    updateHeroDisplay();
}

function updateHeroDisplay() {
    const imgEl    = document.getElementById('showcase-img');
    const titleEl  = document.getElementById('showcase-title');
    const descEl   = document.getElementById('showcase-desc');
    const ctaEl    = document.getElementById('showcase-cta');

    if (!imgEl || !titleEl || !descEl || !ctaEl) return;

    const slides = heroSlidesData[currentHeroCategory];
    if (!slides || slides.length === 0) return;
    
    const slide = slides[currentHeroImageIndex];
    const elements = [imgEl, titleEl, descEl, ctaEl];

    const setupSlideContent = () => {
        imgEl.src = slide.imageUrl;
        imgEl.alt = slide.title;
        titleEl.textContent = slide.title;
        descEl.textContent  = slide.description;
        
        if (currentHeroCategory === 'service') {
            ctaEl.textContent = 'Send Service Enquiry';
            ctaEl.onclick = (e) => {
                e.preventDefault();
                if(typeof switchTab === 'function') switchTab('service');
                if(typeof switchSubTab === 'function') switchSubTab('breakdown');
                document.getElementById('enquiry-tabs').scrollIntoView({ behavior: 'smooth' });
            };
        } else if (currentHeroCategory === 'products') {
            ctaEl.textContent = 'View Machines';
            ctaEl.onclick = (e) => {
                e.preventDefault();
                if(typeof switchTab === 'function') switchTab('products');
                document.getElementById('enquiry-tabs').scrollIntoView({ behavior: 'smooth' });
            };
        } else {
            ctaEl.textContent = 'Automation Enquiry';
            ctaEl.onclick = (e) => {
                e.preventDefault();
                if(typeof switchTab === 'function') switchTab('automation');
                document.getElementById('enquiry-tabs').scrollIntoView({ behavior: 'smooth' });
            };
        }
    };

    if (isInitialHeroLoad) {
        setupSlideContent();
        elements.forEach(el => el.classList.add('active'));
        isInitialHeroLoad = false;
        return;
    }

    elements.forEach(el => el.classList.remove('active'));

    setTimeout(() => {
        setupSlideContent();
        elements.forEach(el => el.classList.add('active'));
    }, 600);
}

document.addEventListener('DOMContentLoaded', () => {
    // Wait slightly for Firebase to initialize if it's imported dynamically
    setTimeout(() => {
        fetchHeroSlides();
        setInterval(rotateHeroShowcase, 5000);
    }, 500);
});

// ============================================================
// 5. MAIN TAB SWITCHING
// ============================================================
function switchTab(tabName) {
    // Sync the Hero Section if it's one of the hero categories
    if (typeof categoryNames !== 'undefined' && categoryNames[tabName]) {
        isHeroAutoSwitchingCategories = false;
        
        if (currentHeroCategory !== tabName) {
            currentHeroCategory = tabName;
            currentHeroImageIndex = 0;
            if (typeof updateHeroDropdownText === 'function') updateHeroDropdownText(categoryNames[tabName]);
            if (typeof updateHeroDisplay === 'function') updateHeroDisplay();
        }
    }

    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.image-tab-card').forEach(card => {
        card.classList.remove('active');
        card.setAttribute('aria-selected', 'false');
    });

    const selectedContent = document.getElementById(`tab-${tabName}`);
    const selectedBtn     = document.getElementById(`tab-btn-${tabName}`);
    const selectedImgCard = document.getElementById(`img-tab-${tabName}`);

    if (selectedContent) selectedContent.classList.add('active');
    if (selectedBtn) {
        selectedBtn.classList.add('active');
        selectedBtn.setAttribute('aria-selected', 'true');
    }
    if (selectedImgCard) {
        selectedImgCard.classList.add('active');
        selectedImgCard.setAttribute('aria-selected', 'true');
    }

    // Reset to default sub-tabs when switching main tabs
    if (tabName === 'products') {
        switchSubTab('new-machine');
    } else if (tabName === 'service') {
        switchSubTab('breakdown');
    }
}

// ============================================================
// 6. SERVICE SUB-TABS
// ============================================================
function switchSubTab(subTabName) {
    document.querySelectorAll('.sub-tab-content').forEach(stc => stc.classList.remove('active'));
    document.querySelectorAll('.sub-tab-btn').forEach(btn => btn.classList.remove('active'));

    const selectedSubContent = document.getElementById(`sub-${subTabName}`);
    const selectedSubBtn     = document.getElementById(`sub-tab-btn-${subTabName}`);

    if (selectedSubContent) selectedSubContent.classList.add('active');
    if (selectedSubBtn) selectedSubBtn.classList.add('active');
}

// ============================================================
// 7. BREAKDOWN ENQUIRY — STEP NAVIGATION
// ============================================================
function selectMachineType(type) {
    // SECURITY: Machine type comes from our own hardcoded buttons, but
    // we still sanitize to be safe in case of DOM manipulation
    selectedMachineType = sanitizeText(type, 50);

    // Use safe DOM setters — never innerHTML with variable data
    safeSetText('selected-machine-display', selectedMachineType);
    safeSetText('badge-machine', selectedMachineType);

    document.getElementById('breakdown-step1').classList.remove('active');
    document.getElementById('breakdown-step2').classList.add('active');
}

function goBackToStep1() {
    selectedMachineType = '';
    document.getElementById('breakdown-step2').classList.remove('active');
    document.getElementById('breakdown-step1').classList.add('active');
}

function selectSupportType(type) {
    selectedSupportType = sanitizeText(type, 50);
    safeSetText('badge-support', selectedSupportType);

    document.getElementById('breakdown-step2').classList.remove('active');
    document.getElementById('breakdown-step3').classList.add('active');
}

function goBackToStep2() {
    selectedSupportType = '';
    document.getElementById('breakdown-step3').classList.remove('active');
    document.getElementById('breakdown-step2').classList.add('active');
}

// ============================================================
// 8. AUTOMATION — STEP NAVIGATION
// ============================================================
function selectAutomationType(type) {
    selectedAutomationType = sanitizeText(type, 50);
    safeSetText('badge-automation', selectedAutomationType);

    document.getElementById('automation-step1').classList.remove('active');
    document.getElementById('automation-step2').classList.add('active');
}

function goBackAutomation() {
    selectedAutomationType = '';
    document.getElementById('automation-step2').classList.remove('active');
    document.getElementById('automation-step1').classList.add('active');
}

// ============================================================
// 9. CARD ACCORDION (Services Section)
// ============================================================
function toggleCard(element) {
    const isActive = element.classList.contains('active');
    document.querySelectorAll('.card-large.active, .card-small.active').forEach(card => {
        card.classList.remove('active');
    });
    if (!isActive) {
        element.classList.add('active');
    }
}

// ============================================================
// 10. PHOTO CAPTURE — with file type validation
// ============================================================
// Allowed MIME types for photo uploads
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
const MAX_PHOTO_SIZE_MB   = 10;

function handlePhotoSelected(input, previewAreaId) {
    const file = input.files[0];
    if (!file) return;

    // Reset sibling input (camera or gallery) so only one holds a file reference at a time
    const prefix = previewAreaId.split('-')[0]; // e.g. "bd"
    const currentInputId = input.id; // e.g. "bd-photo-camera"
    const siblingInputId = currentInputId.endsWith('-camera') ? `${prefix}-photo-gallery` : `${prefix}-photo-camera`;
    const siblingInput = document.getElementById(siblingInputId);
    if (siblingInput) {
        siblingInput.value = '';
    }

    // SECURITY: Validate file type by MIME type (not just extension)
    // Extension can be faked (e.g. rename virus.exe to virus.jpg)
    // MIME type is set by the browser based on actual file content
    if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
        showFieldError(previewAreaId, 'Only JPG, PNG, or WebP photos allowed.');
        input.value = '';
        return;
    }

    // SECURITY: Enforce file size limit
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_PHOTO_SIZE_MB) {
        showFieldError(previewAreaId, `Photo too large (${sizeMB.toFixed(1)} MB). Max: ${MAX_PHOTO_SIZE_MB} MB.`);
        input.value = '';
        return;
    }

    const previewArea = document.getElementById(previewAreaId);
    previewArea.innerHTML = '';

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.createElement('img');
        // SECURITY: src set from FileReader result (a data: URL) — safe
        img.src = e.target.result;
        img.alt = 'Captured photo preview';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'clear-media-btn';
        removeBtn.style.marginTop = '0.5rem';
        // SECURITY: Using textContent + createElement, NOT innerHTML
        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-trash';
        removeBtn.appendChild(icon);
        removeBtn.appendChild(document.createTextNode(' Remove Photo'));
        removeBtn.onclick = () => {
            previewArea.innerHTML = '';
            input.value = '';
            const prefix = previewAreaId.split('-')[0];
            const siblingId = input.id.endsWith('-camera') ? `${prefix}-photo-gallery` : `${prefix}-photo-camera`;
            const sibling = document.getElementById(siblingId);
            if (sibling) sibling.value = '';
        };

        previewArea.appendChild(img);
        previewArea.appendChild(removeBtn);
    };
    reader.readAsDataURL(file);
}

function showFieldError(containerId, message) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    const err = document.createElement('p');
    err.style.cssText = 'color:#FF6B6B;font-size:0.82rem;font-weight:700;margin:0;';
    // SECURITY: textContent for error message (no HTML injection)
    err.textContent = message;
    container.appendChild(err);
}

// ============================================================
// 11. VOICE RECORDING — with duration limit
// ============================================================
const MAX_RECORDING_SECONDS = 120; // 2 minutes max

function toggleRecording(prefix) {
    if (recorderState[prefix] && recorderState[prefix].isRecording) {
        stopRecording(prefix);
    } else {
        startRecording(prefix);
    }
}

async function startRecording(prefix) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const chunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/webm' });

            // SECURITY: Enforce max file size on voice recording too
            const sizeMB = blob.size / (1024 * 1024);
            if (sizeMB > 20) {
                showFieldError(`${prefix}-audio-preview`, 'Recording too large. Please record a shorter message.');
                stream.getTracks().forEach(t => t.stop());
                return;
            }

            const url = URL.createObjectURL(blob);
            const audioEl = document.getElementById(`${prefix}-audio-preview`);
            audioEl.src = url;
            audioEl.classList.remove('hidden');
            audioEl._blob = blob;

            const clearBtn = document.getElementById(`${prefix}-clear-audio`);
            if (clearBtn) clearBtn.classList.remove('hidden');

            stream.getTracks().forEach(t => t.stop());
            recorderState[prefix] = { ...recorderState[prefix], isRecording: false };
        };

        mediaRecorder.start();

        recorderState[prefix] = {
            mediaRecorder,
            isRecording: true,
            startTime: Date.now(),
            timerInterval: null
        };

        const btn   = document.getElementById(`${prefix}-record-btn`);
        const label = document.getElementById(`${prefix}-record-label`);
        const timer = document.getElementById(`${prefix}-timer`);

        if (btn)   btn.classList.add('recording');
        if (label) label.textContent = 'Stop Recording';
        if (timer) timer.classList.remove('hidden');

        recorderState[prefix].timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - recorderState[prefix].startTime) / 1000);

            // Auto-stop at max duration
            if (elapsed >= MAX_RECORDING_SECONDS) {
                stopRecording(prefix);
                return;
            }

            const mins = Math.floor(elapsed / 60);
            const secs = elapsed % 60;
            if (timer) timer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }, 1000);

    } catch (err) {
        if (err.name === 'NotAllowedError') {
            alert('Microphone permission denied. Please allow microphone access in your browser settings and try again.');
        } else {
            alert('Could not access microphone. Please check your device settings.');
        }
        console.error('Microphone error:', err);
    }
}

function stopRecording(prefix) {
    const state = recorderState[prefix];
    if (!state || !state.isRecording) return;

    state.mediaRecorder.stop();
    clearInterval(state.timerInterval);

    const btn   = document.getElementById(`${prefix}-record-btn`);
    const label = document.getElementById(`${prefix}-record-label`);
    const timer = document.getElementById(`${prefix}-timer`);

    if (btn)   btn.classList.remove('recording');
    if (label) label.textContent = 'Record Again';
    if (timer) timer.classList.add('hidden');
}

function clearAudio(prefix) {
    const audioEl  = document.getElementById(`${prefix}-audio-preview`);
    const clearBtn = document.getElementById(`${prefix}-clear-audio`);
    const label    = document.getElementById(`${prefix}-record-label`);

    if (audioEl) {
        audioEl.src = '';
        audioEl._blob = null;
        audioEl.classList.add('hidden');
    }
    if (clearBtn) clearBtn.classList.add('hidden');
    if (label)    label.textContent = 'Record Voice';
}

// ============================================================
// 12. FORM SUBMISSION — with sanitization + spam check
// ============================================================
async function submitForm(event, formType) {
    event.preventDefault();

    const form      = event.target;
    const submitBtn = form.querySelector('[type="submit"]');

    // ── SPAM PROTECTION (Layer 1: browser cooldown) ──
    const spam = checkSpamCooldown(formType);
    if (spam.blocked) {
        showInlineError(
            submitBtn,
            `You recently sent an enquiry. Please wait ${spam.minutes} more minute(s) before submitting again, or call us directly at 9109190790.`
        );
        return;
    }

    // Set loading state
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    const originalHTML = submitBtn.innerHTML;
    submitBtn.innerHTML = 'Sending...';

    try {
        // Collect raw data
        const rawData = collectFormData(formType);

        // ── SECURITY: SANITIZE ALL FIELDS ──
        const safeData = sanitizeFormData(rawData);

        // Send to Firebase (or simulate)
        await simulateSubmit(safeData);

        // Record submission timestamp for cooldown
        recordSubmission(formType);

        // Success
        showSuccessToast();
        form.reset();
        resetMediaFields(formType);

        if (formType === 'breakdown') {
            selectedMachineType = '';
            selectedSupportType = '';
            document.getElementById('breakdown-step1').classList.add('active');
            document.getElementById('breakdown-step2').classList.remove('active');
            document.getElementById('breakdown-step3').classList.remove('active');
        }

        if (formType === 'automation') {
            goBackAutomation();
            selectedAutomationType = '';
        }

    } catch (err) {
        if (err.message === 'INVALID_PHONE') {
            showInlineError(submitBtn, 'Please enter a valid 10-digit Indian mobile number (starting with 6, 7, 8, or 9).');
        } else if (err.message === 'INVALID_EMAIL') {
            showInlineError(submitBtn, 'The email address format is invalid. Please correct it or leave it blank.');
        } else {
            console.error('Submit error:', err);
            showInlineError(submitBtn, 'Could not send enquiry. Please try again or call us at 9109190790.');
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        submitBtn.innerHTML = originalHTML;
    }
}

function showInlineError(nearElement, message) {
    // Remove any existing error first
    const existing = document.getElementById('nms-submit-error');
    if (existing) existing.remove();

    const errEl = document.createElement('p');
    errEl.id = 'nms-submit-error';
    errEl.style.cssText = 'color:#FF6B6B;font-size:0.85rem;font-weight:700;margin-top:0.8rem;text-align:center;padding:0.5rem;border-radius:4px;background:rgba(255,107,107,0.1);border:1px solid rgba(255,107,107,0.3);';
    // SECURITY: textContent — no HTML injection in error messages
    errEl.textContent = message;

    nearElement.insertAdjacentElement('afterend', errEl);

    // Auto-dismiss after 8 seconds
    setTimeout(() => errEl.remove(), 8000);
}

// ============================================================
// 13. DATA COLLECTION (raw — sanitization happens separately)
// ============================================================
function collectFormData(formType) {
    const data = { type: formType, timestamp: new Date().toISOString() };

    const fieldMap = {
        'breakdown':     { name: 'bd-name', phone: 'bd-phone', email: 'bd-email', location: 'bd-location' },
        'part':          { name: 'pt-name', phone: 'pt-phone', email: 'pt-email', location: 'pt-location' },
        'service-other': { name: 'so-name', phone: 'so-phone', email: 'so-email', location: 'so-location' },
        'automation':    { name: 'au-name', company: 'au-company', phone: 'au-phone', email: 'au-email' },
        'other':         { name: 'ot-name', phone: 'ot-phone', email: 'ot-email', message: 'ot-message' }
    };

    const fields = fieldMap[formType];
    if (fields) {
        for (const [key, id] of Object.entries(fields)) {
            const el = document.getElementById(id);
            if (el) data[key] = el.value; // Raw value — sanitizeFormData() cleans it
        }
    }

    if (formType === 'breakdown') {
        data.machineType  = selectedMachineType;
        data.supportType  = selectedSupportType;
    }

    if (formType === 'automation') {
        data.automationType = selectedAutomationType;
    }

    const prefixMap = { 'breakdown': 'bd', 'part': 'pt', 'service-other': 'so' };
    const prefix = prefixMap[formType];
    if (prefix) {
        const latEl = document.getElementById(`${prefix}-latitude`);
        const lngEl = document.getElementById(`${prefix}-longitude`);
        if (latEl && lngEl && latEl.value && lngEl.value) {
            data.latitude = latEl.value;
            data.longitude = lngEl.value;
            data.mapsLink = `https://www.google.com/maps?q=${latEl.value},${lngEl.value}`;
        }
    }

    return data;
}

function resetMediaFields(formType) {
    const prefixMap = { 'breakdown': 'bd', 'part': 'pt', 'service-other': 'so' };
    const prefix = prefixMap[formType];
    if (!prefix) return;

    const photoInput = document.getElementById(`${prefix}-photo`);
    if (photoInput) photoInput.value = '';

    const previewMap = { 'bd': 'bd-photo-preview', 'pt': 'pt-photo-preview', 'so': 'so-photo-preview' };
    const preview = document.getElementById(previewMap[prefix]);
    if (preview) preview.innerHTML = '';

    clearAudio(prefix);
}

// ============================================================
// 14. PRODUCT ENQUIRY MODAL
// ============================================================
function openProductModal(productName, category) {
    currentProductName     = sanitizeText(productName, 200);
    currentProductCategory = sanitizeText(category, 20);

    // SECURITY: Use textContent (not innerHTML) to display product name
    safeSetText('modal-product-name', currentProductName);

    document.getElementById('form-product').style.display = 'block';
    document.getElementById('product-success').classList.add('hidden');
    document.getElementById('form-product').reset();
    document.getElementById('product-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeProductModal() {
    document.getElementById('product-modal').classList.remove('active');
    document.body.style.overflow = '';
    currentProductName     = '';
    currentProductCategory = '';
}

async function submitProductEnquiry(event) {
    event.preventDefault();

    // SPAM CHECK for product enquiry (uses 'product' as the type key)
    const spam = checkSpamCooldown('product');
    if (spam.blocked) {
        alert(`You recently sent an enquiry. Please wait ${spam.minutes} more minute(s) before submitting again.`);
        return;
    }

    const submitBtn = document.getElementById('pr-submit-btn');
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    const originalHTML = submitBtn.innerHTML;
    submitBtn.innerHTML = 'Sending...';

    // Collect raw data
    const rawData = {
        type:        currentProductCategory === 'new' ? 'new-product' : 'used-product',
        productName: currentProductName,
        name:        document.getElementById('pr-name').value,
        company:     document.getElementById('pr-company').value,
        phone:       document.getElementById('pr-phone').value,
        email:       document.getElementById('pr-email').value,
        timestamp:   new Date().toISOString()
    };

    try {
        // SECURITY: Sanitize all fields before sending
        const safeData = sanitizeFormData(rawData);
        await simulateSubmit(safeData);

        recordSubmission('product');

        // Show success inside modal
        document.getElementById('form-product').style.display = 'none';
        document.getElementById('product-success').classList.remove('hidden');

    } catch (err) {
        if (err.message === 'INVALID_PHONE') {
            alert('Please enter a valid 10-digit Indian mobile number (starting with 6, 7, 8, or 9).');
        } else if (err.message === 'INVALID_EMAIL') {
            alert('The email address format is invalid. Please correct it or leave it blank.');
        } else {
            console.error('Product enquiry error:', err);
            alert('Failed to send enquiry. Please try again or call us at 9109190790.');
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        submitBtn.innerHTML = originalHTML;
    }
}

// Close product modal on overlay click
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('product-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeProductModal();
        });
    }
});

// ============================================================
// 15. FIREBASE SUBMIT & STORAGE UPLOADS
// ============================================================
async function simulateSubmit(data) {
    const db = window._nexusDB;
    const fb = window._firebase;

    // Fallback if Firebase is not initialized yet (development fallback)
    if (!db || !fb) {
        console.log('📬 [SIMULATED] Firebase not initialized. Sanitized data:', data);
        return new Promise((resolve) => setTimeout(resolve, 1200));
    }

    const collectionMap = {
        'breakdown':     'breakdown_enquiries',
        'part':          'part_enquiries',
        'service-other': 'other_service_enquiries',
        'automation':    'automation_enquiries',
        'other':         'general_enquiries',
        'new-product':   'new_product_enquiries',
        'used-product':  'used_product_enquiries'
    };

    const collectionName = collectionMap[data.type];
    if (!collectionName) throw new Error('Unknown form type: ' + data.type);

    // Upload media files if present (failures are non-fatal — form still submits)
    let prefix = null;
    if (data.type === 'breakdown') prefix = 'bd';
    if (data.type === 'part') prefix = 'pt';
    if (data.type === 'service-other') prefix = 'so';

    if (prefix) {
        // Retrieve file from whichever input (camera or gallery) was used
        let photoFile = null;
        const cameraInput = document.getElementById(`${prefix}-photo-camera`);
        const galleryInput = document.getElementById(`${prefix}-photo-gallery`);
        if (cameraInput && cameraInput.files && cameraInput.files[0]) {
            photoFile = cameraInput.files[0];
        } else if (galleryInput && galleryInput.files && galleryInput.files[0]) {
            photoFile = galleryInput.files[0];
        }

        if (photoFile) {
            try {
                data.photoUrl = await uploadFileToStorage(photoFile, prefix);
            } catch (uploadErr) {
                console.warn('⚠️ Photo upload failed (Storage may not be configured yet). Submitting without photo.', uploadErr.message);
                data.photoUrl = null;
            }
        }
        
        const audioEl = document.getElementById(`${prefix}-audio-preview`);
        if (audioEl && audioEl._blob) {
            try {
                data.voiceUrl = await uploadFileToStorage(audioEl._blob, prefix);
            } catch (uploadErr) {
                console.warn('⚠️ Voice upload failed (Storage may not be configured yet). Submitting without voice note.', uploadErr.message);
                data.voiceUrl = null;
            }
        }
    }

    // Add timestamps and default status
    data.createdAt = fb.serverTimestamp();
    data.updatedAt = fb.serverTimestamp();
    data.status = 'new';
    data.assignedTo = null;

    await fb.addDoc(fb.collection(db, collectionName), data);
    console.log('Saved to Firestore:', collectionName, data);
}

async function uploadFileToStorage(fileOrBlob, prefix) {
    // ── Cloudinary unsigned upload (no Firebase Storage required) ──
    const CLOUD_NAME   = 'dofphhum5';
    const UPLOAD_PRESET = 'ucfof5kx';

    // Determine resource type: audio files go to 'video' endpoint on Cloudinary
    const isAudio = fileOrBlob.type && fileOrBlob.type.includes('audio');
    const resourceType = isAudio ? 'video' : 'image';
    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

    const formData = new FormData();
    formData.append('file', fileOrBlob);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', 'nexus-enquiries');
    formData.append('public_id', `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);

    // 30-second timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });
        clearTimeout(timer);

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Cloudinary upload failed (${response.status}): ${errText}`);
        }

        const result = await response.json();
        console.log('✅ Uploaded to Cloudinary:', result.secure_url);
        return result.secure_url;

    } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
            throw new Error('Upload timed out after 30s');
        }
        throw err;
    }
}

// ============================================================
// 16. SUCCESS TOAST
// ============================================================
function showSuccessToast() {
    const toast = document.getElementById('success-toast');
    if (!toast) return;

    toast.classList.remove('hidden');
    toast.offsetHeight; // Force reflow
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 400);
    }, 3500);
}

// ============================================================
// 17. WHATSAPP WIZARD
// ============================================================
let currentWizardStep = 1;
const wizardSelections = { machine: '', service: '' };

function openWaWizard(event) {
    event.preventDefault();
    const overlay       = document.getElementById('wa-overlay');
    const wizardContent = document.getElementById('wa-wizard-content');

    document.querySelectorAll('.wa-step').forEach(step => step.classList.remove('active'));
    document.getElementById('wa-step-1').classList.add('active');
    currentWizardStep = 1;

    overlay.classList.add('active');
    setTimeout(() => wizardContent.classList.add('active'), 400);
}

function closeWaWizard() {
    const overlay       = document.getElementById('wa-overlay');
    const wizardContent = document.getElementById('wa-wizard-content');

    wizardContent.classList.remove('active');
    setTimeout(() => overlay.classList.remove('active'), 300);
}

function selectMachine(machineName) {
    // SECURITY: Values come from our own buttons but sanitize anyway
    wizardSelections.machine = sanitizeText(machineName, 50);
    nextWaStep(2);
}

function selectService(serviceName) {
    wizardSelections.service = sanitizeText(serviceName, 50);
    nextWaStep(3);
}

function skipWizard() {
    const defaultText = encodeURIComponent('Hello Nexus Machinery, I need assistance with an industrial machine. Please contact me.');
    window.open(`https://wa.me/919109190790?text=${defaultText}`, '_blank');
    closeWaWizard();
}

function nextWaStep(stepNumber) {
    document.getElementById(`wa-step-${currentWizardStep}`).classList.remove('active');
    currentWizardStep = stepNumber;

    if (stepNumber === 3) {
        const finalMsgElem = document.getElementById('wa-final-message');

        // SECURITY FIX: Was using innerHTML with wizard selections (XSS vulnerability).
        // Now using createElement + textContent — safe even if selections were injected.
        finalMsgElem.innerHTML = '';

        const line1 = document.createElement('p');
        line1.textContent = `We have experts available for your ${wizardSelections.machine}.`;
        line1.style.marginBottom = '0.5rem';

        const line2 = document.createElement('p');
        line2.textContent = `Service required: ${wizardSelections.service}.`;
        line2.style.marginBottom = '0.5rem';

        const line3 = document.createElement('p');
        line3.textContent = 'Click below to send us this info on WhatsApp so we can assist you immediately.';
        line3.style.color = '#AAA';
        line3.style.fontSize = '0.9rem';

        finalMsgElem.appendChild(line1);
        finalMsgElem.appendChild(line2);
        finalMsgElem.appendChild(line3);

        // SECURITY: WhatsApp URL — encodeURIComponent prevents injection into the URL
        const customText = encodeURIComponent(
            `Hello Nexus Machinery, I need ${wizardSelections.service} service for my ${wizardSelections.machine}. Please assist me.`
        );
        const finalBtn  = document.getElementById('wa-final-btn');
        finalBtn.href   = `https://wa.me/919109190790?text=${customText}`;
    }

    document.getElementById(`wa-step-${stepNumber}`).classList.add('active');
}

// ============================================================
// 18. KEYBOARD NAVIGATION
// ============================================================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeWaWizard();
        closeProductModal();
        closeMapModal();
        const menuOverlay = document.getElementById('global-menu-overlay');
        if (menuOverlay && menuOverlay.classList.contains('active')) {
            toggleGlobalMenu();
        }
    }
});

// ============================================================
// 19. GOOGLE MAP-LIKE PIN SELECTOR (LEAFLET.JS)
// ============================================================
let activeMapPrefix = '';
let leafletMap = null;
let leafletMarker = null;
let selectedLat = 22.3039; // Rajkot Lat (Default)
let selectedLng = 70.8022; // Rajkot Lng (Default)

function openMapModal(prefix) {
    activeMapPrefix = prefix;
    document.getElementById('map-modal').classList.add('active');
    document.body.style.overflow = 'hidden';

    // Initialize Leaflet Map if not done already
    if (!leafletMap) {
        // Create map centered on Rajkot
        leafletMap = L.map('location-map', {
            zoomControl: true,
            attributionControl: false
        }).setView([selectedLat, selectedLng], 13);

        // Add CartoDB Dark Matter tiles (premium dark theme matching Nexus)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 20
        }).addTo(leafletMap);

        // Custom premium red location marker using inline SVG to match Nexus branding and resolve CDN assets loading issues
        const customRedIcon = L.divIcon({
            html: `<i class="fa-solid fa-location-dot" style="font-size: 2.5rem; color: #C41221; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.6));"></i>`,
            className: 'custom-map-marker-icon',
            iconSize: [30, 42],
            iconAnchor: [15, 38]
        });

        // Create draggable marker using custom premium red icon
        leafletMarker = L.marker([selectedLat, selectedLng], {
            icon: customRedIcon,
            draggable: true
        }).addTo(leafletMap);

        // Click on map to place pin
        leafletMap.on('click', function(e) {
            const { lat, lng } = e.latlng;
            setMarkerPosition(lat, lng);
        });

        // Marker dragend listener
        leafletMarker.on('dragend', function() {
            const position = leafletMarker.getLatLng();
            setMarkerPosition(position.lat, position.lng);
        });
    } else {
        // Redraw map correctly when modal displays
        setTimeout(() => {
            leafletMap.invalidateSize();
            leafletMap.setView([selectedLat, selectedLng], 13);
            leafletMarker.setLatLng([selectedLat, selectedLng]);
        }, 200);
    }

    // Attempt to autodetect geolocation
    requestMapGeolocation();
}

function setMarkerPosition(lat, lng) {
    selectedLat = lat;
    selectedLng = lng;
    if (leafletMarker) {
        leafletMarker.setLatLng([lat, lng]);
    }
}

function closeMapModal() {
    document.getElementById('map-modal').classList.remove('active');
    document.body.style.overflow = '';
    document.getElementById('map-search-input').value = '';
    hideMapSuggestions();
}

function requestMapGeolocation() {
    const locateBtn = document.getElementById('map-locate-btn');
    const originalHTML = locateBtn ? locateBtn.innerHTML : '';
    if (locateBtn) {
        locateBtn.disabled = true;
        locateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Locating...';
    }

    if (navigator.geolocation) {
        // Try high accuracy first (GPS level accuracy)
        navigator.geolocation.getCurrentPosition(
            (position) => {
                handleGeoSuccess(position, locateBtn, originalHTML);
            },
            (err) => {
                console.warn('High accuracy geolocation failed/timed out, trying low accuracy...', err);
                // Fallback to low accuracy (resolves instantly using IP/Wi-Fi)
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        handleGeoSuccess(position, locateBtn, originalHTML);
                    },
                    (lowErr) => {
                        handleGeoError(lowErr, locateBtn, originalHTML);
                    },
                    { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
                );
            },
            { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
        );
    } else {
        showMapToast("Geolocation is not supported by your browser.");
        if (locateBtn) {
            locateBtn.disabled = false;
            locateBtn.innerHTML = originalHTML;
        }
    }
}

function handleGeoSuccess(position, locateBtn, originalHTML) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    setMarkerPosition(lat, lng);
    if (leafletMap) {
        leafletMap.setView([lat, lng], 15);
    }
    if (locateBtn) {
        locateBtn.disabled = false;
        locateBtn.innerHTML = originalHTML;
    }
    showMapToast("Location updated successfully!");
}

function handleGeoError(err, locateBtn, originalHTML) {
    console.warn('Geolocation failed:', err);
    if (locateBtn) {
        locateBtn.disabled = false;
        locateBtn.innerHTML = originalHTML;
    }
    
    let msg = "Could not retrieve location. Please search manually.";
    if (err.code === 1) { // PERMISSION_DENIED
        msg = "Location access denied. Please enable permissions in browser.";
    } else if (err.code === 3) { // TIMEOUT
        msg = "Location query timed out. Please try again or search manually.";
    }
    showMapToast(msg);
}

// Map modal toast notification helper
function showMapToast(message) {
    const toast = document.getElementById('map-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.style.opacity = '1';
    
    clearTimeout(window.mapToastTimer);
    window.mapToastTimer = setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 300);
    }, 4500);
}

// Proximity helpers for searching
function getDistance(lat1, lon1, lat2, lon2) {
    const dLat = lat1 - lat2;
    const dLon = lon1 - lon2;
    return dLat * dLat + dLon * dLon;
}

function getDynamicViewbox() {
    // Bounding box +/- 1.5 degrees around current marker location
    const left = selectedLng - 1.5;
    const right = selectedLng + 1.5;
    const top = selectedLat + 1.5;
    const bottom = selectedLat - 1.5;
    return `${left.toFixed(4)},${top.toFixed(4)},${right.toFixed(4)},${bottom.toFixed(4)}`;
}

async function searchMapAddress() {
    const queryInput = document.getElementById('map-search-input');
    const query = queryInput.value.trim();
    if (!query) return;

    const searchBtn = document.querySelector('.map-search-group button');
    const originalHTML = searchBtn.innerHTML;
    searchBtn.disabled = true;
    searchBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Searching';
    hideMapSuggestions();

    try {
        // 1. Try search with dynamic viewbox bias (focusing +/- 1.5 deg around current location)
        const viewbox = getDynamicViewbox();
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&countrycodes=in&viewbox=${viewbox}&bounded=0`;
        const res = await fetch(url);
        const results = await res.json();

        if (results && results.length > 0) {
            // Sort by proximity
            results.sort((a, b) => {
                const distA = getDistance(parseFloat(a.lat), parseFloat(a.lon), selectedLat, selectedLng);
                const distB = getDistance(parseFloat(b.lat), parseFloat(b.lon), selectedLat, selectedLng);
                return distA - distB;
            });

            const lat = parseFloat(results[0].lat);
            const lon = parseFloat(results[0].lon);
            setMarkerPosition(lat, lon);
            if (leafletMap) {
                leafletMap.setView([lat, lon], 15);
            }
            return;
        }

        // 2. Fallback: try to extract a city name in Gujarat to center
        const gujaratCities = ['vadodara', 'baroda', 'ahmedabad', 'rajkot', 'surat', 'gandhinagar', 'jamnagar', 'bhavnagar', 'junagadh', 'anand', 'nadiad', 'morbi', 'mehsana', 'bhuj', 'navsari', 'valsad', 'vapi', 'bharuch', 'ankleshwar'];
        let fallbackQuery = '';
        const words = query.toLowerCase().split(/\s+/);
        
        for (const city of gujaratCities) {
            if (words.includes(city)) {
                fallbackQuery = city;
                break;
            }
        }

        // If no known city keyword, try using the last 2 words of the query
        if (!fallbackQuery && words.length > 1) {
            fallbackQuery = words.slice(-2).join(' ');
        }

        if (fallbackQuery && fallbackQuery !== query.toLowerCase()) {
            const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallbackQuery)}&limit=1&countrycodes=in&viewbox=${viewbox}&bounded=0`;
            const fallbackRes = await fetch(fallbackUrl);
            const fallbackResults = await fallbackRes.json();

            if (fallbackResults && fallbackResults.length > 0) {
                const lat = parseFloat(fallbackResults[0].lat);
                const lon = parseFloat(fallbackResults[0].lon);
                setMarkerPosition(lat, lon);
                if (leafletMap) {
                    leafletMap.setView([lat, lon], 14);
                }
                
                showMapToast(`Could not find exact landmark. Centered map on "${fallbackQuery}". Please drag the pin.`);
                return;
            }
        }

        showMapToast('Location not found. Please search for a broader town/area name.');
    } catch (err) {
        console.error('Nominatim Search error:', err);
        showMapToast('Search failed. Please check your network connection.');
    } finally {
        searchBtn.disabled = false;
        searchBtn.innerHTML = originalHTML;
    }
}

async function confirmMapLocation() {
    const confirmBtn = document.getElementById('confirm-map-btn');
    const originalHTML = confirmBtn.innerHTML;
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = 'Confirming...';

    try {
        // Set values in inputs
        const latInput = document.getElementById(`${activeMapPrefix}-latitude`);
        const lngInput = document.getElementById(`${activeMapPrefix}-longitude`);
        if (latInput) latInput.value = selectedLat;
        if (lngInput) lngInput.value = selectedLng;

        // Perform reverse geocoding to retrieve address name
        let reverseAddress = `${selectedLat.toFixed(6)}, ${selectedLng.toFixed(6)}`;
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${selectedLat}&lon=${selectedLng}&zoom=18`);
            const data = await res.json();
            if (data && data.display_name) {
                reverseAddress = data.display_name;
            }
        } catch (revErr) {
            console.warn('Reverse geocoding error:', revErr);
        }

        const locationInput = document.getElementById(`${activeMapPrefix}-location`);
        if (locationInput) {
            locationInput.value = reverseAddress;
        }

        closeMapModal();
    } catch (err) {
        console.error('Confirm map location failed:', err);
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalHTML;
    }
}

// ============================================================
// 20. REAL-TIME SEARCH AUTO-COMPLETE SUGGESTIONS
// ============================================================
let searchDebounceTimer = null;
let autocompleteAbortController = null;

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('map-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearTimeout(searchDebounceTimer);
            
            if (query.length < 3) {
                hideMapSuggestions();
                return;
            }

            searchDebounceTimer = setTimeout(() => {
                fetchMapSuggestions(query);
            }, 350); // 350ms Debounce
        });
    }

    // Hide suggestions dropdown if clicked outside search group
    document.addEventListener('click', (e) => {
        const suggestions = document.getElementById('map-suggestions');
        const searchInput = document.getElementById('map-search-input');
        if (suggestions && !suggestions.contains(e.target) && e.target !== searchInput) {
            hideMapSuggestions();
        }
    });
});

async function fetchMapSuggestions(query) {
    const suggestionsContainer = document.getElementById('map-suggestions');
    if (!suggestionsContainer) return;

    if (autocompleteAbortController) {
        autocompleteAbortController.abort();
    }
    autocompleteAbortController = new AbortController();
    const signal = autocompleteAbortController.signal;

    try {
        const viewbox = getDynamicViewbox();
        // Request up to 15 results so we have enough candidate matches to sort by proximity
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=15&countrycodes=in&viewbox=${viewbox}&bounded=0`, { signal });
        const data = await res.json();
        
        if (data && data.length > 0) {
            // Sort results by proximity to current selectedLat/selectedLng
            data.sort((a, b) => {
                const distA = getDistance(parseFloat(a.lat), parseFloat(a.lon), selectedLat, selectedLng);
                const distB = getDistance(parseFloat(b.lat), parseFloat(b.lon), selectedLat, selectedLng);
                return distA - distB;
            });

            // Display top 8 closest suggestions
            const topResults = data.slice(0, 8);

            suggestionsContainer.innerHTML = '';
            topResults.forEach(item => {
                const parts = item.display_name.split(',');
                const mainText = parts.slice(0, 2).join(',').trim();
                const subText = parts.slice(2).join(',').trim();

                const div = document.createElement('div');
                div.className = 'suggestion-item';

                const mainSpan = document.createElement('span');
                mainSpan.className = 'suggestion-main';
                mainSpan.textContent = mainText;

                const subSpan = document.createElement('span');
                subSpan.className = 'suggestion-sub';
                subSpan.textContent = subText ? `, ${subText}` : '';

                div.appendChild(mainSpan);
                if (subText) {
                    div.appendChild(document.createElement('br'));
                    div.appendChild(subSpan);
                }
                
                div.addEventListener('click', () => {
                    const lat = parseFloat(item.lat);
                    const lon = parseFloat(item.lon);
                    setMarkerPosition(lat, lon);
                    if (leafletMap) {
                        leafletMap.setView([lat, lon], 15);
                    }
                    const searchInput = document.getElementById('map-search-input');
                    if (searchInput) searchInput.value = item.display_name;
                    hideMapSuggestions();
                });
                suggestionsContainer.appendChild(div);
            });
            suggestionsContainer.classList.remove('hidden');
        } else {
            hideMapSuggestions();
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Failed to fetch autocomplete suggestions:', err);
        }
    }
}

function hideMapSuggestions() {
    const suggestionsContainer = document.getElementById('map-suggestions');
    if (suggestionsContainer) {
        suggestionsContainer.classList.add('hidden');
    }
}

// ============================================================
// 21. PHOTO SOURCE PICKER MODAL (CAMERA VS GALLERY)
// ============================================================
let activePhotoPrefix = '';

function openPhotoSourceModal(prefix) {
    activePhotoPrefix = prefix;
    document.getElementById('photo-source-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closePhotoSourceModal() {
    document.getElementById('photo-source-modal').classList.remove('active');
    document.body.style.overflow = '';
    activePhotoPrefix = '';
}

function triggerPhotoCapture(sourceType) {
    const prefix = activePhotoPrefix;
    closePhotoSourceModal();
    const inputId = `${prefix}-photo-${sourceType}`;
    const fileInput = document.getElementById(inputId);
    if (fileInput) {
        fileInput.click();
    }
}
