import { View } from 'react-native';
import { CandleChart } from './CandleChart';
import type { ScanResult } from '../lib/types';

const MINI_CANDLE_COUNT = 60;

/**
 * A card-sized version of the same support/resistance overlay the symbol
 * detail chart shows — lets a list row communicate "here's the channel
 * it's bouncing in" at a glance, without tapping in. Uses whichever
 * channel detectChannels ranked best (channels[0], already sorted by
 * containment/tightness) so this matches what the detail page would call
 * out as the primary setup.
 */
export function MiniChannelChart({ result, height = 56 }: { result: ScanResult; height?: number }) {
  const candles = result.candles.slice(-MINI_CANDLE_COUNT);
  if (candles.length < 2) return null;

  const primaryChannel = result.channels[0];

  return (
    <View style={{ width: '100%', height }}>
      <CandleChart candles={candles} channels={primaryChannel ? [primaryChannel] : []} height={height} compact />
    </View>
  );
}
