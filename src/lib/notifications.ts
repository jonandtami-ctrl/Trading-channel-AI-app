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
 * On web, notification support depends entirely on the browser (and on
 * iOS Safari, only works once the site is actually installed via "Add to
 * Home Screen" — a regular tab can't get permission at all). None of
 * that should ever crash the app, so every call here is defensive on web.
 */
export async function requestNotificationPermission(): Promise<PermissionStatus> {
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

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Channel Scanner — new signal',
      body: buildSignalNotificationBody(newBuys, newSells),
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
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Channel Scanner — test notification',
      body: "If you're seeing this, notifications are working correctly.",
      sound: true,
    },
    trigger: null,
  }).catch(() => {});
}
