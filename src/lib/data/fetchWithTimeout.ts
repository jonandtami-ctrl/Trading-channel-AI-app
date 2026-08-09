/** Wraps fetch with a hard timeout so one hung connection can't stall a whole scan batch. */
export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504, 999]); // 999 is Yahoo's own rate-limit code

/**
 * A mobile connection dropping one request out of hundreds in a batch, or
 * a single rate-limit response, is common and shouldn't immediately force
 * a symbol to fall back to demo data — retry once after a short pause
 * before giving up.
 */
export async function fetchWithRetry(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  try {
    const res = await fetchWithTimeout(url, options, timeoutMs);
    if (res.ok || !TRANSIENT_STATUS.has(res.status)) return res;
  } catch {
    // fall through to the retry below
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  return fetchWithTimeout(url, options, timeoutMs);
}
