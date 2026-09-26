import { rmSync } from "node:fs";
import { closeDb } from "../lib/database";

/** Close sqlite then remove a temp dir. Windows EPERM after WAL locks must not fail the suite. */
export function teardownTempDir(dir: string | undefined): void {
  closeDb();
  if (!dir) return;
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 12, retryDelay: 75 });
  } catch {
    // leftover temp is acceptable on Windows when another handle still exists
  }
}
