# 04 — Handoff DATA / BE / FE

## DATA
Chịu trách nhiệm:
- source discovery
- rights
- assertion extraction
- qualifiers
- canonical mapping
- variant relation
- review status
- registry proposal

Không chịu trách nhiệm:
- database implementation
- UI code
- AI provider

## BE
Chịu trách nhiệm:
- meta-model
- validators
- repositories
- migrations
- projection builders
- API
- versioning
- generation orchestration

BE không tự quyết cultural facts.

## FE
Chịu trách nhiệm:
- Education UX
- Composer UX
- cultural explanation
- generation UX

FE không hard-code cultural truth.

## Daily contract sync

Mỗi ngày 15 phút:
1. Có key mới?
2. Có relation mới?
3. Có context thiếu?
4. Có breaking change?
5. Fixture validate?
6. Projection thiếu field?
7. V1 regression?
