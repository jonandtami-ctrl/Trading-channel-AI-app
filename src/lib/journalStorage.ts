import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
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

export async function logTrade(
  symbol: string,
  entryPrice: number,
  quantity: number,
  entryDate: string = new Date().toISOString()
): Promise<Trade[]> {
  const trades = await loadTrades();
  const trade: Trade = {
    id: `${symbol}-${Date.now()}`,
    symbol,
    entryDate,
    entryPrice,
    quantity,
    status: 'open',
  };
  const next = [...trades, trade];
  await saveTrades(next);
  return next;
}

export async function closeTrade(
  id: string,
  exitPrice: number,
  exitDate: string = new Date().toISOString()
): Promise<Trade[]> {
  const trades = await loadTrades();
  const next = trades.map((t) => (t.id === id ? { ...t, exitPrice, exitDate, status: 'closed' as const } : t));
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
  const filename = `channel-scanner-trades-${label}-${Date.now()}.csv`;

  if (Platform.OS === 'web') {
    downloadCsvOnWeb(csv, filename);
    return;
  }

  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(csv);

  const available = await Sharing.isAvailableAsync();
  if (available) {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export Trade Journal' });
  }
}

/** Browsers have no native share sheet — trigger a regular file download instead. */
function downloadCsvOnWeb(csv: string, filename: string): void {
  const g = globalThis as unknown as {
    Blob: new (parts: string[], options: { type: string }) => unknown;
    URL: { createObjectURL: (b: unknown) => string; revokeObjectURL: (u: string) => void };
    document: {
      createElement: (tag: string) => { href: string; download: string; click: () => void };
      body: { appendChild: (el: unknown) => void; removeChild: (el: unknown) => void };
    };
  };
  const blob = new g.Blob([csv], { type: 'text/csv' });
  const url = g.URL.createObjectURL(blob);
  const link = g.document.createElement('a');
  link.href = url;
  link.download = filename;
  g.document.body.appendChild(link);
  link.click();
  g.document.body.removeChild(link);
  g.URL.revokeObjectURL(url);
}
