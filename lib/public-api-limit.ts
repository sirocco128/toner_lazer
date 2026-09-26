import { consumeRateLimit } from "@/lib/quote-repository";
import { hashIp, resolveClientIp } from "@/lib/quote-service";

function readIntEnv(key: string, fallback: number): number {
  const raw = Number(process.env[key]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export function allowPublicLookup(request: Request, bucket: string): boolean {
  try {
    const ip = resolveClientIp(request.headers);
    const ipHash = hashIp(`${bucket}:${ip}`);
    const windowMinutes = readIntEnv("QUOTE_RATE_LIMIT_WINDOW_MINUTES", 15);
    const maxAttempts = readIntEnv("LOOKUP_RATE_LIMIT_MAX", 30);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const bucketStart = nowSeconds - (nowSeconds % (windowMinutes * 60));
    return consumeRateLimit({
      keyHash: ipHash,
      bucketStart,
      maxAttempts,
      nowSeconds,
    });
  } catch {
    return true;
  }
}
