// ============================================================
// NEXUS MACHINERY — FIRESTORE SUBMIT FUNCTIONS
// All enquiry form submissions go through these functions.
// Input data MUST be pre-sanitized by sanitizeFormData().
// ============================================================

import {
  collection,
  addDoc,
  serverTimestamp,
  DocumentReference,
} from 'firebase/firestore';
import { db } from './firebase';

// Firestore collection names (matches website + project vision)
const COLLECTIONS = {
  breakdown: 'breakdown_enquiries',
  part: 'part_enquiries',
  'service-other': 'other_service_enquiries',
  automation: 'automation_enquiries',
  other: 'general_enquiries',
  'new-product': 'new_product_enquiries',
  'used-product': 'used_product_enquiries',
} as const;

type EnquiryType = keyof typeof COLLECTIONS;

/**
 * Submit a breakdown service enquiry.
 * Data must already be sanitized.
 */
export async function submitBreakdownEnquiry(data: {
  machineType: string;
  supportType: string;
  name: string;
  phone: string;
  email: string;
  location: string;
  photoUrl?: string;
  voiceUrl?: string;
}): Promise<DocumentReference> {
  return addDoc(collection(db, COLLECTIONS.breakdown), {
    ...data,
    status: 'new',
    assignedTo: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Submit a part enquiry.
 */
export async function submitPartEnquiry(data: {
  name: string;
  phone: string;
  email: string;
  location: string;
  photoUrl?: string;
  voiceUrl?: string;
}): Promise<DocumentReference> {
  return addDoc(collection(db, COLLECTIONS.part), {
    ...data,
    status: 'new',
    assignedTo: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Submit an "other service" enquiry.
 */
export async function submitOtherServiceEnquiry(data: {
  name: string;
  phone: string;
  email: string;
  location: string;
  photoUrl?: string;
  voiceUrl?: string;
}): Promise<DocumentReference> {
  return addDoc(collection(db, COLLECTIONS['service-other']), {
    ...data,
    status: 'new',
    assignedTo: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Submit a new or used product enquiry.
 */
export async function submitProductEnquiry(data: {
  category: 'new' | 'used';
  productName: string;
  name: string;
  company: string;
  phone: string;
  email: string;
}): Promise<DocumentReference> {
  const col = data.category === 'new'
    ? COLLECTIONS['new-product']
    : COLLECTIONS['used-product'];

  return addDoc(collection(db, col), {
    ...data,
    status: 'new',
    assignedTo: null,
    createdAt: serverTimestamp(),
  });
}

/**
 * Submit an automation enquiry.
 */
export async function submitAutomationEnquiry(data: {
  automationType: string;
  name: string;
  company: string;
  phone: string;
  email: string;
}): Promise<DocumentReference> {
  return addDoc(collection(db, COLLECTIONS.automation), {
    ...data,
    status: 'new',
    assignedTo: null,
    createdAt: serverTimestamp(),
  });
}

/**
 * Submit a general enquiry.
 */
export async function submitGeneralEnquiry(data: {
  name: string;
  phone: string;
  email: string;
  message: string;
}): Promise<DocumentReference> {
  return addDoc(collection(db, COLLECTIONS.other), {
    ...data,
    status: 'new',
    createdAt: serverTimestamp(),
  });
}
