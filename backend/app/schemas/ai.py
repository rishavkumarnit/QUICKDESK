"""Structured output schemas returned by the language model."""

from pydantic import BaseModel, Field

from app.schemas.common import Category, Priority


class Classification(BaseModel):
    category: Category
    priority: Priority
    confidence: float = Field(
        ge=0,
        le=1,
        description="Model confidence in the category suggestion, from 0 to 1.",
    )


class GroundedReply(BaseModel):
    supported: bool
    reply: str
    sources: list[str]
