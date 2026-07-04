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
    """Inspect the live DB and ALTER TABLE to add any missing columns from the Speech model."""
    from sqlalchemy import inspect as sa_inspect, Text, Float, Integer, String
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
    }

    with engine.connect() as conn:
        for col_name, col_type in new_columns.items():
            if col_name not in existing_cols:
                try:
                    conn.execute(
                        __import__("sqlalchemy").text(
                            f'ALTER TABLE speeches ADD COLUMN "{col_name}" {col_type}'
                        )
                    )
                    conn.commit()
                    print(f"[MIGRATION] Added column '{col_name}' to speeches table.")
                except Exception as e:
                    print(f"[MIGRATION] Skipping column '{col_name}': {e}")

check_and_add_columns()
# ── End auto-migration ──
app = FastAPI()

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3002",
    "http://localhost:3003",
    "http://127.0.0.1:3003",
]

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