import pytest
from app.domain.models import AttributeValue

def test_known_requires_value():
    with pytest.raises(ValueError):
        AttributeValue(
            id="av1",
            entity_id="e1",
            attribute_key="material.primary",
            state="known",
            value=None,
        )

def test_disputed_requires_candidates():
    with pytest.raises(ValueError):
        AttributeValue(
            id="av2",
            entity_id="e1",
            attribute_key="material.primary",
            state="disputed",
            candidate_values=[],
        )
