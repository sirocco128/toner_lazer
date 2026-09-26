/**
 * OpenRouter chat completions (server-only). Used by buyer FAQ + ops assistant.
 * Falls back to null when the key is missing or the call fails.
 */

import { getOpenRouterMockupConfig, toHttpHeaderValue } from "@/lib/openrouter-mockup";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterTool = {
  type: string;
  parameters?: Record<string, unknown>;
};

export type OpenRouterUrlCitation = {
  url: string;
  title?: string;
  content?: string;
};

export type OpenRouterChatDetailed = {
  content: string;
  citations: OpenRouterUrlCitation[];
  model: string;
};

export function getOpenRouterChatModel(): string {
  return (
    (process.env.OPENROUTER_CHAT_MODEL || "").trim() ||
    "google/gemini-2.5-flash"
  );
}

export function isOpenRouterChatEnabled(): boolean {
  return getOpenRouterMockupConfig().enabled;
}

function openRouterHeaders(): Record<string, string> | null {
  const config = getOpenRouterMockupConfig();
  if (!config.enabled || !config.apiKey) return null;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };
  const referer = toHttpHeaderValue(config.siteUrl, "http://localhost:3000");
  const title = toHttpHeaderValue(config.siteName, "Smart Gift");
  if (referer) headers["HTTP-Referer"] = referer;
  if (title) headers["X-Title"] = title;
  return headers;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function extractOpenRouterCitations(payload: unknown): OpenRouterUrlCitation[] {
  const root = asRecord(payload);
  const message = asRecord(asRecord(Array.isArray(root?.choices) ? root.choices[0] : null)?.message);
  const bag: unknown[] = [];
  if (Array.isArray(message?.annotations)) bag.push(...message.annotations);
  if (Array.isArray(message?.citations)) bag.push(...message.citations);
  const citations: OpenRouterUrlCitation[] = [];
  const seen = new Set<string>();
  for (const item of bag) {
    const rec = asRecord(item);
    if (!rec) continue;
    const nested = asRecord(rec.url_citation) ?? rec;
    const url = String(nested.url || "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    citations.push({
      url,
      title: typeof nested.title === "string" ? nested.title : undefined,
      content: typeof nested.content === "string" ? nested.content : undefined,
    });
  }
  return citations;
}

export async function completeOpenRouterChatDetailed(
  messages: ChatMessage[],
  options?: {
    maxTokens?: number;
    temperature?: number;
    tools?: OpenRouterTool[];
    maxToolCalls?: number;
    timeoutMs?: number;
  },
): Promise<OpenRouterChatDetailed | null> {
  const headers = openRouterHeaders();
  if (!headers) return null;

  const body: Record<string, unknown> = {
    model: getOpenRouterChatModel(),
    messages,
    max_tokens: options?.maxTokens ?? 400,
    temperature: options?.temperature ?? 0.2,
  };
  if (options?.tools && options.tools.length > 0) {
    body.tools = options.tools;
  }
  if (options?.maxToolCalls) {
    body.max_tool_calls = options.maxToolCalls;
  }

  try {
    const res = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options?.timeoutMs ?? 20_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content =
      typeof json.choices?.[0]?.message?.content === "string"
        ? json.choices[0].message.content.trim()
        : "";
    const citations = extractOpenRouterCitations(json);
    if (!content && citations.length === 0) return null;
    return {
      content,
      citations,
      model: typeof json.model === "string" && json.model.trim()
        ? json.model.trim()
        : getOpenRouterChatModel(),
    };
  } catch {
    return null;
  }
}

export async function completeOpenRouterChat(
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number },
): Promise<string | null> {
  const detailed = await completeOpenRouterChatDetailed(messages, options);
  const content = detailed?.content?.trim();
  return content ? content : null;
}

export async function completeOpenRouterVision(input: {
  prompt: string;
  imageBase64: string;
  mimeType: string;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<string | null> {
  const headers = openRouterHeaders();
  if (!headers) return null;
  const mime = input.mimeType.startsWith("image/") ? input.mimeType : "image/jpeg";
  try {
    const res = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: getOpenRouterChatModel(),
        max_tokens: input.maxTokens ?? 400,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: input.prompt },
              {
                type: "image_url",
                image_url: { url: `data:${mime};base64,${input.imageBase64}` },
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(input.timeoutMs ?? 25_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    return typeof content === "string" && content.trim() ? content.trim() : null;
  } catch {
    return null;
  }
}
