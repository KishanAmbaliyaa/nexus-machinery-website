document.addEventListener('DOMContentLoaded', () => {
    // 1. Trust Signals Scroll Animation
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Animate only once
            }
        });
    }, observerOptions);

    document.querySelectorAll('.trust-item').forEach((item, index) => {
        // Add staggered delay based on index
        item.style.transitionDelay = `${index * 0.15}s`;
        observer.observe(item);
    });
});

// Card Toggle Accordion
function toggleCard(element) {
    const isActive = element.classList.contains('active');
    
    // Close all other cards
    document.querySelectorAll('.card-large.active, .card-small.active').forEach(card => {
        card.classList.remove('active');
    });

    // Toggle current card
    if (!isActive) {
        element.classList.add('active');
    }
}

// WhatsApp Wizard Logic
let currentWizardStep = 1;
const wizardSelections = {
    machine: '',
    service: ''
};

function openWaWizard(event) {
    event.preventDefault();
    const overlay = document.getElementById('wa-overlay');
    const wizardContent = document.getElementById('wa-wizard-content');
    
    // Reset steps
    document.querySelectorAll('.wa-step').forEach(step => step.classList.remove('active'));
    document.getElementById('wa-step-1').classList.add('active');
    currentWizardStep = 1;
    
    overlay.classList.add('active');
    
    // Add small delay for content to fade in after circle expands
    setTimeout(() => {
        wizardContent.classList.add('active');
    }, 400);
}

function closeWaWizard() {
    const overlay = document.getElementById('wa-overlay');
    const wizardContent = document.getElementById('wa-wizard-content');
    
    wizardContent.classList.remove('active');
    setTimeout(() => {
        overlay.classList.remove('active');
    }, 300);
}

function selectMachine(machineName) {
    wizardSelections.machine = machineName;
    nextStep(2);
}

function selectService(serviceName) {
    wizardSelections.service = serviceName;
    nextStep(3);
}

function skipWizard() {
    // User chose "Direct Contact"
    const defaultText = encodeURIComponent("Hello Nexus Machinery, I have a machine breakdown and need fast service.");
    window.open(`https://wa.me/919109190790?text=${defaultText}`, '_blank');
    closeWaWizard();
}

function nextStep(stepNumber) {
    document.getElementById(`wa-step-${currentWizardStep}`).classList.remove('active');
    currentWizardStep = stepNumber;
    
    if (stepNumber === 3) {
        // Build final message
        const finalMsgElem = document.getElementById('wa-final-message');
        finalMsgElem.innerHTML = `We have experts available for your <strong>${wizardSelections.machine}</strong>.<br>Service required: <strong>${wizardSelections.service}</strong>.<br><br>Click below to send us this info on WhatsApp so we can assist you immediately.`;
        
        const customText = encodeURIComponent(`Hello Nexus Machinery, I need ${wizardSelections.service} service for my ${wizardSelections.machine}. Please assist me.`);
        const finalBtn = document.getElementById('wa-final-btn');
        finalBtn.href = `https://wa.me/919109190790?text=${customText}`;
    }
    
    document.getElementById(`wa-step-${stepNumber}`).classList.add('active');
}

// Global Header Menu Toggle
function toggleGlobalMenu() {
    const hamburger = document.querySelector('.hamburger');
    const overlay = document.getElementById('global-menu-overlay');
    
    hamburger.classList.toggle('active');
    overlay.classList.toggle('active');
}

// Product Showcase Slideshow Logic
const showcaseSlides = [
    {
        title: "CNC MACHINE SERVICE",
        desc: "Comprehensive diagnostic and repair services. Restoring precision and minimizing downtime for your production lines.",
        image: "Images/CNC.png"
    },
    {
        title: "VMC MACHINE SERVICE",
        desc: "Expert vertical machining center maintenance. From spindle repairs to axis alignment, we keep your VMCs operating at peak performance.",
        image: "Images/VMC.png"
    },
    {
        title: "HMC MACHINE SERVICE",
        desc: "Horizontal machining center solutions tailored for complex industrial needs. We troubleshoot mechanical and electronic issues rapidly.",
        image: "Images/HMC.png"
    },
    {
        title: "VTL MACHINE SERVICE",
        desc: "Specialized vertical turret lathe services. We handle heavy-duty turning machine repairs, ensuring stability and accuracy.",
        image: "Images/VTL.png"
    },
    {
        title: "DOUBLE COLUMN MACHINE",
        desc: "Large-scale double column machine servicing. Our experts manage complex geometry alignments and heavy mechanics safely.",
        image: "Images/DOUBLE%20COLUMN.png"
    }
];

let currentSlideIndex = 0;

function rotateShowcase() {
    const imgEl = document.getElementById('showcase-img');
    const titleEl = document.getElementById('showcase-title');
    const descEl = document.getElementById('showcase-desc');
    
    if(!imgEl || !titleEl || !descEl) return;

    const elements = [imgEl, titleEl, descEl];
    
    // Fade out
    elements.forEach(el => el.classList.remove('active'));
    
    setTimeout(() => {
        // Move to next slide
        currentSlideIndex = (currentSlideIndex + 1) % showcaseSlides.length;
        const nextSlide = showcaseSlides[currentSlideIndex];
        
        // Update content
        imgEl.src = nextSlide.image;
        titleEl.textContent = nextSlide.title;
        descEl.textContent = nextSlide.desc;
        
        // Fade in
        elements.forEach(el => el.classList.add('active'));
    }, 600); // Matches the CSS transition duration
}

// Initialize slider interval
document.addEventListener('DOMContentLoaded', () => {
    setInterval(rotateShowcase, 3600);
});

// ============================================================
// BOOKING SYSTEM LOGIC
// ============================================================
function handleBookingSubmit(event) {
    event.preventDefault(); // Prevent page reload

    // Gather form data
    const machineType = document.getElementById('machine-type').value;
    const serviceType = document.getElementById('service-type').value;
    const bookingDate = document.getElementById('booking-date').value;
    const bookingTime = document.getElementById('booking-time').value;
    const issueDesc = document.getElementById('issue-desc').value;
    const customerName = document.getElementById('customer-name').value;
    const customerPhone = document.getElementById('customer-phone').value;
    const customerAddress = document.getElementById('customer-address').value;

    // Validate (basic HTML5 validation should catch empty required fields, but just in case)
    if (!machineType || !serviceType || !bookingDate || !bookingTime || !customerName || !customerPhone || !customerAddress) {
        alert("Please fill in all required fields.");
        return;
    }

    // In a real app, we would send this data to a backend API/Database here.
    // For now (Demo), we just show the success modal with the data.

    const summaryDetails = `
        <p><strong>Name:</strong> ${customerName}</p>
        <p><strong>Machine:</strong> ${machineType}</p>
        <p><strong>Service:</strong> ${serviceType}</p>
        <p><strong>Date & Time:</strong> ${bookingDate} | ${bookingTime}</p>
    `;

    document.getElementById('booking-summary-details').innerHTML = summaryDetails;
    
    // Show Modal
    document.getElementById('booking-success-modal').classList.add('active');

    // Reset Form
    document.getElementById('service-booking-form').reset();
}

function closeBookingModal() {
    document.getElementById('booking-success-modal').classList.remove('active');
}
