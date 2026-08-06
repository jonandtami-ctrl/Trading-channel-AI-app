'use client';

import { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi } from 'lightweight-charts';
import type { Candle, Channel } from '@/lib/types';

export function PriceChart({ candles, channels }: { candles: Candle[]; channels: Channel[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#10161f' },
        textColor: '#7d8797',
        fontFamily: 'ui-monospace, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#202836' },
        horzLines: { color: '#202836' },
      },
      rightPriceScale: { borderColor: '#202836' },
      timeScale: { borderColor: '#202836' },
      height: 340,
      autoSize: true,
    });
    chartRef.current = chart;

    const series = chart.addCandlestickSeries({
      upColor: '#3fb950',
      downColor: '#f85149',
      borderVisible: false,
      wickUpColor: '#3fb950',
      wickDownColor: '#f85149',
    });

    series.setData(
      candles.map((c) => ({
        time: c.time as unknown as never,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    for (const channel of channels) {
      const color = channel.status === 'broken' ? '#d29922' : '#58a6ff';
      const supportLine = series.createPriceLine({
        price: channel.support.price,
        color,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'support',
      });
      const resistanceLine = series.createPriceLine({
        price: channel.resistance.price,
        color,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'resistance',
      });
      // lines are attached to the series and cleaned up when the series is removed
      void supportLine;
      void resistanceLine;
    }

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, channels]);

  return <div ref={containerRef} className="chart-container" style={{ width: '100%' }} />;
}
