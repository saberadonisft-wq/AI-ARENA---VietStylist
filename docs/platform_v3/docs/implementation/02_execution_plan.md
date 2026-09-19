# 02 — Kế hoạch thi hành

## Phase A — Meta-model
Code:
- Entity
- AttributeDefinition
- AttributeValue
- RelationDefinition
- EntityRelation
- ContextQualifier
- SourceRecord
- CulturalAssertion
- validators
- fixtures

Gate:
- unknown attribute key bị reject
- invalid relation endpoint bị reject
- missing-state semantics pass

## Phase B — Storage
- additive DB migration
- repositories
- dataset snapshots
- publication state
- legacy mappings

Gate:
- V1 regression green

## Phase C — Projection
- EducationProjection
- ComposerBundle
- GenerationProfile
- TimelineView minimal

Gate:
- frontend không cần đọc graph raw

## Phase D — Composer
- OutfitSpec V2
- V1 adapter
- reducer
- undo/redo
- Canvas adapter
- cultural validation
- save/reload

## Phase E — Generation Mock
- GroundingBuilder
- ReferenceSelector
- PromptBuilder
- MockProvider
- Job lifecycle
- PostValidation interface

## Phase F — Real Data
- 1 garment pilot sâu
- source/evidence
- context
- variant graph
- rights

## Phase G — Real Provider
Chỉ nối sau khi mock flow pass.

## Mỗi phase phải có
- tests
- files changed
- migration note
- API note
- rollback
- known limitations
