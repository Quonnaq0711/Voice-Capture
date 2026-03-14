from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.Rag.api import ragApi


app=FastAPI(
    title="BLS and O*Net Data",
    description="The system retrieves, aggregates, and integrates regional and national statistical datasets to enhance the analysis and contextualization of user data.",
    version="1.0.0"
)

# Cors Config
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "https://loscalhost:",
    "https://127.0.0.1:"
    ],
    allow_creditials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router
app.include_router(
    rag.router,
    prefix="/api/v1/rg",
    tags=["rag","bls","o*net"]
)

app.get("/")
async def root():
    return{
        "message": "Rag Data Retreival API",
        "version": "1.0.0",
        "description": "The system retrieves, aggregates, and integrates regional and national statistical datasets to enhance the analysis and contextualization of user data.",
        "endpoints": {

        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.Rag.main:app",
        host="0.0.0.0",
        port=9001,
        reload=True,
    )