import type { OutfitSpecV2 } from "../state/types";

export async function fetchComposerBundle(entityId: string) {
  const res = await fetch(`/api/v3/composer/bundles/${encodeURIComponent(entityId)}`);
  if (!res.ok) throw new Error("Failed to load composer bundle");
  return res.json();
}

export async function validateOutfit(outfit: OutfitSpecV2) {
  const res = await fetch("/api/v3/outfits/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(outfit),
  });
  if (!res.ok) throw new Error("Failed to validate outfit");
  return res.json();
}
