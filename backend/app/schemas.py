from typing import Literal
from pydantic import BaseModel, Field, ConfigDict

Category = Literal['IT', 'HR', 'Finance', 'Admin', 'Other']
Priority = Literal['Low', 'Medium', 'High']

class Input(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')

class Login(Input):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)

class CreateTicket(Input):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10, max_length=10000)
    attachment: str | None = Field(default=None, max_length=255)

class Override(Input):
    category: Category
    priority: Priority

class Reply(Input):
    body: str = Field(min_length=1, max_length=10000)

class Classification(BaseModel):
    category: Category
    priority: Priority

class GroundedReply(BaseModel):
    supported: bool
    reply: str
    sources: list[str]
