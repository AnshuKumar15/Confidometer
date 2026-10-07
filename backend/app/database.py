from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,       # Detect stale/dropped connections before use (Neon drops idle connections)
    pool_recycle=300,          # Recycle connections every 5 min to prevent timeout
    pool_size=3,               # Keep base connection pool small to avoid holding Neon compute active
    max_overflow=2,            # Allow up to 2 temporary overflow connections under burst
    pool_timeout=30,           # Wait up to 30s before timing out
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()