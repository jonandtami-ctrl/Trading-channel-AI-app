/**
 * A deliberately narrow whitelist of tickers from the blue-chip universe
 * (see blueChip.ts) that fit a Buffett/Munger-style value criteria: a
 * durable competitive moat (brand, network, toll-booth, or scale), a
 * simple and understandable business, a conservative balance sheet, and a
 * long record of consistent earnings and shareholder-friendly capital
 * allocation — not just "big and well-known." This is a judgment call
 * about investing style, not a claim about what Berkshire Hathaway
 * currently holds; it deliberately excludes fast-moving or story-driven
 * names from the blue-chip list (NVDA, META, NFLX, and similar) even
 * though they're large, financially sound companies in their own right.
 */
export const BUFFETT_STYLE_SYMBOLS: string[] = [
  'BRK-B', // Berkshire Hathaway itself
  'AAPL', // consumer ecosystem moat
  'KO', // brand + distribution moat
  'AXP', // payments network moat
  'V', // payments network moat
  'MA', // payments network moat
  'BAC', // conservative, scaled banking
  'MCO', // credit-rating duopoly, toll-booth economics
  'PG', // consumer staples brand moat
  'JNJ', // healthcare brand + scale moat, dividend aristocrat
  'CL', // consumer staples brand moat, dividend king
  'PEP', // consumer staples brand moat
  'WMT', // retail scale moat
  'COST', // membership/scale moat
  'HD', // home-improvement retail moat
  'LOW', // home-improvement retail moat
  'MCD', // real estate + brand moat
  'CVX', // integrated energy, conservative balance sheet
  'UNH', // healthcare scale moat
  'GS', // scaled, franchise investment bank
  'BLK', // asset-management scale moat
  'UNP', // railroad — a physical, hard-to-replicate network moat
];
