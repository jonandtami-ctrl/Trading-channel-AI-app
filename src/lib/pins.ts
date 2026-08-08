import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'channel-scanner-pinned-symbols';

export async function loadPinnedSymbols(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function savePinnedSymbols(symbols: string[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
}

/** Toggles a symbol's pinned state and returns the updated list. */
export async function togglePin(symbol: string): Promise<string[]> {
  const current = await loadPinnedSymbols();
  const next = current.includes(symbol) ? current.filter((s) => s !== symbol) : [...current, symbol];
  await savePinnedSymbols(next);
  return next;
}
