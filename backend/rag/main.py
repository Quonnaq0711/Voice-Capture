# backend/rag/main.py

import os
import json
import hashlib
import httpx
import redis.asyncio as redis
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import backend.rag.api.ragApi as ragApi


# ─── Lifespan

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.redis  = redis.from_url(
        os.getenv("REDIS_URL", "redis://redis:6379/1"),
        decode_responses=True,
    )
    app.state.client = httpx.AsyncClient(timeout=30)
    yield
    await app.state.redis.aclose()
    await app.state.client.aclose()


# ─── App

app = FastAPI(
    title="BLS / O*NET Data",
    description=(
        "Retrieves, aggregates, and integrates regional and national "
        "statistical datasets to enhance the analysis and contextualisation "
        "of user data."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


# ─── CORS

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,      
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Proxy helpers

BLS_BASE  = "https://api.bls.gov/publicAPI/v2"
ONET_BASE = "https://services.onetcenter.org/ws"
BLS_KEY   = os.getenv("BLS_KEY")
ONET_USER = os.getenv("ONET_USER")
ONET_PASS = os.getenv("ONET_PASS")

TTL = {
    "bls":  60 * 60 * 24 * 30,   # 30d — quarterly release cycle
    "onet": 60 * 60 * 24 * 90,   # 90d — occupation data is stable
}


def _fingerprint(method: str, path: str, params: str, body: bytes) -> str:
    raw = f"{method}:{path}:{params}:{body}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


async def _proxy(
    request: Request,
    base_url: str,
    prefix: str,
    auth: httpx.Auth | None = None,
    extra_params: dict | None = None,
) -> Response:
    r      = request.app.state.redis
    client = request.app.state.client

    path   = request.url.path.removeprefix(f"/{prefix}")
    body   = await request.body()
    params = dict(request.query_params)

    if extra_params:
        params.update(extra_params)

    ck = f"proxy:{prefix}:{_fingerprint(request.method, path, str(params), body)}"

    if cached := await r.get(ck):
        return Response(
            content=cached,
            media_type="application/json",
            headers={"X-Cache": "HIT"},
        )

    try:
        upstream = await client.request(
            method=request.method,
            url=f"{base_url}{path}",
            params=params,
            content=body,
            headers={"Accept": "application/json"},
            auth=auth,
        )
        upstream.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Upstream unreachable: {e}")

    await r.setex(ck, TTL[prefix], upstream.text)

    return Response(
        content=upstream.text,
        media_type="application/json",
        headers={"X-Cache": "MISS"},
    )


# ─── Proxy routes

@app.api_route("/bls/{path:path}", methods=["GET", "POST"], tags=["bls"])
async def bls_proxy(request: Request):
    return await _proxy(
        request,
        base_url=BLS_BASE,
        prefix="bls",
        extra_params={"registrationkey": BLS_KEY} if BLS_KEY else None,
    )


@app.api_route("/onet/{path:path}", methods=["GET"], tags=["onet"])
async def onet_proxy(request: Request):
    return await _proxy(
        request,
        base_url=ONET_BASE,
        prefix="onet",
        auth=httpx.BasicAuth(ONET_USER, ONET_PASS),
    )


# ─── Existing RAG router

app.include_router(
    ragApi.router,
    prefix="/api/v1/intell",
    tags=["rag", "bls", "onet"],
)


# ─── Root + health

@app.get("/", tags=["meta"])         
async def root():
    return {
        "message":     "RAG Data Retrieval API",
        "version":     "1.0.0",
        "description": (
            "Retrieves, aggregates, and integrates regional and national"
            "statistical datasets to enhance the analysis and contextualisation"
            "of user data."
        ),
        "endpoints": {
            "bls":    "/bls/{path}",
            "onet":   "/onet/{path}",
            "intell": "/api/v1/intell",
            "health": "/health",
        },
    }


@app.get("/health", tags=["meta"])
async def health(request: Request):
    try:
        await request.app.state.redis.ping()
        cache_ok = True
    except Exception:
        cache_ok = False
    return {"status": "ok", "cache": cache_ok}


# ─── Entrypoint

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.rag.main:app",
        host="0.0.0.0",
        port=9001,
        reload=True,
    )