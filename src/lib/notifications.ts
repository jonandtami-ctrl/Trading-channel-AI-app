import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSignal } from './scan';
import type { ScanResult } from './types';

const WEEKLY_ALERT_ID = 'weekly-channel-alert';
const SUNDAY_HOUR = 20; // 8pm local time
const SUNDAY_MINUTE = 0;

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

export async function requestNotificationPermission(): Promise<PermissionStatus> {
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
}

/**
 * Builds the "stocks in a channel" summary and (re)schedules a weekly
 * Sunday-night notification with it. Local notifications can't recompute
 * their content at fire time — this only stays current if the app gets
 * opened at least once before the next Sunday, since that's what
 * refreshes the scheduled content.
 */
export async function scheduleWeeklyChannelAlert(stockResults: ScanResult[]): Promise<void> {
  const inChannel = stockResults
    .filter((r) => r.channels.some((c) => c.status === 'active'))
    .map((r) => r.symbol);

  const body =
    inChannel.length > 0
      ? `${inChannel.slice(0, 8).join(', ')}${inChannel.length > 8 ? ` +${inChannel.length - 8} more` : ''} — bouncing in a channel right now.`
      : 'No stocks are currently sitting in a clean channel.';

  await Notifications.cancelScheduledNotificationAsync(WEEKLY_ALERT_ID).catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: WEEKLY_ALERT_ID,
    content: {
      title: 'Channel Scanner — weekly watchlist',
      body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1, // 1 = Sunday
      hour: SUNDAY_HOUR,
      minute: SUNDAY_MINUTE,
    },
  });
}

/**
 * Fires an immediate local notification for any BUY/SELL signal that
 * wasn't already seen today. `seen` is a per-session dedupe set (symbol +
 * signal + date) so a 20-minute rescan doesn't re-notify the same call —
 * pass back the returned set on the next call.
 */
export async function notifyNewSignals(stockResults: ScanResult[], seen: Set<string>): Promise<Set<string>> {
  const today = new Date().toISOString().slice(0, 10);
  const nextSeen = new Set(seen);
  const newBuys: string[] = [];
  const newSells: string[] = [];

  for (const result of stockResults) {
    const signal = getSignal(result);
    if (signal !== 'buy' && signal !== 'sell') continue;

    const key = `${result.symbol}-${signal}-${today}`;
    if (nextSeen.has(key)) continue;
    nextSeen.add(key);

    if (signal === 'buy') newBuys.push(result.symbol);
    else newSells.push(result.symbol);
  }

  if (newBuys.length === 0 && newSells.length === 0) return nextSeen;

  const parts: string[] = [];
  if (newBuys.length > 0) {
    parts.push(`BUY: ${newBuys.slice(0, 10).join(', ')}${newBuys.length > 10 ? ` +${newBuys.length - 10} more` : ''}`);
  }
  if (newSells.length > 0) {
    parts.push(`SELL: ${newSells.slice(0, 10).join(', ')}${newSells.length > 10 ? ` +${newSells.length - 10} more` : ''}`);
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Channel Scanner — new signal',
      body: parts.join('   ·   '),
      sound: true,
    },
    trigger: null,
  });

  return nextSeen;
}
