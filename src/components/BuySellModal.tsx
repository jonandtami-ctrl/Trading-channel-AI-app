import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatPrice } from '../lib/format';
import { cardShadow, colors, glowShadow, radius, spacing } from '../constants/theme';

export type BuySellMode = 'open' | 'add' | 'sell';

export interface FillResult {
  price: number;
  shares: number;
  fee: number;
  dateIso: string;
  stopPrice?: number | null;
  targetPrice?: number | null;
}

interface BuySellModalProps {
  visible: boolean;
  mode: BuySellMode;
  symbol: string;
  priceKind: 'stock' | 'crypto';
  defaultPrice: number;
  /** For 'sell' — shares currently held, prefilled as the default sell amount so a plain confirm closes the whole position. */
  maxShares?: number;
  onCancel: () => void;
  onSubmit: (fill: FillResult) => void;
}

function nowDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function toIso(date: string, time: string): string | null {
  const dm = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(date.trim());
  const tm = /^(\d{1,2}):(\d{1,2})$/.exec(time.trim());
  if (!dm || !tm) return null;
  const dt = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(tm[1]), Number(tm[2]));
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

const MODE_META: Record<BuySellMode, { title: string; submitLabel: string; priceLabel: string; sharesLabel: string }> = {
  open: { title: 'Buy', submitLabel: 'Open Trade', priceLabel: 'Buy price', sharesLabel: 'Shares' },
  add: { title: 'Add to position', submitLabel: 'Add', priceLabel: 'Buy price', sharesLabel: 'Shares' },
  sell: { title: 'Sell', submitLabel: 'Sell', priceLabel: 'Sell price', sharesLabel: 'Shares sold' },
};

/**
 * The entire "10-second entry" principle lives here: only price/shares
 * (plus stop/target on a brand-new open) are ever asked for up front — the
 * ticker, company, currency, date/time, and any scanner-derived channel
 * context are already known by the caller before this modal opens.
 * Everything else (fee, an exact backfilled date/time) is one tap away
 * behind "Advanced," not in the way of the fast path.
 */
export function BuySellModal({ visible, mode, symbol, priceKind, defaultPrice, maxShares, onCancel, onSubmit }: BuySellModalProps) {
  const meta = MODE_META[mode];
  const [price, setPrice] = useState(String(defaultPrice));
  const [shares, setShares] = useState(maxShares != null ? String(maxShares) : '');
  const [stop, setStop] = useState('');
  const [target, setTarget] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [fee, setFee] = useState('0');
  const [date, setDate] = useState(nowDate());
  const [time, setTime] = useState(nowTime());

  useEffect(() => {
    if (!visible) return;
    setPrice(String(defaultPrice));
    setShares(maxShares != null ? String(maxShares) : '');
    setStop('');
    setTarget('');
    setAdvancedOpen(false);
    setFee('0');
    setDate(nowDate());
    setTime(nowTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, defaultPrice, maxShares]);

  const priceNum = parseFloat(price);
  const sharesNum = parseFloat(shares);
  const feeNum = parseFloat(fee) || 0;
  const stopNum = stop.trim() === '' ? null : parseFloat(stop);
  const targetNum = target.trim() === '' ? null : parseFloat(target);
  const dateIso = toIso(date, time);

  const sharesValid = !isNaN(sharesNum) && sharesNum > 0 && (mode !== 'sell' || maxShares == null || sharesNum <= maxShares);
  const valid = !isNaN(priceNum) && priceNum > 0 && sharesValid && dateIso !== null;

  function handleSubmit() {
    if (!valid || dateIso == null) return;
    onSubmit({
      price: priceNum,
      shares: sharesNum,
      fee: feeNum,
      dateIso,
      stopPrice: mode === 'open' ? stopNum : undefined,
      targetPrice: mode === 'open' ? targetNum : undefined,
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {meta.title} — {symbol}
          </Text>

          <Text style={styles.label}>{meta.priceLabel}</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.textDim}
          />

          <Text style={styles.label}>{meta.sharesLabel}</Text>
          <TextInput
            style={styles.input}
            value={shares}
            onChangeText={setShares}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textDim}
          />
          {mode === 'sell' && maxShares != null && (
            <Text style={styles.hint}>
              Holding {maxShares} — selling all of it closes the trade, less than that is a partial sale.
            </Text>
          )}

          {mode === 'open' && (
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Stop</Text>
                <TextInput
                  style={styles.input}
                  value={stop}
                  onChangeText={setStop}
                  keyboardType="decimal-pad"
                  placeholder="optional"
                  placeholderTextColor={colors.textDim}
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Target</Text>
                <TextInput
                  style={styles.input}
                  value={target}
                  onChangeText={setTarget}
                  keyboardType="decimal-pad"
                  placeholder="optional"
                  placeholderTextColor={colors.textDim}
                />
              </View>
            </View>
          )}

          <Pressable style={styles.advancedToggle} onPress={() => setAdvancedOpen((v) => !v)}>
            <Ionicons name={advancedOpen ? 'chevron-up' : 'chevron-down'} size={13} color={colors.textDim} />
            <Text style={styles.advancedToggleText}>Advanced</Text>
          </Pressable>

          {advancedOpen && (
            <View style={styles.advancedBox}>
              <Text style={styles.label}>Commission / fee</Text>
              <TextInput
                style={styles.input}
                value={fee}
                onChangeText={setFee}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textDim}
              />
              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.label}>Date</Text>
                  <TextInput
                    style={styles.input}
                    value={date}
                    onChangeText={setDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textDim}
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.half}>
                  <Text style={styles.label}>Time</Text>
                  <TextInput
                    style={styles.input}
                    value={time}
                    onChangeText={setTime}
                    placeholder="HH:MM"
                    placeholderTextColor={colors.textDim}
                    autoCapitalize="none"
                  />
                </View>
              </View>
            </View>
          )}

          {price.length > 0 && shares.length > 0 && !isNaN(priceNum) && !isNaN(sharesNum) && (
            <Text style={styles.totalText}>Total: {formatPrice(priceNum * sharesNum + (mode !== 'sell' ? feeNum : 0), priceKind)}</Text>
          )}

          <View style={styles.row}>
            <Pressable style={[styles.button, styles.cancelButton]} onPress={onCancel}>
              <Ionicons name="close" size={15} color={colors.textDim} />
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.submitButton, !valid && styles.disabled]} disabled={!valid} onPress={handleSubmit}>
              <Ionicons name="checkmark" size={15} color="#fff" />
              <Text style={styles.submitText}>{meta.submitLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.bgPanel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 6,
    ...cardShadow,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: spacing.sm,
  },
  hint: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 3,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    fontSize: 14,
    marginTop: 4,
  },
  half: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  advancedToggleText: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '600',
  },
  advancedBox: {
    marginTop: 4,
  },
  totalText: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: spacing.md,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.sm,
  },
  cancelButton: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: {
    color: colors.textDim,
    fontWeight: '600',
    fontSize: 13,
  },
  submitButton: {
    backgroundColor: colors.accent,
    ...glowShadow(colors.accent),
  },
  disabled: {
    opacity: 0.4,
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});
