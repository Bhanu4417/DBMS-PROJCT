"""Pagination, CSV and sorting helpers shared by the routers."""
from __future__ import annotations

import csv
import io
from typing import Any

from fastapi import Response
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

MAX_PAGE_SIZE = 200


def paginate(db: Session, stmt: Select, page: int, page_size: int) -> tuple[list[Any], int]:
    """Return one page of rows plus the total row count for the same query."""
    page = max(page, 1)
    page_size = min(max(page_size, 1), MAX_PAGE_SIZE)
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.execute(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return rows, total


def page_payload(items: list[Any], total: int, page: int, page_size: int) -> dict[str, Any]:
    page_size = min(max(page_size, 1), MAX_PAGE_SIZE)
    pages = (total + page_size - 1) // page_size
    return {"items": items, "total": total, "page": page, "page_size": page_size, "pages": pages}


def sort_column(mapping: dict[str, Any], sort_by: str | None, default: Any):
    """Pick a whitelisted ORDER BY column — never interpolate user input into SQL."""
    if sort_by and sort_by in mapping:
        return mapping[sort_by]
    return default


def apply_sort(stmt: Select, column: Any, direction: str) -> Select:
    return stmt.order_by(column.desc() if direction.lower() == "desc" else column.asc())


def csv_response(filename: str, columns: list[str], rows: list[dict[str, Any]]) -> Response:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow({key: ("" if row.get(key) is None else row.get(key)) for key in columns})
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
