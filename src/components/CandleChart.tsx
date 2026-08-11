import { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { G, Line, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import type { Candle, Channel, Level } from '../lib/types';
import { colors } from '../constants/theme';

const DEFAULT_HEIGHT = 320;
const PADDING_Y = 16;
const PADDING_RIGHT = 52;
const LEVEL_MATCH_TOLERANCE = 0.005; // 0.5% — treat a level as "already drawn" by a channel line at this price

export interface ChartMarker {
  index: number;
  side: 'buy' | 'sell';
}

export function CandleChart({
  candles,
  channels,
  levels,
  markers,
  revealCount,
  height = DEFAULT_HEIGHT,
  compact = false,
}: {
  candles: Candle[];
  channels: Channel[];
  /** Support/resistance levels not already covered by a channel line — drawn thinner and muted, so you can see where a level is forming even without a full channel. */
  levels?: Level[];
  markers?: ChartMarker[];
  revealCount?: number;
  height?: number;
  /** Card-sized mode: no axis price labels, no right-side label gutter — for mini charts embedded in a list row. */
  compact?: boolean;
}) {
  const [width, setWidth] = useState(0);

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  if (candles.length === 0 || width === 0) {
    return <View style={{ height }} onLayout={onLayout} />;
  }

  const visibleCount = revealCount ?? candles.length;
  const visibleCandles = candles.slice(0, visibleCount);
  const visibleMarkers = (markers ?? []).filter((m) => m.index < visibleCount);

  const channelPrices = channels.flatMap((ch) => [ch.support.price, ch.resistance.price]);
  const formingLevels = (levels ?? []).filter(
    (level) => !channelPrices.some((p) => Math.abs(level.price - p) / p <= LEVEL_MATCH_TOLERANCE)
  );

  const paddingRight = compact ? 0 : PADDING_RIGHT;
  const paddingY = compact ? 3 : PADDING_Y;
  const plotWidth = width - paddingRight;
  const prices = candles.flatMap((c) => [c.high, c.low]);
  prices.push(...channelPrices, ...formingLevels.map((l) => l.price));
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || 1;
  const plotHeight = height - paddingY * 2;

  const y = (price: number) => paddingY + plotHeight - ((price - minPrice) / range) * plotHeight;

  const slotWidth = plotWidth / candles.length;
  const bodyWidth = Math.max(1, Math.min(slotWidth * 0.6, 10));
  const x = (i: number) => i * slotWidth + slotWidth / 2;
  const markerSize = Math.max(5, Math.min(slotWidth * 0.7, 9));

  return (
    <View onLayout={onLayout}>
      <Svg width={width} height={height}>
        {channels.map((channel, i) => {
          const broken = channel.status === 'broken';
          // Resistance is the sell line (take-profit / breakout level), support is the
          // buy line (bounce entry) — same green/red language used everywhere else in
          // the app. A broken channel dims both to amber since the level's no longer live.
          const resistanceColor = broken ? colors.amber : colors.red;
          const supportColor = broken ? colors.amber : colors.green;
          return (
            <G key={i}>
              <Line
                x1={0}
                x2={plotWidth}
                y1={y(channel.resistance.price)}
                y2={y(channel.resistance.price)}
                stroke={resistanceColor}
                strokeWidth={1}
                strokeDasharray="4,3"
              />
              {!compact && (
                <SvgText x={plotWidth + 4} y={y(channel.resistance.price) + 3} fontSize={9} fill={resistanceColor}>
                  {formatAxisPrice(channel.resistance.price)}
                </SvgText>
              )}
              <Line
                x1={0}
                x2={plotWidth}
                y1={y(channel.support.price)}
                y2={y(channel.support.price)}
                stroke={supportColor}
                strokeWidth={1}
                strokeDasharray="4,3"
              />
              {!compact && (
                <SvgText x={plotWidth + 4} y={y(channel.support.price) + 3} fontSize={9} fill={supportColor}>
                  {formatAxisPrice(channel.support.price)}
                </SvgText>
              )}
            </G>
          );
        })}

        {formingLevels.map((level, i) => {
          const color = level.type === 'support' ? colors.green : colors.red;
          return (
            <G key={`forming-${i}`}>
              <Line
                x1={0}
                x2={plotWidth}
                y1={y(level.price)}
                y2={y(level.price)}
                stroke={color}
                strokeWidth={1}
                strokeOpacity={0.4}
                strokeDasharray="2,4"
              />
              {!compact && (
                <SvgText x={plotWidth + 4} y={y(level.price) + 3} fontSize={8} fill={color} opacity={0.6}>
                  {formatAxisPrice(level.price)}
                </SvgText>
              )}
            </G>
          );
        })}

        {visibleCandles.map((c, i) => {
          const up = c.close >= c.open;
          const color = up ? colors.green : colors.red;
          const cx = x(i);
          const bodyTop = y(Math.max(c.open, c.close));
          const bodyBottom = y(Math.min(c.open, c.close));
          return (
            <G key={i}>
              <Line x1={cx} x2={cx} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth={1} />
              <Rect
                x={cx - bodyWidth / 2}
                y={bodyTop}
                width={bodyWidth}
                height={Math.max(1, bodyBottom - bodyTop)}
                fill={color}
              />
            </G>
          );
        })}

        {visibleMarkers.map((m, i) => {
          const candle = candles[m.index];
          if (!candle) return null;
          const cx = x(m.index);
          const color = m.side === 'buy' ? colors.green : colors.red;
          const points =
            m.side === 'buy'
              ? (() => {
                  const baseY = y(candle.low) + markerSize + 4;
                  return `${cx},${baseY - markerSize} ${cx - markerSize},${baseY} ${cx + markerSize},${baseY}`;
                })()
              : (() => {
                  const baseY = y(candle.high) - markerSize - 4;
                  return `${cx},${baseY + markerSize} ${cx - markerSize},${baseY} ${cx + markerSize},${baseY}`;
                })();
          return <Polygon key={`m-${i}`} points={points} fill={color} stroke={colors.bg} strokeWidth={1} />;
        })}
      </Svg>
    </View>
  );
}

function formatAxisPrice(n: number): string {
  return n >= 100 ? n.toFixed(0) : n.toFixed(2);
}
