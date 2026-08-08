import { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import type { Candle, Channel } from '../lib/types';
import { colors } from '../constants/theme';

const HEIGHT = 320;
const PADDING_Y = 16;
const PADDING_RIGHT = 52;

export function CandleChart({ candles, channels }: { candles: Candle[]; channels: Channel[] }) {
  const [width, setWidth] = useState(0);

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  if (candles.length === 0 || width === 0) {
    return <View style={{ height: HEIGHT }} onLayout={onLayout} />;
  }

  const plotWidth = width - PADDING_RIGHT;
  const prices = candles.flatMap((c) => [c.high, c.low]);
  for (const ch of channels) {
    prices.push(ch.support.price, ch.resistance.price);
  }
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || 1;
  const plotHeight = HEIGHT - PADDING_Y * 2;

  const y = (price: number) => PADDING_Y + plotHeight - ((price - minPrice) / range) * plotHeight;

  const slotWidth = plotWidth / candles.length;
  const bodyWidth = Math.max(1, Math.min(slotWidth * 0.6, 10));
  const x = (i: number) => i * slotWidth + slotWidth / 2;

  return (
    <View onLayout={onLayout}>
      <Svg width={width} height={HEIGHT}>
        {channels.map((channel, i) => {
          const lineColor = channel.status === 'broken' ? colors.amber : colors.blue;
          return (
            <G key={i}>
              <Line
                x1={0}
                x2={plotWidth}
                y1={y(channel.resistance.price)}
                y2={y(channel.resistance.price)}
                stroke={lineColor}
                strokeWidth={1}
                strokeDasharray="4,3"
              />
              <SvgText x={plotWidth + 4} y={y(channel.resistance.price) + 3} fontSize={9} fill={lineColor}>
                {formatAxisPrice(channel.resistance.price)}
              </SvgText>
              <Line
                x1={0}
                x2={plotWidth}
                y1={y(channel.support.price)}
                y2={y(channel.support.price)}
                stroke={lineColor}
                strokeWidth={1}
                strokeDasharray="4,3"
              />
              <SvgText x={plotWidth + 4} y={y(channel.support.price) + 3} fontSize={9} fill={lineColor}>
                {formatAxisPrice(channel.support.price)}
              </SvgText>
            </G>
          );
        })}

        {candles.map((c, i) => {
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
      </Svg>
    </View>
  );
}

function formatAxisPrice(n: number): string {
  return n >= 100 ? n.toFixed(0) : n.toFixed(2);
}
