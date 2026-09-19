"""Reseeding example content cannot claim review or overwrite user verification."""
from app.core.database import Database
from scripts.seed_v3_pilot_data import seed_pilot_data


def test_new_pilot_content_is_draft_not_verified_or_published():
    seed_pilot_data()
    for table, status in [("entity_registry", "status"), ("cultural_sources_v3", "review_status"), ("cultural_assertions_v3", "review_status")]:
        values = Database.fetch_all(f"SELECT DISTINCT {status} AS state FROM {table}")
        assert values and {v["state"] for v in values} == {"draft"}


def test_reseeding_preserves_review_results_corrections_and_reference_rights():
    seed_pilot_data()
    Database.execute("UPDATE entity_registry SET status='published',version=4 WHERE id='garment_ngu_than'")
    Database.execute("UPDATE cultural_sources_v3 SET review_status='rejected',rights_json='{}',title='Corrected source' WHERE id='source_ngan_nam_ao_mu'")
    Database.execute("UPDATE cultural_assertions_v3 SET review_status='disputed',statement_vi='Reviewer correction' WHERE id='assert_ngu_than_5_panels'")
    Database.execute("UPDATE assertion_evidence_v3 SET locator='Corrected edition and page' WHERE id='ev_ngu_than_panels_1'")
    Database.execute("UPDATE attribute_values SET state='unknown',value_json=NULL WHERE id='av_ngu_than_panels'")
    before = {table: Database.fetch_all(f"SELECT * FROM {table}") for table in ["entity_registry", "cultural_sources_v3", "cultural_assertions_v3", "assertion_evidence_v3", "attribute_values", "relation_definitions", "entity_relations", "generation_profiles_v3", "legacy_entity_mappings_v3"]}
    seed_pilot_data()
    for table, rows in before.items():
        assert Database.fetch_all(f"SELECT * FROM {table}") == rows
