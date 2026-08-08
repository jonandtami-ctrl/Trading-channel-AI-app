import { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  PanResponderGestureState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Candle, Channel } from '../lib/types';
import { CandleChart } from './CandleChart';
import { colors, radius, spacing } from '../constants/theme';

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.6;

function touchDistance(touches: GestureResponderEvent['nativeEvent']['touches']): number {
  const [a, b] = touches;
  const dx = a.pageX - b.pageX;
  const dy = a.pageY - b.pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function ZoomableChart({ candles, channels }: { candles: Candle[]; channels: Channel[] }) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<ScrollView>(null);
  const pinch = useRef({ startDistance: 0, startZoom: 1 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt: GestureResponderEvent) => evt.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponder: (evt: GestureResponderEvent) => evt.nativeEvent.touches.length === 2,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        if (evt.nativeEvent.touches.length === 2) {
          pinch.current = { startDistance: touchDistance(evt.nativeEvent.touches), startZoom: zoom };
        }
      },
      onPanResponderMove: (evt: GestureResponderEvent, _gestureState: PanResponderGestureState) => {
        if (evt.nativeEvent.touches.length === 2 && pinch.current.startDistance > 0) {
          const dist = touchDistance(evt.nativeEvent.touches);
          const scale = dist / pinch.current.startDistance;
          setZoom(clamp(pinch.current.startZoom * scale, MIN_ZOOM, MAX_ZOOM));
        }
      },
      onPanResponderRelease: () => {
        pinch.current.startDistance = 0;
      },
      onPanResponderTerminate: () => {
        pinch.current.startDistance = 0;
      },
    })
  ).current;

  function onLayout(e: LayoutChangeEvent) {
    setContainerWidth(e.nativeEvent.layout.width);
  }

  function bumpZoom(delta: number) {
    setZoom((z) => clamp(z + delta, MIN_ZOOM, MAX_ZOOM));
  }

  function resetZoom() {
    setZoom(MIN_ZOOM);
    scrollRef.current?.scrollTo({ x: 0, animated: true });
  }

  const chartWidth = containerWidth * zoom;
  const zoomed = zoom > MIN_ZOOM + 0.01;

  return (
    <View onLayout={onLayout}>
      <View {...panResponder.panHandlers}>
        <ScrollView
          ref={scrollRef}
          horizontal
          scrollEnabled={zoomed}
          showsHorizontalScrollIndicator={zoomed}
          bounces={zoomed}
        >
          <View style={{ width: chartWidth || containerWidth }}>
            {containerWidth > 0 && <CandleChart candles={candles} channels={channels} />}
          </View>
        </ScrollView>
      </View>

      <View style={styles.controls}>
        <Pressable style={styles.controlButton} onPress={() => bumpZoom(-ZOOM_STEP)} disabled={zoom <= MIN_ZOOM}>
          <Ionicons name="remove" size={14} color={zoom <= MIN_ZOOM ? colors.textDim : colors.text} />
        </Pressable>
        <Text style={styles.zoomLabel}>{zoom.toFixed(1)}×</Text>
        <Pressable style={styles.controlButton} onPress={() => bumpZoom(ZOOM_STEP)} disabled={zoom >= MAX_ZOOM}>
          <Ionicons name="add" size={14} color={zoom >= MAX_ZOOM ? colors.textDim : colors.text} />
        </Pressable>
        {zoomed && (
          <Pressable style={styles.resetButton} onPress={resetZoom}>
            <Ionicons name="refresh" size={12} color={colors.accent} />
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
        )}
        <Text style={styles.hint}>{zoomed ? 'Drag to pan' : 'Pinch or use +/− to zoom'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  controlButton: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  zoomLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'center',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: `${colors.accent}22`,
  },
  resetText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '700',
  },
  hint: {
    color: colors.textDim,
    fontSize: 9,
    marginLeft: 'auto',
    opacity: 0.7,
  },
});
