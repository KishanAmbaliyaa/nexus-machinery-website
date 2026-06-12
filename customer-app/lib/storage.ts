// ============================================================
// NEXUS MACHINERY — FIREBASE STORAGE UPLOAD HELPERS
// Handles photo and voice upload to Firebase Storage
// ============================================================

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Upload a photo file to Firebase Storage.
 * Returns the public download URL.
 *
 * Path: /enquiries/[collectionName]/[enquiryId]/photo.[ext]
 */
export async function uploadPhoto(
  uri: string,
  collectionName: string,
  enquiryId: string
): Promise<string> {
  // Fetch the file and convert to blob
  const response = await fetch(uri);
  const blob = await response.blob();

  // Determine extension from MIME type
  const mimeType = blob.type || 'image/jpeg';
  const ext = mimeToExt(mimeType);

  const storageRef = ref(
    storage,
    `enquiries/${collectionName}/${enquiryId}/photo.${ext}`
  );

  await uploadBytes(storageRef, blob, { contentType: mimeType });
  return getDownloadURL(storageRef);
}

/**
 * Upload a voice recording blob to Firebase Storage.
 * Returns the public download URL.
 *
 * Path: /enquiries/[collectionName]/[enquiryId]/voice.m4a
 */
export async function uploadVoice(
  uri: string,
  collectionName: string,
  enquiryId: string
): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();

  const storageRef = ref(
    storage,
    `enquiries/${collectionName}/${enquiryId}/voice.m4a`
  );

  await uploadBytes(storageRef, blob, { contentType: 'audio/m4a' });
  return getDownloadURL(storageRef);
}

/**
 * Upload a product image.
 * Path: /products/[productId]/image-[index].jpg
 */
export async function uploadProductImage(
  uri: string,
  productId: string,
  index: number
): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const mimeType = blob.type || 'image/jpeg';
  const ext = mimeToExt(mimeType);

  const storageRef = ref(storage, `products/${productId}/image-${index}.${ext}`);
  await uploadBytes(storageRef, blob, { contentType: mimeType });
  return getDownloadURL(storageRef);
}

function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'audio/m4a': 'm4a',
    'audio/webm': 'webm',
    'audio/mp4': 'mp4',
  };
  return map[mimeType.toLowerCase()] ?? 'bin';
}

/**
 * Validates file size (returns false if too large)
 */
export function isFileSizeValid(sizeBytes: number, maxMB = 10): boolean {
  return sizeBytes <= maxMB * 1024 * 1024;
}

/**
 * Validates image MIME type
 */
export function isImageTypeValid(mimeType: string): boolean {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
  return allowed.includes(mimeType.toLowerCase());
}
