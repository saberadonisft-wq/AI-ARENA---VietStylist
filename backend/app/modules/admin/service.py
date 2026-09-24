import json
from typing import Dict, Any
from app.core.database import Database
from app.modules.admin.schemas import (
    CreateItemAdminRequest,
    CreateVariantAdminRequest,
    CreateRuleAdminRequest,
    CreateArticleAdminRequest,
)
from app.modules.admin.recolor_guard import validate_new_item_metadata


class AdminService:
    @staticmethod
    def create_item(req: CreateItemAdminRequest) -> Dict[str, Any]:
        metadata = validate_new_item_metadata(req.metadata)
        meta_json = json.dumps(metadata, ensure_ascii=False)
        Database.execute("""
            INSERT INTO items (id, garment_type_id, slot, name, gender, description, era, is_published, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (req.id, req.garment_type_id, req.slot, req.name, req.gender, req.description, req.era, 1 if req.is_published else 0, meta_json))
        return {"status": "created", "item_id": req.id}

    @staticmethod
    def create_variant(req: CreateVariantAdminRequest) -> Dict[str, Any]:
        Database.execute("""
            INSERT INTO item_variants (id, item_id, color_name, hex_color, secondary_hex, material, thickness_level, pattern_description, price_tier, is_default)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (req.id, req.item_id, req.color_name, req.hex_color, req.secondary_hex, req.material, req.thickness_level, req.pattern_description, req.price_tier, 1 if req.is_default else 0))
        return {"status": "created", "variant_id": req.id}

    @staticmethod
    def create_rule(req: CreateRuleAdminRequest) -> Dict[str, Any]:
        cond_json = json.dumps(req.condition_json, ensure_ascii=False)
        fix_json = json.dumps(req.suggested_fix, ensure_ascii=False) if req.suggested_fix else None
        Database.execute("""
            INSERT INTO cultural_rules (id, code, name, target_garment_type_id, target_slot, severity, condition_json, explanation, source_id, suggested_fix, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (req.id, req.code, req.name, req.target_garment_type_id, req.target_slot, req.severity, cond_json, req.explanation, req.source_id, fix_json, 1 if req.is_active else 0))
        return {"status": "created", "rule_id": req.id}

    @staticmethod
    def create_article(req: CreateArticleAdminRequest) -> Dict[str, Any]:
        Database.execute("""
            INSERT INTO heritage_articles (id, title, slug, short_summary, full_content, structural_description, historical_context, modern_interpretation, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (req.id, req.title, req.slug, req.short_summary, req.full_content, req.structural_description, req.historical_context, req.modern_interpretation, req.status))
        return {"status": "created", "article_id": req.id}
