/**
 * OpenRouter image generation for Gemini mockups (server-only).
 */

import { buildMockupAiPrompt, type MockupAiPromptInput } from "@/lib/mockup-ai-prompts";
import type { MockupVariantId } from "@/lib/mockup-studio";
import { MOCKUP_VARIANTS } from "@/lib/mockup-studio";

const OPENROUTER_IMAGES_URL = "https://openrouter.ai/api/v1/images";

export type OpenRouterMockupConfig = {
  apiKey: string;
  model: string;
  enabled: boolean;
  siteUrl?: string;
  siteName?: string;
};

/**
 * undici/fetch rejects header values with code points > 255 (ByteString).
 * Thai site names like "เทราบิส" must not go into X-Title / Referer raw.
 */
export function toHttpHeaderValue(
  value: string | undefined,
  fallback = "Smart Gift",
): string | undefined {
  const trimmed = (value || "").trim();
  if (!trimmed) return undefined;
  for (let i = 0; i < trimmed.length; i += 1) {
    if (trimmed.charCodeAt(i) > 255) {
      return fallback;
    }
  }
  return trimmed;
}

export function getOpenRouterMockupConfig(): OpenRouterMockupConfig {
  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();
  const enabledFlag = (process.env.OPENROUTER_MOCKUP_ENABLED || "true").trim();
  const enabled =
    apiKey.length > 0 &&
    enabledFlag !== "0" &&
    enabledFlag.toLowerCase() !== "false";
  const appTitle =
    (process.env.OPENROUTER_APP_TITLE || "").trim() ||
    (process.env.NEXT_PUBLIC_SITE_NAME || "").trim() ||
    undefined;
  return {
    apiKey,
    model:
      (process.env.OPENROUTER_MOCKUP_MODEL || "").trim() ||
      "google/gemini-2.5-flash-image",
    enabled,
    siteUrl: toHttpHeaderValue(
      (process.env.NEXT_PUBLIC_SITE_URL || "").trim() || undefined,
      "http://localhost:3000",
    ),
    siteName: toHttpHeaderValue(appTitle, "Smart Gift"),
  };
}

export type GenerateOpenRouterImageInput = {
  prompt: string;
  references?: string[];
  aspectRatio?: string;
};

function toDataUrlFromB64(b64: string): string {
  const trimmed = b64.trim();
  if (trimmed.startsWith("data:image/")) return trimmed;
  if (trimmed.startsWith("iVBOR")) return `data:image/png;base64,${trimmed}`;
  if (trimmed.startsWith("/9j/")) return `data:image/jpeg;base64,${trimmed}`;
  return `data:image/jpeg;base64,${trimmed}`;
}

export function extractImageDataUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;

  const data = root.data;
  if (Array.isArray(data) && data[0] && typeof data[0] === "object") {
    const first = data[0] as Record<string, unknown>;
    if (typeof first.b64_json === "string" && first.b64_json) {
      return toDataUrlFromB64(first.b64_json);
    }
    if (typeof first.url === "string" && first.url.startsWith("data:image/")) {
      return first.url;
    }
  }

  const images = root.images;
  if (Array.isArray(images) && images[0] && typeof images[0] === "object") {
    const img = images[0] as Record<string, unknown>;
    const urlObj = img.image_url;
    if (urlObj && typeof urlObj === "object") {
      const url = (urlObj as { url?: string }).url;
      if (typeof url === "string" && url) {
        return url.startsWith("data:") ? url : toDataUrlFromB64(url);
      }
    }
    if (typeof img.b64_json === "string") return toDataUrlFromB64(img.b64_json);
  }

  return null;
}

export async function generateOpenRouterImage(
  input: GenerateOpenRouterImageInput,
  config = getOpenRouterMockupConfig(),
): Promise<string> {
  if (!config.enabled || !config.apiKey) {
    throw new Error("OpenRouter mockup is not configured");
  }

  const references = (input.references || [])
    .filter((url) => typeof url === "string" && url.startsWith("data:image/"))
    .slice(0, 3)
    .map((url) => ({
      type: "image_url" as const,
      image_url: { url },
    }));

  const body: Record<string, unknown> = {
    model: config.model,
    prompt: input.prompt,
    aspect_ratio: input.aspectRatio || "4:5",
    n: 1,
    output_format: "jpeg",
  };
  if (references.length > 0) {
    body.input_references = references;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };
  const referer = toHttpHeaderValue(config.siteUrl, "http://localhost:3000");
  const title = toHttpHeaderValue(config.siteName, "Smart Gift");
  if (referer) headers["HTTP-Referer"] = referer;
  if (title) headers["X-Title"] = title;

  const res = await fetch(OPENROUTER_IMAGES_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const message =
      json &&
      typeof json === "object" &&
      json !== null &&
      "error" in json &&
      typeof (json as { error?: { message?: string } }).error?.message === "string"
        ? (json as { error: { message: string } }).error.message
        : `OpenRouter HTTP ${res.status}`;
    throw new Error(message);
  }

  const dataUrl = extractImageDataUrl(json);
  if (!dataUrl) {
    throw new Error("OpenRouter returned no image data");
  }
  return dataUrl;
}

export type MockupAiVariantRequest = MockupAiPromptInput & {
  productDataUrl: string;
  logoDataUrl?: string | null;
  previousDataUrl?: string | null;
};

export type MockupAiVariantResult = {
  id: MockupVariantId;
  label: string;
  summary: string;
  dataUrl: string;
  engine: "openrouter";
};

export async function generateMockupVariantWithOpenRouter(
  input: MockupAiVariantRequest,
): Promise<MockupAiVariantResult> {
  const preset = MOCKUP_VARIANTS.find((item) => item.id === input.variantId);
  if (!preset) throw new Error(`Unknown variant ${input.variantId}`);

  const prompt = buildMockupAiPrompt(input);
  const references = [];
  if (input.previousDataUrl) references.push(input.previousDataUrl);
  references.push(input.productDataUrl);
  if (input.logoDataUrl) references.push(input.logoDataUrl);

  const dataUrl = await generateOpenRouterImage({
    prompt,
    references,
    aspectRatio: "4:5",
  });

  return {
    id: preset.id,
    label: preset.label,
    summary: preset.summary,
    dataUrl,
    engine: "openrouter",
  };
}
