from typing import List, Optional, Dict, Any
from pydantic import BaseModel


class LookbookRef(BaseModel):
    lookbook_id: str
    lookbook_title: str
    cover_image_url: Optional[str] = None


class SolutionFormResponse(BaseModel):
    id: str
    owner_id: str
    team_name: str
    product_name: str
    target_audience: Optional[str] = None
    problem_statement: Optional[str] = None
    proposed_solution: Optional[str] = None
    cultural_safeguards: Optional[str] = None
    lookbook_references: List[LookbookRef] = []
    revision: int
    status: str
    created_at: str
    updated_at: str


class UpdateSolutionFormRequest(BaseModel):
    team_name: str
    product_name: str
    target_audience: Optional[str] = None
    problem_statement: Optional[str] = None
    proposed_solution: Optional[str] = None
    cultural_safeguards: Optional[str] = None
    lookbook_references: List[LookbookRef] = []
    revision: int # Concurrency check
    status: str = "draft"
