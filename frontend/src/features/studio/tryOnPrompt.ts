import type { CatalogItem, OutfitSnapshot } from "@/lib/types/api";

const slotNames: Record<string, string> = {
  outerwear: "outer garment",
  undergarment: "inner garment",
  bottom: "bottom garment",
  headwear: "headwear",
  accessory_front: "accessory",
  footwear: "footwear",
};

export function buildManualTryOnPrompt(
  title: string,
  snapshot: OutfitSnapshot,
  catalogItems: CatalogItem[],
  hasPersonPhoto: boolean,
): string {
  const garments = snapshot.items.map((selected) => {
    const item = catalogItems.find((candidate) => candidate.id === selected.itemId);
    const name = item?.name || selected.itemId;
    const color = selected.colorHex ? `, color ${selected.colorHex}` : "";
    return `- ${slotNames[selected.slot] || selected.slot}: ${name}${color}`;
  }).join("\n");
  const wearer = hasPersonPhoto
    ? "Image 2 is the person to dress. Preserve their identity, face, skin tone, body proportions and pose. Fit the referenced garments naturally; do not replace the person. Use Image 2 only for the wearer, never for the background."
    : "No person photo is supplied. Choose one adult wearer with gender presentation and appearance appropriate to the garments and Vietnamese cultural context. Use natural proportions and a realistic pose.";
  return [
    `Edit Image 1 into a realistic full-body virtual try-on photograph for the outfit \"${title}\".`,
    "Attach the exported outfit board as Image 1. It is the authoritative visual reference for both the garments and the background. Preserve the garments, layers, colors, patterns and accessories.",
    "Keep Image 1's existing background: the same architecture, flowers, drapes, decorations, ground, perspective, lighting and colors. Do not replace, redesign or simplify the scene, even with another similar Vietnamese setting. If the reference has a plain background, keep it plain instead of inventing a location.",
    "Change only the displayed clothing into one person naturally wearing it in the central open space. Show the complete outfit and feet with realistic scale, contact shadows and occlusion. Keep Image 1's aspect ratio and camera framing. Remove the floating outfit, board captions, branding and footer; preserve the scene behind them.",
    wearer,
    `Garments:\n${garments || "- Follow the attached outfit board exactly."}`,
    `Style: ${snapshot.styleMode}. Closure: ${snapshot.overlapDirection}. Preserve recognisable Vietnamese garment structure and avoid inventing extra clothing or changing the selected colors. This image is an artistic preview, not a cultural or fit certification.`,
  ].join("\n\n");
}
