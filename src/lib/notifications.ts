import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { ScanResult } from './types';
import { buildSignalNotificationBody, buildWeeklyDigestBody, computeNewSignals } from './notificationContent';

const SUNDAY_DIGEST_ID = 'weekly-channel-alert';
const SUNDAY_HOUR = 20; // 8pm local time
const SUNDAY_MINUTE = 0;

const MONDAY_DIGEST_ID = 'monday-morning-digest';
const MONDAY_HOUR = 8; // 8am local time
const MONDAY_MINUTE = 0;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

/**
 * expo-notifications ships no real web implementation — its "web" module
 * is a stub (no scheduleNotificationAsync at all), so every native call in
 * this file silently no-ops in a browser. Web has to go through the
 * browser's own Notification API instead. On iOS Safari that API is only
 * reachable once the site is installed via "Add to Home Screen" — a
 * regular browser tab can't get permission at all.
 */
type WebNotificationCtor = new (title: string, options?: { body?: string }) => unknown;
interface WebNotificationGlobal {
  Notification?: WebNotificationCtor & {
    permission: 'granted' | 'denied' | 'default';
    requestPermission: () => Promise<'granted' | 'denied' | 'default'>;
  };
}

function getWebNotification() {
  return (globalThis as unknown as WebNotificationGlobal).Notification;
}

function showWebNotification(title: string, body: string): void {
  const WebNotification = getWebNotification();
  if (!WebNotification || WebNotification.permission !== 'granted') return;
  try {
    new WebNotification(title, { body });
  } catch {
    // Some browsers (notably iOS Safari outside an installed PWA) throw
    // synchronously here instead of just failing permission — never let
    // that crash the app.
  }
}

export async function requestNotificationPermission(): Promise<PermissionStatus> {
  if (Platform.OS === 'web') {
    const WebNotification = getWebNotification();
    if (!WebNotification) return 'denied';
    try {
      if (WebNotification.permission === 'granted') return 'granted';
      if (WebNotification.permission === 'denied') return 'denied';
      const result = await WebNotification.requestPermission();
      return result as PermissionStatus;
    } catch {
      return 'denied';
    }
  }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('weekly-alerts', {
        name: 'Weekly channel alerts',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === 'granted') return 'granted';

    const requested = await Notifications.requestPermissionsAsync();
    return requested.status as PermissionStatus;
  } catch {
    return 'denied';
  }
}

/**
 * Builds the "stocks in a channel" summary and (re)schedules both weekly
 * digest notifications with it (Sunday night to plan ahead, Monday morning
 * as a fresh look right as the week starts). Local notifications can't
 * recompute their content at fire time — each one only stays current if
 * the app gets opened at least once before it next fires, since that's
 * what refreshes the scheduled content. Skipped on web: recurring/
 * scheduled triggers aren't supported there the way they are on iOS/
 * Android.
 */
export async function scheduleWeeklyChannelAlert(stockResults: ScanResult[]): Promise<void> {
  if (Platform.OS === 'web') return;

  const body = buildWeeklyDigestBody(stockResults);

  await scheduleWeeklyDigest(SUNDAY_DIGEST_ID, 'Channel Scanner — weekly watchlist', body, 1, SUNDAY_HOUR, SUNDAY_MINUTE);
  await scheduleWeeklyDigest(MONDAY_DIGEST_ID, 'Channel Scanner — Monday outlook', body, 2, MONDAY_HOUR, MONDAY_MINUTE);
}

async function scheduleWeeklyDigest(
  id: string,
  title: string,
  body: string,
  weekday: number,
  hour: number,
  minute: number
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday, // Expo's WEEKLY trigger: 1 = Sunday, 2 = Monday, ...
      hour,
      minute,
    },
  }).catch(() => {});
}

/**
 * Fires an immediate local notification for any BUY/SELL signal that
 * wasn't already seen today. `seen` is a per-session dedupe set (symbol +
 * signal + date) so a 20-minute rescan doesn't re-notify the same call —
 * pass back the returned set on the next call.
 */
export async function notifyNewSignals(stockResults: ScanResult[], seen: Set<string>): Promise<Set<string>> {
  const today = new Date().toISOString().slice(0, 10);
  const { nextSeen, newBuys, newSells } = computeNewSignals(stockResults, seen, today);

  if (newBuys.length === 0 && newSells.length === 0) return nextSeen;

  const body = buildSignalNotificationBody(newBuys, newSells);

  if (Platform.OS === 'web') {
    showWebNotification('Channel Scanner — new signal', body);
    return nextSeen;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Channel Scanner — new signal',
      body,
      sound: true,
    },
    trigger: null,
  }).catch(() => {});

  return nextSeen;
}

/**
 * Fires an immediate local notification with no real signal behind it —
 * purely so you can confirm delivery is actually working on your device
 * right now instead of waiting for a real buy/sell to show up.
 */
export async function sendTestNotification(): Promise<void> {
  const body = "If you're seeing this, notifications are working correctly.";

  if (Platform.OS === 'web') {
    showWebNotification('Channel Scanner — test notification', body);
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Channel Scanner — test notification',
      body,
      sound: true,
    },
    trigger: null,
  }).catch(() => {});
}
