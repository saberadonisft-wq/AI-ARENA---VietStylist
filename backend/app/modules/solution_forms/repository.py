import json
from typing import Optional, Dict, Any
from app.core.database import Database, db_transaction


class SolutionFormRepository:
    @staticmethod
    def get_by_owner_id(owner_id: str) -> Optional[Dict[str, Any]]:
        return Database.fetch_one("SELECT * FROM solution_forms WHERE owner_id = ?", (owner_id,))

    @staticmethod
    def create_form(
        form_id: str,
        owner_id: str,
        team_name: str,
        product_name: str,
        target_audience: Optional[str],
        problem_statement: Optional[str],
        proposed_solution: Optional[str],
        cultural_safeguards: Optional[str],
        lookbook_references_json: str,
    ) -> None:
        Database.execute("""
            INSERT INTO solution_forms (
                id, owner_id, team_name, product_name, target_audience,
                problem_statement, proposed_solution, cultural_safeguards,
                lookbook_references, revision, status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'draft')
        """, (
            form_id, owner_id, team_name, product_name, target_audience,
            problem_statement, proposed_solution, cultural_safeguards,
            lookbook_references_json,
        ))

    @staticmethod
    def update_form_cas(
        owner_id: str,
        expected_revision: int,
        team_name: str,
        product_name: str,
        target_audience: Optional[str],
        problem_statement: Optional[str],
        proposed_solution: Optional[str],
        cultural_safeguards: Optional[str],
        lookbook_references_json: str,
        status: str,
    ) -> bool:
        """Atomic Compare-And-Swap (CAS) update by owner_id and revision (O03)."""
        rowcount = Database.execute("""
            UPDATE solution_forms
            SET team_name = ?, product_name = ?, target_audience = ?,
                problem_statement = ?, proposed_solution = ?, cultural_safeguards = ?,
                lookbook_references = ?, revision = revision + 1, status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE owner_id = ? AND revision = ?
        """, (
            team_name, product_name, target_audience,
            problem_statement, proposed_solution, cultural_safeguards,
            lookbook_references_json, status,
            owner_id, expected_revision,
        ))
        return rowcount > 0
