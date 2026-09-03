import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { BounceSetupCandidate } from '../lib/bounceSetup';
import { BounceSetupCard } from './BounceSetupCard';
import { colors, radius, spacing } from '../constants/theme';

export function BounceSetupList({ candidates, names }: { candidates: BounceSetupCandidate[]; names: Record<string, string> }) {
  if (candidates.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="moon-outline" size={18} color={colors.textDim} />
        <Text style={styles.emptyText}>Nothing here right now.</Text>
      </View>
    );
  }

  return (
    <View>
      {candidates.map((c) => (
        <BounceSetupCard key={c.symbol} candidate={c} name={names[c.symbol] ?? ''} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    padding: 24,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyText: {
    color: colors.textDim,
    fontSize: 12,
  },
});
