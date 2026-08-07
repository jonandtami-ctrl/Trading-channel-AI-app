import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Server-side proxy for Yahoo Finance's chart endpoint. Yahoo doesn't send
 * CORS headers, so the browser can't call it directly — this route runs on
 * Vercel's server instead, where CORS doesn't apply, and forwards the JSON
 * straight through.
 */
export async function GET(request: NextRequest, { params }: { params: { symbol: string } }) {
  const symbol = params.symbol.toUpperCase();
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1y&interval=1d`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Yahoo request failed: ${res.status}` }, { status: 502 });
    }
    const json = await res.json();
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
