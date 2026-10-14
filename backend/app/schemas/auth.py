"""Authentication request schemas."""

from pydantic import Field

from app.schemas.common import Input


class Login(Input):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)
