import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  requestNotificationPermission,
  sendTestNotification,
  type PermissionStatus,
} from '../../lib/notifications';
import { DEFAULT_TRADE_SETTINGS, loadTradeSettings, saveTradeSettings, type TradeSettings } from '../../lib/tradeSettingsStorage';
import { cardShadow, colors, radius, spacing } from '../../constants/theme';

export default function SettingsScreen() {
  const [status, setStatus] = useState<PermissionStatus | 'pending'>('pending');
  const [sent, setSent] = useState(false);
  const [tradeSettings, setTradeSettings] = useState<TradeSettings>(DEFAULT_TRADE_SETTINGS);
  const [accountSizeText, setAccountSizeText] = useState(String(DEFAULT_TRADE_SETTINGS.accountSize));
  const [riskPctText, setRiskPctText] = useState(String(DEFAULT_TRADE_SETTINGS.riskPct));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    requestNotificationPermission().then(setStatus);
    loadTradeSettings().then((s) => {
      setTradeSettings(s);
      setAccountSizeText(String(s.accountSize));
      setRiskPctText(String(s.riskPct));
    });
  }, []);

  async function handleTestNotification() {
    await sendTestNotification();
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  }

  const accountSizeNum = parseFloat(accountSizeText);
  const riskPctNum = parseFloat(riskPctText);
  const tradeSettingsValid = !isNaN(accountSizeNum) && accountSizeNum > 0 && !isNaN(riskPctNum) && riskPctNum > 0;
  const tradeSettingsDirty = accountSizeNum !== tradeSettings.accountSize || riskPctNum !== tradeSettings.riskPct;

  async function handleSaveTradeSettings() {
    if (!tradeSettingsValid) return;
    const next = { accountSize: accountSizeNum, riskPct: riskPctNum };
    await saveTradeSettings(next);
    setTradeSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const statusMeta =
    status === 'granted'
      ? { label: 'On', color: colors.green, icon: 'checkmark-circle' as const }
      : status === 'denied'
        ? { label: 'Off', color: colors.red, icon: 'close-circle' as const }
        : { label: 'Pending', color: colors.textDim, icon: 'time-outline' as const };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.titleIcon}>
          <Ionicons name="settings" size={18} color={colors.accent} />
        </View>
        <Text style={styles.title}>Settings</Text>
      </View>

      <Text style={styles.sectionLabel}>Position sizing</Text>
      <View style={styles.card}>
        <Text style={styles.rowDetail}>
          Used to calculate share size on each Trade Plan: shares = (account size × risk %) ÷ risk per share (entry
          minus stop).
        </Text>
        <View style={styles.fieldRow}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Account size</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputPrefix}>$</Text>
              <TextInput
                style={styles.input}
                value={accountSizeText}
                onChangeText={setAccountSizeText}
                keyboardType="decimal-pad"
                placeholder="10000"
                placeholderTextColor={colors.textDim}
              />
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Risk per trade</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={riskPctText}
                onChangeText={setRiskPctText}
                keyboardType="decimal-pad"
                placeholder="1"
                placeholderTextColor={colors.textDim}
              />
              <Text style={styles.inputSuffix}>%</Text>
            </View>
          </View>
        </View>
        {tradeSettingsDirty && (
          <Pressable
            style={[styles.actionButton, !tradeSettingsValid && styles.actionButtonDisabled]}
            onPress={handleSaveTradeSettings}
            disabled={!tradeSettingsValid}
          >
            <Ionicons name={saved ? 'checkmark' : 'save-outline'} size={13} color={colors.accent} />
            <Text style={styles.actionButtonText}>{saved ? 'Saved' : 'Save'}</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.sectionLabel}>Notifications</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="notifications-outline" size={16} color={colors.text} />
            <Text style={styles.rowLabel}>Buy/sell + weekly digest</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: `${statusMeta.color}22` }]}>
            <Ionicons name={statusMeta.icon} size={11} color={statusMeta.color} />
            <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
          </View>
        </View>
        <Text style={styles.rowDetail}>
          {status === 'denied'
            ? 'Notifications are off. Enable them for this app in your phone Settings to get instant buy/sell alerts and the Sunday 8pm digest.'
            : 'Instant alerts fire when a scan finds a new buy/sell call (deduped per day). The Sunday 8pm digest lists everything currently sitting in a channel.'}
        </Text>

        {status === 'denied' && (
          <Pressable style={styles.actionButton} onPress={() => Linking.openSettings()}>
            <Ionicons name="open-outline" size={13} color={colors.accent} />
            <Text style={styles.actionButtonText}>Open phone Settings</Text>
          </Pressable>
        )}

        {status === 'granted' && (
          <Pressable style={styles.actionButton} onPress={handleTestNotification}>
            <Ionicons name={sent ? 'checkmark' : 'send-outline'} size={13} color={colors.accent} />
            <Text style={styles.actionButtonText}>{sent ? 'Sent — check your notifications' : 'Send test notification'}</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.sectionLabel}>Scan universe</Text>
      <View style={styles.card}>
        <InfoRow icon="logo-bitcoin" label="Crypto" detail="Top 50 by market cap — live from Binance, refreshed every 60s. Best 10 shown." />
        <InfoRow
          icon="business-outline"
          label="Stocks"
          detail="~285 S&P 500 names across every sector — live from Twelve Data/Yahoo Finance, refreshed every 12 hours"
        />
        <InfoRow
          icon="flag-outline"
          label="TSX (Canada)"
          detail="96 major Canadian companies — CAD-priced, no FX conversion needed. Same data source/cadence as Stocks."
        />
        <InfoRow
          icon="cash-outline"
          label="Price filter"
          detail="Stocks/TSX under $200/share for BUY calls and the 'to trade' rows — crypto and SELL/WATCH calls are unfiltered"
        />
      </View>

      <Text style={styles.sectionLabel}>About</Text>
      <View style={styles.card}>
        <Text style={styles.disclaimerTitle}>Not financial advice</Text>
        <Text style={styles.disclaimerBody}>
          Channel Scanner is a personal trading-analysis tool built on live market data. Every BUY, SELL, and WATCH
          call is generated automatically from real price patterns — it is informational only and is not a
          recommendation to buy or sell any security, ETF, or cryptocurrency. Trading involves risk, including the
          risk of loss. Past channel behavior is not a guarantee of future price movement. Nothing in this app
          should be treated as investment, legal, or tax advice — consult a licensed professional before making
          financial decisions.
        </Text>
        <Text style={styles.versionText}>Channel Scanner v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

function InfoRow({ icon, label, detail }: { icon: keyof typeof Ionicons.glyphMap; label: string; detail: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={15} color={colors.textDim} style={styles.infoIcon} />
      <View style={styles.infoTextWrap}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoDetail}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  titleIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.accent}22`,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  sectionLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.lg,
  },
  card: {
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...cardShadow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  rowDetail: {
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 15,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  fieldRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  field: {
    flex: 1,
  },
  fieldLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
  },
  inputPrefix: {
    color: colors.textDim,
    fontSize: 13,
    marginRight: 2,
  },
  inputSuffix: {
    color: colors.textDim,
    fontSize: 13,
    marginLeft: 2,
  },
  input: {
    flex: 1,
    color: colors.text,
    paddingVertical: 8,
    fontSize: 14,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: `${colors.accent}1a`,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  actionButtonText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  infoIcon: {
    marginTop: 2,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  infoDetail: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 1,
    lineHeight: 14,
  },
  disclaimerTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  disclaimerBody: {
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 16,
  },
  versionText: {
    color: colors.textDim,
    fontSize: 10,
    opacity: 0.6,
    marginTop: spacing.xs,
  },
});
