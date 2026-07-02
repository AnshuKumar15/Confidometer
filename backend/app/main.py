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