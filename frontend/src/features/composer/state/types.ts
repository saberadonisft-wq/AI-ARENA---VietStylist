import type { OutfitSelection, OutfitSpecV2, ComposerBundle, EducationProjection } from "@/lib/types/v3";

export type { OutfitSelection, OutfitSpecV2 };

export interface ComposerState {
  bundle: ComposerBundle | null;
  document: OutfitSpecV2;
  selectedSelectionId: string | null;
  activeEntityEducation: EducationProjection | null;
  validation: {
    status: 'clear' | 'warning' | 'error';
    missing_entities: string[];
  } | null;
  history: {
    past: OutfitSpecV2[];
    future: OutfitSpecV2[];
  };
  ui: {
    activePanel: "garments" | "layers" | "colors" | "accessories" | "culture";
    isGenerating: boolean;
  };
}

