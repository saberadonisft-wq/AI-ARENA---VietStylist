from typing import Optional
from pydantic import BaseModel, Field, AliasChoices, TypeAdapter


class ModelItem(BaseModel):
    item_id: str = Field(
        min_length=1, validation_alias=AliasChoices("item_id", "itemId")
    )
    variant_id: Optional[str] = Field(
        default=None, validation_alias=AliasChoices("variant_id", "variantId")
    )
    slot: Optional[str] = None


class ModelOutfit(BaseModel):
    title: str = Field(default="Bộ phối đề xuất", max_length=200)
    explanation: str = Field(default="", max_length=4000)
    items: list[ModelItem] = Field(min_length=1, max_length=16)


def parse_recommendations(value):
    if not isinstance(value, list) or not 1 <= len(value) <= 2:
        raise ValueError("Expected 1-2 recommendations")
    return [
        item.model_dump()
        for item in TypeAdapter(list[ModelOutfit]).validate_python(value)
    ]
