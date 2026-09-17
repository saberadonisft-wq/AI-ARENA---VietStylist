"""
HTTP Client singleton and connection pool management (O02).
"""
from typing import Optional
import httpx

_shared_async_client: Optional[httpx.AsyncClient] = None


def get_shared_async_client(timeout: float = 15.0) -> httpx.AsyncClient:
    """Lấy singleton httpx.AsyncClient tái sử dụng connection pool."""
    global _shared_async_client
    if _shared_async_client is None or _shared_async_client.is_closed:
        limits = httpx.Limits(max_keepalive_connections=20, max_connections=50)
        _shared_async_client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout, connect=5.0),
            limits=limits,
        )
    return _shared_async_client


async def close_shared_async_client():
    """Đóng HTTP client khi ứng dụng shutdown."""
    global _shared_async_client
    if _shared_async_client is not None and not _shared_async_client.is_closed:
        await _shared_async_client.aclose()
        _shared_async_client = None
