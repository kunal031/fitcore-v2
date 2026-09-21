from typing import Any, Generic, List, Optional, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class APIErrorDetails(BaseModel):
    code: str
    message: str
    field: Optional[str] = None


class APIResponse(BaseModel, Generic[T]):
    success: bool = True
    data: Optional[T] = None
    message: Optional[str] = None
    error: Optional[APIErrorDetails] = None


class PaginatedMeta(BaseModel):
    page: int
    limit: int
    total: int
    pages: int


class PaginatedData(BaseModel, Generic[T]):
    items: List[T]
    meta: PaginatedMeta


class PaginatedResponse(BaseModel, Generic[T]):
    success: bool = True
    data: Optional[PaginatedData[T]] = None
    message: Optional[str] = None
    error: Optional[APIErrorDetails] = None
