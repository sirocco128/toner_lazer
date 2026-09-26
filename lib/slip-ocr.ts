import { completeOpenRouterVision } from "@/lib/openrouter-chat";
import { parseSlipExtracted, type SlipExtracted } from "@/lib/slip-verify";

const SLIP_PROMPT = `Read this Thai bank or PromptPay transfer slip image.
Return JSON only, no markdown:
{"amount":1000.00,"payeeName":"...","accountOrPromptPay":"...","transferredAt":"...","reference":"...","bank":"...","readable":true}
amount is THB number. accountOrPromptPay is the recipient PromptPay, tax ID, mobile, or bank account digits.
If unreadable set readable false and amount null.`;

export async function extractSlipFromImage(input: {
  imageBytes: Buffer;
  mimeType: string;
}): Promise<{ extracted: SlipExtracted; model: string | null; raw: string | null }> {
  const raw = await completeOpenRouterVision({
    prompt: SLIP_PROMPT,
    imageBase64: input.imageBytes.toString("base64"),
    mimeType: input.mimeType,
  });
  if (!raw) {
    return {
      extracted: parseSlipExtracted(""),
      model: null,
      raw: null,
    };
  }
  return {
    extracted: parseSlipExtracted(raw),
    model: process.env.OPENROUTER_CHAT_MODEL?.trim() || "google/gemini-2.5-flash",
    raw,
  };
}
