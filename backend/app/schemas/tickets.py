"""Ticket request schemas."""

from pydantic import Field

from app.schemas.common import Category, Input, Priority


class CreateTicket(Input):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10, max_length=10000)
    attachment: str | None = Field(default=None, max_length=255)


class Override(Input):
    category: Category
    priority: Priority


class Reply(Input):
    body: str = Field(min_length=1, max_length=10000)
