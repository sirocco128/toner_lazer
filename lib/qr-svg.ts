/**
 * Render a PromptPay payload as a PNG data URL (server-side).
 */

import QRCode from "qrcode";

export async function promptPayQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    margin: 1,
    errorCorrectionLevel: "M",
    width: 240,
  });
}
