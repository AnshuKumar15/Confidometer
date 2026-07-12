# Force IPv4 globally to prevent connection/DNS resolution timeouts on Windows when IPv6 is misconfigured or blocked
import socket
original_getaddrinfo = socket.getaddrinfo
def forced_getaddrinfo(*args, **kwargs):
    responses = original_getaddrinfo(*args, **kwargs)
    return [res for res in responses if res[0] == socket.AF_INET]
socket.getaddrinfo = forced_getaddrinfo

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine

from app.routes import auth
from app.models import user, speech  # ensure all models are registered before create_all

Base.metadata.create_all(bind=engine)

# ── Auto-migration: add new columns to existing tables without Alembic ──
def check_and_add_columns():
    """Inspect the live DB and ALTER TABLE to add any missing columns from the Speech and User models."""
    from sqlalchemy import inspect as sa_inspect
    inspector = sa_inspect(engine)

    if not inspector.has_table("speeches"):
        return

    existing_cols = {col["name"] for col in inspector.get_columns("speeches")}
    new_columns = {
        "progress": "INTEGER DEFAULT 0",
        "role": "VARCHAR",
        "company_name": "VARCHAR",
        "conversation_history": "TEXT",
        "interview_type": "VARCHAR",
        "dsa_code": "TEXT",
        "dsa_question_details": "TEXT",
        "eye_contact_score": "FLOAT",
        "technical_knowledge_score": "FLOAT",
        "fluency_score": "FLOAT",
        "use_of_words_score": "FLOAT",
        "filler_words_score": "FLOAT",
        "explanation_quality_score": "FLOAT",
        "code_quality_score": "FLOAT",
        "optimization_score": "FLOAT",
        "thinking_process_score": "FLOAT",
        "communication_score": "FLOAT",
        "technical_feedback": "TEXT",
        "non_technical_feedback": "TEXT",
        "short_summary_feedback": "TEXT",
        # Negotiation fields
        "negotiation_score": "FLOAT",
        # Stress simulation fields
        "stress_mode": "BOOLEAN DEFAULT FALSE",
        "fidgeting_index": "FLOAT",
        "speech_rate_variance": "FLOAT",
        "stress_tolerance_score": "FLOAT",
    }

    for col_name, col_type in new_columns.items():
        if col_name not in existing_cols:
            try:
                with engine.begin() as conn:
                    conn.execute(
                        __import__("sqlalchemy").text(
                            f'ALTER TABLE speeches ADD COLUMN "{col_name}" {col_type}'
                        )
                    )
                print(f"[MIGRATION] Added column '{col_name}' to speeches table.")
            except Exception as e:
                print(f"[MIGRATION] Skipping column '{col_name}': {e}")

    # ── Users table migration ──
    if inspector.has_table("users"):
        existing_user_cols = {col["name"] for col in inspector.get_columns("users")}
        user_new_columns = {
            "streak_count": "INTEGER DEFAULT 0",
            "last_active_date": "DATE",
            "badges_unlocked": "TEXT DEFAULT '[]'",
        }
        for col_name, col_type in user_new_columns.items():
            if col_name not in existing_user_cols:
                try:
                    with engine.begin() as conn:
                        conn.execute(
                            __import__("sqlalchemy").text(
                                f'ALTER TABLE users ADD COLUMN "{col_name}" {col_type}'
                            )
                        )
                    print(f"[MIGRATION] Added column '{col_name}' to users table.")
                except Exception as e:
                    print(f"[MIGRATION] Skipping column '{col_name}': {e}")

check_and_add_columns()
# ── End auto-migration ──
from app.config import settings
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load Whisper models in a background thread pool on startup
    # so that the Uvicorn parent/child reload process starts instantly without locking.
    import asyncio
    from app.utils.audio import get_model_batch, get_model_stt
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, get_model_batch)
    loop.run_in_executor(None, get_model_stt)
    yield

app = FastAPI(lifespan=lifespan)

# Parse allowed origins from configuration settings
allowed_origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Auth"])

@app.get("/")
def root():
    return {"message": "Confidence Tracker API Running"}

from app.routes import upload
app.include_router(upload.router, prefix="/upload", tags=["Upload"])

from app.routes import analysis
app.include_router(analysis.router, prefix="/analysis", tags=["Analysis"])

from app.routes import agent
app.include_router(agent.router, prefix="/agent", tags=["Agent"])

from app.routes import trends
app.include_router(trends.router, prefix="/trends", tags=["Trends"])

from app.routes import meeting
app.include_router(meeting.router, prefix="/meeting", tags=["Meeting"])
