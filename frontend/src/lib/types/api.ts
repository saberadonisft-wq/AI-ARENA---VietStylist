// Types matching backend OpenAPI schema

export interface GarmentType {
  id: string;
  name: string;
  description?: string;
  gender_compatibility: string;
  era: string;
  slot_schema: string[];
  is_active: boolean;
}

export interface Occasion {
  id: string;
  name: string;
  description?: string;
  formality_level: string;
  season: string;
  criteria: Record<string, any>;
  icon_name?: string;
}

export interface ItemVariant {
  id: string;
  item_id: string;
  color_name: string;
  hex_color: string;
  secondary_hex?: string;
  material?: string;
  thickness_level: string;
  pattern_description?: string;
  price_tier: string;
  is_default: boolean;
}

export interface AssetLayer {
  id: string;
  item_id: string;
  variant_id?: string;
  avatar_id?: string;
  slot: string;
  z_index: number;
  anchor_x: number;
  anchor_y: number;
  scale_x: number;
  scale_y: number;
  layer_type: "svg" | "image_png" | "mask";
  svg_content?: string;
  media_asset_id?: string;
  color_mask_rule?: Record<string, any>;
}

export interface CatalogItem {
  id: string;
  garment_type_id?: string;
  slot: string;
  name: string;
  gender: string;
  description?: string;
  era?: string;
  is_published: boolean;
  metadata: Record<string, any>;
  variants: ItemVariant[];
  default_layer?: AssetLayer;
}

export interface Avatar {
  id: string;
  name: string;
  gender: string;
  skin_tone: string;
  body_type: string;
  base_image_url?: string;
  svg_body?: string;
  dimensions: { width: number; height: number };
  is_active: boolean;
}

export interface StarterOutfitItem {
  slot: string;
  item_id: string;
  variant_id?: string;
}

export interface StarterOutfit {
  id: string;
  title: string;
  description: string;
  garment_type_id: string;
  occasion_id: string;
  avatar_id: string;
  items: StarterOutfitItem[];
}

export interface ItemTransform {
  dx: number;
  dy: number;
  scale: number;
  rotation: number;
}

export interface SnapshotItem {
  slot: string;
  itemId: string;
  variantId?: string;
  assetVersion: number;
  colorOptionId?: string;
  colorHex?: string;
  transform?: ItemTransform;
}

export interface OutfitSnapshot {
  schemaVersion: number;
  avatarId: string;
  poseId: string;
  occasionId?: string;
  styleMode: "traditional" | "remix" | "modern_fusion";
  overlapDirection: "right_over_left" | "left_over_right";
  items: SnapshotItem[];
  lockedSlots?: string[];
  backgroundTheme?: "white" | "dopaper";
  aspectRatio?: "1:1" | "9:16";
}

export interface OutfitResponse {
  id: string;
  owner_id?: string;
  title: string;
  occasion_id?: string;
  style_mode: string;
  revision: number;
  current_version_id?: string;
  current_snapshot?: OutfitSnapshot;
  preview_image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CulturalRuleWarning {
  rule_id: string;
  code: string;
  name: string;
  severity: "info" | "warning" | "strict";
  explanation: string;
  source_title?: string;
  source_citation?: string;
  suggested_fix?: Record<string, any>;
}

export interface CulturalCheckResponse {
  is_culturally_sound: boolean;
  strict_count: number;
  warning_count: number;
  info_count: number;
  warnings: CulturalRuleWarning[];
}

export interface ColorVariantSuggestion {
  item_id: string;
  variant_id: string;
  color_name: string;
  hex_color: string;
  harmony_reason: string;
}

export interface ColorAnalysisResponse {
  dominant_color: string;
  accent_colors: string[];
  palette_type: string;
  contrast_rating: "good" | "moderate" | "low";
  contrast_ratio: number;
  aesthetic_comment: string;
  suggested_variants: ColorVariantSuggestion[];
}

export interface WeatherData {
  temperature_c: number;
  apparent_temperature_c: number;
  humidity_percent: number;
  weather_condition: string;
  is_rainy: boolean;
  wind_speed_kmh: number;
}

export interface WeatherRecommendation {
  layer_advice: string;
  fabric_advice: string;
  suggested_accessories: string[];
  reason: string;
}

export interface WeatherResponse {
  location: {
    key: string;
    name: string;
    region: string;
    latitude: number;
    longitude: number;
  };
  weather: WeatherData;
  recommendation: WeatherRecommendation;
  cached: boolean;
  source?: "open_meteo" | "sample";
}

export interface HeritageSource {
  id: string;
  title: string;
  author?: string;
  publication_year?: number;
  publisher?: string;
  citation_text: string;
  url?: string;
  license_type: string;
}

export interface ArticleSourceCitation {
  source: HeritageSource;
  page_reference?: string;
  quote?: string;
}

export interface HeritageArticle {
  id: string;
  title: string;
  slug: string;
  short_summary: string;
  full_content?: string;
  structural_description?: string;
  historical_context?: string;
  modern_interpretation?: string;
  status: string;
  version: number;
  author_id?: string;
  author_name?: string;
  author_role?: "stylist" | "admin" | string;
  cover_image_url?: string;
  category?: string;
  era?: string;
  related_garment_id?: string;
  read_time_minutes?: number;
  likes_count?: number;
  created_at?: string;
  sources?: ArticleSourceCitation[];
}

export interface CreateStoryPayload {
  title: string;
  short_summary: string;
  full_content: string;
  category?: string;
  era?: string;
  related_garment_id?: string;
  historical_context?: string;
  modern_interpretation?: string;
  structural_description?: string;
  cover_image_url?: string;
  read_time_minutes?: number;
}

export interface LookbookEntryDetail {
  id: string;
  outfit_id: string;
  outfit_version_id: string;
  version_number: number;
  outfit_title: string;
  snapshot: OutfitSnapshot;
  preview_image_url?: string;
  sort_order: number;
  notes?: string;
}

export interface Lookbook {
  id: string;
  owner_id: string;
  title: string;
  description?: string;
  cover_image_url?: string;
  visibility: "private" | "unlisted" | "public";
  created_at: string;
  updated_at: string;
  entries: LookbookEntryDetail[];
}

export interface SolutionForm {
  id: string;
  owner_id: string;
  team_name: string;
  product_name: string;
  target_audience?: string;
  problem_statement?: string;
  proposed_solution?: string;
  cultural_safeguards?: string;
  lookbook_references: Array<{
    lookbook_id: string;
    lookbook_title: string;
    cover_image_url?: string;
  }>;
  revision: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  roles: string[];
  auth_provider: string;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}
