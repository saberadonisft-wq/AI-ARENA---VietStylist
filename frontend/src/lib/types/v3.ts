/**
 * Cultural Knowledge Graph v3 TypeScript Contracts
 * Matching backend Pydantic models in app.modules.cultural_data_v3
 */

export type MissingState =
  | 'known'
  | 'unknown'
  | 'not_collected'
  | 'not_applicable'
  | 'disputed'
  | 'inferred'
  | 'withheld';

export interface ContextQualifier {
  period_ids: string[];
  region_ids: string[];
  place_ids: string[];
  community_ids: string[];
  occasion_ids: string[];
  social_context_ids: string[];
}

export interface Entity {
  id: string;
  entity_type: string;
  schema_version: string;
  identity: {
    name_vi: string;
    aliases?: string[];
    [key: string]: any;
  };
  status: 'draft' | 'under_review' | 'verified' | 'published' | 'deprecated';
  version: number;
  extensions?: Record<string, any>;
}

export interface AttributeDefinition {
  key: string;
  label_vi: string;
  description?: string;
  value_type:
    | 'string'
    | 'number'
    | 'boolean'
    | 'enum'
    | 'entity_ref'
    | 'entity_ref_list'
    | 'measurement'
    | 'color'
    | 'date_range'
    | 'geo_ref'
    | 'structured';
  cardinality: 'single' | 'multiple';
  allowed_values?: any[] | null;
  applies_to: string[];
  contextual: boolean;
  queryable: boolean;
  inheritable: boolean;
  default_missing_state: 'unknown' | 'not_collected' | 'not_applicable';
  status: 'draft' | 'active' | 'deprecated';
  version: number;
}

export interface AttributeValue {
  provenance?: FactProvenance[];
  id: string;
  entity_id: string;
  attribute_key: string;
  state: MissingState;
  value?: any;
  candidate_values?: any[];
  qualifiers?: Partial<ContextQualifier>;
  assertion_ids?: string[];
}

export interface RelationDefinition {
  key: string;
  label_vi: string;
  source_types: string[];
  target_types: string[];
  directional: boolean;
  inverse_relation_key?: string | null;
  contextual: boolean;
  inheritable: boolean;
  status: 'draft' | 'active' | 'deprecated';
  version: number;
}

export interface EntityRelation {
  provenance?: FactProvenance[];
  id: string;
  subject_id: string;
  relation_type: string;
  object_id: string;
  state: MissingState;
  qualifiers?: Partial<ContextQualifier>;
  assertion_ids?: string[];
}

export interface OutfitSelection {
  selection_id: string;
  slot: string;
  canonical_entity_id: string;
  canonical_variant_id?: string | null;
  renderable_item_id?: string | null;
  render_variant_id?: string | null;
  style?: Record<string, any>;
  transform?: Record<string, any> | null;
}

export interface OutfitSpecV2 {
  schema_version: '2.0';
  dataset_version: string;
  ruleset_version?: string | null;
  selections: OutfitSelection[];
  context?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface LegacyMappingBundle {
  dataset_version: string;
  ruleset_version: string;
  reproducible: boolean;
  mappings: Array<{
    legacy_table: string;
    legacy_id: string;
    canonical_entity_id: string;
    canonical_entity_type: string;
    renderable_item_id: string | null;
    render_variants: Record<string, string>;
  }>;
}

// Projections

export interface FactProvenance {
  entity_id: string;
  fact_id: string;
  entity_path: string[];
  relation_path: string[];
  relation_assertion_ids?: string[];
  assertion_ids: string[];
  qualifiers: Partial<ContextQualifier>;
}

export interface EducationProjection {
  evidence: EvidenceCitation[];
  context?: Partial<ContextQualifier> | null;
  projection_version: string;
  entity_id: string;
  title?: string;
  aliases: string[];
  entity_type?: string;
  status?: string;
  attributes: AttributeValue[];
  relations: EntityRelation[];
}

export interface ComposerBundle {
  evidence: EvidenceCitation[];
  context?: Partial<ContextQualifier>;
  projection_version: string;
  dataset_version: string;
  entity: Entity;
  attributes: AttributeValue[];
  relations: EntityRelation[];
  renderables: any[];
  style_options: any[];
  rules: any[];
}

export interface GenerationProfile {
  evidence: EvidenceCitation[];
  context?: Partial<ContextQualifier>;
  unresolved?: AttributeValue[];
  projection_version: string;
  subject_id: string;
  must_preserve: Array<{
    feature: string;
    value: any;
    assertion_ids: string[];
    provenance?: FactProvenance[];
    qualifiers?: Partial<ContextQualifier>;
    subject_id?: string;
  }>;
  may_vary: string[];
  forbidden: any[];
  reference_media_ids: string[];
}

export interface EvidenceCitation {
  assertion_id: string;
  subject_id: string;
  predicate: string;
  qualifiers: Partial<ContextQualifier>;
  confidence: number;
  consensus: string;
  sources: Array<{
    source_id: string;
    title: string;
    creator?: string | null;
    institution?: string | null;
    publication_date?: string | null;
    url?: string | null;
    trust_tier: string;
    version: number;
    rights: Record<string, unknown>;
    locator: string;
  }>;
}
