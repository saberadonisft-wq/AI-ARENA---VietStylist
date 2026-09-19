export type MissingState =
  | "known" | "unknown" | "not_collected" | "not_applicable"
  | "disputed" | "inferred" | "withheld";

export type ContextQualifier = {
  period_ids: string[];
  region_ids: string[];
  place_ids: string[];
  community_ids: string[];
  occasion_ids: string[];
  social_context_ids: string[];
};

export type Entity = {
  id: string;
  entity_type: string;
  schema_version: string;
  identity: { name_vi: string; aliases?: string[]; [key: string]: unknown };
  status: "draft" | "under_review" | "verified" | "published" | "deprecated";
  version: number;
  extensions: Record<string, unknown>;
};

export type AttributeValue = {
  id: string;
  entity_id: string;
  attribute_key: string;
  state: MissingState;
  value?: unknown;
  candidate_values?: unknown[];
  qualifiers: ContextQualifier;
  assertion_ids: string[];
};

export type EntityRelation = {
  id: string;
  subject_id: string;
  relation_type: string;
  object_id: string;
  state: MissingState;
  qualifiers: ContextQualifier;
  assertion_ids: string[];
};

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
