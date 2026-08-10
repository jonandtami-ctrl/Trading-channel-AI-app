/**
 * Stocks/ETFs always show 2 decimals, matching how real stock quotes read.
 * Crypto gets extra precision below $100 since sub-$1 and low-double-digit
 * coins lose meaningful detail at 2 decimals.
 */
export function formatPrice(n: number, kind: 'crypto' | 'stock' = 'crypto'): string {
  if (kind === 'stock' || n >= 100) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(n >= 1 ? 3 : 5)}`;
}

export function formatDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
