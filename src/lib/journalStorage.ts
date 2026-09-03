import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { DEFAULT_USD_CAD_RATE, migrateLegacyTrades, type ChannelSnapshot, type Currency, type Position, type SetupType, type Transaction } from './position';
import { transactionsToCsv, closedTradesToCsv, yearlyTaxSummaryToCsv } from './journalCsv';
import type { Trade } from './journal';

const POSITIONS_KEY = 'channel-scanner-positions';
// The original one-buy-one-sell record key from before the Position model
// existed. Never written to again, and deliberately never deleted here —
// it's the safety net if the migration below ever needs to be re-run or
// inspected.
const LEGACY_TRADES_KEY = 'channel-scanner-trades';

let idCounter = 0;
function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

async function readPositionsRaw(): Promise<Position[] | null> {
  try {
    const raw = await AsyncStorage.getItem(POSITIONS_KEY);
    return raw ? (JSON.parse(raw) as Position[]) : null;
  } catch {
    return null;
  }
}

async function savePositions(positions: Position[]): Promise<void> {
  await AsyncStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
}

/**
 * Loads the journal, migrating once from the old flat Trade[] record the
 * very first time there's no Position data yet but legacy trades exist —
 * nothing about existing journal history is ever discarded (see item Q).
 * After the first migration, positions are saved under the new key and
 * this early-outs on every later call.
 */
export async function loadPositions(): Promise<Position[]> {
  const existing = await readPositionsRaw();
  if (existing) return existing;

  try {
    const raw = await AsyncStorage.getItem(LEGACY_TRADES_KEY);
    const legacyTrades = raw ? (JSON.parse(raw) as Trade[]) : [];
    if (legacyTrades.length === 0) return [];
    const migrated = migrateLegacyTrades(legacyTrades);
    await savePositions(migrated);
    return migrated;
  } catch {
    return [];
  }
}

export interface OpenPositionInput {
  symbol: string;
  name: string;
  exchange?: string;
  currency: Currency;
  price: number;
  shares: number;
  fee?: number;
  fxRate?: number;
  dateIso?: string;
  stopPrice?: number | null;
  targetPrice?: number | null;
  setupType?: SetupType;
  notes?: string;
  tags?: string[];
  channelSnapshot?: ChannelSnapshot | null;
}

/** Opens a brand-new position with its first buy transaction. */
export async function openPosition(input: OpenPositionInput): Promise<Position[]> {
  const positions = await loadPositions();
  const fxRate = input.fxRate ?? (input.currency === 'CAD' ? 1 : DEFAULT_USD_CAD_RATE);
  const transaction: Transaction = {
    id: newId('txn'),
    type: 'buy',
    date: input.dateIso ?? new Date().toISOString(),
    price: input.price,
    shares: input.shares,
    fee: input.fee ?? 0,
    fxRate,
  };
  const position: Position = {
    id: newId('pos'),
    symbol: input.symbol,
    name: input.name,
    exchange: input.exchange,
    currency: input.currency,
    setupType: input.setupType ?? 'other',
    notes: input.notes ?? '',
    tags: input.tags ?? [],
    stopPrice: input.stopPrice ?? null,
    targetPrice: input.targetPrice ?? null,
    channelSnapshot: input.channelSnapshot ?? null,
    transactions: [transaction],
  };
  const next = [...positions, position];
  await savePositions(next);
  return next;
}

interface FillInput {
  price: number;
  shares: number;
  fee?: number;
  fxRate?: number;
  dateIso?: string;
}

/** Adds to an existing open position (item K — "adding to a position"). */
export async function addBuy(positionId: string, input: FillInput): Promise<Position[]> {
  const positions = await loadPositions();
  const target = positions.find((p) => p.id === positionId);
  const fxRate = input.fxRate ?? (target?.currency === 'CAD' ? 1 : DEFAULT_USD_CAD_RATE);
  const transaction: Transaction = {
    id: newId('txn'),
    type: 'buy',
    date: input.dateIso ?? new Date().toISOString(),
    price: input.price,
    shares: input.shares,
    fee: input.fee ?? 0,
    fxRate,
  };
  const next = positions.map((p) => (p.id === positionId ? { ...p, transactions: [...p.transactions, transaction] } : p));
  await savePositions(next);
  return next;
}

/** Sells shares out of a position — partial or full (item K). The caller decides how many shares; selling the full remaining amount is just the normal "close the trade" case. */
export async function sell(positionId: string, input: FillInput): Promise<Position[]> {
  const positions = await loadPositions();
  const target = positions.find((p) => p.id === positionId);
  const fxRate = input.fxRate ?? (target?.currency === 'CAD' ? 1 : DEFAULT_USD_CAD_RATE);
  const transaction: Transaction = {
    id: newId('txn'),
    type: 'sell',
    date: input.dateIso ?? new Date().toISOString(),
    price: input.price,
    shares: input.shares,
    fee: input.fee ?? 0,
    fxRate,
  };
  const next = positions.map((p) => (p.id === positionId ? { ...p, transactions: [...p.transactions, transaction] } : p));
  await savePositions(next);
  return next;
}

/** Edits any field on one recorded transaction — e.g. correcting an FX rate to an official CRA rate after the fact (item B), or fixing a fee/price/date mistake (item M). */
export async function editTransaction(
  positionId: string,
  transactionId: string,
  updates: Partial<Pick<Transaction, 'price' | 'shares' | 'fee' | 'fxRate' | 'date'>>
): Promise<Position[]> {
  const positions = await loadPositions();
  const next = positions.map((p) =>
    p.id === positionId
      ? { ...p, transactions: p.transactions.map((t) => (t.id === transactionId ? { ...t, ...updates } : t)) }
      : p
  );
  await savePositions(next);
  return next;
}

/** Edits a position's own fields (stop/target/setup type/notes/tags) — the transactions themselves are untouched. */
export async function updatePositionDetails(
  positionId: string,
  updates: Partial<Pick<Position, 'stopPrice' | 'targetPrice' | 'setupType' | 'notes' | 'tags'>>
): Promise<Position[]> {
  const positions = await loadPositions();
  const next = positions.map((p) => (p.id === positionId ? { ...p, ...updates } : p));
  await savePositions(next);
  return next;
}

export async function deletePosition(positionId: string): Promise<Position[]> {
  const positions = await loadPositions();
  const next = positions.filter((p) => p.id !== positionId);
  await savePositions(next);
  return next;
}

/** Deletes a single transaction from a position (e.g. undoing a mis-entered fill). Deletes the whole position if that was its only transaction. */
export async function deleteTransaction(positionId: string, transactionId: string): Promise<Position[]> {
  const positions = await loadPositions();
  const target = positions.find((p) => p.id === positionId);
  if (!target) return positions;
  const remaining = target.transactions.filter((t) => t.id !== transactionId);
  const next =
    remaining.length === 0
      ? positions.filter((p) => p.id !== positionId)
      : positions.map((p) => (p.id === positionId ? { ...p, transactions: remaining } : p));
  await savePositions(next);
  return next;
}

// --- Export / backup ---------------------------------------------------

/** Writes text to a file and opens the native share sheet (or triggers a browser download on web). */
async function shareTextFile(content: string, filename: string, mimeType: string): Promise<void> {
  if (Platform.OS === 'web') {
    downloadOnWeb(content, filename, mimeType);
    return;
  }
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(content);
  const available = await Sharing.isAvailableAsync();
  if (available) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: 'Export Trade Journal' });
  }
}

function downloadOnWeb(content: string, filename: string, mimeType: string): void {
  const g = globalThis as unknown as {
    Blob: new (parts: string[], options: { type: string }) => unknown;
    URL: { createObjectURL: (b: unknown) => string; revokeObjectURL: (u: string) => void };
    document: {
      createElement: (tag: string) => { href: string; download: string; click: () => void };
      body: { appendChild: (el: unknown) => void; removeChild: (el: unknown) => void };
    };
  };
  const blob = new g.Blob([content], { type: mimeType });
  const url = g.URL.createObjectURL(blob);
  const link = g.document.createElement('a');
  link.href = url;
  link.download = filename;
  g.document.body.appendChild(link);
  link.click();
  g.document.body.removeChild(link);
  g.URL.revokeObjectURL(url);
}

export async function exportAllTransactionsCsv(positions: Position[]): Promise<void> {
  await shareTextFile(transactionsToCsv(positions), `trade-journal-transactions-${Date.now()}.csv`, 'text/csv');
}

export async function exportClosedTradesCsv(positions: Position[]): Promise<void> {
  await shareTextFile(closedTradesToCsv(positions), `trade-journal-closed-${Date.now()}.csv`, 'text/csv');
}

export async function exportYearlyTaxSummaryCsv(positions: Position[]): Promise<void> {
  await shareTextFile(yearlyTaxSummaryToCsv(positions), `trade-journal-tax-summary-${Date.now()}.csv`, 'text/csv');
}

/** Full backup — every position and transaction, exactly as stored, as JSON (item M). */
export async function exportBackupJson(positions: Position[]): Promise<void> {
  const content = JSON.stringify({ exportedAt: new Date().toISOString(), positions }, null, 2);
  await shareTextFile(content, `trade-journal-backup-${Date.now()}.json`, 'application/json');
}

/**
 * Restores from a backup JSON string. Merges rather than replaces — any
 * position whose id already exists locally is left untouched, so
 * importing an old backup can never silently overwrite newer trades
 * entered since that backup was made. Returns the merged list, or throws
 * if the file isn't a recognizable backup.
 */
export async function importBackupJson(json: string): Promise<Position[]> {
  const parsed = JSON.parse(json) as { positions?: Position[] };
  if (!Array.isArray(parsed.positions)) throw new Error('Not a recognized trade journal backup file.');

  const current = await loadPositions();
  const existingIds = new Set(current.map((p) => p.id));
  const toAdd = parsed.positions.filter((p) => p && typeof p.id === 'string' && !existingIds.has(p.id));
  const next = [...current, ...toAdd];
  await savePositions(next);
  return next;
}
