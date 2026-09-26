"use client";

import { useEffect } from "react";
import { RECENT_ORDER_STORAGE_KEY } from "@/lib/customer-session";

/** Persist last opened order in sessionStorage for hub / menu shortcuts. */
export function RememberRecentOrder({
  orderId,
  token,
}: {
  orderId: string;
  token: string;
}) {
  useEffect(() => {
    try {
      sessionStorage.setItem(
        RECENT_ORDER_STORAGE_KEY,
        JSON.stringify({
          orderId,
          token,
          savedAt: Date.now(),
        }),
      );
    } catch {
      // private mode / quota — ignore
    }
  }, [orderId, token]);

  return null;
}
