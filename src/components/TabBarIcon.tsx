import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../constants/theme';

export function TabBarIcon({
  focused,
  icon,
  iconFocused,
  label,
}: {
  focused: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  if (focused) {
    return (
      <View style={styles.activePill}>
        <Ionicons name={iconFocused} size={17} color={colors.bg} />
        <Text style={styles.activeLabel}>{label}</Text>
      </View>
    );
  }

  return (
    <View style={styles.inactiveWrap}>
      <Ionicons name={icon} size={20} color={colors.textDim} />
      <Text style={styles.inactiveLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.xl,
  },
  activeLabel: {
    color: colors.bg,
    fontSize: 12,
    fontWeight: '800',
  },
  inactiveWrap: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  inactiveLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '600',
  },
});
