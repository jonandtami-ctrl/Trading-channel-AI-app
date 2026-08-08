import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <Ionicons name="information-circle-outline" size={compact ? 11 : 12} color={colors.textDim} />
      <Text style={[styles.text, compact && styles.textCompact]}>
        For informational purposes only — not financial advice. Trading involves risk of loss; nothing here is a
        recommendation to buy or sell.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: spacing.xs,
  },
  rowCompact: {
    marginTop: 2,
  },
  text: {
    flex: 1,
    color: colors.textDim,
    fontSize: 9,
    lineHeight: 12,
    opacity: 0.8,
  },
  textCompact: {
    fontSize: 9,
  },
});
