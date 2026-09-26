/**
 * Prompt builders for OpenRouter Gemini product mockups.
 * Pure strings — safe for Node tests.
 */

import { MOCKUP_POLICY_SUFFIX } from "@/lib/ai-safety";
import type { MockupSurfaceKind, MockupVariantId } from "@/lib/mockup-studio";

export type MockupAiPromptInput = {
  variantId: MockupVariantId;
  surfaceLabel: string;
  surfaceKind: MockupSurfaceKind;
  finishLabel: string;
  productName: string;
  text?: string;
  hasLogo: boolean;
  activityHint?: string;
  placementHint?: string;
  retailHint?: string;
  refineInstruction?: string;
};

export function buildMockupAiPrompt(input: MockupAiPromptInput): string {
  const brandText = input.text?.trim();
  const logoLine = input.hasLogo
    ? "Apply the customer logo from the reference image onto the product naturally (follow surface curvature, lighting, and material). The logo must look screen-printed / UV-printed on the object — wrap to the cylinder or surface, soft contact with material grain, no floating sticker, no hard rectangular cutout."
    : brandText
      ? `Print the exact text "${brandText}" on the product as a clean branded mark that follows the surface.`
      : "Keep the product clean with a subtle placeholder brand mark.";

  const refine = input.refineInstruction?.trim();
  const refineLine = refine
    ? `The first reference is the current mockup. Apply ONLY this follow-up edit: "${refine}". Keep the same product, camera angle, and lighting. Do not add new objects or text UI.`
    : "";

  if (input.variantId === "product") {
    return [
      "Ultra-realistic commercial product photo for a premium Thai B2B gift catalog.",
      `Subject: ${input.surfaceLabel} from "${input.productName}".`,
      `Finish color: ${input.finishLabel}.`,
      "Use the product photo reference as the exact object shape and proportions.",
      logoLine,
      refineLine,
      "Soft studio lighting, seamless light-gray seamless backdrop, subtle reflection on the table, crisp focus, no text UI, no collage frames, no watermark badges.",
      "Portrait 4:5 composition, magazine quality, photorealistic materials.",
      MOCKUP_POLICY_SUFFIX,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (input.variantId === "lifestyle") {
    return [
      "Ultra-realistic lifestyle photograph of the branded product being used naturally.",
      `Product: ${input.surfaceLabel} (${input.finishLabel}).`,
      input.activityHint || "Natural everyday usage context.",
      "Seamlessly place the branded product into a real environment. Match perspective, color temperature, and cast soft realistic shadows.",
      "Absolutely no white boxes, no sticker edges, no cut-out paper look.",
      logoLine,
      refineLine,
      "Premium documentary photography, shallow depth of field, vertical 4:5, beautiful lighting.",
      MOCKUP_POLICY_SUFFIX,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (input.variantId === "retail") {
    return [
      "Ultra-realistic retail merchandising photograph of the branded product on a store shelf or gift-shop counter.",
      `Product: ${input.surfaceLabel} (${input.finishLabel}).`,
      input.retailHint || "Displayed for sale among premium corporate gifts.",
      "Place the branded product into a retail environment with correct scale, shelf lighting, and soft contact shadows.",
      "No white rectangular cards, no hard cutouts, no collage frames.",
      logoLine,
      refineLine,
      "Retail catalog photography, vertical 4:5, photorealistic.",
      MOCKUP_POLICY_SUFFIX,
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    "Ultra-realistic office product-placement photograph.",
    `Product: ${input.surfaceLabel} (${input.finishLabel}).`,
    input.placementHint || "Placed naturally on a desk or office surface.",
    "Integrate the branded product into a modern office with correct scale and soft contact shadows on the desk.",
    "No white rectangular cards, no hard cutouts, no collage frames.",
    logoLine,
    refineLine,
    "Corporate editorial photography, clean desk styling, vertical 4:5, photorealistic.",
    MOCKUP_POLICY_SUFFIX,
  ]
    .filter(Boolean)
    .join(" ");
}
