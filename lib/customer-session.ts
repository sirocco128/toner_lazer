/**
 * Short-lived browser hint for the last viewed customer order.
 * Stores only orderId + access token the user already opened via magic link / lookup.
 */

export const RECENT_ORDER_STORAGE_KEY = "pgs:recent-order:v1";

export type RecentOrderHint = {
  orderId: string;
  token: string;
  savedAt: number;
};

/** Keep for one browser session day — cleared when tab storage ends or expires. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function parseRecentOrderHint(raw: string | null): RecentOrderHint | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<RecentOrderHint>;
    if (
      typeof data.orderId !== "string" ||
      typeof data.token !== "string" ||
      typeof data.savedAt !== "number"
    ) {
      return null;
    }
    if (!data.orderId.trim() || !data.token.trim()) return null;
    if (Date.now() - data.savedAt > MAX_AGE_MS) return null;
    return {
      orderId: data.orderId.trim(),
      token: data.token.trim(),
      savedAt: data.savedAt,
    };
  } catch {
    return null;
  }
}

export function recentOrderHref(hint: RecentOrderHint): string {
  return `/orders/${encodeURIComponent(hint.orderId)}?t=${encodeURIComponent(hint.token)}`;
}

export function issueHrefForOrder(orderId: string, token: string): string {
  const q = new URLSearchParams({
    orderId,
    t: token,
  });
  return `/issues?${q.toString()}`;
}
