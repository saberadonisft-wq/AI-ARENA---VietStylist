# 03 — Domain Boundaries

## CulturalKnowledge
Chứa canonical cultural entities, attributes, relations, contexts, evidence, sources và cultural rules.

## Rendering2D
Chứa PNG/SVG/mask, anchor, avatar compatibility, z-order và render profiles.

## GenerationAI
Chứa generation profile, grounding package, provider jobs và post-validation.

## Future domains

### 3D/Fit
mesh, rig, body measurements, patterns, cloth simulation.

### Wardrobe
user-owned item, personal photo, wear history, condition.

### Commerce
product, SKU, seller, price, stock, order.

### Museum Collection
museum object, accession, custody, conservation, exhibition.

### Social
post, creator, comment, reaction, moderation.

### Personalization
events, preference profile, ranking features, embeddings.

### ML Dataset
dataset, samples, annotations, splits, training rights, lineage.

Các domain này reference `canonical_entity_id`; không nhét toàn bộ vào CulturalKnowledge.
