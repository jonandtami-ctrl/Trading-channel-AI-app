import { ALL_SYMBOLS } from '@/lib/data/symbols';
import { SymbolDetail } from './SymbolDetail';

export function generateStaticParams() {
  return ALL_SYMBOLS.map((s) => ({ symbol: s.symbol }));
}

export default function SymbolPage({ params }: { params: { symbol: string } }) {
  return <SymbolDetail symbol={params.symbol} />;
}
