import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { cardShadow, colors, radius, spacing } from '../constants/theme';

const DISCLAIMER_TEXT =
  'For informational purposes only — not financial advice. Trading involves risk of loss; nothing here is a ' +
  'recommendation to buy or sell.';

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable style={[styles.button, compact && styles.buttonCompact]} onPress={() => setOpen(true)}>
        <Ionicons name="information-circle-outline" size={compact ? 12 : 13} color={colors.textDim} />
        <Text style={[styles.buttonText, compact && styles.buttonTextCompact]}>Disclaimer</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <View style={styles.cardHeader}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textDim} />
              <Text style={styles.cardTitle}>Not financial advice</Text>
            </View>
            <Text style={styles.cardText}>{DISCLAIMER_TEXT}</Text>
            <Pressable style={styles.closeButton} onPress={() => setOpen(false)}>
              <Text style={styles.closeButtonText}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: spacing.xs,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: colors.bgPanelHover,
  },
  buttonCompact: {
    marginTop: 2,
    paddingVertical: 2,
  },
  buttonText: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '600',
  },
  buttonTextCompact: {
    fontSize: 9,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(27,36,54,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...cardShadow,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  cardText: {
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 19,
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
