// ============================================================
// NEXUS MACHINERY — PUSH NOTIFICATION REGISTRATION
// Registers device for Expo push notifications (FCM via Expo)
// ============================================================

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { Platform } from 'react-native';

// Configure notification presentation (foreground behavior)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions and register the device token.
 * Stores the token in Firestore for FCM targeting.
 * Returns the push token string, or null if permission denied.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Only physical devices can receive push notifications
  if (!Device.isDevice) {
    console.log('[Notifications] Skipping — not a physical device.');
    return null;
  }

  // Request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifications] Permission not granted.');
    return null;
  }

  // Get Expo push token (works via Expo's FCM proxy)
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn('[Notifications] No EAS project ID found. Token registration skipped.');
    return null;
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  // Android: create notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('nexus-enquiries', {
      name: 'Nexus Enquiry Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#C41221',
    });
  }

  // Store token in Firestore
  try {
    await addDoc(collection(db, 'fcm_tokens'), {
      token,
      platform: Platform.OS,
      registeredAt: serverTimestamp(),
      active: true,
    });
    console.log('[Notifications] Token registered:', token);
  } catch (err) {
    console.warn('[Notifications] Failed to store token:', err);
  }

  return token;
}
