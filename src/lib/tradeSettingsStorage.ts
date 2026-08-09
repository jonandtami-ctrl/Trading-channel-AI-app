import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'channel-scanner-trade-settings';

export interface TradeSettings {
  accountSize: number;
  riskPct: number;
}

export const DEFAULT_TRADE_SETTINGS: TradeSettings = { accountSize: 10000, riskPct: 1 };

export async function loadTradeSettings(): Promise<TradeSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TRADE_SETTINGS;
    return { ...DEFAULT_TRADE_SETTINGS, ...(JSON.parse(raw) as Partial<TradeSettings>) };
  } catch {
    return DEFAULT_TRADE_SETTINGS;
  }
}

export async function saveTradeSettings(settings: TradeSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
