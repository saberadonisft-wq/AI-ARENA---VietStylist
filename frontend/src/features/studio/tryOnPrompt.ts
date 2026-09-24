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
    ? "Image 2 is the person to dress. Preserve their identity, face, skin tone, body proportions and pose. Fit the referenced garments naturally; do not replace the person."
    : "No person photo is supplied. Choose one adult wearer with gender presentation and appearance appropriate to the garments and Vietnamese cultural context. Use natural proportions and a realistic pose.";
  return [
    `Create a realistic full-body virtual try-on photograph for the outfit \"${title}\".`,
    "Attach the exported outfit board as Image 1. Treat its garments, layers, colors and accessories as the visual reference. Ignore its white background, captions and page layout.",
    wearer,
    `Garments:\n${garments || "- Follow the attached outfit board exactly."}`,
    `Style: ${snapshot.styleMode}. Closure: ${snapshot.overlapDirection}. Preserve recognisable Vietnamese garment structure and avoid inventing extra clothing or changing the selected colors. This image is an artistic preview, not a cultural or fit certification.`,
  ].join("\n\n");
}
