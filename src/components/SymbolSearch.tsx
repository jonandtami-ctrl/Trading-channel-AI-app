import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { searchSymbols } from '../lib/symbolSearch';
import { cardShadow, colors, radius, spacing } from '../constants/theme';

export function SymbolSearch() {
  const [query, setQuery] = useState('');
  const results = searchSymbols(query);

  return (
    <View style={styles.wrap}>
      <View style={styles.inputRow}>
        <Ionicons name="search" size={15} color={colors.textDim} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Look up any symbol — SHOP, AAPL, BTC…"
          placeholderTextColor={colors.textDim}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textDim} />
          </Pressable>
        )}
      </View>

      {query.length > 0 && (
        <View style={styles.results}>
          {results.length === 0 ? (
            <View>
              <Text style={styles.emptyText}>No symbol matches &quot;{query}&quot;.</Text>
              <Link href={{ pathname: '/symbol/[symbol]', params: { symbol: query.trim().toUpperCase() } }} asChild>
                <Pressable style={styles.manualRow}>
                  <View>
                    <Text style={styles.resultSymbol}>Go to {query.trim().toUpperCase()}</Text>
                    <Text style={styles.resultName}>Not in our list — try it directly, live data permitting.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
                </Pressable>
              </Link>
            </View>
          ) : (
            results.map((s) => (
              <Link key={s.symbol} href={{ pathname: '/symbol/[symbol]', params: { symbol: s.symbol } }} asChild>
                {/* A conditional "no border on the last row" array style here
                    ([styles.resultRow, isLast && styles.resultRowLast]) reliably
                    crashed the whole page on this react-native-web build — a
                    genuine framework bug, not obviously RN-web's fault or ours,
                    triggered specifically by a falsy array entry on a Pressable
                    nested inside Link's asChild. Every row keeps its border
                    instead; it just doubles up faintly against the container's
                    own border on the last row, which isn't worth the crash risk. */}
                <Pressable style={styles.resultRow}>
                  <View>
                    <Text style={styles.resultSymbol}>{s.symbol}</Text>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {s.name}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
                </Pressable>
              </Link>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 0,
  },
  results: {
    marginTop: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...cardShadow,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  resultSymbol: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  resultName: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 1,
  },
  emptyText: {
    color: colors.textDim,
    fontSize: 12,
    padding: spacing.md,
  },
});
