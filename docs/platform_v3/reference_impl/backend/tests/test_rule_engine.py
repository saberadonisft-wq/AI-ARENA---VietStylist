import pytest
from app.services.rule_engine import evaluate_condition

def test_eq():
    assert evaluate_condition(
        {"field":"outfit.mode","operator":"eq","value":"remix"},
        {"outfit":{"mode":"remix"}}
    )

def test_reject_unknown_operator():
    with pytest.raises(ValueError):
        evaluate_condition(
            {"field":"x","operator":"python_eval","value":"x"},
            {"x":1}
        )
