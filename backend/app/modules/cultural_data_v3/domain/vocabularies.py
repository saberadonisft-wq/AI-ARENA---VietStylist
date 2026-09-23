"""Core vocabulary constants for the VietStylist Cultural Knowledge Graph v3."""

MISSING_STATES = [
    "known", "unknown", "not_collected", "not_applicable",
    "disputed", "inferred", "withheld",
]

ENTITY_TYPES = [
    "garment", "garment_variant", "garment_component", "accessory",
    "material", "technique", "pattern", "motif",
    "period", "region", "place", "community", "occasion", "social_context",
    "person", "institution", "cultural_practice", "wearing_ensemble",
]

SOURCE_TYPES = [
    "museum_record", "archival_record", "academic_paper", "academic_book",
    "specialist_book", "official_institution_web", "expert_interview",
    "historical_image", "community_documentation", "commercial_reference", "other",
]

RELATION_TYPES = [
    "derived_from", "influenced_by", "regional_variant_of", "modern_adaptation_of",
    "reconstructed_from", "documented_before", "documented_after", "used_with",
    "layered_over", "layered_under", "made_from", "produced_by",
    "used_during", "associated_with", "documented_in",
]

ATTRIBUTE_NAMESPACES = [
    "construction", "wearing", "material", "production",
    "visual", "historical", "social", "symbolism", "generation",
]

VIEW_TYPES = [
    "front", "back", "left", "right", "three_quarter", "full_body",
    "collar_detail", "closure_detail", "sleeve_detail", "fabric_detail",
    "pattern_detail", "construction_diagram", "historical_context",
    "museum_display", "modern_reconstruction",
]

TRUST_TIERS = [
    "A_ACADEMIC", "B_INSTITUTIONAL", "C_SPECIALIST",
    "D_COMMUNITY", "E_COMMERCIAL", "F_UNVERIFIED",
]
