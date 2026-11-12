from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,       # Detect stale/dropped connections before use (Neon drops idle connections)
    pool_recycle=180,          # Recycle connections every 3 min to prevent stale connection timeouts
    pool_size=10,              # Support concurrent requests and background tasks without starvation
    max_overflow=10,           # Allow up to 10 additional overflow connections under burst
    pool_timeout=60,           # Wait up to 60s during burst before timing out
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()