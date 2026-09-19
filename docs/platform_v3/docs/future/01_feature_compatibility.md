# Feature compatibility

## Feature dùng trực tiếp core hiện tại
- Education
- Composer
- Timeline
- Cultural map
- Search
- RAG chatbot
- AI grounding
- Cultural validation
- Recommendation contextual
- Research export

## Feature cần bounded context mới

### 3D / AR / Fit
Cần:
- mesh
- skeleton
- rig
- pattern pieces
- measurements
- simulation

Reference canonical entity.

### Tailoring
Cần sizing system, grading, tolerance, measurements.

### Commerce
Cần product/SKU/seller/price/stock/order.

### Wardrobe
Cần UserOwnedGarmentInstance, personal media, condition, history.

### Social
Cần post/comment/reaction/moderation.

### Personalization
Cần event log/preferences/ranking features.

### Collaborative Editing
Có thể cần revision graph/diff/merge/event sourcing.

### ML Training
Cần Dataset/Sample/Annotation/Split/TrainingRights/ModelLineage.

### Museum Collection Management
Cần MuseumObject/accession/custody/conservation/exhibition.

## Kết luận
Core không cần “nuốt” mọi feature.
Nó cần cung cấp stable canonical IDs để domain mới reference.
