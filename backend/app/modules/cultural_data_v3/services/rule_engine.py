"""Safe, data-driven rule engine for cultural validation.

Supports a restricted set of operators to prevent code injection.
"""
from __future__ import annotations

from typing import Any, Dict
import re

ALLOWED_OPERATORS = {
    "eq", "neq", "in", "not_in", "contains",
    "exists", "missing", "all", "any",
}


def validate_condition(condition):
    count = 0
    def visit(node, depth):
        nonlocal count
        count += 1
        if depth > 12 or count > 200 or not isinstance(node, dict):
            raise ValueError("Invalid rule complexity")
        op = node.get("operator")
        if op not in ALLOWED_OPERATORS:
            raise ValueError("Unsupported rule operator")
        if op in ("all", "any"):
            children = node.get("conditions")
            if not isinstance(children, list) or not 1 <= len(children) <= 64:
                raise ValueError("Composite rules require 1-64 conditions")
            for child in children:
                visit(child, depth + 1)
        else:
            path = node.get("field")
            if not isinstance(path, str) or len(path) > 300 or not re.fullmatch(r"[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*", path):
                raise ValueError("Invalid rule field path")
            if op in ("in", "not_in") and (not isinstance(node.get("value"), list) or len(node["value"]) > 128):
                raise ValueError("Membership rules require a bounded list")
    visit(condition, 0)


def get_path(data: Dict[str, Any], path: str) -> Any:
    """Safely traverse a nested dict by dot-separated path."""
    current: Any = data
    for part in path.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return current


def evaluate_condition(condition: Dict[str, Any], ctx: Dict[str, Any]) -> bool:
    """Evaluate a single condition against a context dict.

    Raises ValueError for unsupported operators to prevent injection.
    """
    op = condition.get("operator")
    if op not in ALLOWED_OPERATORS:
        raise ValueError(f"Unsupported operator: {op}")

    # Composite operators
    if op == "all":
        return all(
            evaluate_condition(sub, ctx)
            for sub in condition.get("conditions", [])
        )
    if op == "any":
        return any(
            evaluate_condition(sub, ctx)
            for sub in condition.get("conditions", [])
        )

    # Field-level operators
    actual = get_path(ctx, condition["field"])
    expected = condition.get("value")

    if op == "eq":
        return actual == expected
    if op == "neq":
        return actual != expected
    if op == "in":
        return actual in (expected or [])
    if op == "not_in":
        return actual not in (expected or [])
    if op == "contains":
        return isinstance(actual, list) and expected in actual
    if op == "exists":
        return actual is not None
    if op == "missing":
        return actual is None

    return False


def evaluate_supported_condition(condition: dict, ctx: dict) -> bool | None:
    """Three-valued evaluation: missing cultural knowledge is not a false fact.

    Missing equipped slots are observable and can satisfy a 'missing' rule.
    Missing facts may mean unknown/disputed/withheld/unreviewed, so they cannot
    prove either compliance or a violation, including under all/any operators.
    """
    op = condition["operator"]
    if op in ("all", "any"):
        values = [evaluate_supported_condition(c, ctx) for c in condition["conditions"]]
        if op == "all":
            return False if False in values else None if None in values else True
        return True if True in values else None if None in values else False
    field = condition["field"]
    if condition["operator"] not in ("exists", "missing") and get_path(ctx, field) is None:
        return None
    return evaluate_condition(condition, ctx)
