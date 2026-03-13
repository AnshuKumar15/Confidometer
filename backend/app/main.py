from fastapi import FastAPI
from app.database import Base, engine
from app.routes import auth
from app.models import user, speech  # ensure all models are registered before create_all

Base.metadata.create_all(bind=engine)
app = FastAPI()

app.include_router(auth.router, prefix="/auth", tags=["Auth"])

@app.get("/")
def root():
    return {"message": "Confidence Tracker API Running"}

from app.routes import upload
app.include_router(upload.router, prefix="/upload", tags=["Upload"])

from app.routes import analysis
app.include_router(analysis.router, prefix="/analysis", tags=["Analysis"])