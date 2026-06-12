// ============================================================
// NEXUS MACHINERY — MACHINE, SERVICE & AUTOMATION DATA
// Single source of truth for all machine/service constants
// ============================================================

export const MACHINE_TYPES = [
  { id: 'turning',       label: 'Turning Machine',       icon: 'refresh-cw' },
  { id: 'vmc',           label: 'VMC',                   icon: 'cpu' },
  { id: 'hmc',           label: 'HMC',                   icon: 'settings' },
  { id: 'vtl',           label: 'VTL',                   icon: 'rotate-ccw' },
  { id: 'double-column', label: 'Double Column',          icon: 'layout' },
  { id: '5-axis',        label: '5-Axis Machine',         icon: 'box' },
  { id: 'other',         label: 'Other',                  icon: 'more-horizontal' },
] as const;

export const SUPPORT_TYPES = [
  { id: 'electrical', label: 'Electrical Support', icon: 'zap' },
  { id: 'mechanical', label: 'Mechanical Support', icon: 'tool' },
  { id: 'other',      label: 'Other',              icon: 'more-horizontal' },
] as const;

export const AUTOMATION_TYPES = [
  {
    id: 'pick-place',
    label: 'Pick & Place',
    desc: 'Automated component handling systems',
    icon: 'crosshair',
  },
  {
    id: 'robotic',
    label: 'Robotic',
    desc: 'Industrial robotic arm solutions',
    icon: 'cpu',
  },
  {
    id: 'gantry',
    label: 'Gantry',
    desc: 'Overhead rail-mounted systems',
    icon: 'maximize',
  },
  {
    id: 'other',
    label: 'Other',
    desc: 'Custom automation requirements',
    icon: 'more-horizontal',
  },
] as const;

export const HERO_SLIDES = [
  {
    id: 'breakdown',
    title: 'MACHINE BREAKDOWN SERVICE',
    desc: 'Expert diagnostic and repair services for all machine types including Turning Machines, VMC, HMC, VTL, and Double Column. Restoring precision and minimizing downtime.',
    image: require('../assets/images/cnc.png'),
    ctaLabel: 'Send Service Enquiry',
    ctaTarget: 'service' as const,
    subTab: 'breakdown' as const,
  },
  {
    id: 'part',
    title: 'MACHINE PART SERVICE',
    desc: 'High-quality replacement parts and professional repair services for spindles, turrets, live turrets, rotary cylinders, and hydraulic components.',
    image: require('../assets/images/vtl.png'),
    ctaLabel: 'Send Part Enquiry',
    ctaTarget: 'service' as const,
    subTab: 'part' as const,
  },
  {
    id: 'new-used',
    title: 'NEW & USED PRODUCT',
    desc: 'Premium CNC, VMC, HMC, and VTL machines — new and certified pre-owned. Browse our selection and enquire for pricing.',
    image: require('../assets/images/vmc.png'),
    ctaLabel: 'View Machines',
    ctaTarget: 'new-product' as const,
  },
  {
    id: 'automation',
    title: 'AUTOMATION SOLUTION',
    desc: 'Complete industrial automation systems — Pick & Place, Robotic arm integration, and Gantry systems customized for your production lines.',
    image: require('../assets/images/hmc.png'),
    ctaLabel: 'Automation Enquiry',
    ctaTarget: 'automation' as const,
  },
] as const;

// Static product listings (shown until Firestore data loads)
export const STATIC_NEW_PRODUCTS = [
  {
    id: 'cnc-new',
    name: 'CNC Turning Machine',
    type: 'Turning Machine',
    desc: 'High-precision CNC turning center designed for efficient and accurate machining of complex components.',
    image: require('../assets/images/cnc.png'),
    category: 'new' as const,
  },
  {
    id: 'vmc-new',
    name: 'VMC — Vertical Machining Center',
    type: 'VMC',
    desc: 'Advanced vertical machining center for precision milling, drilling and boring operations with high repeatability.',
    image: require('../assets/images/vmc.png'),
    category: 'new' as const,
  },
  {
    id: 'hmc-new',
    name: 'HMC — Horizontal Machining Center',
    type: 'HMC',
    desc: 'Heavy-duty horizontal machining center ideal for high-volume production and complex multi-face machining.',
    image: require('../assets/images/hmc.png'),
    category: 'new' as const,
  },
  {
    id: 'vtl-new',
    name: 'VTL — Vertical Turning Lathe',
    type: 'VTL',
    desc: 'Robust vertical turning lathe for machining large-diameter, heavy workpieces with superior stability.',
    image: require('../assets/images/vtl.png'),
    category: 'new' as const,
  },
  {
    id: 'double-col-new',
    name: 'Double Column Machining Center',
    type: 'Double Column',
    desc: 'Large-format double column machining center engineered for high rigidity and precision in heavy-duty applications.',
    image: require('../assets/images/double-column.png'),
    category: 'new' as const,
  },
];

export const STATIC_USED_PRODUCTS = [
  {
    id: 'cnc-used',
    name: 'CNC Turning Machine — Refurbished',
    type: 'Turning Machine',
    desc: 'Fully serviced and calibrated pre-owned CNC turning machine. Thoroughly inspected by our expert technicians.',
    image: require('../assets/images/cnc.png'),
    category: 'used' as const,
  },
  {
    id: 'vmc-used',
    name: 'VMC — Refurbished & Inspected',
    type: 'VMC',
    desc: 'Spindle rebuilt and certified. All axes calibrated. Excellent working condition at a competitive price.',
    image: require('../assets/images/vmc.png'),
    category: 'used' as const,
  },
  {
    id: 'vtl-used',
    name: 'VTL — Inspected & Certified',
    type: 'VTL',
    desc: 'Reliable pre-owned vertical turning lathe. Perfect for heavy turning operations. Comes with Nexus certification.',
    image: require('../assets/images/vtl.png'),
    category: 'used' as const,
  },
];

// All services (from official brochure)
export const ALL_SERVICES = [
  {
    group: 'Machine Spindle Services',
    services: [
      {
        name: 'Belt Drive Spindle Service',
        desc: 'Expert repair and maintenance of belt drive spindles for smooth performance and long-lasting reliability.',
      },
      {
        name: 'Integrated Spindle Service',
        desc: 'Specialized repair and maintenance of integrated spindles for high precision, maximum efficiency and extended life.',
      },
    ],
  },
  {
    group: 'Turret Services',
    services: [
      {
        name: 'Turret Service',
        desc: 'Professional turret repair and maintenance for smooth and reliable operation.',
      },
      {
        name: 'Live Turret Service',
        desc: 'Expert repair and maintenance of live turrets for maximum precision, productivity and longer life.',
      },
    ],
  },
  {
    group: 'Hydraulic / Cylinder Services',
    services: [
      {
        name: 'Rotary Cylinder Service',
        desc: 'Expert repair and maintenance of rotary cylinders to ensure smooth rotation, high precision and long service life.',
      },
      {
        name: 'Hydraulic Cylinder Service',
        desc: 'Professional repair and maintenance of hydraulic cylinders to restore performance, prevent leaks and ensure maximum durability.',
      },
    ],
  },
  {
    group: 'Breakdown & Emergency',
    services: [
      {
        name: 'Machine Breakdown Solution',
        desc: 'Quick response and effective troubleshooting to minimize downtime and get your machines back to optimal working condition.',
      },
    ],
  },
  {
    group: 'Automation',
    services: [
      {
        name: 'Automation Services',
        desc: 'End-to-end automation solutions including design, installation, programming and integration to improve productivity, efficiency and process reliability.',
      },
    ],
  },
  {
    group: 'Head Services',
    services: [
      {
        name: 'Angle Head Service',
        desc: 'Expert repair and maintenance of angle heads to ensure high precision, smooth operation and extended life.',
      },
      {
        name: 'Angle Auto Head Service',
        desc: 'Specialized service for angle auto heads including repair, calibration and testing for accuracy, efficiency and longer machine life.',
      },
    ],
  },
  {
    group: 'ATC',
    services: [
      {
        name: 'ATC Service (Automatic Tool Changer)',
        desc: 'Professional repair and maintenance of ATC systems to ensure smooth tool changes, reduced downtime and maximum machine uptime.',
      },
    ],
  },
  {
    group: 'Retrofitting',
    services: [
      {
        name: 'Retrofitting',
        desc: 'Upgrade your machines with advanced technology for improved performance, accuracy and efficiency.',
      },
    ],
  },
  {
    group: 'General',
    services: [
      {
        name: 'All Types of Mechanical & Electrical Machinery Solutions',
        desc: 'Comprehensive mechanical and electrical solutions for all types of industrial machinery.',
      },
    ],
  },
];
