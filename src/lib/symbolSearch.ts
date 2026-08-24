import { ALL_SYMBOLS, type SymbolInfo } from './data/symbols';

const MAX_RESULTS = 6;

// Deliberately searches every symbol, including ones the app hides from
// passive Browse/Buy/Sell/Watch surfaces (see the `notable` flag on
// SymbolInfo) and ones with no active signal right now. Those filters
// exist to keep unprompted browsing from being cluttered with names
// nobody's heard of or nothing to act on — neither applies to someone
// typing in a specific company they already have in mind. A symbol with
// no current channel/signal still has a real, live price on its own
// detail page (it fetches independently), so it's always a valid
// destination even when it wouldn't show up anywhere else in the app.
export function searchSymbols(query: string, symbols: SymbolInfo[] = ALL_SYMBOLS): SymbolInfo[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  return symbols
    .filter((s) => {
      const bareSymbol = s.symbol.replace(/\.TO$/, '');
      return bareSymbol.includes(q) || s.symbol.includes(q) || s.name.toUpperCase().includes(q);
    })
    .sort((a, b) => {
      const aStarts = a.symbol.replace(/\.TO$/, '').startsWith(q) ? 0 : 1;
      const bStarts = b.symbol.replace(/\.TO$/, '').startsWith(q) ? 0 : 1;
      return aStarts - bStarts;
    })
    .slice(0, MAX_RESULTS);
}
