"use client";

import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import {
  isOpsDeskContextMenuTarget,
  opsDeskWatermarkBand,
  opsDeskWatermarkLine,
} from "@/lib/ops-desk-guard";

const TILES = 72;

export function OpsDeskGuard({
  userLine,
  children,
}: {
  userLine: string;
  children: ReactNode;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const label = useMemo(
    () => opsDeskWatermarkLine(userLine, now),
    [userLine, now],
  );
  const band = useMemo(
    () => opsDeskWatermarkBand(userLine, now),
    [userLine, now],
  );

  function onContextMenu(event: MouseEvent<HTMLDivElement>) {
    if (isOpsDeskContextMenuTarget(event.target)) return;
    event.preventDefault();
  }

  return (
    <div
      className="relative flex min-w-0 flex-1 flex-col"
      onContextMenu={onContextMenu}
    >
      {children}
      <div
        className="ops-desk-watermark pointer-events-none print:hidden"
        aria-hidden
      >
        <div className="ops-desk-watermark__sheet">
          {Array.from({ length: TILES }, (_, index) => (
            <span key={index} className="ops-desk-watermark__tile">
              {label}
            </span>
          ))}
        </div>
        <p className="ops-desk-watermark__band">{band}</p>
      </div>
    </div>
  );
}
