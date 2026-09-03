import { View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';
import { colors } from '../constants/theme';

/**
 * A small, deliberately plain running-total line — the one chart the
 * journal overview is allowed (see item P: "do not overload it with
 * charts"). Takes cumulative realized P/L values, oldest first.
 */
export function EquityCurve({ cumulativeValues, height = 60 }: { cumulativeValues: number[]; height?: number }) {
  if (cumulativeValues.length < 2) return null;

  const width = 320;
  const min = Math.min(0, ...cumulativeValues);
  const max = Math.max(0, ...cumulativeValues);
  const range = max - min || 1;
  const zeroY = height - ((0 - min) / range) * height;

  const points = cumulativeValues
    .map((v, i) => {
      const x = (i / (cumulativeValues.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const positive = cumulativeValues[cumulativeValues.length - 1] >= 0;

  return (
    <View style={{ width: '100%', height }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke={colors.border} strokeWidth={1} />
        <Polyline points={points} fill="none" stroke={positive ? colors.green : colors.red} strokeWidth={2} />
      </Svg>
    </View>
  );
}
