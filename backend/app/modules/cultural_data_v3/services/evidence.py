"""Public citation metadata for exactly the facts included in a projection."""
from app.core.database import Database
from app.modules.cultural_data_v3.repository import decode_record
from app.modules.cultural_data_v3.services.publication import PublicationPolicy


def constraint_evidence_issue(fact: dict, citations: dict, *, reader=Database) -> str | None:
    """Publication permits display; grounded constraints additionally need support."""
    ids = fact.get("assertion_ids", [])
    if not ids:
        return "missing_evidence"
    for assertion_id in ids:
        citation = citations.get(assertion_id)
        if not citation:
            return "unavailable_evidence"
        if citation["consensus"] not in ("single_source", "corroborated", "strong_consensus"):
            return "uncertain_evidence"
        if not citation["sources"] or any(not s["locator"].strip() for s in citation["sources"]):
            return "missing_evidence_locator"
        row = reader.fetch_one("SELECT predicate,value_json FROM cultural_assertions_v3 WHERE id=? AND review_status='published'", (assertion_id,))
        if not row:
            return "unavailable_evidence"
        assertion = decode_record(row)
        if assertion["predicate"] != fact["attribute_key"] or assertion["value"] != fact["value"] or isinstance(assertion["value"], bool) != isinstance(fact["value"], bool):
            return "mismatched_evidence"
    return None


def evidence_for_facts(facts: list[dict], *, reader=Database) -> list[dict]:
    assertion_ids = set()

    def collect(fact):
        if not isinstance(fact, dict) or fact.get("state") == "withheld":
            return
        assertion_ids.update(fact.get("assertion_ids", []))
        for provenance in fact.get("provenance", []):
            assertion_ids.update(provenance.get("assertion_ids", []))
            assertion_ids.update(provenance.get("relation_assertion_ids", []))
        for candidate in fact.get("candidate_values", []):
            collect(candidate)

    for fact in facts:
        collect(fact)
    policy = PublicationPolicy(reader)
    result = []
    for assertion_id in sorted(assertion_ids):
        if not policy.assertion_is_public(assertion_id):
            continue
        row = reader.fetch_one("SELECT * FROM cultural_assertions_v3 WHERE id=? AND review_status='published'", (assertion_id,))
        if not row:
            continue
        assertion = decode_record(row)
        rows = reader.fetch_all(
            "SELECT s.*, e.locator FROM assertion_evidence_v3 e JOIN cultural_sources_v3 s ON s.id=e.source_id WHERE e.assertion_id=? ORDER BY s.id,e.id",
            (assertion_id,),
        )
        if not rows or any(row["review_status"] != "published" for row in rows):
            continue
        sources = []
        for row in rows:
            source = decode_record(row)
            # Citation metadata only: no copied source text or signed media URL.
            sources.append({
                "source_id": source["id"],
                **{key: source[key] for key in ("title", "creator", "institution", "publication_date", "url", "trust_tier", "version", "rights", "locator")},
            })
        result.append({
            "assertion_id": assertion_id,
            **{key: assertion[key] for key in ("subject_id", "predicate", "qualifiers", "confidence", "consensus")},
            "sources": sources,
        })
    return result
