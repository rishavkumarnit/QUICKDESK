"""Shared schema primitives and constrained ticket values."""

from typing import Literal

from pydantic import BaseModel, ConfigDict


Category = Literal["IT", "HR", "Finance", "Admin", "Other"]
Priority = Literal["Low", "Medium", "High"]


class Input(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
