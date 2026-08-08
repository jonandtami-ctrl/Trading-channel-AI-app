export function formatPrice(n: number): string {
  if (n >= 100) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(n >= 1 ? 3 : 5)}`;
}

export function formatDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
