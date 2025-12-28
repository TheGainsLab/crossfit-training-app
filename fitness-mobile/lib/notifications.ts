// fitness-mobile/lib/notifications.ts
// Push notification service for coach messaging

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Configure how notifications are displayed when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and return Expo push token
 * @returns Expo push token or null if registration failed
 */
export async function registerForPushNotifications(): Promise<string | null> {
  let token = null;

  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('Push notifications only work on physical devices');
    return null;
  }

  // Check/request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get push notification permissions');
    return null;
  }

  // Get Expo push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.error('No EAS project ID found in app config');
      return null;
    }

    token = (await Notifications.getExpoPushTokenAsync({
      projectId,
    })).data;

    console.log('✅ Push token registered:', token);
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }

  // Android-specific notification channel setup
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Coach Messages',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FE5858',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });
  }

  return token;
}

/**
 * Setup notification listeners for received and tapped notifications
 * @param onNotificationReceived Callback when notification is received while app is open
 * @param onNotificationTapped Callback when user taps a notification
 * @returns Cleanup function to remove listeners
 */
export function setupNotificationListener(
  onNotificationReceived: (notification: Notifications.Notification) => void,
  onNotificationTapped: (response: Notifications.NotificationResponse) => void
): () => void {
  // Notification received while app is open
  const receivedSubscription = Notifications.addNotificationReceivedListener(
    onNotificationReceived
  );

  // Notification tapped
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    onNotificationTapped
  );

  // Return cleanup function
  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}

/**
 * Clear badge count (call when user views messages)
 */
export async function clearBadgeCount(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}

/**
 * Set badge count to specific number
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

