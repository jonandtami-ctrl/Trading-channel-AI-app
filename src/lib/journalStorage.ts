import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { tradesToCsv, type Trade } from './journal';

const STORAGE_KEY = 'channel-scanner-trades';

export async function loadTrades(): Promise<Trade[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Trade[]) : [];
  } catch {
    return [];
  }
}

async function saveTrades(trades: Trade[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

export async function logTrade(symbol: string, entryPrice: number, quantity: number): Promise<Trade[]> {
  const trades = await loadTrades();
  const trade: Trade = {
    id: `${symbol}-${Date.now()}`,
    symbol,
    entryDate: new Date().toISOString(),
    entryPrice,
    quantity,
    status: 'open',
  };
  const next = [...trades, trade];
  await saveTrades(next);
  return next;
}

export async function closeTrade(id: string, exitPrice: number): Promise<Trade[]> {
  const trades = await loadTrades();
  const next = trades.map((t) =>
    t.id === id ? { ...t, exitPrice, exitDate: new Date().toISOString(), status: 'closed' as const } : t
  );
  await saveTrades(next);
  return next;
}

export async function deleteTrade(id: string): Promise<Trade[]> {
  const trades = await loadTrades();
  const next = trades.filter((t) => t.id !== id);
  await saveTrades(next);
  return next;
}

/** Writes the trade list to a CSV file and opens the native share sheet (Save to Files, AirDrop, Print, email, etc.). */
export async function shareTradesCsv(trades: Trade[], label = 'all'): Promise<void> {
  const csv = tradesToCsv(trades);
  const file = new File(Paths.cache, `channel-scanner-trades-${label}-${Date.now()}.csv`);
  file.create({ overwrite: true });
  file.write(csv);

  const available = await Sharing.isAvailableAsync();
  if (available) {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export Trade Journal' });
  }
}
