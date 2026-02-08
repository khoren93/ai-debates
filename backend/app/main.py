from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.db import init_db
from app.api import routes_models, routes_presets, routes_debates, routes_stream

# Admin
from sqladmin import Admin
from app.core.db import engine
from app.admin.views import DebateAdmin, ParticipantAdmin, TurnAdmin, SessionAdmin
from app.admin.auth import authentication_backend

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables
    await init_db()
    yield
    # Shutdown: Clean up if needed

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="API for AI-driven debates using OpenRouter",
    version="0.1.0",
    openapi_url="/api/openapi.json",
    lifespan=lifespan
)

# Sessions for Admin
app.add_middleware(SessionMiddleware, secret_key=settings.SECRET_KEY)

# Initialize Admin
admin = Admin(app, engine, authentication_backend=authentication_backend, base_url="/api/admin")
admin.add_view(DebateAdmin)
admin.add_view(ParticipantAdmin)
admin.add_view(TurnAdmin)
admin.add_view(SessionAdmin)

# CORS Configuration
# Pull allowed origins from environment variable, default to local dev
allowed_origins_str = settings.ALLOWED_ORIGINS if hasattr(settings, "ALLOWED_ORIGINS") else "http://localhost:3000,http://localhost:5173"
origins = [origin.strip() for origin in allowed_origins_str.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers with /api prefix
app.include_router(routes_models.router, prefix="/api/models", tags=["models"])
app.include_router(routes_presets.router, prefix="/api/presets", tags=["presets"])
app.include_router(routes_debates.router, prefix="/api/debates", tags=["debates"])
# Note: Stream router handles its own prefix or we mount it here but often streams are direct paths
# We'll mount it under /api/debates too for consistency: /api/debates/{id}/stream
app.include_router(routes_stream.router, prefix="/api/debates", tags=["stream"])

@app.get("/api")
def read_root():
    return {"message": "Welcome to AI Debates API"}

@app.get("/api/health")
def health_check():
    return {"status": "ok"}
def health_check():
    return {"status": "ok"}
