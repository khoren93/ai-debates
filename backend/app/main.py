from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api import routes_models, routes_presets, routes_debates, routes_stream

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="API for AI-driven debates using OpenRouter",
    version="0.1.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS Configuration
origins = [
    "http://localhost:3000",
    "http://localhost:5173", # Vite default
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(routes_models.router, prefix="/models", tags=["models"])
app.include_router(routes_presets.router, prefix="/presets", tags=["presets"])
app.include_router(routes_debates.router, prefix="/debates", tags=["debates"])
# Note: Stream router handles its own prefix or we mount it here but often streams are direct paths
# We'll mount it under /debates too for consistency: /debates/{id}/stream
app.include_router(routes_stream.router, prefix="/debates", tags=["stream"])

@app.get("/")
def read_root():
    return {"message": "Welcome to AI Debates API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
