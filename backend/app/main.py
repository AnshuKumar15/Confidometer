import socket
import sys

# Force IPv4 globally to prevent connection/DNS resolution timeouts on Windows when IPv6 is misconfigured or blocked
if sys.platform == "win32":
    original_getaddrinfo = socket.getaddrinfo
    def forced_getaddrinfo(*args, **kwargs):
        responses = original_getaddrinfo(*args, **kwargs)
        return [res for res in responses if res[0] == socket.AF_INET]
    socket.getaddrinfo = forced_getaddrinfo

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine

from app.routes import auth
from app.models import user, speech, meeting_request, autoapply_models  # ensure all models are registered before create_all

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
        "sql_queries": "TEXT",
        "sql_question_details": "TEXT",
        "sql_score": "FLOAT",
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

    # ── User Preferences table migration ──
    if inspector.has_table("user_preferences"):
        existing_pref_cols = {col["name"] for col in inspector.get_columns("user_preferences")}
        pref_new_columns = {
            "career_goal_intent": "VARCHAR",
            "education_level": "VARCHAR",
        }
        for col_name, col_type in pref_new_columns.items():
            if col_name not in existing_pref_cols:
                try:
                    with engine.begin() as conn:
                        conn.execute(
                            __import__("sqlalchemy").text(
                                f'ALTER TABLE user_preferences ADD COLUMN "{col_name}" {col_type}'
                            )
                        )
                    print(f"[MIGRATION] Added column '{col_name}' to user_preferences table.")
                except Exception as e:
                    print(f"[MIGRATION] Skipping column '{col_name}': {e}")

    # ── Discovered Jobs table migration ──
    if inspector.has_table("discovered_jobs"):
        existing_job_cols = {col["name"] for col in inspector.get_columns("discovered_jobs")}
        job_new_columns = {
            "min_experience": "INTEGER",
            "max_experience": "INTEGER",
            "work_mode": "VARCHAR",
        }
        for col_name, col_type in job_new_columns.items():
            if col_name not in existing_job_cols:
                try:
                    with engine.begin() as conn:
                        conn.execute(
                            __import__("sqlalchemy").text(
                                f'ALTER TABLE discovered_jobs ADD COLUMN "{col_name}" {col_type}'
                            )
                        )
                    print(f"[MIGRATION] Added column '{col_name}' to discovered_jobs table.")
                except Exception as e:
                    print(f"[MIGRATION] Skipping column '{col_name}': {e}")

        # Backfill existing discovered_jobs that have NULL min_experience or work_mode
        try:
            from app.services.job_discovery import JobDiscoveryEngine
            from app.database import SessionLocal
            from app.models.autoapply_models import DiscoveredJob
            with SessionLocal() as db:
                unfilled_jobs = db.query(DiscoveredJob).filter(
                    (DiscoveredJob.min_experience == None) | (DiscoveredJob.work_mode == None)
                ).limit(500).all()
                if unfilled_jobs:
                    updated = False
                    for j in unfilled_jobs:
                        if j.min_experience is None:
                            min_exp, max_exp = JobDiscoveryEngine._extract_experience(j.description or "", j.title or "")
                            if min_exp is not None:
                                j.min_experience = min_exp
                                j.max_experience = max_exp
                                updated = True
                        if not j.work_mode:
                            loc = (j.location or "").lower()
                            if any(k in loc for k in ["remote", "work from home", "wfh", "anywhere", "worldwide"]):
                                j.work_mode = "remote"
                                updated = True
                            elif "hybrid" in loc:
                                j.work_mode = "hybrid"
                                updated = True
                            elif loc and loc != "not specified":
                                j.work_mode = "onsite"
                                updated = True
                    if updated:
                        db.commit()
                        print(f"[MIGRATION] Backfilled experience/work_mode for {len(unfilled_jobs)} existing jobs.")
        except Exception as bf_err:
            print(f"[MIGRATION] Backfill note: {bf_err}")

check_and_add_columns()
# ── End auto-migration ──
from app.config import settings
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    from app.services.scheduler import start_scheduler, stop_scheduler

    # Ensure MediaPipe model files (.task) are present
    try:
        from app.utils.download_models import download_models
        download_models()
    except Exception as dl_err:
        print(f"[WARN] Failed to pre-download models: {dl_err}")

    # Only pre-load local Whisper models if Groq API is NOT configured
    # When Groq is available, STT is handled via API calls — no need to load ~2GB of PyTorch models into RAM
    if not os.environ.get("GROQ_API_KEY"):
        from app.utils.audio import get_model_batch, get_model_stt
        loop = asyncio.get_event_loop()
        loop.run_in_executor(None, get_model_batch)
        loop.run_in_executor(None, get_model_stt)
    else:
        print("[INFO] GROQ_API_KEY detected — skipping local Whisper model loading to save RAM.")

    # Start AutoApply background scheduler
    start_scheduler()
    yield
    stop_scheduler()

from app.rate_limiter import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

app = FastAPI(lifespan=lifespan)

# ── Rate Limiting ──
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

from fastapi.staticfiles import StaticFiles
import os
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# CORS: Use origin regex to dynamically match and echo back the requesting origin.
# When allow_credentials=True, the CORS spec forbids Access-Control-Allow-Origin: *
# so we use allow_origin_regex which causes Starlette to echo back the actual origin.
# NOTE: Do NOT combine allow_origins (explicit list) with allow_origin_regex — some
# Starlette versions have bugs where the preflight response omits the header entirely.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

from starlette.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=500)

app.include_router(auth.router, prefix="/auth", tags=["Auth"])

@app.api_route("/", methods=["GET", "HEAD"])
def root():
    return {"message": "Confidence Tracker API Running"}

@app.api_route("/health", methods=["GET", "HEAD"])
def health_check(check_db: bool = False):
    """Health check endpoint for production uptime monitors (Better Stack / UptimeRobot).
    By default, performs a lightweight shallow check that does NOT query Neon database,
    allowing Neon compute to scale to zero when the app is idle.
    Pass ?check_db=true if deep database connectivity verification is explicitly needed.
    """
    if check_db:
        try:
            from app.database import engine
            from sqlalchemy import text
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            db_status = "healthy"
        except Exception as e:
            db_status = f"unhealthy: {str(e)}"
        
        is_healthy = db_status == "healthy"
        return {
            "status": "ok" if is_healthy else "degraded",
            "database": db_status
        }

    return {"status": "ok"}

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

from app.routes import autoapply
app.include_router(autoapply.router, prefix="/autoapply", tags=["AutoApply"])