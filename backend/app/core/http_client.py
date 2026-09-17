"""One bounded HTTP pool per event loop and timeout policy; closed by lifespan."""

import asyncio
import httpx

_clients = {}


def get_shared_async_client(timeout=15.0):
    key = (asyncio.get_running_loop(), timeout)
    client = _clients.get(key)
    if client is None or client.is_closed:
        client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout, connect=5.0),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
        )
        _clients[key] = client
    return client


async def close_shared_async_client():
    loop = asyncio.get_running_loop()
    for key, client in list(_clients.items()):
        if key[0] is loop:
            await client.aclose()
            del _clients[key]
