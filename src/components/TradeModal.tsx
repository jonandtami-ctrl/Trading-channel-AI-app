import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { cardShadow, colors, glowShadow, radius, spacing } from '../constants/theme';

interface TradeModalProps {
  visible: boolean;
  mode: 'log' | 'close';
  symbol: string;
  defaultPrice: number;
  onCancel: () => void;
  onSubmit: (price: number, quantity: number) => void;
}

export function TradeModal({ visible, mode, symbol, defaultPrice, onCancel, onSubmit }: TradeModalProps) {
  const [price, setPrice] = useState(String(defaultPrice));
  const [quantity, setQuantity] = useState('1');

  useEffect(() => {
    if (visible) {
      setPrice(String(defaultPrice));
      setQuantity('1');
    }
  }, [visible, defaultPrice]);

  const priceNum = parseFloat(price);
  const quantityNum = parseFloat(quantity);
  const valid = !isNaN(priceNum) && priceNum > 0 && (mode === 'close' || (!isNaN(quantityNum) && quantityNum > 0));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{mode === 'log' ? `Log trade — ${symbol}` : `Close trade — ${symbol}`}</Text>

          <Text style={styles.label}>{mode === 'log' ? 'Entry price' : 'Exit price'}</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.textDim}
          />

          {mode === 'log' && (
            <>
              <Text style={styles.label}>Quantity (shares/units)</Text>
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
                placeholder="1"
                placeholderTextColor={colors.textDim}
              />
            </>
          )}

          <View style={styles.row}>
            <Pressable style={[styles.button, styles.cancelButton]} onPress={onCancel}>
              <Ionicons name="close" size={15} color={colors.textDim} />
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.submitButton, !valid && styles.disabled]}
              disabled={!valid}
              onPress={() => onSubmit(priceNum, mode === 'log' ? quantityNum : 0)}
            >
              <Ionicons name="checkmark" size={15} color="#fff" />
              <Text style={styles.submitText}>{mode === 'log' ? 'Log Trade' : 'Close Trade'}</Text>
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
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
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
