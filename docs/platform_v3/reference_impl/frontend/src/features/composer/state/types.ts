export type OutfitSelection = {
  selection_id: string;
  slot: string;
  canonical_entity_id: string;
  canonical_variant_id?: string | null;
  renderable_item_id?: string | null;
  render_variant_id?: string | null;
  style: Record<string, unknown>;
  transform?: Record<string, unknown> | null;
};

export type OutfitSpecV2 = {
  schema_version: "2.0";
  dataset_version: string;
  ruleset_version?: string | null;
  selections: OutfitSelection[];
  context: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type ComposerState = {
  bundle: Record<string, unknown> | null;
  document: OutfitSpecV2;
  selectedSelectionId: string | null;
  validation: Record<string, unknown> | null;
  history: {
    past: OutfitSpecV2[];
    future: OutfitSpecV2[];
  };
  ui: {
    activePanel: "garments" | "layers" | "colors" | "accessories" | "culture";
  };
};
